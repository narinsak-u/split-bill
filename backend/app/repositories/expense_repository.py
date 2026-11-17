from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.db.models import Expense, ExpenseShare, GroupMember, User


def list_for_group(session: Session, group_id: int) -> list[Expense]:
    statement = (
        select(Expense)
        .where(Expense.group_id == group_id, Expense.deleted_at.is_(None))
        .options(
            joinedload(Expense.payer), selectinload(Expense.shares).joinedload(ExpenseShare.user)
        )
        .order_by(Expense.created_at.desc(), Expense.id.desc())
    )
    return list(session.scalars(statement).all())


def find_member_user_ids(session: Session, group_id: int) -> dict[str, int]:
    rows = session.execute(
        select(User.username, User.id)
        .join(GroupMember, GroupMember.user_id == User.id)
        .where(GroupMember.group_id == group_id)
    )
    return {username: user_id for username, user_id in rows}


def insert_if_absent(
    session: Session,
    *,
    group_id: int,
    paid_by_user_id: int,
    description: str,
    amount: Decimal,
    idempotency_key: str,
    split_type: str,
    request_hash: str,
) -> str | None:
    from sqlalchemy.dialects.postgresql import insert

    statement = (
        insert(Expense)
        .values(
            group_id=group_id,
            paid_by_user_id=paid_by_user_id,
            description=description,
            amount=amount,
            split_type=split_type,
            idempotency_key=idempotency_key,
            request_hash=request_hash,
        )
        .on_conflict_do_nothing(constraint="uq_expenses_group_idempotency_key")
        .returning(Expense.id)
    )
    expense_id = session.scalar(statement)
    return str(expense_id) if expense_id is not None else None


def insert_shares(session: Session, expense_id: str, shares: list[tuple[int, Decimal]]) -> None:
    session.add_all(
        [
            ExpenseShare(
                expense_id=expense_id,
                user_id=user_id,
                amount=amount,
                allocation_order=order,
            )
            for order, (user_id, amount) in enumerate(shares)
        ]
    )
    session.flush()


def find_by_idempotency_key(
    session: Session, group_id: int, idempotency_key: str
) -> Expense | None:
    statement = (
        select(Expense)
        .where(Expense.group_id == group_id, Expense.idempotency_key == idempotency_key)
        .options(
            joinedload(Expense.payer), selectinload(Expense.shares).joinedload(ExpenseShare.user)
        )
    )
    return session.scalar(statement)
