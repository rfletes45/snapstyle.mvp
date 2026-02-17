/**
 * Tests for message rate limiter utility.
 */
import { MessageRateLimiter } from "../../src/utils/rateLimiter";

describe("MessageRateLimiter", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("allows messages within the limit", () => {
    const limiter = new MessageRateLimiter({
      input: { max: 3, windowMs: 1000 },
    });

    expect(limiter.isRateLimited("s1", "input")).toBe(false);
    expect(limiter.isRateLimited("s1", "input")).toBe(false);
    expect(limiter.isRateLimited("s1", "input")).toBe(false);

    limiter.dispose();
  });

  it("blocks messages over the limit", () => {
    const limiter = new MessageRateLimiter({
      input: { max: 2, windowMs: 1000 },
    });

    expect(limiter.isRateLimited("s1", "input")).toBe(false); // 1
    expect(limiter.isRateLimited("s1", "input")).toBe(false); // 2
    expect(limiter.isRateLimited("s1", "input")).toBe(true); // 3 → blocked

    limiter.dispose();
  });

  it("resets after the window expires", () => {
    jest.spyOn(Date, "now").mockReturnValue(1000);

    const limiter = new MessageRateLimiter({
      input: { max: 1, windowMs: 500 },
    });

    expect(limiter.isRateLimited("s1", "input")).toBe(false); // 1 → allowed
    expect(limiter.isRateLimited("s1", "input")).toBe(true); // 2 → blocked

    // Advance time past the window
    jest.spyOn(Date, "now").mockReturnValue(1600);
    expect(limiter.isRateLimited("s1", "input")).toBe(false); // new window → allowed

    limiter.dispose();
  });

  it("tracks sessions independently", () => {
    const limiter = new MessageRateLimiter({
      input: { max: 1, windowMs: 1000 },
    });

    expect(limiter.isRateLimited("s1", "input")).toBe(false);
    expect(limiter.isRateLimited("s2", "input")).toBe(false);
    expect(limiter.isRateLimited("s1", "input")).toBe(true); // s1 blocked
    expect(limiter.isRateLimited("s2", "input")).toBe(true); // s2 blocked

    limiter.dispose();
  });

  it("allows messages with no matching rule", () => {
    const limiter = new MessageRateLimiter({
      input: { max: 1, windowMs: 1000 },
    });

    // "unknown_msg" has no rule → always allowed
    expect(limiter.isRateLimited("s1", "unknown_msg")).toBe(false);
    expect(limiter.isRateLimited("s1", "unknown_msg")).toBe(false);
    expect(limiter.isRateLimited("s1", "unknown_msg")).toBe(false);

    limiter.dispose();
  });

  it("removeSession clears tracking for that session", () => {
    const limiter = new MessageRateLimiter({
      input: { max: 2, windowMs: 1000 },
    });

    limiter.isRateLimited("s1", "input");
    limiter.isRateLimited("s1", "input");
    expect(limiter.isRateLimited("s1", "input")).toBe(true); // blocked

    limiter.removeSession("s1");
    expect(limiter.isRateLimited("s1", "input")).toBe(false); // fresh start

    limiter.dispose();
  });

  it("dispose clears buckets and timer", () => {
    const limiter = new MessageRateLimiter({
      input: { max: 1, windowMs: 1000 },
    });

    limiter.isRateLimited("s1", "input");
    limiter.dispose();

    // After dispose, a new check still works (empty map)
    // This tests that dispose doesn't throw
    expect(() => limiter.isRateLimited("s1", "input")).not.toThrow();
  });
});
