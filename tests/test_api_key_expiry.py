"""
API key expiry: a key stops working once expires_at passes, with the
same generic 401 as a revoked key; past expiry dates are refused.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import update

from app.models.api_key import ApiKey


async def _setup(client, expires_at):
    await client.post("/api/v1/auth/register", json={"email": "exp@example.com", "password": "testpass123"})
    token = (await client.post("/api/v1/auth/login", json={"email": "exp@example.com", "password": "testpass123"})).json()["access_token"]
    auth = {"Authorization": f"Bearer {token}"}
    ws = (await client.post("/api/v1/workspaces", json={"name": "Exp Co"}, headers=auth)).json()["id"]
    res = await client.post(f"/api/v1/workspaces/{ws}/api-keys", json={"name": "k", "expires_at": expires_at}, headers=auth)
    return ws, res, auth


async def test_key_works_until_it_expires(client, db_session):
    future = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    ws, res, auth = await _setup(client, future)
    assert res.status_code == 201
    body = res.json()
    assert body["expires_at"] is not None
    sessions_url = f"/api/v1/workspaces/{ws}/chat/sessions"
    assert (await client.get(sessions_url, headers={"X-API-Key": body["key"]})).status_code == 200

    await db_session.execute(
        update(ApiKey).where(ApiKey.id == body["id"]).values(expires_at=datetime.now(timezone.utc) - timedelta(minutes=1))
    )
    await db_session.flush()
    assert (await client.get(sessions_url, headers={"X-API-Key": body["key"]})).status_code == 401

    listed = (await client.get(f"/api/v1/workspaces/{ws}/api-keys", headers=auth)).json()
    assert listed[0]["expires_at"] is not None


async def test_past_expiry_is_rejected(client):
    past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    _, res, _ = await _setup(client, past)
    assert res.status_code == 422


async def test_no_expiry_means_never(client):
    _, res, _ = await _setup(client, None)
    assert res.status_code == 201
    assert res.json()["expires_at"] is None
