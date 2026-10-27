import uuid
from datetime import datetime

from pydantic import BaseModel


class WorkspaceStatsOut(BaseModel):
    document_count: int
    documents_by_status: dict[str, int]
    chunk_count: int
    total_storage_bytes: int
    chat_session_count: int
    message_count: int
    member_count: int
    active_api_key_count: int


class PlatformUserOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str | None
    is_active: bool
    is_superuser: bool
    created_at: datetime
    workspace_count: int


class PlatformWorkspaceOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    owner_email: str | None
    created_at: datetime
    member_count: int
    document_count: int
    total_storage_bytes: int
    chat_session_count: int
    message_count: int
