from sqlalchemy import text


def test_group_expense_history_is_empty(client):
    response = client.get("/groups/1/expenses", headers={"X-User": "alice"})

    assert response.status_code == 200
    assert response.json() == {"expenses": []}


def test_history_returns_stored_shares_ordered_and_excludes_deleted_rows(client, test_engine):
    expense_ids = (
        "00000000-0000-0000-0000-000000000001",
        "00000000-0000-0000-0000-000000000002",
        "00000000-0000-0000-0000-000000000003",
    )
    with test_engine.begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO expenses (
                    id, group_id, paid_by_user_id, description, amount, split_type,
                    idempotency_key, request_hash, created_at, deleted_at
                ) VALUES
                    (:older, 1, 1, 'Older', 10, 'equal', 'history-older', :hash,
                     '2026-01-01T10:00:00Z', NULL),
                    (:tie_low, 1, 1, 'Tie low', 20, 'exact', 'history-tie-low', :hash,
                     '2026-01-02T10:00:00Z', NULL),
                    (:tie_high, 1, 1, 'Tie high', 30, 'exact', 'history-tie-high', :hash,
                     '2026-01-02T10:00:00Z', NULL)
                """
            ),
            {
                "older": expense_ids[0],
                "tie_low": expense_ids[1],
                "tie_high": expense_ids[2],
                "hash": "0" * 64,
            },
        )
        connection.execute(
            text(
                """
                INSERT INTO expense_shares (expense_id, user_id, amount, allocation_order)
                VALUES
                    (:tie_high, 3, 10, 1), (:tie_high, 1, 20, 0),
                    (:tie_low, 2, 20, 0), (:older, 1, 10, 0)
                """
            ),
            {"older": expense_ids[0], "tie_low": expense_ids[1], "tie_high": expense_ids[2]},
        )
        connection.execute(
            text("UPDATE expenses SET deleted_at = CURRENT_TIMESTAMP WHERE id = :id"),
            {"id": expense_ids[0]},
        )

    response = client.get("/groups/1/expenses", headers={"X-User": "alice"})

    assert response.status_code == 200
    assert response.json() == {
        "expenses": [
            {
                "id": expense_ids[2],
                "group_id": 1,
                "description": "Tie high",
                "paid_by": "alice",
                "amount": "30.00",
                "split": {
                    "type": "exact",
                    "shares": [
                        {"username": "alice", "amount": "20.00"},
                        {"username": "carol", "amount": "10.00"},
                    ],
                },
                "created_at": "2026-01-02T10:00:00Z",
                "deleted_at": None,
            },
            {
                "id": expense_ids[1],
                "group_id": 1,
                "description": "Tie low",
                "paid_by": "alice",
                "amount": "20.00",
                "split": {"type": "exact", "shares": [{"username": "bob", "amount": "20.00"}]},
                "created_at": "2026-01-02T10:00:00Z",
                "deleted_at": None,
            },
        ]
    }
    with test_engine.begin() as connection:
        for expense_id in expense_ids:
            connection.execute(text("DELETE FROM expenses WHERE id = :id"), {"id": expense_id})


def test_inaccessible_group_expense_history_returns_not_found(client):
    response = client.get("/groups/1/expenses", headers={"X-User": "dan"})

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "GROUP_NOT_FOUND"
