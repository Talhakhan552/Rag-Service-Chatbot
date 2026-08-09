"""
Splits extracted document text into overlapping chunks sized in
tokens (not characters) -- token count is what actually matters for
embedding model limits and retrieval context budgets, so chunking on
character count would be an inaccurate proxy.

Overlap between consecutive chunks means a sentence that gets cut at
a chunk boundary still appears in full in at least one chunk, instead
of being split with no chunk containing the complete thought.
"""

import tiktoken

DEFAULT_CHUNK_SIZE_TOKENS = 500
DEFAULT_CHUNK_OVERLAP_TOKENS = 50

_encoding = None


def _get_encoding():
    # Loaded lazily (not at module import time) so importing this
    # module never requires network access -- tiktoken downloads and
    # caches its BPE file on first real use, not on import.
    global _encoding
    if _encoding is None:
        _encoding = tiktoken.get_encoding("cl100k_base")  # matches OpenAI embedding models
    return _encoding


class TextChunk:
    def __init__(self, content: str, index: int, token_count: int):
        self.content = content
        self.index = index
        self.token_count = token_count


def chunk_text(
    text: str,
    chunk_size: int = DEFAULT_CHUNK_SIZE_TOKENS,
    overlap: int = DEFAULT_CHUNK_OVERLAP_TOKENS,
) -> list[TextChunk]:
    if overlap >= chunk_size:
        raise ValueError("overlap must be smaller than chunk_size")

    tokens = _get_encoding().encode(text)
    if not tokens:
        return []

    chunks: list[TextChunk] = []
    start = 0
    index = 0
    stride = chunk_size - overlap
    encoding = _get_encoding()

    while start < len(tokens):
        end = min(start + chunk_size, len(tokens))
        chunk_tokens = tokens[start:end]
        content = encoding.decode(chunk_tokens).strip()

        if content:
            chunks.append(TextChunk(content=content, index=index, token_count=len(chunk_tokens)))
            index += 1

        if end == len(tokens):
            break
        start += stride

    return chunks