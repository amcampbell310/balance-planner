// Week/date helpers shared by the weekly-plan, plan-items, and check-in
// routes. All conversions go through the user's IANA timezone (User.timezone)
// via Luxon — Claude proposes times as the user's local wall-clock time, and
// everything stored in Postgres is a real UTC instant.

import { DateTime } from "luxon";

const DAY_INDEX: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

const INDEX_DAY = Object.fromEntries(
  Object.entries(DAY_INDEX).map(([day, i]) => [i, day]),
) as Record<number, string>;

// Luxon's .weekday is ISO (1=Monday..7=Sunday); DAY_INDEX is JS-style
// (0=Sunday..6=Saturday). % 7 maps Sunday's 7 down to 0 and leaves the rest.
function isoWeekdayToJs(isoWeekday: number): number {
  return isoWeekday % 7;
}

/**
 * The most recent local calendar date matching weekStartDay, at or before
 * the given instant — evaluated in the user's timezone, not UTC. Returned as
 * a UTC-midnight Date whose Y-M-D is that local calendar date; this is a
 * date-only marker (used for @@unique([userId, weekOf])), not a real instant.
 */
export function getWeekOfForDate(date: Date, weekStartDay: number, timezone: string): Date {
  const local = DateTime.fromJSDate(date, { zone: timezone }).startOf("day");
  const offset = (isoWeekdayToJs(local.weekday) - weekStartDay + 7) % 7;
  const weekStart = local.minus({ days: offset });
  return new Date(Date.UTC(weekStart.year, weekStart.month - 1, weekStart.day));
}

export function getCurrentWeekOf(weekStartDay: number, timezone: string): Date {
  return getWeekOfForDate(new Date(), weekStartDay, timezone);
}

/** Converts a Claude-proposed { dayOfWeek, "HH:MM" } (the user's local wall-clock time) into a real UTC Date within the given week. */
export function dayOfWeekToDate(
  weekOf: Date,
  weekStartDay: number,
  dayOfWeek: string,
  timeHHMM: string,
  timezone: string,
): Date {
  const targetIndex = DAY_INDEX[dayOfWeek];
  if (targetIndex === undefined) {
    throw new Error(`Unknown dayOfWeek: ${dayOfWeek}`);
  }
  const offset = (targetIndex - weekStartDay + 7) % 7;

  const [hours, minutes] = timeHHMM.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    throw new Error(`Unparseable time: ${timeHHMM}`);
  }

  // weekOf's Y-M-D (read via UTC getters — see getWeekOfForDate) is the
  // user's local calendar date; reinterpret those same numbers as a wall
  // clock in the user's zone, then add the day offset and the time.
  const local = DateTime.fromObject(
    {
      year: weekOf.getUTCFullYear(),
      month: weekOf.getUTCMonth() + 1,
      day: weekOf.getUTCDate(),
    },
    { zone: timezone },
  )
    .plus({ days: offset })
    .set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });

  return local.toJSDate();
}

/** The inverse of dayOfWeekToDate — used when sending existing items to Claude as context. */
export function dateToDayOfWeek(date: Date, timezone: string): string {
  const local = DateTime.fromJSDate(date, { zone: timezone });
  return INDEX_DAY[isoWeekdayToJs(local.weekday)];
}

export function formatHHMM(date: Date, timezone: string): string {
  return DateTime.fromJSDate(date, { zone: timezone }).toFormat("HH:mm");
}
