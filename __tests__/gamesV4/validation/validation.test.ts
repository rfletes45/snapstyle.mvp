/**
 * Games V4 — Validation Utilities Tests
 *
 * Tests the input sanitisation and validation helpers
 * that are used by all V4 callables for hardening.
 *
 * These mirror: firebase-backend/functions/src/gamesV4/validation.ts
 * Re-implemented client-side for testability.
 */

// =============================================================================
// Re-implement sanitisation functions for testing
// =============================================================================

const MAX_STRING_LENGTH = 512;
const MAX_KEY_LENGTH = 64;
const MAX_OBJECT_DEPTH = 5;
const MAX_ARRAY_LENGTH = 100;
const MAX_TOTAL_KEYS = 200;

function sanitiseString(value: unknown, maxLength = MAX_STRING_LENGTH): string {
  if (typeof value !== "string") return "";
  const stripped = value
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim();
  return stripped.slice(0, maxLength);
}

interface CountRef {
  keys: number;
}

function _sanitise(
  value: unknown,
  depth: number,
  maxDepth: number,
  count: CountRef,
): unknown {
  if (depth > maxDepth) return undefined;

  if (value === null || value === undefined) return value;

  const t = typeof value;
  if (t === "boolean" || t === "number") return value;
  if (t === "string") return sanitiseString(value, MAX_STRING_LENGTH);

  if (Array.isArray(value)) {
    const limited = value.slice(0, MAX_ARRAY_LENGTH);
    return limited.map((v) => _sanitise(v, depth + 1, maxDepth, count));
  }

  if (t === "object") {
    if (value instanceof Date) return value;

    const result: Record<string, unknown> = {};
    const raw = value as Record<string, unknown>;
    for (const key of Object.keys(raw)) {
      if (count.keys >= MAX_TOTAL_KEYS) break;
      const safeKey = key.slice(0, MAX_KEY_LENGTH);
      if (safeKey === "__proto__" || safeKey === "constructor") continue;
      count.keys++;
      result[safeKey] = _sanitise(raw[key], depth + 1, maxDepth, count);
    }
    return result;
  }

  return undefined;
}

function sanitisePayload(value: unknown, maxDepth = MAX_OBJECT_DEPTH): unknown {
  return _sanitise(value, 0, maxDepth, { keys: 0 });
}

// =============================================================================
// Tests
// =============================================================================

describe("V4 Validation Utilities", () => {
  describe("sanitiseString", () => {
    it("trims whitespace", () => {
      expect(sanitiseString("  hello  ")).toBe("hello");
    });

    it("strips control characters", () => {
      expect(sanitiseString("hello\x00world")).toBe("helloworld");
      expect(sanitiseString("\x01\x02\x03test")).toBe("test");
    });

    it("preserves newlines and tabs", () => {
      expect(sanitiseString("hello\nworld")).toBe("hello\nworld");
      expect(sanitiseString("hello\tworld")).toBe("hello\tworld");
    });

    it("enforces max length", () => {
      const long = "a".repeat(1000);
      expect(sanitiseString(long).length).toBe(MAX_STRING_LENGTH);
    });

    it("accepts custom max length", () => {
      expect(sanitiseString("hello world", 5)).toBe("hello");
    });

    it("returns empty string for non-string input", () => {
      expect(sanitiseString(123)).toBe("");
      expect(sanitiseString(null)).toBe("");
      expect(sanitiseString(undefined)).toBe("");
      expect(sanitiseString({})).toBe("");
    });
  });

  describe("sanitisePayload", () => {
    it("passes through simple primitives", () => {
      expect(sanitisePayload(42)).toBe(42);
      expect(sanitisePayload(true)).toBe(true);
      expect(sanitisePayload("hello")).toBe("hello");
      expect(sanitisePayload(null)).toBe(null);
    });

    it("sanitises nested objects", () => {
      const input = {
        name: "  Alice  ",
        score: 100,
        data: {
          nested: true,
          text: "hello\x00world",
        },
      };

      const result = sanitisePayload(input) as Record<string, unknown>;
      expect(result.name).toBe("Alice");
      expect(result.score).toBe(100);
      expect((result.data as Record<string, unknown>).text).toBe("helloworld");
    });

    it("drops deeply nested content beyond max depth", () => {
      const input = {
        a: { b: { c: { d: { e: { f: "too deep" } } } } },
      };

      const result = sanitisePayload(input, 5) as Record<string, unknown>;
      // Depth 5: a(1) > b(2) > c(3) > d(4) > e(5) > f(6 = undefined)
      const deep = (
        (
          ((result.a as Record<string, unknown>).b as Record<string, unknown>)
            .c as Record<string, unknown>
        ).d as Record<string, unknown>
      ).e as Record<string, unknown>;
      expect(deep.f).toBeUndefined();
    });

    it("limits array length", () => {
      const bigArray = Array.from({ length: 200 }, (_, i) => i);
      const result = sanitisePayload(bigArray) as number[];
      expect(result.length).toBe(MAX_ARRAY_LENGTH);
    });

    it("strips __proto__ and constructor keys (prototype pollution)", () => {
      // Use Object.defineProperty to force __proto__ as an own key
      const input = Object.create(null) as Record<string, unknown>;
      Object.defineProperty(input, "__proto__", {
        value: { isAdmin: true },
        enumerable: true,
        configurable: true,
      });
      Object.defineProperty(input, "constructor", {
        value: { name: "evil" },
        enumerable: true,
        configurable: true,
      });
      input.legitimate = "ok";

      const result = sanitisePayload(input) as Record<string, unknown>;
      // Verify the dangerous keys are not own properties of the result
      expect(Object.prototype.hasOwnProperty.call(result, "__proto__")).toBe(
        false,
      );
      expect(Object.prototype.hasOwnProperty.call(result, "constructor")).toBe(
        false,
      );
      expect(result.legitimate).toBe("ok");
    });

    it("truncates long key names", () => {
      const longKey = "k".repeat(100);
      const input = { [longKey]: "value" };

      const result = sanitisePayload(input) as Record<string, unknown>;
      const keys = Object.keys(result);
      expect(keys[0].length).toBeLessThanOrEqual(MAX_KEY_LENGTH);
    });

    it("limits total number of keys", () => {
      const manyKeys: Record<string, unknown> = {};
      for (let i = 0; i < 300; i++) {
        manyKeys[`key_${i}`] = i;
      }

      const result = sanitisePayload(manyKeys) as Record<string, unknown>;
      expect(Object.keys(result).length).toBeLessThanOrEqual(MAX_TOTAL_KEYS);
    });

    it("drops functions and symbols", () => {
      const input = {
        fn: () => "evil",
        sym: Symbol("bad"),
        ok: 42,
      };

      const result = sanitisePayload(input) as Record<string, unknown>;
      expect(result.fn).toBeUndefined();
      expect(result.sym).toBeUndefined();
      expect(result.ok).toBe(42);
    });

    it("passes through Date objects", () => {
      const date = new Date("2026-03-01");
      const input = { created: date };

      const result = sanitisePayload(input) as Record<string, unknown>;
      expect(result.created).toBe(date);
    });
  });
});
