import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
