/**
 * Games V4 — Client Service Layer
 *
 * Wraps Cloud Function callables and Firestore subscriptions
 * for the V4 game system.
 *
 * @module gamesV4/services/gameServiceV4
 */

import {
  COLLECTIONS,
  LEADERBOARD_DESCRIPTORS,
  PINNED_INVITE_IDS_FIELD,
} from "@/gamesV4/constants";
import type {
  GameId,
  GameInviteV4,
  GameResultV4,
  GameSessionV4,
  SpectateMode,
} from "@/gamesV4/types";
import {
  getFirestoreInstance,
  getFunctionsInstance,
} from "@/services/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  Unsubscribe,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

// =============================================================================
// Firestore Nested-Array Deserialization
// =============================================================================
// Firestore cannot store nested arrays, so the server serializes 2D game boards
// into maps: { _nestedArray: true, length: N, "0": [...], "1": [...] }.
// This function converts them back to native 2D arrays for client use.

function deserializeStateFromFirestore(
  state: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(state)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (value as Record<string, unknown>)._nestedArray === true
    ) {
      const map = value as Record<string, unknown>;
      const length = map.length as number;
      const arr: unknown[] = [];
      for (let i = 0; i < length; i++) {
        arr.push(map[String(i)]);
      }
      result[key] = arr;
    } else {
      result[key] = value;
    }
  }
  return result;
}

// =============================================================================
// Callable wrappers
// =============================================================================

/** Create a new game invite in a conversation. */
export async function createGameInvite(params: {
  conversationId: string;
  conversationScope: "dm" | "group";
  gameId: GameId;
  maxPlayers?: number;
  allowSpectators?: boolean;
  spectateMode?: SpectateMode;
}): Promise<{ inviteId: string }> {
  const fn = httpsCallable<typeof params, { inviteId: string }>(
    getFunctionsInstance(),
    "createGameInviteV4",
  );
  const result = await fn(params);
  return result.data;
}

/** Join an invite lobby as player or spectator. */
export async function joinInviteLobby(params: {
  inviteId: string;
  asSpectator?: boolean;
}): Promise<{ success: boolean; role: string }> {
  const fn = httpsCallable<typeof params, { success: boolean; role: string }>(
    getFunctionsInstance(),
    "joinInviteLobbyV4",
  );
  const result = await fn(params);
  return result.data;
}

/** Update lobby settings (host only). */
export async function updateLobbySettings(params: {
  inviteId: string;
  settingsPatch: Record<string, unknown>;
}): Promise<{ success: boolean }> {
  const fn = httpsCallable<typeof params, { success: boolean }>(
    getFunctionsInstance(),
    "updateLobbySettingsV4",
  );
  const result = await fn(params);
  return result.data;
}

/** Start a game from an invite (host only). */
export async function startGameFromInvite(params: {
  inviteId: string;
  settings?: Record<string, unknown>;
}): Promise<{ sessionId: string }> {
  const fn = httpsCallable<typeof params, { sessionId: string }>(
    getFunctionsInstance(),
    "startGameFromInviteV4",
  );
  const result = await fn(params);
  return result.data;
}

/** Submit a turn move during gameplay. */
export async function submitTurnMove(params: {
  sessionId: string;
  movePayload: Record<string, unknown>;
  isTerminal?: boolean;
  winnerIds?: string[];
}): Promise<{ moveId: string; committed: boolean; isTerminal: boolean }> {
  const fn = httpsCallable<
    typeof params,
    { moveId: string; committed: boolean; isTerminal: boolean }
  >(getFunctionsInstance(), "submitTurnMoveV4");
  const result = await fn(params);
  return result.data;
}

/** Resign from an active session. */
export async function resignSession(params: {
  sessionId: string;
}): Promise<{ success: boolean; alreadyResolved: boolean }> {
  const fn = httpsCallable<
    typeof params,
    { success: boolean; alreadyResolved: boolean }
  >(getFunctionsInstance(), "resignSessionV4");
  const result = await fn(params);
  return result.data;
}

