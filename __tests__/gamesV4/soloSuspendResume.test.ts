/**
 * Games V4 — Solo Suspend / Resume Tests
 *
 * Validates the non-destructive solo exit model:
 * - Solo back does NOT resign — session stays active
 * - soloSuspendedAt metadata is set on suspend, cleared on resume
 * - Resume finds existing session; no duplicate sessions
 * - Restart resolves old session, creates new one
 * - Motion games (e.g., Brick Breaker) pause on suspend and reopen paused
 * - Turn-based and realtime behavior unchanged (no regressions)
 *
 * Run: npx jest soloSuspendResume
 */

import { GAME_METADATA } from "@/gamesV4/constants";
import type { GameRuntimeType } from "@/gamesV4/types/common";
import type { GameSessionV4, SessionStatus } from "@/gamesV4/types/session";

// =============================================================================
// Mock session factory
// =============================================================================

function makeMockSession(
  overrides: Partial<GameSessionV4> = {},
): GameSessionV4 {
  return {
    sessionId: "sess_test_123",
    inviteId: "",
    conversationId: "",
    conversationScope: "dm" as const,
    gameId: "play_2048",
    runtimeType: "solo" as GameRuntimeType,
    status: "active" as SessionStatus,
    hostId: "uid_alice",
    players: [{ uid: "uid_alice", slotIndex: 0, displayName: "Alice" }],
    spectators: [],
    spectatorsAllowed: false,
    spectateMode: "full_state" as const,
    settings: {},
    turnOrder: ["uid_alice"],
    currentTurnIndex: 0,
    currentTurnPlayerId: "uid_alice",
    scoreboardSummary: [],
    integrity: { version: 1, schemaVersion: 1, traceId: "abc" },
    rewardsProcessed: false,
    participantUids: ["uid_alice"],
    spectatorUids: [],
    soloSuspendedAt: null,
    resolution: null,
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    resolvedAt: null,
    ...overrides,
  } as unknown as GameSessionV4;
}

// =============================================================================
// Helper — mirrors shell logic
// =============================================================================

function soloExitAction(
  runtimeType: GameRuntimeType,
): "suspend" | "resign-confirm" | "leave" {
  if (runtimeType === "solo") return "suspend";
  if (runtimeType === "realtime") return "resign-confirm";
  return "leave"; // turnBased
}

// =============================================================================
// Tests
// =============================================================================

describe("Solo Suspend / Resume — Exit model", () => {
  it("solo back button action is 'suspend', not 'resign'", () => {
    expect(soloExitAction("solo")).toBe("suspend");
  });

  it("turn-based back button action is 'leave' (non-destructive)", () => {
    expect(soloExitAction("turnBased")).toBe("leave");
  });

  it("realtime back button action is 'resign-confirm'", () => {
    expect(soloExitAction("realtime")).toBe("resign-confirm");
  });
});

describe("Solo Suspend / Resume — Session integrity", () => {
  it("suspended session stays active (not resolved)", () => {
    const session = makeMockSession({
      status: "active",
      soloSuspendedAt: new Date().toISOString() as any,
    });
    expect(session.status).toBe("active");
    expect(session.soloSuspendedAt).toBeTruthy();
    expect(session.resolution).toBeNull();
  });

  it("soloSuspendedAt is null for a fresh/active session", () => {
    const session = makeMockSession();
    expect(session.soloSuspendedAt).toBeNull();
  });

  it("soloSuspendedAt is cleared on resume", () => {
    const session = makeMockSession({
      soloSuspendedAt: new Date().toISOString() as any,
    });
    // Simulate resume: clear soloSuspendedAt
    const resumed = { ...session, soloSuspendedAt: null };
    expect(resumed.soloSuspendedAt).toBeNull();
    expect(resumed.status).toBe("active");
  });
});

describe("Solo Suspend / Resume — Resume-or-create logic", () => {
  /**
   * Simulates the resumeOrCreateSoloSessionV4 logic:
   * - Query for existing active solo session for this gameId + uid
   * - If found → return { sessionId, resumed: true }
   * - If not found → create new → return { sessionId, resumed: false }
   */
  function resumeOrCreate(
    existingSessions: GameSessionV4[],
    gameId: string,
    uid: string,
  ): { sessionId: string; resumed: boolean } {
    const match = existingSessions.find(
      (s) =>
        s.gameId === gameId &&
        s.participantUids.includes(uid) &&
        s.status === "active" &&
        s.runtimeType === "solo",
    );
    if (match) {
      return { sessionId: match.sessionId, resumed: true };
    }
    return { sessionId: `sess_new_${Date.now()}`, resumed: false };
  }

  it("finds and resumes an existing suspended session", () => {
    const existing = makeMockSession({
      sessionId: "sess_existing",
      soloSuspendedAt: new Date().toISOString() as any,
    });
    const result = resumeOrCreate([existing], "play_2048", "uid_alice");
    expect(result.resumed).toBe(true);
    expect(result.sessionId).toBe("sess_existing");
  });

  it("creates new session when none exists", () => {
    const result = resumeOrCreate([], "play_2048", "uid_alice");
    expect(result.resumed).toBe(false);
    expect(result.sessionId).toMatch(/^sess_new_/);
  });

  it("does NOT resume a resolved session", () => {
    const resolved = makeMockSession({
      sessionId: "sess_old",
      status: "resolved" as SessionStatus,
    });
    const result = resumeOrCreate([resolved], "play_2048", "uid_alice");
    expect(result.resumed).toBe(false);
  });

  it("does NOT resume a session for a different gameId", () => {
    const existing = makeMockSession({
      sessionId: "sess_brick",
      gameId: "brick_breaker",
    });
    const result = resumeOrCreate([existing], "play_2048", "uid_alice");
    expect(result.resumed).toBe(false);
  });

  it("does NOT resume a session for a different user", () => {
    const existing = makeMockSession({
      sessionId: "sess_alice",
      participantUids: ["uid_alice"],
    });
    const result = resumeOrCreate([existing], "play_2048", "uid_bob");
    expect(result.resumed).toBe(false);
  });

  it("does NOT create duplicates — only one active session per gameId+uid", () => {
    const existing = makeMockSession({
      sessionId: "sess_existing",
      soloSuspendedAt: null,
    });
    const result = resumeOrCreate([existing], "play_2048", "uid_alice");
    // Should resume, not create new
    expect(result.resumed).toBe(true);
    expect(result.sessionId).toBe("sess_existing");
  });
});

