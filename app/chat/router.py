import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.apikeys.dependencies import WorkspaceAccess, get_workspace_access
from app.chat.schemas import ChatSessionCreate, ChatSessionOut, MessageOut, SendMessageRequest
from app.chat.service import (
    ChatSessionNotFoundError,
    build_conversation_history,
    create_session,
    delete_session,
    get_messages,
    get_session,
    list_sessions,
    save_message,
)
from app.core.logging import get_logger
from app.database.session import AsyncSessionLocal, get_db
from app.models.message import MessageRole
from app.models.workspace import WorkspaceRole
from app.rag.prompt import build_chat_messages, sources_payload
from app.rag.retrieval import retrieve_context
from app.services.llm_provider import stream_chat_completion
from app.workspaces.service import role_at_least

logger = get_logger(__name__)

router = APIRouter()


@router.post("/sessions", response_model=ChatSessionOut, status_code=status.HTTP_201_CREATED)
async def create(
    workspace_id: uuid.UUID,
    data: ChatSessionCreate,
    db: AsyncSession = Depends(get_db),
    access: WorkspaceAccess = Depends(get_workspace_access),
):
    return await create_session(db, workspace_id, access.user_id, data.title)


@router.get("/sessions", response_model=list[ChatSessionOut])
async def list_all(
    workspace_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    access: WorkspaceAccess = Depends(get_workspace_access),
):
    return await list_sessions(db, workspace_id)


@router.get("/sessions/{session_id}/messages", response_model=list[MessageOut])
async def get_history(
    workspace_id: uuid.UUID,
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    access: WorkspaceAccess = Depends(get_workspace_access),
):
    try:
        session = await get_session(db, workspace_id, session_id)
    except ChatSessionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")

    return await get_messages(db, session.id)


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    workspace_id: uuid.UUID,
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    access: WorkspaceAccess = Depends(get_workspace_access),
):
    try:
        session = await get_session(db, workspace_id, session_id)
    except ChatSessionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")

    if session.user_id != access.user_id and not role_at_least(access.role, WorkspaceRole.ADMIN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not permitted to delete this session")

    await delete_session(db, session)


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event)}\n\n"


@router.post("/sessions/{session_id}/messages")
async def send_message(
    workspace_id: uuid.UUID,
    session_id: uuid.UUID,
    data: SendMessageRequest,
    db: AsyncSession = Depends(get_db),
    access: WorkspaceAccess = Depends(get_workspace_access),
):
    try:
        session = await get_session(db, workspace_id, session_id)
    except ChatSessionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")

    history = await build_conversation_history(db, session.id)

    await save_message(db, session.id, MessageRole.USER, data.content)
    await db.commit()

    retrieved_chunks = await retrieve_context(db, workspace_id, data.content)
    llm_messages = build_chat_messages(retrieved_chunks, history, data.content)
    sources = sources_payload(retrieved_chunks)

    async def event_stream():
        full_response = ""
        try:
            yield _sse({"type": "sources", "sources": sources})
            async for delta in stream_chat_completion(llm_messages):
                full_response += delta
                yield _sse({"type": "content", "delta": delta})
            yield _sse({"type": "done"})
        except Exception as exc:
            logger.error("chat_stream_error", session_id=str(session_id), error=str(exc))
            yield _sse({"type": "error", "message": "An error occurred while generating the response"})
        finally:
            if full_response:
                async with AsyncSessionLocal() as save_db:
                    await save_message(save_db, session.id, MessageRole.ASSISTANT, full_response, sources)
                    await save_db.commit()

    return StreamingResponse(event_stream(), media_type="text/event-stream")