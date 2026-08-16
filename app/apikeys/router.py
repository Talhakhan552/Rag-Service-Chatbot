import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.apikeys.schemas import ApiKeyCreate, ApiKeyCreated, ApiKeyOut
from app.apikeys.service import ApiKeyNotFoundError, create_api_key, list_api_keys, revoke_api_key
from app.database.session import get_db
from app.models.workspace import WorkspaceMember, WorkspaceRole
from app.workspaces.dependencies import require_role

router = APIRouter()


@router.post("", response_model=ApiKeyCreated, status_code=status.HTTP_201_CREATED)
async def create(
    workspace_id: uuid.UUID,
    data: ApiKeyCreate,
    db: AsyncSession = Depends(get_db),
    membership: WorkspaceMember = Depends(require_role(WorkspaceRole.ADMIN)),
):
    api_key, raw_key = await create_api_key(db, workspace_id, membership.user_id, data.name)
    return ApiKeyCreated(
        id=api_key.id, name=api_key.name, key=raw_key, key_prefix=api_key.key_prefix, created_at=api_key.created_at
    )


@router.get("", response_model=list[ApiKeyOut])
async def list_all(
    workspace_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    membership: WorkspaceMember = Depends(require_role(WorkspaceRole.ADMIN)),
):
    return await list_api_keys(db, workspace_id)


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke(
    workspace_id: uuid.UUID,
    key_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    membership: WorkspaceMember = Depends(require_role(WorkspaceRole.ADMIN)),
):
    try:
        await revoke_api_key(db, workspace_id, key_id)
    except ApiKeyNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")