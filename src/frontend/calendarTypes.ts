import type { PlanItem } from "@prisma/client";
import type { WeeklyDraft } from "@/backend/claude";
import { dateToDayOfWeek, formatHHMM } from "@/backend/week";

// Shared by CalendarWeekView.tsx and CalendarDragPopover.tsx — kept in a
// separate module (not exported from either component) specifically to
// avoid a circular import between them (the popover is rendered by the
// grid but also needs the grid's own types/formatter). This module also
// has no "use client" directive, unlike both of those — normalizePlanItems
// must be callable from a server component (home/page.tsx's past-week
// branch), and every export of a "use client" file is treated as a client
// reference even when it's just a plain function, not a component.

// The SSR-prop-vs-fetch-response loose typing WeeklyPlanner.tsx needs
// throughout.
export type PlanItemLike = Omit<
  PlanItem,
  "startTime" | "endTime" | "weekOf" | "createdAt" | "updatedAt"
> & {
  startTime: string | Date;
  endTime: string | Date;
  weekOf: string | Date;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function minutesToHHMM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatClockLabel(hours: number, minutes: number): string {
  // A fixed, arbitrary date carrying only the hour/minute we care about,
  // formatted with timeZone pinned to UTC so no real timezone conversion
  // happens here — this is purely for a consistent 12-hour display string,
  // shared by both real items (already converted to local h/m upstream)
  // and draft items (already local wall-clock time per claude.ts's
  // contract, never needed conversion in the first place).
  const d = new Date(Date.UTC(2000, 0, 1, hours, minutes));
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
}

export type CalendarEntry = {
  key: string;
  title: string;
  category: string;
  dayOfWeek: string; // "MONDAY".."SUNDAY"
  timeLabel: string; // start time display string, e.g. "3:00 PM"
  endTimeLabel: string; // end time display string, e.g. "4:00 PM"
  sortMinutes: number; // minutes since midnight, local — start, for chronological order
  endSortMinutes: number; // minutes since midnight, local — end, drives pixel width
  status?: string; // PlanItemStatus; absent for draft entries
  isDraft: boolean;
  // Deletable only via DELETE /api/plan-items/[id]'s own rules (manually
  // added, current week) — this mirrors that server-side check so the UI
  // can decide whether to show a delete control at all, but the route
  // re-verifies everything itself rather than trusting this flag.
  deletable: boolean;
};

// Real PlanItem-shaped input — matches the loose string|Date typing
// WeeklyPlanner already uses for the SSR-prop-vs-fetch-response split.
export function normalizePlanItems(
  items: Array<{
    id: string;
    title: string;
    category: string;
    startTime: string | Date;
    endTime: string | Date;
    status: string;
    source: string;
  }>,
  timezone: string,
): CalendarEntry[] {
  return items.map((item) => {
    const date = new Date(item.startTime);
    const endDate = new Date(item.endTime);
    const [hours, minutes] = formatHHMM(date, timezone).split(":").map(Number);
    const [endHours, endMinutes] = formatHHMM(endDate, timezone).split(":").map(Number);
    return {
      key: item.id,
      title: item.title,
      category: item.category,
      dayOfWeek: dateToDayOfWeek(date, timezone),
      timeLabel: formatClockLabel(hours, minutes),
      endTimeLabel: formatClockLabel(endHours, endMinutes),
      sortMinutes: hours * 60 + minutes,
      endSortMinutes: endHours * 60 + endMinutes,
      status: item.status,
      isDraft: false,
      deletable: item.source === "MANUAL",
    };
  });
}

// Claude's draft items are already the user's local wall-clock time
// (day-of-week + "HH:MM") — no timezone conversion needed, they don't
// correspond to a real Date until approval materializes them.
export function normalizeDraftItems(draftItems: WeeklyDraft["items"]): CalendarEntry[] {
  return draftItems.map((item, i) => {
    const [hours, minutes] = item.startTime.split(":").map(Number);
    const [endHours, endMinutes] = item.endTime.split(":").map(Number);
    return {
      key: `draft-${i}`,
      title: item.title,
      category: item.category,
      dayOfWeek: item.dayOfWeek,
      timeLabel: formatClockLabel(hours, minutes),
      endTimeLabel: formatClockLabel(endHours, endMinutes),
      sortMinutes: hours * 60 + minutes,
      endSortMinutes: endHours * 60 + endMinutes,
      isDraft: true,
      deletable: false,
    };
  });
}
