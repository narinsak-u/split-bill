from uuid import uuid4

from sqlalchemy import text


PAYLOAD = {
    "description": "Delete test",
    "paid_by": "alice",
    "amount": "10.00",
    "split": {"type": "exact", "shares": {"alice": "5.00", "bob": "5.00"}},
}


def _cleanup(test_engine, key):
    with test_engine.begin() as connection:
        connection.execute(
            text("DELETE FROM expenses WHERE idempotency_key = :key"),
            {"key": key},
        )


def test_payer_delete_soft_deletes_expense_and_removes_history_and_balance(
    client, test_engine
):
    key = f"delete-{uuid4()}"
    headers = {"X-User": "alice", "Idempotency-Key": key}
    try:
        baseline = client.get("/groups/1/balances", headers={"X-User": "alice"}).json()
        created = client.post("/groups/1/expenses", json=PAYLOAD, headers=headers)
        expense_id = created.json()["id"]

        deleted = client.delete(f"/groups/1/expenses/{expense_id}", headers=headers)
        repeated = client.delete(f"/groups/1/expenses/{expense_id}", headers=headers)

        assert created.status_code == 201
        assert deleted.status_code == 204
        assert deleted.content == b""
        assert repeated.status_code == 404
        assert repeated.json()["error"]["code"] == "EXPENSE_NOT_FOUND"
        history = client.get("/groups/1/expenses", headers={"X-User": "alice"})
        assert expense_id not in [expense["id"] for expense in history.json()["expenses"]]
        assert client.get("/groups/1/balances", headers={"X-User": "alice"}).json() == baseline

        with test_engine.connect() as connection:
            assert connection.scalar(
                text("SELECT deleted_at IS NOT NULL FROM expenses WHERE id = CAST(:id AS UUID)"),
                {"id": expense_id},
            )
            assert connection.scalar(
                text("SELECT count(*) FROM expense_shares WHERE expense_id = CAST(:id AS UUID)"),
                {"id": expense_id},
            ) == 2
    finally:
        _cleanup(test_engine, key)


def test_delete_hides_expenses_from_inaccessible_users_and_missing_targets(client, test_engine):
    key = f"delete-forbidden-{uuid4()}"
    other_key = f"delete-wrong-group-{uuid4()}"
    headers = {"X-User": "alice", "Idempotency-Key": key}
    try:
        created = client.post("/groups/1/expenses", json=PAYLOAD, headers=headers)
        expense_id = created.json()["id"]

        forbidden = client.delete(f"/groups/1/expenses/{expense_id}", headers={"X-User": "bob"})
        inaccessible = client.delete(
            f"/groups/1/expenses/{expense_id}", headers={"X-User": "dan"}
        )
        missing_group = client.delete(
            f"/groups/999999999/expenses/{expense_id}", headers={"X-User": "alice"}
        )
        missing_expense = client.delete(
            "/groups/1/expenses/00000000-0000-0000-0000-000000000000",
            headers={"X-User": "alice"},
        )
        other_expense = client.post(
            "/groups/2/expenses",
            json={
                **PAYLOAD,
                "paid_by": "bob",
                "split": {"type": "exact", "shares": {"bob": "5.00", "dan": "5.00"}},
            },
            headers={"X-User": "bob", "Idempotency-Key": other_key},
        )
        wrong_group = client.delete(
            f"/groups/1/expenses/{other_expense.json()['id']}", headers={"X-User": "bob"}
        )

        assert created.status_code == 201
        assert forbidden.status_code == 403
        assert forbidden.json()["error"]["code"] == "EXPENSE_DELETE_FORBIDDEN"
        for response in (inaccessible, missing_group):
            assert response.status_code == 404
            assert response.json()["error"]["code"] == "GROUP_NOT_FOUND"
        assert missing_expense.status_code == 404
        assert missing_expense.json()["error"]["code"] == "EXPENSE_NOT_FOUND"
        assert other_expense.status_code == 201
        assert wrong_group.status_code == 404
        assert wrong_group.json()["error"]["code"] == "EXPENSE_NOT_FOUND"
    finally:
        _cleanup(test_engine, key)
        _cleanup(test_engine, other_key)


def test_deleted_expense_retry_returns_original_without_resurrection(client, test_engine):
    key = f"delete-retry-{uuid4()}"
    headers = {"X-User": "alice", "Idempotency-Key": key}
    try:
        created = client.post("/groups/1/expenses", json=PAYLOAD, headers=headers)
        expense_id = created.json()["id"]
        deleted = client.delete(f"/groups/1/expenses/{expense_id}", headers=headers)
        retry = client.post("/groups/1/expenses", json=PAYLOAD, headers=headers)
        conflict = client.post(
            "/groups/1/expenses", json={**PAYLOAD, "description": "Changed"}, headers=headers
        )

        assert created.status_code == 201
        assert deleted.status_code == 204
        assert retry.status_code == 200
        assert retry.json()["id"] == expense_id
        assert retry.json()["deleted_at"] is not None
        assert retry.json()["split"] == created.json()["split"]
        assert conflict.status_code == 409
        assert conflict.json()["error"]["code"] == "IDEMPOTENCY_CONFLICT"
        with test_engine.connect() as connection:
            assert connection.scalar(
                text("SELECT count(*) FROM expenses WHERE group_id = 1 AND idempotency_key = :key"),
                {"key": key},
            ) == 1
            assert connection.scalar(
                text("SELECT count(*) FROM expense_shares WHERE expense_id = CAST(:id AS UUID)"),
                {"id": expense_id},
            ) == 2
            assert connection.scalar(
                text("SELECT deleted_at IS NOT NULL FROM expenses WHERE id = CAST(:id AS UUID)"),
                {"id": expense_id},
            )
    finally:
        _cleanup(test_engine, key)