/** Leave an invite lobby (non-host only). */
export async function leaveInviteLobby(params: {
  inviteId: string;
}): Promise<{ success: boolean }> {
  const fn = httpsCallable<typeof params, { success: boolean }>(
    getFunctionsInstance(),
    "leaveInviteLobbyV4",
  );
  const result = await fn(params);
  return result.data;
}

/** Cancel a game invite (host only). Resolves the invite and unpins it. */
export async function cancelGameInvite(params: {
  inviteId: string;
}): Promise<{ success: boolean }> {
  const fn = httpsCallable<typeof params, { success: boolean }>(
    getFunctionsInstance(),
    "cancelGameInviteV4",
  );
  const result = await fn(params);
  return result.data;
}

/** Create a solo game session directly (bypasses invite system). */
export async function createSoloSession(params: {
  gameId: GameId;
}): Promise<{ sessionId: string }> {
  const fn = httpsCallable<typeof params, { sessionId: string }>(
    getFunctionsInstance(),
    "createSoloSessionV4",
  );
  const result = await fn(params);
  return result.data;
}

/**
 * Resume an existing suspended solo session or create a new one.
 * This is the preferred entry point for launching solo games from the hub.
 *
 * This now requires the deployed resume-or-create callable.
 */
export async function resumeOrCreateSoloSession(params: {
  gameId: GameId;
}): Promise<{ sessionId: string; resumed: boolean }> {
  const fn = httpsCallable<
    typeof params,
    { sessionId: string; resumed: boolean }
  >(getFunctionsInstance(), "resumeOrCreateSoloSessionV4");
  const result = await fn(params);
  return result.data;
}

/**
 * Restart a solo game: resolves the current session and creates a fresh one.
 *
 * This now requires the deployed restart callable.
 */
export async function restartSoloSession(params: {
  sessionId: string;
}): Promise<{ sessionId: string }> {
  const fn = httpsCallable<typeof params, { sessionId: string }>(
    getFunctionsInstance(),
    "restartSoloSessionV4",
  );
  const result = await fn(params);
  return result.data;
}

/**
 * Suspend a solo session (player leaving via back arrow without resigning).
 *
 * This now requires the deployed suspend callable.
 */
export async function suspendSoloSession(params: {
  sessionId: string;
}): Promise<{ success: boolean }> {
  const fn = httpsCallable<typeof params, { success: boolean }>(
    getFunctionsInstance(),
    "suspendSoloSessionV4",
  );
  const result = await fn(params);
  return result.data;
}

/**
 * Archive/finalize a persistent solo session.
 *
 * This explicitly ends a long-lived run, computes the final summary,
 * creates a GameResultV4 doc, and processes rewards/PBs/achievements.
 *
 * Only valid for persistent solo sessions (soloMode === "persistent").
 */
export async function archiveSoloSession(params: {
  sessionId: string;
}): Promise<{ success: boolean; resultSessionId: string }> {
  const fn = httpsCallable<
    typeof params,
    { success: boolean; resultSessionId: string }
  >(getFunctionsInstance(), "archiveSoloSessionV4");
  const result = await fn(params);
  return result.data;
}

// =============================================================================
// Admin / Moderation callables
// =============================================================================

/** Force-clear a single broken game (owner/admin only). */
export async function adminClearGame(params: { inviteId: string }): Promise<{
  success: boolean;
  inviteCleared: boolean;
  sessionCleared: boolean;
  alreadyClean: boolean;
  traceId: string;
}> {
  const fn = httpsCallable<
    typeof params,
    {
      success: boolean;
      inviteCleared: boolean;
      sessionCleared: boolean;
      alreadyClean: boolean;
      traceId: string;
    }
  >(getFunctionsInstance(), "adminClearGameV4");
  const result = await fn(params);
  return result.data;
}

