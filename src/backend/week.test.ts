import { describe, it, expect } from "vitest";
import {
  getWeekOfForDate,
  getCurrentWeekOf,
  dayOfWeekToDate,
  dateToDayOfWeek,
  formatHHMM,
  addWeeks,
  getOrderedWeekDayNames,
  weekOfToParam,
  snapParamToWeekOf,
} from "@/backend/week";

// Y-M-D of a UTC-midnight "weekOf" marker, ignoring the time component —
// every helper here returns/consumes weekOf as a date-only marker (see
// week.ts's own doc comments), so tests compare on this rather than full
// ISO strings to stay readable.
function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

describe("getWeekOfForDate", () => {
  it("finds the Monday on-or-before a mid-week UTC date, weekStartDay=1", () => {
    // 2026-08-19 is a Wednesday.
    const result = getWeekOfForDate(new Date("2026-08-19T12:00:00.000Z"), 1, "UTC");
    expect(ymd(result)).toBe("2026-08-17"); // the preceding Monday
  });

  it("returns the same date when it already IS the week start", () => {
    // 2026-08-17 is a Monday.
    const result = getWeekOfForDate(new Date("2026-08-17T00:00:00.000Z"), 1, "UTC");
    expect(ymd(result)).toBe("2026-08-17");
  });

  it("respects weekStartDay=0 (Sunday) instead of Monday", () => {
    // 2026-08-19 is a Wednesday; the preceding Sunday is 2026-08-16.
    const result = getWeekOfForDate(new Date("2026-08-19T12:00:00.000Z"), 0, "UTC");
    expect(ymd(result)).toBe("2026-08-16");
  });

  it("evaluates in the user's local timezone, not UTC — a timezone behind UTC can land on the previous local calendar day", () => {
    // 2026-08-17T02:00:00Z is Monday 02:00 UTC, but 2026-08-16 19:00 in
    // America/Los_Angeles (UTC-7 in August, DST) — a Sunday locally, so
    // with weekStartDay=1 this should snap back to the PRIOR Monday, not
    // the 17th, if timezone conversion is happening correctly.
    const result = getWeekOfForDate(new Date("2026-08-17T02:00:00.000Z"), 1, "America/Los_Angeles");
    expect(ymd(result)).toBe("2026-08-10");
  });

  it("gives a different (later) result for the same instant in UTC than in a behind-UTC zone", () => {
    // Same instant, interpreted in UTC (still Monday the 17th) vs LA (still
    // Sunday the 16th) — the two zones must disagree on which week this
    // lands in, or the timezone parameter isn't actually being used.
    const instant = new Date("2026-08-17T02:00:00.000Z");
    const utcResult = getWeekOfForDate(instant, 1, "UTC");
    const laResult = getWeekOfForDate(instant, 1, "America/Los_Angeles");
    expect(ymd(utcResult)).toBe("2026-08-17");
    expect(ymd(laResult)).toBe("2026-08-10");
    expect(ymd(utcResult)).not.toBe(ymd(laResult));
  });
});

describe("getCurrentWeekOf", () => {
  it("matches getWeekOfForDate(new Date(), ...) for the same inputs", () => {
    // Not asserting a specific date (that would be a flaky test tied to
    // wall-clock time) — just that it's the same function applied to "now".
    const a = getCurrentWeekOf(1, "America/New_York");
    const b = getWeekOfForDate(new Date(), 1, "America/New_York");
    // Both computed within the same test run, milliseconds apart — safe to
    // compare directly barring an actual midnight-boundary race, which is
    // an acceptable, vanishingly rare flake for a date-only marker.
    expect(ymd(a)).toBe(ymd(b));
  });
});

