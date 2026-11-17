def test_user_sees_only_accessible_groups(client):
    response = client.get("/groups", headers={"X-User": "alice"})

    assert response.status_code == 200
    assert response.json() == {"groups": [{"id": 1, "name": "Chiang Mai trip"}]}


def test_office_lunch_is_visible_only_to_its_seeded_members(client):
    for username, expected in (
        ("bob", [{"id": 1, "name": "Chiang Mai trip"}, {"id": 2, "name": "Office lunch"}]),
        ("dan", [{"id": 2, "name": "Office lunch"}]),
    ):
        response = client.get("/groups", headers={"X-User": username})

        assert response.status_code == 200
        assert response.json() == {"groups": expected}


def test_group_detail_lists_members_in_username_order(client):
    response = client.get("/groups/1", headers={"X-User": "alice"})

    assert response.status_code == 200
    assert response.json() == {
        "id": 1,
        "name": "Chiang Mai trip",
        "members": [{"username": "alice"}, {"username": "bob"}, {"username": "carol"}],
    }


def test_user_cannot_learn_about_inaccessible_group(client):
    response = client.get("/groups/1", headers={"X-User": "dan"})

    assert response.status_code == 404
    assert response.json() == {
        "error": {"code": "GROUP_NOT_FOUND", "message": "Group not found.", "details": None}
    }


def test_missing_or_unknown_user_has_consistent_bad_request(client):
    for headers in ({}, {"X-User": "mallory"}):
        response = client.get("/groups", headers=headers)

        assert response.status_code == 400
        assert response.json()["error"]["code"] == "INVALID_USER"
