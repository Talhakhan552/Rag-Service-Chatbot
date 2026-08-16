import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.schemas import WorkspaceStatsOut
from app.admin.service import get_workspace_stats
from app.database.session import get_db
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