import { expect, test } from "@playwright/test";

test("only the payer can delete an expense and balances return to their prior state", async ({ page }) => {
  await page.goto("/");

  const user = page.getByRole("combobox", { name: "User" });
  const group = page.getByRole("combobox", { name: "Group" });
  await group.selectOption({ label: "Chiang Mai trip" });
  await expect(page.getByRole("heading", { name: "Chiang Mai trip" })).toBeVisible();

  const balances = page.getByRole("list", { name: "Group balances" }).getByRole("listitem");
  await expect(balances).toHaveCount(3);
  const originalBalances = await balances.allTextContents();
  const description = "Payer deletion check";
  const expense = page.getByRole("article", { name: `Expense: ${description}` });
  await expect(expense).toHaveCount(0);

  const form = page.getByRole("form", { name: "Record expense" });
  await form.getByRole("textbox", { name: "Description" }).fill(description);
  await form.getByRole("textbox", { name: "Amount" }).fill("10.00");
  await form.getByRole("radio", { name: "Equal split" }).check();
  for (const member of ["alice", "bob", "carol"]) {
    await form.getByRole("checkbox", { name: member }).check();
  }
  await form.getByRole("button", { name: "Record expense" }).click();

  await expect(expense).toBeVisible();
  await expect(expense).toContainText("Paid by");
  await expect(expense).toContainText("alice");
  await expect(balances).not.toHaveText(originalBalances);

  await user.selectOption("bob");
  await expect(group).toHaveValue("");
  await group.selectOption({ label: "Chiang Mai trip" });
  await expect(page.getByRole("heading", { name: "Chiang Mai trip" })).toBeVisible();
  const nonPayerExpense = page.getByRole("article", { name: `Expense: ${description}` });
  await expect(nonPayerExpense).toBeVisible();
  await expect(nonPayerExpense.getByRole("button", { name: `Delete ${description}` })).toHaveCount(0);

  await user.selectOption("alice");
  await expect(group).toHaveValue("");
  await group.selectOption({ label: "Chiang Mai trip" });
  await expect(page.getByRole("heading", { name: "Chiang Mai trip" })).toBeVisible();
  const payerExpense = page.getByRole("article", { name: `Expense: ${description}` });
  await payerExpense.getByRole("button", { name: `Delete ${description}` }).click();

  await expect(page.getByRole("status")).toHaveText("Expense deleted.");
  await expect(payerExpense).toHaveCount(0);
  await expect(balances).toHaveText(originalBalances);
  await page.reload();
  await group.selectOption({ label: "Chiang Mai trip" });
  await expect(page.getByRole("heading", { name: "Chiang Mai trip" })).toBeVisible();
  await expect(page.getByRole("article", { name: `Expense: ${description}` })).toHaveCount(0);
  await expect(balances).toHaveText(originalBalances);
});
