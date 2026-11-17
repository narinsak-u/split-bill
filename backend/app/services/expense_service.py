import hashlib
import json
from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.repositories import expense_repository
from app.schemas.expense import EqualExpenseSplitRequest, ExpenseCreateRequest
from app.services import group_service
from app.services.allocation import AllocationError, allocate_equal, allocate_exact, parse_money


def _error(status: int, code: str, message: str, details: dict[str, object] | None = None):
    return HTTPException(
        status_code=status,
        detail={"code": code, "message": message, "details": details},
    )


def _expense_response(expense) -> dict[str, object]:
    return {
        "id": str(expense.id),
        "group_id": expense.group_id,
        "description": expense.description,
        "paid_by": expense.payer.username,
        "amount": format(Decimal(expense.amount), ".2f"),
        "split": {
            "type": expense.split_type,
            "shares": [
                {
                    "username": share.user.username,
                    "amount": format(Decimal(share.amount), ".2f"),
                }
                for share in expense.shares
            ],
        },
        "created_at": _timestamp(expense.created_at),
        "deleted_at": _timestamp(expense.deleted_at),
    }


def create_expense(
    session: Session,
    username: str | None,
    group_id: int,
    request: ExpenseCreateRequest,
    idempotency_key: str | None,
) -> tuple[dict[str, object], int]:
    if not idempotency_key:
        raise _error(400, "MISSING_IDEMPOTENCY_KEY", "Idempotency-Key header is required.")
    if len(idempotency_key) > 255:
        raise _error(400, "MISSING_IDEMPOTENCY_KEY", "Idempotency-Key header is invalid.")

    try:
        with session.begin():
            group_service.get_group(session, username, group_id)
            members = expense_repository.find_member_user_ids(session, group_id)
            if request.paid_by not in members:
                raise _error(
                    422,
                    "INVALID_SPLIT_MEMBER",
                    "Payer must be a member of the group.",
                    {"member": request.paid_by},
                )
            amount = parse_money(request.amount)
            if isinstance(request.split, EqualExpenseSplitRequest):
                allocations = allocate_equal(amount, request.split.members)
            else:
                allocations = allocate_exact(amount, request.split.shares)
            invalid_members = [member for member, _ in allocations if member not in members]
            if invalid_members:
                raise _error(
                    422,
                    "INVALID_SPLIT_MEMBER",
                    "Every split member must belong to the group.",
                    {"members": invalid_members},
                )
            split_type = request.split.type
            canonical_split = (
                {"type": "equal", "members": [member for member, _ in allocations]}
                if split_type == "equal"
                else {
                    "type": "exact",
                    "shares": {
                        member: format(share, ".2f") for member, share in sorted(allocations)
                    },
                }
            )
            canonical = {
                "description": request.description,
                "paid_by": request.paid_by,
                "amount": format(amount, ".2f"),
                "split": canonical_split,
            }
            request_hash = hashlib.sha256(
                json.dumps(canonical, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
            ).hexdigest()
            expense_id = expense_repository.insert_if_absent(
                session,
                group_id=group_id,
                paid_by_user_id=members[request.paid_by],
                description=request.description,
                amount=amount,
                idempotency_key=idempotency_key,
                split_type=split_type,
                request_hash=request_hash,
            )
            if expense_id is not None:
                expense_repository.insert_shares(
                    session,
                    expense_id,
                    [(members[member], share) for member, share in allocations],
                )
                expense = expense_repository.find_by_idempotency_key(
                    session, group_id, idempotency_key
                )
                return _expense_response(expense), 201

            expense = expense_repository.find_by_idempotency_key(session, group_id, idempotency_key)
            if expense is None or expense.request_hash != request_hash:
                raise _error(
                    409,
                    "IDEMPOTENCY_CONFLICT",
                    "Idempotency key was already used for a different request.",
                )
            return _expense_response(expense), 200
    except AllocationError as exc:
        messages = {
            "INVALID_AMOUNT": "Amount must be a valid positive monetary value.",
            "INVALID_SPLIT_MEMBER": "Split members must be valid group members.",
            "INVALID_SPLIT_TOTAL": "The shares do not add up to the total.",
        }
        raise _error(422, exc.code, messages[exc.code], exc.details or None) from exc


def _timestamp(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def list_expenses(session: Session, username: str | None, group_id: int) -> list[dict[str, object]]:
    group_service.get_group(session, username, group_id)
    return [
        _expense_response(expense)
        for expense in expense_repository.list_for_group(session, group_id)
    ]


def delete_expense(
    session: Session, username: str | None, group_id: int, expense_id: UUID
) -> None:
    with session.begin():
        group_service.get_group(session, username, group_id)
        members = expense_repository.find_member_user_ids(session, group_id)
        expense = expense_repository.find_active_for_delete(session, group_id, expense_id)
        if expense is None:
            raise _error(404, "EXPENSE_NOT_FOUND", "Expense not found.")
        if expense.paid_by_user_id != members[username or ""]:
            raise _error(403, "EXPENSE_DELETE_FORBIDDEN", "Only the payer can delete this expense.")
        if not expense_repository.soft_delete(
            session, group_id, expense_id, expense.paid_by_user_id, datetime.now(UTC)
        ):
            raise _error(404, "EXPENSE_NOT_FOUND", "Expense not found.")
