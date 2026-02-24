/**
 * Game Invites Service
 *
 * Handles game invitations between users including:
 * - Sending invites
 * - Accepting/declining invites
 * - Invite expiration
 * - Notification integration
 *
 * @see docs/GAMES_SYSTEM.md
 */

import {
  ExtendedGameType,
  GAME_METADATA,
  getGameRuntimeType,
  RealTimeGameType,
  TurnBasedGameType,
} from "@/types/games";
import type { TurnBasedMatchConfig, TurnBasedPlayer } from "@/types/turnBased";
import {
  canTransitionUniversalInviteStatus,
  PlayerSlot,
  SendUniversalInviteParams,
  UniversalGameInvite,
  UniversalInviteStatus,
} from "@/types/turnBased";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
} from "firebase/firestore";
import { getOrCreateChat } from "./chat";
import { getAuthInstance, getFirestoreInstance } from "./firebase";
import { createMatch } from "./turnBasedGames";

import { createLogger } from "@/utils/log";
import { createTraceId } from "@/utils/trace";
const logger = createLogger("services/gameInvites");
// Lazy getter to avoid calling getFirestoreInstance at module load time
const getDb = () => getFirestoreInstance();
const getAuth = () => getAuthInstance();

// =============================================================================
// Types
// =============================================================================

/**
 * Supported game types for invites
 */
export type InviteGameType = TurnBasedGameType | RealTimeGameType;

// =============================================================================
// Constants
// =============================================================================

const COLLECTION_NAME = "GameInvites";

/** Invite document schema version - bump when adding breaking field changes */
const INVITE_VERSION = 1;

// =============================================================================
// Universal Invite Helpers
// =============================================================================

/**
 * Generate unique universal invite ID
 */
function generateUniversalInviteId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `uinv_${timestamp}_${random}`;
}

/**
 * Get default settings for a game type.
 * Exported for registry verification script — not intended for direct UI use.
 */
export function getDefaultInviteSettings(
  gameType: InviteGameType,
): UniversalGameInvite["settings"] {
  const defaults: Record<InviteGameType, UniversalGameInvite["settings"]> = {
    chess: {
      isRated: true,
      timeControl: { type: "per_turn", seconds: 86400 },
      chatEnabled: true,
    },
    checkers: {
      isRated: true,
      timeControl: { type: "per_turn", seconds: 86400 },
      chatEnabled: true,
    },
    tic_tac_toe: {
      isRated: false,
      timeControl: { type: "per_turn", seconds: 60 },
      chatEnabled: true,
    },
    crazy_eights: {
      isRated: true,
      timeControl: { type: "per_turn", seconds: 120 },
      chatEnabled: true,
    },
    connect_four: {
      isRated: true,
      timeControl: { type: "per_turn", seconds: 60 },
      chatEnabled: true,
    },
    dot_match: {
      isRated: true,
      timeControl: { type: "per_turn", seconds: 60 },
      chatEnabled: true,
    },
    gomoku_master: {
      isRated: true,
      timeControl: { type: "per_turn", seconds: 120 },
      chatEnabled: true,
    },
    // Phase 3 turn-based games
    reversi_game: {
      isRated: true,
      timeControl: { type: "per_turn", seconds: 120 },
      chatEnabled: true,
    },
    // Phase 3 real-time games
    crossword_puzzle: {
      isRated: false,
      timeControl: { type: "none", seconds: 0 },
      chatEnabled: true,
    },
    starforge_game: {
      isRated: false,
      timeControl: { type: "none", seconds: 0 },
      chatEnabled: true,
    },
    sketch_party_game: {
      isRated: false,
      timeControl: { type: "none", seconds: 0 },
      chatEnabled: true,
    },
    pong_game: {
      isRated: false,
      timeControl: { type: "none", seconds: 0 },
      chatEnabled: true,
    },
    minigolf_duels: {
      isRated: false,
      timeControl: { type: "none", seconds: 0 },
      chatEnabled: true,
    },
    battleship: {
      isRated: true,
      timeControl: { type: "none", seconds: 0 },
      chatEnabled: true,
    },
  };
  return defaults[gameType] || { isRated: false, chatEnabled: true };
}

/**
 * Get player count requirements from game metadata
 */
function getPlayerCounts(gameType: InviteGameType): {
  min: number;
  max: number;
} {
  const metadata = GAME_METADATA[gameType as ExtendedGameType];
  if (metadata) {
    return { min: metadata.minPlayers, max: metadata.maxPlayers };
  }
  return { min: 2, max: 2 }; // Default for unknown games
}

