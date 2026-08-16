"""
API key service. Same hashing principle as refresh tokens (Step 3):
keys are high-entropy random strings, not user-chosen, so a fast hash
(sha256) is appropriate -- bcrypt's deliberate slowness defends
against brute-forcing low-entropy secrets, which doesn't apply here.
"""

import hashlib
import secrets
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.api_key import ApiKey

KEY_PREFIX = "sk_live_"


class ApiKeyNotFoundError(Exception):
    pass


def _hash_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


def _generate_raw_key() -> tuple[str, str]:
    """Returns (raw_key, display_prefix). display_prefix is safe to store and show in lists."""
    secret_part = secrets.token_urlsafe(32)
    raw_key = f"{KEY_PREFIX}{secret_part}"
    display_prefix = raw_key[: len(KEY_PREFIX) + 6]
    return raw_key, display_prefix


async def create_api_key(
    db: AsyncSession, workspace_id: uuid.UUID, created_by: uuid.UUID, name: str
) -> tuple[ApiKey, str]:
    raw_key, display_prefix = _generate_raw_key()

    api_key = ApiKey(
        workspace_id=workspace_id,
        created_by=created_by,
        name=name,
        key_prefix=display_prefix,
        key_hash=_hash_key(raw_key),
    )
    db.add(api_key)
    await db.flush()

    return api_key, raw_key


async def list_api_keys(db: AsyncSession, workspace_id: uuid.UUID) -> list[ApiKey]:
    result = await db.execute(
        select(ApiKey).where(ApiKey.workspace_id == workspace_id).order_by(ApiKey.created_at.desc())
    )
    return list(result.scalars().all())


async def revoke_api_key(db: AsyncSession, workspace_id: uuid.UUID, key_id: uuid.UUID) -> None:
    api_key = await db.scalar(
        select(ApiKey).where(ApiKey.id == key_id, ApiKey.workspace_id == workspace_id)
    )
    if api_key is None:
        raise ApiKeyNotFoundError()

    api_key.is_active = False


async def validate_api_key(db: AsyncSession, raw_key: str) -> ApiKey | None:
    """
    Looks up an API key by its hash and marks it as just-used. Returns
    None (not an exception) for any invalid/inactive key -- the caller
    turns that into a generic 401, since distinguishing "wrong key" from
    "revoked key" in the error response would help an attacker enumerate.
    """
    key_hash = _hash_key(raw_key)
    api_key = await db.scalar(select(ApiKey).where(ApiKey.key_hash == key_hash))

    if api_key is None or not api_key.is_active:
        return None

    api_key.last_used_at = datetime.now(timezone.utc)
    return api_key