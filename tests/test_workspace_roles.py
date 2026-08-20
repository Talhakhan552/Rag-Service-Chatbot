from app.models.workspace import WorkspaceRole
from app.workspaces.service import role_at_least


def test_owner_meets_admin_bar():
    assert role_at_least(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)


def test_admin_meets_own_bar():
    assert role_at_least(WorkspaceRole.ADMIN, WorkspaceRole.ADMIN)


def test_member_does_not_meet_admin_bar():
    assert not role_at_least(WorkspaceRole.MEMBER, WorkspaceRole.ADMIN)


def test_owner_meets_every_bar():
    assert role_at_least(WorkspaceRole.OWNER, WorkspaceRole.OWNER)
    assert role_at_least(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
    assert role_at_least(WorkspaceRole.OWNER, WorkspaceRole.MEMBER)