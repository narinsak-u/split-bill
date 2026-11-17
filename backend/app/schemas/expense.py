from typing import Literal

from pydantic import BaseModel, StrictStr


class ExactExpenseSplitRequest(BaseModel):
    type: Literal["exact"]
    shares: dict[StrictStr, StrictStr]


class ExpenseCreateRequest(BaseModel):
    description: StrictStr
    paid_by: StrictStr
    amount: StrictStr
    split: ExactExpenseSplitRequest


class ExpenseShareResponse(BaseModel):
    username: str
    amount: str


class ExpenseSplitResponse(BaseModel):
    type: str
    shares: list[ExpenseShareResponse]


class ExpenseResponse(BaseModel):
    id: str
    group_id: int
    description: str
    paid_by: str
    amount: str
    split: ExpenseSplitResponse
    created_at: str
    deleted_at: str | None


class ExpenseListResponse(BaseModel):
    expenses: list[ExpenseResponse]
