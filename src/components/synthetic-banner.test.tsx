import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { SyntheticBanner } from "@/components/synthetic-banner";

test("shows the required synthetic-data notice without a dismiss control", () => {
  render(<SyntheticBanner />);

  expect(
    screen.getByText("Synthetic demo patient — fictional profile and access data."),
  ).toBeDefined();
  expect(screen.queryByRole("button")).toBeNull();
});
