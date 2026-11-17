import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Identity, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import CHAR, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    memberships: Mapped[list["GroupMember"]] = relationship(back_populates="user")


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    memberships: Mapped[list["GroupMember"]] = relationship(back_populates="group")
    expenses: Mapped[list["Expense"]] = relationship(back_populates="group")


class Expense(Base):
    __tablename__ = "expenses"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_expenses_amount_positive"),
        CheckConstraint("split_type IN ('equal', 'exact')", name="ck_expenses_split_type"),
        UniqueConstraint("group_id", "idempotency_key", name="uq_expenses_group_idempotency_key"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), nullable=False)
    paid_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    split_type: Mapped[str] = mapped_column(String(10), nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(255), nullable=False)
    request_hash: Mapped[str] = mapped_column(CHAR(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(nullable=True)
    group: Mapped[Group] = relationship(back_populates="expenses")
    payer: Mapped[User] = relationship()
    shares: Mapped[list["ExpenseShare"]] = relationship(
        back_populates="expense", order_by="ExpenseShare.allocation_order"
    )


class ExpenseShare(Base):
    __tablename__ = "expense_shares"
    __table_args__ = (
        CheckConstraint("amount >= 0", name="ck_expense_shares_amount_nonnegative"),
        CheckConstraint("allocation_order >= 0", name="ck_expense_shares_order_nonnegative"),
        UniqueConstraint("expense_id", "allocation_order", name="uq_expense_shares_allocation_order"),
    )

    expense_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("expenses.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    allocation_order: Mapped[int] = mapped_column(nullable=False)
    expense: Mapped[Expense] = relationship(back_populates="shares")
    user: Mapped[User] = relationship()



class GroupMember(Base):
    __tablename__ = "group_members"

    group_id: Mapped[int] = mapped_column(
        ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    group: Mapped[Group] = relationship(back_populates="memberships")
    user: Mapped[User] = relationship(back_populates="memberships")
