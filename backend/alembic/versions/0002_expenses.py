import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0002_expenses"
down_revision = "0001_groups"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "expenses",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("group_id", sa.BigInteger(), nullable=False),
        sa.Column("paid_by_user_id", sa.BigInteger(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("split_type", sa.String(10), nullable=False),
        sa.Column("idempotency_key", sa.String(255), nullable=False),
        sa.Column("request_hash", sa.CHAR(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("amount > 0", name="ck_expenses_amount_positive"),
        sa.CheckConstraint("split_type IN ('equal', 'exact')", name="ck_expenses_split_type"),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"]),
        sa.ForeignKeyConstraint(["paid_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("group_id", "idempotency_key", name="uq_expenses_group_idempotency_key"),
    )
    op.create_index(
        "ix_expenses_group_created_at",
        "expenses",
        ["group_id", sa.text("created_at DESC")],
    )
    op.create_table(
        "expense_shares",
        sa.Column("expense_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("allocation_order", sa.Integer(), nullable=False),
        sa.CheckConstraint("amount >= 0", name="ck_expense_shares_amount_nonnegative"),
        sa.CheckConstraint("allocation_order >= 0", name="ck_expense_shares_order_nonnegative"),
        sa.ForeignKeyConstraint(["expense_id"], ["expenses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("expense_id", "user_id"),
        sa.UniqueConstraint("expense_id", "allocation_order", name="uq_expense_shares_allocation_order"),
    )


def downgrade() -> None:
    op.drop_table("expense_shares")
    op.drop_index("ix_expenses_group_created_at", table_name="expenses")
    op.drop_table("expenses")
