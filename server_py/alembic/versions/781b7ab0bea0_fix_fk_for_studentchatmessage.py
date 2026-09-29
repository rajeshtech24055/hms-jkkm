"""Fix FK for StudentChatMessage

Revision ID: 781b7ab0bea0
Revises: 526630a6def5
Create Date: 2026-09-29 10:38:07.349182

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '781b7ab0bea0'
down_revision: Union[str, Sequence[str], None] = '526630a6def5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use generic naming or explicit drop constraint syntax for postgres
    op.drop_constraint('student_chat_messages_student_id_fkey', 'student_chat_messages', type_='foreignkey')
    op.create_foreign_key('student_chat_messages_student_id_fkey', 'student_chat_messages', 'students', ['student_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint('student_chat_messages_student_id_fkey', 'student_chat_messages', type_='foreignkey')
    op.create_foreign_key('student_chat_messages_student_id_fkey', 'student_chat_messages', 'users', ['student_id'], ['id'])
