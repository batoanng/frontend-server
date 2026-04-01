import { describe, expect, test } from 'vitest';

import { createLeakyBucketRateLimiter } from '@/utils/rateLimit';

describe('rateLimit', () => {
  test('allows the first 100 requests and rejects the 101st', () => {
    const now = 0;
    const limiter = createLeakyBucketRateLimiter({
      requestsPerSecond: 100,
      bucketCapacity: 100,
      now: () => now,
    });

    for (let requestNumber = 0; requestNumber < 100; requestNumber += 1) {
      expect(limiter.check('client-a').allowed).toBe(true);
    }

    const rejected = limiter.check('client-a');

    expect(rejected.allowed).toBe(false);
    expect(rejected.snapshot.accepted).toBe(100);
    expect(rejected.snapshot.rejected).toBe(1);
    expect(rejected.snapshot.bucketLevel).toBe(100);
    expect(rejected.snapshot.remainingApprox).toBe(0);
    expect(rejected.snapshot.retryAfterMs).toBe(10);
  });

  test('leaks capacity over time and allows requests again', () => {
    let now = 0;
    const limiter = createLeakyBucketRateLimiter({
      requestsPerSecond: 2,
      bucketCapacity: 2,
      now: () => now,
    });

    expect(limiter.check('client-a').allowed).toBe(true);
    expect(limiter.check('client-a').allowed).toBe(true);
    expect(limiter.check('client-a').allowed).toBe(false);

    now = 500;

    const retried = limiter.check('client-a');

    expect(retried.allowed).toBe(true);
    expect(retried.snapshot.accepted).toBe(3);
    expect(retried.snapshot.rejected).toBe(1);
    expect(retried.snapshot.bucketLevel).toBe(2);
  });

  test('tracks each client independently', () => {
    const now = 0;
    const limiter = createLeakyBucketRateLimiter({
      requestsPerSecond: 1,
      bucketCapacity: 1,
      now: () => now,
    });

    expect(limiter.check('client-a').allowed).toBe(true);
    expect(limiter.check('client-b').allowed).toBe(true);
    expect(limiter.check('client-a').allowed).toBe(false);
    expect(limiter.check('client-b').allowed).toBe(false);
  });

  test('prunes stale buckets once they have leaked empty', () => {
    let now = 0;
    const limiter = createLeakyBucketRateLimiter({
      requestsPerSecond: 1,
      bucketCapacity: 1,
      idleTtlMs: 1000,
      pruneIntervalMs: 1000,
      now: () => now,
    });

    expect(limiter.check('client-a').allowed).toBe(true);
    expect(limiter.getTrackedClientCount()).toBe(1);

    now = 1500;

    expect(limiter.getTrackedClientCount()).toBe(0);
    expect(limiter.getSnapshot('client-a').bucketLevel).toBe(0);
  });
});
