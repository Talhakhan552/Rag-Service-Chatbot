"""
Platform admin (users.is_superuser) sees every user and workspace;
everyone else -- including workspace owners -- gets 403.
"""

from sqlalchemy import update

from app.models.user import User


async def _register_and_login(client, email: str) -> str:
    await client.post("/api/v1/auth/register", json={"email": email, "password": "testpass123"})
    res = await client.post("/api/v1/auth/login", json={"email": email, "password": "testpass123"})
    return res.json()["access_token"]


def _bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def test_non_superuser_is_refused(client):
    token = await _register_and_login(client, "plain@example.com")
    await client.post("/api/v1/workspaces", json={"name": "Mine"}, headers=_bearer(token))

    for path in ("/api/v1/admin/users", "/api/v1/admin/workspaces"):
        assert (await client.get(path, headers=_bearer(token))).status_code == 403
    me = await client.get("/api/v1/auth/me", headers=_bearer(token))
    assert me.json()["is_superuser"] is False


async def test_superuser_sees_all_users_and_workspaces(client, db_session):
    admin_token = await _register_and_login(client, "boss@example.com")
    other_token = await _register_and_login(client, "owner@example.com")
    await db_session.execute(update(User).where(User.email == "boss@example.com").values(is_superuser=True))
    await db_session.flush()

    ws = (await client.post("/api/v1/workspaces", json={"name": "Other Co"}, headers=_bearer(other_token))).json()["id"]
    await client.post(f"/api/v1/workspaces/{ws}/chat/sessions", json={"title": "t"}, headers=_bearer(other_token))

    users = (await client.get("/api/v1/admin/users", headers=_bearer(admin_token))).json()
    by_email = {u["email"]: u for u in users}
    assert set(by_email) == {"boss@example.com", "owner@example.com"}
    assert by_email["boss@example.com"]["is_superuser"] is True
    assert by_email["owner@example.com"]["workspace_count"] == 1

    workspaces = (await client.get("/api/v1/admin/workspaces", headers=_bearer(admin_token))).json()
    assert len(workspaces) == 1
    w = workspaces[0]
    assert w["owner_email"] == "owner@example.com"
    assert (w["member_count"], w["document_count"], w["total_storage_bytes"], w["chat_session_count"], w["message_count"]) == (1, 0, 0, 1, 0)
