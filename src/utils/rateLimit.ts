const DEFAULT_BUCKET_IDLE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_PRUNE_INTERVAL_MS = 60 * 1000;

export const RATE_LIMIT_ALGORITHM = 'leaky-bucket';

export type RateLimitBucketState = {
  level: number;
  lastUpdatedAtMs: number;
  accepted: number;
  rejected: number;
};

export type RateLimitClientSnapshot = {
  key: string;
  bucketLevel: number;
  remainingApprox: number;
  accepted: number;
  rejected: number;
  limited: boolean;
  retryAfterMs: number;
  lastUpdatedAt: string;
};

type CreateLeakyBucketRateLimiterOptions = {
  requestsPerSecond: number;
  bucketCapacity: number;
  idleTtlMs?: number;
  pruneIntervalMs?: number;
  now?: () => number;
};

const roundMetric = (value: number) => Number(value.toFixed(3));

export const createLeakyBucketRateLimiter = ({
  requestsPerSecond,
  bucketCapacity,
  idleTtlMs = DEFAULT_BUCKET_IDLE_TTL_MS,
  pruneIntervalMs = DEFAULT_PRUNE_INTERVAL_MS,
  now = Date.now,
}: CreateLeakyBucketRateLimiterOptions) => {
  const buckets = new Map<string, RateLimitBucketState>();
  const effectivePruneIntervalMs = Math.min(pruneIntervalMs, idleTtlMs);
  let lastPrunedAtMs = 0;

  const getLeakedLevel = (state: RateLimitBucketState, timestamp: number) => {
    const elapsedMs = Math.max(0, timestamp - state.lastUpdatedAtMs);
    return Math.max(0, state.level - (elapsedMs * requestsPerSecond) / 1000);
  };

  const buildSnapshot = (key: string, state: RateLimitBucketState, timestamp: number): RateLimitClientSnapshot => {
    const leakedLevel = getLeakedLevel(state, timestamp);
    const remainingApprox = Math.max(0, bucketCapacity - leakedLevel);
    const limited = leakedLevel + 1 > bucketCapacity;
    const retryAfterMs = limited
      ? Math.max(0, Math.ceil(((leakedLevel + 1 - bucketCapacity) / requestsPerSecond) * 1000))
      : 0;

    return {
      key,
      bucketLevel: roundMetric(leakedLevel),
      remainingApprox: roundMetric(remainingApprox),
      accepted: state.accepted,
      rejected: state.rejected,
      limited,
      retryAfterMs,
      lastUpdatedAt: new Date(state.lastUpdatedAtMs).toISOString(),
    };
  };

  const getOrCreateState = (key: string, timestamp: number) => {
    const existing = buckets.get(key);
    if (existing) {
      return existing;
    }

    const created: RateLimitBucketState = {
      level: 0,
      lastUpdatedAtMs: timestamp,
      accepted: 0,
      rejected: 0,
    };

    buckets.set(key, created);
    return created;
  };

  const prune = (timestamp = now()) => {
    if (timestamp - lastPrunedAtMs < effectivePruneIntervalMs) {
      return;
    }

    for (const [key, state] of buckets.entries()) {
      const idleForMs = timestamp - state.lastUpdatedAtMs;
      const leakedLevel = getLeakedLevel(state, timestamp);
      if (idleForMs >= idleTtlMs && leakedLevel <= 0) {
        buckets.delete(key);
      }
    }

    lastPrunedAtMs = timestamp;
  };

  return {
    check(key: string) {
      const timestamp = now();
      prune(timestamp);

      const state = getOrCreateState(key, timestamp);
      state.level = getLeakedLevel(state, timestamp);
      state.lastUpdatedAtMs = timestamp;

      if (state.level + 1 > bucketCapacity) {
        state.rejected += 1;
        return {
          allowed: false,
          snapshot: buildSnapshot(key, state, timestamp),
        };
      }

      state.level += 1;
      state.accepted += 1;

      return {
        allowed: true,
        snapshot: buildSnapshot(key, state, timestamp),
      };
    },

    getSnapshot(key: string) {
      const timestamp = now();
      prune(timestamp);

      const state = buckets.get(key);
      if (!state) {
        return buildSnapshot(
          key,
          {
            level: 0,
            lastUpdatedAtMs: timestamp,
            accepted: 0,
            rejected: 0,
          },
          timestamp
        );
      }

      return buildSnapshot(key, state, timestamp);
    },

    getTrackedClientCount() {
      const timestamp = now();
      prune(timestamp);
      return buckets.size;
    },
  };
};
