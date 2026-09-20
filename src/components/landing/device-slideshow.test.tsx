// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { DeviceSlideshow } from "@/components/landing/device-slideshow";

afterEach(cleanup);

const SLIDES = [
  { kind: "laptop" as const, src: "/brand/shot-clinician.png", caption: "The clinician's laptop" },
  { kind: "phone" as const, src: "/brand/shot-student.png", caption: "The student's phone" },
];

test("opens on the laptop, moves only when asked, and wraps around in both directions", () => {
  render(<DeviceSlideshow slides={SLIDES} />);
  const carousel = screen.getByRole("region", { name: "The two screens" });
  // The visible caption is the live region, so a screen reader hears each change.
  const caption = () => carousel.querySelector("[aria-live='polite']")?.textContent;

  expect(caption()).toBe("The clinician's laptop");

  fireEvent.click(within(carousel).getByRole("button", { name: "Next screen" }));
  expect(caption()).toBe("The student's phone");

  fireEvent.click(within(carousel).getByRole("button", { name: "Next screen" }));
  expect(caption()).toBe("The clinician's laptop");

  fireEvent.click(within(carousel).getByRole("button", { name: "Previous screen" }));
  expect(caption()).toBe("The student's phone");
});

test("the arrows are the only controls: the position dots are decoration, not tiny buttons", () => {
  render(<DeviceSlideshow slides={SLIDES} />);
  const carousel = screen.getByRole("region", { name: "The two screens" });

  expect(within(carousel).getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual([
    "Previous screen",
    "Next screen",
  ]);
});
