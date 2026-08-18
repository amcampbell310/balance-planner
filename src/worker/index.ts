import "dotenv/config";
import { Worker } from "bullmq";
import { redis } from "@/backend/redis";
import { registerSchedules } from "@/worker/scheduler";
import { runCheckInReminderSweep } from "@/backend/jobs/checkInReminder";
import { runDraftPendingSweep } from "@/backend/jobs/draftPending";
import { runInactivitySweep } from "@/backend/jobs/inactivity";
import { runTrendRefreshSweep } from "@/backend/jobs/trendRefresh";

// Single persistent process: runs the BullMQ workers AND registers the
// repeatable sweep schedules on startup. Matches the hosting plan (a
// persistent Railway worker, not a scheduled cron invocation) — see
// documents/roadmap.md Phase 1.
const workers = [
  new Worker(
    "checkin-reminder",
    async () => {
      const result = await runCheckInReminderSweep();
      if (result.created > 0) console.log(`[checkin-reminder] created ${result.created}`);
    },
    { connection: redis },
  ),
  new Worker(
    "draft-pending",
    async () => {
      const result = await runDraftPendingSweep();
      if (result.sent > 0) console.log(`[draft-pending] sent ${result.sent}`);
    },
    { connection: redis },
  ),
  new Worker(
    "inactivity",
    async () => {
      const result = await runInactivitySweep();
      if (result.sent > 0) console.log(`[inactivity] sent ${result.sent}`);
    },
    { connection: redis },
  ),
  new Worker(
    "trend-refresh",
    async () => {
      const result = await runTrendRefreshSweep();
      if (result.refreshed > 0) console.log(`[trend-refresh] refreshed ${result.refreshed}`);
    },
    { connection: redis },
  ),
];

for (const worker of workers) {
  worker.on("failed", (job, err) => {
    console.error(`[${worker.name}] job ${job?.id} failed:`, err);
  });
}

async function main() {
  await registerSchedules();
  console.log("Worker started — schedules registered, listening for jobs.");
}

main().catch((err) => {
  console.error("Worker failed to start:", err);
  process.exit(1);
});

process.on("SIGINT", async () => {
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
});
