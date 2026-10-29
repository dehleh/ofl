"""add document and exception columns

Revision ID: b2c3d4e5f6a7
Revises: 99402d846810
Create Date: 2026-10-27 21:28:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = '99402d846810'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # Safe SQLite column additions if not already present
    conn = op.get_bind()
    insp = sa.inspect(conn)
    
    doc_cols = {c['name'] for c in insp.get_columns('documents')}
    if 'analysis_results' not in doc_cols:
        op.add_column('documents', sa.Column('analysis_results', sa.JSON(), nullable=True))

    ex_cols = {c['name'] for c in insp.get_columns('exceptions')}
    if 'originator_role' not in ex_cols:
        op.add_column('exceptions', sa.Column('originator_role', sa.String(50), server_default='ANALYST'))
    if 'originator_name' not in ex_cols:
        op.add_column('exceptions', sa.Column('originator_name', sa.String(100), nullable=True))
    if 'comments' not in ex_cols:
        op.add_column('exceptions', sa.Column('comments', sa.Text(), nullable=True))
    if 'version' not in ex_cols:
        op.add_column('exceptions', sa.Column('version', sa.Integer(), server_default='1'))
    if 'sla_due_at' not in ex_cols:
        op.add_column('exceptions', sa.Column('sla_due_at', sa.DateTime(), nullable=True))
    if 'action_payload' not in ex_cols:
        op.add_column('exceptions', sa.Column('action_payload', sa.JSON(), nullable=True))
    if 'applicant_action_required' not in ex_cols:
        op.add_column('exceptions', sa.Column('applicant_action_required', sa.Boolean(), server_default='0'))
    if 'applicant_response' not in ex_cols:
        op.add_column('exceptions', sa.Column('applicant_response', sa.JSON(), nullable=True))
    if 'is_material_change' not in ex_cols:
        op.add_column('exceptions', sa.Column('is_material_change', sa.Boolean(), server_default='0'))
    if 'resolution_category' not in ex_cols:
        op.add_column('exceptions', sa.Column('resolution_category', sa.String(50), nullable=True))
    if 'resolution_notes' not in ex_cols:
        op.add_column('exceptions', sa.Column('resolution_notes', sa.Text(), nullable=True))
    if 'resolved_by' not in ex_cols:
        op.add_column('exceptions', sa.Column('resolved_by', sa.String(100), nullable=True))

def downgrade() -> None:
    pass
