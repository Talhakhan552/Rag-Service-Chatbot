"""
Embedding generation. Kept as its own thin module (separate from the
chat LLM provider abstraction that comes in Step 7) because embedding
models and chat models are independent choices -- e.g. Anthropic
doesn't offer an embeddings API at all, so "default_llm_provider"
governs chat only. Embeddings are OpenAI-only for now; swapping this
later requires an Alembic migration too, since chunks.embedding is a
fixed-dimension vector(1536) column matching text-embedding-3-small.
"""

from openai import AsyncOpenAI

from app.core.config import settings

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is not configured")
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


async def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """
    Batches all texts into as few API calls as practical. OpenAI's
    embeddings endpoint accepts a list of inputs per request, so this
    is one call for a typical document's chunk count rather than one
    call per chunk.
    """
    if not texts:
        return []

    client = _get_client()
    response = await client.embeddings.create(model=settings.openai_embedding_model, input=texts)

    return [item.embedding for item in response.data]