import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.documents.schemas import DocumentOut
from app.documents.service import (
    DocumentNotFoundError,
    FileTooLargeError,
    InvalidFileTypeError,
    create_document,
    delete_document,
    get_document,
    list_documents,
    process_document,
    save_upload,
)
from app.models.workspace import WorkspaceMember, WorkspaceRole
from app.workspaces.dependencies import get_current_membership, require_role

router = APIRouter()


@router.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload(
    workspace_id: uuid.UUID,
    file: UploadFile,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    membership: WorkspaceMember = Depends(get_current_membership),
):
    try:
        storage_path, file_type, size_bytes, document_id = await save_upload(workspace_id, file)
    except InvalidFileTypeError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported file type. Allowed: PDF, DOCX, TXT, MD")
    except FileTooLargeError as exc:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(exc))

    document = await create_document(
        db, document_id, workspace_id, membership.user_id, file.filename, storage_path, file_type, size_bytes
    )

    background_tasks.add_task(process_document, document.id)

    return document


@router.get("", response_model=list[DocumentOut])
async def list_all(
    workspace_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    membership: WorkspaceMember = Depends(get_current_membership),
):
    return await list_documents(db, workspace_id)


@router.get("/{document_id}", response_model=DocumentOut)
async def get_one(
    workspace_id: uuid.UUID,
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    membership: WorkspaceMember = Depends(get_current_membership),
):
    try:
        return await get_document(db, workspace_id, document_id)
    except DocumentNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    workspace_id: uuid.UUID,
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    membership: WorkspaceMember = Depends(require_role(WorkspaceRole.ADMIN)),
):
    try:
        document = await get_document(db, workspace_id, document_id)
    except DocumentNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    await delete_document(db, document)