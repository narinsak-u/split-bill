from typing import Annotated

from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.schemas.group import GroupDetailResponse, GroupListResponse
from app.services import group_service

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
