"""add expires_at to api_keys

Revision ID: c4d8e1f2a9b3
Revises: b7e2d9f1c3a4
Create Date: 2026-10-27 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c4d8e1f2a9b3'
down_revision: Union[str, None] = 'b7e2d9f1c3a4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nullable: existing keys never expire.
    op.add_column('api_keys', sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('api_keys', 'expires_at')
