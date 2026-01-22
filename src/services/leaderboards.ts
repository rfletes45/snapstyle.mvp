/**
 * Leaderboards Service
 * Phase 17: Weekly per-game leaderboards + friends-only view
 *
 * Handles:
 * - Fetching weekly global leaderboard (top 100)
 * - Fetching friends-only leaderboard
 * - Leaderboard entry updates (via Cloud Function preferred)
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  where,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { getFirestoreInstance } from "./firebase";
import {
  GameType,
  LeaderboardEntry,
  WeekKey,
  getCurrentWeekKey,
  AvatarConfig,
  Friend,
} from "@/types/models";
import { getFriends } from "./friends";
import { getUserProfileByUid } from "./friends";

// =============================================================================
// Constants
// =============================================================================

const MAX_LEADERBOARD_ENTRIES = 100;
const MAX_FRIENDS_LEADERBOARD = 50;

// =============================================================================
// Types
// =============================================================================

export interface LeaderboardResult {
  entries: LeaderboardEntry[];
  weekKey: WeekKey;
  gameId: GameType;
  userRank?: number;
  userEntry?: LeaderboardEntry;
}

// =============================================================================
// Leaderboard Collection Path
// =============================================================================

/**
 * Get the collection path for a leaderboard
 * Format: Leaderboards/{gameId}_{weekKey}/Entries
 */
function getLeaderboardPath(gameId: GameType, weekKey: WeekKey): string {
  return `Leaderboards/${gameId}_${weekKey}`;
}

// =============================================================================
// Fetch Leaderboards
// =============================================================================

/**
 * Get weekly global leaderboard for a game
 * Returns top 100 entries sorted by score
 */
export async function getWeeklyLeaderboard(
  gameId: GameType,
  weekKey?: WeekKey,
): Promise<LeaderboardResult> {
  const db = getFirestoreInstance();
  const week = weekKey || getCurrentWeekKey();
  const leaderboardPath = getLeaderboardPath(gameId, week);

  try {
    const entriesRef = collection(db, leaderboardPath, "Entries");

    // For reaction_tap, lower is better (ascending)
    // For timed_tap, higher is better (descending)
    const sortDirection = gameId === "reaction_tap" ? "asc" : "desc";

    const q = query(
      entriesRef,
      orderBy("score", sortDirection as "asc" | "desc"),
      limit(MAX_LEADERBOARD_ENTRIES),
    );

    const snapshot = await getDocs(q);
    const entries: LeaderboardEntry[] = snapshot.docs.map((doc, index) => ({
      ...(doc.data() as Omit<LeaderboardEntry, "rank">),
      rank: index + 1,
      updatedAt:
        doc.data().updatedAt?.toMillis?.() ||
        doc.data().updatedAt ||
        Date.now(),
    }));

    console.log(
      `[leaderboards] Fetched ${entries.length} entries for ${gameId} week ${week}`,
    );

    return {
      entries,
      weekKey: week,
      gameId,
    };
  } catch (error) {
    console.error("[leaderboards] Error fetching weekly leaderboard:", error);
    return {
      entries: [],
      weekKey: week,
      gameId,
    };
  }
}

/**
 * Get friends-only leaderboard for a game
 * Filters the global leaderboard to only show friends
 */
export async function getFriendsLeaderboard(
  userId: string,
  gameId: GameType,
  weekKey?: WeekKey,
): Promise<LeaderboardResult> {
  const db = getFirestoreInstance();
  const week = weekKey || getCurrentWeekKey();
  const leaderboardPath = getLeaderboardPath(gameId, week);

  try {
    // Get user's friends list
    const friends: Friend[] = await getFriends(userId);
    const friendUids = friends
      .map((f: Friend) => {
        // Find the friend's UID (not the current user)
        return f.users.find((u: string) => u !== userId) || "";
      })
      .filter(Boolean);

    // Include the user themselves
    const relevantUids = [userId, ...friendUids];

    if (relevantUids.length === 0) {
      return {
        entries: [],
        weekKey: week,
        gameId,
      };
    }

    // Firestore 'in' query limited to 30 items, so we batch if needed
    const entries: LeaderboardEntry[] = [];
    const batchSize = 30;

    for (let i = 0; i < relevantUids.length; i += batchSize) {
      const batch = relevantUids.slice(i, i + batchSize);
      const entriesRef = collection(db, leaderboardPath, "Entries");
      const q = query(entriesRef, where("uid", "in", batch));
      const snapshot = await getDocs(q);

      snapshot.docs.forEach((doc) => {
        entries.push({
          ...(doc.data() as Omit<LeaderboardEntry, "rank">),
          updatedAt:
            doc.data().updatedAt?.toMillis?.() ||
            doc.data().updatedAt ||
            Date.now(),
        });
      });
    }

    // Sort entries by score
    const sortDirection = gameId === "reaction_tap" ? 1 : -1; // 1 for asc, -1 for desc
    entries.sort((a, b) => (a.score - b.score) * sortDirection);

    // Add ranks
    const rankedEntries = entries
      .slice(0, MAX_FRIENDS_LEADERBOARD)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));

    // Find user's entry and rank
    const userEntry = rankedEntries.find((e) => e.uid === userId);

    console.log(
      `[leaderboards] Fetched ${rankedEntries.length} friends entries for ${gameId}`,
    );

    return {
      entries: rankedEntries,
      weekKey: week,
      gameId,
      userRank: userEntry?.rank,
      userEntry,
    };
  } catch (error) {
    console.error("[leaderboards] Error fetching friends leaderboard:", error);
    return {
      entries: [],
      weekKey: week,
      gameId,
    };
  }
}