function usesExternalSessionId(gameType: InviteGameType): boolean {
  return getGameRuntimeType(gameType as ExtendedGameType) === "realtime";
}

function createExternalSessionId(
  inviteId: string,
  gameType: InviteGameType,
): string {
  return `ext_${gameType}_${inviteId}`;
}

// =============================================================================
// Universal Invite Functions
// =============================================================================

/**
 * Send a universal game invite
 *
 * For DM context: Creates invite visible to specific recipient + Play page
 * For Group context: Creates invite visible only in group chat
 *
 * @example
 * // DM invite
 * await sendUniversalInvite({
 *   senderId: uid,
 *   senderName: "Alice",
 *   gameType: "chess",
 *   context: "dm",
 *   conversationId: chatId,
 *   recipientId: "user-bob",
 *   recipientName: "Bob",
 * });
 *
 * // Group invite
 * await sendUniversalInvite({
 *   senderId: uid,
 *   senderName: "Alice",
 *   gameType: "crazy_eights",
 *   context: "group",
 *   conversationId: groupId,
 *   conversationName: "Game Night",
 *   eligibleUserIds: ["alice", "bob", "charlie", "dave"],
 *   requiredPlayers: 4,
 * });
 */
export async function sendUniversalInvite(
  params: SendUniversalInviteParams,
): Promise<UniversalGameInvite> {
  const {
    senderId,
    senderName,
    senderAvatar,
    gameType,
    context,
    conversationId,
    conversationName,
    eligibleUserIds,
    recipientId,
    recipientName,
    recipientAvatar,
    requiredPlayers: customRequiredPlayers,
    settings: customSettings,
    expirationMinutes = 60,
  } = params;

  const metadata = GAME_METADATA[gameType as ExtendedGameType];
  if (!metadata) {
    throw new Error(`Unknown game type "${gameType}"`);
  }
  if (!metadata.isAvailable) {
    throw new Error(`Game "${gameType}" is not available right now.`);
  }
  if (getGameRuntimeType(gameType as ExtendedGameType) === "solo") {
    throw new Error(`Game "${gameType}" does not support multiplayer invites.`);
  }

  // ── Idempotency check ──────────────────────────────────────────────
  // If the same host already has a waiting/filling/ready invite for the
  // same (gameType, conversationId), reuse it instead of creating a
  // duplicate.  This prevents rapid-tap or network-retry duplicates.
  if (conversationId) {
    try {
      const existingQuery = query(
        collection(getDb(), COLLECTION_NAME),
        where("senderId", "==", senderId),
        where("gameType", "==", gameType),
        where("conversationId", "==", conversationId),
        where("status", "in", ["pending", "filling", "ready"]),
        limit(1),
      );
      const existingSnap = await getDocs(existingQuery);
      if (!existingSnap.empty) {
        const existing = existingSnap.docs[0].data() as UniversalGameInvite;
        logger.info(
          `[sendUniversalInvite] Reusing existing invite ${existing.id} ` +
            `(status=${existing.status}) for ${gameType} in ${conversationId}`,
        );
        return existing;
      }
    } catch (err) {
      // Non-fatal — proceed to create a new invite if the check fails
      logger.warn("[sendUniversalInvite] Idempotency check failed:", err);
    }
  }

  // Validation
  if (context === "dm" && !recipientId) {
    throw new Error("recipientId is required for DM invites");
  }
  if (context === "group" && (!eligibleUserIds || eligibleUserIds.length < 2)) {
    throw new Error(
      "eligibleUserIds with at least 2 members required for group invites",
    );
  }

  // Get player counts from game metadata
  const { min: minPlayers, max: maxPlayers } = getPlayerCounts(gameType);
  // Invites always need at least 2 players (even if the game supports solo AI)
  const requiredPlayers = Math.max(2, customRequiredPlayers ?? minPlayers);

  if (requiredPlayers < minPlayers || requiredPlayers > maxPlayers) {
    throw new Error(
      `requiredPlayers must be between ${minPlayers} and ${maxPlayers}`,
    );
  }

  // Determine targeting
  const isSpecificTarget = context === "dm";
  const targetType: "universal" | "specific" = isSpecificTarget
    ? "specific"
    : "universal";
  const showInPlayPage = isSpecificTarget; // DM invites show in Play page, group invites don't

  // Build eligible user list
  const finalEligibleUserIds =
    context === "dm" ? [senderId, recipientId!] : [...eligibleUserIds!];

  // Ensure sender is in eligible list
  if (!finalEligibleUserIds.includes(senderId)) {
    finalEligibleUserIds.unshift(senderId);
  }

  // Build initial slot (sender is always host)
  const now = Date.now();
  const hostSlot: PlayerSlot = {
    playerId: senderId,
    playerName: senderName,
    playerAvatar: senderAvatar,
    claimedAt: now,
    isHost: true,
  };

  // Build invite document
  const inviteId = generateUniversalInviteId();
  const expiresAt = now + expirationMinutes * 60 * 1000;

  const invite: UniversalGameInvite = {
    id: inviteId,
    gameType,

    senderId,
    senderName,
    senderAvatar,

    context,
    conversationId,
    conversationName,

    targetType,
    recipientId: isSpecificTarget ? recipientId : undefined,
    recipientName: isSpecificTarget ? recipientName : undefined,
    recipientAvatar: isSpecificTarget ? recipientAvatar : undefined,
    eligibleUserIds: finalEligibleUserIds,

    requiredPlayers,
    maxPlayers,
    claimedSlots: [hostSlot],
    filledAt: undefined,

    spectatingEnabled: true,
    spectatorOnly: false,
    spectators: [],

    status: "pending",
    gameId: undefined,

    inviteVersion: INVITE_VERSION,
    traceId: createTraceId("inv"),

    settings: {
      ...getDefaultInviteSettings(gameType),
      ...customSettings,
    },

    createdAt: now,
    updatedAt: now,
    expiresAt,
    respondedAt: undefined,

    showInPlayPage,
    chatMessageId: undefined,
  };

  // Remove undefined values (Firestore doesn't like undefined)
  const cleanInvite = JSON.parse(JSON.stringify(invite));

  // Save to Firestore
  const inviteRef = doc(getDb(), COLLECTION_NAME, inviteId);
  await setDoc(inviteRef, cleanInvite);

  // Update the conversation so the invite bumps it to the top of the inbox
  try {
    const gameLabel = GAME_METADATA[gameType]?.name || gameType || "a game";
    const previewText = `🎮 ${senderName} sent a game invite: ${gameLabel}`;

    if (context === "dm" && recipientId) {
      const chatId = await getOrCreateChat(senderId, recipientId);
      const chatRef = doc(getDb(), "Chats", chatId);
      await updateDoc(chatRef, {
        lastMessageAt: Timestamp.now(),
        lastMessageText: previewText,
        lastMessageSenderId: senderId,
        lastMessageType: "game_invite",
        updatedAt: Timestamp.now(),
      });
    } else if (context === "group" && conversationId) {
      const groupRef = doc(getDb(), "Groups", conversationId);
      await updateDoc(groupRef, {
        lastMessageAt: Timestamp.now(),
        lastMessageText: previewText,
        lastMessageSenderId: senderId,
        lastMessageSenderName: senderName,
        lastMessageType: "game_invite",
        updatedAt: Timestamp.now(),
      });
    }
  } catch (e) {
    // Non-critical — don't fail the invite if the conversation update fails
    logger.warn(
      "[GameInvites] Failed to update conversation preview for invite",
      e,
    );
  }

  logger.info(`[GameInvites] Created universal invite: ${inviteId}`, {
    context,
    targetType,
    gameType,
    requiredPlayers,
  });

  return invite;
}

