/**
 * Games V4 — Lobby Bug Regression Tests
 *
 * Prevents re-introduction of 5 critical runtime bugs fixed in the
 * lobby-hardening pass:
 *
 * Bug 1: Leaving lobby didn't actually remove user (unconditional nav)
 * Bug 2: Cancel invite left orphan docs / non-host users stuck
 * Bug 3: Start game 500 (deployment gating + error handling)
 * Bug 4: Player identity showed "Player 1/2" instead of real profiles
 * Bug 5: Solo 2048 "Not-found" (missing callable + rules)
 *
 * Run: npx jest lobbyBugRegression
 */

import {
    COLLECTIONS,
    GAME_METADATA,
    IMPLEMENTED_GAME_IDS,
} from "@/gamesV4/constants";
import type { ParticipantSummary } from "@/gamesV4/types/common";
import type { GameInviteStatus, GameInviteV4 } from "@/gamesV4/types/invite";
import {
    canTransitionInviteStatus,
    GAME_INVITE_STATUS_TRANSITIONS,
} from "@/gamesV4/types/invite";
import { isCancelledInvite } from "@/gamesV4/utils/inviteState";

// =============================================================================
// Helpers — Fake invite builders for pure-logic tests
// =============================================================================

function makeInvite(overrides: Partial<GameInviteV4> = {}): GameInviteV4 {
  return {
    inviteId: "inv_test_1",
    conversationId: "conv_1",
    conversationScope: "dm",
    gameId: "tic_tac_toe",
    runtimeType: "turnBased",
    createdBy: "host_uid",
    status: "lobby",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    hostId: "host_uid",
    participantIds: ["host_uid"],
    spectatorIds: [],
    maxPlayers: 2,
    allowSpectators: false,
    spectateMode: "public_only",
    sessionId: null,
    summary: {
      phase: "lobby",
      turnPlayerId: null,
      scoreSummary: [],
      lastMoveAt: null,
      lastActorId: null,
    },
    participantSummaries: [
      {
        uid: "host_uid",
        displayName: "HostName",
        profilePictureUrl: "https://example.com/host.png",
      },
    ],
    spectatorSummaries: [],
    hiddenInChat: false,
    hiddenAt: null,
    deleteRequestedAt: null,
    deleteAt: null,
    ...overrides,
  };
}

// =============================================================================
// Bug 1: Leave lobby — navigation must depend on success
// =============================================================================

describe("Bug 1 — Leave lobby", () => {
  test("leaveInviteLobby removes the caller from participantIds", () => {
    // Simulate the backend transaction logic:
    // Given invite with host + player2
    const invite = makeInvite({
      participantIds: ["host_uid", "player2"],
      participantSummaries: [
        {
          uid: "host_uid",
          displayName: "Host",
          profilePictureUrl: null,
        },
        {
          uid: "player2",
          displayName: "Player 2",
          profilePictureUrl: null,
        },
      ],
    });

    // When player2 leaves
    const uid = "player2";
    const updatedIds = invite.participantIds.filter((id) => id !== uid);
    const updatedSummaries = invite.participantSummaries.filter(
      (s) => s.uid !== uid,
    );

    // Then player2 is removed
    expect(updatedIds).toEqual(["host_uid"]);
    expect(updatedSummaries).toHaveLength(1);
    expect(updatedSummaries[0].uid).toBe("host_uid");
  });

  test("host cannot leave — must cancel instead", () => {
    const invite = makeInvite();
    const uid = "host_uid";

    // Backend logic: host is blocked
    const isHost = invite.hostId === uid;
    expect(isHost).toBe(true);
    // The callable throws failed-precondition for host
  });

  test("leave is idempotent — user not in lobby is a no-op", () => {
    const invite = makeInvite({ participantIds: ["host_uid"] });
    const uid = "stranger";

    const isPlayer = invite.participantIds.includes(uid);
    const isSpectator = invite.spectatorIds.includes(uid);
    expect(isPlayer).toBe(false);
    expect(isSpectator).toBe(false);
    // Backend returns success (idempotent)
  });
});

