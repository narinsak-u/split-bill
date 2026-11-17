import { expect, test } from "@playwright/test";

test("records an equal expense and validates exact shares", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("combobox", { name: "Group" }).selectOption({ label: "Chiang Mai trip" });
  await expect(page.getByRole("heading", { name: "Chiang Mai trip" })).toBeVisible();

  const form = page.getByRole("form", { name: "Record expense" });
  await form.getByLabel("Description").fill("Shared dinner");
  await form.getByLabel("Amount").fill("10.00");
  await form.getByRole("radio", { name: "Equal split" }).check();
  for (const member of ["alice", "bob", "carol"]) {
    await form.getByRole("checkbox", { name: member }).check();
  }

  await expect(form.getByRole("list", { name: "Equal split preview" }).getByRole("listitem")).toHaveText([
    "alice: 3.34",
    "bob: 3.33",
    "carol: 3.33",
  ]);
  await form.getByRole("button", { name: "Record expense" }).click();

  const expense = page.getByRole("article", { name: "Expense: Shared dinner" });
  await expect(expense).toBeVisible();
  await expect(expense.getByRole("list", { name: "Shares for Shared dinner" }).getByRole("listitem")).toHaveText([
    "alice: 3.34",
    "bob: 3.33",
    "carol: 3.33",
  ]);
  const balances = page.getByRole("list", { name: "Group balances" });
  await expect(balances.getByRole("listitem", { name: "alice balance: owed 6.66" })).toBeVisible();
  await expect(balances.getByRole("listitem", { name: "bob balance: owes 3.33" })).toBeVisible();
  await expect(balances.getByRole("listitem", { name: "carol balance: owes 3.33" })).toBeVisible();

  await form.getByRole("radio", { name: "Exact split" }).check();
  await form.getByLabel("alice share").fill("3.34");
  await form.getByLabel("bob share").fill("3.33");
  await form.getByLabel("carol share").fill("3.32");
  const submit = form.getByRole("button", { name: "Record expense" });
  await expect(submit).toBeDisabled();
  await form.getByLabel("carol share").fill("3.33");
  await expect(submit).toBeEnabled();
});