/**
 * Claim a slot in a universal invite (join the game)
 *
 * Uses Firestore transaction for atomic updates to prevent race conditions.
 *
 * @returns Object with success status and optional error message
 */
export async function claimInviteSlot(
  inviteId: string,
  userId: string,
  userName: string,
  userAvatar?: string,
): Promise<{ success: boolean; error?: string; invite?: UniversalGameInvite }> {
  const inviteRef = doc(getDb(), COLLECTION_NAME, inviteId);

  try {
    const result = await runTransaction(getDb(), async (transaction) => {
      const inviteSnap = await transaction.get(inviteRef);

      if (!inviteSnap.exists()) {
        return { success: false, error: "Invite not found" };
      }

      const invite = inviteSnap.data() as UniversalGameInvite;

      // Validation checks
      if (!["pending", "filling"].includes(invite.status)) {
        return {
          success: false,
          error:
            invite.status === "starting"
              ? "Game is starting — please wait"
              : `Cannot join - invite is ${invite.status}`,
        };
      }

      if (invite.claimedSlots.some((s) => s.playerId === userId)) {
        // Idempotent: player already joined — return success with current
        // invite so the caller can still navigate to the lobby.
        return { success: true, invite };
      }

      if (invite.claimedSlots.length >= invite.maxPlayers) {
        return { success: false, error: "Game is full" };
      }

      if (!invite.eligibleUserIds.includes(userId)) {
        return {
          success: false,
          error: "You are not eligible for this invite",
        };
      }

      // Check expiration
      if (Date.now() > invite.expiresAt) {
        transaction.update(inviteRef, {
          status: "expired",
          updatedAt: Date.now(),
        });
        return { success: false, error: "Invite has expired" };
      }

      // Build new slot (omit undefined fields for Firestore compatibility)
      const newSlot: PlayerSlot = {
        playerId: userId,
        playerName: userName,
        claimedAt: Date.now(),
        isHost: false,
        ...(userAvatar !== undefined && { playerAvatar: userAvatar }),
      };

      const newClaimedSlots = [...invite.claimedSlots, newSlot];
      const isFull = newClaimedSlots.length >= invite.requiredPlayers;

      // Determine new status
      let newStatus: UniversalInviteStatus = invite.status;
      if (isFull) {
        newStatus = "ready";
      } else if (newClaimedSlots.length > 1) {
        newStatus = "filling";
      }

      if (!canTransitionUniversalInviteStatus(invite.status, newStatus)) {
        return {
          success: false,
          error: `Invalid invite transition ${invite.status} -> ${newStatus}`,
        };
      }

      // Update document
      const updates: Partial<UniversalGameInvite> & {
        filledAt?: number | null;
      } = {
        claimedSlots: newClaimedSlots,
        status: newStatus,
        updatedAt: Date.now(),
      };

      if (isFull) {
        updates.filledAt = Date.now();
      }

      transaction.update(inviteRef, updates);

      // Return updated invite
      const updatedInvite: UniversalGameInvite = {
        ...invite,
        claimedSlots: newClaimedSlots,
        status: newStatus,
        updatedAt: Date.now(),
        filledAt: isFull ? Date.now() : invite.filledAt,
      };

      return { success: true, invite: updatedInvite };
    });

    logger.info(`[GameInvites] Slot claimed: ${inviteId} by ${userId}`, result);
    return result;
  } catch (error) {
    logger.error(`[GameInvites] Error claiming slot:`, error);
    return { success: false, error: "Failed to join game" };
  }
}

