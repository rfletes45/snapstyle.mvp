/**
 * Game Recovery Service
 *
 * Persists the user's active multiplayer game session to AsyncStorage so that
 * after a crash, kill, or background-eviction the app can detect an in-progress
 * game and offer a "Resume game" banner.
 *
 * Data flow:
 *   1. When a game screen mounts and the Colyseus room connects, call
 *      `saveActiveSession(...)`.
 *   2. When the game ends (completion, forfeit, leave), call
 *      `clearActiveSession()`.
 *   3. On app start / foreground, call `recoverActiveSession()`.
 *      - Fetches the invite doc from Firestore.
 *      - If the invite is still `active`, returns the session so the UI can
 *        show a "Resume game" banner and navigate back.
 *      - If the invite is terminal, clears the stale entry and returns null.
 *
 * The stored payload is intentionally small (<500 bytes) to keep
 * AsyncStorage reads fast.
 *
 * @module services/gameRecovery
 */

import { getFirestoreInstance } from "@/services/firebase";
import { completeGameInvite } from "@/services/gameInvites";
import type { UniversalGameInvite } from "@/types/turnBased";
import { createLogger } from "@/utils/log";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc } from "firebase/firestore";

const logger = createLogger("services/gameRecovery");

// Lazy getter to avoid calling getFirestoreInstance at module load time
const getDb = () => getFirestoreInstance();

// =============================================================================
// Constants
// =============================================================================

/** AsyncStorage key for the current active session bookmark */
const ACTIVE_SESSION_KEY = "@snapstyle/active_game_session";

/**
 * Maximum age (ms) of a stored session before it is considered stale.
 * After this threshold the session is auto-cleared even if the invite
 * doc is unreachable.  Matches the server-side vacancy timeout (2 h)
 * with a generous buffer.
 */
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours

/** Terminal invite statuses — session should be cleared */
const TERMINAL_STATUSES = new Set([
  "completed",
  "declined",
  "expired",
  "cancelled",
]);

// =============================================================================
// Types
// =============================================================================

/**
 * Minimal bookmark stored in AsyncStorage when a user enters a multiplayer
 * game screen.  Intended to be <500 bytes so reads are near-instant.
 */
export interface ActiveSessionBookmark {
  /** The invite ID (primary key for recovery) */
  inviteId: string;
  /** Game type key (e.g. "chess", "battleship") */
  gameType: string;
  /** Colyseus room name / firestoreGameId for reconnection */
  firestoreGameId?: string;
  /** Colyseus reconnection token (if available) */
  reconnectionToken?: string;
  /** Conversation ID for navigating back to the correct chat */
  conversationId?: string;
  /** Whether this is a turn-based game (affects reconnect strategy) */
  isTurnBased: boolean;
  /** Timestamp when the session was saved */
  savedAt: number;
  /** Current user's UID */
  userId: string;
  /**
   * V3 GameSessions document ID.  When present, recovery validates the
   * session phase in `GameSessions/{v3SessionId}` and navigates to
   * `SessionLobbyScreen` instead of the game screen directly.
   */
  v3SessionId?: string;
}

/**
 * Result returned by `recoverActiveSession()` when a resumable session exists.
 */
export interface RecoverableSession {
  /** The stored bookmark */
  bookmark: ActiveSessionBookmark;
  /** The live invite doc (confirmed still active) */
  invite: UniversalGameInvite;
  /** The screen name to navigate to (from GAME_SCREEN_MAP) */
  screenName: string;
}

// =============================================================================
// Persistence
// =============================================================================

/**
 * Save an active game session bookmark to AsyncStorage.
 *
 * Call this when the Colyseus room is successfully joined and the game is
 * in progress.  Pass the reconnection token if available.
 */
export async function saveActiveSession(
  bookmark: Omit<ActiveSessionBookmark, "savedAt">,
): Promise<void> {
  try {
    const payload: ActiveSessionBookmark = {
      ...bookmark,
      savedAt: Date.now(),
    };
    await AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(payload));
    logger.info(
      `[gameRecovery] Saved active session: inviteId=${bookmark.inviteId}, ` +
        `gameType=${bookmark.gameType}`,
    );
  } catch (err) {
    logger.warn("[gameRecovery] Failed to save active session:", err);
  }
}

