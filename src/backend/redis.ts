import IORedis from "ioredis";

// Shared Redis connection for BullMQ — see diagrams/architecture.mmd's
// Cache node. BullMQ requires maxRetriesPerRequest: null on any connection
// it's given (it manages its own retry/backoff internally).
const globalForRedis = globalThis as unknown as { redis?: IORedis };

export const redis =
  globalForRedis.redis ??
  new IORedis(process.env.REDIS_URL as string, { maxRetriesPerRequest: null });

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}