/**
 * Leave/unclaim a slot before game starts
 *
 * Note: Host (sender) cannot leave - they must cancel the invite instead.
 */
export async function unclaimInviteSlot(
  inviteId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  const inviteRef = doc(getDb(), COLLECTION_NAME, inviteId);

  try {
    const result = await runTransaction(getDb(), async (transaction) => {
      const inviteSnap = await transaction.get(inviteRef);

      if (!inviteSnap.exists()) {
        return { success: false, error: "Invite not found" };
      }

      const invite = inviteSnap.data() as UniversalGameInvite;

      // Validation - allow leaving in pending, filling, or ready status
      if (!["pending", "filling", "ready"].includes(invite.status)) {
        return {
          success: false,
          error: `Cannot leave - game is ${invite.status}`,
        };
      }

      const slotIndex = invite.claimedSlots.findIndex(
        (s) => s.playerId === userId,
      );
      if (slotIndex === -1) {
        return { success: false, error: "You haven't joined this game" };
      }

      const isLeavingHost = invite.claimedSlots[slotIndex].isHost;

      // In DM context the host must cancel rather than leave.
      // In group context we allow the host to leave and promote the next player.
      if (isLeavingHost && invite.context !== "group") {
        return {
          success: false,
          error: "Host cannot leave. Cancel the invite instead.",
        };
      }

      // Remove slot
      const newClaimedSlots = invite.claimedSlots.filter(
        (s) => s.playerId !== userId,
      );

      // Host migration: promote the next player if the host is leaving
      if (isLeavingHost && newClaimedSlots.length > 0) {
        newClaimedSlots[0] = { ...newClaimedSlots[0], isHost: true };
      }

      // If nobody remains, cancel the invite
      if (newClaimedSlots.length === 0) {
        if (!canTransitionUniversalInviteStatus(invite.status, "cancelled")) {
          return {
            success: false,
            error: `Invalid invite transition ${invite.status} -> cancelled`,
          };
        }
        transaction.update(inviteRef, {
          claimedSlots: [],
          status: "cancelled" as UniversalInviteStatus,
          updatedAt: Date.now(),
          filledAt: null,
        });
        return { success: true };
      }

      // Determine new status based on remaining players
      let newStatus: UniversalInviteStatus;
      if (newClaimedSlots.length === 1) {
        newStatus = "pending"; // Back to just the host
      } else if (newClaimedSlots.length < invite.requiredPlayers) {
        newStatus = "filling"; // No longer have required players
      } else {
        newStatus = "ready"; // Still have enough players
      }

      if (!canTransitionUniversalInviteStatus(invite.status, newStatus)) {
        return {
          success: false,
          error: `Invalid invite transition ${invite.status} -> ${newStatus}`,
        };
      }

      transaction.update(inviteRef, {
        claimedSlots: newClaimedSlots,
        status: newStatus,
        updatedAt: Date.now(),
        filledAt: null, // Clear if it was set
      });

      return { success: true };
    });

    if (result.success) {
      logger.info(`[GameInvites] Slot unclaimed: ${inviteId} by ${userId}`);
    } else {
      logger.info(
        `[GameInvites] Unclaim failed: ${inviteId} - ${result.error}`,
      );
    }
    return result;
  } catch (error) {
    logger.error(`[GameInvites] Error unclaiming slot:`, error);
    return { success: false, error: "Failed to leave game" };
  }
}

