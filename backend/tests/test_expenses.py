from sqlalchemy import text


def _delete_expense_by_key(test_engine, idempotency_key):
    with test_engine.begin() as connection:
        connection.execute(
            text("DELETE FROM expenses WHERE idempotency_key = :key"),
            {"key": idempotency_key},
        )


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
                    (CAST(:older AS UUID), 1, 1, 'Older', 10, 'equal', 'history-older', :hash,
                     '2026-01-01T10:00:00Z', NULL),
                    (CAST(:tie_low AS UUID), 1, 1, 'Tie low', 20, 'exact', 'history-tie-low', :hash,
                     '2026-01-02T10:00:00Z', NULL),
                    (CAST(:tie_high AS UUID), 1, 1, 'Tie high', 30, 'exact', 'history-tie-high', :hash,
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
                    (CAST(:tie_high AS UUID), 3, 10, 1), (CAST(:tie_high AS UUID), 1, 20, 0),
                    (CAST(:tie_low AS UUID), 2, 20, 0), (CAST(:older AS UUID), 1, 10, 0)
                """
            ),
            {"older": expense_ids[0], "tie_low": expense_ids[1], "tie_high": expense_ids[2]},
        )
        connection.execute(
            text("UPDATE expenses SET deleted_at = CURRENT_TIMESTAMP WHERE id = CAST(:id AS UUID)"),
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
            connection.execute(
                text("DELETE FROM expenses WHERE id = CAST(:id AS UUID)"), {"id": expense_id}
            )


def test_inaccessible_group_expense_history_returns_not_found(client):
    response = client.get("/groups/1/expenses", headers={"X-User": "dan"})

    assert response.status_code == 404


def test_create_exact_expense_and_matching_canonical_retry(client, test_engine):
    payload = {
        "description": "Lunch  ",
        "paid_by": "bob",
        "amount": "10.50",
        "split": {"type": "exact", "shares": {"alice": "2.5", "carol": "8.00"}},
    }
    headers = {"X-User": "alice", "Idempotency-Key": "exact-create"}

    created = client.post("/groups/1/expenses", json=payload, headers=headers)
    retried = client.post(
        "/groups/1/expenses",
        json={
            **payload,
            "amount": "10.5",
            "split": {"type": "exact", "shares": {"carol": "8.0", "alice": "2.50"}},
        },
        headers=headers,
    )

    assert created.status_code == 201
    assert created.json()["description"] == "Lunch  "
    assert created.json()["paid_by"] == "bob"
    assert created.json()["split"] == {
        "type": "exact",
        "shares": [{"username": "alice", "amount": "2.50"}, {"username": "carol", "amount": "8.00"}],
    }
    assert retried.status_code == 200
    assert retried.json() == created.json()
    expense_id = created.json()["id"]
    with test_engine.begin() as connection:
        assert connection.execute(
            text("SELECT count(*) FROM expenses WHERE idempotency_key = 'exact-create'")
        ).scalar_one() == 1
        assert connection.execute(
            text("SELECT count(*) FROM expense_shares WHERE expense_id = CAST(:id AS UUID)"),
            {"id": expense_id},
        ).scalar_one() == 2
    _delete_expense_by_key(test_engine, "exact-create")


def test_changed_request_with_same_key_conflicts(client, test_engine):
    headers = {"X-User": "alice", "Idempotency-Key": "exact-conflict"}
    payload = {
        "description": "Lunch",
        "paid_by": "alice",
        "amount": "10.00",
        "split": {"type": "exact", "shares": {"alice": "10.00"}},
    }
    assert client.post("/groups/1/expenses", json=payload, headers=headers).status_code == 201

    response = client.post(
        "/groups/1/expenses",
        json={**payload, "description": "Dinner"},
        headers=headers,
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "IDEMPOTENCY_CONFLICT"
    _delete_expense_by_key(test_engine, "exact-conflict")


def test_create_exact_expense_rejects_invalid_money_and_members(client):
    headers = {"X-User": "alice", "Idempotency-Key": "exact-invalid"}
    payload = {
        "description": "Lunch",
        "paid_by": "alice",
        "amount": "10.00",
        "split": {"type": "exact", "shares": {"alice": "10.00"}},
    }
    for body, code in (
        ({**payload, "amount": "0"}, "INVALID_AMOUNT"),
        (
            {**payload, "split": {"type": "exact", "shares": {"alice": "9.99"}}},
            "INVALID_SPLIT_TOTAL",
        ),
        (
            {**payload, "split": {"type": "exact", "shares": {"dan": "10.00"}}},
            "INVALID_SPLIT_MEMBER",
        ),
        ({**payload, "amount": "1.001"}, "INVALID_AMOUNT"),
    ):
        response = client.post("/groups/1/expenses", json=body, headers=headers)
        assert response.status_code == 422
        assert response.json()["error"]["code"] == code


def test_create_expense_requires_identity_and_idempotency_headers(client):
    payload = {
        "description": "Lunch",
        "paid_by": "alice",
        "amount": "10.00",
        "split": {"type": "exact", "shares": {"alice": "10.00"}},
    }
    for headers, code in (
        ({"Idempotency-Key": "missing-user"}, "INVALID_USER"),
        ({"X-User": "alice"}, "MISSING_IDEMPOTENCY_KEY"),
    ):
        response = client.post("/groups/1/expenses", json=payload, headers=headers)
        assert response.status_code == 400
        assert response.json()["error"]["code"] == code


def test_create_expense_checks_payer_membership_and_group_access(client):
    payload = {
        "description": "Lunch",
        "paid_by": "dan",
        "amount": "10.00",
        "split": {"type": "exact", "shares": {"alice": "10.00"}},
    }
    headers = {"X-User": "alice", "Idempotency-Key": "exact-permissions"}
    payer_response = client.post("/groups/1/expenses", json=payload, headers=headers)
    inaccessible_response = client.post(
        "/groups/1/expenses",
        json=payload,
        headers={"X-User": "dan", "Idempotency-Key": "inaccessible"},
    )

    assert payer_response.status_code == 422
    assert payer_response.json()["error"]["code"] == "INVALID_SPLIT_MEMBER"
    assert inaccessible_response.status_code == 404
    assert inaccessible_response.json()["error"]["code"] == "GROUP_NOT_FOUND"


def test_idempotency_key_is_scoped_to_group(client, test_engine):
    payload = {
        "description": "Shared key",
        "paid_by": "bob",
        "amount": "5.00",
        "split": {"type": "exact", "shares": {"bob": "5.00"}},
    }
    headers = {"X-User": "bob", "Idempotency-Key": "group-scoped-key"}

    first = client.post("/groups/1/expenses", json=payload, headers=headers)
    second = client.post("/groups/2/expenses", json=payload, headers=headers)

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["id"] != second.json()["id"]
    _delete_expense_by_key(test_engine, "group-scoped-key")


def test_concurrent_matching_creates_store_one_expense(client, test_engine):
    from concurrent.futures import ThreadPoolExecutor

    payload = {
        "description": "Concurrent lunch",
        "paid_by": "alice",
        "amount": "10.00",
        "split": {"type": "exact", "shares": {"bob": "10.00"}},
    }
    headers = {"X-User": "alice", "Idempotency-Key": "exact-concurrent"}
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(
            pool.map(
                lambda _: client.post("/groups/1/expenses", json=payload, headers=headers),
                range(2),
            )
        )

    assert sorted(response.status_code for response in responses) == [200, 201]
    assert responses[0].json() == responses[1].json()
    expense_id = responses[0].json()["id"]
    with test_engine.begin() as connection:
        assert connection.execute(
            text("SELECT count(*) FROM expenses WHERE idempotency_key = 'exact-concurrent'")
        ).scalar_one() == 1
        assert connection.execute(
            text("SELECT count(*) FROM expense_shares WHERE expense_id = CAST(:id AS UUID)"),
            {"id": expense_id},
        ).scalar_one() == 1
    _delete_expense_by_key(test_engine, "exact-concurrent")


def test_failed_share_write_rolls_back_expense_and_allows_retry(client, test_engine):
    from fastapi.testclient import TestClient

    from app.main import app

    with test_engine.begin() as connection:
        connection.execute(text("DROP TRIGGER IF EXISTS fail_expense_share_insert ON expense_shares"))
        connection.execute(text("DROP FUNCTION IF EXISTS fail_expense_share_insert()"))
        connection.execute(
            text(
                """
                CREATE FUNCTION fail_expense_share_insert() RETURNS trigger
                LANGUAGE plpgsql AS $$
                BEGIN
                    RAISE EXCEPTION 'forced share insert failure';
                END;
                $$
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE TRIGGER fail_expense_share_insert
                BEFORE INSERT ON expense_shares
                FOR EACH ROW EXECUTE FUNCTION fail_expense_share_insert()
                """
            )
        )
    payload = {
        "description": "Rollback lunch",
        "paid_by": "alice",
        "amount": "10.00",
        "split": {"type": "exact", "shares": {"bob": "10.00"}},
    }
    headers = {"X-User": "alice", "Idempotency-Key": "exact-rollback"}
    try:
        with TestClient(app, raise_server_exceptions=False) as guarded_client:
            failed = guarded_client.post("/groups/1/expenses", json=payload, headers=headers)
    finally:
        with test_engine.begin() as connection:
            connection.execute(
                text("DROP TRIGGER IF EXISTS fail_expense_share_insert ON expense_shares")
            )
            connection.execute(text("DROP FUNCTION IF EXISTS fail_expense_share_insert()"))

    assert failed.status_code == 500
    assert failed.json()["error"]["code"] == "INTERNAL_SERVER_ERROR"
    with test_engine.begin() as connection:
        assert connection.execute(
            text("SELECT count(*) FROM expenses WHERE idempotency_key = 'exact-rollback'")
        ).scalar_one() == 0
        assert connection.execute(
            text(
                """
                SELECT count(*) FROM expense_shares
                WHERE expense_id IN (
                    SELECT id FROM expenses WHERE idempotency_key = 'exact-rollback'
                )
                """
            )
        ).scalar_one() == 0

    retry = client.post("/groups/1/expenses", json=payload, headers=headers)

    assert retry.status_code == 201
    _delete_expense_by_key(test_engine, "exact-rollback")


def test_waiting_matching_request_succeeds_after_first_write_rolls_back(client, test_engine):
    from concurrent.futures import ThreadPoolExecutor
    from time import monotonic, sleep

    from fastapi.testclient import TestClient

    from app.main import app

    lock_id = 981337
    with test_engine.begin() as connection:
        connection.execute(
            text("DROP TRIGGER IF EXISTS fail_first_racing_expense_share ON expense_shares")
        )
        connection.execute(text("DROP FUNCTION IF EXISTS fail_first_racing_expense_share()"))
        connection.execute(text("DROP SEQUENCE IF EXISTS expense_share_race_once_seq"))
        connection.execute(text("CREATE SEQUENCE expense_share_race_once_seq START WITH 1"))
        connection.execute(
            text(
                f"""
                CREATE FUNCTION fail_first_racing_expense_share() RETURNS trigger
                LANGUAGE plpgsql AS $$
                BEGIN
                    IF nextval('expense_share_race_once_seq') = 1 THEN
                        PERFORM pg_advisory_xact_lock({lock_id});
                        RAISE EXCEPTION 'forced first racing share failure';
                    END IF;
                    RETURN NEW;
                END;
                $$
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE TRIGGER fail_first_racing_expense_share
                BEFORE INSERT ON expense_shares
                FOR EACH ROW EXECUTE FUNCTION fail_first_racing_expense_share()
                """
            )
        )

    lock_connection = test_engine.connect()
    lock_connection.execute(text("SELECT pg_advisory_lock(:lock_id)"), {"lock_id": lock_id})
    lock_connection.commit()

    def wait_for_lock(event: str, timeout: float = 10.0) -> None:
        deadline = monotonic() + timeout
        while monotonic() < deadline:
            with test_engine.connect() as connection:
                count = connection.scalar(
                    text(
                        """
                        SELECT count(*)
                        FROM pg_stat_activity
                        WHERE pid <> pg_backend_pid()
                          AND datname = current_database()
                          AND wait_event = :event
                        """
                    ),
                    {"event": event},
                )
            if count:
                return
            sleep(0.01)
        raise AssertionError(f"No PostgreSQL session reached wait event {event!r}.")

    payload = {
        "description": "Racing rollback",
        "paid_by": "alice",
        "amount": "10.00",
        "split": {"type": "exact", "shares": {"bob": "10.00"}},
    }
    headers = {"X-User": "alice", "Idempotency-Key": "exact-racing-rollback"}
    try:
        with TestClient(app, raise_server_exceptions=False) as race_client, ThreadPoolExecutor(
            max_workers=2
        ) as pool:
            first = pool.submit(
                race_client.post, "/groups/1/expenses", json=payload, headers=headers
            )
            try:
                wait_for_lock("advisory")
                second = pool.submit(
                    race_client.post, "/groups/1/expenses", json=payload, headers=headers
                )
                wait_for_lock("transactionid")
            finally:
                lock_connection.execute(
                    text("SELECT pg_advisory_unlock(:lock_id)"), {"lock_id": lock_id}
                )
                lock_connection.commit()
            first_response = first.result(timeout=10)
            second_response = second.result(timeout=10)
    finally:
        lock_connection.close()
        with test_engine.begin() as connection:
            connection.execute(
                text("DROP TRIGGER IF EXISTS fail_first_racing_expense_share ON expense_shares")
            )
            connection.execute(text("DROP FUNCTION IF EXISTS fail_first_racing_expense_share()"))
            connection.execute(text("DROP SEQUENCE IF EXISTS expense_share_race_once_seq"))

    assert first_response.status_code == 500
    assert second_response.status_code == 201
    with test_engine.begin() as connection:
        assert connection.execute(
            text(
                "SELECT count(*) FROM expenses WHERE idempotency_key = 'exact-racing-rollback'"
            )
        ).scalar_one() == 1
        assert connection.execute(
            text(
                """
                SELECT count(*) FROM expense_shares
                WHERE expense_id = (
                    SELECT id FROM expenses WHERE idempotency_key = 'exact-racing-rollback'
                )
                """
            )
        ).scalar_one() == 1
    _delete_expense_by_key(test_engine, "exact-racing-rollback")


def test_create_expense_requires_money_and_member_values_as_strings(client):
    response = client.post(
        "/groups/1/expenses",
        json={
            "description": "Strict input",
            "paid_by": "alice",
            "amount": 10,
            "split": {"type": "exact", "shares": {"alice": "10.00"}},
        },
        headers={"X-User": "alice", "Idempotency-Key": "strict-amount"},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_create_expense_rejects_empty_or_whitespace_description(client):
    payload = {
        "paid_by": "alice",
        "amount": "10.00",
        "split": {"type": "exact", "shares": {"alice": "10.00"}},
    }
    for description, key in (("", "empty-description"), ("   ", "blank-description")):
        response = client.post(
            "/groups/1/expenses",
            json={**payload, "description": description},
            headers={"X-User": "alice", "Idempotency-Key": key},
        )

        assert response.status_code == 422
        assert response.json()["error"]["code"] == "VALIDATION_ERROR"
        detail = response.json()["error"]["details"][0]
        assert detail["loc"] == ["body", "description"]
        assert "Description must not be blank." in detail["msg"]
