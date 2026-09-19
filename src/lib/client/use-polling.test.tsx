import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { z } from "zod";
import { usePolling } from "@/lib/client/use-polling";

const schema = z.object({ n: z.number() });

function Probe({ path }: { path: string | null }) {
  const { data, error } = usePolling(path, schema);
  return <p>{error ? `error:${error}` : data ? `n=${data.n}` : "loading"}</p>;
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event("visibilitychange"));
}

let calls: number;
let respond: () => Response;

beforeEach(() => {
  vi.useFakeTimers();
  calls = 0;
  respond = () => Response.json({ n: calls });
  vi.stubGlobal("fetch", vi.fn(async () => (calls++, respond())));
  window.localStorage.setItem("sickday.demoSessionToken", "session.token");
  setHidden(false);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

const tick = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

test("fetches immediately and then every two seconds with the session token", async () => {
  render(<Probe path="/api/encounters" />);
  await tick(0);
  expect(screen.getByText("n=1")).toBeDefined();

  await tick(2000);
  await tick(2000);
  expect(calls).toBe(3);
  expect(screen.getByText("n=3")).toBeDefined();

  const [path, init] = vi.mocked(fetch).mock.calls[0];
  expect(path).toBe("/api/encounters");
  expect(new Headers((init as RequestInit).headers).get("x-demo-session")).toBe("session.token");
});

test("makes no requests while the tab is hidden and refreshes at once when it returns", async () => {
  render(<Probe path="/api/encounters" />);
  await tick(0);
  expect(calls).toBe(1);

  setHidden(true);
  await tick(10_000);
  expect(calls).toBe(1);

  setHidden(false);
  await tick(0);
  expect(calls).toBe(2);
  await tick(2000);
  expect(calls).toBe(3);
});

test("keeps the last good data visible when a later request fails, then recovers", async () => {
  function Both() {
    const { data, error } = usePolling("/api/encounters", schema);
    return <p>{`n=${data?.n ?? "-"} error=${error ?? "none"}`}</p>;
  }
  render(<Both />);
  await tick(0);
  expect(screen.getByText("n=1 error=none")).toBeDefined();

  respond = () => Response.json({ error: "queue_unavailable" }, { status: 503 });
  await tick(2000);
  expect(screen.getByText("n=1 error=unavailable")).toBeDefined();

  respond = () => Response.json({ n: 99 });
  await tick(2000);
  expect(screen.getByText("n=99 error=none")).toBeDefined();
});

test.each([
  [401, "error:session"],
  [404, "error:not_found"],
])("reports a %i as %s", async (status, text) => {
  respond = () => Response.json({}, { status });
  render(<Probe path="/api/encounters/x" />);
  await tick(0);

  expect(screen.getByText(text)).toBeDefined();
});

test("polls nothing for a null path and stops after unmount", async () => {
  const { unmount } = render(<Probe path={null} />);
  await tick(5000);
  expect(calls).toBe(0);
  unmount();

  const second = render(<Probe path="/api/encounters" />);
  await tick(0);
  second.unmount();
  await tick(10_000);
  expect(calls).toBe(1);
});

test("never shows one encounter's data under another encounter's path", async () => {
  const view = render(<Probe path="/api/encounters/a" />);
  await tick(0);
  expect(screen.getByText("n=1")).toBeDefined();

  vi.mocked(fetch).mockImplementationOnce(() => new Promise(() => {}));
  view.rerender(<Probe path="/api/encounters/b" />);

  expect(screen.getByText("loading")).toBeDefined();
});
