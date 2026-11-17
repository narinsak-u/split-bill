from uuid import uuid4

from sqlalchemy import text


def test_group_balances_aggregate_active_expenses_and_include_all_members(client, test_engine):
    expense_ids = [uuid4(), uuid4(), uuid4()]
    with test_engine.begin() as connection:
        group_id = connection.scalar(
            text("INSERT INTO groups (name) VALUES (:name) RETURNING id"),
            {"name": f"balance test {uuid4()}"},
        )

    try:
        with test_engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO group_members (group_id, user_id) VALUES "
                    "(:group_id, 1), (:group_id, 2), (:group_id, 3), (:group_id, 4)"
                ),
                {"group_id": group_id},
            )

        with test_engine.begin() as connection:
            expenses = [
                (expense_ids[0], 1, "10.00", "active-a"),
                (expense_ids[1], 1, "6.00", "active-b"),
                (expense_ids[2], 2, "900.00", "deleted"),
            ]
            for expense_id, payer_id, amount, key in expenses:
                connection.execute(
                    text(
                        "INSERT INTO expenses "
                        "(id, group_id, paid_by_user_id, description, amount, split_type, "
                        "idempotency_key, request_hash) VALUES "
                        "(:id, :group_id, :payer_id, 'balance test', :amount, 'exact', :key, :hash)"
                    ),
                    {
                        "id": expense_id,
                        "group_id": group_id,
                        "payer_id": payer_id,
                        "amount": amount,
                        "key": key,
                        "hash": "0" * 64,
                    },
                )
            connection.execute(
                text(
                    "INSERT INTO expense_shares (expense_id, user_id, amount, allocation_order) "
                    "VALUES (:first, 1, 5.00, 0), (:first, 2, 5.00, 1), "
                    "(:second, 3, 6.00, 0), (:deleted, 2, 900.00, 0)"
                ),
                {
                    "first": expense_ids[0],
                    "second": expense_ids[1],
                    "deleted": expense_ids[2],
                },
            )
            connection.execute(
                text("UPDATE expenses SET deleted_at = now() WHERE id = :id"),
                {"id": expense_ids[2]},
            )

        response = client.get(f"/groups/{group_id}/balances", headers={"X-User": "alice"})
        assert response.status_code == 200
        assert response.json() == {
            "group_id": group_id,
            "balances": [
                {"username": "alice", "paid": "16.00", "share": "5.00", "balance": "11.00"},
                {"username": "bob", "paid": "0.00", "share": "5.00", "balance": "-5.00"},
                {"username": "carol", "paid": "0.00", "share": "6.00", "balance": "-6.00"},
                {"username": "dan", "paid": "0.00", "share": "0.00", "balance": "0.00"},
            ],
            "total_balance": "0.00",
        }

        with test_engine.begin() as connection:
            connection.execute(text("DELETE FROM expenses WHERE group_id = :id"), {"id": group_id})
        empty = client.get(f"/groups/{group_id}/balances", headers={"X-User": "alice"})
        assert empty.status_code == 200
        assert all(
            member["paid"] == member["share"] == member["balance"] == "0.00"
            for member in empty.json()["balances"]
        )
        assert empty.json()["total_balance"] == "0.00"
    finally:
        with test_engine.begin() as connection:
            connection.execute(text("DELETE FROM expenses WHERE group_id = :id"), {"id": group_id})
            connection.execute(text("DELETE FROM groups WHERE id = :id"), {"id": group_id})


def test_group_balances_reject_unknown_user_and_hide_inaccessible_group(client):
    unknown = client.get("/groups/1/balances", headers={"X-User": "unknown"})
    assert unknown.status_code == 400
    assert unknown.json()["error"]["code"] == "INVALID_USER"

    inaccessible = client.get("/groups/1/balances", headers={"X-User": "dan"})
    assert inaccessible.status_code == 404
    assert inaccessible.json()["error"]["code"] == "GROUP_NOT_FOUND"
