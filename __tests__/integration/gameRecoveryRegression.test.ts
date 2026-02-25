/**
 * Game Recovery Regression Tests
 *
 * Tests the end-to-end flow that caused the "stuck card" bug:
 *   Game ended → terminal invite → Back to Hub → recovery banner persists
 *
 * Verifies:
 *   1. Terminal invite → recoverActiveSession returns null → bookmark cleared
 *   2. clearActiveSession before navigation → no stale bookmark
 *   3. Sequential flow: save → game ends → clear → recover returns null
 *   4. Focus-recheck after clear → no banner data
 *
 * @see src/services/gameRecovery.ts
 * @see src/hooks/useGameRecovery.ts
 * @see src/hooks/useColyseus.ts  (leaveRoom awaits clearActiveSession)
 * @see src/hooks/useGameBackHandler.ts (navigateToOrigin clears first)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Mocks ──────────────────────────────────────────────────────────────────

jest.mock("firebase/firestore", () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
}));

jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(() => ({
    currentUser: { uid: "user1" },
  })),
}));

jest.mock("@/services/gameInvites", () => ({
  completeGameInvite: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/utils/log", () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

jest.mock("@/types/games", () => ({
  __esModule: true,
  GAME_METADATA: {},
  GAME_RUNTIME_TYPE: {},
  EXTENDED_GAME_SCORE_LIMITS: {},
}));

jest.mock("@/config/gameCategories", () => ({
  __esModule: true,
  GAME_SCREEN_MAP: {
    chess: "ChessGame",
    battleship: "BattleshipGame",
    tic_tac_toe: "TicTacToeGame",
    crazy_eights: "CrazyEightsGame",
    pong_game: "PongGame",
    sketch_party_game: "SketchPartyGameScreen",
    crossword_puzzle: "CrosswordGame",
    minigolf_duels: "MiniGolfDuelsGame",
    starforge_game: "StarforgeGame",
  },
}));

// ─── Imports ────────────────────────────────────────────────────────────────

import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc } from "firebase/firestore";

import {
  clearActiveSession,
  recoverActiveSession,
  saveActiveSession,
  type ActiveSessionBookmark,
} from "@/services/gameRecovery";

// ─── Helpers ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "@snapstyle/active_game_session";

function makeBookmark(
  overrides: Partial<ActiveSessionBookmark> = {},
): ActiveSessionBookmark {
  return {
    inviteId: "inv_reg",
    gameType: "battleship",
    firestoreGameId: "ext_battleship_inv_reg",
    reconnectionToken: "tok_reg",
    conversationId: "conv_reg",
    isTurnBased: false,
    savedAt: Date.now(),
    userId: "user1",
    ...overrides,
  };
}

function mockFirestoreInvite(data: Record<string, any> | null): void {
  (doc as jest.Mock).mockReturnValue("invite-ref");
  if (data === null) {
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => false,
      id: "inv_reg",
      data: () => undefined,
    });
  } else {
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      id: data.id ?? "inv_reg",
      data: () => data,
    });
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Game Recovery Regression — Stuck Card Bug", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.clear as jest.Mock)?.();
  });

  // ────────────────────────────────────────────────────────────────────────
  // Core regression: terminal invite → no card
  // ────────────────────────────────────────────────────────────────────────

  describe("terminal invite → hub render → no card", () => {
    const TERMINAL_STATUSES = [
      "completed",
      "declined",
      "expired",
      "cancelled",
    ] as const;

    for (const status of TERMINAL_STATUSES) {
      it(`status="${status}" → recoverActiveSession returns null + bookmark cleared`, async () => {
        // Simulate: a bookmark exists from a game that just ended
        const bookmark = makeBookmark({ savedAt: Date.now() });
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
          JSON.stringify(bookmark),
        );
        mockFirestoreInvite({
          id: "inv_reg",
          status,
          chatVisibility: "hidden",
          conversationId: "conv_reg",
        });

        const result = await recoverActiveSession("user1");

        expect(result).toBeNull();
        expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
      });
    }
  });

  // ────────────────────────────────────────────────────────────────────────
  // Sequential flow: save → clear → recover
  // ────────────────────────────────────────────────────────────────────────

  describe("full lifecycle: save → clear → recover returns null", () => {
    it("simulates leaveRoom flow: save during game, clear on exit, recover finds nothing", async () => {
      // 1. Game starts — bookmark is saved
      await saveActiveSession({
        inviteId: "inv_lifecycle",
        gameType: "battleship",
        firestoreGameId: "ext_battleship_inv_lifecycle",
        isTurnBased: false,
        userId: "user1",
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);

      // 2. Game ends — clearActiveSession is called (as in leaveRoom / navigateToOrigin)
      await clearActiveSession();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);

      // 3. Hub mounts — recoverActiveSession finds no bookmark
      // AsyncStorage mock's removeItem should have cleared the value
      const result = await recoverActiveSession("user1");

      expect(result).toBeNull();
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Race condition — clearActiveSession BEFORE navigation
  // ────────────────────────────────────────────────────────────────────────

  describe("clearActiveSession must complete before hub reads bookmark", () => {
    it("awaited clear guarantees no stale read", async () => {
      // Setup a bookmark as if game was in progress
      const bookmark = makeBookmark({ savedAt: Date.now() });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(bookmark),
      );

      // Clear first (simulating navigateToOrigin's await clearActiveSession)
      await clearActiveSession();

      // Now hub mounts and attempts recovery — should find nothing
      // (getItem returns null after removeItem in the mock)
      const result = await recoverActiveSession("user1");

      expect(result).toBeNull();
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Focus recheck catches late clears
  // ────────────────────────────────────────────────────────────────────────

  describe("focus-triggered recheck catches late clears", () => {
    it("first check sees active invite, clear happens, second check returns null", async () => {
      // First call: bookmark exists, invite is active → recoverable
      const bookmark = makeBookmark({
        savedAt: Date.now(),
        gameType: "pong_game",
      });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(bookmark),
      );
      mockFirestoreInvite({
        id: "inv_reg",
        status: "active",
        conversationId: "conv_reg",
      });

      const firstResult = await recoverActiveSession("user1");
      expect(firstResult).not.toBeNull();
      expect(firstResult?.screenName).toBe("PongGame");

      // Game finishes in the background, bookmark cleared
      await clearActiveSession();

      // Second call: simulates useFocusEffect recheck
      const secondResult = await recoverActiveSession("user1");
      expect(secondResult).toBeNull();
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Unmount cleanup (useColyseus fix)
  // ────────────────────────────────────────────────────────────────────────

  describe("unmount cleanup prevents stuck card", () => {
    it("clearActiveSession on unmount removes bookmark for next hub mount", async () => {
      // Save a bookmark
      await saveActiveSession({
        inviteId: "inv_unmount",
        gameType: "sketch_party_game",
        firestoreGameId: "ext_sketch_party_game_inv_unmount",
        isTurnBased: false,
        userId: "user1",
      });

      // Simulate unmount calling clearActiveSession
      await clearActiveSession();

      // Hub recovery check finds nothing
      const result = await recoverActiveSession("user1");
      expect(result).toBeNull();
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // All realtime game types: end → no card
  // ────────────────────────────────────────────────────────────────────────

  describe("realtime game types: game ended → no stuck card", () => {
    const REALTIME_GAMES = [
      { gameType: "battleship", screen: "BattleshipGame" },
      { gameType: "pong_game", screen: "PongGame" },
      { gameType: "sketch_party_game", screen: "SketchPartyGameScreen" },
      { gameType: "crossword_puzzle", screen: "CrosswordGame" },
      { gameType: "minigolf_duels", screen: "MiniGolfDuelsGame" },
    ] as const;

    for (const { gameType, screen } of REALTIME_GAMES) {
      it(`${gameType}: completed invite → no recovery card`, async () => {
        const bookmark = makeBookmark({
          savedAt: Date.now(),
          gameType,
          inviteId: `inv_${gameType}`,
          firestoreGameId: `ext_${gameType}_inv_${gameType}`,
        });
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
          JSON.stringify(bookmark),
        );
        mockFirestoreInvite({
          id: `inv_${gameType}`,
          status: "completed",
          chatVisibility: "hidden",
          conversationId: "conv_test",
        });

        const result = await recoverActiveSession("user1");

        expect(result).toBeNull();
        expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
      });

      it(`${gameType}: active invite → recovery card renders`, async () => {
        const bookmark = makeBookmark({
          savedAt: Date.now(),
          gameType,
          inviteId: `inv_${gameType}_active`,
          firestoreGameId: `ext_${gameType}_inv_${gameType}_active`,
        });
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
          JSON.stringify(bookmark),
        );
        mockFirestoreInvite({
          id: `inv_${gameType}_active`,
          status: "active",
          conversationId: "conv_test",
        });

        const result = await recoverActiveSession("user1");

        expect(result).not.toBeNull();
        expect(result?.screenName).toBe(screen);
      });
    }
  });

  // ────────────────────────────────────────────────────────────────────────
  // End scenarios: disconnect, resign, normal win
  // ────────────────────────────────────────────────────────────────────────

  describe("end scenarios produce terminal status → no card", () => {
    const END_SCENARIOS = [
      { label: "normal win", status: "completed", chatVisibility: "hidden" },
      { label: "resign", status: "completed", chatVisibility: "hidden" },
      {
        label: "disconnect (watchdog)",
        status: "completed",
        chatVisibility: "hidden",
      },
      { label: "expired", status: "expired", chatVisibility: "hidden" },
      { label: "cancelled", status: "cancelled", chatVisibility: "hidden" },
    ] as const;

    for (const { label, status, chatVisibility } of END_SCENARIOS) {
      it(`${label} → status="${status}" → no recovery card`, async () => {
        const bookmark = makeBookmark({ savedAt: Date.now() });
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
          JSON.stringify(bookmark),
        );
        mockFirestoreInvite({
          id: "inv_reg",
          status,
          chatVisibility,
          conversationId: "conv_reg",
        });

        const result = await recoverActiveSession("user1");
        expect(result).toBeNull();
        expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
      });
    }
  });

  // ────────────────────────────────────────────────────────────────────────
  // Edge case: force close mid-end → reopen → hub not stuck
  // ────────────────────────────────────────────────────────────────────────

  describe("force close during game end → reopen → hub not stuck", () => {
    it("stale bookmark + terminal invite = cleared on recovery check", async () => {
      // Simulate: app killed right as game was ending, bookmark persists
      const bookmark = makeBookmark({
        savedAt: Date.now() - 60_000, // saved 1 minute ago
      });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(bookmark),
      );
      // By the time the user reopens, the server finalized the invite
      mockFirestoreInvite({
        id: "inv_reg",
        status: "completed",
        chatVisibility: "hidden",
        conversationId: "conv_reg",
        resolvedAt: Date.now() - 30_000,
      });

      const result = await recoverActiveSession("user1");

      expect(result).toBeNull();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it("stale bookmark + missing invite doc = cleared on recovery check", async () => {
      // Invite was hard-deleted (deleteAt expired)
      const bookmark = makeBookmark({
        savedAt: Date.now() - 7 * 3600_000, // 7 hours ago
      });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(bookmark),
      );
      mockFirestoreInvite(null); // doc doesn't exist

      const result = await recoverActiveSession("user1");

      expect(result).toBeNull();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Edge case: disconnect end → hub not stuck
  // ────────────────────────────────────────────────────────────────────────

  describe("disconnect during game → hub not stuck", () => {
    it("bookmark persists through disconnect but server finalized → cleared on check", async () => {
      // Simulate: user's connection dropped, bookmark still in AsyncStorage
      const bookmark = makeBookmark({
        savedAt: Date.now() - 300_000, // 5 min ago
        gameType: "battleship",
      });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(bookmark),
      );
      // Server detected disconnect and finalized
      mockFirestoreInvite({
        id: "inv_reg",
        status: "completed",
        chatVisibility: "hidden",
        resolutionType: "disconnect",
        resolvedBy: "room",
        conversationId: "conv_reg",
      });

      const result = await recoverActiveSession("user1");

      expect(result).toBeNull();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it("bookmark persists through disconnect but invite STILL active → shows recovery", async () => {
      // Reconnection grace window hasn't expired yet
      const bookmark = makeBookmark({
        savedAt: Date.now() - 10_000, // 10 seconds ago
        gameType: "battleship",
      });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(bookmark),
      );
      mockFirestoreInvite({
        id: "inv_reg",
        status: "active",
        conversationId: "conv_reg",
      });

      const result = await recoverActiveSession("user1");

      expect(result).not.toBeNull();
      expect(result?.screenName).toBe("BattleshipGame");
    });
  });
});
