"use client";

import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { createExpense } from "./api";
import { formatSatang, parseSatang } from "../../lib/money";

const formSchema = z.object({
  description: z.string().trim().min(1, "Enter a description."),
  amount: z.string().refine((value) => (parseSatang(value) ?? 0) > 0, "Enter a valid positive amount."),
  paid_by: z.string().min(1, "Choose a payer."),
  splitMembers: z.array(z.string()).min(1, "Choose at least one split member."),
  shares: z.record(z.string()),
}).superRefine((values, context) => {
  const total = parseSatang(values.amount);
  if (total === null || total <= 0) return;
  let allocated = 0;
  for (const username of values.splitMembers) {
    const share = parseSatang(values.shares[username] ?? "");
    if (share === null || share < 0) {
      context.addIssue({ code: "custom", path: ["shares", username], message: "Enter a valid non-negative share." });
      continue;
    }
    allocated += share;
  }
  if (allocated !== total) context.addIssue({ code: "custom", path: ["shares"], message: "Shares must add up to the expense amount." });
});

type FormValues = z.infer<typeof formSchema>;
type Attempt = { signature: string; key: string };

export function ExpenseForm({ username, groupId, members }: { username: string; groupId: number; members: string[] }) {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const attempt = useRef<Attempt | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: { description: "", amount: "", paid_by: members[0] ?? "", splitMembers: [], shares: Object.fromEntries(members.map((member) => [member, ""])) },
  });
  const { register, handleSubmit, watch, setValue, reset, formState: { errors, isValid, isSubmitting } } = form;
  const amount = watch("amount");
  const splitMembers = watch("splitMembers");
  const shares = watch("shares");

  useEffect(() => watch((values) => {
    if (attempt.current && JSON.stringify(values) !== attempt.current.signature) attempt.current = null;
    setFeedback(null);
  }).unsubscribe, [watch]);

  const totalSatang = parseSatang(amount ?? "");
  const allocatedSatang = (splitMembers ?? []).reduce((sum, member) => sum + (parseSatang(shares?.[member] ?? "") ?? 0), 0);
  const unallocated = totalSatang === null ? null : totalSatang - allocatedSatang;

  async function submit(values: FormValues) {
    const payload = {
      description: values.description.trim(),
      paid_by: values.paid_by,
      amount: values.amount,
      split: { type: "exact" as const, shares: Object.fromEntries(values.splitMembers.map((member) => [member, values.shares[member]])) },
    };
    const signature = JSON.stringify(values);
    if (!attempt.current || attempt.current.signature !== signature) attempt.current = { signature, key: crypto.randomUUID() };
    setFeedback(null);
    try {
      await createExpense(username, groupId, attempt.current.key, payload);
      attempt.current = null;
      reset({ description: "", amount: "", paid_by: members[0] ?? "", splitMembers: [], shares: Object.fromEntries(members.map((member) => [member, ""])) });
      setFeedback({ kind: "success", message: "Expense recorded." });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["expenses", username, String(groupId)] }),
        queryClient.invalidateQueries({ queryKey: ["balances", username, String(groupId)] }),
      ]);
    } catch (error) {
      setFeedback({ kind: "error", message: error instanceof Error ? error.message : "Could not record expense." });
    }
  }

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
        <legend className="font-medium">Split members and exact shares</legend>
        <div className="mt-2 space-y-3">
          {members.map((member) => {
            const checked = splitMembers?.includes(member) ?? false;
            return <div key={member} className="grid gap-2 sm:grid-cols-2 sm:items-center">
              <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={checked} onChange={(event) => setValue("splitMembers", event.target.checked ? [...(splitMembers ?? []), member] : (splitMembers ?? []).filter((item) => item !== member), { shouldValidate: true, shouldDirty: true })} />{member}</label>
              {checked ? <div>
                <label htmlFor={`share-${member}`} className="mb-1 block">{member} share</label>
                <input id={`share-${member}`} inputMode="decimal" {...register(`shares.${member}`)} className="min-h-11 w-full rounded border border-slate-400 px-3" />
                {errors.shares?.[member] ? <p role="alert">{errors.shares[member]?.message}</p> : null}
              </div> : null}
            </div>;
          })}
        </div>
        {errors.splitMembers ? <p role="alert">{errors.splitMembers.message}</p> : null}
        {errors.shares?.message ? <p role="alert">{errors.shares.message}</p> : null}
      </fieldset>
      <p aria-live="polite">Unallocated: {unallocated === null ? "—" : formatSatang(unallocated)}</p>
      {feedback ? <p role={feedback.kind === "error" ? "alert" : "status"}>{feedback.message}</p> : null}
      <button type="submit" disabled={!isValid || isSubmitting} className="min-h-11 rounded bg-slate-900 px-4 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
        {isSubmitting ? "Recording…" : "Record expense"}
      </button>
    </form>
  );
}
