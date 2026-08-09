"""
Document service layer: saving uploads to disk, DB records, and the
background task that validates/parses a document after upload.

Storage layout: {UPLOAD_DIR}/{workspace_id}/{document_id}{ext} --
scoping by workspace_id on disk mirrors the DB-level tenant
isolation, so a directory listing alone never leaks cross-tenant
filenames.
"""

import asyncio
import os
import uuid
from datetime import datetime, timezone

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import get_logger
from app.database.session import AsyncSessionLocal
from app.documents.parsers import ExtractionError, extract_text
from app.models.document import Document, DocumentStatus, DocumentType

from app.embeddings.chunking import chunk_text
from app.embeddings.provider import generate_embeddings
from app.models.chunk import Chunk

logger = get_logger(__name__)

EMBEDDING_BATCH_SIZE = 100

EXTENSION_MAP = {
    ".pdf": DocumentType.PDF,
    ".docx": DocumentType.DOCX,
    ".txt": DocumentType.TXT,
    ".md": DocumentType.MD,
}


class InvalidFileTypeError(Exception):
    pass


class FileTooLargeError(Exception):
    pass


class DocumentNotFoundError(Exception):
    pass


def _resolve_file_type(filename: str) -> DocumentType:
    ext = os.path.splitext(filename)[1].lower()
    file_type = EXTENSION_MAP.get(ext)
    if file_type is None:
        raise InvalidFileTypeError(f"Unsupported file type: {ext or 'unknown'}")
    return file_type


def _write_file_sync(path: str, content: bytes) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(content)


async def save_upload(workspace_id: uuid.UUID, upload_file: UploadFile) -> tuple[str, DocumentType, int, uuid.UUID]:
    file_type = _resolve_file_type(upload_file.filename)

    content = await upload_file.read()
    size_bytes = len(content)

    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if size_bytes > max_bytes:
        raise FileTooLargeError(f"File exceeds {settings.max_upload_size_mb}MB limit")

    ext = os.path.splitext(upload_file.filename)[1].lower()
    document_id = uuid.uuid4()
    storage_path = os.path.join(settings.upload_dir, str(workspace_id), f"{document_id}{ext}")

    await asyncio.to_thread(_write_file_sync, storage_path, content)

    return storage_path, file_type, size_bytes, document_id


async def create_document(
    db: AsyncSession,
    document_id: uuid.UUID,
    workspace_id: uuid.UUID,
    uploaded_by: uuid.UUID,
    filename: str,
    storage_path: str,
    file_type: DocumentType,
    size_bytes: int,
) -> Document:
    document = Document(
        id=document_id,
        workspace_id=workspace_id,
        uploaded_by=uploaded_by,
        filename=filename,
        storage_path=storage_path,
        file_type=file_type,
        file_size_bytes=size_bytes,
        status=DocumentStatus.PENDING,
    )
    db.add(document)
    await db.flush()
    return document


async def list_documents(db: AsyncSession, workspace_id: uuid.UUID) -> list[Document]:
    result = await db.execute(
        select(Document).where(Document.workspace_id == workspace_id).order_by(Document.created_at.desc())
    )
    return list(result.scalars().all())


async def get_document(db: AsyncSession, workspace_id: uuid.UUID, document_id: uuid.UUID) -> Document:
    document = await db.scalar(
        select(Document).where(Document.id == document_id, Document.workspace_id == workspace_id)
    )
    if document is None:
        raise DocumentNotFoundError()
    return document


async def delete_document(db: AsyncSession, document: Document) -> None:
    if os.path.exists(document.storage_path):
        await asyncio.to_thread(os.remove, document.storage_path)
    await db.delete(document)


async def process_document(document_id: uuid.UUID) -> None:
    """
    Runs as a FastAPI background task, after the upload response has
    already been sent -- so it needs its own DB session. Extracts
    text, splits it into chunks, generates embeddings for each chunk,
    and stores them -- this is what makes the document retrievable
    by Step 7's RAG search.
    """
    async with AsyncSessionLocal() as db:
        document = await db.get(Document, document_id)
        if document is None:
            logger.error("process_document_missing", document_id=str(document_id))
            return

        document.status = DocumentStatus.PROCESSING
        await db.commit()

        try:
            text = await asyncio.to_thread(extract_text, document.storage_path, document.file_type)
            chunks = chunk_text(text)

            if not chunks:
                raise ExtractionError("Document produced no usable chunks")

            all_embeddings: list[list[float]] = []
            for i in range(0, len(chunks), EMBEDDING_BATCH_SIZE):
                batch = chunks[i : i + EMBEDDING_BATCH_SIZE]
                batch_embeddings = await generate_embeddings([c.content for c in batch])
                all_embeddings.extend(batch_embeddings)

            for chunk, embedding in zip(chunks, all_embeddings):
                db.add(
                    Chunk(
                        document_id=document.id,
                        workspace_id=document.workspace_id,
                        content=chunk.content,
                        chunk_index=chunk.index,
                        token_count=chunk.token_count,
                        embedding=embedding,
                    )
                )
        except ExtractionError as exc:
            document.status = DocumentStatus.FAILED
            document.error_message = str(exc)
            logger.warning("document_processing_failed", document_id=str(document_id), error=str(exc))
        except Exception as exc:
            document.status = DocumentStatus.FAILED
            document.error_message = f"Processing error: {exc}"
            logger.error("document_processing_error", document_id=str(document_id), error=str(exc))
        else:
            document.status = DocumentStatus.COMPLETED
            logger.info(
                "document_processing_completed", document_id=str(document_id), chunk_count=len(chunks)
            )

        await db.commit()