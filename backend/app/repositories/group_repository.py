from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Group, GroupMember, User


def find_user(session: Session, username: str) -> User | None:
    return session.scalar(select(User).where(User.username == username))


def list_for_user(session: Session, user_id: int) -> list[Group]:
    statement = (
        select(Group)
        .join(GroupMember, GroupMember.group_id == Group.id)
        .where(GroupMember.user_id == user_id)
        .order_by(Group.id)
    )
    return list(session.scalars(statement).all())


def find_for_user(session: Session, group_id: int, user_id: int) -> Group | None:
    statement = (
        select(Group)
        .join(GroupMember, GroupMember.group_id == Group.id)
        .where(Group.id == group_id, GroupMember.user_id == user_id)
    )
    return session.scalar(statement)


def list_members(session: Session, group_id: int) -> list[User]:
    statement = (
        select(User)
        .join(GroupMember, GroupMember.user_id == User.id)
        .where(GroupMember.group_id == group_id)
        .order_by(User.username)
    )
    return list(session.scalars(statement).all())
