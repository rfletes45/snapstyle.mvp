/**
 * Tests for gameErrors — STUCK_WAITING, ROOM_STALE codes and defaults
 */
import {
  GameErrorCode,
  createGameError,
  getUserMessage,
} from "../../src/types/gameErrors";

describe("GameErrorCode extensions (Segment 6)", () => {
  it("should have STUCK_WAITING code", () => {
    expect(GameErrorCode.STUCK_WAITING).toBe("STUCK_WAITING");
  });

  it("should have ROOM_STALE code", () => {
    expect(GameErrorCode.ROOM_STALE).toBe("ROOM_STALE");
  });

  it("should return user message for STUCK_WAITING", () => {
    const msg = getUserMessage(GameErrorCode.STUCK_WAITING);
    expect(msg).toContain("stuck");
  });

  it("should return user message for ROOM_STALE", () => {
    const msg = getUserMessage(GameErrorCode.ROOM_STALE);
    expect(msg).toContain("server");
  });

  it("should create STUCK_WAITING error with default recoveries", () => {
    const error = createGameError(GameErrorCode.STUCK_WAITING);
    expect(error.code).toBe("STUCK_WAITING");
    expect(error.recoveries).toBeDefined();
    expect(error.recoveries!.length).toBeGreaterThanOrEqual(3);

    const ids = error.recoveries!.map((r) => r.id);
    expect(ids).toContain("rejoin_room");
    expect(ids).toContain("reset_lobby");
    expect(ids).toContain("report_bug");
    expect(ids).toContain("cancel_invite");
  });

  it("should create ROOM_STALE error with resync + report bug", () => {
    const error = createGameError(GameErrorCode.ROOM_STALE);
    expect(error.code).toBe("ROOM_STALE");
    expect(error.recoveries).toBeDefined();

    const ids = error.recoveries!.map((r) => r.id);
    expect(ids).toContain("rejoin_room");
    expect(ids).toContain("report_bug");
  });

  it("should allow overriding message in STUCK_WAITING", () => {
    const error = createGameError(GameErrorCode.STUCK_WAITING, {
      message: "Custom stuck message",
    });
    expect(error.message).toBe("Custom stuck message");
    // Should still have default recoveries
    expect(error.recoveries!.length).toBeGreaterThanOrEqual(3);
  });

  it("should allow overriding recoveries", () => {
    const error = createGameError(GameErrorCode.STUCK_WAITING, {
      recoveries: [{ id: "retry_join", label: "Custom Retry" }],
    });
    expect(error.recoveries).toHaveLength(1);
    expect(error.recoveries![0].label).toBe("Custom Retry");
  });
});
