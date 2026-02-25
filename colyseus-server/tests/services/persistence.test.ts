/**
 * Persistence Service Tests — ext_ invite finalization + metadata + cardPlayers
 *
 * Tests the Phase 1 ext_ hardening fixes:
 *   - extractInviteIdFromExtGameId (pure function)
 *   - persistGameResult metadata param (inviteId / firestoreGameId on RealtimeGameSessions)
 *   - persistGameResult cardPlayers fallback
 *   - deleteGameAndInvite ext_ fallback when no TurnBasedGames doc exists
 *
 * Uses mock Firestore (same pattern as BattleshipRoom.test.ts).
 *
 * @see colyseus-server/src/services/persistence.ts
 */

// =============================================================================
// Mocks — must be before imports
// =============================================================================

// Mock document references + snapshots
const mockBatch = {
  delete: jest.fn(),
  update: jest.fn(),
  commit: jest.fn().mockResolvedValue(undefined),
};

const mockDocs: Record<string, Record<string, any> | null> = {};
let lastAddedDoc: Record<string, any> | null = null;
let lastUpdatedDoc: { collection: string; id: string; data: any } | null = null;

const mockCollection = (collectionName: string) => ({
  doc: (docId: string) => ({
    get: jest.fn().mockImplementation(async () => {
      const key = `${collectionName}/${docId}`;
      const data = mockDocs[key];
      return {
        exists: data != null,
        data: () => data,
        ref: { id: docId, path: `${collectionName}/${docId}` },
      };
    }),
    set: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockImplementation(async (updateData: any) => {
      lastUpdatedDoc = {
        collection: collectionName,
        id: docId,
        data: updateData,
      };
    }),
    delete: jest.fn().mockResolvedValue(undefined),
  }),
  add: jest.fn().mockImplementation(async (doc: any) => {
    lastAddedDoc = doc;
    return { id: "auto-generated-id" };
  }),
});

const mockDb = {
  collection: jest.fn().mockImplementation(mockCollection),
  batch: jest.fn().mockReturnValue(mockBatch),
};

jest.mock("../../src/services/firebase", () => ({
  initializeFirebaseAdmin: jest.fn(),
  getFirestoreDb: jest.fn().mockReturnValue(mockDb),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn().mockReturnValue("SERVER_TIMESTAMP"),
    delete: jest.fn().mockReturnValue("DELETE_FIELD"),
  },
}));

// =============================================================================
// Imports
// =============================================================================

import { MapSchema } from "@colyseus/schema";
import { BaseGameState, Player } from "../../src/schemas/common";
import {
  deleteGameAndInvite,
  extractInviteIdFromExtGameId,
  persistGameResult,
} from "../../src/services/persistence";

// =============================================================================
// Helpers
// =============================================================================

function resetMockState(): void {
  for (const key of Object.keys(mockDocs)) {
    delete mockDocs[key];
  }
  lastAddedDoc = null;
  lastUpdatedDoc = null;
  mockBatch.delete.mockClear();
  mockBatch.update.mockClear();
  mockBatch.commit.mockClear();
  mockDb.collection.mockClear();
  mockDb.batch.mockClear();
}

function makeBaseState(overrides: Partial<BaseGameState> = {}): BaseGameState {
  const state = new BaseGameState();
  state.gameType = overrides.gameType ?? "battleship";
  state.winnerId = overrides.winnerId ?? "uid-winner";
  state.winReason = overrides.winReason ?? "sunk";
  state.turnNumber = overrides.turnNumber ?? 5;
  state.isRated = overrides.isRated ?? true;
  state.firestoreGameId = overrides.firestoreGameId ?? "";
  state.gameId = overrides.gameId ?? "test-game-id";
  // Players can be added by callers
  return state;
}

function addPlayer(
  state: BaseGameState,
  sessionId: string,
  uid: string,
  name: string,
  score: number,
  index: number,
): void {
  const p = new Player();
  p.uid = uid;
  p.displayName = name;
  p.score = score;
  p.playerIndex = index;
  state.players.set(sessionId, p);
}

// =============================================================================
// extractInviteIdFromExtGameId Tests
// =============================================================================

