"""
Top-level v1 API router.

Each feature module (auth, workspaces, documents, chat, ...) owns its
own APIRouter and gets included here. Nothing lives directly in this
file except wiring -- keeps main.py and this file stable as the app
grows, so most changes happen inside a single feature module.
"""

from fastapi import APIRouter

api_router = APIRouter()


@api_router.get("/health", tags=["health"])
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


from app.auth.router import router as auth_router  # noqa: E402
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
from app.workspaces.router import router as workspaces_router  # noqa: E402
api_router.include_router(workspaces_router, prefix="/workspaces", tags=["workspaces"])
from app.documents.router import router as documents_router  # noqa: E402
api_router.include_router(
    documents_router, prefix="/workspaces/{workspace_id}/documents", tags=["documents"]
)


from app.chat.router import router as chat_router  # noqa: E402
api_router.include_router(chat_router, prefix="/workspaces/{workspace_id}/chat", tags=["chat"])


from app.apikeys.router import router as apikeys_router  # noqa: E402
api_router.include_router(apikeys_router, prefix="/workspaces/{workspace_id}/api-keys", tags=["api-keys"])


from app.admin.router import router as admin_router  # noqa: E402
api_router.include_router(admin_router, prefix="/workspaces/{workspace_id}/admin", tags=["admin"])


# Future includes, added as each module is built:
#
# from app.chat.router import router as chat_router
# api_router.include_router(chat_router, prefix="/chat", tags=["chat"])