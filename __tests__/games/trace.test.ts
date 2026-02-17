/**
 * Trace ID Utility Tests
 *
 * Validates format, uniqueness, and prefix behaviour of createTraceId.
 *
 * @see src/utils/trace.ts
 */

import { createTraceId } from "@/utils/trace";

describe("createTraceId", () => {
  it("returns a string with default prefix 't'", () => {
    const id = createTraceId();
    expect(typeof id).toBe("string");
    expect(id.startsWith("t-")).toBe(true);
  });

  it("uses the supplied prefix", () => {
    const id = createTraceId("gs");
    expect(id.startsWith("gs-")).toBe(true);
  });

  it("contains exactly three dash-separated segments", () => {
    const id = createTraceId("inv");
    const parts = id.split("-");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe("inv");
  });

  it("produces URL-safe characters only (alphanumeric + dash)", () => {
    for (let i = 0; i < 50; i++) {
      const id = createTraceId("x");
      expect(id).toMatch(/^[a-z0-9]+-[a-z0-9]+-[a-z0-9]+$/);
    }
  });

  it("generates unique IDs across 1 000 invocations", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1_000; i++) {
      ids.add(createTraceId("u"));
    }
    expect(ids.size).toBe(1_000);
  });

  it("has a reasonable length (~15–25 chars)", () => {
    const id = createTraceId("gs");
    expect(id.length).toBeGreaterThanOrEqual(12);
    expect(id.length).toBeLessThanOrEqual(30);
  });
});