describe("extractInviteIdFromExtGameId", () => {
  it("extracts inviteId from ext_battleship_abc123", () => {
    expect(extractInviteIdFromExtGameId("ext_battleship_abc123")).toBe(
      "abc123",
    );
  });

  it("extracts inviteId from ext_crazy_eights_def456", () => {
    // crazy_eights has an underscore in the gameType — inviteId is after LAST underscore
    expect(extractInviteIdFromExtGameId("ext_crazy_eights_def456")).toBe(
      "def456",
    );
  });

  it("extracts inviteId from ext_sketch_party_game_xyz789", () => {
    expect(extractInviteIdFromExtGameId("ext_sketch_party_game_xyz789")).toBe(
      "xyz789",
    );
  });

  it("extracts inviteId from ext_pong_game_a1b2c3", () => {
    expect(extractInviteIdFromExtGameId("ext_pong_game_a1b2c3")).toBe("a1b2c3");
  });

  it("extracts inviteId from ext_minigolf_duels_inv001", () => {
    expect(extractInviteIdFromExtGameId("ext_minigolf_duels_inv001")).toBe(
      "inv001",
    );
  });

  it("extracts inviteId from ext_crossword_puzzle_invXYZ", () => {
    expect(extractInviteIdFromExtGameId("ext_crossword_puzzle_invXYZ")).toBe(
      "invXYZ",
    );
  });

  it("extracts inviteId from ext_starforge_game_sf001", () => {
    expect(extractInviteIdFromExtGameId("ext_starforge_game_sf001")).toBe(
      "sf001",
    );
  });

  it("returns null for non-ext IDs", () => {
    expect(extractInviteIdFromExtGameId("game_abc123")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractInviteIdFromExtGameId("")).toBeNull();
  });

  it("returns null for undefined-like input", () => {
    expect(extractInviteIdFromExtGameId(null as any)).toBeNull();
    expect(extractInviteIdFromExtGameId(undefined as any)).toBeNull();
  });

  it("returns null for ext_ with no underscore after prefix", () => {
    // "ext_" has only one underscore at index 3
    expect(extractInviteIdFromExtGameId("ext_")).toBeNull();
  });

  it("returns null if inviteId portion is empty after last underscore", () => {
    expect(extractInviteIdFromExtGameId("ext_battleship_")).toBeNull();
  });

  it("handles long Firestore auto-generated invite IDs", () => {
    const longId = "AbCdEfGhIjKlMnOpQrStUvWx";
    expect(extractInviteIdFromExtGameId(`ext_battleship_${longId}`)).toBe(
      longId,
    );
  });
});

// =============================================================================
// persistGameResult Tests
// =============================================================================