// =============================================================================
// HOST CONTROL FUNCTIONS
// =============================================================================

/**
 * Start a game early (host only)
 *
 * Allows the host to start the game when:
 * - Status is "pending" or "filling"
 * - At least minPlayers have joined (from GAME_METADATA)
 *
 * This function:
 * 1. Validates host permissions
 * 2. Checks minimum player count
 * 3. Creates the actual game match via turnBasedGames.createMatch()
 * 4. Updates invite status to "active" with gameId
 *
 * @param inviteId - The universal invite ID
 * @param hostId - The user ID of the host (must match first slot)
 * @returns Object with success status, gameId if successful, or error message
 */
export async function startGameEarly(
  inviteId: string,
  hostId: string,
): Promise<{
  success: boolean;
  gameId?: string;
  error?: string;
}> {
  const inviteRef = doc(getDb(), COLLECTION_NAME, inviteId);

  try {
    // ── Phase 1: Acquire "starting" lock inside a transaction ──────────
    const lockResult = await runTransaction(getDb(), async (transaction) => {
      const inviteSnap = await transaction.get(inviteRef);

      if (!inviteSnap.exists()) {
        return { success: false as const, error: "Invite not found" };
      }

      const invite = inviteSnap.data() as UniversalGameInvite;

      // Validation: Must be host (first slot)
      if (invite.claimedSlots[0]?.playerId !== hostId) {
        return {
          success: false as const,
          error: "Only the host can start the game",
        };
      }

      // Validation: Must be in startable status
      if (!["pending", "filling", "ready"].includes(invite.status)) {
        return {
          success: false as const,
          error:
            invite.status === "starting"
              ? "Game is already starting"
              : `Cannot start - game is ${invite.status}`,
        };
      }

      // Validation: Check minimum players from GAME_METADATA
      const metadata = GAME_METADATA[invite.gameType as ExtendedGameType];
      if (!metadata) {
        return { success: false as const, error: "Unknown game type" };
      }

      if (invite.claimedSlots.length < metadata.minPlayers) {
        return {
          success: false as const,
          error: `Need at least ${metadata.minPlayers} players to start`,
        };
      }

      // Transition to "starting" — locks out joins/cancels
      if (
        !canTransitionUniversalInviteStatus(
          invite.status as UniversalInviteStatus,
          "starting",
        )
      ) {
        return {
          success: false as const,
          error: `Invalid invite transition ${invite.status} -> starting`,
        };
      }

      transaction.update(inviteRef, {
        status: "starting" as UniversalInviteStatus,
        updatedAt: Date.now(),
      });

      return { success: true as const, invite };
    });

    if (!lockResult.success) {
      return { success: false, error: lockResult.error };
    }

    const invite = lockResult.invite;

    // ── Phase 2: Create the match (outside transaction) ────────────────
    try {
      let gameId: string;

      if (usesExternalSessionId(invite.gameType as InviteGameType)) {
        gameId = createExternalSessionId(
          invite.id,
          invite.gameType as InviteGameType,
        );
      } else {
        // Build player objects from claimed slots
        const player1: TurnBasedPlayer = {
          userId: invite.claimedSlots[0].playerId,
          displayName: invite.claimedSlots[0].playerName,
          avatarUrl: invite.claimedSlots[0].playerAvatar,
          color: "white" as const,
        };
        const player2: TurnBasedPlayer = {
          userId: invite.claimedSlots[1].playerId,
          displayName: invite.claimedSlots[1].playerName,
          avatarUrl: invite.claimedSlots[1].playerAvatar,
          color: "black" as const,
        };

        // Create the actual game match
        const matchConfig: TurnBasedMatchConfig = {
          isRated: invite.settings?.isRated ?? false,
          chatEnabled: invite.settings?.chatEnabled ?? true,
          timeControl: invite.settings?.timeControl?.seconds,
        };

        // Build conversation context for game tracking
        const conversationContext = invite.conversationId
          ? {
              conversationId: invite.conversationId,
              conversationType: invite.context as "dm" | "group",
            }
          : undefined;

        gameId = await createMatch(
          invite.gameType as TurnBasedGameType,
          player1,
          player2,
          matchConfig,
          conversationContext,
          inviteId,
          invite.traceId,
        );
      }

      // ── Phase 3: Promote to "active" ──────────────────────────────
      await updateDoc(inviteRef, {
        status: "active" as UniversalInviteStatus,
        gameId,
        updatedAt: Date.now(),
        filledAt: Date.now(),
      });

      logger.info(`[GameInvites] Game started early: ${inviteId}`, {
        gameId,
        traceId: invite.traceId,
      });
      return { success: true, gameId };
    } catch (matchError) {
      // Match creation failed — roll back to "ready" so host can retry
      logger.error(
        `[GameInvites] Match creation failed, rolling back "starting" lock:`,
        matchError,
      );
      await updateDoc(inviteRef, {
        status: "ready" as UniversalInviteStatus,
        updatedAt: Date.now(),
      }).catch((e) =>
        logger.error("[GameInvites] Rollback to ready also failed:", e),
      );
      return { success: false, error: "Failed to create game match" };
    }
  } catch (error) {
    logger.error(`[GameInvites] Error starting game early:`, error);
    return { success: false, error: "Failed to start game" };
  }
}

