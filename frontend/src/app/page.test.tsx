import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import SplitBillPage from "./page";
import { QueryProvider } from "./providers";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderPage() {
  return render(
    <QueryProvider>
      <SplitBillPage />
    </QueryProvider>,
  );
}

describe("group selection", () => {
  it("filters by selected user and clears the prior group when identity changes", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const user = (init?.headers as Record<string, string>)["X-User"];
      if (url.endsWith("/groups/1")) {
        return { ok: true, json: async () => ({ id: 1, name: "Chiang Mai trip", members: [{ username: "alice" }, { username: "bob" }, { username: "carol" }] }) } as Response;
      }
      if (url.endsWith("/groups")) {
        const groups = {
          alice: [{ id: 1, name: "Chiang Mai trip" }],
          bob: [{ id: 1, name: "Chiang Mai trip" }, { id: 2, name: "Office lunch" }],
          dan: [{ id: 2, name: "Office lunch" }],
        };
        return { ok: true, json: async () => ({ groups: groups[user as keyof typeof groups] ?? [] }) } as Response;
      }
      throw new Error(`Unexpected request: ${url}`);
    }));

    renderPage();
    await screen.findByRole("option", { name: "Chiang Mai trip" });
    expect(screen.queryByRole("option", { name: "Office lunch" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Group"), { target: { value: "1" } });
    expect(await screen.findByText("alice, bob, carol")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("User"), { target: { value: "bob" } });
    await screen.findByRole("option", { name: "Office lunch" });
    expect(screen.getByRole("option", { name: "Chiang Mai trip" })).toBeInTheDocument();
    expect(screen.getByLabelText("Group")).toHaveValue("");
    expect(screen.queryByText("alice, bob, carol")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Group"), { target: { value: "1" } });
    expect(await screen.findByText("alice, bob, carol")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("User"), { target: { value: "dan" } });
    await screen.findByRole("option", { name: "Office lunch" });

    expect(screen.queryByRole("option", { name: "Chiang Mai trip" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Group")).toHaveValue("");
    expect(screen.queryByText("alice, bob, carol")).not.toBeInTheDocument();
  });
  it("shows stored expense history and exact shares scoped to the selected user and group", async () => {
    const requests: { url: string; user: string }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const user = (init?.headers as Record<string, string>)["X-User"];
      requests.push({ url, user });
      if (url.endsWith("/groups")) return { ok: true, json: async () => ({ groups: [{ id: 1, name: "Trip" }] }) } as Response;
      if (url.endsWith("/groups/1")) return { ok: true, json: async () => ({ id: 1, name: "Trip", members: [{ username: "alice" }, { username: "bob" }] }) } as Response;
      if (url.endsWith("/groups/1/expenses")) {
        return { ok: true, json: async () => user === "alice" ? ({ expenses: [{
          id: 7, group_id: 1, description: "Dinner", paid_by: "alice", amount: "30.00",
          split: { type: "exact", shares: [{ username: "bob", amount: "12.34" }, { username: "alice", amount: "17.66" }] },
          created_at: "2025-02-03T12:30:00Z", deleted_at: null,
        }] }) : ({ expenses: [] }) } as Response;
      }
      throw new Error(`Unexpected request: ${url}`);
    }));

    renderPage();
    await screen.findByRole("option", { name: "Trip" });
    fireEvent.change(screen.getByLabelText("Group"), { target: { value: "1" } });
    expect(await screen.findByText("Dinner")).toBeInTheDocument();
    expect(screen.getByText("30.00")).toBeInTheDocument();
    expect(screen.getByText("bob: 12.34")).toBeInTheDocument();
    expect(screen.getByText("alice: 17.66")).toBeInTheDocument();
    expect(within(screen.getByRole("article", { name: "Expense: Dinner" })).getByText(/exact/i)).toBeInTheDocument();
    expect(screen.getByText(/\b2025\b/)).toBeInTheDocument();
    expect(requests).toContainEqual({ url: expect.stringMatching(/\/groups\/1\/expenses$/), user: "alice" });

    fireEvent.change(screen.getByLabelText("User"), { target: { value: "bob" } });
    await screen.findByRole("option", { name: "Trip" });
    expect(screen.queryByText("Dinner")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Group"), { target: { value: "1" } });
    expect(await screen.findByText("No expenses recorded for this group.")).toBeInTheDocument();
    expect(screen.queryByText("Dinner")).not.toBeInTheDocument();
    expect(requests).toContainEqual({ url: expect.stringMatching(/\/groups\/1\/expenses$/), user: "bob" });
  });

  it("shows expense API errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/groups")) return { ok: true, json: async () => ({ groups: [{ id: 1, name: "Trip" }] }) } as Response;
      if (url.endsWith("/groups/1")) return { ok: true, json: async () => ({ id: 1, name: "Trip", members: [] }) } as Response;
      if (url.endsWith("/groups/1/expenses")) return { ok: false, json: async () => ({}) } as Response;
      throw new Error(`Unexpected request: ${url}`);
    }));

    renderPage();
    await screen.findByRole("option", { name: "Trip" });
    fireEvent.change(screen.getByLabelText("Group"), { target: { value: "1" } });
    expect(await screen.findByText("Could not load expenses.")).toBeInTheDocument();
  });

  it("shows expense network errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/groups")) return { ok: true, json: async () => ({ groups: [{ id: 1, name: "Trip" }] }) } as Response;
      if (url.endsWith("/groups/1")) return { ok: true, json: async () => ({ id: 1, name: "Trip", members: [] }) } as Response;
      if (url.endsWith("/groups/1/expenses")) throw new Error("offline");
      throw new Error(`Unexpected request: ${url}`);
    }));

    renderPage();
    await screen.findByRole("option", { name: "Trip" });
    fireEvent.change(screen.getByLabelText("Group"), { target: { value: "1" } });
    expect(await screen.findByText("Could not load expenses.")).toBeInTheDocument();

  });
  it("shows expense loading and updates history when group changes", async () => {
    const { promise: pendingExpenses, resolve: resolveExpenses } = Promise.withResolvers<Response>();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/groups")) return { ok: true, json: async () => ({ groups: [{ id: 1, name: "Trip" }, { id: 2, name: "Lunch" }] }) } as Response;
      if (/\/groups\/[12]$/.test(url)) {
        const id = Number(url.split("/").at(-1));
        return { ok: true, json: async () => ({ id, name: id === 1 ? "Trip" : "Lunch", members: [] }) } as Response;
      }
      if (url.endsWith("/groups/1/expenses")) {
        return pendingExpenses;
      }
      if (url.endsWith("/groups/2/expenses")) {
        return { ok: true, json: async () => ({ expenses: [{
          id: 8, group_id: 2, description: "Lunch", paid_by: "alice", amount: "12.00",
          split: { type: "equal", shares: [{ username: "alice", amount: "12.00" }] },
          created_at: "2025-02-04T12:30:00Z", deleted_at: null,
        }] }) } as Response;
      }
      throw new Error(`Unexpected request: ${url}`);
    }));

    renderPage();
    await screen.findByRole("option", { name: "Trip" });
    fireEvent.change(screen.getByLabelText("Group"), { target: { value: "1" } });
    expect(await screen.findByText("Loading expenses…")).toBeInTheDocument();
    resolveExpenses({ ok: true, json: async () => ({ expenses: [] }) } as Response);
    expect(await screen.findByText("No expenses recorded for this group.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Group"), { target: { value: "2" } });
    expect(await screen.findByText("Lunch", { selector: "h3" })).toBeInTheDocument();
  });
  it("shows empty groups and API failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.headers as Record<string, string>)["X-User"] === "carol") {
        return { ok: true, json: async () => ({ groups: [] }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }));

    renderPage();
    await screen.findByText("Could not load groups.");
    fireEvent.change(screen.getByLabelText("User"), { target: { value: "carol" } });
    await screen.findByText("No groups available.");
  });
});
describe("exact expense recording", () => {
  function mockExpenseApi(onCreate: (init: RequestInit) => Response | Promise<Response>) {
    const requests: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, init });
      if (url.endsWith("/groups")) return { ok: true, json: async () => ({ groups: [{ id: 1, name: "Trip" }] }) } as Response;
      if (url.endsWith("/groups/1")) return { ok: true, json: async () => ({ id: 1, name: "Trip", members: [{ username: "alice" }, { username: "bob" }] }) } as Response;
      if (url.endsWith("/groups/1/expenses") && init?.method === "POST") return onCreate(init);
      if (url.endsWith("/groups/1/expenses")) return { ok: true, json: async () => ({ expenses: [] }) } as Response;
      throw new Error(`Unexpected request: ${url}`);
    }));
    return requests;
  }

  async function showForm() {
    renderPage();
    await screen.findByRole("option", { name: "Trip" });
    fireEvent.change(screen.getByLabelText("Group"), { target: { value: "1" } });
    await screen.findByLabelText("Description");
  }

  function enterValidExpense() {
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Dinner" } });
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "10.00" } });
    fireEvent.change(screen.getByLabelText("Payer"), { target: { value: "alice" } });
    fireEvent.click(screen.getByLabelText("alice", { selector: "input[type=checkbox]" }));
  }

  it("keeps invalid exact totals disabled while accepting a zero share", async () => {
    mockExpenseApi(async () => ({ ok: true, json: async () => ({}) }) as Response);
    await showForm();
    enterValidExpense();
    expect(screen.getByRole("button", { name: "Record expense" })).toBeDisabled();
    expect(screen.getByText("Unallocated: 10.00")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("bob", { selector: "input[type=checkbox]" }));
    fireEvent.change(screen.getByLabelText("alice share"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("bob share"), { target: { value: "10.00" } });
    expect(screen.getByText("Unallocated: 0.00")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Record expense" })).toBeEnabled());
  });

  it("reuses a key for unchanged retries, then creates a new key after editing", async () => {
    const requests = mockExpenseApi(async (_init) => ({ ok: false, json: async () => ({ error: { code: "INTERNAL_SERVER_ERROR", message: "Try again." } }) }) as Response);
    await showForm();
    enterValidExpense();
    fireEvent.change(screen.getByLabelText("alice share"), { target: { value: "10.00" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Record expense" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Record expense" }));
    expect(await screen.findByText("Try again.")).toBeInTheDocument();
    const firstKey = (requests.find((request) => request.init?.method === "POST")?.init?.headers as Record<string, string>)["Idempotency-Key"];
    await waitFor(() => expect(screen.getByRole("button", { name: "Record expense" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Record expense" }));
    await waitFor(() => expect(requests.filter((request) => request.init?.method === "POST")).toHaveLength(2));
    const postRequests = requests.filter((request) => request.init?.method === "POST");
    expect((postRequests[1].init?.headers as Record<string, string>)["Idempotency-Key"]).toBe(firstKey);
    expect(screen.getByLabelText("Description")).toHaveValue("Dinner");

    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Lunch" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Record expense" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Record expense" }));
    await waitFor(() => expect(requests.filter((request) => request.init?.method === "POST")).toHaveLength(3));
    const changedKey = (requests.filter((request) => request.init?.method === "POST")[2].init?.headers as Record<string, string>)["Idempotency-Key"];
    expect(changedKey).not.toBe(firstKey);
  });

  it("posts exact JSON and invalidates expenses and balances after success", async () => {
    const requests = mockExpenseApi(async () => ({ ok: true, json: async () => ({ id: "550e8400-e29b-41d4-a716-446655440000" }) }) as Response);
    await showForm();
    enterValidExpense();
    fireEvent.change(screen.getByLabelText("alice share"), { target: { value: "10.00" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Record expense" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Record expense" }));
    expect(await screen.findByText("Expense recorded.")).toBeInTheDocument();
    const post = requests.find((request) => request.init?.method === "POST")!;
    expect(JSON.parse(String(post.init?.body))).toEqual({ description: "Dinner", paid_by: "alice", amount: "10.00", split: { type: "exact", shares: { alice: "10.00" } } });
    expect((post.init?.headers as Record<string, string>)["X-User"]).toBe("alice");
    expect((post.init?.headers as Record<string, string>)["Idempotency-Key"]).toBeTruthy();
    await waitFor(() => {
      expect(requests.filter((request) => request.url.endsWith("/groups/1/expenses") && !request.init?.method)).toHaveLength(2);
    });
  });

  it("preserves input and maps idempotency conflict errors", async () => {
    mockExpenseApi(async () => ({ ok: false, json: async () => ({ error: { code: "IDEMPOTENCY_CONFLICT", message: "This key was used for another expense." } }) }) as Response);
    await showForm();
    enterValidExpense();
    fireEvent.change(screen.getByLabelText("alice share"), { target: { value: "10.00" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Record expense" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Record expense" }));
    expect(await screen.findByText("This key was used for another expense.")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toHaveValue("Dinner");
    expect(screen.getByLabelText("alice share")).toHaveValue("10.00");
  });
  it("preserves input and reports network failure", async () => {
    const requests = mockExpenseApi(async () => { throw new Error("offline"); });
    await showForm();
    enterValidExpense();
    fireEvent.change(screen.getByLabelText("alice share"), { target: { value: "10.00" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Record expense" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Record expense" }));
    expect(await screen.findByText("offline")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Record expense" })).toBeEnabled());
    expect(screen.getByLabelText("Description")).toHaveValue("Dinner");
    fireEvent.click(screen.getByRole("button", { name: "Record expense" }));
    await waitFor(() => expect(requests.filter((request) => request.init?.method === "POST")).toHaveLength(2));
    const postRequests = requests.filter((request) => request.init?.method === "POST");
    expect((postRequests[0].init?.headers as Record<string, string>)["Idempotency-Key"]).toBe((postRequests[1].init?.headers as Record<string, string>)["Idempotency-Key"]);
  });
  it("clears expense inputs when the selected group changes", async () => {
    mockExpenseApi(async () => ({ ok: true, json: async () => ({}) }) as Response);
    await showForm();
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Draft" } });
    fireEvent.change(screen.getByLabelText("Group"), { target: { value: "" } });
    expect(screen.queryByLabelText("Description")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Group"), { target: { value: "1" } });
    await waitFor(() => expect(screen.getByLabelText("Description")).toHaveValue(""));
  });
});