describe("persistGameResult", () => {
  beforeEach(resetMockState);

  it("writes to RealtimeGameSessions when firestoreGameId is empty", async () => {
    const state = makeBaseState({ firestoreGameId: "" });
    addPlayer(state, "s1", "uid1", "Player 1", 100, 0);
    addPlayer(state, "s2", "uid2", "Player 2", 50, 1);

    await persistGameResult(state, 30000);

    expect(lastAddedDoc).not.toBeNull();
    expect(lastAddedDoc!.gameType).toBe("battleship");
    expect(lastAddedDoc!.winnerId).toBe("uid-winner");
    expect(lastAddedDoc!.players).toHaveLength(2);
    expect(lastAddedDoc!.players[0].uid).toBe("uid1");
    expect(lastAddedDoc!.players[1].uid).toBe("uid2");
  });

  it("includes metadata (inviteId + firestoreGameId) on RealtimeGameSessions doc", async () => {
    const state = makeBaseState({ firestoreGameId: "" });
    addPlayer(state, "s1", "uid1", "Player 1", 0, 0);

    await persistGameResult(state, 10000, undefined, {
      inviteId: "inv-abc123",
      firestoreGameId: "ext_battleship_inv-abc123",
    });

    expect(lastAddedDoc).not.toBeNull();
    expect(lastAddedDoc!.inviteId).toBe("inv-abc123");
    expect(lastAddedDoc!.firestoreGameId).toBe("ext_battleship_inv-abc123");
  });

  it("does not include metadata fields when metadata is undefined", async () => {
    const state = makeBaseState({ firestoreGameId: "" });
    addPlayer(state, "s1", "uid1", "Player 1", 0, 0);

    await persistGameResult(state, 10000);

    expect(lastAddedDoc).not.toBeNull();
    expect(lastAddedDoc!.inviteId).toBeUndefined();
    expect(lastAddedDoc!.firestoreGameId).toBeUndefined();
  });

  it("falls back to cardPlayers when state.players is empty", async () => {
    // Simulate a CardGameState: players is empty, cardPlayers has data
    const state = makeBaseState({
      firestoreGameId: "",
      gameType: "crazy_eights",
    });
    // Don't add to state.players — simulate card game using cardPlayers

    // Manually add cardPlayers (simulating CardGameState's schema)
    const cardPlayers = new MapSchema<Player>();
    const cp1 = new Player();
    cp1.uid = "card-uid1";
    cp1.displayName = "Card Player 1";
    cp1.score = 5;
    cp1.playerIndex = 0;
    cardPlayers.set("cs1", cp1);

    const cp2 = new Player();
    cp2.uid = "card-uid2";
    cp2.displayName = "Card Player 2";
    cp2.score = 3;
    cp2.playerIndex = 1;
    cardPlayers.set("cs2", cp2);

    (state as any).cardPlayers = cardPlayers;

    await persistGameResult(state, 20000, undefined, {
      inviteId: "inv-card1",
      firestoreGameId: "ext_crazy_eights_inv-card1",
    });

    expect(lastAddedDoc).not.toBeNull();
    expect(lastAddedDoc!.players).toHaveLength(2);
    expect(lastAddedDoc!.players[0].uid).toBe("card-uid1");
    expect(lastAddedDoc!.players[1].uid).toBe("card-uid2");
    expect(lastAddedDoc!.inviteId).toBe("inv-card1");
  });

  it("prefers state.players over cardPlayers when both are present", async () => {
    const state = makeBaseState({ firestoreGameId: "" });
    addPlayer(state, "s1", "base-uid", "Base Player", 10, 0);

    // Also add cardPlayers
    const cardPlayers = new MapSchema<Player>();
    const cp = new Player();
    cp.uid = "card-uid";
    cp.displayName = "Card Player";
    cp.score = 5;
    cp.playerIndex = 0;
    cardPlayers.set("cs1", cp);
    (state as any).cardPlayers = cardPlayers;

    await persistGameResult(state, 10000);

    expect(lastAddedDoc).not.toBeNull();
    expect(lastAddedDoc!.players).toHaveLength(1);
    expect(lastAddedDoc!.players[0].uid).toBe("base-uid");
  });

  it("handles perPlayerStats correctly", async () => {
    const state = makeBaseState({ firestoreGameId: "" });
    addPlayer(state, "s1", "uid1", "Player 1", 100, 0);

    const stats: Record<string, Record<string, number>> = {
      uid1: { hits: 10, misses: 3, accuracy: 77 },
    };

    await persistGameResult(state, 30000, stats);

    expect(lastAddedDoc).not.toBeNull();
    expect(lastAddedDoc!.players[0].gameSpecific).toEqual({
      hits: 10,
      misses: 3,
      accuracy: 77,
    });
  });

  it("writes to TurnBasedGames when firestoreGameId is set", async () => {
    const state = makeBaseState({
      firestoreGameId: "existing-game-id",
    });
    addPlayer(state, "s1", "uid1", "Player 1", 100, 0);

    await persistGameResult(state, 30000);

    // Should NOT have added to RealtimeGameSessions
    expect(lastAddedDoc).toBeNull();
    // Should have updated TurnBasedGames
    expect(lastUpdatedDoc).not.toBeNull();
    expect(lastUpdatedDoc!.collection).toBe("TurnBasedGames");
    expect(lastUpdatedDoc!.id).toBe("existing-game-id");
    expect(lastUpdatedDoc!.data.status).toBe("completed");
  });
});

// =============================================================================
// deleteGameAndInvite Tests
// =============================================================================

