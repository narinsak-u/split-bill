from decimal import Decimal

from sqlalchemy.orm import Session

from app.repositories import balance_repository
from app.services import group_service


def get_group_balances(session: Session, username: str | None, group_id: int) -> dict[str, object]:
    group_service.get_group(session, username, group_id)
    balances = []
    total_balance = Decimal("0.00")
    for member in balance_repository.get_group_balances(session, group_id):
        paid = member["paid"]
        share = member["share"]
        balance = paid - share
        total_balance += balance
        balances.append(
            {
                "username": member["username"],
                "paid": f"{paid:.2f}",
                "share": f"{share:.2f}",
                "balance": f"{balance:.2f}",
            }
        )
    return {
        "group_id": group_id,
        "balances": balances,
        "total_balance": f"{total_balance:.2f}",
    }