/**
 * Clear the active session bookmark.
 *
 * Call this when the game ends normally (completion, forfeit, leave, navigate
 * away) so that the next app open doesn't show a stale "Resume" banner.
 */
export async function clearActiveSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ACTIVE_SESSION_KEY);
    logger.info("[gameRecovery] Cleared active session");
  } catch (err) {
    logger.warn("[gameRecovery] Failed to clear active session:", err);
  }
}

/**
 * Update the stored bookmark with a fresh Colyseus reconnection token.
 *
 * Called by `colyseus.ts.setupRoomHandlers` every time a room issues a
 * token, so the crash-recovery path always has the latest token.
 */
export async function updateReconnectionToken(token: string): Promise<void> {
  try {
    const bookmark = await getActiveSessionBookmark();
    if (!bookmark) return; // nothing to update
    bookmark.reconnectionToken = token;
    bookmark.savedAt = Date.now(); // refresh timestamp
    await AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(bookmark));
    logger.info("[gameRecovery] Updated reconnection token");
  } catch (err) {
    logger.warn("[gameRecovery] Failed to update reconnection token:", err);
  }
}

/**
 * Read the raw bookmark (if any).  Does NOT validate against Firestore.
 * Useful for quick sync checks without a network round-trip.
 */
export async function getActiveSessionBookmark(): Promise<ActiveSessionBookmark | null> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveSessionBookmark;
    // Runtime shape validation — guard against corrupted/outdated bookmarks
    if (!parsed.inviteId || !parsed.gameType || !parsed.savedAt) {
      logger.warn("[gameRecovery] Bookmark missing required fields — clearing");
      await AsyncStorage.removeItem(ACTIVE_SESSION_KEY);
      return null;
    }
    return parsed;
  } catch (err) {
    logger.warn("[gameRecovery] Failed to read bookmark:", err);
    return null;
  }
}

/**
 * Patch the existing bookmark with a V3 session ID.
 *
 * Called by MultiplayerRuntimeShell once the session connects, so the
 * recovery flow can validate against GameSessions and navigate directly
 * to SessionLobbyScreen.
 */
export async function patchBookmarkV3SessionId(
  v3SessionId: string,
): Promise<void> {
  try {
    const bookmark = await getActiveSessionBookmark();
    if (!bookmark) return;
    bookmark.v3SessionId = v3SessionId;
    bookmark.savedAt = Date.now(); // refresh timestamp
    await AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(bookmark));
    logger.info(
      `[gameRecovery] Patched bookmark with v3SessionId=${v3SessionId}`,
    );
  } catch (err) {
    logger.warn("[gameRecovery] Failed to patch bookmark v3SessionId:", err);
  }
}

/** Terminal V3 session phases — session should be cleared */
const TERMINAL_PHASES = new Set(["resolved", "abandoned", "expired"]);

// =============================================================================
// Recovery
// =============================================================================

/**
 * Attempt to recover an active game session.
 *
 * 1. Reads the saved bookmark from AsyncStorage.
 * 2. If the bookmark is older than `SESSION_MAX_AGE_MS`, clears it (stale).
 * 3. Fetches the invite doc from Firestore.
 * 4. If invite is still `active`, returns a `RecoverableSession`.
 * 5. If invite is terminal or missing, clears bookmark and returns null.
 * 6. If the invite is terminal but chatVisibility is not "hidden",
 *    self-heals it (belt-and-suspenders for Phase 1 finalization).
 *
 * @param currentUserId - The authenticated user's UID.  If it doesn't match
 *   the bookmark's userId, the bookmark is cleared (different user logged in).
 */
