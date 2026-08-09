"""
Dependencies that guard workspace-scoped routes. Every route under
/workspaces/{workspace_id}/... should depend on one of these instead
of manually checking membership -- this is where tenant isolation is
actually enforced, so it needs to be consistent everywhere.
"""

import uuid

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.models.workspace import WorkspaceMember, WorkspaceRole
from app.workspaces.service import NotAMemberError, get_membership, role_at_least


async def get_current_membership(
    workspace_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceMember:
    try:
        return await get_membership(db, workspace_id, current_user.id)
    except NotAMemberError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this workspace")


def require_role(minimum: WorkspaceRole):
    """
    Dependency factory: require_role(WorkspaceRole.ADMIN) returns a
    dependency that 403s unless the caller's role in this workspace
    is at least ADMIN. Route handlers declare the bar they need
    without duplicating the comparison logic.
    """

    async def checker(membership: WorkspaceMember = Depends(get_current_membership)) -> WorkspaceMember:
        if not role_at_least(membership.role, minimum):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires {minimum.value} role or higher",
            )
        return membership

    return checker