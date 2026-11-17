export type Expense = {
  id: number;
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

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function getExpenses(username: string, groupId: number): Promise<Expense[]> {
  const response = await fetch(`${apiUrl}/groups/${groupId}/expenses`, { headers: { "X-User": username } });
  if (!response.ok) throw new Error("Request failed");
  const result = await response.json() as { expenses: Expense[] };
  return result.expenses;
}
