import type { GroupBalancesResponse } from "../expenses/api";
import type { GroupDetail } from "./api";
import { formatMoney } from "../../lib/money";

export function GroupBalances({ members, balances }: { members: GroupDetail["members"]; balances: GroupBalancesResponse["balances"] }) {
  return (
    <section aria-label="Group balances" className="mt-8 rounded border border-slate-200 p-5">
      <h2 className="text-xl font-semibold">Balances</h2>
      <ul aria-label="Group balances" className="mt-4 divide-y divide-slate-200">
        {members.map((member) => {
          const balance = balances.find((entry) => entry.username === member.username);
          const paid = formatMoney(balance?.paid ?? "0.00");
          const share = formatMoney(balance?.share ?? "0.00");
          const balanceValue = balance?.balance ?? "0.00";
          const isZero = /^-?0+\.00$/.test(balanceValue);
          const isNegative = balanceValue.startsWith("-");
          const status = isZero ? "settled" : isNegative ? "owes" : "owed";
          const amount = formatMoney(isNegative ? balanceValue.slice(1) : balanceValue);
          const signedAmount = isZero ? amount : `${isNegative ? "-" : "+"}${amount}`;
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
  );
}
