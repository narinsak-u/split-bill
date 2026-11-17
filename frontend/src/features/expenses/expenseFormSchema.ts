import { z } from "zod";
import { parseSatang } from "../../lib/money";

export function createFormSchema(members: string[]) {
  return z.object({
    description: z.string().trim().min(1, "Enter a description."),
    amount: z.string().refine((value) => (parseSatang(value) ?? 0) > 0, "Enter a valid positive amount."),
    paid_by: z.string().min(1, "Choose a payer."),
    splitType: z.enum(["equal", "exact"]),
    splitMembers: z.array(z.string()).min(1, "Choose at least one split member."),
    shares: z.record(z.string()),
  }).superRefine((values, context) => {
    if (!members.includes(values.paid_by)) context.addIssue({ code: "custom", path: ["paid_by"], message: "Choose a group member as payer." });
    if (new Set(values.splitMembers).size !== values.splitMembers.length || values.splitMembers.some((member) => !members.includes(member))) {
      context.addIssue({ code: "custom", path: ["splitMembers"], message: "Choose distinct group members." });
    }
    if (values.splitType !== "exact") return;
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
}

export type FormValues = {
  description: string;
  amount: string;
  paid_by: string;
  splitType: "equal" | "exact";
  splitMembers: string[];
  shares: Record<string, string>;
};
