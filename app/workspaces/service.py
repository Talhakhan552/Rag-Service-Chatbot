"""
Workspace service layer. This is the core of multi-tenancy: every
workspace has exactly one owner and zero-or-more additional members
with a role. Role checks (who can invite, remove, delete) live here
so they're enforced consistently regardless of which route calls in.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember, WorkspaceRole
from app.utils.text import slugify, unique_suffix

ROLE_RANK = {WorkspaceRole.MEMBER: 1, WorkspaceRole.ADMIN: 2, WorkspaceRole.OWNER: 3}


class WorkspaceNotFoundError(Exception):
    pass


class NotAMemberError(Exception):
    pass


class InsufficientRoleError(Exception):
    pass


class UserNotFoundError(Exception):
    pass


class AlreadyMemberError(Exception):
    pass


class LastOwnerError(Exception):
    """Raised when an action would leave a workspace with zero owners."""

    pass


def role_at_least(role: WorkspaceRole, minimum: WorkspaceRole) -> bool:
    return ROLE_RANK[role] >= ROLE_RANK[minimum]


async def create_workspace(db: AsyncSession, owner: User, name: str) -> Workspace:
    base_slug = slugify(name)
    slug = base_slug
    for _ in range(5):
        existing = await db.scalar(select(Workspace).where(Workspace.slug == slug))
        if existing is None:
            break
        slug = f"{base_slug}-{unique_suffix()}"

    workspace = Workspace(name=name, slug=slug, owner_id=owner.id)
    db.add(workspace)
    await db.flush()

    membership = WorkspaceMember(workspace_id=workspace.id, user_id=owner.id, role=WorkspaceRole.OWNER)
    db.add(membership)
    await db.flush()

    return workspace


async def get_membership(db: AsyncSession, workspace_id: uuid.UUID, user_id: uuid.UUID) -> WorkspaceMember:
    membership = await db.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id, WorkspaceMember.user_id == user_id
        )
    )
    if membership is None:
        raise NotAMemberError()
    return membership


async def list_workspaces_for_user(db: AsyncSession, user_id: uuid.UUID) -> list[tuple[Workspace, WorkspaceRole]]:
    result = await db.execute(
        select(Workspace, WorkspaceMember.role)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(WorkspaceMember.user_id == user_id)
        .order_by(Workspace.created_at)
    )
    return [(row[0], row[1]) for row in result.all()]


async def get_workspace(db: AsyncSession, workspace_id: uuid.UUID) -> Workspace:
    workspace = await db.get(Workspace, workspace_id)
    if workspace is None:
        raise WorkspaceNotFoundError()
    return workspace


async def update_workspace(db: AsyncSession, workspace: Workspace, name: str | None) -> Workspace:
    if name is not None:
        workspace.name = name
    await db.flush()
    return workspace


async def delete_workspace(db: AsyncSession, workspace: Workspace) -> None:
    await db.delete(workspace)  # cascades to members via ondelete="CASCADE"


async def list_members(db: AsyncSession, workspace_id: uuid.UUID) -> list[WorkspaceMember]:
    result = await db.execute(
        select(WorkspaceMember)
        .where(WorkspaceMember.workspace_id == workspace_id)
        .options(selectinload(WorkspaceMember.user))
        .order_by(WorkspaceMember.created_at)
    )
    return list(result.scalars().all())


async def invite_member(
    db: AsyncSession, workspace_id: uuid.UUID, email: str, role: WorkspaceRole
) -> WorkspaceMember:
    user = await db.scalar(select(User).where(User.email == email))
    if user is None:
        raise UserNotFoundError()

    existing = await db.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id, WorkspaceMember.user_id == user.id
        )
    )
    if existing is not None:
        raise AlreadyMemberError()

    membership = WorkspaceMember(workspace_id=workspace_id, user_id=user.id, role=role)
    db.add(membership)
    await db.flush()
    await db.refresh(membership, attribute_names=["user"])
    return membership


async def _count_owners(db: AsyncSession, workspace_id: uuid.UUID) -> int:
    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id, WorkspaceMember.role == WorkspaceRole.OWNER
        )
    )
    return len(result.scalars().all())


async def update_member_role(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    actor_role: WorkspaceRole,
    target_user_id: uuid.UUID,
    new_role: WorkspaceRole,
) -> WorkspaceMember:
    membership = await get_membership(db, workspace_id, target_user_id)

    # Only an owner can touch another owner's role -- otherwise an
    # admin could demote the owner and take control of the workspace.
    if membership.role == WorkspaceRole.OWNER and actor_role != WorkspaceRole.OWNER:
        raise InsufficientRoleError()

    if membership.role == WorkspaceRole.OWNER and new_role != WorkspaceRole.OWNER:
        if await _count_owners(db, workspace_id) <= 1:
            raise LastOwnerError()

    membership.role = new_role
    await db.flush()
    return membership


async def remove_member(
    db: AsyncSession, workspace_id: uuid.UUID, actor_role: WorkspaceRole, target_user_id: uuid.UUID
) -> None:
    membership = await get_membership(db, workspace_id, target_user_id)

    if membership.role == WorkspaceRole.OWNER and actor_role != WorkspaceRole.OWNER:
        raise InsufficientRoleError()

    if membership.role == WorkspaceRole.OWNER and await _count_owners(db, workspace_id) <= 1:
        raise LastOwnerError()

    await db.delete(membership)