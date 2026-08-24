"""
Unified workspace access: accepts EITHER an API key (X-API-Key header)
OR a JWT (Authorization: Bearer header), whichever is present. This
is what makes the chat API usable both by your own frontend (JWT,
tied to a real user) and by a customer's backend integration (API
key, no user account involved) -- the same endpoint serves both.

API keys resolve to MEMBER-level access scoped to exactly the
workspace they were issued for -- enough to chat and read documents,
not enough to manage the workspace or other members. JWTs resolve to
the caller's actual membership and role, same as everywhere else.
"""

import uuid
from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.apikeys.service import validate_api_key
from app.core.security import decode_access_token
from app.database.session import get_db
from app.models.user import User
from app.models.workspace import WorkspaceRole
from app.workspaces.service import NotAMemberError, get_membership


@dataclass
class WorkspaceAccess:
    workspace_id: uuid.UUID
    role: WorkspaceRole
    user_id: uuid.UUID | None  # None when authenticated via API key


def _origin_allowed(allowed_origins: str | None, origin: str | None) -> bool:
    """
    An API key with no allowed_origins is unrestricted (backward
    compatible). Otherwise the request's Origin header must match one of
    the listed origins. Comparison is case-insensitive and ignores a
    trailing slash. A restricted key with a missing Origin is rejected --
    a real browser always sends Origin on the widget's cross-origin POSTs,
    so its absence means the request isn't coming from an allowed page.
    """
    if not allowed_origins:
        return True

    def norm(value: str) -> str:
        return value.strip().rstrip("/").lower()

    allowed = {norm(o) for o in allowed_origins.split(",") if o.strip()}
    if not allowed:
        return True
    return origin is not None and norm(origin) in allowed


async def get_workspace_access(
    workspace_id: uuid.UUID,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    authorization: str | None = Header(default=None),
    origin: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceAccess:
    if x_api_key is not None:
        api_key = await validate_api_key(db, x_api_key)
        if api_key is None or api_key.workspace_id != workspace_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
        if not _origin_allowed(api_key.allowed_origins, origin):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This API key is not authorized for this domain",
            )
        await db.commit()
        return WorkspaceAccess(workspace_id=workspace_id, role=WorkspaceRole.MEMBER, user_id=None)

    if authorization is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Provide either an Authorization Bearer token or an X-API-Key header",
        )

    token = authorization.removeprefix("Bearer ").strip()
    try:
        user_id = decode_access_token(token)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    try:
        membership = await get_membership(db, workspace_id, user.id)
    except NotAMemberError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this workspace")

    return WorkspaceAccess(workspace_id=workspace_id, role=membership.role, user_id=user.id)