"""add api_key_id to chat_sessions

Revision ID: a3f1c2d4e5b6
Revises: 88c391bd01a7
Create Date: 2026-10-27 15:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a3f1c2d4e5b6'
down_revision: Union[str, None] = '88c391bd01a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('chat_sessions', sa.Column('api_key_id', sa.UUID(), nullable=True))
    op.create_foreign_key(
        'fk_chat_sessions_api_key_id', 'chat_sessions', 'api_keys', ['api_key_id'], ['id'], ondelete='SET NULL'
    )
    op.create_index(op.f('ix_chat_sessions_api_key_id'), 'chat_sessions', ['api_key_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_chat_sessions_api_key_id'), table_name='chat_sessions')
    op.drop_constraint('fk_chat_sessions_api_key_id', 'chat_sessions', type_='foreignkey')
    op.drop_column('chat_sessions', 'api_key_id')
