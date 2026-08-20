from app.utils.text import slugify


def test_basic_slugify():
    assert slugify("Acme Corp!!") == "acme-corp"


def test_collapses_multiple_spaces():
    assert slugify("  multiple   spaces  ") == "multiple-spaces"


def test_empty_string_gets_fallback():
    assert slugify("") == "workspace"


def test_already_valid_slug_unchanged():
    assert slugify("already-a-slug") == "already-a-slug"