/** Force-clear ALL games in a conversation (owner/admin only). */
export async function adminClearConversationGames(params: {
  conversationId: string;
  conversationScope: "dm" | "group";
}): Promise<{
  success: boolean;
  totalInvitesCleared: number;
  totalSessionsCleared: number;
  traceId: string;
}> {
  const fn = httpsCallable<
    typeof params,
    {
      success: boolean;
      totalInvitesCleared: number;
      totalSessionsCleared: number;
      traceId: string;
    }
  >(getFunctionsInstance(), "adminClearConversationGamesV4");
  const result = await fn(params);
  return result.data;
}

// =============================================================================
// Firestore subscriptions
// =============================================================================

/**
 * Subscribe to a single invite document.
 */
export function subscribeToInvite(
  inviteId: string,
  onData: (invite: GameInviteV4 | null) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const db = getFirestoreInstance();
  const ref = doc(db, COLLECTIONS.GAME_INVITES, inviteId);
  return onSnapshot(
    ref,
    (snap) => {
      onData(snap.exists() ? (snap.data() as GameInviteV4) : null);
    },
    onError,
  );
}

/**
 * Subscribe to pinned invite IDs for a conversation.
 * Returns the raw array of invite IDs from the DM/Group doc.
 */
export function subscribeToPinnedInviteIds(
  conversationId: string,
  scope: "dm" | "group",
  onData: (inviteIds: string[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const db = getFirestoreInstance();
  const collectionName = scope === "dm" ? "Chats" : "Groups";
  const ref = doc(db, collectionName, conversationId);
  return onSnapshot(
    ref,
    (snap) => {
      const data = snap.data();
      const pinnedIds: string[] = data?.[PINNED_INVITE_IDS_FIELD] ?? [];
      onData(pinnedIds);
    },
    onError,
  );
}

/**
 * Subscribe to all active invites for a conversation (non-resolved).
 */
export function subscribeToConversationInvites(
  conversationId: string,
  onData: (invites: GameInviteV4[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const db = getFirestoreInstance();
  const q = query(
    collection(db, COLLECTIONS.GAME_INVITES),
    where("conversationId", "==", conversationId),
    where("status", "in", ["sent", "lobby", "active"]),
    orderBy("createdAt", "desc"),
    limit(10),
  );
  return onSnapshot(
    q,
    (snap) => {
      const invites = snap.docs.map((d) => d.data() as GameInviteV4);
      onData(invites);
    },
    onError,
  );
}

/**
 * Check whether a pending (non-resolved) invite already exists for the given
 * game + conversation.  Returns the first matching invite, or null.
 *
 * Used client-side to prevent duplicate invite spam before calling
 * `createGameInvite`.
 */
export async function findPendingInvite(
  conversationId: string,
  gameId: GameId,
): Promise<GameInviteV4 | null> {
  const db = getFirestoreInstance();
  const q = query(
    collection(db, COLLECTIONS.GAME_INVITES),
    where("conversationId", "==", conversationId),
    where("gameId", "==", gameId),
    where("status", "in", ["sent", "lobby"]),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data() as GameInviteV4;
}

/**
 * Subscribe to a game session document.
 */
export function subscribeToSession(
  sessionId: string,
  onData: (session: GameSessionV4 | null) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const db = getFirestoreInstance();
  const ref = doc(db, COLLECTIONS.GAME_SESSIONS, sessionId);
  return onSnapshot(
    ref,
    (snap) => {
      onData(snap.exists() ? (snap.data() as GameSessionV4) : null);
    },
    onError,
  );
}

/**
 * Subscribe to a game session's public state.
 */
export function subscribeToPublicState(
  sessionId: string,
  onData: (state: Record<string, unknown> | null) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const db = getFirestoreInstance();
  const ref = doc(
    db,
    COLLECTIONS.GAME_SESSIONS,
    sessionId,
    COLLECTIONS.PUBLIC_STATE,
    "state",
  );
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      // Deserialize Firestore map-encoded nested arrays (e.g. game boards)
      const raw = snap.data() as Record<string, unknown>;
      onData(deserializeStateFromFirestore(raw));
    },
    onError,
  );
}

/**
 * Subscribe to a player's private state (e.g., their hand in Crazy 8's).
 * Firestore rules restrict reads to the owning uid.
 */
export function subscribeToPrivateState(
  sessionId: string,
  uid: string,
  onData: (state: Record<string, unknown> | null) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const db = getFirestoreInstance();
  const ref = doc(
    db,
    COLLECTIONS.GAME_SESSIONS,
    sessionId,
    COLLECTIONS.PRIVATE_STATE,
    uid,
  );
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const raw = snap.data() as Record<string, unknown>;
      onData(deserializeStateFromFirestore(raw));
    },
    onError,
  );
}

/**
 * Subscribe to a game result document.
 */
export function subscribeToResult(
  sessionId: string,
  onData: (result: GameResultV4 | null) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const db = getFirestoreInstance();
  const ref = doc(db, COLLECTIONS.GAME_RESULTS, sessionId);
  return onSnapshot(
    ref,
    (snap) => {
      onData(snap.exists() ? (snap.data() as GameResultV4) : null);
    },
    onError,
  );
}

/**
 * Fetch all active invites the user is part of (for resume).
 */
export function subscribeToMyActiveInvites(
  uid: string,
  onData: (invites: GameInviteV4[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const db = getFirestoreInstance();
  const q = query(
    collection(db, COLLECTIONS.GAME_INVITES),
    where("participantIds", "array-contains", uid),
    where("status", "in", ["sent", "lobby", "active"]),
    orderBy("updatedAt", "desc"),
    limit(20),
  );
  return onSnapshot(
    q,
    (snap) => {
      const invites = snap.docs.map((d) => d.data() as GameInviteV4);
      onData(invites);
    },
    onError,
  );
}

// =============================================================================
// Active Solo Session Queries (for Hub resume affordances)
// =============================================================================

/**
 * Subscribe to the current user's active solo sessions.
 * Returns a map of `gameId → sessionId` for games with a resumable session.
 * Used by the Games Hub to show "Resume" vs "Play Now" labels.
 */
export function subscribeToActiveSoloSessions(
  uid: string,
  onData: (activeSessions: Record<string, string>) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const db = getFirestoreInstance();
  const q = query(
    collection(db, COLLECTIONS.GAME_SESSIONS),
    where("participantUids", "array-contains", uid),
    where("runtimeType", "==", "solo"),
    where("status", "==", "active"),
    limit(20),
  );
  return onSnapshot(
    q,
    (snap) => {
      const map: Record<string, string> = {};
      const freshnessByGameId: Record<string, number> = {};
      for (const d of snap.docs) {
        const data = d.data() as GameSessionV4;
        const freshness = getSessionFreshness(data);
        if (
          freshnessByGameId[data.gameId] === undefined ||
          freshness > freshnessByGameId[data.gameId]
        ) {
          freshnessByGameId[data.gameId] = freshness;
          map[data.gameId] = data.sessionId;
        }
      }
      onData(map);
    },
    onError,
  );
}

function getSessionFreshness(session: GameSessionV4): number {
  const candidates = [
    session.soloSuspendedAt,
    session.lastServerSaveAt,
    session.lastSimulatedAt,
    session.runStartedAt,
    session.startedAt,
    session.createdAt,
  ];
  for (const value of candidates) {
    const millis = coerceTimestampLike(value);
    if (millis !== null) return millis;
  }
  return 0;
}

function coerceTimestampLike(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in (value as Record<string, unknown>) &&
    typeof (value as { toMillis: unknown }).toMillis === "function"
  ) {
    const millis = (value as { toMillis: () => number }).toMillis();
    return Number.isFinite(millis) ? millis : null;
  }
  if (
    value &&
    typeof value === "object" &&
    "seconds" in (value as Record<string, unknown>)
  ) {
    const seconds = (value as { seconds?: unknown }).seconds;
    if (typeof seconds === "number" && Number.isFinite(seconds)) {
      return seconds * 1000;
    }
  }
  return null;
}

// =============================================================================
// Integration queries — Leaderboard / PB / Achievements / History
// =============================================================================

/** Leaderboard entry shape (client read). */
export interface LeaderboardEntryV4 {
  uid: string;
  displayName: string;
  score: number;
  updatedAt: unknown;
}

/** Personal best shape (client read). */
export interface GamePBV4 {
  gameId: GameId;
  pbValue: number;
  pbMeta: Record<string, unknown>;
  achievedAt: unknown;
  sessionId: string | null;
  totalPlays: number;
  totalWins: number;
}

/** Achievement shape (client read). */
export interface AchievementEntryV4 {
  type: string;
  name: string;
  description: string;
  sectionId: string;
  difficulty: string;
  tokenReward: number;
  earnedAt: unknown;
  gameId: GameId;
  sessionId: string;
  badgeId?: string;
  /** Reward grant state — old docs can be null before background backfill runs. */
  claimedAt?: unknown | null;
  /** Achievement status — new unlocks are claimed automatically; old docs may be earned_unclaimed. */
  status?: "earned_unclaimed" | "claimed";
  rewardGrantedAt?: unknown | null;
  rewardTransactionId?: string | null;
  /** Schema version — 3 for auto-award model. Legacy docs may lack this field. */
  schemaVersion?: number;
}

/**
 * Fetch leaderboard entries for a game + week.
 * Returns entries sorted by score descending.
 */
export async function fetchLeaderboard(
  gameId: GameId,
  weekKey: string,
  max = 50,
): Promise<LeaderboardEntryV4[]> {
  const db = getFirestoreInstance();
  const entriesRef = collection(
    db,
    COLLECTIONS.LEADERBOARDS,
    gameId,
    "Weeks",
    weekKey,
    "Entries",
  );
  const q = query(entriesRef, orderBy("score", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as LeaderboardEntryV4);
}

/**
 * Subscribe to leaderboard entries (live).
 */
export function subscribeToLeaderboard(
  gameId: GameId,
  weekKey: string,
  onData: (entries: LeaderboardEntryV4[]) => void,
  onError?: (err: Error) => void,
  max = 50,
): Unsubscribe {
  const db = getFirestoreInstance();
  const entriesRef = collection(
    db,
    COLLECTIONS.LEADERBOARDS,
    gameId,
    "Weeks",
    weekKey,
    "Entries",
  );
  const q = query(entriesRef, orderBy("score", "desc"), limit(max));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as LeaderboardEntryV4));
    },
    onError,
  );
}

