import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.message import ChatSession, Message, MessageRole

DEFAULT_HISTORY_LIMIT = 20


class ChatSessionNotFoundError(Exception):
    pass


async def create_session(db: AsyncSession, workspace_id: uuid.UUID, user_id: uuid.UUID, title: str | None) -> ChatSession:
    session = ChatSession(workspace_id=workspace_id, user_id=user_id, title=title)
    db.add(session)
    await db.flush()
    return session


async def list_sessions(db: AsyncSession, workspace_id: uuid.UUID) -> list[ChatSession]:
    result = await db.execute(
        select(ChatSession).where(ChatSession.workspace_id == workspace_id).order_by(ChatSession.created_at.desc())
    )
    return list(result.scalars().all())


async def get_session(db: AsyncSession, workspace_id: uuid.UUID, session_id: uuid.UUID) -> ChatSession:
    session = await db.scalar(
        select(ChatSession).where(ChatSession.id == session_id, ChatSession.workspace_id == workspace_id)
    )
    if session is None:
        raise ChatSessionNotFoundError()
    return session


async def get_messages(db: AsyncSession, session_id: uuid.UUID) -> list[Message]:
    result = await db.execute(
        select(Message).where(Message.chat_session_id == session_id).order_by(Message.created_at)
    )
    return list(result.scalars().all())


async def save_message(
    db: AsyncSession, session_id: uuid.UUID, role: MessageRole, content: str, sources: list[dict] | None = None
) -> Message:
    message = Message(chat_session_id=session_id, role=role, content=content, sources=sources)
    db.add(message)
    await db.flush()
    return message


async def delete_session(db: AsyncSession, session: ChatSession) -> None:
    await db.delete(session)


async def build_conversation_history(
    db: AsyncSession, session_id: uuid.UUID, limit: int = DEFAULT_HISTORY_LIMIT
) -> list[dict]:
    """
    Last N messages formatted for the LLM, oldest first. Capped so a
    long-running conversation doesn't grow the prompt unboundedly.
    """
    result = await db.execute(
        select(Message)
        .where(Message.chat_session_id == session_id)
        .order_by(Message.created_at.desc())
        .limit(limit)
    )
    messages = list(reversed(result.scalars().all()))
    return [{"role": m.role.value, "content": m.content} for m in messages]