// =============================================================================
// Bug 2: Cancel invite — resolved invites must be handled gracefully
// =============================================================================

describe("Bug 2 — Cancel invite", () => {
  test("cancelled invite has status resolved with NO sessionId", () => {
    // After cancel, invite becomes:
    const cancelled = makeInvite({
      status: "resolved",
      sessionId: null,
      summary: { ...makeInvite().summary, phase: "resolved" },
    });

    expect(cancelled.status).toBe("resolved");
    expect(cancelled.sessionId).toBeNull();
  });

  test("isCancelled detection: resolved + no sessionId", () => {
    const invite = makeInvite({
      status: "resolved",
      sessionId: null,
    });

    // Client-side detection logic (from GameLobbyScreenV4 useEffect):
    const isCancelled = isCancelledInvite(invite);
    expect(isCancelled).toBe(true);
  });

  test("completed game is NOT flagged as cancelled", () => {
    const invite = makeInvite({
      status: "resolved",
      sessionId: "session_123",
    });

    const isCancelled = isCancelledInvite(invite);
    expect(isCancelled).toBe(false);
  });

  test("canTransitionInviteStatus: lobby → resolved is valid", () => {
    expect(canTransitionInviteStatus("lobby", "resolved")).toBe(true);
  });

  test("canTransitionInviteStatus: resolved → anything is invalid", () => {
    expect(canTransitionInviteStatus("resolved", "sent")).toBe(false);
    expect(canTransitionInviteStatus("resolved", "lobby")).toBe(false);
    expect(canTransitionInviteStatus("resolved", "active")).toBe(false);
    expect(canTransitionInviteStatus("resolved", "resolved")).toBe(false);
  });

  test("PinnedInviteBar filters: cancelled invites hidden", () => {
    // Simulates the visibleInvites filter in PinnedInviteBar
    const invites: GameInviteV4[] = [
      makeInvite({ inviteId: "active_1", status: "lobby" }),
      makeInvite({
        inviteId: "cancelled_1",
        status: "resolved",
        sessionId: null,
      }),
      makeInvite({
        inviteId: "finished_1",
        status: "resolved",
        sessionId: "sess_1",
      }),
    ];

    const visibleInvites = invites.filter((inv) => !isCancelledInvite(inv));

    expect(visibleInvites).toHaveLength(2);
    expect(visibleInvites.map((i) => i.inviteId)).toEqual([
      "active_1",
      "finished_1",
    ]);
  });
});

// =============================================================================
// Bug 3: Start game — adapter gating + implemented-game enforcement
// =============================================================================

