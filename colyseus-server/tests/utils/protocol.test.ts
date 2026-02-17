/**
 * Tests for server-side protocol version checking utility.
 */
import {
  checkProtocolVersion,
  MINIMUM_PROTOCOL_VERSION,
  SERVER_PROTOCOL_VERSION,
} from "../../src/utils/protocol";

describe("checkProtocolVersion", () => {
  it("accepts a valid protocol version", () => {
    const result = checkProtocolVersion({ protocolVersion: 1 });
    expect(result.ok).toBe(true);
    expect(result.clientVersion).toBe(1);
  });

  it("accepts a version greater than minimum", () => {
    const result = checkProtocolVersion({ protocolVersion: 999 });
    expect(result.ok).toBe(true);
    expect(result.clientVersion).toBe(999);
  });

  it("rejects when protocolVersion is missing", () => {
    const result = checkProtocolVersion({});
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Missing protocolVersion/);
  });

  it("rejects when protocolVersion is null", () => {
    const result = checkProtocolVersion({ protocolVersion: null });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Missing protocolVersion/);
  });

  it("rejects when protocolVersion is not a number", () => {
    const result = checkProtocolVersion({ protocolVersion: "1" });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Invalid protocolVersion/);
  });

  it("rejects when protocolVersion is NaN", () => {
    const result = checkProtocolVersion({ protocolVersion: NaN });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Invalid protocolVersion/);
  });

  it("rejects when protocolVersion is below minimum", () => {
    const result = checkProtocolVersion({ protocolVersion: 0 });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/update required/);
    expect(result.clientVersion).toBe(0);
  });

  it("exports consistent version constants", () => {
    expect(SERVER_PROTOCOL_VERSION).toBeGreaterThanOrEqual(
      MINIMUM_PROTOCOL_VERSION,
    );
    expect(MINIMUM_PROTOCOL_VERSION).toBeGreaterThanOrEqual(1);
  });
});
