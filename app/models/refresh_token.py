import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TimestampMixin, UUIDPkMixin


class RefreshToken(Base, UUIDPkMixin, TimestampMixin):
    """
    We never store the raw refresh token -- only a hash of it (same
    reasoning as passwords and API keys: if the DB leaks, no usable
    secrets leak with it). revoked_at being non-null means the token
    is dead even if not yet expired -- this is what makes logout and
    "kill this session" possible, unlike a stateless JWT refresh token.
    """

    __tablename__ = "refresh_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)