/**
 * Cancel a universal game invite (host only)
 *
 * Sets invite status to "cancelled".
 * Can only be called by the host (first slot).
 * Can only cancel invites in pending/filling/ready status.
 *
 * @param inviteId - The universal invite ID
 * @param hostId - The user ID of the host (must match first slot)
 * @returns Object with success status or error message
 */
export async function cancelUniversalInvite(
  inviteId: string,
  hostId: string,
): Promise<{ success: boolean; error?: string }> {
  const inviteRef = doc(getDb(), COLLECTION_NAME, inviteId);

  try {
    const result = await runTransaction(getDb(), async (transaction) => {
      const inviteSnap = await transaction.get(inviteRef);

      if (!inviteSnap.exists()) {
        return { success: false, error: "Invite not found" };
      }

      const invite = inviteSnap.data() as UniversalGameInvite;

      // Validation: Must be host (first slot)
      if (invite.claimedSlots[0]?.playerId !== hostId) {
        return { success: false, error: "Only the host can cancel" };
      }

      // Validation: Must be in cancellable status
      if (!["pending", "filling", "ready"].includes(invite.status)) {
        return {
          success: false,
          error:
            invite.status === "starting"
              ? "Cannot cancel — game is starting"
              : `Cannot cancel - game is ${invite.status}`,
        };
      }

      // Update status to cancelled (atomic — no TOCTOU race)
      if (
        !canTransitionUniversalInviteStatus(
          invite.status as UniversalInviteStatus,
          "cancelled",
        )
      ) {
        return {
          success: false,
          error: `Invalid invite transition ${invite.status} -> cancelled`,
        };
      }

      transaction.update(inviteRef, {
        status: "cancelled" as UniversalInviteStatus,
        updatedAt: Date.now(),
      });

      return { success: true };
    });

    if (result.success) {
      logger.info(`[GameInvites] Universal invite cancelled: ${inviteId}`);
    }
    return result;
  } catch (error) {
    logger.error(`[GameInvites] Error cancelling invite:`, error);
    return { success: false, error: "Failed to cancel invite" };
  }
}

/**
 * Mark an active invite as completed when the game finishes.
 *
 * Uses a Firestore transaction to ensure we only transition from "active".
 * Idempotent — calling on an already-completed invite is a no-op success.
 *
 * @param inviteId  - The universal invite ID
 * @param winnerId  - Winner's user ID (omit for draws)
 * @param winReason - How the game ended (e.g. "checkmate", "timeout")
 */
