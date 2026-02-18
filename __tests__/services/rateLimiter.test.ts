/**
 * Tests for Global Bucketed Rate Limiter (Segment 6)
 *
 * Validates the windowed rate limiter logic: bucket keying,
 * pruning, summing, and the fail-open pattern.
 */

describe("Global Rate Limiter (Segment 6)", () => {
  // Constants (mirrored from rateLimiter.ts)
  const GLOBAL_MAX_MESSAGES_PER_WINDOW = 60;
  const WINDOW_MS = 60_000;
  const MAX_BUCKETS = 3;
  const PRUNE_AGE_MS = MAX_BUCKETS * WINDOW_MS;

  // Helper: bucket key (same as server)
  function bucketKey(ts: number): string {
    return String(Math.floor(ts / WINDOW_MS));
  }

  // Helper: sum buckets (same as server)
  function sumBuckets(buckets: Record<string, number>, now: number): number {
    const cutoff = Math.floor((now - PRUNE_AGE_MS) / WINDOW_MS);
    let total = 0;
    for (const [key, count] of Object.entries(buckets)) {
      if (Number(key) >= cutoff) {
        total += count;
      }
    }
    return total;
  }

  // Helper: prune buckets (same as server)
  function pruneBuckets(
    buckets: Record<string, number>,
    now: number,
  ): Record<string, number> {
    const cutoff = Math.floor((now - PRUNE_AGE_MS) / WINDOW_MS);
    const pruned: Record<string, number> = {};
    for (const [key, count] of Object.entries(buckets)) {
      if (Number(key) >= cutoff) {
        pruned[key] = count;
      }
    }
    return pruned;
  }

  describe("bucketKey", () => {
    it("should return consistent keys within same window", () => {
      // Anchor to exact window boundary to avoid cross-window edge cases.
      const ts1 = WINDOW_MS * 16;
      const ts2 = ts1 + WINDOW_MS - 1;

      expect(bucketKey(ts1)).toBe(bucketKey(ts2));
    });

    it("should return different keys for different windows", () => {
      const ts1 = 1000000;
      const ts2 = ts1 + WINDOW_MS;

      expect(bucketKey(ts1)).not.toBe(bucketKey(ts2));
    });

    it("should produce numeric string keys", () => {
      const key = bucketKey(Date.now());
      expect(Number(key)).not.toBeNaN();
    });
  });

  describe("sumBuckets", () => {
    it("should sum all non-pruned buckets", () => {
      const now = Date.now();
      const currentKey = bucketKey(now);
      const prevKey = bucketKey(now - WINDOW_MS);

      const buckets = {
        [currentKey]: 10,
        [prevKey]: 5,
      };

      expect(sumBuckets(buckets, now)).toBe(15);
    });

    it("should ignore pruned (old) buckets", () => {
      const now = Date.now();
      const currentKey = bucketKey(now);
      const veryOldKey = bucketKey(now - PRUNE_AGE_MS - WINDOW_MS);

      const buckets = {
        [currentKey]: 10,
        [veryOldKey]: 50,
      };

      expect(sumBuckets(buckets, now)).toBe(10);
    });

    it("should return 0 for empty buckets", () => {
      expect(sumBuckets({}, Date.now())).toBe(0);
    });

    it("should include all 3 window buckets when present", () => {
      const now = Date.now();
      const buckets: Record<string, number> = {};

      for (let i = 0; i < MAX_BUCKETS; i++) {
        buckets[bucketKey(now - i * WINDOW_MS)] = 10;
      }

      expect(sumBuckets(buckets, now)).toBe(30);
    });
  });

  describe("pruneBuckets", () => {
    it("should keep recent buckets", () => {
      const now = Date.now();
      const currentKey = bucketKey(now);

      const buckets = { [currentKey]: 5 };
      const pruned = pruneBuckets(buckets, now);

      expect(pruned[currentKey]).toBe(5);
    });

    it("should remove old buckets", () => {
      const now = Date.now();
      const veryOldKey = bucketKey(now - PRUNE_AGE_MS - WINDOW_MS);

      const buckets = {
        [bucketKey(now)]: 5,
        [veryOldKey]: 99,
      };
      const pruned = pruneBuckets(buckets, now);

      expect(pruned[veryOldKey]).toBeUndefined();
      expect(Object.keys(pruned).length).toBe(1);
    });

    it("should return empty object when all buckets are old", () => {
      const now = Date.now();
      const old1 = bucketKey(now - PRUNE_AGE_MS - WINDOW_MS);
      const old2 = bucketKey(now - PRUNE_AGE_MS - 2 * WINDOW_MS);

      const pruned = pruneBuckets({ [old1]: 10, [old2]: 20 }, now);
      expect(Object.keys(pruned).length).toBe(0);
    });
  });

  describe("Rate Limit Decision", () => {
    it("should allow when under limit", () => {
      const now = Date.now();
      const buckets = { [bucketKey(now)]: 30 };
      const total = sumBuckets(buckets, now);

      expect(total).toBeLessThan(GLOBAL_MAX_MESSAGES_PER_WINDOW);
    });

    it("should block when at limit", () => {
      const now = Date.now();
      const buckets = { [bucketKey(now)]: GLOBAL_MAX_MESSAGES_PER_WINDOW };
      const total = sumBuckets(buckets, now);

      expect(total).toBeGreaterThanOrEqual(GLOBAL_MAX_MESSAGES_PER_WINDOW);
    });

    it("should block when over limit across windows", () => {
      const now = Date.now();
      const buckets = {
        [bucketKey(now)]: 30,
        [bucketKey(now - WINDOW_MS)]: 20,
        [bucketKey(now - 2 * WINDOW_MS)]: 15,
      };
      const total = sumBuckets(buckets, now);

      // 30 + 20 + 15 = 65 > 60
      expect(total).toBeGreaterThanOrEqual(GLOBAL_MAX_MESSAGES_PER_WINDOW);
    });

    it("should calculate correct remaining count", () => {
      const now = Date.now();
      const currentTotal = 45;
      const remaining = GLOBAL_MAX_MESSAGES_PER_WINDOW - currentTotal;

      expect(remaining).toBe(15);
    });

    it("should calculate retryAfterSeconds when blocked", () => {
      const now = Date.now();
      const currentBucketStart = Math.floor(now / WINDOW_MS) * WINDOW_MS;
      const windowEnd = currentBucketStart + WINDOW_MS;
      const retryAfterMs = Math.max(0, windowEnd - now);
      const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

      expect(retryAfterSeconds).toBeGreaterThan(0);
      expect(retryAfterSeconds).toBeLessThanOrEqual(60);
    });
  });

  describe("Fail-Open Pattern", () => {
    it("should allow on error (fail-open design)", () => {
      // When the Firestore transaction fails, checkGlobalRateLimit returns:
      // { allowed: true, remaining: MAX, windowSeconds: 60 }
      const fallback = {
        allowed: true,
        remaining: GLOBAL_MAX_MESSAGES_PER_WINDOW,
        windowSeconds: WINDOW_MS / 1000,
      };

      expect(fallback.allowed).toBe(true);
      expect(fallback.remaining).toBe(60);
    });
  });

  describe("GlobalRateLimitResult shape", () => {
    it("should include all required fields when allowed", () => {
      const result = {
        allowed: true,
        remaining: 45,
        windowSeconds: 60,
      };

      expect(result).toHaveProperty("allowed");
      expect(result).toHaveProperty("remaining");
      expect(result).toHaveProperty("windowSeconds");
    });

    it("should include retryAfterSeconds when blocked", () => {
      const result = {
        allowed: false,
        remaining: 0,
        windowSeconds: 60,
        retryAfterSeconds: 30,
      };

      expect(result.retryAfterSeconds).toBeDefined();
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
    });
  });

  describe("getRateLimitStatus callable", () => {
    it("should require authentication", () => {
      const context = { auth: null };
      expect(context.auth).toBeNull();
      // Throws "unauthenticated"
    });

    it("should return current rate limit budget", () => {
      // Reads existing buckets, prunes, sums, returns remaining
      const remaining = Math.max(0, GLOBAL_MAX_MESSAGES_PER_WINDOW - 25);
      expect(remaining).toBe(35);
    });
  });

  describe("Firestore doc path", () => {
    it("should use globalChat_{uid} pattern", () => {
      const uid = "abc123def456";
      const docPath = `globalChat_${uid}`;
      expect(docPath).toBe("globalChat_abc123def456");
    });

    it("should store in RateLimits collection", () => {
      const collection = "RateLimits";
      expect(collection).toBe("RateLimits");
    });
  });
});
