"""
Aggregate usage stats for a workspace's admin dashboard. These are
COUNT/SUM queries run on demand, not cached -- admin dashboards are
low-traffic (a human occasionally checking a screen, not a hot API
path), so the simplicity of "always fresh, no cache invalidation to
get wrong" outweighs the cost of a few extra queries per view.
"""

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.schemas import WorkspaceStatsOut
from app.models.api_key import ApiKey
from app.models.chunk import Chunk
from app.models.document import Document
from app.models.message import ChatSession, Message
from app.models.workspace import WorkspaceMember


async def get_workspace_stats(db: AsyncSession, workspace_id: uuid.UUID) -> WorkspaceStatsOut:
    document_count = await db.scalar(
        select(func.count()).select_from(Document).where(Document.workspace_id == workspace_id)
    )

    status_rows = await db.execute(
        select(Document.status, func.count())
        .where(Document.workspace_id == workspace_id)
        .group_by(Document.status)
    )
    documents_by_status = {status.value: count for status, count in status_rows.all()}

    chunk_count = await db.scalar(
        select(func.count()).select_from(Chunk).where(Chunk.workspace_id == workspace_id)
    )

    total_storage_bytes = await db.scalar(
        select(func.coalesce(func.sum(Document.file_size_bytes), 0)).where(Document.workspace_id == workspace_id)
    )

    chat_session_count = await db.scalar(
        select(func.count()).select_from(ChatSession).where(ChatSession.workspace_id == workspace_id)
    )

    message_count = await db.scalar(
        select(func.count())
        .select_from(Message)
        .join(ChatSession, ChatSession.id == Message.chat_session_id)
        .where(ChatSession.workspace_id == workspace_id)
    )

    member_count = await db.scalar(
        select(func.count()).select_from(WorkspaceMember).where(WorkspaceMember.workspace_id == workspace_id)
    )

    active_api_key_count = await db.scalar(
        select(func.count())
        .select_from(ApiKey)
        .where(ApiKey.workspace_id == workspace_id, ApiKey.is_active.is_(True))
    )

    return WorkspaceStatsOut(
        document_count=document_count or 0,
        documents_by_status=documents_by_status,
        chunk_count=chunk_count or 0,
        total_storage_bytes=total_storage_bytes or 0,
        chat_session_count=chat_session_count or 0,
        message_count=message_count or 0,
        member_count=member_count or 0,
        active_api_key_count=active_api_key_count or 0,
    )