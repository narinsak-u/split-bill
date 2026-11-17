from typing import Annotated

from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.schemas.balance import GroupBalanceResponse
from app.schemas.group import GroupDetailResponse, GroupListResponse
from app.services import balance_service, group_service

router = APIRouter(prefix="/groups", tags=["groups"])


@router.get("", response_model=GroupListResponse)
def list_groups(
    session: Annotated[Session, Depends(get_db)],
    username: Annotated[str | None, Header(alias="X-User")] = None,
):
    return {"groups": group_service.list_groups(session, username)}


@router.get("/{group_id}", response_model=GroupDetailResponse)
def get_group(
    group_id: int,
    session: Annotated[Session, Depends(get_db)],
    username: Annotated[str | None, Header(alias="X-User")] = None,
):
    return group_service.get_group(session, username, group_id)


@router.get("/{group_id}/balances", response_model=GroupBalanceResponse)
def get_group_balances(
    group_id: int,
    session: Annotated[Session, Depends(get_db)],
    username: Annotated[str | None, Header(alias="X-User")] = None,
):
    return balance_service.get_group_balances(session, username, group_id)
