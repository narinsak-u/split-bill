"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getGroup, getGroups } from "../features/groups/api";
import { getBalances, getExpenses } from "../features/expenses/api";
import { ExpenseForm } from "../features/expenses/ExpenseForm";
import { ExpenseList } from "../features/expenses/ExpenseList";

const users = ["alice", "bob", "carol", "dan"];

export default function SplitBillPage() {
  const [username, setUsername] = useState("alice");
  const [groupId, setGroupId] = useState("");
  const queryClient = useQueryClient();
  const groups = useQuery({ queryKey: ["groups", username], queryFn: () => getGroups(username) });
  const detail = useQuery({
    queryKey: ["group", username, groupId],
    queryFn: () => getGroup(username, Number(groupId)),
    enabled: groupId !== "",
  });
  const expenses = useQuery({
    queryKey: ["expenses", username, groupId],
    queryFn: () => getExpenses(username, Number(groupId)),
    enabled: groupId !== "",
  });
  const balances = useQuery({
    queryKey: ["balances", username, groupId],
    queryFn: () => getBalances(username, Number(groupId)),
    enabled: groupId !== "",
  });

  function changeUser(nextUser: string) {
    queryClient.removeQueries({ queryKey: ["groups"] });
    queryClient.removeQueries({ queryKey: ["group"] });
    queryClient.removeQueries({ queryKey: ["expenses"] });
    queryClient.removeQueries({ queryKey: ["balances"] });
    setGroupId("");
    setUsername(nextUser);
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold">SplitBill</h1>
      <p className="mt-2 text-slate-600">Choose a user to browse their groups.</p>
      <section aria-label="Group access" className="mt-8 grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="user" className="mb-2 block font-medium">User</label>
          <select id="user" className="min-h-11 w-full rounded border border-slate-400 bg-white px-3" value={username} onChange={(event) => changeUser(event.target.value)}>
            {users.map((user) => <option key={user} value={user}>{user}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="group" className="mb-2 block font-medium">Group</label>
          <select id="group" className="min-h-11 w-full rounded border border-slate-400 bg-white px-3" value={groupId} onChange={(event) => setGroupId(event.target.value)} disabled={groups.isPending || groups.isError || groups.data?.length === 0}>
            <option value="">Select a group</option>
            {groups.data?.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
        </div>
      </section>

      {groups.isPending ? <p role="status" className="mt-5">Loading groups…</p> : null}
      {groups.isError ? <p role="alert" className="mt-5">Could not load groups.</p> : null}
      {groups.isSuccess && groups.data.length === 0 ? <p className="mt-5">No groups available.</p> : null}
      {groupId && detail.isPending ? <p role="status" className="mt-5">Loading group…</p> : null}
      {groupId && detail.isError ? <p role="alert" className="mt-5">Could not load group.</p> : null}
      {detail.data ? (
        <section aria-live="polite" className="mt-8 rounded border border-slate-200 p-5">
          <h2 className="text-xl font-semibold">{detail.data.name}</h2>
          <h3 className="mt-4 font-medium">Members</h3>
          <p className="mt-1 text-slate-700">{detail.data.members.map((member) => member.username).join(", ")}</p>
        </section>
      ) : null}
      {groupId && expenses.isPending ? <p role="status" className="mt-5">Loading expenses…</p> : null}
      {groupId && expenses.isError ? <p role="alert" className="mt-5">Could not load expenses.</p> : null}
      {groupId && expenses.isSuccess ? <ExpenseList expenses={expenses.data} /> : null}
      {detail.data && groupId ? <ExpenseForm key={`${username}-${groupId}`} username={username} groupId={Number(groupId)} members={detail.data.members.map((member) => member.username)} /> : null}
      {groupId && balances.isError ? <p role="alert" className="mt-5">Could not load balances.</p> : null}
      {balances.data ? <section aria-label="Group balances" className="mt-8 rounded border border-slate-200 p-5"><h2 className="text-xl font-semibold">Balances</h2><ul className="mt-3 space-y-1">{balances.data.balances.map((balance) => <li key={balance.username}>{balance.username}: {balance.balance}</li>)}</ul></section> : null}
    </main>
  );
}
