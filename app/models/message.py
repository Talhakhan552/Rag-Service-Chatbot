import enum
import uuid

from sqlalchemy import Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin, UUIDPkMixin


class MessageRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ChatSession(Base, UUIDPkMixin, TimestampMixin):
    __tablename__ = "chat_sessions"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)

    messages: Mapped[list["Message"]] = relationship(
        back_populates="chat_session", cascade="all, delete-orphan", order_by="Message.created_at"
    )


class Message(Base, UUIDPkMixin, TimestampMixin):
    __tablename__ = "messages"

    chat_session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[MessageRole] = mapped_column(Enum(MessageRole, name="message_role"))
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # List of {chunk_id, document_id, filename, snippet} dicts used to
    # render "sources" under an assistant reply. Stored as JSONB so we
    # don't need a separate join table just to display citations.
    sources: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    chat_session: Mapped["ChatSession"] = relationship(back_populates="messages")