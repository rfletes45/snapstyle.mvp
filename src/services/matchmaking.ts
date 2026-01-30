/**
 * Matchmaking Service
 *
 * Handles automatic matchmaking for games including:
 * - Queue management
 * - ELO-based matching
 * - Search expansion over time
 * - Match creation
 *
 * @see docs/07_GAMES_ARCHITECTURE.md Section 2.3
 */

import {
  collection,
  deleteDoc,
  doc,
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
  GameCategory,
  RealTimeGameType,
  TurnBasedGameType,
} from "../types/games";
import { getFirestoreInstance } from "./firebase";

// Lazy getter to avoid calling getFirestoreInstance at module load time
const getDb = () => getFirestoreInstance();

// =============================================================================
// Types
// =============================================================================

/**
 * Supported game types for matchmaking
 */
export type MatchmakingGameType = TurnBasedGameType | RealTimeGameType;

/**
 * Queue entry status
 */
export type QueueStatus = "searching" | "matched" | "cancelled" | "expired";

/**
 * Matchmaking queue entry
 */
export interface MatchmakingQueueEntry {
  id: string;

  // Player info
  playerId: string;
  playerName: string;
  playerAvatar?: string;

  // Game settings
  gameType: MatchmakingGameType;
  category: GameCategory;
  isRated: boolean;

  // Rating for matching
  rating: number;
  ratingDeviation?: number; // For Glicko-2

  // Search parameters
  initialRatingRange: number;
  currentRatingRange: number;
  maxRatingRange: number;
  rangeExpansionRate: number; // Points per second

  // Status
  status: QueueStatus;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  expiresAt: Timestamp;

  // Match result
  matchedWith?: string; // Player ID
  gameId?: string;
  matchedAt?: Timestamp;
}

/**
 * Join queue input
 */
export interface JoinQueueInput {
  gameType: MatchmakingGameType;
  isRated: boolean;
  initialRatingRange?: number;
  maxRatingRange?: number;
  timeoutMinutes?: number;
}

/**
 * Match result
 */
export interface MatchResult {
  player1Id: string;
  player2Id: string;
  gameId: string;
  gameType: MatchmakingGameType;
  isRated: boolean;
}

/**
 * Queue stats
 */
export interface QueueStats {
  gameType: MatchmakingGameType;
  playersInQueue: number;
  averageWaitTime: number; // Seconds
  ratingDistribution: {
    range: string;
    count: number;
  }[];
}

// =============================================================================
// Constants
// =============================================================================

const COLLECTION_NAME = "MatchmakingQueue";
const DEFAULT_TIMEOUT_MINUTES = 5;
const DEFAULT_INITIAL_RANGE = 100;
const DEFAULT_MAX_RANGE = 500;
const DEFAULT_EXPANSION_RATE = 10; // Points per second
const MIN_SEARCH_INTERVAL_MS = 1000;

/**
 * Default rating for new players
 */
const DEFAULT_RATING = 1200;

/**
 * Rating ranges for display
 */
const RATING_RANGES = [
  { min: 0, max: 800, label: "Beginner" },
  { min: 800, max: 1000, label: "Novice" },
  { min: 1000, max: 1200, label: "Intermediate" },
  { min: 1200, max: 1400, label: "Advanced" },
  { min: 1400, max: 1600, label: "Expert" },
  { min: 1600, max: 1800, label: "Master" },
  { min: 1800, max: 2000, label: "Grandmaster" },
  { min: 2000, max: Infinity, label: "Legend" },
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate unique queue entry ID
 */
function generateQueueId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `mm_${timestamp}_${random}`;
}

/**
 * Get game category from type
 */
function getGameCategory(gameType: MatchmakingGameType): GameCategory {
  if (gameType === "8ball_pool") return "multiplayer";
  return "multiplayer";
}

/**
 * Calculate current rating range based on time in queue
 */
function calculateCurrentRange(
  initialRange: number,
  maxRange: number,
  expansionRate: number,
  secondsInQueue: number,
): number {
  const expandedRange = initialRange + expansionRate * secondsInQueue;
  return Math.min(expandedRange, maxRange);
}

/**
 * Check if two players are within matching range
 */