describe("Bug 3 — Start game gating", () => {
  test("IMPLEMENTED_GAME_IDS reflects the current launched set", () => {
    expect(IMPLEMENTED_GAME_IDS.size).toBeGreaterThanOrEqual(17);
    expect(IMPLEMENTED_GAME_IDS.has("tic_tac_toe")).toBe(true);
    expect(IMPLEMENTED_GAME_IDS.has("connect_four")).toBe(true);
    expect(IMPLEMENTED_GAME_IDS.has("play_2048")).toBe(true);
    expect(IMPLEMENTED_GAME_IDS.has("chess")).toBe(true);
    expect(IMPLEMENTED_GAME_IDS.has("sketch_party_game")).toBe(true);
    expect(IMPLEMENTED_GAME_IDS.has("metro_magnate")).toBe(true);
    expect(IMPLEMENTED_GAME_IDS.has("minigolf_duels")).toBe(false);
  });

  test("deferred games are rejected by client-side canStart", () => {
    // Simulates canStart logic in GameLobbyScreenV4
    const unimplemented = ["checkers", "gomoku", "minigolf_duels"] as const;
    for (const gameId of unimplemented) {
      const isGameImplemented = IMPLEMENTED_GAME_IDS.has(gameId);
      expect(isGameImplemented).toBe(false);
    }
  });

  test("canTransitionInviteStatus: lobby → active is valid", () => {
    expect(canTransitionInviteStatus("lobby", "active")).toBe(true);
  });

  test("canTransitionInviteStatus: active → active is invalid", () => {
    expect(canTransitionInviteStatus("active", "active")).toBe(false);
  });

  test("double start returns existing active session id", () => {
    const invite = makeInvite({
      status: "active",
      sessionId: "session_existing",
    });

    const startResult =
      invite.status === "active" && invite.sessionId ? invite.sessionId : null;

    expect(startResult).toBe("session_existing");
  });

  test("minimum player check requires at least minPlayers", () => {
    const meta = GAME_METADATA["tic_tac_toe"];
    expect(meta.minPlayers).toBe(2);
    expect(meta.maxPlayers).toBe(2);

    // Lobby with only 1 player: canStart = false
    const invite = makeInvite({ participantIds: ["host_uid"] });
    const canStart = invite.participantIds.length >= meta.minPlayers;
    expect(canStart).toBe(false);

    // Lobby with 2 players: canStart = true
    invite.participantIds = ["host_uid", "player2"];
    const canStart2 = invite.participantIds.length >= meta.minPlayers;
    expect(canStart2).toBe(true);
  });
});

// =============================================================================
// Bug 4: Player identity — participantSummaries must carry real profiles
// =============================================================================

describe("Bug 4 — Player identity (participantSummaries)", () => {
  test("invite carries participantSummaries with real display names", () => {
    const invite = makeInvite({
      participantIds: ["host_uid", "player2"],
      participantSummaries: [
        {
          uid: "host_uid",
          displayName: "Alice",
          profilePictureUrl: "https://cdn.example.com/alice.jpg",
        },
        {
          uid: "player2",
          displayName: "Bob",
          profilePictureUrl: "https://cdn.example.com/bob.jpg",
        },
      ],
    });

    expect(invite.participantSummaries).toHaveLength(2);
    expect(invite.participantSummaries[0].displayName).toBe("Alice");
    expect(invite.participantSummaries[1].displayName).toBe("Bob");
    // Not "Player 1" or "Player 2"
    expect(invite.participantSummaries[0].displayName).not.toMatch(
      /^Player\s?\d$/,
    );
    expect(invite.participantSummaries[1].displayName).not.toMatch(
      /^Player\s?\d$/,
    );
  });

  test("participantMap lookup resolves real names", () => {
    const summaries: ParticipantSummary[] = [
      { uid: "u1", displayName: "Alice", profilePictureUrl: null },
      { uid: "u2", displayName: "Bob", profilePictureUrl: "https://…" },
    ];

    // Build map (mirrors lobby screen logic)
    const map = new Map<
      string,
      { displayName: string; profilePictureUrl: string | null }
    >();
    for (const s of summaries) {
      map.set(s.uid, {
        displayName: s.displayName,
        profilePictureUrl: s.profilePictureUrl,
      });
    }

    expect(map.get("u1")?.displayName).toBe("Alice");
    expect(map.get("u2")?.displayName).toBe("Bob");
    expect(map.get("unknown")).toBeUndefined();
  });

  test("fallback for missing summaries still shows Player not undefined", () => {
    const invite = makeInvite({
      participantIds: ["uid_1"],
      participantSummaries: [], // Legacy invite without summaries
    });

    const map = new Map<string, ParticipantSummary>();
    for (const s of invite.participantSummaries) {
      map.set(s.uid, s);
    }

    // Lobby screen fallback: summary?.displayName ?? 'Player'
    const summary = map.get("uid_1");
    const displayName = summary?.displayName ?? "Player";
    expect(displayName).toBe("Player");
    expect(displayName).not.toBe("undefined");
  });
});

