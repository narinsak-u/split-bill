from pydantic import BaseModel


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
