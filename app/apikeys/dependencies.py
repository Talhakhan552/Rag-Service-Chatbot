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
from urllib.parse import urlparse

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
    api_key_id: uuid.UUID | None = None  # set only when authenticated via API key


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
        # Domain lock: stops other websites embedding this key. A missing
        # Origin is rejected too, though non-browser callers can fake it --
        # the per-key rate limit is what bounds that case.
        if api_key.allowed_domains and urlparse(origin or "").hostname not in api_key.allowed_domains:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="API key not allowed from this domain")
        await db.commit()
        return WorkspaceAccess(workspace_id=workspace_id, role=WorkspaceRole.MEMBER, user_id=None, api_key_id=api_key.id)

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