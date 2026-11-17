from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.db.models import Expense, ExpenseShare


def list_for_group(session: Session, group_id: int) -> list[Expense]:
    statement = (
        select(Expense)
        .where(Expense.group_id == group_id, Expense.deleted_at.is_(None))
        .options(joinedload(Expense.payer), selectinload(Expense.shares).joinedload(ExpenseShare.user))
        .order_by(Expense.created_at.desc(), Expense.id.desc())
    )
    return list(session.scalars(statement).all())
