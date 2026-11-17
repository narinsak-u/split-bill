from pydantic import BaseModel


class MemberBalance(BaseModel):
    username: str
    paid: str
    share: str
    balance: str


class GroupBalanceResponse(BaseModel):
    group_id: int
    balances: list[MemberBalance]
    total_balance: str