export async function completeGameInvite(
  inviteId: string,
  winnerId?: string,
  winReason?: string,
): Promise<{ success: boolean; error?: string }> {
  const inviteRef = doc(getDb(), COLLECTION_NAME, inviteId);

  try {
    const result = await runTransaction(getDb(), async (transaction) => {
      const inviteSnap = await transaction.get(inviteRef);

      if (!inviteSnap.exists()) {
        // Invite was already deleted — treat as success (idempotent)
        return { success: true };
      }

      const invite = inviteSnap.data() as UniversalGameInvite;

      // Idempotent: already completed
      if (invite.status === "completed") {
        return { success: true };
      }

      // Only transition from "active" (or "starting" in edge cases)
      if (!["active", "starting"].includes(invite.status)) {
        return {
          success: false,
          error: `Cannot complete - invite is ${invite.status}`,
        };
      }

      if (
        !canTransitionUniversalInviteStatus(
          invite.status as UniversalInviteStatus,
          "completed",
        )
      ) {
        return {
          success: false,
          error: `Invalid invite transition ${invite.status} -> completed`,
        };
      }

      const updates: Record<string, unknown> = {
        status: "completed" as UniversalInviteStatus,
        completedAt: Date.now(),
        updatedAt: Date.now(),
      };
      if (winnerId) updates.winnerId = winnerId;
      if (winReason) updates.winReason = winReason;

      transaction.update(inviteRef, updates);

      return { success: true };
    });

    if (result.success) {
      logger.info(`[GameInvites] Invite completed: ${inviteId}`, {
        winnerId,
        winReason,
      });
    }
    return result;
  } catch (error) {
    logger.error(`[GameInvites] Error completing invite:`, error);
    return { success: false, error: "Failed to complete invite" };
  }
}

/**
 * Delete a game invite document from Firestore.
 *
 * Used by pre-start abandonment and post-resolution cleanup flows.
 * Unlike `cancelUniversalInvite` which transitions status, this fully removes
 * the document.
 *
 * @param inviteId - The invite document ID to delete
 */
export async function deleteGameInviteDoc(
  inviteId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const inviteRef = doc(getDb(), COLLECTION_NAME, inviteId);
    const inviteSnap = await getDoc(inviteRef);
    if (inviteSnap.exists()) {
      await deleteDoc(inviteRef);
      logger.info(`[GameInvites] Invite deleted: ${inviteId}`);
    }
    return { success: true };
  } catch (error) {
    logger.error(`[GameInvites] Error deleting invite:`, error);
    return { success: false, error: "Failed to delete invite" };
  }
}

// =============================================================================
// Universal Invite Subscriptions
// =============================================================================

/**
 * Subscribe to a universal invite's updates
 *
 * Use this to show real-time slot updates in UI.
 */
export function subscribeToUniversalInvite(
  inviteId: string,
  onUpdate: (invite: UniversalGameInvite | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const inviteRef = doc(getDb(), COLLECTION_NAME, inviteId);

  return onSnapshot(
    inviteRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onUpdate(null);
        return;
      }
      onUpdate(snapshot.data() as UniversalGameInvite);
    },
    (error) => {
      logger.error("[GameInvites] Universal invite subscription error:", error);
      onError?.(error);
    },
  );
}

/**
 * Subscribe to invites for Play page
 *
 * Real-time updates for DM invites shown in Play tab.
 * Note: We filter by eligibleUserIds in the query for security rules compliance,
 * then filter by status client-side since Firestore doesn't allow array-contains + in.
 */
