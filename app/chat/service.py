import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.message import ChatSession, Message, MessageRole

DEFAULT_HISTORY_LIMIT = 20


class ChatSessionNotFoundError(Exception):
    pass


def _owned_by(user_id: uuid.UUID | None, api_key_id: uuid.UUID | None):
    """
    Sessions are private to whoever created them: the user for JWT
    callers, the key for API-key callers (which have no user). Without
    this, an API key embedded in a public widget could read every chat
    in the workspace.
    """
    if user_id is not None:
        return ChatSession.user_id == user_id
    return ChatSession.api_key_id == api_key_id


async def create_session(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    user_id: uuid.UUID | None,
    api_key_id: uuid.UUID | None,
    title: str | None,
) -> ChatSession:
    session = ChatSession(workspace_id=workspace_id, user_id=user_id, api_key_id=api_key_id, title=title)
    db.add(session)
    await db.flush()
    return session


async def list_sessions(
    db: AsyncSession, workspace_id: uuid.UUID, user_id: uuid.UUID | None, api_key_id: uuid.UUID | None
) -> list[ChatSession]:
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.workspace_id == workspace_id, _owned_by(user_id, api_key_id))
        .order_by(ChatSession.created_at.desc())
    )
    return list(result.scalars().all())


async def get_session(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    session_id: uuid.UUID,
    user_id: uuid.UUID | None,
    api_key_id: uuid.UUID | None,
) -> ChatSession:
    # Someone else's session is reported as not found, so its existence isn't leaked.
    session = await db.scalar(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.workspace_id == workspace_id,
            _owned_by(user_id, api_key_id),
        )
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