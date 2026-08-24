"""add allowed_origins to api_keys

Revision ID: b7c1a2d3e4f5
Revises: 88c391bd01a7
Create Date: 2026-08-24 10:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b7c1a2d3e4f5'
down_revision: Union[str, None] = '88c391bd01a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nullable, no server default: existing keys stay unrestricted so the
    # currently-deployed widget keeps working after the migration.
    op.add_column('api_keys', sa.Column('allowed_origins', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('api_keys', 'allowed_origins')
