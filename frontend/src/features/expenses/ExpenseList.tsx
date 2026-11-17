import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteExpense, type Expense } from "./api";

export function ExpenseList({ expenses, username, groupId }: { expenses: Expense[]; username: string; groupId: number }) {
  const queryClient = useQueryClient();
  const deletion = useMutation({
    mutationFn: (expenseId: string) => deleteExpense(username, groupId, expenseId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["expenses", username, String(groupId)] }),
        queryClient.invalidateQueries({ queryKey: ["balances", username, String(groupId)] }),
      ]);
    },
  });
  const feedback = deletion.isSuccess
    ? <p role="status">Expense deleted.</p>
    : deletion.isError
      ? <p role="alert">{deletion.error.message}</p>
      : null;

  if (expenses.length === 0) return <>{feedback}<p>No expenses recorded for this group.</p></>;

  return (
    <>
      {feedback}
      <ul aria-label="Expense history" className="mt-4 space-y-4">
        {expenses.map((expense) => (
          <li key={expense.id}>
            <article aria-label={`Expense: ${expense.description}`} className="rounded border border-slate-200 bg-white p-4">
              <h3 className="text-lg font-semibold">{expense.description}</h3>
              <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="font-medium">Paid by</dt>
                  <dd>{expense.paid_by}</dd>
                </div>
                <div>
                  <dt className="font-medium">Amount</dt>
                  <dd>{expense.amount}</dd>
                </div>
                <div>
                  <dt className="font-medium">Date</dt>
                  <dd>{new Date(expense.created_at).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="font-medium">Split type</dt>
                  <dd>{expense.split.type}</dd>
                </div>
              </dl>
              <h4 className="mt-3 font-medium">Shares</h4>
              <ul aria-label={`Shares for ${expense.description}`} className="mt-1">
                {expense.split.shares.map((share) => (
                  <li key={share.username}>{share.username}: {share.amount}</li>
                ))}
              </ul>
              {expense.paid_by === username ? (
                <button
                  type="button"
                  className="mt-3 min-h-11 rounded border border-red-700 px-3 text-red-800 disabled:opacity-60"
                  disabled={deletion.isPending}
                  onClick={() => deletion.mutate(expense.id)}
                >
                  {deletion.isPending && deletion.variables === expense.id ? "Deleting…" : `Delete ${expense.description}`}
                </button>
              ) : null}
            </article>
          </li>
        ))}
      </ul>
    </>
  );
}