describe("deleteGameAndInvite", () => {
  beforeEach(resetMockState);

  it("discovers inviteId from ext_ format when no TurnBasedGames doc exists", async () => {
    // Set up: invite exists, no TurnBasedGames doc
    mockDocs["GameInvites/abc123"] = {
      status: "active",
      conversationId: "conv-1",
    };

    await deleteGameAndInvite("ext_battleship_abc123");

    // Verify batch.update was called for the invite
    expect(mockBatch.update).toHaveBeenCalled();
    const updateCall = mockBatch.update.mock.calls[0];
    expect(updateCall[1]).toMatchObject({
      status: "completed",
      chatVisibility: "hidden",
      resolvedBy: "room",
    });

    expect(mockBatch.commit).toHaveBeenCalled();
  });

  it("discovers inviteId from ext_ for crazy_eights (underscored game type)", async () => {
    mockDocs["GameInvites/inv567"] = {
      status: "active",
      conversationId: "conv-2",
    };

    await deleteGameAndInvite("ext_crazy_eights_inv567");

    expect(mockBatch.update).toHaveBeenCalled();
    const updateCall = mockBatch.update.mock.calls[0];
    expect(updateCall[1]).toMatchObject({
      status: "completed",
      chatVisibility: "hidden",
    });
  });

  it("uses explicitly provided inviteId over ext_ parsing", async () => {
    mockDocs["GameInvites/explicit-inv"] = {
      status: "active",
      conversationId: "conv-3",
    };

    await deleteGameAndInvite("ext_battleship_parsed-inv", "explicit-inv");

    expect(mockBatch.update).toHaveBeenCalled();
    const updateCall = mockBatch.update.mock.calls[0];
    expect(updateCall[1]).toMatchObject({
      status: "completed",
      chatVisibility: "hidden",
    });
  });

  it("auto-discovers inviteId from TurnBasedGames doc (existing behavior)", async () => {
    mockDocs["TurnBasedGames/game-001"] = {
      inviteId: "tb-inv-001",
    };
    mockDocs["GameInvites/tb-inv-001"] = {
      status: "active",
      conversationId: "conv-4",
    };

    await deleteGameAndInvite("game-001");

    expect(mockBatch.update).toHaveBeenCalled();
    const updateCall = mockBatch.update.mock.calls[0];
    expect(updateCall[1]).toMatchObject({
      status: "completed",
      chatVisibility: "hidden",
    });
  });

  it("skips invite update when inviteId cannot be discovered", async () => {
    // Non-ext_, no TurnBasedGames doc
    await deleteGameAndInvite("random-room-id");

    expect(mockBatch.update).not.toHaveBeenCalled();
    expect(mockBatch.commit).toHaveBeenCalled();
  });

  it("sets chatHiddenInConversationIds from invite conversationId", async () => {
    mockDocs["GameInvites/inv-conv"] = {
      status: "active",
      conversationId: "convo-XYZ",
    };

    await deleteGameAndInvite("ext_battleship_inv-conv");

    expect(mockBatch.update).toHaveBeenCalled();
    const updateCall = mockBatch.update.mock.calls[0];
    expect(updateCall[1].chatHiddenInConversationIds).toEqual(["convo-XYZ"]);
  });

  it("handles invite with no conversationId", async () => {
    mockDocs["GameInvites/inv-no-conv"] = {
      status: "active",
    };

    await deleteGameAndInvite("ext_battleship_inv-no-conv");

    expect(mockBatch.update).toHaveBeenCalled();
    const updateCall = mockBatch.update.mock.calls[0];
    expect(updateCall[1].chatHiddenInConversationIds).toEqual([]);
  });

  it("sets deleteAt to 6 hours from now", async () => {
    const before = Date.now();

    mockDocs["GameInvites/inv-ttl"] = {
      status: "active",
      conversationId: "conv-ttl",
    };

    await deleteGameAndInvite("ext_battleship_inv-ttl");

    const after = Date.now();
    const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

    expect(mockBatch.update).toHaveBeenCalled();
    const updateCall = mockBatch.update.mock.calls[0];
    expect(updateCall[1].deleteAt).toBeGreaterThanOrEqual(
      before + SIX_HOURS_MS,
    );
    expect(updateCall[1].deleteAt).toBeLessThanOrEqual(after + SIX_HOURS_MS);
  });
});
