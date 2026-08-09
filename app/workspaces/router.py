import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.models.workspace import WorkspaceMember, WorkspaceRole
from app.workspaces.dependencies import get_current_membership, require_role
from app.workspaces.schemas import (
    MemberInvite,
    MemberOut,
    MemberRoleUpdate,
    WorkspaceCreate,
    WorkspaceOut,
    WorkspaceUpdate,
)
from app.workspaces.service import (
    AlreadyMemberError,
    InsufficientRoleError,
    LastOwnerError,
    UserNotFoundError,
    create_workspace,
    delete_workspace,
    get_workspace,
    invite_member,
    list_members,
    list_workspaces_for_user,
    remove_member,
    update_member_role,
    update_workspace,
)

router = APIRouter()


def _member_to_out(membership: WorkspaceMember) -> MemberOut:
    return MemberOut(
        user_id=membership.user_id,
        email=membership.user.email,
        full_name=membership.user.full_name,
        role=membership.role,
        joined_at=membership.created_at,
    )


@router.post("", response_model=WorkspaceOut, status_code=status.HTTP_201_CREATED)
async def create(
    data: WorkspaceCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    workspace = await create_workspace(db, current_user, data.name)
    return WorkspaceOut(
        id=workspace.id, name=workspace.name, slug=workspace.slug,
        owner_id=workspace.owner_id, created_at=workspace.created_at, my_role=WorkspaceRole.OWNER,
    )


@router.get("", response_model=list[WorkspaceOut])
async def list_mine(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = await list_workspaces_for_user(db, current_user.id)
    return [
        WorkspaceOut(id=ws.id, name=ws.name, slug=ws.slug, owner_id=ws.owner_id, created_at=ws.created_at, my_role=role)
        for ws, role in rows
    ]


@router.get("/{workspace_id}", response_model=WorkspaceOut)
async def get_one(
    workspace_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    membership: WorkspaceMember = Depends(get_current_membership),
):
    workspace = await get_workspace(db, workspace_id)
    return WorkspaceOut(
        id=workspace.id, name=workspace.name, slug=workspace.slug,
        owner_id=workspace.owner_id, created_at=workspace.created_at, my_role=membership.role,
    )


@router.patch("/{workspace_id}", response_model=WorkspaceOut)
async def update(
    workspace_id: uuid.UUID,
    data: WorkspaceUpdate,
    db: AsyncSession = Depends(get_db),
    membership: WorkspaceMember = Depends(require_role(WorkspaceRole.ADMIN)),
):
    workspace = await get_workspace(db, workspace_id)
    workspace = await update_workspace(db, workspace, data.name)
    return WorkspaceOut(
        id=workspace.id, name=workspace.name, slug=workspace.slug,
        owner_id=workspace.owner_id, created_at=workspace.created_at, my_role=membership.role,
    )


@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    workspace_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    membership: WorkspaceMember = Depends(require_role(WorkspaceRole.OWNER)),
):
    workspace = await get_workspace(db, workspace_id)
    await delete_workspace(db, workspace)


@router.get("/{workspace_id}/members", response_model=list[MemberOut])
async def list_all_members(
    workspace_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    membership: WorkspaceMember = Depends(get_current_membership),
):
    memberships = await list_members(db, workspace_id)
    return [_member_to_out(m) for m in memberships]


@router.post("/{workspace_id}/members", response_model=MemberOut, status_code=status.HTTP_201_CREATED)
async def add_member(
    workspace_id: uuid.UUID,
    data: MemberInvite,
    db: AsyncSession = Depends(get_db),
    membership: WorkspaceMember = Depends(require_role(WorkspaceRole.ADMIN)),
):
    try:
        new_membership = await invite_member(db, workspace_id, data.email, data.role)
    except UserNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No user with that email is registered yet")
    except AlreadyMemberError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User is already a member")

    return _member_to_out(new_membership)


@router.patch("/{workspace_id}/members/{user_id}", response_model=MemberOut)
async def change_role(
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    data: MemberRoleUpdate,
    db: AsyncSession = Depends(get_db),
    membership: WorkspaceMember = Depends(require_role(WorkspaceRole.ADMIN)),
):
    try:
        updated = await update_member_role(db, workspace_id, membership.role, user_id, data.role)
    except InsufficientRoleError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only an owner can change an owner's role")
    except LastOwnerError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Workspace must have at least one owner")

    await db.refresh(updated, attribute_names=["user"])
    return _member_to_out(updated)


@router.delete("/{workspace_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove(
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    membership: WorkspaceMember = Depends(require_role(WorkspaceRole.ADMIN)),
):
    try:
        await remove_member(db, workspace_id, membership.role, user_id)
    except InsufficientRoleError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only an owner can remove an owner")
    except LastOwnerError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Workspace must have at least one owner")