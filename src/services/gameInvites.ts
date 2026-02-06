/**
 * Game Invites Service
 *
 * Handles game invitations between users including:
 * - Sending invites
 * - Accepting/declining invites
 * - Invite expiration
 * - Notification integration
 *
 * @see docs/07_GAMES_ARCHITECTURE.md Section 2.2
 */

import {
  arrayRemove,
  arrayUnion,
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
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  ExtendedGameType,
  GAME_METADATA,
  GameCategory,
  RealTimeGameType,
  SinglePlayerGameType,
  TurnBasedGameType,
} from "../types/games";
import type { TurnBasedMatchConfig, TurnBasedPlayer } from "../types/turnBased";
import {
  PlayerSlot,
  SendUniversalInviteParams,
  SpectatorEntry,
  UniversalGameInvite,
  UniversalInviteStatus,
} from "../types/turnBased";
import { getOrCreateChat } from "./chat";
import { getAuthInstance, getFirestoreInstance } from "./firebase";
import { createMatch } from "./turnBasedGames";

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

/**
 * Invite status
 */
export type InviteStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "expired"
  | "cancelled";

/**
 * Game invite document
 */
interface GameInvite {
  id: string;
  gameType: InviteGameType;
  category: GameCategory;

  // Players
  senderId: string;
  senderName: string;
  senderAvatar?: string;

  recipientId: string;
  recipientName: string;
  recipientAvatar?: string;

  // Status
  status: InviteStatus;

  // Game settings
  settings: GameInviteSettings;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  expiresAt: Timestamp;
  respondedAt?: Timestamp;

  // Result
  gameId?: string; // Set when accepted and game created

  // Notification tracking
  notificationSent: boolean;
}

/**
 * Game settings for invite
 */
export interface GameInviteSettings {
  isRated: boolean;
  timeControl?: {
    type: "none" | "per_turn" | "total";
    seconds: number;
  };
  chatEnabled: boolean;
  customRules?: Record<string, unknown>;
}

/**
 * Create invite input
 */
export interface CreateInviteInput {
  gameType: InviteGameType;
  recipientId: string;
  recipientName: string;
  recipientAvatar?: string;
  settings?: Partial<GameInviteSettings>;
  expirationMinutes?: number;
}

/**
 * Invite filter options
 */
export interface InviteFilterOptions {
  status?: InviteStatus[];
  gameType?: InviteGameType;
  limit?: number;
}

// =============================================================================
// Spectator Invite Types (Single-Player Games)
// =============================================================================

/**
 * Status of a spectator invite for single-player games
 */
export type SpectatorInviteStatus =
  | "pending" // Invite sent, waiting for host to start game
  | "active" // Host is playing, spectators can watch
  | "completed" // Game ended
  | "expired" // Invite expired before game started
  | "cancelled"; // Host cancelled the invite

/**
 * Spectator invite for single-player games
 * Allows players to invite others to watch them play a single-player game in real-time
 */
export interface SpectatorInvite {
  id: string;
  /** The single-player game being played */
  gameType: SinglePlayerGameType;

  // ============= HOST (PLAYER) =============
  hostId: string;
  hostName: string;
  hostAvatar?: string;

  // ============= CONTEXT =============
  /** Where was this invite sent? "dm" for 1:1 chat, "group" for group chat */
  context: "dm" | "group";
  /** The conversation ID (chatId for DM, groupId for group) */
  conversationId: string;
  /** Display name of conversation */
  conversationName?: string;

  // ============= TARGETING =============
  /** Users who can join as spectators */
  eligibleUserIds: string[];
  /** For DM: the specific recipient */
  recipientId?: string;
  recipientName?: string;
  recipientAvatar?: string;

  // ============= SPECTATORS =============
  /** Users currently spectating */
  spectators: SpectatorEntry[];
  /** Max spectators allowed (undefined = unlimited) */
  maxSpectators?: number;

  // ============= STATUS =============
  status: SpectatorInviteStatus;

  // ============= LIVE SESSION =============
  /** Live session ID once game starts */
  liveSessionId?: string;

  // ============= TIMESTAMPS =============
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  startedAt?: number;
  endedAt?: number;

  // ============= VISIBILITY =============
  /** Show in Play page? true for DM invites */
  showInPlayPage: boolean;
  /** Message ID in chat */
  chatMessageId?: string;
}

/**
 * Parameters for creating a spectator invite
 */
export interface SendSpectatorInviteParams {
  hostId: string;
  hostName: string;
  hostAvatar?: string;
  gameType: SinglePlayerGameType;
  context: "dm" | "group";
  conversationId: string;
  conversationName?: string;
  /** Required for group invites - all group member IDs */
  eligibleUserIds?: string[];
  /** Required for DM invites */
  recipientId?: string;
  recipientName?: string;
  recipientAvatar?: string;
  maxSpectators?: number;
  expirationMinutes?: number;
}

// =============================================================================
// Constants
// =============================================================================

const COLLECTION_NAME = "GameInvites";
const SPECTATOR_INVITES_COLLECTION = "SpectatorInvites";
const DEFAULT_EXPIRATION_MINUTES = 60;
const MAX_PENDING_INVITES_PER_USER = 10;
const DEFAULT_MAX_SPECTATORS = 10;

/**
 * Default game settings by type
 */
