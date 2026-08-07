"""
Security primitives: password hashing and JWT access-token
create/decode. This file has no FastAPI or DB imports on purpose --
it's pure functions so it's trivially unit-testable and reusable from
anywhere (auth service, scripts, tests) without pulling in the web layer.

Refresh tokens are handled separately (app/auth/service.py) since
they're opaque random strings stored hashed in the DB, not JWTs --
that's what makes them revocable.
"""

import uuid
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(user_id: uuid.UUID) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": str(user_id), "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> uuid.UUID:
    """
    Returns the user id encoded in the token, or raises ValueError if
    the token is invalid, expired, or not an access token. Callers
    (the get_current_user dependency) turn that into a 401.
    """
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise ValueError("Invalid or expired token") from exc

    if payload.get("type") != "access":
        raise ValueError("Wrong token type")

    sub = payload.get("sub")
    if sub is None:
        raise ValueError("Token missing subject")

    return uuid.UUID(sub)