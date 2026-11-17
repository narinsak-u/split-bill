export type GroupSummary = { id: number; name: string };
export type GroupDetail = { id: number; name: string; members: { username: string }[] };

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, username: string): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, { headers: { "X-User": username } });
  if (!response.ok) throw new Error("Request failed");
  return response.json() as Promise<T>;
}

export async function getGroups(username: string): Promise<GroupSummary[]> {
  const result = await request<{ groups: GroupSummary[] }>("/groups", username);
  return result.groups;
}

export function getGroup(username: string, groupId: number): Promise<GroupDetail> {
  return request<GroupDetail>(`/groups/${groupId}`, username);
}
