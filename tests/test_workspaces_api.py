"""
These specifically test tenant isolation -- the property the whole
multi-tenant design depends on: a user who isn't a member of a
workspace must never be able to read or act on it, even by guessing
a valid workspace_id.
"""


async def _register_and_login(client, email: str) -> str:
    await client.post("/api/v1/auth/register", json={"email": email, "password": "testpass123"})
    res = await client.post("/api/v1/auth/login", json={"email": email, "password": "testpass123"})
    return res.json()["access_token"]


async def test_create_workspace_makes_creator_the_owner(client):
    token = await _register_and_login(client, "owner1@example.com")
    res = await client.post(
        "/api/v1/workspaces", json={"name": "Acme Corp"}, headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 201
    body = res.json()
    assert body["name"] == "Acme Corp"
    assert body["my_role"] == "owner"
    assert body["slug"] == "acme-corp"


async def test_list_workspaces_only_shows_own(client):
    token_a = await _register_and_login(client, "usera@example.com")
    token_b = await _register_and_login(client, "userb@example.com")

    await client.post("/api/v1/workspaces", json={"name": "A's Workspace"}, headers={"Authorization": f"Bearer {token_a}"})

    res_b = await client.get("/api/v1/workspaces", headers={"Authorization": f"Bearer {token_b}"})
    assert res_b.status_code == 200
    assert res_b.json() == []


async def test_non_member_cannot_read_workspace(client):
    token_a = await _register_and_login(client, "ownerx@example.com")
    token_b = await _register_and_login(client, "outsider@example.com")

    create_res = await client.post(
        "/api/v1/workspaces", json={"name": "Private Co"}, headers={"Authorization": f"Bearer {token_a}"}
    )
    workspace_id = create_res.json()["id"]

    res = await client.get(f"/api/v1/workspaces/{workspace_id}", headers={"Authorization": f"Bearer {token_b}"})
    assert res.status_code == 403


async def test_member_cannot_delete_workspace_only_owner_can(client):
    owner_token = await _register_and_login(client, "owner2@example.com")
    member_token = await _register_and_login(client, "member2@example.com")

    create_res = await client.post(
        "/api/v1/workspaces", json={"name": "Team Co"}, headers={"Authorization": f"Bearer {owner_token}"}
    )
    workspace_id = create_res.json()["id"]

    await client.post(
        f"/api/v1/workspaces/{workspace_id}/members",
        json={"email": "member2@example.com", "role": "member"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    delete_res = await client.delete(
        f"/api/v1/workspaces/{workspace_id}", headers={"Authorization": f"Bearer {member_token}"}
    )
    assert delete_res.status_code == 403

    delete_res2 = await client.delete(
        f"/api/v1/workspaces/{workspace_id}", headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert delete_res2.status_code == 204


async def test_unauthenticated_request_rejected(client):
    res = await client.get("/api/v1/workspaces")
    assert res.status_code in (401, 403)