function isWithinRange(
  player1Rating: number,
  player1Range: number,
  player2Rating: number,
  player2Range: number,
): boolean {
  const ratingDiff = Math.abs(player1Rating - player2Rating);
  // Both players must accept each other's rating
  return ratingDiff <= player1Range && ratingDiff <= player2Range;
}

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Join the matchmaking queue
 */
export async function joinQueue(
  playerId: string,
  playerName: string,
  playerAvatar: string | undefined,
  playerRating: number | undefined,
  input: JoinQueueInput,
): Promise<MatchmakingQueueEntry> {
  // Check if player is already in queue for this game type
  const existingEntry = await getPlayerQueueEntry(playerId, input.gameType);
  if (existingEntry) {
    throw new Error("Already in queue for this game type");
  }

  const now = Timestamp.now();
  const timeoutMs =
    (input.timeoutMinutes ?? DEFAULT_TIMEOUT_MINUTES) * 60 * 1000;
  const expiresAt = Timestamp.fromMillis(now.toMillis() + timeoutMs);

  const rating = playerRating ?? DEFAULT_RATING;
  const initialRange = input.initialRatingRange ?? DEFAULT_INITIAL_RANGE;
  const maxRange = input.maxRatingRange ?? DEFAULT_MAX_RANGE;

  const queueId = generateQueueId();

  const entry: MatchmakingQueueEntry = {
    id: queueId,

    playerId,
    playerName,
    playerAvatar,

    gameType: input.gameType,
    category: getGameCategory(input.gameType),
    isRated: input.isRated,

    rating,

    initialRatingRange: initialRange,
    currentRatingRange: initialRange,
    maxRatingRange: maxRange,
    rangeExpansionRate: DEFAULT_EXPANSION_RATE,

    status: "searching",

    createdAt: now,
    updatedAt: now,
    expiresAt,
  };

  // Save to Firestore
  const entryRef = doc(getDb(), COLLECTION_NAME, queueId);
  await setDoc(entryRef, entry);

  return entry;
}

/**
 * Leave the matchmaking queue
 */
export async function leaveQueue(
  playerId: string,
  gameType: MatchmakingGameType,
): Promise<void> {
  const entry = await getPlayerQueueEntry(playerId, gameType);

  if (!entry) {
    throw new Error("Not in queue for this game type");
  }

  if (entry.status !== "searching") {
    throw new Error(`Queue entry is ${entry.status}, cannot cancel`);
  }

  const entryRef = doc(getDb(), COLLECTION_NAME, entry.id);
  await updateDoc(entryRef, {
    status: "cancelled",
    updatedAt: serverTimestamp(),
  });
}

/**
 * Find a match for a player
 * Returns match if found, null if no match
 */
export async function findMatch(
  playerId: string,
  gameType: MatchmakingGameType,
): Promise<MatchResult | null> {
  const playerEntry = await getPlayerQueueEntry(playerId, gameType);

  if (!playerEntry || playerEntry.status !== "searching") {
    return null;
  }

  // Calculate current search range
  const now = Timestamp.now();
  const secondsInQueue =
    (now.toMillis() - playerEntry.createdAt.toMillis()) / 1000;
  const currentRange = calculateCurrentRange(
    playerEntry.initialRatingRange,
    playerEntry.maxRatingRange,
    playerEntry.rangeExpansionRate,
    secondsInQueue,
  );

  // Update current range
  const playerEntryRef = doc(getDb(), COLLECTION_NAME, playerEntry.id);
  await updateDoc(playerEntryRef, {
    currentRatingRange: currentRange,
    updatedAt: serverTimestamp(),
  });

  // Query for potential matches
  const q = query(
    collection(getDb(), COLLECTION_NAME),
    where("gameType", "==", gameType),
    where("isRated", "==", playerEntry.isRated),
    where("status", "==", "searching"),
    orderBy("createdAt", "asc"),
    limit(50), // Check up to 50 potential matches
  );

  const snapshot = await getDocs(q);

  // Find best match
  let bestMatch: MatchmakingQueueEntry | null = null;
  let bestMatchScore = Infinity;

  for (const doc of snapshot.docs) {
    const candidate = doc.data() as MatchmakingQueueEntry;

    // Skip self
    if (candidate.playerId === playerId) continue;

    // Calculate candidate's current range
    const candidateSeconds =
      (now.toMillis() - candidate.createdAt.toMillis()) / 1000;
    const candidateRange = calculateCurrentRange(
      candidate.initialRatingRange,
      candidate.maxRatingRange,
      candidate.rangeExpansionRate,
      candidateSeconds,
    );

    // Check if within range
    if (
      !isWithinRange(
        playerEntry.rating,
        currentRange,
        candidate.rating,
        candidateRange,
      )
    ) {
      continue;
    }

    // Score based on rating difference and wait time
    const ratingDiff = Math.abs(playerEntry.rating - candidate.rating);
    const score = ratingDiff; // Lower is better

    if (score < bestMatchScore) {
      bestMatchScore = score;
      bestMatch = candidate;
    }
  }

  if (!bestMatch) {
    return null;
  }

  // Create match using transaction to prevent race conditions
  try {
    const matchResult = await runTransaction(getDb(), async (transaction) => {
      // Re-read both entries to ensure they're still searching
      const playerRef = doc(getDb(), COLLECTION_NAME, playerEntry.id);
      const matchRef = doc(getDb(), COLLECTION_NAME, bestMatch!.id);

      const [playerSnap, matchSnap] = await Promise.all([
        transaction.get(playerRef),
        transaction.get(matchRef),
      ]);

      if (!playerSnap.exists() || !matchSnap.exists()) {
        throw new Error("Queue entry no longer exists");
      }

      const currentPlayer = playerSnap.data() as MatchmakingQueueEntry;
      const currentMatch = matchSnap.data() as MatchmakingQueueEntry;

      if (
        currentPlayer.status !== "searching" ||
        currentMatch.status !== "searching"
      ) {
        throw new Error("One or both players no longer searching");
      }

      // Generate game ID
      const gameId = `game_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
      const matchedAt = Timestamp.now();

      // Update both entries
      transaction.update(playerRef, {
        status: "matched",
        matchedWith: bestMatch!.playerId,
        gameId,
        matchedAt,
        updatedAt: matchedAt,
      });

      transaction.update(matchRef, {
        status: "matched",
        matchedWith: playerId,
        gameId,
        matchedAt,
        updatedAt: matchedAt,
      });

      return {
        player1Id: playerId,
        player2Id: bestMatch!.playerId,
        gameId,
        gameType,
        isRated: playerEntry.isRated,
      };
    });

    return matchResult;
  } catch (error) {
    console.error("[Matchmaking] Transaction failed:", error);
    return null;
  }
}

// =============================================================================
// Query Functions
// =============================================================================

/**
 * Get player's current queue entry
 */
export async function getPlayerQueueEntry(
  playerId: string,
  gameType: MatchmakingGameType,
): Promise<MatchmakingQueueEntry | null> {
  const q = query(
    collection(getDb(), COLLECTION_NAME),
    where("playerId", "==", playerId),
    where("gameType", "==", gameType),
    where("status", "==", "searching"),
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  return snapshot.docs[0].data() as MatchmakingQueueEntry;
}

/**
 * Get all active queue entries for a player
 */
export async function getPlayerActiveQueues(
  playerId: string,
): Promise<MatchmakingQueueEntry[]> {
  const q = query(
    collection(getDb(), COLLECTION_NAME),
    where("playerId", "==", playerId),
    where("status", "==", "searching"),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as MatchmakingQueueEntry);
}

/**
 * Get queue stats for a game type
 */
export async function getQueueStats(
  gameType: MatchmakingGameType,
): Promise<QueueStats> {
  const q = query(
    collection(getDb(), COLLECTION_NAME),
    where("gameType", "==", gameType),
    where("status", "==", "searching"),
  );

  const snapshot = await getDocs(q);
  const entries = snapshot.docs.map(
    (doc) => doc.data() as MatchmakingQueueEntry,
  );

  // Calculate average wait time (for recently matched players)
  // This would ideally come from a separate analytics collection
  const averageWaitTime = 30; // Placeholder

  // Calculate rating distribution
  const distribution: Record<string, number> = {};
  RATING_RANGES.forEach((range) => {
    distribution[range.label] = 0;
  });

  entries.forEach((entry) => {
    const range = RATING_RANGES.find(
      (r) => entry.rating >= r.min && entry.rating < r.max,
    );
    if (range) {
      distribution[range.label]++;
    }
  });

  return {
    gameType,
    playersInQueue: entries.length,
    averageWaitTime,
    ratingDistribution: RATING_RANGES.map((range) => ({
      range: range.label,
      count: distribution[range.label],
    })),
  };
}

// =============================================================================
// Real-time Subscriptions
// =============================================================================

/**
 * Subscribe to player's queue entry
 */
export function subscribeToQueueEntry(
  playerId: string,
  gameType: MatchmakingGameType,
  onUpdate: (entry: MatchmakingQueueEntry | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), COLLECTION_NAME),
    where("playerId", "==", playerId),
    where("gameType", "==", gameType),
    limit(1),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        onUpdate(null);
        return;
      }

      const entry = snapshot.docs[0].data() as MatchmakingQueueEntry;
      onUpdate(entry);
    },
    (error) => {
      console.error("[Matchmaking] Subscription error:", error);
      onError?.(error);
    },
  );
}

/**
 * Subscribe to queue stats
 */
export function subscribeToQueueStats(
  gameType: MatchmakingGameType,
  onUpdate: (stats: QueueStats) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), COLLECTION_NAME),
    where("gameType", "==", gameType),
    where("status", "==", "searching"),
  );

  return onSnapshot(
    q,
    async () => {
      // Recalculate stats on any change
      const stats = await getQueueStats(gameType);
      onUpdate(stats);
    },
    (error) => {
      console.error("[Matchmaking] Stats subscription error:", error);
      onError?.(error);
    },
  );
}

// =============================================================================
// Cleanup Functions
// =============================================================================

/**
 * Expire old queue entries
 */
export async function expireQueueEntries(): Promise<number> {
  const now = Timestamp.now();

  const q = query(
    collection(getDb(), COLLECTION_NAME),
    where("status", "==", "searching"),
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
 * Delete old queue entries
 */
export async function deleteOldQueueEntries(
  daysOld: number = 7,
): Promise<number> {
  const cutoff = Timestamp.fromMillis(
    Date.now() - daysOld * 24 * 60 * 60 * 1000,
  );

  const q = query(
    collection(getDb(), COLLECTION_NAME),
    where("status", "in", ["matched", "cancelled", "expired"]),
    where("createdAt", "<", cutoff),
  );

  const snapshot = await getDocs(q);

  const deletes = snapshot.docs.map((doc) => deleteDoc(doc.ref));
  await Promise.all(deletes);

  return snapshot.size;
}

// =============================================================================
// ELO Calculation Helpers
// =============================================================================

/**
 * Calculate expected score based on ratings
 */
export function calculateExpectedScore(
  playerRating: number,
  opponentRating: number,
): number {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

/**
 * Calculate new rating after a game
 */
export function calculateNewRating(
  currentRating: number,
  expectedScore: number,
  actualScore: number, // 1 = win, 0.5 = draw, 0 = loss
  kFactor: number = 32,
): number {
  return Math.round(currentRating + kFactor * (actualScore - expectedScore));
}

/**
 * Get K-factor based on rating and games played
 */
export function getKFactor(rating: number, gamesPlayed: number): number {
  // New players get higher K-factor for faster adjustment
  if (gamesPlayed < 30) return 40;

  // High-rated players get lower K-factor for stability
  if (rating >= 2400) return 16;

  // Default K-factor
  return 32;
}

// =============================================================================
// Export
// =============================================================================

export const matchmaking = {
  // Core
  join: joinQueue,
  leave: leaveQueue,
  findMatch,

  // Query
  getPlayerEntry: getPlayerQueueEntry,
  getPlayerActiveQueues,
  getStats: getQueueStats,

  // Subscriptions
  subscribeToEntry: subscribeToQueueEntry,
  subscribeToStats: subscribeToQueueStats,

  // Cleanup
  expireEntries: expireQueueEntries,
  deleteOld: deleteOldQueueEntries,

  // ELO helpers
  calculateExpectedScore,
  calculateNewRating,
  getKFactor,
};

export default matchmaking;
