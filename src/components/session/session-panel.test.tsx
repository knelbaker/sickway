import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { SessionPanel } from "@/components/session/session-panel";
import { sampleDemoSessionResponse } from "@/lib/api-contracts";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("starts a session, stores the token, and shows the join link and role screens", async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json(sampleDemoSessionResponse, { status: 201 }));
  vi.stubGlobal("fetch", fetchMock);
  render(<SessionPanel />);

  fireEvent.click(await screen.findByRole("button", { name: "Start demo session" }));

  const joinLink = (await screen.findByLabelText("Join link for the second device")) as HTMLInputElement;
  expect(joinLink.value).toBe(
    `${window.location.origin}/join?t=${encodeURIComponent(sampleDemoSessionResponse.token)}`,
  );
  expect(window.localStorage.getItem("sickday.demoSessionToken")).toBe(sampleDemoSessionResponse.token);
  expect(screen.getByRole("link", { name: "Student screen" }).getAttribute("href")).toBe("/s");
  expect(screen.getByRole("link", { name: "Clinician screen" }).getAttribute("href")).toBe("/hcp");
  expect(fetchMock).toHaveBeenCalledWith("/api/demo-session", expect.objectContaining({ method: "POST" }));
});

test("shows an error and stays unpaired when the session cannot be created", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "session_unavailable" }, { status: 503 })));
  render(<SessionPanel />);

  fireEvent.click(await screen.findByRole("button", { name: "Start demo session" }));

  await waitFor(() => expect(screen.getByText("Session not started")).toBeDefined());
  expect(window.localStorage.getItem("sickday.demoSessionToken")).toBeNull();
  expect(screen.queryByLabelText("Join link for the second device")).toBeNull();
});

test("resumes an existing session after a refresh", async () => {
  window.localStorage.setItem("sickday.demoSessionToken", sampleDemoSessionResponse.token);
  render(<SessionPanel />);

  expect(await screen.findByLabelText("Join link for the second device")).toBeDefined();
  expect(screen.queryByRole("button", { name: "Start demo session" })).toBeNull();
});
