from typing import Annotated

from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.schemas.expense import ExpenseListResponse
from app.services import expense_service

router = APIRouter(prefix="/groups/{group_id}/expenses", tags=["expenses"])


@router.get("", response_model=ExpenseListResponse)
def list_expenses(
    group_id: int,
    session: Annotated[Session, Depends(get_db)],
    username: Annotated[str | None, Header(alias="X-User")] = None,
):
    return {"expenses": expense_service.list_expenses(session, username, group_id)}
