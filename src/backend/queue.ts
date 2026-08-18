import { Queue } from "bullmq";
import { redis } from "@/backend/redis";

// The four job types from diagrams/architecture.mmd and diagrams/data-flow.mmd's
// Scheduler node. Each queue gets exactly one repeatable "sweep" producer
// (see src/worker/scheduler.ts) rather than one BullMQ repeatable job per
// user — true per-user cron entries would mean adding/removing a schedule
// on every onboarding/timezone change, which is real operational overhead
// for no benefit at this scale. Timezone-awareness instead lives in each
// job processor's own eligibility check (src/backend/jobs/*.ts), using the
// per-user timezone/weekStartDay already on User. The sweep interval is
// deliberately much finer than the "weekly"/"daily" cadence a user actually
// experiences — see each queue's comment below.
export const checkInReminderQueue = new Queue("checkin-reminder", { connection: redis });
export const draftPendingQueue = new Queue("draft-pending", { connection: redis });
export const inactivityQueue = new Queue("inactivity", { connection: redis });
export const trendRefreshQueue = new Queue("trend-refresh", { connection: redis });
