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
  TurnBasedGameType,
} from "../types/games";
import {
  PlayerSlot,
  SendUniversalInviteParams,
  SpectatorEntry,
  UniversalGameInvite,
  UniversalInviteStatus,
} from "../types/turnBased";
import { getFirestoreInstance } from "./firebase";

// Lazy getter to avoid calling getFirestoreInstance at module load time
const getDb = () => getFirestoreInstance();

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
export interface GameInvite {
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
// Constants
// =============================================================================

const COLLECTION_NAME = "GameInvites";
const DEFAULT_EXPIRATION_MINUTES = 60;
const MAX_PENDING_INVITES_PER_USER = 10;

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

  return invite as unknown as GameInvite;
}

/**
 * Accept a game invite
 */
export async function acceptGameInvite(
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
export async function declineGameInvite(
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

      // Build new slot
      const newSlot: PlayerSlot = {
        playerId: userId,
        playerName: userName,
        playerAvatar: userAvatar,
        claimedAt: Date.now(),
        isHost: false,
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

      // Validation
      if (!["pending", "filling"].includes(invite.status)) {
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

      // Determine new status
      let newStatus: UniversalInviteStatus = invite.status;
      if (newClaimedSlots.length === 1) {
        newStatus = "pending"; // Back to just the host
      }

      transaction.update(inviteRef, {
        claimedSlots: newClaimedSlots,
        status: newStatus,
        updatedAt: Date.now(),
        filledAt: null, // Clear if it was set
      });

      return { success: true };
    });

    console.log(`[GameInvites] Slot unclaimed: ${inviteId} by ${userId}`);
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

      if (!["ready", "active", "completed"].includes(invite.status)) {
        return {
          success: false,
          error: "Game is not ready for spectators yet",
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

      // Add spectator
      const newSpectator: SpectatorEntry = {
        userId,
        userName,
        userAvatar,
        joinedAt: Date.now(),
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
// Query Functions
// =============================================================================

/**
 * Get invite by ID
 */
export async function getInviteById(
  inviteId: string,
): Promise<GameInvite | null> {
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
export async function getSentInvites(
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
export async function getReceivedInvites(
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
export async function getPlayPageInvites(
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
export async function getConversationInvites(
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
export async function getUniversalInviteById(
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
export function subscribeToInvite(
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
export async function markExpiredInvites(): Promise<number> {
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
export async function deleteOldInvites(daysOld: number = 30): Promise<number> {
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

  // NEW: Universal invite functions
  sendUniversal: sendUniversalInvite,
  claimSlot: claimInviteSlot,
  unclaimSlot: unclaimInviteSlot,
  joinSpectator: joinAsSpectator,
  leaveSpectator: leaveSpectator,
  getPlayPage: getPlayPageInvites,
  getConversation: getConversationInvites,
  getUniversalById: getUniversalInviteById,
  subscribeUniversal: subscribeToUniversalInvite,
  subscribePlayPage: subscribeToPlayPageInvites,
  subscribeConversation: subscribeToConversationInvites,
};

export default gameInvites;
