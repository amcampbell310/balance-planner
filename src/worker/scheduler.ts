import {
  checkInReminderQueue,
  draftPendingQueue,
  inactivityQueue,
  trendRefreshQueue,
} from "@/backend/queue";

const MINUTES = 60 * 1000;
const HOURS = 60 * MINUTES;

// Registers the repeatable "sweep" producer for each queue — see
// src/backend/queue.ts for why this is a frequent global sweep per queue
// rather than one BullMQ schedule per user. upsertJobScheduler is
// idempotent (safe to call every time the worker process starts).
export async function registerSchedules() {
  await checkInReminderQueue.upsertJobScheduler("checkin-reminder-schedule", {
    every: 15 * MINUTES,
  });
  await draftPendingQueue.upsertJobScheduler("draft-pending-schedule", { every: 24 * HOURS });
  await inactivityQueue.upsertJobScheduler("inactivity-schedule", { every: 24 * HOURS });
  await trendRefreshQueue.upsertJobScheduler("trend-refresh-schedule", { every: 24 * HOURS });
}
