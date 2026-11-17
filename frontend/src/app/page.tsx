"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getGroup, getGroups } from "../features/groups/api";
import { getBalances, getExpenses } from "../features/expenses/api";
import { ExpenseForm } from "../features/expenses/ExpenseForm";
import { ExpenseList } from "../features/expenses/ExpenseList";
import { formatSatang, parseSatang } from "../lib/money";

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
      {groupId && balances.isPending ? <p role="status" className="mt-5">Loading balances…</p> : null}
      {groupId && balances.isError ? <p role="alert" className="mt-5">Could not load balances.</p> : null}
      {detail.data && balances.isSuccess ? (
        <section aria-label="Group balances" className="mt-8 rounded border border-slate-200 p-5">
          <h2 className="text-xl font-semibold">Balances</h2>
          <ul aria-label="Group balances" className="mt-4 divide-y divide-slate-200">
            {detail.data.members.map((member) => {
              const balance = balances.data.balances.find((entry) => entry.username === member.username);
              const paid = formatBalanceAmount(balance?.paid ?? "0.00");
              const share = formatBalanceAmount(balance?.share ?? "0.00");
              const satang = parseBalanceAmount(balance?.balance ?? "0.00");
              const status = satang > 0 ? "owed" : satang < 0 ? "owes" : "settled";
              const amount = formatSatang(Math.abs(satang));
              const signedAmount = satang > 0 ? `+${amount}` : satang < 0 ? `-${amount}` : amount;
              return (
                <li key={member.username} aria-label={`${member.username} balance: ${status} ${amount}`} className="flex flex-wrap justify-between gap-2 py-3">
                  <span className="font-medium">{member.username}</span>
                  <span>{status === "settled" ? "Settled" : `${status === "owed" ? "Owed" : "Owes"} ${signedAmount}`}</span>
                  <span className="w-full text-sm text-slate-600">Paid: {paid} · Share: {share}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      {groupId && expenses.isError ? <p role="alert" className="mt-5">Could not load expenses.</p> : null}
      {groupId && expenses.isSuccess ? <ExpenseList key={`${username}-${groupId}`} expenses={expenses.data} username={username} groupId={Number(groupId)} /> : null}
      {detail.data && groupId ? <ExpenseForm key={`${username}-${groupId}`} username={username} groupId={Number(groupId)} members={detail.data.members.map((member) => member.username)} /> : null}
    </main>
  );
}
function parseBalanceAmount(value: string): number {
  const negative = value.startsWith("-");
  const satang = parseSatang(negative ? value.slice(1) : value);
  if (satang === null) throw new Error("Invalid balance amount.");
  return negative ? -satang : satang;
}

function formatBalanceAmount(value: string): string {
  return formatSatang(parseBalanceAmount(value));
}