/**
 * Get user's rank in the global leaderboard
 */
export async function getUserRank(
  userId: string,
  gameId: GameType,
  weekKey?: WeekKey,
): Promise<{ rank: number; entry: LeaderboardEntry } | null> {
  const db = getFirestoreInstance();
  const week = weekKey || getCurrentWeekKey();
  const leaderboardPath = getLeaderboardPath(gameId, week);

  try {
    // First get user's entry
    const userEntryRef = doc(db, leaderboardPath, "Entries", userId);
    const userEntrySnap = await getDoc(userEntryRef);

    if (!userEntrySnap.exists()) {
      return null;
    }

    const userEntry = userEntrySnap.data() as LeaderboardEntry;
    const userScore = userEntry.score;

    // Count how many entries have a better score
    const entriesRef = collection(db, leaderboardPath, "Entries");
    let betterScoresQuery;

    if (gameId === "reaction_tap") {
      // Lower is better - count entries with lower scores
      betterScoresQuery = query(entriesRef, where("score", "<", userScore));
    } else {
      // Higher is better - count entries with higher scores
      betterScoresQuery = query(entriesRef, where("score", ">", userScore));
    }

    const betterScoresSnap = await getDocs(betterScoresQuery);
    const rank = betterScoresSnap.size + 1;

    return {
      rank,
      entry: {
        ...userEntry,
        rank,
        updatedAt:
          (userEntry as any).updatedAt?.toMillis?.() ||
          userEntry.updatedAt ||
          Date.now(),
      },
    };
  } catch (error) {
    console.error("[leaderboards] Error getting user rank:", error);
    return null;
  }
}

// =============================================================================
// Update Leaderboard Entry (Client-side fallback)
// Prefer using Cloud Function submitGameScore for anti-cheat
// =============================================================================

/**
 * Update or create a leaderboard entry
 * Note: In production, this should be done via Cloud Function
 */
export async function updateLeaderboardEntry(
  userId: string,
  gameId: GameType,
  score: number,
  displayName: string,
  avatarConfig: AvatarConfig,
): Promise<boolean> {
  const db = getFirestoreInstance();
  const weekKey = getCurrentWeekKey();
  const leaderboardPath = getLeaderboardPath(gameId, weekKey);

  try {
    const entryRef = doc(db, leaderboardPath, "Entries", userId);
    const existingEntry = await getDoc(entryRef);

    // Check if we should update (better score)
    if (existingEntry.exists()) {
      const existingScore = existingEntry.data().score;
      const isBetter =
        gameId === "reaction_tap"
          ? score < existingScore // Lower is better
          : score > existingScore; // Higher is better

      if (!isBetter) {
        console.log("[leaderboards] Score not better than existing, skipping");
        return false;
      }
    }

    const entry: Omit<LeaderboardEntry, "rank"> = {
      uid: userId,
      displayName,
      avatarConfig,
      score,
      updatedAt: Date.now(),
    };

    await setDoc(entryRef, {
      ...entry,
      updatedAt: Timestamp.now(),
    });

    console.log(
      `[leaderboards] Updated entry for ${userId} in ${gameId}: ${score}`,
    );
    return true;
  } catch (error) {
    console.error("[leaderboards] Error updating leaderboard entry:", error);
    return false;
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get display text for rank
 */
export function getRankDisplay(rank: number): string {
  if (rank === 1) return "🥇 1st";
  if (rank === 2) return "🥈 2nd";
  if (rank === 3) return "🥉 3rd";
  return `#${rank}`;
}

/**
 * Get ordinal suffix for a number
 */
export function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Format week key for display
 * e.g., "2026-W03" -> "Week 3, 2026"
 */
export function formatWeekKey(weekKey: WeekKey): string {
  const match = weekKey.match(/(\d{4})-W(\d{2})/);
  if (!match) return weekKey;
  const [, year, week] = match;
  return `Week ${parseInt(week)}, ${year}`;
}

/**
 * Get previous week key
 */
export function getPreviousWeekKey(weekKey: WeekKey): WeekKey {
  const match = weekKey.match(/(\d{4})-W(\d{2})/);
  if (!match) return weekKey;
  let [, year, week] = match;
  let weekNum = parseInt(week);
  let yearNum = parseInt(year);

  weekNum--;
  if (weekNum < 1) {
    yearNum--;
    weekNum = 52; // Approximate, could be 53 in some years
  }

  return `${yearNum}-W${String(weekNum).padStart(2, "0")}`;
}
