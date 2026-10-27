"""
Chat sessions are private to their creator: a workspace member must
not see another member's chats, and an API key (which may be embedded
in a public widget) must only reach sessions it created itself.
"""


async def _register_and_login(client, email: str) -> str:
    await client.post("/api/v1/auth/register", json={"email": email, "password": "testpass123"})
    res = await client.post("/api/v1/auth/login", json={"email": email, "password": "testpass123"})
    return res.json()["access_token"]


def _bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _setup(client):
    owner = await _register_and_login(client, "chatowner@example.com")
    member = await _register_and_login(client, "chatmember@example.com")
    ws = (await client.post("/api/v1/workspaces", json={"name": "Chat Co"}, headers=_bearer(owner))).json()["id"]
    await client.post(
        f"/api/v1/workspaces/{ws}/members",
        json={"email": "chatmember@example.com", "role": "member"},
        headers=_bearer(owner),
    )
    key1 = (await client.post(f"/api/v1/workspaces/{ws}/api-keys", json={"name": "k1"}, headers=_bearer(owner))).json()["key"]
    key2 = (await client.post(f"/api/v1/workspaces/{ws}/api-keys", json={"name": "k2"}, headers=_bearer(owner))).json()["key"]
    return ws, owner, member, key1, key2


async def _create_session(client, ws, headers) -> str:
    res = await client.post(f"/api/v1/workspaces/{ws}/chat/sessions", json={"title": "t"}, headers=headers)
    assert res.status_code == 201
    return res.json()["id"]


async def test_members_only_see_their_own_sessions(client):
    ws, owner, member, _, _ = await _setup(client)
    owner_sid = await _create_session(client, ws, _bearer(owner))

    listed = await client.get(f"/api/v1/workspaces/{ws}/chat/sessions", headers=_bearer(member))
    assert listed.json() == []

    read = await client.get(f"/api/v1/workspaces/{ws}/chat/sessions/{owner_sid}/messages", headers=_bearer(member))
    assert read.status_code == 404

    own = await client.get(f"/api/v1/workspaces/{ws}/chat/sessions", headers=_bearer(owner))
    assert [s["id"] for s in own.json()] == [owner_sid]


async def test_api_key_cannot_see_user_or_other_key_sessions(client):
    ws, owner, _, key1, key2 = await _setup(client)
    owner_sid = await _create_session(client, ws, _bearer(owner))
    key1_sid = await _create_session(client, ws, {"X-API-Key": key1})

    listed = await client.get(f"/api/v1/workspaces/{ws}/chat/sessions", headers={"X-API-Key": key1})
    assert [s["id"] for s in listed.json()] == [key1_sid]

    for sid, headers in [(owner_sid, {"X-API-Key": key1}), (key1_sid, {"X-API-Key": key2}), (key1_sid, _bearer(owner))]:
        res = await client.get(f"/api/v1/workspaces/{ws}/chat/sessions/{sid}/messages", headers=headers)
        assert res.status_code == 404

    deleted = await client.delete(f"/api/v1/workspaces/{ws}/chat/sessions/{key1_sid}", headers={"X-API-Key": key2})
    assert deleted.status_code == 404
