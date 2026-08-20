"""
Chunking is tested with a substitute word-based tokenizer instead of
the real tiktoken encoding -- this tests the windowing/overlap/stride
algorithm itself without requiring network access to download
tiktoken's BPE file, which some CI/sandboxed environments block.
"""

import app.embeddings.chunking as chunking_module
from app.embeddings.chunking import chunk_text


class FakeEncoding:
    def encode(self, text):
        return text.split()

    def decode(self, tokens):
        return " ".join(tokens)


def setup_function():
    chunking_module._get_encoding = lambda: FakeEncoding()


def test_short_text_single_chunk():
    chunks = chunk_text("This is a short test document.")
    assert len(chunks) == 1
    assert chunks[0].index == 0


def test_long_text_multiple_chunks_with_sequential_indices():
    long_text = " ".join(f"word{i}" for i in range(300))
    chunks = chunk_text(long_text, chunk_size=100, overlap=20)
    assert len(chunks) > 1
    assert [c.index for c in chunks] == list(range(len(chunks)))
    assert all(c.token_count <= 100 for c in chunks)


def test_overlap_actually_repeats_content():
    long_text = " ".join(f"word{i}" for i in range(300))
    chunks = chunk_text(long_text, chunk_size=100, overlap=20)
    end_of_first = chunks[0].content.split()[-5:]
    start_of_second = chunks[1].content.split()[:25]
    assert any(w in start_of_second for w in end_of_first)


def test_no_data_lost_at_end_of_text():
    long_text = " ".join(f"word{i}" for i in range(300))
    chunks = chunk_text(long_text, chunk_size=100, overlap=20)
    assert "word299" in chunks[-1].content


def test_empty_text_returns_no_chunks():
    assert chunk_text("") == []


def test_rejects_overlap_greater_or_equal_to_chunk_size():
    import pytest

    with pytest.raises(ValueError):
        chunk_text("x", chunk_size=10, overlap=10)