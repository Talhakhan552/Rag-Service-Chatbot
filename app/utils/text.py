"""
Slug generation. Kept dependency-free (no python-slugify) since the
logic is simple enough: lowercase, replace non-alphanumerics with
hyphens, collapse repeats, trim.
"""

import re
import secrets


def slugify(text: str) -> str:
    slug = text.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug or "workspace"


def unique_suffix() -> str:
    """Short random suffix appended to a slug on collision."""
    return secrets.token_hex(3)