export function subscribeToPlayPageInvites(
  userId: string,
  onUpdate: (invites: UniversalGameInvite[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  // Query with eligibleUserIds to satisfy security rules
  // Filter by status and showInPlayPage client-side (can't combine array-contains with 'in')
  const q = query(
    collection(getDb(), COLLECTION_NAME),
    where("eligibleUserIds", "array-contains", userId),
    where("showInPlayPage", "==", true),
    orderBy("createdAt", "desc"),
    limit(50),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const validStatuses = ["pending", "filling"];
      const invites = snapshot.docs
        .map((d) => d.data() as UniversalGameInvite)
        .filter((inv) => validStatuses.includes(inv.status))
        .filter((inv) => inv.senderId !== userId)
        .filter((inv) => inv.expiresAt > Date.now()) // Filter expired
        .slice(0, 20); // Limit results after filtering
      onUpdate(invites);
    },
    (error) => {
      logger.error("[GameInvites] Play page subscription error:", error);
      onError?.(error);
    },
  );
}

/**
 * Subscribe to invites for a conversation
 *
 * Real-time updates for invites shown in chat.
 * Note: We filter by eligibleUserIds in the query for security rules compliance,
 * then filter by status client-side since Firestore doesn't allow array-contains + in.
 */
export function subscribeToConversationInvites(
  conversationId: string,
  userId: string,
  onUpdate: (invites: UniversalGameInvite[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  // Query with eligibleUserIds to satisfy security rules
  // Filter by status client-side (can't combine array-contains with 'in')
  const q = query(
    collection(getDb(), COLLECTION_NAME),
    where("conversationId", "==", conversationId),
    where("eligibleUserIds", "array-contains", userId),
    orderBy("createdAt", "desc"),
    limit(20),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const validStatuses = ["pending", "filling", "ready", "active"];
      const invites = snapshot.docs
        .map((d) => d.data() as UniversalGameInvite)
        .filter((inv) => validStatuses.includes(inv.status));
      onUpdate(invites);
    },
    (error) => {
      logger.error(
        "[GameInvites] Conversation invites subscription error:",
        error,
      );
      onError?.(error);
    },
  );
}

// =============================================================================
// Cleanup Functions
// =============================================================================

/**
 * Clean up invites for games that have already completed
 * This handles the case where game completion didn't update the invite
 *
 * @param conversationId - The conversation to clean up invites for
 * @returns Number of invites cleaned up
 */
export async function cleanupCompletedGameInvites(
  conversationId: string,
): Promise<number> {
  // Get current user - required for Firestore security rules
  const currentUser = getAuth().currentUser;
  if (!currentUser) {
    logger.warn("[GameInvites] Cannot cleanup invites - not authenticated");
    return 0;
  }

  // Query invites in "active" status for this conversation
  // IMPORTANT: Must include eligibleUserIds constraint for Firestore security rules
  // Without this, the query fails because Firestore can't verify the user has access
  const q = query(
    collection(getDb(), COLLECTION_NAME),
    where("conversationId", "==", conversationId),
    where("status", "==", "active"),
    where("eligibleUserIds", "array-contains", currentUser.uid),
  );

  const snapshot = await getDocs(q);
  let cleanedUp = 0;

  for (const inviteDoc of snapshot.docs) {
    const invite = inviteDoc.data() as UniversalGameInvite;

    // Check if this invite has a gameId
    if (invite.gameId) {
      // Check the game status
      try {
        const gameDoc = await getDoc(
          doc(getDb(), "TurnBasedGames", invite.gameId),
        );

        if (!gameDoc.exists()) {
          // Game doesn't exist - mark invite as completed
          await updateDoc(inviteDoc.ref, {
            status: "completed",
            completedAt: Date.now(),
            gameEndStatus: "game_not_found",
            updatedAt: Date.now(),
          });
          cleanedUp++;
          continue;
        }

        const game = gameDoc.data();
        const terminalStates = [
          "completed",
          "resigned",
          "draw",
          "timeout",
          "abandoned",
        ];

        if (terminalStates.includes(game?.status)) {
          // Game is completed - update invite status
          await updateDoc(inviteDoc.ref, {
            status: "completed",
            completedAt: Date.now(),
            gameEndStatus: game?.status,
            updatedAt: Date.now(),
          });
          cleanedUp++;
        }
      } catch (error: unknown) {
        // Handle permission errors gracefully - user may not be a participant in this game
        // This can happen if:
        // 1. User declined the invite but invite still has a gameId reference
        // 2. Invite data is stale/inconsistent
        // 3. Game was created but user never joined
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (errorMessage.includes("permission")) {
          logger.info(
            `[GameInvites] Skipping invite ${invite.id} - no permission to read game (user may not be participant)`,
          );
        } else {
          logger.error(
            `[GameInvites] Error checking game status for invite ${invite.id}:`,
            error,
          );
        }
      }
    }
  }

  if (cleanedUp > 0) {
    logger.info(
      `[GameInvites] Cleaned up ${cleanedUp} completed game invites for conversation ${conversationId}`,
    );
  }

  return cleanedUp;
}

// =============================================================================
// Export
// =============================================================================

export const gameInvites = {
  // Universal invite API
  sendUniversal: sendUniversalInvite,
  claimSlot: claimInviteSlot,
  unclaimSlot: unclaimInviteSlot,
  startEarly: startGameEarly,
  cancelUniversal: cancelUniversalInvite,
  completeInvite: completeGameInvite,

  // Subscriptions
  subscribeUniversal: subscribeToUniversalInvite,
  subscribePlayPage: subscribeToPlayPageInvites,
  subscribeConversation: subscribeToConversationInvites,

  // Cleanup
  cleanupCompleted: cleanupCompletedGameInvites,
};
