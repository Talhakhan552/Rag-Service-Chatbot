"""add allowed_domains to api_keys

Revision ID: b7e2d9f1c3a4
Revises: a3f1c2d4e5b6
Create Date: 2026-10-27 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'b7e2d9f1c3a4'
down_revision: Union[str, None] = 'a3f1c2d4e5b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'api_keys',
        sa.Column('allowed_domains', postgresql.ARRAY(sa.String(length=255)), server_default='{}', nullable=False),
    )


def downgrade() -> None:
    op.drop_column('api_keys', 'allowed_domains')
