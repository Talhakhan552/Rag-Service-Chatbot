import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.message import MessageRole


class ChatSessionCreate(BaseModel):
    title: str | None = None


class ChatSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str | None
    created_at: datetime


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: MessageRole
    content: str
    sources: list[dict] | None
    created_at: datetime


class SendMessageRequest(BaseModel):
    content: str