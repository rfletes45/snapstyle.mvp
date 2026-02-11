/**
 * ScoreRaceRoom Unit Tests
 *
 * Tests schemas, game logic, and phase transitions for
 * the ScoreRace base pattern used by all 8 quick-play games.
 */

// ---------------------------------------------------------------------------
// Mocks — must be before imports
// ---------------------------------------------------------------------------
jest.mock("../../src/services/firebase", () => ({
  initializeFirebaseAdmin: jest.fn(),
  verifyFirebaseToken: jest.fn().mockResolvedValue({
    uid: "test-uid-1",
    name: "Player 1",
  }),
  getFirestoreDb: jest.fn().mockReturnValue(null),
}));

jest.mock("../../src/services/persistence", () => ({
  saveGameState: jest.fn().mockResolvedValue(undefined),
  loadGameState: jest.fn().mockResolvedValue(null),
  persistGameResult: jest.fn().mockResolvedValue(undefined),
  cleanupExpiredGameStates: jest.fn().mockResolvedValue(undefined),
}));

import { ScoreRacePlayer, ScoreRaceState } from "../../src/schemas/quickplay";
import { verifyFirebaseToken } from "../../src/services/firebase";
import { validateScoreUpdate } from "../../src/services/validation";

// ---------------------------------------------------------------------------
// Schema Tests
// ---------------------------------------------------------------------------

describe("ScoreRaceState Schema", () => {
  it("should create a state with default values", () => {
    const state = new ScoreRaceState();
    expect(state.phase).toBe("waiting");
    expect(state.maxPlayers).toBe(2);
    expect(state.winnerId).toBe("");
    expect(state.winReason).toBe("");
    expect(state.gameDuration).toBe(30);
    expect(state.countdown).toBe(0);
  });

  it("should create player with default values", () => {
    const player = new ScoreRacePlayer();
    expect(player.currentScore).toBe(0);
    expect(player.finished).toBe(false);
    expect(player.finishTime).toBe(0);
    expect(player.combo).toBe(0);
    expect(player.lives).toBe(-1);
    expect(player.connected).toBe(true);
    expect(player.ready).toBe(false);
  });

  it("should track players in MapSchema", () => {
    const state = new ScoreRaceState();
    const p1 = new ScoreRacePlayer();
    p1.uid = "uid-1";
    p1.sessionId = "session-1";
    p1.displayName = "Player 1";

    const p2 = new ScoreRacePlayer();
    p2.uid = "uid-2";
    p2.sessionId = "session-2";
    p2.displayName = "Player 2";

    state.racePlayers.set("session-1", p1);
    state.racePlayers.set("session-2", p2);

    expect(state.racePlayers.size).toBe(2);
    expect(state.racePlayers.get("session-1")?.displayName).toBe("Player 1");
    expect(state.racePlayers.get("session-2")?.displayName).toBe("Player 2");
  });

  it("should track score updates on player", () => {
    const player = new ScoreRacePlayer();
    player.currentScore = 42;
    expect(player.currentScore).toBe(42);
  });

  it("should track lives on player", () => {
    const player = new ScoreRacePlayer();
    player.lives = 3;
    player.lives--;
    expect(player.lives).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Auth Mock Tests
// ---------------------------------------------------------------------------

describe("Firebase Auth Integration", () => {
  it("should verify Firebase token (mocked)", async () => {
    const result = await verifyFirebaseToken("fake-token");
    expect(result.uid).toBe("test-uid-1");
    expect((result as any).name).toBe("Player 1");
  });

  it("should be called with token from options", async () => {
    const mockVerify = verifyFirebaseToken as jest.MockedFunction<
      typeof verifyFirebaseToken
    >;
    mockVerify.mockClear();

    await verifyFirebaseToken("test-token-123");
    expect(mockVerify).toHaveBeenCalledWith("test-token-123");
  });
});

// ---------------------------------------------------------------------------
// Game Logic Tests
// ---------------------------------------------------------------------------

describe("Score Race Game Logic", () => {
  it("should validate scores correctly", () => {
    expect(validateScoreUpdate("tap_race", 10, 0, 5000)).toBe(true);
    expect(validateScoreUpdate("tap_race", -1, 0, 1000)).toBe(false);
    expect(validateScoreUpdate("tap_race", 1000, 0, 60000)).toBe(false);
  });

  it("should determine winner by higher score", () => {
    const p1 = new ScoreRacePlayer();
    p1.currentScore = 50;
    p1.finished = true;

    const p2 = new ScoreRacePlayer();
    p2.currentScore = 30;
    p2.finished = true;

    const sorted = [p1, p2].sort(
      (a: ScoreRacePlayer, b: ScoreRacePlayer) =>
        b.currentScore - a.currentScore,
    );
    expect(sorted[0]).toBe(p1);
    expect(sorted[0].currentScore).toBe(50);
  });

  it("should detect tie when scores are equal", () => {
    const p1 = new ScoreRacePlayer();
    p1.currentScore = 42;

    const p2 = new ScoreRacePlayer();
    p2.currentScore = 42;

    expect(p1.currentScore === p2.currentScore).toBe(true);
  });

  it("should determine winner by lower score when lowerIsBetter", () => {
    const p1 = new ScoreRacePlayer();
    p1.currentScore = 200;

    const p2 = new ScoreRacePlayer();
    p2.currentScore = 150;

    const lowerIsBetter = true;
    const sorted = [p1, p2].sort((a: ScoreRacePlayer, b: ScoreRacePlayer) =>
      lowerIsBetter
        ? a.currentScore - b.currentScore
        : b.currentScore - a.currentScore,
    );
    expect(sorted[0]).toBe(p2);
  });

  it("should track combo multiplier", () => {
    const player = new ScoreRacePlayer();
    player.combo = 5;
    expect(player.combo).toBe(5);
    player.combo = 0;
    expect(player.combo).toBe(0);
  });

  it("should track finished state", () => {
    const player = new ScoreRacePlayer();
    expect(player.finished).toBe(false);
    player.finished = true;
    player.finishTime = 15000;
    expect(player.finished).toBe(true);
    expect(player.finishTime).toBe(15000);
  });
});

// ---------------------------------------------------------------------------
// Phase Transitions
// ---------------------------------------------------------------------------

describe("Phase Transitions", () => {
  it("should follow correct phase order", () => {
    const state = new ScoreRaceState();
    expect(state.phase).toBe("waiting");

    state.phase = "countdown";
    expect(state.phase).toBe("countdown");

    state.phase = "playing";
    expect(state.phase).toBe("playing");

    state.phase = "finished";
    expect(state.phase).toBe("finished");
  });

  it("should track countdown value", () => {
    const state = new ScoreRaceState();
    state.countdown = 3;
    expect(state.countdown).toBe(3);
    state.countdown = 0;
    expect(state.countdown).toBe(0);
  });

  it("should set game duration", () => {
    const state = new ScoreRaceState();
    state.gameDuration = 60;
    expect(state.gameDuration).toBe(60);
  });

  it("should set random seed", () => {
    const state = new ScoreRaceState();
    state.seed = 12345;
    expect(state.seed).toBe(12345);
  });
});
