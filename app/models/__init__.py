"""
Importing every model here ensures Base.metadata knows about all
tables before Alembic's autogenerate compares it against the live DB.
Forgetting to import a new model here is the #1 cause of "alembic
revision --autogenerate produces an empty migration" bugs.
"""

from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.models.workspace import Workspace, WorkspaceMember, WorkspaceRole
from app.models.document import Document, DocumentStatus, DocumentType
from app.models.chunk import Chunk
from app.models.message import ChatSession, Message, MessageRole
from app.models.api_key import ApiKey

__all__ = [
    "User", "RefreshToken", "Workspace", "WorkspaceMember", "WorkspaceRole",
    "Document", "DocumentStatus", "DocumentType", "Chunk",
    "ChatSession", "Message", "MessageRole", "ApiKey",
]