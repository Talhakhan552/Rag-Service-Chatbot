import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin, UUIDPkMixin


class ApiKey(Base, UUIDPkMixin, TimestampMixin):
    """
    Customer-facing API key. We never store the raw key -- only its
    hash (same pattern as passwords) plus a short, non-secret prefix
    (e.g. "rag_live_ab12") so the UI can display "which key is this"
    without ever showing the secret again after creation.
    """

    __tablename__ = "api_keys"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    key_prefix: Mapped[str] = mapped_column(String(20), nullable=False)
    key_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)

    # Comma-separated list of origins (e.g. "https://acme.com,https://www.acme.com")
    # this key may be used from. Since a widget key is embedded in public
    # HTML, this is the primary defense: a copied key fails the Origin
    # check on any other site. Empty/NULL means unrestricted (backward
    # compatible with keys created before this column existed).
    allowed_origins: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)