from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.repositories import group_repository


def _current_user(session: Session, username: str | None):
    user = group_repository.find_user(session, username or "")
    if user is None:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_USER", "message": "Unknown or missing user.", "details": None},
        )
    return user


def list_groups(session: Session, username: str | None) -> list[dict[str, int | str]]:
    user = _current_user(session, username)
    return [
        {"id": group.id, "name": group.name}
        for group in group_repository.list_for_user(session, user.id)
    ]


def get_group(session: Session, username: str | None, group_id: int) -> dict[str, object]:
    user = _current_user(session, username)
    group = group_repository.find_for_user(session, group_id, user.id)
    if group is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "GROUP_NOT_FOUND", "message": "Group not found.", "details": None},
        )
    members = group_repository.list_members(session, group.id)
    return {
        "id": group.id,
        "name": group.name,
        "members": [{"username": member.username} for member in members],
    }