describe("dayOfWeekToDate / dateToDayOfWeek round-trip", () => {
  const weekOf = new Date(Date.UTC(2026, 7, 17)); // Monday 2026-08-17, weekStartDay=1

  it("places MONDAY at the week start with the given local time", () => {
    const result = dayOfWeekToDate(weekOf, 1, "MONDAY", "09:30", "America/Los_Angeles");
    expect(dateToDayOfWeek(result, "America/Los_Angeles")).toBe("MONDAY");
    expect(formatHHMM(result, "America/Los_Angeles")).toBe("09:30");
  });

  it("offsets correctly for a day later in the week (THURSDAY)", () => {
    const result = dayOfWeekToDate(weekOf, 1, "THURSDAY", "18:00", "America/Los_Angeles");
    expect(dateToDayOfWeek(result, "America/Los_Angeles")).toBe("THURSDAY");
    expect(formatHHMM(result, "America/Los_Angeles")).toBe("18:00");
  });

  it("wraps SUNDAY to the end of a Monday-start week, not the start", () => {
    const result = dayOfWeekToDate(weekOf, 1, "SUNDAY", "12:00", "America/Los_Angeles");
    expect(dateToDayOfWeek(result, "America/Los_Angeles")).toBe("SUNDAY");
    // Sunday of a week starting Monday 8/17 is 8/23 — 6 days later.
    const start = DateOnlyUTC(result, "America/Los_Angeles");
    expect(start).toBe("2026-08-23");
  });

  it("round-trips correctly across a real timezone offset (not UTC)", () => {
    // A late-evening local time close to the UTC day boundary — a common
    // real place for off-by-one-day bugs if the zone isn't actually applied.
    const result = dayOfWeekToDate(weekOf, 1, "FRIDAY", "23:30", "Pacific/Auckland");
    expect(dateToDayOfWeek(result, "Pacific/Auckland")).toBe("FRIDAY");
    expect(formatHHMM(result, "Pacific/Auckland")).toBe("23:30");
  });

  it("throws on an unknown dayOfWeek", () => {
    expect(() => dayOfWeekToDate(weekOf, 1, "FUNDAY", "09:00", "UTC")).toThrow();
  });

  it("throws on an unparseable time", () => {
    expect(() => dayOfWeekToDate(weekOf, 1, "MONDAY", "not-a-time", "UTC")).toThrow();
  });
});

// Helper for the SUNDAY-wrap test above — local calendar date (YYYY-MM-DD)
// of a Date in a given zone.
function DateOnlyUTC(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

describe("addWeeks", () => {
  it("adds whole weeks forward", () => {
    const weekOf = new Date(Date.UTC(2026, 7, 17));
    expect(ymd(addWeeks(weekOf, 1))).toBe("2026-08-24");
    expect(ymd(addWeeks(weekOf, 2))).toBe("2026-08-31");
  });

  it("subtracts whole weeks with a negative count", () => {
    const weekOf = new Date(Date.UTC(2026, 7, 17));
    expect(ymd(addWeeks(weekOf, -1))).toBe("2026-08-10");
  });

  it("is a no-op for 0 weeks", () => {
    const weekOf = new Date(Date.UTC(2026, 7, 17));
    expect(ymd(addWeeks(weekOf, 0))).toBe("2026-08-17");
  });
});

describe("getOrderedWeekDayNames", () => {
  it("starts the list at Monday for weekStartDay=1", () => {
    expect(getOrderedWeekDayNames(1)).toEqual([
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
      "SUNDAY",
    ]);
  });

  it("starts the list at Sunday for weekStartDay=0", () => {
    expect(getOrderedWeekDayNames(0)).toEqual([
      "SUNDAY",
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
    ]);
  });

  it("starts the list at Wednesday for weekStartDay=3", () => {
    expect(getOrderedWeekDayNames(3)).toEqual([
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
      "SUNDAY",
      "MONDAY",
      "TUESDAY",
    ]);
  });
});

describe("weekOfToParam", () => {
  it("formats a UTC-midnight weekOf as YYYY-MM-DD", () => {
    expect(weekOfToParam(new Date(Date.UTC(2026, 7, 17)))).toBe("2026-08-17");
  });
});

describe("snapParamToWeekOf", () => {
  it("snaps a mid-week param date back to the week start (weekStartDay=1)", () => {
    // 2026-08-19 is a Wednesday.
    const result = snapParamToWeekOf(new Date("2026-08-19T00:00:00.000Z"), 1);
    expect(ymd(result)).toBe("2026-08-17");
  });

  it("leaves an already-aligned week start untouched", () => {
    const result = snapParamToWeekOf(new Date("2026-08-17T00:00:00.000Z"), 1);
    expect(ymd(result)).toBe("2026-08-17");
  });

  it("does pure UTC day arithmetic — does NOT shift backward a day the way getWeekOfForDate would for a behind-UTC timezone", () => {
    // This is the exact regression the function's own doc comment
    // describes: a UTC-midnight param date must snap using UTC day math,
    // not get reinterpreted as an instant in some other timezone. Compare
    // directly against getWeekOfForDate to prove they're NOT equivalent.
    const param = new Date("2026-08-17T00:00:00.000Z"); // Monday, UTC midnight
    const snapped = snapParamToWeekOf(param, 1);
    const reinterpretedAsInstant = getWeekOfForDate(param, 1, "America/Los_Angeles");
    expect(ymd(snapped)).toBe("2026-08-17");
    expect(ymd(reinterpretedAsInstant)).toBe("2026-08-10");
    expect(ymd(snapped)).not.toBe(ymd(reinterpretedAsInstant));
  });

  it("respects weekStartDay=0 (Sunday)", () => {
    // 2026-08-19 is a Wednesday; the preceding Sunday is 2026-08-16.
    const result = snapParamToWeekOf(new Date("2026-08-19T00:00:00.000Z"), 0);
    expect(ymd(result)).toBe("2026-08-16");
  });
});
