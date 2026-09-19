import { describe, expect, it } from "vitest";
import {
  formatIsoWallTime,
  formatMockDollars,
  formatReportedList,
  isoToLocalInput,
  localInputToIso,
} from "@/lib/format";

describe("formatIsoWallTime", () => {
  it.each([
    ["2026-09-18T08:00:00-04:00", "September 18, 2026 at 8:00 AM"],
    ["2026-09-19T14:05:00-04:00", "September 19, 2026 at 2:05 PM"],
    ["2026-09-19T00:30:00Z", "September 19, 2026 at 12:30 AM"],
    ["2026-09-19T12:00:00+05:30", "September 19, 2026 at 12:00 PM"],
  ])("shows %s in its own wall clock", (iso, expected) => {
    expect(formatIsoWallTime(iso)).toBe(expected);
  });

  it.each([null, undefined, "", "yesterday morning", "2026-13-01T08:00:00Z"])("returns null for %j", (value) => {
    expect(formatIsoWallTime(value)).toBeNull();
  });
});

describe("Spanish formatting", () => {
  it("writes dates and the two list states in Spanish without changing their meaning", () => {
    expect(formatIsoWallTime("2026-09-18T08:00:00-04:00", "es")).toBe("18 de septiembre de 2026 a las 8:00 a. m.");
    expect(formatIsoWallTime("2026-09-19T14:05:00-04:00", "es")).toBe("19 de septiembre de 2026 a las 2:05 p. m.");
    const labels = { notReported: "no informado", noneReported: "ninguno informado" };
    expect(formatReportedList(null, labels)).toBe("no informado");
    expect(formatReportedList([], labels)).toBe("ninguno informado");
    expect(formatReportedList(["ibuprofeno"], labels)).toBe("ibuprofeno");
  });
});

describe("datetime-local round trip", () => {
  it("keeps the fixture clock's offset instead of the viewer's timezone", () => {
    const clock = "2026-09-19T10:00:00-04:00";

    expect(isoToLocalInput("2026-09-18T08:00:00-04:00")).toBe("2026-09-18T08:00");
    expect(localInputToIso("2026-09-18T21:30", clock)).toBe("2026-09-18T21:30:00-04:00");
    expect(localInputToIso("2026-09-18T21:30", "2026-09-19T14:00:00Z")).toBe("2026-09-18T21:30:00+00:00");
  });

  it("returns empty or null for missing values", () => {
    expect(isoToLocalInput(null)).toBe("");
    expect(localInputToIso("", "2026-09-19T10:00:00-04:00")).toBeNull();
    expect(localInputToIso("2026-09-18T21:30", "no offset")).toBeNull();
  });
});

describe("formatReportedList", () => {
  it("keeps unanswered, explicitly none, and answered distinct", () => {
    expect(formatReportedList(null)).toBe("not reported");
    expect(formatReportedList([])).toBe("none reported");
    expect(formatReportedList(["ibuprofen", "acetaminophen"])).toBe("ibuprofen, acetaminophen");
  });
});

describe("formatMockDollars", () => {
  it("drops empty cents", () => {
    expect(formatMockDollars(12)).toBe("$12");
    expect(formatMockDollars(12.5)).toBe("$12.50");
  });
});
