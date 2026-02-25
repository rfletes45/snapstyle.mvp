/**
 * Game Recovery Service Tests
 *
 * Tests for `src/services/gameRecovery.ts`:
 *   - saveActiveSession / clearActiveSession / updateReconnectionToken
 *   - getActiveSessionBookmark
 *   - recoverActiveSession (Firestore validation, stale/wrong-user guards,
 *     terminal self-heal, screen-name resolution)
 *
 * Uses jest.mock to mock AsyncStorage, Firestore, and GAME_SCREEN_MAP.
 *
 * @see src/services/gameRecovery.ts
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Mocks (must be declared before imports) ────────────────────────────────

jest.mock("firebase/firestore", () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
}));

jest.mock("@/services/gameInvites", () => ({
  completeGameInvite: jest.fn(),
}));

jest.mock("@/utils/log", () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// Mock @/types/games to prevent transitive resolution failures when
// gameCategories is dynamically imported inside recoverActiveSession.
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
    starforge_game: "StarforgeGame",
    sketch_party_game: "SketchPartyGameScreen",
    crossword_puzzle: "CrosswordGame",
    pong_game: "PongGame",
    minigolf_duels: "MiniGolfDuelsGame",
  },
}));

// ─── Imports ────────────────────────────────────────────────────────────────

import { completeGameInvite } from "@/services/gameInvites";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc } from "firebase/firestore";

import {
  clearActiveSession,
  getActiveSessionBookmark,
  recoverActiveSession,
  saveActiveSession,
  updateReconnectionToken,
  type ActiveSessionBookmark,
} from "@/services/gameRecovery";

// ─── Helpers ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "@snapstyle/active_game_session";

function makeBookmark(
  overrides: Partial<ActiveSessionBookmark> = {},
): ActiveSessionBookmark {
  return {
    inviteId: "inv_123",
    gameType: "chess",
    firestoreGameId: "game_123",
    reconnectionToken: "tok_abc",
    conversationId: "conv_abc",
    isTurnBased: false,
    savedAt: Date.now(),
    userId: "user1",
    ...overrides,
  };
}

function mockFirestoreInvite(data: Record<string, any> | null): void {
  (doc as jest.Mock).mockReturnValue("invite-ref");

  if (data === null) {
    // doc doesn't exist
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => false,
      id: "inv_123",
      data: () => undefined,
    });
  } else {
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      id: data.id ?? "inv_123",
      data: () => data,
    });
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("gameRecovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear AsyncStorage between tests (using the official mock's API)
    (AsyncStorage.clear as jest.Mock)?.();
  });

  // ─── saveActiveSession ──────────────────────────────────────────────

  describe("saveActiveSession", () => {
    it("persists a bookmark to AsyncStorage with savedAt timestamp", async () => {
      const before = Date.now();

      await saveActiveSession({
        inviteId: "inv_1",
        gameType: "chess",
        firestoreGameId: "game_1",
        isTurnBased: false,
        userId: "user1",
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);

      const [key, value] = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      expect(key).toBe(STORAGE_KEY);

      const parsed = JSON.parse(value);
      expect(parsed.inviteId).toBe("inv_1");
      expect(parsed.gameType).toBe("chess");
      expect(parsed.savedAt).toBeGreaterThanOrEqual(before);
      expect(parsed.savedAt).toBeLessThanOrEqual(Date.now());
    });

    it("includes optional fields when provided", async () => {
      await saveActiveSession({
        inviteId: "inv_2",
        gameType: "battleship",
        firestoreGameId: "game_2",
        reconnectionToken: "tok_xyz",
        conversationId: "conv_xyz",
        isTurnBased: false,
        userId: "user2",
      });

      const [, value] = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const parsed = JSON.parse(value);
      expect(parsed.reconnectionToken).toBe("tok_xyz");
      expect(parsed.conversationId).toBe("conv_xyz");
    });

    it("does not throw if AsyncStorage fails", async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error("storage full"),
      );

      // Should not throw
      await expect(
        saveActiveSession({
          inviteId: "inv_fail",
          gameType: "chess",
          isTurnBased: false,
          userId: "user1",
        }),
      ).resolves.toBeUndefined();
    });
  });

  // ─── clearActiveSession ─────────────────────────────────────────────

  describe("clearActiveSession", () => {
    it("removes the bookmark from AsyncStorage", async () => {
      await clearActiveSession();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it("does not throw if AsyncStorage fails", async () => {
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(
        new Error("io error"),
      );

      await expect(clearActiveSession()).resolves.toBeUndefined();
    });
  });

  // ─── updateReconnectionToken ────────────────────────────────────────

  describe("updateReconnectionToken", () => {
    it("updates the token in an existing bookmark", async () => {
      const bookmark = makeBookmark({ reconnectionToken: "old_tok" });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(bookmark),
      );

      await updateReconnectionToken("new_tok");

      expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
      const [, value] = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const parsed = JSON.parse(value);
      expect(parsed.reconnectionToken).toBe("new_tok");
    });

    it("does nothing if no bookmark exists", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      await updateReconnectionToken("new_tok");

      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it("refreshes savedAt timestamp", async () => {
      const oldSavedAt = Date.now() - 60000;
      const bookmark = makeBookmark({ savedAt: oldSavedAt });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(bookmark),
      );

      const before = Date.now();
      await updateReconnectionToken("tok_fresh");

      const [, value] = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const parsed = JSON.parse(value);
      expect(parsed.savedAt).toBeGreaterThanOrEqual(before);
    });
  });

  // ─── getActiveSessionBookmark ───────────────────────────────────────

  describe("getActiveSessionBookmark", () => {
    it("returns parsed bookmark when present", async () => {
      const bookmark = makeBookmark();
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(bookmark),
      );

      const result = await getActiveSessionBookmark();
      expect(result).toEqual(bookmark);
    });

    it("returns null when no bookmark stored", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      const result = await getActiveSessionBookmark();
      expect(result).toBeNull();
    });

    it("returns null on parse error", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce("{bad json");

      const result = await getActiveSessionBookmark();
      expect(result).toBeNull();
    });
  });

  // ─── recoverActiveSession ──────────────────────────────────────────

  describe("recoverActiveSession", () => {
    it("returns null when no bookmark exists", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      const result = await recoverActiveSession("user1");
      expect(result).toBeNull();
    });

    it("clears bookmark and returns null if wrong user", async () => {
      const bookmark = makeBookmark({ userId: "user1" });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(bookmark),
      );

      const result = await recoverActiveSession("different_user");

      expect(result).toBeNull();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it("clears bookmark and returns null if stale (>3h)", async () => {
      const staleBookmark = makeBookmark({
        savedAt: Date.now() - 4 * 60 * 60 * 1000, // 4 hours ago
      });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(staleBookmark),
      );

      const result = await recoverActiveSession("user1");

      expect(result).toBeNull();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it("clears bookmark and returns null if invite not found", async () => {
      const bookmark = makeBookmark({ savedAt: Date.now() });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(bookmark),
      );
      mockFirestoreInvite(null);

      const result = await recoverActiveSession("user1");

      expect(result).toBeNull();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it("clears bookmark and returns null if invite is terminal", async () => {
      const bookmark = makeBookmark({ savedAt: Date.now() });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(bookmark),
      );
      mockFirestoreInvite({
        id: "inv_123",
        status: "completed",
        chatVisibility: "hidden",
        conversationId: "conv_abc",
      });

      const result = await recoverActiveSession("user1");

      expect(result).toBeNull();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it("self-heals chatVisibility on terminal invite missing it", async () => {
      const bookmark = makeBookmark({ savedAt: Date.now() });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(bookmark),
      );
      mockFirestoreInvite({
        id: "inv_123",
        status: "completed",
        chatVisibility: "visible", // should be hidden!
        conversationId: "conv_abc",
      });

      await recoverActiveSession("user1");

      // Should call completeGameInvite to self-heal
      expect(completeGameInvite).toHaveBeenCalledWith("inv_123");
    });

    it("returns RecoverableSession for active invite with valid screen", async () => {
      const bookmark = makeBookmark({
        savedAt: Date.now(),
        gameType: "chess",
      });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(bookmark),
      );
      mockFirestoreInvite({
        id: "inv_123",
        status: "active",
        gameType: "chess",
        conversationId: "conv_abc",
      });

      const result = await recoverActiveSession("user1");

      expect(result).not.toBeNull();
      expect(result!.bookmark.inviteId).toBe("inv_123");
      expect(result!.invite.status).toBe("active");
      expect(result!.screenName).toBe("ChessGame");
    });

    it("clears bookmark if gameType has no screen mapping", async () => {
      const bookmark = makeBookmark({
        savedAt: Date.now(),
        gameType: "nonexistent_game" as any,
      });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(bookmark),
      );
      mockFirestoreInvite({
        id: "inv_123",
        status: "active",
        gameType: "nonexistent_game",
      });

      const result = await recoverActiveSession("user1");

      expect(result).toBeNull();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it("returns null but keeps bookmark for non-active, non-terminal status", async () => {
      const bookmark = makeBookmark({ savedAt: Date.now() });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(bookmark),
      );
      mockFirestoreInvite({
        id: "inv_123",
        status: "filling",
        conversationId: "conv_abc",
      });

      const result = await recoverActiveSession("user1");

      expect(result).toBeNull();
      // Should NOT clear the bookmark — invite may become active later
      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    });

    it("returns null but keeps bookmark on network error", async () => {
      const bookmark = makeBookmark({ savedAt: Date.now() });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(bookmark),
      );
      (doc as jest.Mock).mockReturnValue("invite-ref");
      (getDoc as jest.Mock).mockRejectedValueOnce(new Error("network error"));

      const result = await recoverActiveSession("user1");

      expect(result).toBeNull();
      // Should NOT clear the bookmark — will retry next time
      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    });

    it("does not call completeGameInvite on terminal invite with chatVisibility=hidden", async () => {
      const bookmark = makeBookmark({ savedAt: Date.now() });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(bookmark),
      );
      mockFirestoreInvite({
        id: "inv_123",
        status: "expired",
        chatVisibility: "hidden",
      });

      await recoverActiveSession("user1");

      // chatVisibility already hidden → no self-heal needed
      expect(completeGameInvite).not.toHaveBeenCalled();
    });
  });

  // ─── ext_ game recovery (§17) ─────────────────────────────────────────

  describe("ext_ game recovery (external Colyseus games)", () => {
    const EXT_GAMES: Array<{
      gameType: string;
      screenName: string;
      extPrefix: string;
    }> = [
      {
        gameType: "battleship",
        screenName: "BattleshipGame",
        extPrefix: "ext_battleship",
      },
      {
        gameType: "crazy_eights",
        screenName: "CrazyEightsGame",
        extPrefix: "ext_crazy_eights",
      },
      {
        gameType: "starforge_game",
        screenName: "StarforgeGame",
        extPrefix: "ext_starforge_game",
      },
      {
        gameType: "sketch_party_game",
        screenName: "SketchPartyGameScreen",
        extPrefix: "ext_sketch_party_game",
      },
      {
        gameType: "crossword_puzzle",
        screenName: "CrosswordGame",
        extPrefix: "ext_crossword_puzzle",
      },
      {
        gameType: "pong_game",
        screenName: "PongGame",
        extPrefix: "ext_pong_game",
      },
      {
        gameType: "minigolf_duels",
        screenName: "MiniGolfDuelsGame",
        extPrefix: "ext_minigolf_duels",
      },
    ];

    for (const { gameType, screenName, extPrefix } of EXT_GAMES) {
      it(`recovers active ${gameType} session with ext_ firestoreGameId`, async () => {
        const inviteId = `inv_${gameType}_1`;
        const bookmark = makeBookmark({
          savedAt: Date.now(),
          inviteId,
          gameType,
          firestoreGameId: `${extPrefix}_${inviteId}`,
          isTurnBased: false,
        });
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
          JSON.stringify(bookmark),
        );
        mockFirestoreInvite({
          id: inviteId,
          status: "active",
          gameType,
          conversationId: "conv_abc",
        });

        const result = await recoverActiveSession("user1");

        expect(result).not.toBeNull();
        expect(result!.screenName).toBe(screenName);
        expect(result!.bookmark.gameType).toBe(gameType);
        expect(result!.bookmark.firestoreGameId).toBe(
          `${extPrefix}_${inviteId}`,
        );
        expect(result!.invite.status).toBe("active");
      });
    }

    it("clears bookmark when battleship invite is terminal (disconnect)", async () => {
      const bookmark = makeBookmark({
        savedAt: Date.now(),
        inviteId: "inv_bs_disc",
        gameType: "battleship",
        firestoreGameId: "ext_battleship_inv_bs_disc",
        isTurnBased: false,
      });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(bookmark),
      );
      mockFirestoreInvite({
        id: "inv_bs_disc",
        status: "completed",
        resolutionType: "disconnect",
        chatVisibility: "hidden",
        conversationId: "conv_abc",
      });

      const result = await recoverActiveSession("user1");

      expect(result).toBeNull();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
      // Already hidden → no self-heal
      expect(completeGameInvite).not.toHaveBeenCalled();
    });

    it("clears bookmark when crazy_eights invite is terminal (resign)", async () => {
      const bookmark = makeBookmark({
        savedAt: Date.now(),
        inviteId: "inv_ce_resign",
        gameType: "crazy_eights",
        firestoreGameId: "ext_crazy_eights_inv_ce_resign",
        isTurnBased: false,
      });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(bookmark),
      );
      mockFirestoreInvite({
        id: "inv_ce_resign",
        status: "completed",
        resolutionType: "resign",
        chatVisibility: "hidden",
        conversationId: "conv_abc",
      });

      const result = await recoverActiveSession("user1");

      expect(result).toBeNull();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it("self-heals chatVisibility on terminal ext_ invite missing it", async () => {
      const bookmark = makeBookmark({
        savedAt: Date.now(),
        inviteId: "inv_bs_nohide",
        gameType: "battleship",
        firestoreGameId: "ext_battleship_inv_bs_nohide",
        isTurnBased: false,
      });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(bookmark),
      );
      mockFirestoreInvite({
        id: "inv_bs_nohide",
        status: "completed",
        chatVisibility: "visible", // should be hidden!
        conversationId: "conv_abc",
      });

      await recoverActiveSession("user1");

      // Should trigger self-heal
      expect(completeGameInvite).toHaveBeenCalledWith("inv_bs_nohide");
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it("keeps bookmark when ext_ invite is in filling status (not yet active)", async () => {
      const bookmark = makeBookmark({
        savedAt: Date.now(),
        inviteId: "inv_sg_fill",
        gameType: "starforge_game",
        firestoreGameId: "ext_starforge_game_inv_sg_fill",
        isTurnBased: false,
      });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(bookmark),
      );
      mockFirestoreInvite({
        id: "inv_sg_fill",
        status: "filling",
        conversationId: "conv_abc",
      });

      const result = await recoverActiveSession("user1");

      expect(result).toBeNull();
      // Bookmark should be kept — might become active
      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    });

    it("handles network error during ext_ game recovery without clearing bookmark", async () => {
      const bookmark = makeBookmark({
        savedAt: Date.now(),
        inviteId: "inv_pong_err",
        gameType: "pong_game",
        firestoreGameId: "ext_pong_game_inv_pong_err",
        isTurnBased: false,
      });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(bookmark),
      );
      (doc as jest.Mock).mockReturnValue("invite-ref");
      (getDoc as jest.Mock).mockRejectedValueOnce(new Error("offline"));

      const result = await recoverActiveSession("user1");

      expect(result).toBeNull();
      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    });
  });
});
