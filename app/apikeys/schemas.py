import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ApiKeyCreate(BaseModel):
    name: str
    # Comma-separated origins the key may be used from, e.g.
    # "https://acme.com,https://www.acme.com". Empty = unrestricted.
    allowed_origins: str | None = None


class ApiKeyCreated(BaseModel):
    """
    Returned ONLY once, at creation time. The raw key is never
    retrievable again after this response -- same principle as a
    password: only its hash is stored, so even we can't show it to
    you later. If it's lost, the only recovery is revoking and
    creating a new one.
    """

    id: uuid.UUID
    name: str
    key: str
    key_prefix: str
    allowed_origins: str | None
    created_at: datetime


class ApiKeyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    key_prefix: str
    allowed_origins: str | None
    is_active: bool
    last_used_at: datetime | None
    created_at: datetime