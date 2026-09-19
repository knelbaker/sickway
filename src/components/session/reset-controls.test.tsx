import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ResetDemoButton, SessionSupersededNotice } from "@/components/session/reset-controls";
import { StudentFlow } from "@/components/student/student-flow";
import { sampleDemoSessionResponse } from "@/lib/api-contracts";
import { apiFetch, getSessionToken } from "@/lib/client/session-store";

const OLD = `${"a".repeat(32)}.signature`;
const NEW = `${"b".repeat(32)}.signature`;
const KEY = "sickday.demoSessionToken";
const profile = {
  name: "Alex Demo",
  age: 20,
  planName: "Fictional Demo Out-of-State PPO",
  planMockLabel: "Mock coverage — not verified",
  instructionLanguages: ["en", "es"],
  costCeiling: 25,
  fixtureClock: "2026-09-19T10:00:00-04:00",
};

beforeEach(() => {
  window.localStorage.setItem(KEY, OLD);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

test("is hidden on a device that is not paired", () => {
  window.localStorage.clear();
  render(<ResetDemoButton />);

  expect(screen.queryByRole("button", { name: "Reset demo" })).toBeNull();
});

test("asks for confirmation and does nothing when the presenter keeps the session", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  render(<ResetDemoButton />);

  fireEvent.click(screen.getByRole("button", { name: "Reset demo" }));
  fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Keep this session" }));

  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(fetchMock).not.toHaveBeenCalled();
  expect(getSessionToken()).toBe(OLD);
});

test("on confirm, swaps to the new session token", async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ ...sampleDemoSessionResponse, token: NEW }, { status: 201 }));
  vi.stubGlobal("fetch", fetchMock);
  render(<ResetDemoButton />);

  fireEvent.click(screen.getByRole("button", { name: "Reset demo" }));
  fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Reset demo" }));

  await waitFor(() => expect(getSessionToken()).toBe(NEW));
  const [path, init] = fetchMock.mock.calls[0];
  expect(path).toBe("/api/demo-session/reset");
  expect(new Headers(init.headers).get("x-demo-session")).toBe(OLD);
});

test("keeps the session and says so when the reset fails", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "reset_unavailable" }, { status: 503 })));
  render(<ResetDemoButton />);

  fireEvent.click(screen.getByRole("button", { name: "Reset demo" }));
  fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Reset demo" }));

  expect((await screen.findByRole("alert")).textContent).toContain("Nothing was changed");
  expect(getSessionToken()).toBe(OLD);
});

test("the paired device is prompted once its session is superseded, and joins in one tap", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "session_superseded", joinToken: NEW }, { status: 409 })));
  render(<SessionSupersededNotice />);
  expect(screen.queryByText("The demo was reset on the other device")).toBeNull();

  await act(async () => void (await apiFetch("/api/encounters")));
  fireEvent.click(await screen.findByRole("button", { name: "Join the new session" }));

  expect(getSessionToken()).toBe(NEW);
  await waitFor(() => expect(screen.queryByText("The demo was reset on the other device")).toBeNull());
});

test("a new session clears the student screen: no draft, no previous status, consent unticked", async () => {
  window.sessionStorage.setItem(`sickday.submitted.${"a".repeat(32)}`, JSON.stringify({ encounterId: "e1", status: "ready" }));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "unavailable" }, { status: 503 })));
  render(<StudentFlow profile={profile} />);
  expect(screen.getByText("Shared with the demo clinic")).toBeDefined();

  act(() => {
    window.localStorage.setItem(KEY, NEW);
    window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
  });

  await waitFor(() => expect(screen.queryByText("Shared with the demo clinic")).toBeNull());
  expect((screen.getByLabelText("What is going on today?") as HTMLTextAreaElement).value).toBe("");
  expect(screen.queryByRole("checkbox", { name: /I agree to share/ })).toBeNull();
});
