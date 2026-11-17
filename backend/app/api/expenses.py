from typing import Annotated

from fastapi import APIRouter, Depends, Header, Response
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.schemas.expense import ExpenseCreateRequest, ExpenseListResponse, ExpenseResponse
from app.services import expense_service

router = APIRouter(prefix="/groups/{group_id}/expenses", tags=["expenses"])


@router.get("", response_model=ExpenseListResponse)
def list_expenses(
    group_id: int,
    session: Annotated[Session, Depends(get_db)],
    username: Annotated[str | None, Header(alias="X-User")] = None,
):
    return {"expenses": expense_service.list_expenses(session, username, group_id)}


@router.post("", response_model=ExpenseResponse)
def create_expense(
    group_id: int,
    request: ExpenseCreateRequest,
    response: Response,
    session: Annotated[Session, Depends(get_db)],
    username: Annotated[str | None, Header(alias="X-User")] = None,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
):
    body, status_code = expense_service.create_exact_expense(
        session, username, group_id, request, idempotency_key
    )
    response.status_code = status_code
    return body
