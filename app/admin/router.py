import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.schemas import PlatformUserOut, PlatformWorkspaceOut, WorkspaceStatsOut
from app.admin.service import get_workspace_stats, list_all_users, list_all_workspaces
from app.auth.dependencies import require_superuser
from app.database.session import get_db
from app.models.user import User
from app.models.workspace import WorkspaceMember, WorkspaceRole
from app.workspaces.dependencies import require_role

router = APIRouter()


@router.get("/stats", response_model=WorkspaceStatsOut)
async def stats(
    workspace_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    membership: WorkspaceMember = Depends(require_role(WorkspaceRole.ADMIN)),
):
    return await get_workspace_stats(db, workspace_id)


# Platform-wide admin, mounted at /admin (not under a workspace).
platform_router = APIRouter()


@platform_router.get("/users", response_model=list[PlatformUserOut])
async def all_users(db: AsyncSession = Depends(get_db), _: User = Depends(require_superuser)):
    return await list_all_users(db)


@platform_router.get("/workspaces", response_model=list[PlatformWorkspaceOut])
async def all_workspaces(db: AsyncSession = Depends(get_db), _: User = Depends(require_superuser)):
    return await list_all_workspaces(db)