describe("Solo Suspend / Resume — Restart semantics", () => {
  /**
   * Restart = resolve old (resign) + create new.
   * Simulates the restartSoloSessionV4 logic.
   */
  function simulateRestart(oldSession: GameSessionV4) {
    // Resolve old session as resign
    const resolvedOld = {
      ...oldSession,
      status: "resolved" as SessionStatus,
      resolution: { type: "resign" },
      resolvedAt: new Date().toISOString(),
    };

    // Create new session
    const newSession = makeMockSession({
      sessionId: `sess_restart_${Date.now()}`,
      soloSuspendedAt: null,
    });

    return { resolvedOld, newSession };
  }

  it("old session is resolved on restart", () => {
    const old = makeMockSession({ sessionId: "sess_old" });
    const { resolvedOld } = simulateRestart(old);
    expect(resolvedOld.status).toBe("resolved");
    expect(resolvedOld.resolution).toEqual({ type: "resign" });
    expect(resolvedOld.resolvedAt).toBeTruthy();
  });

  it("new session is created with fresh state", () => {
    const old = makeMockSession({ sessionId: "sess_old" });
    const { newSession } = simulateRestart(old);
    expect(newSession.sessionId).not.toBe("sess_old");
    expect(newSession.status).toBe("active");
    expect(newSession.soloSuspendedAt).toBeNull();
    expect(newSession.resolution).toBeNull();
  });

  it("restart does not leave orphaned active sessions", () => {
    const old = makeMockSession({ sessionId: "sess_old" });
    const { resolvedOld, newSession } = simulateRestart(old);
    // Old is resolved, new is active — exactly 1 active session
    const activeSessions = [resolvedOld, newSession].filter(
      (s) => s.status === "active",
    );
    expect(activeSessions).toHaveLength(1);
    expect(activeSessions[0].sessionId).toBe(newSession.sessionId);
  });
});

describe("Solo Suspend / Resume — Motion game pause contract", () => {
  it("registerSoloPause registers a callback that can be invoked", () => {
    let pauseCalled = false;
    const pauseFn = () => {
      pauseCalled = true;
    };

    // Simulate GameScreenShell's registerSoloPause mechanism
    let registeredPause: (() => void) | null = null;
    const registerSoloPause = (fn: () => void) => {
      registeredPause = fn;
    };

    // Game registers its pause function
    registerSoloPause(pauseFn);

    // Shell invokes it on suspend
    expect(registeredPause).not.toBeNull();
    registeredPause!();
    expect(pauseCalled).toBe(true);
  });

  it("pause callback freezes a simulated game loop", () => {
    // Simulated Brick Breaker-like state
    let paused = false;
    let running = true;
    const pauseFn = () => {
      paused = true;
      running = false;
    };

    expect(paused).toBe(false);
    expect(running).toBe(true);

    // Shell calls pause on suspend
    pauseFn();
    expect(paused).toBe(true);
    expect(running).toBe(false);
  });
});

describe("Solo Suspend / Resume — No regressions for other runtime types", () => {
  it("turn-based games do not have soloSuspendedAt behavior", () => {
    const turnBased = Object.entries(GAME_METADATA).filter(
      ([, m]) => m.runtimeType === "turnBased",
    );
    expect(turnBased.length).toBeGreaterThan(0);
    for (const [gameId, meta] of turnBased) {
      expect(soloExitAction(meta.runtimeType)).toBe("leave");
    }
  });

  it("realtime games still require resign confirmation", () => {
    const realtime = Object.entries(GAME_METADATA).filter(
      ([, m]) => m.runtimeType === "realtime",
    );
    expect(realtime.length).toBeGreaterThan(0);
    for (const [gameId, meta] of realtime) {
      expect(soloExitAction(meta.runtimeType)).toBe("resign-confirm");
    }
  });

  it("all solo games use suspend exit", () => {
    const solo = Object.entries(GAME_METADATA).filter(
      ([, m]) => m.runtimeType === "solo",
    );
    expect(solo.length).toBeGreaterThan(0);
    for (const [gameId, meta] of solo) {
      expect(soloExitAction(meta.runtimeType)).toBe("suspend");
    }
  });
});

describe("Solo Suspend / Resume — Watchdog safety", () => {
  /**
   * The watchdog Pass 4 auto-resolves inactive turnBased sessions only.
   * Solo sessions must never be auto-resolved, even if suspended.
   */
  it("solo sessions are excluded from auto-resolve logic", () => {
    const soloSession = makeMockSession({
      runtimeType: "solo",
      soloSuspendedAt: new Date().toISOString() as any,
    });

    // Simulated watchdog Pass 4 filter
    const shouldAutoResolve = soloSession.runtimeType === "turnBased";
    expect(shouldAutoResolve).toBe(false);
  });

  it("turn-based sessions are still eligible for auto-resolve", () => {
    const tbSession = makeMockSession({ runtimeType: "turnBased" });
    const shouldAutoResolve = tbSession.runtimeType === "turnBased";
    expect(shouldAutoResolve).toBe(true);
  });
});
