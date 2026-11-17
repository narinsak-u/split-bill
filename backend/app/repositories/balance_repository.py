from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import Expense, ExpenseShare, GroupMember, User


def get_group_balances(session: Session, group_id: int) -> list[dict[str, Decimal | str]]:
    members = session.execute(
        select(User.id, User.username)
        .join(GroupMember, GroupMember.user_id == User.id)
        .where(GroupMember.group_id == group_id)
        .order_by(User.username)
    ).all()
    paid = dict(
        session.execute(
            select(Expense.paid_by_user_id, func.coalesce(func.sum(Expense.amount), 0))
            .where(Expense.group_id == group_id, Expense.deleted_at.is_(None))
            .group_by(Expense.paid_by_user_id)
        ).all()
    )
    shares = dict(
        session.execute(
            select(ExpenseShare.user_id, func.coalesce(func.sum(ExpenseShare.amount), 0))
            .join(Expense, Expense.id == ExpenseShare.expense_id)
            .where(Expense.group_id == group_id, Expense.deleted_at.is_(None))
            .group_by(ExpenseShare.user_id)
        ).all()
    )
    return [
        {
            "username": username,
            "paid": paid.get(user_id, Decimal("0.00")),
            "share": shares.get(user_id, Decimal("0.00")),
        }
        for user_id, username in members
    ]