/**
 * Fetch personal best for a specific game for a user.
 */
export async function fetchGamePB(
  uid: string,
  gameId: GameId,
): Promise<GamePBV4 | null> {
  const db = getFirestoreInstance();
  const ref = doc(db, "Users", uid, COLLECTIONS.GAME_PB, gameId);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as GamePBV4) : null;
}

/**
 * Subscribe to personal best for a specific game.
 */
export function subscribeToGamePB(
  uid: string,
  gameId: GameId,
  onData: (pb: GamePBV4 | null) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const db = getFirestoreInstance();
  const ref = doc(db, "Users", uid, COLLECTIONS.GAME_PB, gameId);
  return onSnapshot(
    ref,
    (snap) => {
      onData(snap.exists() ? (snap.data() as GamePBV4) : null);
    },
    onError,
  );
}

/**
 * Fetch all personal bests for a user across all games.
 */
export async function fetchAllGamePBs(uid: string): Promise<GamePBV4[]> {
  const db = getFirestoreInstance();
  const ref = collection(db, "Users", uid, COLLECTIONS.GAME_PB);
  const snap = await getDocs(ref);
  return snap.docs.map((d) => d.data() as GamePBV4);
}

/**
 * Fetch all achievements earned by a user.
 */
export async function fetchAchievements(
  uid: string,
): Promise<AchievementEntryV4[]> {
  const db = getFirestoreInstance();
  const ref = collection(db, "Users", uid, "Achievements");
  const q = query(ref, orderBy("earnedAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as AchievementEntryV4);
}

/**
 * Subscribe to achievements (live updates when new ones are earned).
 */
export function subscribeToAchievements(
  uid: string,
  onData: (achievements: AchievementEntryV4[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const db = getFirestoreInstance();
  const ref = collection(db, "Users", uid, "Achievements");
  const q = query(ref, orderBy("earnedAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as AchievementEntryV4));
    },
    onError,
  );
}

/**
 * Fetch recent game results for a user (game history).
 */
export async function fetchGameHistory(
  uid: string,
  max = 20,
): Promise<GameResultV4[]> {
  const db = getFirestoreInstance();
  const q = query(
    collection(db, COLLECTIONS.GAME_RESULTS),
    where("participantIds", "array-contains", uid),
    orderBy("createdAt", "desc"),
    limit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as GameResultV4);
}

/**
 * Fetch user's global stats cache.
 */
export async function fetchUserStatsCache(uid: string): Promise<{
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
} | null> {
  const db = getFirestoreInstance();
  const ref = doc(db, "Users", uid, "UserStatsCache", "stats");
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  const played = data.gamesPlayed ?? 0;
  const won = data.gamesWon ?? 0;
  return {
    gamesPlayed: played,
    gamesWon: won,
    winRate: played > 0 ? Math.round((won / played) * 100) : 0,
  };
}

// =============================================================================
// Achievement Reward Backfill
// =============================================================================

/** Backfill old earned_unclaimed achievements into the auto-award model. */
export async function backfillUnclaimedAchievementRewards(): Promise<{
  success: boolean;
  scanned: number;
  awardedCount: number;
  repairedCount: number;
  totalTokensAwarded: number;
}> {
  const fn = httpsCallable<
    undefined,
    {
      success: boolean;
      scanned: number;
      awardedCount: number;
      repairedCount: number;
      totalTokensAwarded: number;
    }
  >(getFunctionsInstance(), "backfillUnclaimedAchievementRewardsV4");
  const result = await fn(undefined);
  return result.data;
}

// =============================================================================
// Per-Game History
// =============================================================================

/**
 * Fetch game history filtered by a specific gameId.
 * Returns results for a single game, ordered by createdAt desc.
 */
export async function fetchGameHistoryByGame(
  uid: string,
  gameId: GameId,
  max = 20,
): Promise<GameResultV4[]> {
  const db = getFirestoreInstance();
  const q = query(
    collection(db, COLLECTIONS.GAME_RESULTS),
    where("participantIds", "array-contains", uid),
    where("gameId", "==", gameId),
    orderBy("createdAt", "desc"),
    limit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as GameResultV4);
}

// =============================================================================
// Friends Leaderboard
// =============================================================================

/**
 * Supported Minesweeper difficulty variants. Used by
 * `fetchFriendsLeaderboard` to select the per-difficulty best-time board
 * instead of the encoded aggregate PB.
 */
export type MinesweeperLeaderboardVariant = "easy" | "intermediate" | "expert";

export interface FriendsLeaderboardOptions {
  /**
   * Minesweeper-only: which difficulty board to read. Required when
   * `gameId === "minesweeper"`. Ignored for other games.
   */
  minesweeperDifficulty?: MinesweeperLeaderboardVariant;
}

/**
 * Fetch a friends-only leaderboard for a game.
 *
 * Reads the user's PB doc plus each friend's PB doc and returns only
 * users with a *qualifying* entry for this board:
 *
 *   - wins-based games:       `totalWins > 0`
 *   - best-score games:        `pbValue > 0`
 *   - minesweeper per board:   `bestsByDifficulty[difficulty].elapsedMs > 0`
 *
 * Users with no entry are never returned, so they also never receive
 * beat-your-score notifications for this board (the backend uses the
 * same filter).
 *
 * The returned `score` is the raw metric value (wins count, encoded PB,
 * or elapsed ms for Minesweeper). Callers format it via the appropriate
 * descriptor or a Minesweeper-specific time formatter.
 */
export async function fetchFriendsLeaderboard(
  uid: string,
  friendUids: string[],
  gameId: GameId,
  options: FriendsLeaderboardOptions = {},
): Promise<LeaderboardEntryV4[]> {
  const db = getFirestoreInstance();
  const allUids = [uid, ...friendUids.slice(0, 19)]; // cap at 20 for perf
  const entries: LeaderboardEntryV4[] = [];

  const descriptor = LEADERBOARD_DESCRIPTORS[gameId];
  const metric = descriptor?.metric ?? "bestScore";
  const isMinesweeper = gameId === "minesweeper";
  const difficulty = options.minesweeperDifficulty ?? "easy";

  await Promise.all(
    allUids.map(async (fuid) => {
      const ref = doc(db, "Users", fuid, COLLECTIONS.GAME_PB, gameId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const data = snap.data() as GamePBV4 & {
        bestsByDifficulty?: Record<
          string,
          { elapsedMs?: number; achievedAt?: unknown } | undefined
        >;
      };

      let score: number | null = null;
      let updatedAt: unknown = data.achievedAt ?? null;

      if (isMinesweeper) {
        const entry = data.bestsByDifficulty?.[difficulty];
        const ms = entry?.elapsedMs;
        if (typeof ms === "number" && ms > 0) {
          score = ms;
          if (entry?.achievedAt) updatedAt = entry.achievedAt;
        }
      } else if (metric === "wins") {
        const wins = data.totalWins ?? 0;
        if (wins > 0) score = wins;
      } else {
        const pb = data.pbValue ?? 0;
        if (typeof pb === "number" && pb > 0) score = pb;
      }

      // Filter out users with no qualifying entry.
      if (score === null) return;

      entries.push({
        uid: fuid,
        displayName: "", // caller resolves display names
        score,
        updatedAt: (updatedAt as LeaderboardEntryV4["updatedAt"]) ?? null,
      });
    }),
  );

  // Minesweeper uses time (lower is better); all other metrics higher is better.
  if (isMinesweeper) {
    entries.sort((a, b) => a.score - b.score);
  } else {
    entries.sort((a, b) => b.score - a.score);
  }
  return entries;
}

// =============================================================================
// Level Rewards V4
// =============================================================================

export interface LevelRewardDocV4 {
  level: number;
  unlockedAt: unknown; // Firestore Timestamp
  claimedAt: unknown | null;
  tokenReward: number;
  cosmeticItemId: string | null;
  schemaVersion: number;
}

/**
 * Subscribe to user's level rewards (live updates).
 */
export function subscribeToLevelRewards(
  uid: string,
  onData: (rewards: LevelRewardDocV4[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const db = getFirestoreInstance();
  const ref = collection(db, "Users", uid, "LevelRewardsV4");
  const q = query(ref, orderBy("level", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as LevelRewardDocV4));
    },
    onError,
  );
}

/**
 * Fetch all level rewards for a user.
 */
export async function fetchLevelRewards(
  uid: string,
): Promise<LevelRewardDocV4[]> {
  const db = getFirestoreInstance();
  const ref = collection(db, "Users", uid, "LevelRewardsV4");
  const q = query(ref, orderBy("level", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as LevelRewardDocV4);
}

/**
 * Claim a level reward (calls server-side callable).
 */
export async function claimLevelReward(params: { level: number }): Promise<{
  success: boolean;
  alreadyClaimed?: boolean;
  tokensGranted?: number;
  cosmeticGranted?: string | null;
  error?: string;
}> {
  const fn = httpsCallable<
    typeof params,
    {
      success: boolean;
      alreadyClaimed?: boolean;
      tokensGranted?: number;
      cosmeticGranted?: string | null;
      error?: string;
    }
  >(getFunctionsInstance(), "claimLevelRewardV4");
  const result = await fn(params);
  return result.data;
}
