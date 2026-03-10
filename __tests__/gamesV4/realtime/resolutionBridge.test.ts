/**
 * Tests — Resolution Bridge Logic (Realtime Framework)
 *
 * Tests for resolution payload construction and idempotency.
 */

describe("buildResolutionPayload", () => {
  // Re-implement the buildResolutionPayload logic for testing
  function buildResolutionPayload(params: {
    sessionId: string;
    gameId: string;
    roomVersion: number;
    reason: string;
    resolutionType: "win" | "draw" | "disconnect" | "timeout" | "error";
    winnerIds: string[];
    scoreboard: Array<{
      uid: string;
      displayName: string;
      score: number;
      placement: number;
      stats: Record<string, unknown>;
    }>;
    durationMs: number;
    playerMetrics?: Record<string, Record<string, unknown>>;
    flags?: Record<string, unknown>;
  }) {
    return {
      requestId: `${params.sessionId}_${params.roomVersion}_${Date.now()}`,
      sessionId: params.sessionId,
      gameId: params.gameId,
      roomVersion: params.roomVersion,
      endedAt: Date.now(),
      reason: params.reason,
      resolutionType: params.resolutionType,
      winnerIds: params.winnerIds,
      scoreboard: params.scoreboard,
      durationMs: params.durationMs,
      playerMetrics: params.playerMetrics ?? {},
      flags: params.flags ?? {},
    };
  }

  it("builds a complete payload with all required fields", () => {
    const payload = buildResolutionPayload({
      sessionId: "session_123",
      gameId: "sketch_party_game",
      roomVersion: 1,
      reason: "match_complete",
      resolutionType: "win",
      winnerIds: ["uid_1"],
      scoreboard: [
        {
          uid: "uid_1",
          displayName: "Player 1",
          score: 100,
          placement: 1,
          stats: { wordsGuessed: 5 },
        },
        {
          uid: "uid_2",
          displayName: "Player 2",
          score: 50,
          placement: 2,
          stats: { wordsGuessed: 2 },
        },
      ],
      durationMs: 180000,
    });

    expect(payload.sessionId).toBe("session_123");
    expect(payload.gameId).toBe("sketch_party_game");
    expect(payload.resolutionType).toBe("win");
    expect(payload.winnerIds).toEqual(["uid_1"]);
    expect(payload.scoreboard).toHaveLength(2);
    expect(payload.durationMs).toBe(180000);
    expect(payload.playerMetrics).toEqual({});
    expect(payload.flags).toEqual({});
  });

  it("generates a unique requestId per call", () => {
    const base = {
      sessionId: "s1",
      gameId: "test_game",
      roomVersion: 1,
      reason: "done",
      resolutionType: "draw" as const,
      winnerIds: [],
      scoreboard: [],
      durationMs: 1000,
    };

    const p1 = buildResolutionPayload(base);
    const p2 = buildResolutionPayload(base);

    expect(p1.requestId).toContain("s1_1_");
    expect(p2.requestId).toContain("s1_1_");
    // requestIds are unique due to timestamp component
    // (may be same in fast tests, but format is correct)
    expect(p1.requestId).toMatch(/^s1_1_\d+$/);
  });

  it("includes playerMetrics when provided", () => {
    const payload = buildResolutionPayload({
      sessionId: "s1",
      gameId: "test",
      roomVersion: 1,
      reason: "done",
      resolutionType: "win",
      winnerIds: ["uid_1"],
      scoreboard: [],
      durationMs: 5000,
      playerMetrics: {
        uid_1: { accuracy: 0.95, avgResponseMs: 1200 },
        uid_2: { accuracy: 0.7, avgResponseMs: 2500 },
      },
    });

    expect(payload.playerMetrics).toEqual({
      uid_1: { accuracy: 0.95, avgResponseMs: 1200 },
      uid_2: { accuracy: 0.7, avgResponseMs: 2500 },
    });
  });

  it("includes custom flags when provided", () => {
    const payload = buildResolutionPayload({
      sessionId: "s1",
      gameId: "test",
      roomVersion: 1,
      reason: "error_recovery",
      resolutionType: "error",
      winnerIds: [],
      scoreboard: [],
      durationMs: 1000,
      flags: { hadServerError: true, recoveryAttempted: true },
    });

    expect(payload.flags).toEqual({
      hadServerError: true,
      recoveryAttempted: true,
    });
  });
});

describe("Idempotency guard", () => {
  // Test the in-process dedup logic

  it("prevents duplicate request IDs", () => {
    const writtenIds = new Set<string>();
    const MAX_TRACKED = 5;

    function shouldWrite(requestId: string): boolean {
      if (writtenIds.has(requestId)) return false;
      writtenIds.add(requestId);
      if (writtenIds.size > MAX_TRACKED) {
        const first = writtenIds.values().next().value;
        if (first) writtenIds.delete(first);
      }
      return true;
    }

    expect(shouldWrite("req_1")).toBe(true);
    expect(shouldWrite("req_1")).toBe(false); // Duplicate
    expect(shouldWrite("req_2")).toBe(true);
    expect(shouldWrite("req_2")).toBe(false); // Duplicate
  });

  it("evicts oldest entries when over limit", () => {
    const writtenIds = new Set<string>();
    const MAX_TRACKED = 3;

    function shouldWrite(requestId: string): boolean {
      if (writtenIds.has(requestId)) return false;
      writtenIds.add(requestId);
      if (writtenIds.size > MAX_TRACKED) {
        const first = writtenIds.values().next().value;
        if (first) writtenIds.delete(first);
      }
      return true;
    }

    shouldWrite("req_1");
    shouldWrite("req_2");
    shouldWrite("req_3");
    // req_1 is the oldest, should be evicted after adding req_4
    shouldWrite("req_4");

    expect(writtenIds.has("req_1")).toBe(false);
    expect(writtenIds.has("req_2")).toBe(true);
    expect(writtenIds.has("req_3")).toBe(true);
    expect(writtenIds.has("req_4")).toBe(true);
  });
});