const DEFAULT_SETTINGS: Record<InviteGameType, GameInviteSettings> = {
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
  "8ball_pool": {
    isRated: true,
    timeControl: { type: "per_turn", seconds: 60 },
    chatEnabled: true,
  },
  air_hockey: {
    isRated: true,
    timeControl: { type: "none", seconds: 0 },
    chatEnabled: true,
  },
  snap_four: {
    isRated: true,
    timeControl: { type: "per_turn", seconds: 60 },
    chatEnabled: true,
  },
  snap_dots: {
    isRated: true,
    timeControl: { type: "per_turn", seconds: 60 },
    chatEnabled: true,
  },
  snap_gomoku: {
    isRated: true,
    timeControl: { type: "per_turn", seconds: 120 },
    chatEnabled: true,
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get game category from type
 */
function getGameCategory(gameType: InviteGameType): GameCategory {
  if (gameType === "8ball_pool") return "multiplayer";
  return "multiplayer";
}

/**
 * Generate unique invite ID
 */
function generateInviteId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `inv_${timestamp}_${random}`;
}

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
 * Get default settings for a game type
 */
function getDefaultInviteSettings(
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
    "8ball_pool": {
      isRated: true,
      timeControl: { type: "per_turn", seconds: 60 },
      chatEnabled: true,
    },
    air_hockey: {
      isRated: true,
      timeControl: { type: "none", seconds: 0 },
      chatEnabled: true,
    },
    snap_four: {
      isRated: true,
      timeControl: { type: "per_turn", seconds: 60 },
      chatEnabled: true,
    },
    snap_dots: {
      isRated: true,
      timeControl: { type: "per_turn", seconds: 60 },
      chatEnabled: true,
    },
    snap_gomoku: {
      isRated: true,
      timeControl: { type: "per_turn", seconds: 120 },
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

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Send a game invite to another user
 */
export async function sendGameInvite(
  senderId: string,
  senderName: string,
  senderAvatar: string | undefined,
  input: CreateInviteInput,
): Promise<GameInvite> {
  // Check pending invite limit
  const pendingCount = await getPendingInviteCount(senderId);
  if (pendingCount >= MAX_PENDING_INVITES_PER_USER) {
    throw new Error(
      `Maximum pending invites (${MAX_PENDING_INVITES_PER_USER}) reached`,
    );
  }

  // Check for existing pending invite to same user for same game
  const existingInvite = await getExistingInvite(
    senderId,
    input.recipientId,
    input.gameType,
  );
  if (existingInvite) {
    throw new Error(
      "You already have a pending invite to this user for this game",
    );
  }

  // Check that sender and recipient are different
  if (senderId === input.recipientId) {
    throw new Error("Cannot send invite to yourself");
  }

  // Build invite
  const now = Timestamp.now();
  const expirationMs =
    (input.expirationMinutes ?? DEFAULT_EXPIRATION_MINUTES) * 60 * 1000;
  const expiresAt = Timestamp.fromMillis(now.toMillis() + expirationMs);

  const inviteId = generateInviteId();
  const settings: GameInviteSettings = {
    ...DEFAULT_SETTINGS[input.gameType],
    ...input.settings,
  };

  // Build invite object, filtering out undefined values (Firestore rejects undefined)
  const invite: Record<string, unknown> = {
    id: inviteId,
    gameType: input.gameType,
    category: getGameCategory(input.gameType),

    senderId,
    senderName,

    recipientId: input.recipientId,
    recipientName: input.recipientName,

    status: "pending",
    settings,

    createdAt: now,
    updatedAt: now,
    expiresAt,

    notificationSent: false,
  };

  // Only add optional avatar fields if they have values
  if (senderAvatar) {
    invite.senderAvatar = senderAvatar;
  }
  if (input.recipientAvatar) {
    invite.recipientAvatar = input.recipientAvatar;
  }

  // Save to Firestore
  const inviteRef = doc(getDb(), COLLECTION_NAME, inviteId);
  await setDoc(inviteRef, invite);

  // Update the DM conversation so the invite bumps it to the top of the inbox
  try {
    const chatId = await getOrCreateChat(senderId, input.recipientId);
    const chatRef = doc(getDb(), "Chats", chatId);
    const gameLabel =
      GAME_METADATA[input.gameType]?.name || input.gameType || "a game";
    await updateDoc(chatRef, {
      lastMessageAt: Timestamp.now(),
      lastMessageText: `🎮 ${senderName} sent a game invite: ${gameLabel}`,
      lastMessageSenderId: senderId,
      lastMessageType: "game_invite",
      updatedAt: Timestamp.now(),
    });
  } catch (e) {
    // Non-critical — don't fail the invite if the conversation update fails
    console.warn("[GameInvites] Failed to update chat preview for invite", e);
  }

  return invite as unknown as GameInvite;
}

/**
 * Accept a game invite
 */
async function acceptGameInvite(
  inviteId: string,
  userId: string,
): Promise<{ invite: GameInvite; gameId: string }> {
  const inviteRef = doc(getDb(), COLLECTION_NAME, inviteId);
  const inviteSnap = await getDoc(inviteRef);

  if (!inviteSnap.exists()) {
    throw new Error("Invite not found");
  }

  const invite = inviteSnap.data() as GameInvite;

  // Validate
  if (invite.recipientId !== userId) {
    throw new Error("You are not the recipient of this invite");
  }

  if (invite.status !== "pending") {
    throw new Error(`Invite is ${invite.status}, cannot accept`);
  }

  // Check expiration
  if (Timestamp.now().toMillis() > invite.expiresAt.toMillis()) {
    await updateDoc(inviteRef, {
      status: "expired",
      updatedAt: serverTimestamp(),
    });
    throw new Error("Invite has expired");
  }

  // Create the game - this would call turnBasedGames.createMatch()
  // For now, generate a placeholder game ID
  const gameId = `game_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;

  // Update invite
  await updateDoc(inviteRef, {
    status: "accepted",
    updatedAt: serverTimestamp(),
    respondedAt: serverTimestamp(),
    gameId,
  });

  return {
    invite: {
      ...invite,
      status: "accepted",
      gameId,
    },
    gameId,
  };
}

/**
 * Decline a game invite
 */
async function declineGameInvite(
  inviteId: string,
  userId: string,
): Promise<void> {
  const inviteRef = doc(getDb(), COLLECTION_NAME, inviteId);
  const inviteSnap = await getDoc(inviteRef);

  if (!inviteSnap.exists()) {
    throw new Error("Invite not found");
  }

  const invite = inviteSnap.data() as GameInvite;

  // Validate
  if (invite.recipientId !== userId) {
    throw new Error("You are not the recipient of this invite");
  }

  if (invite.status !== "pending") {
    throw new Error(`Invite is ${invite.status}, cannot decline`);
  }

  // Update invite
  await updateDoc(inviteRef, {
    status: "declined",
    updatedAt: serverTimestamp(),
    respondedAt: serverTimestamp(),
  });
}

/**
 * Cancel a game invite (sender only)
 */
export async function cancelGameInvite(
  inviteId: string,
  userId: string,
): Promise<void> {
  const inviteRef = doc(getDb(), COLLECTION_NAME, inviteId);
  const inviteSnap = await getDoc(inviteRef);

  if (!inviteSnap.exists()) {
    throw new Error("Invite not found");
  }

  const invite = inviteSnap.data() as GameInvite;

  // Validate
  if (invite.senderId !== userId) {
    throw new Error("Only the sender can cancel an invite");
  }

  if (invite.status !== "pending") {
    throw new Error(`Invite is ${invite.status}, cannot cancel`);
  }

  // Update invite
  await updateDoc(inviteRef, {
    status: "cancelled",
    updatedAt: serverTimestamp(),
  });
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
  const requiredPlayers = customRequiredPlayers ?? minPlayers;

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
    maxSpectators: undefined,

    status: "pending",
    gameId: undefined,

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
    console.warn(
      "[GameInvites] Failed to update conversation preview for invite",
      e,
    );
  }

  console.log(`[GameInvites] Created universal invite: ${inviteId}`, {
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
          error: `Cannot join - invite is ${invite.status}`,
        };
      }

      if (invite.claimedSlots.some((s) => s.playerId === userId)) {
        return { success: false, error: "You have already joined this game" };
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

    console.log(`[GameInvites] Slot claimed: ${inviteId} by ${userId}`, result);
    return result;
  } catch (error) {
    console.error(`[GameInvites] Error claiming slot:`, error);
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

      if (invite.claimedSlots[slotIndex].isHost) {
        return {
          success: false,
          error: "Host cannot leave. Cancel the invite instead.",
        };
      }

      // Remove slot
      const newClaimedSlots = invite.claimedSlots.filter(
        (s) => s.playerId !== userId,
      );

      // Determine new status based on remaining players
      let newStatus: UniversalInviteStatus;
      if (newClaimedSlots.length === 1) {
        newStatus = "pending"; // Back to just the host
      } else if (newClaimedSlots.length < invite.requiredPlayers) {
        newStatus = "filling"; // No longer have required players
      } else {
        newStatus = "ready"; // Still have enough players
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
      console.log(`[GameInvites] Slot unclaimed: ${inviteId} by ${userId}`);
    } else {
      console.log(
        `[GameInvites] Unclaim failed: ${inviteId} - ${result.error}`,
      );
    }
    return result;
  } catch (error) {
    console.error(`[GameInvites] Error unclaiming slot:`, error);
    return { success: false, error: "Failed to leave game" };
  }
}

/**
 * Join as spectator for a game
 *
 * Only allowed when:
 * - spectatingEnabled is true
 * - status is 'ready', 'active', or 'completed'
 * - User is in eligibleUserIds
 */
export async function joinAsSpectator(
  inviteId: string,
  userId: string,
  userName: string,
  userAvatar?: string,
): Promise<{ success: boolean; gameId?: string; error?: string }> {
  const inviteRef = doc(getDb(), COLLECTION_NAME, inviteId);

  try {
    const result = await runTransaction(getDb(), async (transaction) => {
      const inviteSnap = await transaction.get(inviteRef);

      if (!inviteSnap.exists()) {
        return { success: false, error: "Invite not found" };
      }

      const invite = inviteSnap.data() as UniversalGameInvite;

      // Validation
      if (!invite.spectatingEnabled) {
        return {
          success: false,
          error: "Spectating is not enabled for this game",
        };
      }

      // Can only spectate active games (game must be started and have a gameId)
      if (invite.status !== "active" || !invite.gameId) {
        return {
          success: false,
          error: "Game is not active yet - wait for host to start the game",
        };
      }

      if (!invite.eligibleUserIds.includes(userId)) {
        return { success: false, error: "You cannot spectate this game" };
      }

      if (invite.spectators.some((s) => s.userId === userId)) {
        return { success: false, error: "You are already spectating" };
      }

      if (invite.claimedSlots.some((s) => s.playerId === userId)) {
        return { success: false, error: "You are a player in this game" };
      }

      if (
        invite.maxSpectators &&
        invite.spectators.length >= invite.maxSpectators
      ) {
        return { success: false, error: "Maximum spectators reached" };
      }

      // Add spectator (omit undefined fields for Firestore compatibility)
      const newSpectator: SpectatorEntry = {
        userId,
        userName,
        joinedAt: Date.now(),
        ...(userAvatar !== undefined && { userAvatar }),
      };

      transaction.update(inviteRef, {
        spectators: [...invite.spectators, newSpectator],
        updatedAt: Date.now(),
      });

      return { success: true, gameId: invite.gameId };
    });

    console.log(`[GameInvites] Spectator joined: ${inviteId} by ${userId}`);
    return result;
  } catch (error) {
    console.error(`[GameInvites] Error joining as spectator:`, error);
    return { success: false, error: "Failed to join as spectator" };
  }
}

/**
 * Leave spectator mode
 */
export async function leaveSpectator(
  inviteId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  const inviteRef = doc(getDb(), COLLECTION_NAME, inviteId);

  try {
    const inviteSnap = await getDoc(inviteRef);

    if (!inviteSnap.exists()) {
      return { success: false, error: "Invite not found" };
    }

    const invite = inviteSnap.data() as UniversalGameInvite;
    const newSpectators = invite.spectators.filter((s) => s.userId !== userId);

    await updateDoc(inviteRef, {
      spectators: newSpectators,
      updatedAt: Date.now(),
    });

    console.log(`[GameInvites] Spectator left: ${inviteId} by ${userId}`);
    return { success: true };
  } catch (error) {
    console.error(`[GameInvites] Error leaving spectator:`, error);
    return { success: false, error: "Failed to leave spectator mode" };
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
): Promise<{ success: boolean; gameId?: string; error?: string }> {
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
        return { success: false, error: "Only the host can start the game" };
      }

      // Validation: Must be in startable status
      if (!["pending", "filling", "ready"].includes(invite.status)) {
        return {
          success: false,
          error: `Cannot start - game is ${invite.status}`,
        };
      }

      // Validation: Check minimum players from GAME_METADATA
      const metadata = GAME_METADATA[invite.gameType as ExtendedGameType];
      if (!metadata) {
        return { success: false, error: "Unknown game type" };
      }

      if (invite.claimedSlots.length < metadata.minPlayers) {
        return {
          success: false,
          error: `Need at least ${metadata.minPlayers} players to start`,
        };
      }

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
        allowSpectators: invite.spectatingEnabled ?? false,
        chatEnabled: invite.settings?.chatEnabled ?? true,
        timeControl: invite.settings?.timeControl?.seconds,
      };

      // Build conversation context for game tracking (Phase 1: Game System Overhaul)
      const conversationContext = invite.conversationId
        ? {
            conversationId: invite.conversationId,
            conversationType: invite.context as "dm" | "group",
          }
        : undefined;

      const gameId = await createMatch(
        invite.gameType as TurnBasedGameType,
        player1,
        player2,
        matchConfig,
        conversationContext,
        inviteId, // Pass inviteId so game can reference back to invite
      );

      // Update invite with game reference
      transaction.update(inviteRef, {
        status: "active" as UniversalInviteStatus,
        gameId,
        updatedAt: Date.now(),
        filledAt: Date.now(),
      });

      return { success: true, gameId };
    });

    console.log(`[GameInvites] Game started early: ${inviteId}`, result);
    return result;
  } catch (error) {
    console.error(`[GameInvites] Error starting game early:`, error);
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
    const inviteSnap = await getDoc(inviteRef);

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
        error: `Cannot cancel - game is ${invite.status}`,
      };
    }

    // Update status to cancelled
    await updateDoc(inviteRef, {
      status: "cancelled" as UniversalInviteStatus,
      updatedAt: Date.now(),
    });

    console.log(`[GameInvites] Universal invite cancelled: ${inviteId}`);
    return { success: true };
  } catch (error) {
    console.error(`[GameInvites] Error cancelling invite:`, error);
    return { success: false, error: "Failed to cancel invite" };
  }
}

// =============================================================================
// Query Functions
// =============================================================================

/**
 * Get invite by ID
 */
async function getInviteById(inviteId: string): Promise<GameInvite | null> {
  const inviteRef = doc(getDb(), COLLECTION_NAME, inviteId);
  const inviteSnap = await getDoc(inviteRef);

  if (!inviteSnap.exists()) {
    return null;
  }

  return inviteSnap.data() as GameInvite;
}

/**
 * Get invites sent by user
 */
async function getSentInvites(
  userId: string,
  options: InviteFilterOptions = {},
): Promise<GameInvite[]> {
  let q = query(
    collection(getDb(), COLLECTION_NAME),
    where("senderId", "==", userId),
    orderBy("createdAt", "desc"),
  );

  if (options.status && options.status.length > 0) {
    q = query(q, where("status", "in", options.status));
  }

  if (options.gameType) {
    q = query(q, where("gameType", "==", options.gameType));
  }

  if (options.limit) {
    q = query(q, limit(options.limit));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as GameInvite);
}

/**
 * Get invites received by user
 */
async function getReceivedInvites(
  userId: string,
  options: InviteFilterOptions = {},
): Promise<GameInvite[]> {
  let q = query(
    collection(getDb(), COLLECTION_NAME),
    where("recipientId", "==", userId),
    orderBy("createdAt", "desc"),
  );

  if (options.status && options.status.length > 0) {
    q = query(q, where("status", "in", options.status));
  }

  if (options.gameType) {
    q = query(q, where("gameType", "==", options.gameType));
  }

  if (options.limit) {
    q = query(q, limit(options.limit));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as GameInvite);
}

/**
 * Get pending invites for user (both sent and received)
 */
export async function getPendingInvites(userId: string): Promise<{
  sent: GameInvite[];
  received: GameInvite[];
}> {
  const [sent, received] = await Promise.all([
    getSentInvites(userId, { status: ["pending"] }),
    getReceivedInvites(userId, { status: ["pending"] }),
  ]);

  return { sent, received };
}

/**
 * Get count of pending invites sent by user
 */
async function getPendingInviteCount(userId: string): Promise<number> {
  const q = query(
    collection(getDb(), COLLECTION_NAME),
    where("senderId", "==", userId),
    where("status", "==", "pending"),
  );

  const snapshot = await getDocs(q);
  return snapshot.size;
}

/**
 * Check for existing pending invite
 */
async function getExistingInvite(
  senderId: string,
  recipientId: string,
  gameType: InviteGameType,
): Promise<GameInvite | null> {
  const q = query(
    collection(getDb(), COLLECTION_NAME),
    where("senderId", "==", senderId),
    where("recipientId", "==", recipientId),
    where("gameType", "==", gameType),
    where("status", "==", "pending"),
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }

  return snapshot.docs[0].data() as GameInvite;
}

// =============================================================================
// Universal Invite Query Functions
// =============================================================================

/**
 * Get invites for the Play page
 *
 * Returns DM invites where:
 * - showInPlayPage is true
 * - User is in eligibleUserIds
 * - Status is pending or filling
 * - User is NOT the sender
 */
async function getPlayPageInvites(
  userId: string,
): Promise<UniversalGameInvite[]> {
  const q = query(
    collection(getDb(), COLLECTION_NAME),
    where("showInPlayPage", "==", true),
    where("eligibleUserIds", "array-contains", userId),
    where("status", "in", ["pending", "filling"]),
    orderBy("createdAt", "desc"),
    limit(20),
  );

  const snapshot = await getDocs(q);

  return snapshot.docs
    .map((d) => d.data() as UniversalGameInvite)
    .filter((inv) => inv.senderId !== userId); // Exclude own invites
}

/**
 * Get active invites for a specific conversation (chat display)
 *
 * Returns invites where:
 * - conversationId matches
 * - Status is pending, filling, ready, or active
 */
async function getConversationInvites(
  conversationId: string,
  userId: string,
): Promise<UniversalGameInvite[]> {
  const q = query(
    collection(getDb(), COLLECTION_NAME),
    where("conversationId", "==", conversationId),
    where("status", "in", ["pending", "filling", "ready", "active"]),
    orderBy("createdAt", "desc"),
    limit(10),
  );

  const snapshot = await getDocs(q);

  return snapshot.docs
    .map((d) => d.data() as UniversalGameInvite)
    .filter((inv) => inv.eligibleUserIds.includes(userId));
}

/**
 * Get a universal invite by ID
 */
async function getUniversalInviteById(
  inviteId: string,
): Promise<UniversalGameInvite | null> {
  const inviteRef = doc(getDb(), COLLECTION_NAME, inviteId);
  const inviteSnap = await getDoc(inviteRef);

  if (!inviteSnap.exists()) {
    return null;
  }

  return inviteSnap.data() as UniversalGameInvite;
}

// =============================================================================
// Real-time Subscriptions
// =============================================================================

/**
 * Subscribe to pending invites received by user
 */
export function subscribeToPendingInvites(
  userId: string,
  onUpdate: (invites: GameInvite[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), COLLECTION_NAME),
    where("recipientId", "==", userId),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc"),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const invites = snapshot.docs.map((doc) => doc.data() as GameInvite);
      // Filter out expired invites
      const now = Timestamp.now().toMillis();
      const validInvites = invites.filter(
        (inv) => inv.expiresAt.toMillis() > now,
      );
      onUpdate(validInvites);
    },
    (error) => {
      console.error("[GameInvites] Subscription error:", error);
      onError?.(error);
    },
  );
}

/**
 * Subscribe to a specific invite
 */
function subscribeToInvite(
  inviteId: string,
  onUpdate: (invite: GameInvite | null) => void,
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
      onUpdate(snapshot.data() as GameInvite);
    },
    (error) => {
      console.error("[GameInvites] Invite subscription error:", error);
      onError?.(error);
    },
  );
}

// =============================================================================
// Universal Invite Subscriptions
// =============================================================================

/**
 * Subscribe to a universal invite's updates
 *
 * Use this to show real-time slot updates in UI.
 */
function subscribeToUniversalInvite(
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
      console.error(
        "[GameInvites] Universal invite subscription error:",
        error,
      );
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
      console.error("[GameInvites] Play page subscription error:", error);
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
      console.error(
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
 * Mark expired invites (called by Cloud Function)
 * This is a placeholder - actual implementation in Cloud Functions
 */
async function markExpiredInvites(): Promise<number> {
  const now = Timestamp.now();

  const q = query(
    collection(getDb(), COLLECTION_NAME),
    where("status", "==", "pending"),
    where("expiresAt", "<", now),
  );

  const snapshot = await getDocs(q);

  const updates = snapshot.docs.map((doc) =>
    updateDoc(doc.ref, {
      status: "expired",
      updatedAt: serverTimestamp(),
    }),
  );

  await Promise.all(updates);

  return snapshot.size;
}

/**
 * Delete old invites (called by Cloud Function)
 * Removes invites older than specified days
 */
async function deleteOldInvites(daysOld: number = 30): Promise<number> {
  const cutoff = Timestamp.fromMillis(
    Date.now() - daysOld * 24 * 60 * 60 * 1000,
  );

  const q = query(
    collection(getDb(), COLLECTION_NAME),
    where("status", "in", ["accepted", "declined", "expired", "cancelled"]),
    where("createdAt", "<", cutoff),
  );

  const snapshot = await getDocs(q);

  const deletes = snapshot.docs.map((doc) => deleteDoc(doc.ref));
  await Promise.all(deletes);

  return snapshot.size;
}

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
    console.warn("[GameInvites] Cannot cleanup invites - not authenticated");
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
          console.log(
            `[GameInvites] Skipping invite ${invite.id} - no permission to read game (user may not be participant)`,
          );
        } else {
          console.error(
            `[GameInvites] Error checking game status for invite ${invite.id}:`,
            error,
          );
        }
      }
    }
  }

  if (cleanedUp > 0) {
    console.log(
      `[GameInvites] Cleaned up ${cleanedUp} completed game invites for conversation ${conversationId}`,
    );
  }

  return cleanedUp;
}

/**
 * Clean up stale spectator invites for a conversation
 * Handles:
 * - Expired invites (past expiresAt timestamp)
 * - Cancelled invites older than 1 hour
 * - Completed invites older than 1 hour
 *
 * @param conversationId - The conversation to clean up invites for
 * @param userId - The current user's ID (for security rules)
 * @returns Number of invites cleaned up
 */
export async function cleanupSpectatorInvites(
  conversationId: string,
  userId: string,
): Promise<number> {
  try {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    // Query spectator invites for this conversation that the user can access
    const q = query(
      collection(getDb(), SPECTATOR_INVITES_COLLECTION),
      where("conversationId", "==", conversationId),
      where("eligibleUserIds", "array-contains", userId),
    );

    const snapshot = await getDocs(q);
    let cleanedUp = 0;

    for (const inviteDoc of snapshot.docs) {
      const invite = inviteDoc.data() as SpectatorInvite;

      // Check if expired
      if (invite.expiresAt < now) {
        await updateDoc(inviteDoc.ref, {
          status: "expired",
          updatedAt: now,
        });
        cleanedUp++;
        continue;
      }

      // Check if old cancelled/completed invite (clean up after 1 hour)
      if (
        (invite.status === "cancelled" || invite.status === "completed") &&
        (invite.updatedAt || invite.createdAt) < oneHourAgo
      ) {
        await deleteDoc(inviteDoc.ref);
        cleanedUp++;
        continue;
      }
    }

    if (cleanedUp > 0) {
      console.log(
        `[GameInvites] Cleaned up ${cleanedUp} spectator invites for conversation ${conversationId}`,
      );
    }

    return cleanedUp;
  } catch (error) {
    console.error("[GameInvites] Error cleaning up spectator invites:", error);
    return 0;
  }
}

// =============================================================================
// Spectator Invite Functions (Single-Player Games)
// =============================================================================

/**
 * Generate unique spectator invite ID
 */
function generateSpectatorInviteId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `spinv_${timestamp}_${random}`;
}

/**
 * Send a spectator invite for a single-player game
 *
 * Creates an invite that allows others to watch you play a single-player game.
 * When the host starts the game, a live session is created and spectators can
 * join to watch in real-time.
 *
 * @example
 * // DM spectator invite
 * const invite = await sendSpectatorInvite({
 *   hostId: uid,
 *   hostName: "Alice",
 *   gameType: "bounce_blitz",
 *   context: "dm",
 *   conversationId: chatId,
 *   recipientId: "user-bob",
 *   recipientName: "Bob",
 * });
 *
 * // Group spectator invite
 * const invite = await sendSpectatorInvite({
 *   hostId: uid,
 *   hostName: "Alice",
 *   gameType: "snap_2048",
 *   context: "group",
 *   conversationId: groupId,
 *   conversationName: "Game Night",
 *   eligibleUserIds: ["alice", "bob", "charlie"],
 * });
 */
export async function sendSpectatorInvite(
  params: SendSpectatorInviteParams,
): Promise<SpectatorInvite> {
  const {
    hostId,
    hostName,
    hostAvatar,
    gameType,
    context,
    conversationId,
    conversationName,
    eligibleUserIds,
    recipientId,
    recipientName,
    recipientAvatar,
    maxSpectators = DEFAULT_MAX_SPECTATORS,
    expirationMinutes = DEFAULT_EXPIRATION_MINUTES,
  } = params;

  // Validation
  if (context === "dm" && !recipientId) {
    throw new Error("recipientId is required for DM spectator invites");
  }
  if (context === "group" && (!eligibleUserIds || eligibleUserIds.length < 1)) {
    throw new Error(
      "eligibleUserIds with at least 1 member required for group spectator invites",
    );
  }

  // Determine targeting
  const isSpecificTarget = context === "dm";
  const showInPlayPage = isSpecificTarget;

  // Build eligible user list (spectators)
  const finalEligibleUserIds =
    context === "dm" ? [recipientId!] : [...(eligibleUserIds || [])];

  // Remove host from eligible list (host plays, not spectates)
  const spectatorEligibleIds = finalEligibleUserIds.filter(
    (id) => id !== hostId,
  );

  // Build invite
  const now = Date.now();
  const inviteId = generateSpectatorInviteId();

  const invite: SpectatorInvite = {
    id: inviteId,
    gameType,

    hostId,
    hostName,
    hostAvatar,

    context,
    conversationId,
    conversationName,

    eligibleUserIds: spectatorEligibleIds,
    recipientId: isSpecificTarget ? recipientId : undefined,
    recipientName: isSpecificTarget ? recipientName : undefined,
    recipientAvatar: isSpecificTarget ? recipientAvatar : undefined,

    spectators: [],
    maxSpectators,

    status: "pending",
    liveSessionId: undefined,

    createdAt: now,
    updatedAt: now,
    expiresAt: now + expirationMinutes * 60 * 1000,

    showInPlayPage,
    chatMessageId: undefined,
  };

  // Remove undefined values (Firestore doesn't like undefined)
  const cleanInvite = JSON.parse(JSON.stringify(invite));

  // Save to Firestore
  const inviteRef = doc(getDb(), SPECTATOR_INVITES_COLLECTION, inviteId);
  await setDoc(inviteRef, cleanInvite);

  console.log(`[GameInvites] Created spectator invite: ${inviteId}`, {
    context,
    gameType,
    maxSpectators,
  });

  return invite;
}

/**
 * Start a spectator invite session
 *
 * Called when the host starts playing. Links the invite to a live session
 * so spectators can watch.
 */
export async function startSpectatorInvite(
  inviteId: string,
  liveSessionId: string,
): Promise<boolean> {
  try {
    const inviteRef = doc(getDb(), SPECTATOR_INVITES_COLLECTION, inviteId);
    await updateDoc(inviteRef, {
      status: "active",
      liveSessionId,
      startedAt: Date.now(),
      updatedAt: Date.now(),
    });

    console.log(
      `[GameInvites] Started spectator invite: ${inviteId} with session: ${liveSessionId}`,
    );
    return true;
  } catch (error) {
    console.error("[GameInvites] Error starting spectator invite:", error);
    return false;
  }
}

/**
 * End a spectator invite session
 */
async function endSpectatorInvite(inviteId: string): Promise<boolean> {
  try {
    const inviteRef = doc(getDb(), SPECTATOR_INVITES_COLLECTION, inviteId);
    await updateDoc(inviteRef, {
      status: "completed",
      endedAt: Date.now(),
      updatedAt: Date.now(),
    });

    console.log(`[GameInvites] Ended spectator invite: ${inviteId}`);
    return true;
  } catch (error) {
    console.error("[GameInvites] Error ending spectator invite:", error);
    return false;
  }
}

/**
 * Cancel a spectator invite
 */
export async function cancelSpectatorInvite(
  inviteId: string,
): Promise<boolean> {
  try {
    const inviteRef = doc(getDb(), SPECTATOR_INVITES_COLLECTION, inviteId);
    await updateDoc(inviteRef, {
      status: "cancelled",
      updatedAt: Date.now(),
    });

    console.log(`[GameInvites] Cancelled spectator invite: ${inviteId}`);
    return true;
  } catch (error) {
    console.error("[GameInvites] Error cancelling spectator invite:", error);
    return false;
  }
}

/**
 * Get a spectator invite by ID
 */
async function getSpectatorInviteById(
  inviteId: string,
): Promise<SpectatorInvite | null> {
  try {
    const inviteRef = doc(getDb(), SPECTATOR_INVITES_COLLECTION, inviteId);
    const snapshot = await getDoc(inviteRef);

    if (!snapshot.exists()) {
      return null;
    }

    return snapshot.data() as SpectatorInvite;
  } catch (error) {
    console.error("[GameInvites] Error getting spectator invite:", error);
    return null;
  }
}

/**
 * Join a spectator invite as a spectator
 */
export async function joinSpectatorInvite(
  inviteId: string,
  userId: string,
  userName: string,
  userAvatar?: string,
): Promise<{ success: boolean; error?: string; liveSessionId?: string }> {
  try {
    const inviteRef = doc(getDb(), SPECTATOR_INVITES_COLLECTION, inviteId);
    const snapshot = await getDoc(inviteRef);

    if (!snapshot.exists()) {
      return { success: false, error: "Invite not found" };
    }

    const invite = snapshot.data() as SpectatorInvite;

    // Check status
    if (invite.status === "completed" || invite.status === "cancelled") {
      return { success: false, error: "Invite has ended" };
    }

    if (invite.status === "expired" || Date.now() > invite.expiresAt) {
      return { success: false, error: "Invite has expired" };
    }

    // Check eligibility
    if (!invite.eligibleUserIds.includes(userId)) {
      return { success: false, error: "Not invited to spectate this game" };
    }

    // Check if already spectating
    if (invite.spectators.some((s) => s.userId === userId)) {
      return {
        success: true,
        liveSessionId: invite.liveSessionId,
      };
    }

    // Check max spectators
    if (
      invite.maxSpectators !== undefined &&
      invite.spectators.length >= invite.maxSpectators
    ) {
      return { success: false, error: "Maximum spectators reached" };
    }

    // Add spectator - only include defined fields (Firestore rejects undefined)
    const spectator: SpectatorEntry = {
      userId,
      userName,
      joinedAt: Date.now(),
      ...(userAvatar !== undefined && { userAvatar }),
    };

    // Update using arrayUnion
    await updateDoc(inviteRef, {
      spectators: arrayUnion(spectator),
      updatedAt: Date.now(),
    });

    console.log(
      `[GameInvites] ${userName} joined spectator invite: ${inviteId}`,
    );
    return {
      success: true,
      liveSessionId: invite.liveSessionId,
    };
  } catch (error: any) {
    console.error("[GameInvites] Error joining spectator invite:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Leave a spectator invite
 */
export async function leaveSpectatorInvite(
  inviteId: string,
  userId: string,
): Promise<boolean> {
  try {
    const inviteRef = doc(getDb(), SPECTATOR_INVITES_COLLECTION, inviteId);
    const snapshot = await getDoc(inviteRef);

    if (!snapshot.exists()) {
      return false;
    }

    const invite = snapshot.data() as SpectatorInvite;
    const spectator = invite.spectators.find((s) => s.userId === userId);

    if (!spectator) {
      return true; // Already not spectating
    }

    await updateDoc(inviteRef, {
      spectators: arrayRemove(spectator),
      updatedAt: Date.now(),
    });

    console.log(
      `[GameInvites] User ${userId} left spectator invite: ${inviteId}`,
    );
    return true;
  } catch (error) {
    console.error("[GameInvites] Error leaving spectator invite:", error);
    return false;
  }
}

/**
 * Subscribe to a spectator invite
 */
function subscribeToSpectatorInvite(
  inviteId: string,
  onUpdate: (invite: SpectatorInvite | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const inviteRef = doc(getDb(), SPECTATOR_INVITES_COLLECTION, inviteId);

  return onSnapshot(
    inviteRef,
    (snapshot) => {
      if (snapshot.exists()) {
        onUpdate(snapshot.data() as SpectatorInvite);
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      console.error(
        "[GameInvites] Spectator invite subscription error:",
        error,
      );
      onError?.(error);
    },
  );
}

/**
 * Get spectator invites for a conversation
 */
async function getConversationSpectatorInvites(
  conversationId: string,
): Promise<SpectatorInvite[]> {
  const currentUser = getAuth().currentUser;
  if (!currentUser) {
    return [];
  }

  const q = query(
    collection(getDb(), SPECTATOR_INVITES_COLLECTION),
    where("conversationId", "==", conversationId),
    where("status", "in", ["pending", "active"]),
    orderBy("createdAt", "desc"),
    limit(20),
  );

  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data() as SpectatorInvite);
  } catch (error) {
    console.error(
      "[GameInvites] Error getting conversation spectator invites:",
      error,
    );
    return [];
  }
}

/**
 * Subscribe to spectator invites for a conversation
 * User must be eligible (in eligibleUserIds) to see invites
 *
 * Includes graceful handling for index-building errors with automatic retry.
 */
export function subscribeToConversationSpectatorInvites(
  conversationId: string,
  userId: string,
  onUpdate: (invites: SpectatorInvite[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  let retryTimeout: ReturnType<typeof setTimeout> | null = null;
  let unsubscribeSnapshot: Unsubscribe | null = null;
  let retryCount = 0;
  const MAX_RETRIES = 5;
  const RETRY_DELAY_MS = 10000; // 10 seconds between retries

  const setupSubscription = (): Unsubscribe => {
    // Query for invites where the user is eligible to see them
    // Note: Firestore doesn't allow combining 'in' with 'array-contains',
    // so we filter by eligibleUserIds and check status client-side
    const q = query(
      collection(getDb(), SPECTATOR_INVITES_COLLECTION),
      where("conversationId", "==", conversationId),
      where("eligibleUserIds", "array-contains", userId),
      orderBy("createdAt", "desc"),
      limit(20),
    );

    unsubscribeSnapshot = onSnapshot(
      q,
      (snapshot) => {
        // Reset retry count on successful snapshot
        retryCount = 0;
        // Filter to only pending/active status client-side
        const invites = snapshot.docs
          .map((d) => d.data() as SpectatorInvite)
          .filter((inv) => inv.status === "pending" || inv.status === "active");
        onUpdate(invites);
      },
      (error) => {
        const errorMessage = error.message || "";

        // Check if this is an "index building" error
        if (
          errorMessage.includes("index") &&
          errorMessage.includes("building")
        ) {
          // Silently retry after delay if we haven't exceeded max retries
          if (retryCount < MAX_RETRIES) {
            retryCount++;
            console.log(
              `[GameInvites] Spectator index still building, retrying in ${RETRY_DELAY_MS / 1000}s (attempt ${retryCount}/${MAX_RETRIES})`,
            );
            retryTimeout = setTimeout(() => {
              if (unsubscribeSnapshot) {
                unsubscribeSnapshot();
              }
              setupSubscription();
            }, RETRY_DELAY_MS);
            return;
          }
        }

        // For other errors or if retries exhausted, log and notify
        console.error(
          "[GameInvites] Spectator invites subscription error:",
          error,
        );
        onError?.(error);
      },
    );

    return unsubscribeSnapshot;
  };

  // Initial setup
  setupSubscription();

  // Return cleanup function
  return () => {
    if (retryTimeout) {
      clearTimeout(retryTimeout);
    }
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
    }
  };
}

// =============================================================================
// Export
// =============================================================================

export const gameInvites = {
  // Core (legacy)
  send: sendGameInvite,
  accept: acceptGameInvite,
  decline: declineGameInvite,
  cancel: cancelGameInvite,

  // Query (legacy)
  getById: getInviteById,
  getSent: getSentInvites,
  getReceived: getReceivedInvites,
  getPending: getPendingInvites,

  // Subscriptions (legacy)
  subscribeToPending: subscribeToPendingInvites,
  subscribeToInvite,

  // Cleanup
  markExpired: markExpiredInvites,
  deleteOld: deleteOldInvites,
  cleanupCompleted: cleanupCompletedGameInvites,

  // NEW: Universal invite functions
  sendUniversal: sendUniversalInvite,
  claimSlot: claimInviteSlot,
  unclaimSlot: unclaimInviteSlot,
  joinSpectator: joinAsSpectator,
  leaveSpectator: leaveSpectator,

  // NEW: Host Controls
  startEarly: startGameEarly,
  cancelUniversal: cancelUniversalInvite,
  getPlayPage: getPlayPageInvites,
  getConversation: getConversationInvites,
  getUniversalById: getUniversalInviteById,
  subscribeUniversal: subscribeToUniversalInvite,
  subscribePlayPage: subscribeToPlayPageInvites,
  subscribeConversation: subscribeToConversationInvites,

  // NEW: Single-Player Spectator Invites
  sendSpectatorInvite,
  startSpectatorInvite,
  endSpectatorInvite,
  cancelSpectatorInvite,
  getSpectatorInviteById,
  joinSpectatorInvite,
  leaveSpectatorInvite,
  subscribeToSpectatorInvite,
  getConversationSpectatorInvites,
  subscribeToConversationSpectatorInvites,
};
