export type Expense = {
  id: string;
  group_id: number;
  description: string;
  paid_by: string;
  amount: string;
  split: {
    type: "equal" | "exact";
    shares: { username: string; amount: string }[];
  };
  created_at: string;
  deleted_at: string | null;
};

export type CreateExpenseRequest = {
  description: string;
  paid_by: string;
  amount: string;
  split:
    | { type: "equal"; members: string[] }
    | { type: "exact"; shares: Record<string, string> };
};

export type GroupBalancesResponse = { group_id: number; balances: { username: string; paid: string; share: string; balance: string }[]; total_balance: string };

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function requestError(response: Response): Promise<Error> {
  try {
    const body = await response.json() as { error?: { message?: string; code?: string } };
    return new Error(body.error?.message ?? body.error?.code ?? "Request failed.");
  } catch {
    return new Error("Request failed.");
  }
}

export async function getExpenses(username: string, groupId: number): Promise<Expense[]> {
  const response = await fetch(`${apiUrl}/groups/${groupId}/expenses`, { headers: { "X-User": username } });
  if (!response.ok) throw await requestError(response);
  const result = await response.json() as { expenses: Expense[] };
  return result.expenses;
}

export async function getBalances(username: string, groupId: number) {
  const response = await fetch(`${apiUrl}/groups/${groupId}/balances`, { headers: { "X-User": username } });
  if (!response.ok) throw await requestError(response);
  return response.json() as Promise<GroupBalancesResponse>;
}

export async function createExpense(username: string, groupId: number, idempotencyKey: string, payload: CreateExpenseRequest): Promise<Expense> {
  const response = await fetch(`${apiUrl}/groups/${groupId}/expenses`, {
    method: "POST",
    headers: { "X-User": username, "Idempotency-Key": idempotencyKey, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await requestError(response);
  return response.json() as Promise<Expense>;
}
export async function deleteExpense(username: string, groupId: number, expenseId: string): Promise<void> {
  const response = await fetch(`${apiUrl}/groups/${groupId}/expenses/${expenseId}`, {
    method: "DELETE",
    headers: { "X-User": username },
  });
  if (!response.ok) throw await requestError(response);
}
