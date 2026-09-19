/**
 * Display helpers that are safe in the browser. Times are shown in the wall
 * clock written in the ISO string itself (the fixture clock's offset), never
 * converted to the viewer's timezone or compared with the system clock.
 */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const ISO_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

/** "September 18, 2026 at 8:00 AM", or null when the value is not an ISO timestamp. */
export function formatIsoWallTime(iso: string | null | undefined): string | null {
  const match = iso ? ISO_LOCAL.exec(iso) : null;
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const monthName = MONTHS[Number(month) - 1];
  if (!monthName) return null;
  const h = Number(hour);
  return `${monthName} ${Number(day)}, ${year} at ${h % 12 === 0 ? 12 : h % 12}:${minute} ${h < 12 ? "AM" : "PM"}`;
}

/** Value for an <input type="datetime-local">, from the ISO string's own wall clock. */
export function isoToLocalInput(iso: string | null | undefined): string {
  const match = iso ? ISO_LOCAL.exec(iso) : null;
  return match ? `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}` : "";
}

/** Rebuilds an ISO timestamp from a datetime-local value using the fixture clock's offset. */
export function localInputToIso(value: string, fixtureClock: string): string | null {
  const offset = /(Z|[+-]\d{2}:\d{2})$/.exec(fixtureClock)?.[1];
  if (!offset || !ISO_LOCAL.test(value)) return null;
  return `${value.slice(0, 16)}:00${offset === "Z" ? "+00:00" : offset}`;
}

export const NOT_REPORTED = "not reported";

/** [] means the student explicitly said none; null means they did not answer. */
export function formatReportedList(values: string[] | null): string {
  if (values === null) return NOT_REPORTED;
  return values.length === 0 ? "none reported" : values.join(", ");
}

export function formatMockDollars(amount: number): string {
  return `$${amount.toFixed(2).replace(/\.00$/, "")}`;
}
