/**
 * SpectatorSessions Service — Firestore-backed spectator session status
 *
 * Replaces the pattern of mutating chat messages to update spectator invite
 * status. Instead, a SpectatorSessions/{roomId} doc is written when
 * hosting starts and updated when the game ends. Chat bubbles read this
 * doc (via a listener or one-shot read) to determine whether to show
 * "Watch Live" vs "Game Ended".
 *
 * Collection: SpectatorSessions/{roomId}
 *
 * @see docs/GAMES_SYSTEM.md (Spectator system section)
 */

import { getFirestoreInstance } from "@/services/firebase";
import { createLogger } from "@/utils/log";
import { doc, getDoc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";

const logger = createLogger("services/spectatorSessions");

// =============================================================================
// Types
// =============================================================================

export interface SpectatorSessionDoc {
  /** Colyseus SpectatorRoom ID (also the doc ID) */
  roomId: string;
  /** Canonical game type */
  gameType: string;
  /** Host Firebase UID */
  hostUid: string;
  /** Host display name */
  hostName: string;
  /** Session status */
  status: "active" | "finished";
  /** Final score (set when status = "finished") */
  finalScore?: number;
  /** Created timestamp */
  createdAt: number;
  /** Updated timestamp */
  updatedAt: number;
}

// =============================================================================
// Firestore helpers
// =============================================================================

function getFirestoreRef(roomId: string) {
  const db = getFirestoreInstance();
  return doc(db, "SpectatorSessions", roomId);
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Create a SpectatorSession doc when the host starts hosting.
 * Called from useSpectator (sp-host) after room creation.
 */
export async function createSpectatorSession(
  roomId: string,
  gameType: string,
  hostUid: string,
  hostName: string,
): Promise<void> {
  try {
    const ref = getFirestoreRef(roomId);
    const now = Date.now();
    await setDoc(ref, {
      roomId,
      gameType,
      hostUid,
      hostName,
      status: "active",
      createdAt: now,
      updatedAt: now,
    } satisfies SpectatorSessionDoc);
    logger.info("[spectatorSessions] Session created", { roomId, gameType });
  } catch (err) {
    logger.error("[spectatorSessions] Failed to create session", err);
  }
}

/**
 * Mark a SpectatorSession as finished with a final score.
 * Called from useSpectator (sp-host) when the game ends.
 */
export async function finishSpectatorSession(
  roomId: string,
  finalScore: number,
): Promise<void> {
  try {
    const ref = getFirestoreRef(roomId);
    await updateDoc(ref, {
      status: "finished",
      finalScore,
      updatedAt: Date.now(),
    });
    logger.info("[spectatorSessions] Session finished", {
      roomId,
      finalScore,
    });
  } catch (err) {
    logger.error("[spectatorSessions] Failed to finish session", err);
  }
}

/**
 * Read a SpectatorSession doc (one-shot).
 * Used by SpectatorInviteBubble to check if session is still active.
 */
export async function getSpectatorSession(
  roomId: string,
): Promise<SpectatorSessionDoc | null> {
  try {
    const ref = getFirestoreRef(roomId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data() as SpectatorSessionDoc;
  } catch (err) {
    logger.error("[spectatorSessions] Failed to read session", err);
    return null;
  }
}

/**
 * Subscribe to a SpectatorSession doc for real-time status.
 * Returns an unsubscribe function.
 */
export function subscribeToSpectatorSession(
  roomId: string,
  callback: (session: SpectatorSessionDoc | null) => void,
): () => void {
  let unsubFn: (() => void) | null = null;

  try {
    const ref = getFirestoreRef(roomId);
    unsubFn = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          callback(snap.data() as SpectatorSessionDoc);
        } else {
          callback(null);
        }
      },
      (err) => {
        // Permission-denied is expected when SpectatorSessions rules
        // are not yet deployed, or the doc doesn't exist; treat as
        // "no session" rather than spamming the logs.
        const code = (err as any)?.code;
        if (code === "permission-denied" || code === "not-found") {
          logger.debug("[spectatorSessions] Snapshot unavailable:", code);
        } else {
          logger.warn("[spectatorSessions] Snapshot error", err);
        }
        callback(null);
      },
    );
  } catch (err) {
    logger.error("[spectatorSessions] Failed to subscribe", err);
    callback(null);
  }

  return () => {
    unsubFn?.();
  };
}
