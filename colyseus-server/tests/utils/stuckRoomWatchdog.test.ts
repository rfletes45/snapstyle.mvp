/**
 * Tests for stuckRoomWatchdog utility
 */
import type { ServerLogger } from "../../src/utils/logger";
import { createStuckRoomWatchdog } from "../../src/utils/stuckRoomWatchdog";

// Mock logger
function createMockLogger(): ServerLogger & { calls: Record<string, any[][]> } {
  const calls: Record<string, any[][]> = {
    info: [],
    warn: [],
    error: [],
    debug: [],
  };
  return {
    info: jest.fn((...args: any[]) => calls.info.push(args)),
    warn: jest.fn((...args: any[]) => calls.warn.push(args)),
    error: jest.fn((...args: any[]) => calls.error.push(args)),
    debug: jest.fn((...args: any[]) => calls.debug.push(args)),
    child: jest.fn(function (this: any) {
      return this;
    }),
    calls,
  } as any;
}

// Mock room-like object
function createMockRoom(overrides: Record<string, any> = {}) {
  return {
    roomId: "test-room-123",
    clients: overrides.clients ?? [{ id: "c1" }, { id: "c2" }],
    state: {
      phase: overrides.phase ?? "waiting",
      players: { size: overrides.playerCount ?? 2 },
      maxPlayers: 2,
      firestoreGameId: overrides.firestoreGameId ?? "game-abc",
      ...overrides.state,
    },
  };
}

describe("stuckRoomWatchdog", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should not log if room reaches playing before timeout", () => {
    const logger = createMockLogger();
    const room = createMockRoom();
    const wd = createStuckRoomWatchdog(room, logger, 5000);

    // Room starts playing before timeout
    room.state.phase = "playing";
    wd.markPlaying();

    jest.advanceTimersByTime(6000);

    expect(logger.warn).not.toHaveBeenCalled();
    wd.dispose();
  });

  it("should log warning if room stays in waiting with 2+ clients", () => {
    const logger = createMockLogger();
    const room = createMockRoom({ phase: "waiting" });
    const wd = createStuckRoomWatchdog(room, logger, 5000);

    jest.advanceTimersByTime(5000);

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      "STUCK_ROOM: Room has not reached playing phase",
      expect.objectContaining({
        roomId: "test-room-123",
        phase: "waiting",
        clientCount: 2,
      }),
    );
    wd.dispose();
  });

  it("should not log if fewer than 2 clients", () => {
    const logger = createMockLogger();
    const room = createMockRoom({ clients: [{ id: "c1" }], playerCount: 1 });
    const wd = createStuckRoomWatchdog(room, logger, 5000);

    jest.advanceTimersByTime(5000);

    expect(logger.warn).not.toHaveBeenCalled();
    wd.dispose();
  });

  it("should not log if dispose is called before timeout", () => {
    const logger = createMockLogger();
    const room = createMockRoom();
    const wd = createStuckRoomWatchdog(room, logger, 5000);

    wd.dispose();
    jest.advanceTimersByTime(6000);

    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("should not log if room is already in finished phase at timeout", () => {
    const logger = createMockLogger();
    const room = createMockRoom({ phase: "waiting" });
    const wd = createStuckRoomWatchdog(room, logger, 5000);

    // Room finishes before timeout fires
    room.state.phase = "finished";
    jest.advanceTimersByTime(5000);

    expect(logger.warn).not.toHaveBeenCalled();
    wd.dispose();
  });

  it("should include firestoreGameId in log context", () => {
    const logger = createMockLogger();
    const room = createMockRoom({ firestoreGameId: "my-game-id" });
    const wd = createStuckRoomWatchdog(room, logger, 5000);

    jest.advanceTimersByTime(5000);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        firestoreGameId: "my-game-id",
      }),
    );
    wd.dispose();
  });
});
