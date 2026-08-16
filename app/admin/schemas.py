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