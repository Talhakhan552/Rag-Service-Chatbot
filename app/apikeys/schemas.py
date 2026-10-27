import uuid
from datetime import datetime, timezone

from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ApiKeyCreate(BaseModel):
    name: str
    allowed_domains: list[str] = Field(default_factory=list, max_length=50)
    expires_at: datetime | None = None  # None = never expires

    @field_validator("expires_at")
    @classmethod
    def expiry_in_future(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:  # treat a bare date/time as UTC
            value = value.replace(tzinfo=timezone.utc)
        if value <= datetime.now(timezone.utc):
            raise ValueError("Expiry date must be in the future")
        return value

    @field_validator("allowed_domains")
    @classmethod
    def normalize_domains(cls, domains: list[str]) -> list[str]:
        """Accepts 'example.com' or 'https://example.com/page' and stores just the hostname."""
        hosts = []
        for d in domains:
            d = d.strip()
            if not d:
                continue
            host = urlparse(d if "://" in d else f"//{d}").hostname
            if not host:
                raise ValueError(f"Invalid domain: {d}")
            hosts.append(host)
        return sorted(set(hosts))


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
    allowed_domains: list[str]
    expires_at: datetime | None
    created_at: datetime


class ApiKeyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    key_prefix: str
    allowed_domains: list[str]
    expires_at: datetime | None
    is_active: bool
    last_used_at: datetime | None
    created_at: datetime