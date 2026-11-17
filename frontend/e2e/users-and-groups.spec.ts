import { expect, test } from "@playwright/test";

test("shows groups for the selected requester", async ({ page }) => {
  await page.goto("/");

  const user = page.getByRole("combobox", { name: "User" });
  const group = page.getByRole("combobox", { name: "Group" });
  await expect(group).toBeEnabled();
  await expect(group.getByRole("option", { name: "Chiang Mai trip" })).toBeAttached();
  await expect(group.getByRole("option", { name: "Office lunch" })).toHaveCount(0);

  await group.selectOption("1");
  await expect(page.getByRole("heading", { name: "Chiang Mai trip" })).toBeVisible();
  await expect(page.getByText("alice, bob, carol")).toBeVisible();

  await user.selectOption("dan");
  await expect(group).toHaveValue("");
  await expect(group).toBeEnabled();
  await expect(group.getByRole("option", { name: "Office lunch" })).toBeAttached();
  await expect(group.getByRole("option", { name: "Chiang Mai trip" })).toHaveCount(0);

  await group.selectOption("2");
  await expect(page.getByRole("heading", { name: "Office lunch" })).toBeVisible();
  await expect(page.getByText("bob, dan")).toBeVisible();
});