export async function recoverActiveSession(
  currentUserId: string,
): Promise<RecoverableSession | null> {
  const bookmark = await getActiveSessionBookmark();
  if (!bookmark) return null;

  // ── Wrong user ──────────────────────────────────────────────────────────
  if (bookmark.userId !== currentUserId) {
    logger.info("[gameRecovery] Bookmark belongs to different user — clearing");
    await clearActiveSession();
    return null;
  }

  // ── Stale bookmark ──────────────────────────────────────────────────────
  const age = Date.now() - bookmark.savedAt;
  if (age > SESSION_MAX_AGE_MS) {
    logger.info(
      `[gameRecovery] Bookmark is stale (${Math.round(age / 60000)} min) — clearing`,
    );
    await clearActiveSession();
    return null;
  }

  // ── Fetch invite doc ────────────────────────────────────────────────────
  try {
    const inviteRef = doc(getDb(), "GameInvites", bookmark.inviteId);
    const snap = await getDoc(inviteRef);

    if (!snap.exists()) {
      logger.info(
        `[gameRecovery] Invite ${bookmark.inviteId} not found — clearing`,
      );
      await clearActiveSession();
      return null;
    }

    const invite = { id: snap.id, ...snap.data() } as UniversalGameInvite;

    // ── Terminal invite → clear + self-heal ─────────────────────────────
    if (TERMINAL_STATUSES.has(invite.status)) {
      logger.info(
        `[gameRecovery] Invite ${bookmark.inviteId} is terminal (${invite.status}) — clearing`,
      );

      // Self-heal: ensure chat-hide fields are set (Phase 1 belt-and-suspenders)
      if (invite.chatVisibility !== "hidden") {
        logger.info(
          "[gameRecovery] Self-healing chatVisibility on terminal invite",
        );
        try {
          await completeGameInvite(bookmark.inviteId);
        } catch {
          // Best-effort — the watchdog will catch this too
        }
      }

      await clearActiveSession();
      return null;
    }

    // ── V3 session validation ────────────────────────────────────────
    // If the bookmark has a V3 session ID, also check the GameSessions doc.
    // This catches cases where the invite is still "active" but the session
    // itself has already resolved/abandoned.
    if (bookmark.v3SessionId) {
      try {
        const sessionRef = doc(getDb(), "GameSessions", bookmark.v3SessionId);
        const sessionSnap = await getDoc(sessionRef);
        if (sessionSnap.exists()) {
          const phase = sessionSnap.data()?.phase as string | undefined;
          if (phase && TERMINAL_PHASES.has(phase)) {
            logger.info(
              `[gameRecovery] V3 session ${bookmark.v3SessionId} is terminal ` +
                `(phase=${phase}) — clearing`,
            );
            await clearActiveSession();
            return null;
          }
        } else {
          // Session doc missing — clear the bookmark
          logger.info(
            `[gameRecovery] V3 session ${bookmark.v3SessionId} not found — clearing`,
          );
          await clearActiveSession();
          return null;
        }
      } catch (err) {
        // Network error — fall through to invite-based recovery
        logger.warn(
          "[gameRecovery] V3 session check failed, falling back to invite:",
          err,
        );
      }
    }

    // ── Active invite → recoverable ────────────────────────────────────
    if (invite.status === "active") {
      // Resolve screen name (lazy require to keep module lightweight)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { GAME_SCREEN_MAP } = require("@/config/gameCategories") as {
        GAME_SCREEN_MAP: Record<string, string>;
      };
      const screenName =
        GAME_SCREEN_MAP[bookmark.gameType as keyof typeof GAME_SCREEN_MAP];

      if (!screenName) {
        logger.warn(
          `[gameRecovery] No screen mapping for gameType="${bookmark.gameType}" — clearing`,
        );
        await clearActiveSession();
        return null;
      }

      logger.info(
        `[gameRecovery] Recoverable session found: inviteId=${bookmark.inviteId}, ` +
          `gameType=${bookmark.gameType}, screen=${screenName}`,
      );

      return {
        bookmark,
        invite,
        screenName,
      };
    }

    // ── Non-terminal, non-active (e.g. filling/pending/starting) ───────
    // The game hasn't started yet — the lobby may have moved on.
    // Keep the bookmark for now; a subsequent check may find it active.
    logger.info(
      `[gameRecovery] Invite ${bookmark.inviteId} status="${invite.status}" — ` +
        `not yet active, keeping bookmark`,
    );
    return null;
  } catch (err) {
    logger.warn("[gameRecovery] Error fetching invite for recovery:", err);
    // Network error — don't clear the bookmark; we'll try again next time.
    return null;
  }
}
