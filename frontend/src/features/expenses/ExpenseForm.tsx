"use client";

import { useExpenseForm, type ExpenseFormProps } from "./useExpenseForm";
import { formatSatang } from "../../lib/money";

export function ExpenseForm({ username, groupId, members }: ExpenseFormProps) {
  const { form, values, splitMembers, toggleSplitMember, equalPreview, unallocated, feedback, submit } = useExpenseForm({ username, groupId, members });
  const { register, handleSubmit, formState: { errors, isValid, isSubmitting } } = form;
  const splitType = values.splitType;
  return (
    <form onSubmit={handleSubmit(submit)} noValidate aria-label="Record expense" className="mt-8 space-y-5 rounded border border-slate-200 p-5">
      <h2 className="text-xl font-semibold">Record an expense</h2>
      <div>
        <label htmlFor="expense-description" className="mb-1 block font-medium">Description</label>
        <input id="expense-description" {...register("description")} className="min-h-11 w-full rounded border border-slate-400 px-3" />
        {errors.description ? <p role="alert">{errors.description.message}</p> : null}
      </div>
      <div>
        <label htmlFor="expense-amount" className="mb-1 block font-medium">Amount</label>
        <input id="expense-amount" inputMode="decimal" {...register("amount")} className="min-h-11 w-full rounded border border-slate-400 px-3" />
        {errors.amount ? <p role="alert">{errors.amount.message}</p> : null}
      </div>
      <div>
        <label htmlFor="expense-payer" className="mb-1 block font-medium">Payer</label>
        <select id="expense-payer" {...register("paid_by")} className="min-h-11 w-full rounded border border-slate-400 bg-white px-3">
          {members.map((member) => <option key={member} value={member}>{member}</option>)}
        </select>
        {errors.paid_by ? <p role="alert">{errors.paid_by.message}</p> : null}
      </div>
      <fieldset>
        <legend className="font-medium">Split type</legend>
        <label className="mr-4 inline-flex min-h-11 items-center gap-2">
          <input type="radio" value="equal" {...register("splitType")} />Equal split
        </label>
        <label className="inline-flex min-h-11 items-center gap-2">
          <input type="radio" value="exact" {...register("splitType")} />Exact split
        </label>
      </fieldset>
      <fieldset>
        <legend className="font-medium">Split members{splitType === "exact" ? " and exact shares" : ""}</legend>
        <div className="mt-2 space-y-3">
          {members.map((member) => {
            const checked = splitMembers.includes(member);
            return <div key={member} className="grid gap-2 sm:grid-cols-2 sm:items-center">
              <label className="flex min-h-11 items-center gap-2"><input type="checkbox" value={member} checked={checked} onChange={() => toggleSplitMember(member)} />{member}</label>
              {checked && splitType === "exact" ? <div>
                <label htmlFor={`share-${member}`} className="mb-1 block">{member} share</label>
                <input id={`share-${member}`} inputMode="decimal" {...register(`shares.${member}`)} className="min-h-11 w-full rounded border border-slate-400 px-3" />
                {errors.shares?.[member] ? <p role="alert">{errors.shares[member]?.message}</p> : null}
              </div> : null}
            </div>;
          })}
        </div>
        {errors.splitMembers ? <p role="alert">{errors.splitMembers.message}</p> : null}
        {splitType === "exact" && typeof errors.shares?.message === "string" ? <p role="alert">{errors.shares.message}</p> : null}
      </fieldset>
      {splitType === "equal" ? <ul aria-label="Equal split preview" aria-live="polite">
        {equalPreview.map(({ member, satang }) => <li key={member}>{member}: {formatSatang(satang)}</li>)}
      </ul> : <p aria-live="polite">Unallocated: {unallocated === null ? "—" : formatSatang(unallocated)}</p>}
      {feedback ? <p role={feedback.kind === "error" ? "alert" : "status"}>{feedback.message}</p> : null}
      <button type="submit" disabled={!isValid || isSubmitting} className="min-h-11 rounded bg-slate-900 px-4 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
        {isSubmitting ? "Recording…" : "Record expense"}
      </button>
    </form>
  );
}
