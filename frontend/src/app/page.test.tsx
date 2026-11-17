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
        return { ok: true, json: async () => ({ id: 1, name: "Chiang Mai trip", members: [{ username: "alice" }, { username: "bob" }] }) } as Response;
      }
      if (url.endsWith("/groups")) {
        return { ok: true, json: async () => ({ groups: user === "alice" ? [{ id: 1, name: "Chiang Mai trip" }] : [{ id: 2, name: "Office lunch" }] }) } as Response;
      }
      throw new Error(`Unexpected request: ${url}`);
    }));

    renderPage();
    await screen.findByRole("option", { name: "Chiang Mai trip" });
    fireEvent.change(screen.getByLabelText("Group"), { target: { value: "1" } });
    expect(await screen.findByText("alice, bob")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("User"), { target: { value: "bob" } });
    await screen.findByRole("option", { name: "Office lunch" });

    expect(screen.queryByText("alice, bob")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Group")).toHaveValue("");
    expect(screen.queryByRole("option", { name: "Chiang Mai trip" })).not.toBeInTheDocument();
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
