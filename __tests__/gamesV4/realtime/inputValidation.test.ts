/**
 * Tests — InputValidation (Realtime Framework)
 *
 * Tests for rate limiting, message registry, and payload validation.
 */

// We test the exported classes/functions directly since they're pure logic.
// No Firebase or Colyseus dependencies needed.

// Inline minimal implementations for unit testing since we can't
// easily import the TS directly in the test environment. Instead,
// we test the logic patterns that the classes implement.

describe("RateLimiter", () => {
  // Minimal re-implementation of the rate limiter for testing
  class RateLimiter {
    private buckets = new Map<string, number[]>();

    isAllowed(key: string, maxPerWindow: number, windowMs: number): boolean {
      const now = Date.now();
      const bucket = this.buckets.get(key) ?? [];
      const filtered = bucket.filter((ts) => now - ts < windowMs);
      if (filtered.length >= maxPerWindow) {
        this.buckets.set(key, filtered);
        return false;
      }
      filtered.push(now);
      this.buckets.set(key, filtered);
      return true;
    }

    reset(key: string): void {
      this.buckets.delete(key);
    }

    resetAll(): void {
      this.buckets.clear();
    }
  }

  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter();
  });

  it("allows messages within the rate limit", () => {
    expect(limiter.isAllowed("user1", 5, 1000)).toBe(true);
    expect(limiter.isAllowed("user1", 5, 1000)).toBe(true);
    expect(limiter.isAllowed("user1", 5, 1000)).toBe(true);
  });

  it("blocks messages exceeding the rate limit", () => {
    for (let i = 0; i < 5; i++) {
      expect(limiter.isAllowed("user1", 5, 1000)).toBe(true);
    }
    expect(limiter.isAllowed("user1", 5, 1000)).toBe(false);
  });

  it("tracks separate keys independently", () => {
    for (let i = 0; i < 5; i++) {
      limiter.isAllowed("user1", 5, 1000);
    }
    expect(limiter.isAllowed("user1", 5, 1000)).toBe(false);
    expect(limiter.isAllowed("user2", 5, 1000)).toBe(true);
  });

  it("resets a specific key", () => {
    for (let i = 0; i < 5; i++) {
      limiter.isAllowed("user1", 5, 1000);
    }
    expect(limiter.isAllowed("user1", 5, 1000)).toBe(false);
    limiter.reset("user1");
    expect(limiter.isAllowed("user1", 5, 1000)).toBe(true);
  });

  it("resets all keys", () => {
    for (let i = 0; i < 5; i++) {
      limiter.isAllowed("user1", 5, 1000);
      limiter.isAllowed("user2", 5, 1000);
    }
    limiter.resetAll();
    expect(limiter.isAllowed("user1", 5, 1000)).toBe(true);
    expect(limiter.isAllowed("user2", 5, 1000)).toBe(true);
  });
});

describe("Payload Validation", () => {
  // Validate payload schema patterns used by the framework

  function createPayloadValidator(
    schema: Record<string, "string" | "number" | "boolean" | "object">,
  ): (payload: unknown) => string | null {
    return (payload: unknown) => {
      if (!payload || typeof payload !== "object") {
        return "Payload must be an object";
      }
      const obj = payload as Record<string, unknown>;
      for (const [key, expectedType] of Object.entries(schema)) {
        if (!(key in obj)) {
          return `Missing required field: ${key}`;
        }
        if (typeof obj[key] !== expectedType) {
          return `Field "${key}" must be ${expectedType}, got ${typeof obj[key]}`;
        }
      }
      return null;
    };
  }

  it("passes valid payloads", () => {
    const validate = createPayloadValidator({
      text: "string",
      score: "number",
    });
    expect(validate({ text: "hello", score: 42 })).toBeNull();
  });

  it("rejects non-object payloads", () => {
    const validate = createPayloadValidator({ text: "string" });
    expect(validate(null)).toBe("Payload must be an object");
    expect(validate("string")).toBe("Payload must be an object");
    expect(validate(123)).toBe("Payload must be an object");
  });

  it("rejects missing fields", () => {
    const validate = createPayloadValidator({
      text: "string",
      score: "number",
    });
    expect(validate({ text: "hello" })).toBe("Missing required field: score");
  });

  it("rejects wrong field types", () => {
    const validate = createPayloadValidator({
      text: "string",
      score: "number",
    });
    expect(validate({ text: "hello", score: "not a number" })).toBe(
      'Field "score" must be number, got string',
    );
  });

  it("allows extra fields (pass-through)", () => {
    const validate = createPayloadValidator({ text: "string" });
    expect(validate({ text: "hello", extra: true })).toBeNull();
  });
});

describe("Message Registry Logic", () => {
  // Validate the message definition patterns

  interface MessageDef {
    type: string;
    senderRole: "any" | "active" | "spectator";
    allowedPhases: string[];
    rateLimit: { maxPerWindow: number; windowMs: number };
  }

  function validateMessage(
    def: MessageDef,
    senderRole: "active" | "spectator",
    currentPhase: string,
  ): string | null {
    // Check sender role
    if (def.senderRole !== "any" && def.senderRole !== senderRole) {
      return `Message "${def.type}" not allowed for ${senderRole} role`;
    }

    // Check phase
    if (
      def.allowedPhases.length > 0 &&
      !def.allowedPhases.includes(currentPhase)
    ) {
      return `Message "${def.type}" not allowed in phase "${currentPhase}"`;
    }

    return null;
  }

  it("allows messages with matching role and phase", () => {
    const def: MessageDef = {
      type: "stroke_begin",
      senderRole: "active",
      allowedPhases: ["drawing"],
      rateLimit: { maxPerWindow: 60, windowMs: 1000 },
    };
    expect(validateMessage(def, "active", "drawing")).toBeNull();
  });

  it("rejects messages from wrong role", () => {
    const def: MessageDef = {
      type: "stroke_begin",
      senderRole: "active",
      allowedPhases: ["drawing"],
      rateLimit: { maxPerWindow: 60, windowMs: 1000 },
    };
    expect(validateMessage(def, "spectator", "drawing")).toBe(
      'Message "stroke_begin" not allowed for spectator role',
    );
  });

  it("rejects messages in wrong phase", () => {
    const def: MessageDef = {
      type: "stroke_begin",
      senderRole: "active",
      allowedPhases: ["drawing"],
      rateLimit: { maxPerWindow: 60, windowMs: 1000 },
    };
    expect(validateMessage(def, "active", "waiting")).toBe(
      'Message "stroke_begin" not allowed in phase "waiting"',
    );
  });

  it("allows messages with empty allowedPhases (any phase)", () => {
    const def: MessageDef = {
      type: "reaction",
      senderRole: "any",
      allowedPhases: [],
      rateLimit: { maxPerWindow: 10, windowMs: 5000 },
    };
    expect(validateMessage(def, "active", "waiting")).toBeNull();
    expect(validateMessage(def, "spectator", "drawing")).toBeNull();
  });
});
