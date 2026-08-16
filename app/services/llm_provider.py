"""
Chat LLM abstraction. Only OpenAI is implemented for now, matching
your default_llm_provider setting -- Anthropic and Gemini adapters
would plug into this same stream_chat_completion interface later
without touching chat/service.py or the RAG layer, which only know
about "a list of messages in, a stream of text deltas out".
"""

from collections.abc import AsyncGenerator

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


async def stream_chat_completion(messages: list[dict]) -> AsyncGenerator[str, None]:
    client = _get_client()
    stream = await client.chat.completions.create(
        model=settings.openai_chat_model,
        messages=messages,
        stream=True,
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta