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
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  GameCategory,
  RealTimeGameType,
  TurnBasedGameType,
} from "../types/games";
import { getFirestoreInstance } from "./firebase";

// Get Firestore instance
const db = getFirestoreInstance();

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
  const inviteRef = doc(db, COLLECTION_NAME, inviteId);
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
  const inviteRef = doc(db, COLLECTION_NAME, inviteId);
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
  const inviteRef = doc(db, COLLECTION_NAME, inviteId);
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
  const inviteRef = doc(db, COLLECTION_NAME, inviteId);
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
// Query Functions
// =============================================================================

/**
 * Get invite by ID
 */
export async function getInviteById(
  inviteId: string,
): Promise<GameInvite | null> {
  const inviteRef = doc(db, COLLECTION_NAME, inviteId);
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
    collection(db, COLLECTION_NAME),
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
    collection(db, COLLECTION_NAME),
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
    collection(db, COLLECTION_NAME),
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
    collection(db, COLLECTION_NAME),
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
    collection(db, COLLECTION_NAME),
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
  const inviteRef = doc(db, COLLECTION_NAME, inviteId);

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
// Cleanup Functions
// =============================================================================

/**
 * Mark expired invites (called by Cloud Function)
 * This is a placeholder - actual implementation in Cloud Functions
 */
export async function markExpiredInvites(): Promise<number> {
  const now = Timestamp.now();

  const q = query(
    collection(db, COLLECTION_NAME),
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
    collection(db, COLLECTION_NAME),
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
  // Core
  send: sendGameInvite,
  accept: acceptGameInvite,
  decline: declineGameInvite,
  cancel: cancelGameInvite,

  // Query
  getById: getInviteById,
  getSent: getSentInvites,
  getReceived: getReceivedInvites,
  getPending: getPendingInvites,

  // Subscriptions
  subscribeToPending: subscribeToPendingInvites,
  subscribeToInvite,

  // Cleanup
  markExpired: markExpiredInvites,
  deleteOld: deleteOldInvites,
};

export default gameInvites;
