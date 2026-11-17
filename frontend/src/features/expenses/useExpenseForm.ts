import { useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { createExpense } from "./api";
import { createFormSchema, type FormValues } from "./expenseFormSchema";
import { parseSatang } from "../../lib/money";

type Attempt = { signature: string; key: string };
export type ExpenseFormProps = { username: string; groupId: number; members: string[] };

export function useExpenseForm({ username, groupId, members }: ExpenseFormProps) {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const attempt = useRef<Attempt | null>(null);
  const resetSignature = useRef<string | null>(null);
  const membersSignature = JSON.stringify(members);
  const schema = useMemo(() => createFormSchema(JSON.parse(membersSignature) as string[]), [membersSignature]);
  const resolver = useMemo(() => zodResolver(schema), [schema]);
  const form = useForm<FormValues>({
    resolver,
    mode: "onSubmit",
    defaultValues: { description: "", amount: "", paid_by: members[0] ?? "", splitType: "exact", splitMembers: [], shares: Object.fromEntries(members.map((member) => [member, ""])) },
  });
  const { watch, reset, trigger } = form;
  const values = watch();
  const amount = values.amount;
  const splitMembers = values.splitMembers ?? [];
  const shares = values.shares;

  useEffect(() => watch((values) => {
    const signature = JSON.stringify(values);
    if (resetSignature.current === signature) {
      resetSignature.current = null;
      return;
    }
    resetSignature.current = null;
    if (attempt.current && signature !== attempt.current.signature) attempt.current = null;
    setFeedback(null);
    void trigger();
  }).unsubscribe, [trigger, watch]);

  const totalSatang = parseSatang(amount ?? "");
  const allocatedSatang = splitMembers.reduce((sum, member) => sum + (parseSatang(shares?.[member] ?? "") ?? 0), 0);
  const unallocated = totalSatang === null ? null : totalSatang - allocatedSatang;
  const equalPreview = totalSatang !== null && splitMembers.length
    ? splitMembers.map((member, index) => ({
        member,
        satang: Math.floor(totalSatang / splitMembers.length) + (index < totalSatang % splitMembers.length ? 1 : 0),
      }))
    : [];

  function toggleSplitMember(member: string) {
    const selected = form.getValues("splitMembers");
    form.setValue("splitMembers", selected.includes(member) ? selected.filter((name) => name !== member) : [...selected, member], { shouldDirty: true });
  }

  async function submit(values: FormValues) {
    const payload = {
      description: values.description.trim(),
      paid_by: values.paid_by,
      amount: values.amount,
      split: values.splitType === "equal"
        ? { type: "equal" as const, members: values.splitMembers }
        : { type: "exact" as const, shares: Object.fromEntries(values.splitMembers.map((member) => [member, values.shares[member]])) },
    };
    const signature = JSON.stringify(values);
    if (!attempt.current || attempt.current.signature !== signature) attempt.current = { signature, key: crypto.randomUUID() };
    setFeedback(null);
    try {
      await createExpense(username, groupId, attempt.current.key, payload);
      attempt.current = null;
      const clearedValues = { description: "", amount: "", paid_by: members[0] ?? "", splitType: "exact" as const, splitMembers: [], shares: Object.fromEntries(members.map((member) => [member, ""])) };
      resetSignature.current = JSON.stringify(clearedValues);
      reset(clearedValues);
      setFeedback({ kind: "success", message: "Expense recorded." });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["expenses", username, String(groupId)] }),
        queryClient.invalidateQueries({ queryKey: ["balances", username, String(groupId)] }),
      ]);
    } catch (error) {
      setFeedback({ kind: "error", message: error instanceof Error ? error.message : "Could not record expense." });
    }
  }

  return { form, values, splitMembers, toggleSplitMember, equalPreview, unallocated, feedback, submit };
}
