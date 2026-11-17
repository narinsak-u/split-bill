import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ExpenseForm } from "./ExpenseForm";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ExpenseForm username="alice" groupId={1} members={["alice", "bob", "carol"]} />
    </QueryClientProvider>,
  );
}

function chooseEqual() {
  fireEvent.click(screen.getByRole("radio", { name: "Equal split" }));
}

function chooseMembers(...members: string[]) {
  for (const member of members) fireEvent.click(screen.getByRole("checkbox", { name: member }));
}

function chooseMembersNatively(...members: string[]) {
  for (const member of members) (screen.getByRole("checkbox", { name: member }) as HTMLInputElement).click();
}

function enterExpense(amount: string) {
  fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Dinner" } });
  fireEvent.change(screen.getByLabelText("Amount"), { target: { value: amount } });
}

describe("equal expense recording", () => {
  it("previews and submits three-way rounding in native selection order", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    chooseEqual();
    chooseMembersNatively("carol", "alice", "bob");
    fireEvent.change(screen.getByLabelText("Payer"), { target: { value: "bob" } });
    enterExpense("100.00");

    const preview = screen.getByLabelText("Equal split preview");
    expect(within(preview).getByText("carol: 33.34")).toBeTruthy();
    expect(within(preview).getByText("alice: 33.33")).toBeTruthy();
    expect(within(preview).getByText("bob: 33.33")).toBeTruthy();

    await waitFor(() => expect(screen.getByRole("button", { name: "Record expense" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Record expense" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      description: "Dinner",
      paid_by: "bob",
      amount: "100.00",
      split: { type: "equal", members: ["carol", "alice", "bob"] },
    });
    expect(await screen.findByText("Expense recorded.")).toBeTruthy();
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Record expense" })).toBeDisabled();
  });

  it("posts the native selection order that matches the remainder preview", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    chooseEqual();
    chooseMembersNatively("carol", "alice");
    fireEvent.change(screen.getByLabelText("Payer"), { target: { value: "bob" } });
    enterExpense("0.05");

    const preview = screen.getByLabelText("Equal split preview");
    expect(Array.from(preview.querySelectorAll("li"), (item) => item.textContent)).toEqual(["carol: 0.03", "alice: 0.02"]);
    await waitFor(() => expect(screen.getByRole("button", { name: "Record expense" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Record expense" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).split).toEqual({ type: "equal", members: ["carol", "alice"] });
  });

  it("allocates one satang by selected order and keeps empty selection disabled", async () => {
    renderForm();
    chooseEqual();
    enterExpense("0.01");
    expect(screen.getByRole("button", { name: "Record expense" })).toBeDisabled();

    chooseMembers("bob", "carol", "alice");
    const preview = screen.getByLabelText("Equal split preview");
    expect(within(preview).getByText("bob: 0.01")).toBeTruthy();
    expect(within(preview).getByText("carol: 0.00")).toBeTruthy();
    expect(within(preview).getByText("alice: 0.00")).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("button", { name: "Record expense" })).toBeEnabled());
    expect(screen.getByRole("button", { name: "Record expense" })).toBeEnabled();
  });

  it("reuses the idempotency key for an unchanged failed submission", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "Try again." } }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    chooseEqual();
    chooseMembers("alice", "bob");
    enterExpense("1.00");

    await waitFor(() => expect(screen.getByRole("button", { name: "Record expense" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Record expense" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Try again.");
    fireEvent.click(screen.getByRole("button", { name: "Record expense" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const firstHeaders = new Headers(fetchMock.mock.calls[0][1]?.headers);
    const retryHeaders = new Headers(fetchMock.mock.calls[1][1]?.headers);
    expect(retryHeaders.get("Idempotency-Key")).toBe(firstHeaders.get("Idempotency-Key"));
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body)).split).toEqual({ type: "equal", members: ["alice", "bob"] });
  });
});

describe("exact expense recording", () => {
  it("enables submission when exact fields become valid after selecting members", async () => {
    renderForm();
    chooseMembers("alice");
    enterExpense("1.00");
    fireEvent.change(screen.getByLabelText("alice share"), { target: { value: "1.00" } });

    await waitFor(() => expect(screen.getByRole("button", { name: "Record expense" })).toBeEnabled());
  });
});
