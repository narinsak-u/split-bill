from pydantic import BaseModel


class GroupSummary(BaseModel):
    id: int
    name: str


class GroupListResponse(BaseModel):
    groups: list[GroupSummary]


class GroupMemberResponse(BaseModel):
    username: str


class GroupDetailResponse(BaseModel):
    id: int
    name: str
    members: list[GroupMemberResponse]
