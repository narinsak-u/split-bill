from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from app.repositories import expense_repository
from app.services import group_service


def _timestamp(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def list_expenses(session: Session, username: str | None, group_id: int) -> list[dict[str, object]]:
    group_service.get_group(session, username, group_id)
    return [
        {
            "id": str(expense.id),
            "group_id": expense.group_id,
            "description": expense.description,
            "paid_by": expense.payer.username,
            "amount": format(Decimal(expense.amount), ".2f"),
            "split": {
                "type": expense.split_type,
                "shares": [
                    {"username": share.user.username, "amount": format(Decimal(share.amount), ".2f")}
                    for share in expense.shares
                ],
            },
            "created_at": _timestamp(expense.created_at),
            "deleted_at": _timestamp(expense.deleted_at),
        }
        for expense in expense_repository.list_for_group(session, group_id)
    ]
