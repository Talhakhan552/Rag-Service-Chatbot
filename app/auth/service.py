"""
Auth service layer. Routes stay thin (parse request -> call service ->
serialize response); all the actual logic and DB queries live here so
it's testable without spinning up FastAPI, and reusable (e.g. an
admin script that creates a user doesn't need to go through HTTP).
"""

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.models.refresh_token import RefreshToken
from app.models.user import User


class EmailAlreadyRegisteredError(Exception):
    pass


class InvalidCredentialsError(Exception):
    pass


class InvalidRefreshTokenError(Exception):
    pass


def _hash_refresh_token(raw_token: str) -> str:
    # Refresh tokens are high-entropy random strings (not user-chosen
    # like passwords), so a fast hash (sha256) is fine here -- bcrypt's
    # slowness defends against brute-forcing low-entropy secrets, which
    # doesn't apply to a 32-byte random token.
    return hashlib.sha256(raw_token.encode()).hexdigest()


async def register_user(db: AsyncSession, email: str, password: str, full_name: str | None) -> User:
    existing = await db.scalar(select(User).where(User.email == email))
    if existing is not None:
        raise EmailAlreadyRegisteredError(email)

    user = User(email=email, hashed_password=hash_password(password), full_name=full_name)
    db.add(user)
    await db.flush()
    return user


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User:
    user = await db.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(password, user.hashed_password):
        raise InvalidCredentialsError()
    if not user.is_active:
        raise InvalidCredentialsError()
    return user


async def issue_token_pair(db: AsyncSession, user: User) -> tuple[str, str]:
    """Returns (access_token, raw_refresh_token)."""
    access_token = create_access_token(user.id)

    raw_refresh_token = secrets.token_urlsafe(48)
    refresh_token = RefreshToken(
        user_id=user.id,
        token_hash=_hash_refresh_token(raw_refresh_token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days),
    )
    db.add(refresh_token)
    await db.flush()

    return access_token, raw_refresh_token


async def rotate_refresh_token(db: AsyncSession, raw_refresh_token: str) -> tuple[str, str]:
    """
    Validates the given refresh token, revokes it, and issues a new
    access/refresh pair. Rotating on every use means a stolen-but-unused
    token becomes invalid the moment the legitimate user refreshes again.
    """
    token_hash = _hash_refresh_token(raw_refresh_token)
    stored = await db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))

    now = datetime.now(timezone.utc)
    if stored is None or stored.revoked_at is not None or stored.expires_at < now:
        raise InvalidRefreshTokenError()

    stored.revoked_at = now

    user = await db.get(User, stored.user_id)
    if user is None or not user.is_active:
        raise InvalidRefreshTokenError()

    return await issue_token_pair(db, user)


async def revoke_refresh_token(db: AsyncSession, raw_refresh_token: str) -> None:
    token_hash = _hash_refresh_token(raw_refresh_token)
    stored = await db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    if stored is not None and stored.revoked_at is None:
        stored.revoked_at = datetime.now(timezone.utc)