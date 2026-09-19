import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { OutcomeChip } from "@/components/outcome-chip";
import { SimulateFollowUp } from "@/components/student/follow-up";

beforeEach(() => {
  window.localStorage.setItem("sickday.demoSessionToken", `${"a".repeat(32)}.signature`);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

test("takes two taps and sends a literal simulated: true", async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ encounterId: "enc-1", followUp: {} }));
  vi.stubGlobal("fetch", fetchMock);
  render(<SimulateFollowUp encounterId="enc-1" />);

  fireEvent.click(screen.getByRole("button", { name: "Simulate follow-up" }));
  expect(fetchMock).not.toHaveBeenCalled();
  expect(screen.getByText(/A made-up self-report for the demo/)).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Picked it up · feeling better" }));

  await waitFor(() => expect(screen.getByRole("button", { name: "Simulate follow-up" })).toBeDefined());
  const [path, init] = fetchMock.mock.calls[0];
  expect(path).toBe("/api/encounters/enc-1/followup");
  expect(JSON.parse(init.body)).toEqual({ simulated: true, filled: true, symptomStatus: "improving" });
});

test("says nothing changed when recording fails", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "packet_required" }, { status: 409 })));
  render(<SimulateFollowUp encounterId="enc-1" />);

  fireEvent.click(screen.getByRole("button", { name: "Simulate follow-up" }));
  fireEvent.click(screen.getByRole("button", { name: "Did not pick it up · feeling worse" }));

  expect((await screen.findByRole("alert")).textContent).toContain("Nothing was changed");
});

test("the outcome chip always carries the simulated label and makes no fulfilment claim", () => {
  const { container } = render(<OutcomeChip followUp={{ simulated: true, filled: true, symptomStatus: "improving" }} />);

  expect(screen.getByText("Simulated self-report")).toBeDefined();
  expect(container.textContent).toContain("Says they picked it up");
  expect(container.textContent).not.toMatch(/filled|dispensed|verified|confirmed|recovered|cured/i);
});
