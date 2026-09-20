// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { DemoMenu } from "@/components/session/demo-menu";
import { closeDemoMenu, openDemoMenu } from "@/lib/client/demo-menu-store";

afterEach(() => {
  act(() => closeDemoMenu());
  cleanup();
  window.localStorage.clear();
});

const panel = () => screen.queryByRole("dialog", { name: "Try it on two devices" });

test("the navbar button opens the session panel without hover, and Escape closes it", () => {
  render(<DemoMenu wide />);
  const button = screen.getByRole("button", { name: "Demo" });

  expect(panel()).toBeNull();
  expect(button.getAttribute("aria-expanded")).toBe("false");

  // Hover is a convenience; a click (or Enter on the focused button) must be enough on its own.
  fireEvent.click(button);
  expect(panel()).not.toBeNull();
  expect(button.getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByRole("button", { name: "Start demo session" })).toBeDefined();

  fireEvent.keyDown(document, { key: "Escape" });
  expect(button.getAttribute("aria-expanded")).toBe("false");
});

test("a button elsewhere on the page can open the menu, and a click outside closes it", () => {
  render(
    <div>
      <DemoMenu wide />
      <p>outside</p>
    </div>,
  );

  act(() => openDemoMenu());
  expect(screen.getByRole("button", { name: "Demo" }).getAttribute("aria-expanded")).toBe("true");

  fireEvent.pointerDown(screen.getByText("outside"));
  expect(screen.getByRole("button", { name: "Demo" }).getAttribute("aria-expanded")).toBe("false");
});
