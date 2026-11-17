from decimal import Decimal

import pytest

from app.services.allocation import AllocationError, allocate_equal, allocate_exact, parse_money


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("0", Decimal(0)),
        ("12", Decimal(12)),
        ("12.3", Decimal("12.30")),
        ("12.34", Decimal("12.34")),
    ],
)
def test_parse_money_accepts_valid_decimal_strings(value, expected):
    assert parse_money(value, allow_zero=True) == expected


@pytest.mark.parametrize(
    "value", ["NaN", "Infinity", "-Infinity", "1.001", "-0.01", "10000000000.00", "abc", "1e2", ""]
)
def test_parse_money_rejects_invalid_or_out_of_range_strings(value):
    with pytest.raises(AllocationError) as error:
        parse_money(value, allow_zero=True)

    assert error.value.code == "INVALID_AMOUNT"


def test_parse_money_requires_a_string_and_positive_total():
    for value, allow_zero in [(1, True), ("0.00", False), ("-1.00", False)]:
        with pytest.raises(AllocationError) as error:
            parse_money(value, allow_zero=allow_zero)
        assert error.value.code == "INVALID_AMOUNT"


def test_allocate_exact_returns_decimal_shares_in_input_order():
    shares = {"bob": "3.25", "alice": "6.75"}

    assert allocate_exact(Decimal("10.00"), shares) == [
        ("bob", Decimal("3.25")),
        ("alice", Decimal("6.75")),
    ]


def test_allocate_exact_allows_zero_shares():
    assert allocate_exact(Decimal("1.00"), {"alice": "0.00", "bob": "1"}) == [
        ("alice", Decimal("0.00")),
        ("bob", Decimal("1.00")),
    ]


@pytest.mark.parametrize("shares", [{}, {"alice": "1.00", "bob": "0.01"}])
def test_allocate_exact_rejects_empty_or_mismatched_shares(shares):
    with pytest.raises(AllocationError) as error:
        allocate_exact(Decimal("1.00"), shares)

    assert error.value.code == "INVALID_SPLIT_TOTAL"
    assert "expected" in error.value.details
    assert "actual" in error.value.details


def test_allocate_exact_rejects_total_with_excess_precision():
    with pytest.raises(AllocationError) as error:
        allocate_exact(Decimal("1.000"), {"alice": "1.00"})

    assert error.value.code == "INVALID_AMOUNT"


@pytest.mark.parametrize(
    "shares", [{"alice": "-0.01"}, {"": "1.00"}, {"alice": "1.001"}, {"alice": "10000000000.00"}]
)
def test_allocate_exact_rejects_invalid_member_or_share(shares):
    with pytest.raises(AllocationError) as error:
        allocate_exact(Decimal("1.00"), shares)

    assert error.value.code in {"INVALID_SPLIT_MEMBER", "INVALID_AMOUNT"}


def test_allocate_exact_rejects_invalid_total():
    with pytest.raises(AllocationError) as error:
        allocate_exact(Decimal("0.00"), {"alice": "0.00"})

    assert error.value.code == "INVALID_AMOUNT"


@pytest.mark.parametrize(
    ("total", "members", "expected"),
    [
        (
            Decimal("100.00"),
            ["alice", "bob", "carol"],
            [("alice", Decimal("33.34")), ("bob", Decimal("33.33")), ("carol", Decimal("33.33"))],
        ),
        (
            Decimal("0.01"),
            ["alice", "bob", "carol"],
            [("alice", Decimal("0.01")), ("bob", Decimal("0.00")), ("carol", Decimal("0.00"))],
        ),
        (
            Decimal("1.00"),
            ["carol", "alice", "bob"],
            [("carol", Decimal("0.34")), ("alice", Decimal("0.33")), ("bob", Decimal("0.33"))],
        ),
    ],
)
def test_allocate_equal_distributes_satang_in_member_order(total, members, expected):
    allocations = allocate_equal(total, members)

    assert allocations == expected
    assert sum((share for _, share in allocations), Decimal("0.00")) == total


@pytest.mark.parametrize("members", [[], ["alice", "alice"], [""]])
def test_allocate_equal_rejects_empty_or_invalid_members(members):
    with pytest.raises(AllocationError) as error:
        allocate_equal(Decimal("1.00"), members)

    assert error.value.code == "INVALID_SPLIT_MEMBER"
