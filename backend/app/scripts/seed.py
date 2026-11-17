from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.db.models import Group, GroupMember, User

USERS = ("alice", "bob", "carol", "dan")
GROUPS = ((1, "Chiang Mai trip", ("alice", "bob", "carol")), (2, "Office lunch", ("bob", "dan")))


def seed_database(session: Session) -> None:
    with session.begin():
        session.execute(
            insert(User).values([{"id": index, "username": name} for index, name in enumerate(USERS, 1)]).on_conflict_do_nothing()
        )
        session.execute(
            insert(Group).values([{"id": group_id, "name": name} for group_id, name, _ in GROUPS]).on_conflict_do_nothing()
        )
        user_ids = dict(session.query(User.username, User.id).filter(User.username.in_(USERS)).all())
        memberships = [
            {"group_id": group_id, "user_id": user_ids[username]}
            for group_id, _, usernames in GROUPS
            for username in usernames
        ]
        session.execute(insert(GroupMember).values(memberships).on_conflict_do_nothing())
        session.execute(text("SELECT setval(pg_get_serial_sequence('users', 'id'), GREATEST((SELECT MAX(id) FROM users), 1))"))
        session.execute(text("SELECT setval(pg_get_serial_sequence('groups', 'id'), GREATEST((SELECT MAX(id) FROM groups), 1))"))


def main() -> None:
    from app.db.session import SessionLocal

    with SessionLocal() as session:
        seed_database(session)


if __name__ == "__main__":
    main()
