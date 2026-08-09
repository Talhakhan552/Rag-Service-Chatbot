"""
Retrieval: embed the user's query, then find the most similar chunks
within a single workspace. The workspace_id filter is applied inside
the SQL query itself (not after fetching) -- this is the actual
enforcement point for tenant isolation in RAG search: a bug here
would mean one customer's questions could surface another customer's
private documents, so it lives in one obvious place rather than being
re-implemented per caller.
"""

import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.embeddings.provider import generate_embeddings
from app.models.chunk import Chunk
from app.models.document import Document

DEFAULT_TOP_K = 5


@dataclass
class RetrievedChunk:
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    filename: str
    content: str
    chunk_index: int
    distance: float  # cosine distance -- lower is more similar


async def embed_query(query: str) -> list[float]:
    embeddings = await generate_embeddings([query])
    return embeddings[0]


async def search_chunks(
    db: AsyncSession, workspace_id: uuid.UUID, query_embedding: list[float], top_k: int = DEFAULT_TOP_K
) -> list[RetrievedChunk]:
    distance = Chunk.embedding.cosine_distance(query_embedding)

    result = await db.execute(
        select(Chunk, Document.filename, distance.label("distance"))
        .join(Document, Document.id == Chunk.document_id)
        .where(Chunk.workspace_id == workspace_id)
        .order_by(distance)
        .limit(top_k)
    )

    return [
        RetrievedChunk(
            chunk_id=chunk.id,
            document_id=chunk.document_id,
            filename=filename,
            content=chunk.content,
            chunk_index=chunk.chunk_index,
            distance=float(dist),
        )
        for chunk, filename, dist in result.all()
    ]


async def retrieve_context(db: AsyncSession, workspace_id: uuid.UUID, query: str, top_k: int = DEFAULT_TOP_K) -> list[RetrievedChunk]:
    query_embedding = await embed_query(query)
    return await search_chunks(db, workspace_id, query_embedding, top_k)