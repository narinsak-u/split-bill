import re
from collections.abc import Mapping
from decimal import Decimal, InvalidOperation

_MONEY_PATTERN = re.compile(r"\d+(?:\.\d{1,2})?\Z")
_MAX_AMOUNT = Decimal("9999999999.99")


class AllocationError(ValueError):
    def __init__(self, code: str, details: dict[str, object] | None = None):
        self.code = code
        self.details = details or {}
        super().__init__(code)


def parse_money(value: str, *, allow_zero: bool = False) -> Decimal:
    if not isinstance(value, str) or not _MONEY_PATTERN.fullmatch(value):
        raise AllocationError("INVALID_AMOUNT")

    try:
        amount = Decimal(value)
    except InvalidOperation as exc:
        raise AllocationError("INVALID_AMOUNT") from exc

    if not amount.is_finite() or amount > _MAX_AMOUNT or (amount == 0 and not allow_zero):
        raise AllocationError("INVALID_AMOUNT")
    return amount.quantize(Decimal("0.01"))


def allocate_exact(total: Decimal, shares: Mapping[str, str]) -> list[tuple[str, Decimal]]:
    if (
        not isinstance(total, Decimal)
        or not total.is_finite()
        or total <= 0
        or total > _MAX_AMOUNT
        or total.as_tuple().exponent < -2
    ):
        raise AllocationError("INVALID_AMOUNT")
    if not shares:
        raise AllocationError(
            "INVALID_SPLIT_TOTAL", {"expected": format(total, ".2f"), "actual": "0.00"}
        )

    allocated: list[tuple[str, Decimal]] = []
    actual = Decimal("0.00")
    for member, value in shares.items():
        if not isinstance(member, str) or not member:
            raise AllocationError("INVALID_SPLIT_MEMBER", {"member": member})
        share = parse_money(value, allow_zero=True)
        allocated.append((member, share))
        actual += share

    if actual != total:
        raise AllocationError(
            "INVALID_SPLIT_TOTAL",
            {"expected": format(total, ".2f"), "actual": format(actual, ".2f")},
        )
    return allocated


def allocate_equal(total: Decimal, members: list[str]) -> list[tuple[str, Decimal]]:
    if (
        not isinstance(total, Decimal)
        or not total.is_finite()
        or total <= 0
        or total > _MAX_AMOUNT
        or total.as_tuple().exponent < -2
    ):
        raise AllocationError("INVALID_AMOUNT")
    if not members:
        raise AllocationError("INVALID_SPLIT_MEMBER", {"members": []})
    if any(not isinstance(member, str) or not member for member in members):
        raise AllocationError("INVALID_SPLIT_MEMBER")
    if len(set(members)) != len(members):
        raise AllocationError("INVALID_SPLIT_MEMBER", {"members": members})

    total_satang = int(total * 100)
    base, remainder = divmod(total_satang, len(members))
    return [
        (member, Decimal(base + (index < remainder)) / 100) for index, member in enumerate(members)
    ]