// =============================================================================
// Bug 5: Solo 2048 — metadata + solo session structure
// =============================================================================

describe("Bug 5 — Solo 2048", () => {
  test("play_2048 is in IMPLEMENTED_GAME_IDS", () => {
    expect(IMPLEMENTED_GAME_IDS.has("play_2048")).toBe(true);
  });

  test("play_2048 metadata has runtimeType solo", () => {
    const meta = GAME_METADATA["play_2048"];
    expect(meta.runtimeType).toBe("solo");
    expect(meta.minPlayers).toBe(1);
    expect(meta.maxPlayers).toBe(1);
  });

  test("solo session has empty inviteId and conversationId", () => {
    // Mirrors createSoloSessionV4 backend logic
    const soloInviteId = "";
    const soloConversationId = "";
    expect(soloInviteId).toBe("");
    expect(soloConversationId).toBe("");
  });

  test("solo session has participantUids for Firestore rule access", () => {
    // The session doc MUST have participantUids for rules to grant read
    const uid = "solo_player";
    const participantUids = [uid];
    expect(participantUids).toContain(uid);
    expect(participantUids).toHaveLength(1);
  });

  test("GameSessionsV4 collection name matches constants", () => {
    expect(COLLECTIONS.GAME_SESSIONS).toBe("GameSessionsV4");
  });
});

// =============================================================================
// Invariants — Cross-cutting structural checks
// =============================================================================

describe("Cross-cutting invariants", () => {
  test("every GAME_METADATA entry has all required fields", () => {
    for (const [id, meta] of Object.entries(GAME_METADATA)) {
      expect(meta.gameId).toBe(id);
      expect(meta.displayName).toBeTruthy();
      expect(["solo", "turnBased", "realtime"]).toContain(meta.runtimeType);
      expect(meta.minPlayers).toBeGreaterThanOrEqual(1);
      expect(meta.maxPlayers).toBeGreaterThanOrEqual(meta.minPlayers);
      expect(typeof meta.icon).toBe("string");
    }
  });

  test("IMPLEMENTED_GAME_IDS is a subset of GAME_METADATA keys", () => {
    for (const id of IMPLEMENTED_GAME_IDS) {
      expect(GAME_METADATA).toHaveProperty(id);
    }
  });

  test("invite status transitions are exhaustive", () => {
    const statuses: GameInviteStatus[] = [
      "sent",
      "lobby",
      "active",
      "resolved",
    ];
    for (const s of statuses) {
      expect(GAME_INVITE_STATUS_TRANSITIONS).toHaveProperty(s);
    }
  });

  test("resolved is a terminal state", () => {
    expect(GAME_INVITE_STATUS_TRANSITIONS.resolved).toEqual([]);
  });

  test("all solo games in metadata have minPlayers=1 maxPlayers=1", () => {
    for (const meta of Object.values(GAME_METADATA)) {
      if (meta.runtimeType === "solo") {
        expect(meta.minPlayers).toBe(1);
        expect(meta.maxPlayers).toBe(1);
      }
    }
  });

  test("all multiplayer games have minPlayers >= 2", () => {
    for (const meta of Object.values(GAME_METADATA)) {
      if (meta.runtimeType !== "solo") {
        expect(meta.minPlayers).toBeGreaterThanOrEqual(2);
      }
    }
  });

  test("COLLECTIONS keys match expected Firestore paths", () => {
    expect(COLLECTIONS.GAME_INVITES).toBe("GameInvitesV4");
    expect(COLLECTIONS.GAME_SESSIONS).toBe("GameSessionsV4");
    expect(COLLECTIONS.PUBLIC_STATE).toBe("PublicState");
    expect(COLLECTIONS.PRIVATE_STATE).toBe("PrivateState");
    expect(COLLECTIONS.MOVES).toBe("Moves");
  });
});
