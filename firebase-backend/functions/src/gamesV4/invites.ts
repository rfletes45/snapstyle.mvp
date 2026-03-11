/**
 * Games V4 — Create Game Invite
 *
 * Callable: createGameInviteV4
 *
 * Creates a new GameInviteV4 doc, pins it to the conversation,
 * and fans out notifications to conversation members.
 *
 * @module gamesV4/invites
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import {
  assertAuth,
  assertConversationMember,
  getConversationMemberIds,
  getDb,
  getUserProfile,
} from "./helpers";
import { notifyInviteCreated } from "./notifications";
import type {
  GameId,
  GameInviteV4,
  GameRuntimeType,
  SpectateMode,
} from "./types";
import {
  COLLECTIONS,
  MAX_PINNED_INVITES,
  MAX_PLAYERS,
  PINNED_INVITE_IDS_FIELD,
} from "./types";
import { COOLDOWNS, enforceCooldown } from "./validation";

// =============================================================================
// Game metadata (lightweight for validation)
// =============================================================================

interface GameMeta {
  runtimeType: GameRuntimeType;
  minPlayers: number;
  maxPlayers: number;
  supportsSpectate: boolean;
}

const GAME_META: Record<GameId, GameMeta> = {
  bounce_blitz: {
    runtimeType: "solo",
    minPlayers: 1,
    maxPlayers: 1,
    supportsSpectate: false,
  },
  play_2048: {
    runtimeType: "solo",
    minPlayers: 1,
    maxPlayers: 1,
    supportsSpectate: false,
  },
  brick_breaker: {
    runtimeType: "solo",
    minPlayers: 1,
    maxPlayers: 1,
    supportsSpectate: false,
  },
  word_master: {
    runtimeType: "solo",
    minPlayers: 1,
    maxPlayers: 1,
    supportsSpectate: false,
  },
  minesweeper: {
    runtimeType: "solo",
    minPlayers: 1,
    maxPlayers: 1,
    supportsSpectate: false,
  },
  lights_out: {
    runtimeType: "solo",
    minPlayers: 1,
    maxPlayers: 1,
    supportsSpectate: false,
  },
  tic_tac_toe: {
    runtimeType: "turnBased",
    minPlayers: 2,
    maxPlayers: 2,
    supportsSpectate: true,
  },
  chess: {
    runtimeType: "turnBased",
    minPlayers: 2,
    maxPlayers: 2,
    supportsSpectate: true,
  },
  checkers: {
    runtimeType: "turnBased",
    minPlayers: 2,
    maxPlayers: 2,
    supportsSpectate: true,
  },
  connect_four: {
    runtimeType: "turnBased",
    minPlayers: 2,
    maxPlayers: 2,
    supportsSpectate: true,
  },
  gomoku: {
    runtimeType: "turnBased",
    minPlayers: 2,
    maxPlayers: 2,
    supportsSpectate: true,
  },
  reversi: {
    runtimeType: "turnBased",
    minPlayers: 2,
    maxPlayers: 2,
    supportsSpectate: true,
  },
  dots_and_boxes: {
    runtimeType: "turnBased",
    minPlayers: 2,
    maxPlayers: 2,
    supportsSpectate: true,
  },
  pong_game: {
    runtimeType: "realtime",
    minPlayers: 2,
    maxPlayers: 2,
    supportsSpectate: false,
  },
  battleship: {
    runtimeType: "turnBased",
    minPlayers: 2,
    maxPlayers: 2,
    supportsSpectate: true,
  },
  sketch_party_game: {
    runtimeType: "realtime",
    minPlayers: 2,
    maxPlayers: 8,
    supportsSpectate: false,
  },
  starforge_game: {
    runtimeType: "realtime",
    minPlayers: 2,
    maxPlayers: 4,
    supportsSpectate: false,
  },
  crossword_puzzle: {
    runtimeType: "realtime",
    minPlayers: 2,
    maxPlayers: 4,
    supportsSpectate: false,
  },
  minigolf_duels: {
    runtimeType: "turnBased",
    minPlayers: 2,
    maxPlayers: 3,
    supportsSpectate: true,
  },
  dot_match: {
    runtimeType: "realtime",
    minPlayers: 2,
    maxPlayers: 2,
    supportsSpectate: false,
  },
  knockout_game: {
    runtimeType: "realtime",
    minPlayers: 2,
    maxPlayers: 8,
    supportsSpectate: true,
  },
  crazy_eights: {
    runtimeType: "turnBased",
    minPlayers: 2,
    maxPlayers: 6,
    supportsSpectate: true,
  },
  hex: {
    runtimeType: "turnBased",
    minPlayers: 2,
    maxPlayers: 2,
    supportsSpectate: true,
  },
  solitaire_klondike: {
    runtimeType: "solo",
    minPlayers: 1,
    maxPlayers: 1,
    supportsSpectate: false,
  },
  dead_drop: {
    runtimeType: "turnBased",
    minPlayers: 4,
    maxPlayers: 4,
    supportsSpectate: true,
  },
};

// =============================================================================
// Input validation
// =============================================================================

interface CreateInviteInput {
  conversationId: string;
  conversationScope: "dm" | "group";
  gameId: GameId;
  maxPlayers?: number;
  allowSpectators?: boolean;
  spectateMode?: SpectateMode;
}

function validateInput(data: unknown): CreateInviteInput {
  const d = data as Record<string, unknown>;

  if (!d.conversationId || typeof d.conversationId !== "string") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "conversationId is required.",
    );
  }

  const scope = d.conversationScope;
  if (scope !== "dm" && scope !== "group") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "conversationScope must be 'dm' or 'group'.",
    );
  }

  const gameId = d.gameId as GameId;
  if (!gameId || !GAME_META[gameId]) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      `Invalid gameId: ${d.gameId}`,
    );
  }

  const meta = GAME_META[gameId];

  // Solo games shouldn't use the invite system
  if (meta.runtimeType === "solo") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Solo games do not use the invite system.",
    );
  }

  const maxPlayers =
    typeof d.maxPlayers === "number"
      ? Math.min(
          Math.max(d.maxPlayers, meta.minPlayers),
          meta.maxPlayers,
          MAX_PLAYERS,
        )
      : meta.maxPlayers;

  const allowSpectators =
    typeof d.allowSpectators === "boolean"
      ? d.allowSpectators && meta.supportsSpectate
      : meta.supportsSpectate;

  const spectateMode: SpectateMode =
    allowSpectators && typeof d.spectateMode === "string"
      ? (d.spectateMode as SpectateMode)
      : "public_only";

  return {
    conversationId: d.conversationId as string,
    conversationScope: scope,
    gameId,
    maxPlayers,
    allowSpectators,
    spectateMode,
  };
}

// =============================================================================
// Callable: createGameInviteV4
// =============================================================================

export const createGameInviteV4 = functions.https.onCall(
  async (data, context) => {
    const uid = assertAuth(context);

    // Rate-limit: 1 invite per 3 seconds
    const db = getDb();
    await enforceCooldown(db, uid, "createInviteV4", COOLDOWNS.CREATE_INVITE);

    const input = validateInput(data);

    // Verify membership
    await assertConversationMember(
      uid,
      input.conversationId,
      input.conversationScope,
    );

    // Fetch creator profile
    const profile = await getUserProfile(uid);
    const displayName = profile?.displayName ?? "Unknown";

    // Generate IDs
    const inviteRef = db.collection(COLLECTIONS.GAME_INVITES).doc();
    const inviteId = inviteRef.id;
    const now = admin.firestore.Timestamp.now();

    const meta = GAME_META[input.gameId];

    // Build invite document
    const invite: GameInviteV4 = {
      inviteId,
      conversationId: input.conversationId,
      conversationScope: input.conversationScope,
      gameId: input.gameId,
      runtimeType: meta.runtimeType,
      createdBy: uid,
      status: "sent",
      createdAt: now,
      updatedAt: now,
      hostId: uid,
      participantIds: [uid], // Creator is first participant
      spectatorIds: [],
      maxPlayers: input.maxPlayers ?? meta.maxPlayers,
      allowSpectators: input.allowSpectators ?? false,
      spectateMode: input.spectateMode ?? "public_only",
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
          uid,
          displayName,
          profilePictureUrl: profile?.profilePictureUrl ?? null,
        },
      ],
      spectatorSummaries: [],
      hiddenInChat: false,
      hiddenAt: null,
      deleteRequestedAt: null,
      deleteAt: null,
    };

    // Write invite doc AND pin to conversation atomically (R3 fix)
    const convCollection =
      input.conversationScope === "dm" ? "Chats" : "Groups";
    const convRef = db.collection(convCollection).doc(input.conversationId);

    await db.runTransaction(async (tx) => {
      const convSnap = await tx.get(convRef);
      const current: string[] =
        convSnap.data()?.[PINNED_INVITE_IDS_FIELD] || [];

      // Evict oldest if at capacity
      const updated = current.includes(inviteId)
        ? current
        : [...current, inviteId];
      while (updated.length > MAX_PINNED_INVITES) {
        updated.shift();
      }

      tx.set(inviteRef, invite);
      tx.update(convRef, { [PINNED_INVITE_IDS_FIELD]: updated });
    });

    // Fan-out notifications to conversation members
    try {
      const memberIds = await getConversationMemberIds(
        input.conversationId,
        input.conversationScope,
      );
      await notifyInviteCreated(invite, displayName, memberIds);
    } catch (err) {
      console.error("[gamesV4] Failed to send invite notifications:", err);
    }

    console.log(
      `[gamesV4] Invite ${inviteId} created by ${uid} for ${input.gameId} ` +
        `in ${input.conversationScope}:${input.conversationId}`,
    );

    return { inviteId };
  },
);
