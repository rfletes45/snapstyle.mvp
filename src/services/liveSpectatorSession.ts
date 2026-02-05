/**
 * Live Spectator Session Service
 *
 * Enables real-time spectating for single-player games.
 * This service handles:
 * - Creating live sessions when a player starts with spectators invited
 * - Real-time game state synchronization
 * - Spectator join/leave tracking
 * - Session lifecycle management
 *
 * @see docs/07_GAMES_ARCHITECTURE.md
 */

import { SinglePlayerGameType } from "@/types/games";
import {
  arrayRemove,
  arrayUnion,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
} from "firebase/firestore";
import { getAuthInstance, getFirestoreInstance } from "./firebase";

// Lazy getters to avoid calling at module load time
const getDb = () => getFirestoreInstance();
const getAuth = () => getAuthInstance();

// =============================================================================
// Types
// =============================================================================

/** Status of a live spectator session */
export type LiveSessionStatus =
  | "waiting" // Session created, waiting for game to start
  | "active" // Game in progress, spectators can watch
  | "paused" // Game paused
  | "completed" // Game ended
  | "abandoned"; // Player left without finishing

/** A spectator watching the session */
export interface LiveSpectator {
  id: string;
  displayName: string;
  avatarUrl?: string;
  joinedAt: number;
}

/** Live spectator session document structure */
export interface LiveSpectatorSession {
  id: string;
  /** The game being played */
  gameType: SinglePlayerGameType;
  /** Host player info */
  hostId: string;
  hostName: string;
  hostAvatar?: string;
  /** Session status */
  status: LiveSessionStatus;
  /** Current game state (serialized, game-specific) */
  gameState: Record<string, unknown>;
  /** Current score */
  currentScore: number;
  /** List of spectators */
  spectators: LiveSpectator[];
  /** Max spectators allowed (undefined = unlimited) */
  maxSpectators?: number;
  /** Users who can join as spectators (from invite) */
  invitedUserIds: string[];
  /** Conversation context */
  conversationId?: string;
  conversationType?: "dm" | "group";
  /** Timestamps */
  createdAt: Timestamp;
  updatedAt: Timestamp;
  startedAt?: Timestamp;
  endedAt?: Timestamp;
}

/** Input for creating a live session */
export interface CreateLiveSessionInput {
  gameType: SinglePlayerGameType;
  hostId: string;
  hostName: string;
  hostAvatar?: string;
  invitedUserIds: string[];
  maxSpectators?: number;
  conversationId?: string;
  conversationType?: "dm" | "group";
}

/** Result of creating a session */
export interface CreateSessionResult {
  success: boolean;
  sessionId?: string;
  error?: string;
}

/** Result of joining a session */
export interface JoinSessionResult {
  success: boolean;
  error?: string;
}

/** Game state update */
export interface GameStateUpdate {
  gameState: Record<string, unknown>;
  currentScore: number;
  status?: LiveSessionStatus;
}

// =============================================================================
// Constants
// =============================================================================

const COLLECTION_NAME = "LiveSpectatorSessions";
const MAX_SPECTATORS_DEFAULT = 10;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate unique session ID
 */
function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `lss_${timestamp}_${random}`;
}

/**
 * Remove undefined values from an object (Firestore rejects undefined)
 */
function removeUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result as T;
}

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Create a new live spectator session
 *
 * Call this when starting a single-player game with spectator invites.
 * Returns the session ID which should be passed to the game screen.
 */
export async function createLiveSession(
  input: CreateLiveSessionInput,
): Promise<CreateSessionResult> {
  try {
    const db = getDb();
    const sessionId = generateSessionId();

    const sessionDoc: Record<string, unknown> = {
      id: sessionId,
      gameType: input.gameType,
      hostId: input.hostId,
      hostName: input.hostName,
      status: "waiting",
      gameState: {},
      currentScore: 0,
      spectators: [],
      invitedUserIds: input.invitedUserIds,
      maxSpectators: input.maxSpectators ?? MAX_SPECTATORS_DEFAULT,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Add optional fields only if present
    if (input.hostAvatar) {
      sessionDoc.hostAvatar = input.hostAvatar;
    }
    if (input.conversationId) {
      sessionDoc.conversationId = input.conversationId;
      sessionDoc.conversationType = input.conversationType || "dm";
    }

    await setDoc(doc(db, COLLECTION_NAME, sessionId), sessionDoc);

    console.log(`[LiveSession] Created session: ${sessionId}`);
    return { success: true, sessionId };
  } catch (error: any) {
    console.error("[LiveSession] Error creating session:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Start the live session (when game actually begins)
 */
export async function startLiveSession(sessionId: string): Promise<boolean> {
  try {
    const db = getDb();
    const sessionRef = doc(db, COLLECTION_NAME, sessionId);

    await updateDoc(sessionRef, {
      status: "active",
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    console.log(`[LiveSession] Started session: ${sessionId}`);
    return true;
  } catch (error) {
    console.error("[LiveSession] Error starting session:", error);
    return false;
  }
}

/**
 * Update game state for spectators to see
 *
 * Call this frequently during gameplay to sync state to spectators.
 * Throttle to ~5-10 updates per second max for performance.
 */
export async function updateLiveSessionState(
  sessionId: string,
  update: GameStateUpdate,
): Promise<boolean> {
  try {
    const db = getDb();
    const sessionRef = doc(db, COLLECTION_NAME, sessionId);

    const updateData: Record<string, unknown> = {
      gameState: update.gameState,
      currentScore: update.currentScore,
      updatedAt: serverTimestamp(),
    };

    if (update.status) {
      updateData.status = update.status;
    }

    await updateDoc(sessionRef, updateData);
    return true;
  } catch (error) {
    console.error("[LiveSession] Error updating state:", error);
    return false;
  }
}

/**
 * End the live session
 */
export async function endLiveSession(
  sessionId: string,
  finalScore: number,
  finalState: Record<string, unknown>,
): Promise<boolean> {
  try {
    const db = getDb();
    const sessionRef = doc(db, COLLECTION_NAME, sessionId);

    await updateDoc(sessionRef, {
      status: "completed",
      gameState: finalState,
      currentScore: finalScore,
      endedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    console.log(`[LiveSession] Ended session: ${sessionId}`);
    return true;
  } catch (error) {
    console.error("[LiveSession] Error ending session:", error);
    return false;
  }
}

/**
 * Abandon the live session (player quit early)
 */
export async function abandonLiveSession(sessionId: string): Promise<boolean> {
  try {
    const db = getDb();
    const sessionRef = doc(db, COLLECTION_NAME, sessionId);

    await updateDoc(sessionRef, {
      status: "abandoned",
      endedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    console.log(`[LiveSession] Abandoned session: ${sessionId}`);
    return true;
  } catch (error) {
    console.error("[LiveSession] Error abandoning session:", error);
    return false;
  }
}

/**
 * Get a live session by ID
 */
export async function getLiveSession(
  sessionId: string,
): Promise<LiveSpectatorSession | null> {
  try {
    const db = getDb();
    const sessionRef = doc(db, COLLECTION_NAME, sessionId);
    const snapshot = await getDoc(sessionRef);

    if (!snapshot.exists()) {
      return null;
    }

    return snapshot.data() as LiveSpectatorSession;
  } catch (error) {
    console.error("[LiveSession] Error getting session:", error);
    return null;
  }
}

// =============================================================================
// Spectator Functions
// =============================================================================

/**
 * Join a live session as a spectator
 */
export async function joinLiveSessionAsSpectator(
  sessionId: string,
  userId: string,
  displayName: string,
  avatarUrl?: string,
): Promise<JoinSessionResult> {
  try {
    const db = getDb();
    const sessionRef = doc(db, COLLECTION_NAME, sessionId);
    const session = await getDoc(sessionRef);

    if (!session.exists()) {
      return { success: false, error: "Session not found" };
    }

    const data = session.data() as LiveSpectatorSession;

    // Check if user is invited (or is the host)
    if (data.hostId !== userId && !data.invitedUserIds.includes(userId)) {
      return { success: false, error: "Not invited to this session" };
    }

    // Check if user is the host (hosts don't join as spectator)
    if (data.hostId === userId) {
      return { success: false, error: "Host cannot be a spectator" };
    }

    // Check if already a spectator
    if (data.spectators.some((s) => s.id === userId)) {
      return { success: true }; // Already joined
    }

    // Check max spectators
    if (
      data.maxSpectators !== undefined &&
      data.spectators.length >= data.maxSpectators
    ) {
      return { success: false, error: "Maximum spectators reached" };
    }

    // Check session status
    if (data.status === "completed" || data.status === "abandoned") {
      return { success: false, error: "Session has ended" };
    }

    // Add spectator
    const spectator: LiveSpectator = {
      id: userId,
      displayName,
      joinedAt: Date.now(),
    };
    if (avatarUrl) {
      spectator.avatarUrl = avatarUrl;
    }

    await updateDoc(sessionRef, {
      spectators: arrayUnion(spectator),
      updatedAt: serverTimestamp(),
    });

    console.log(`[LiveSession] ${displayName} joined session: ${sessionId}`);
    return { success: true };
  } catch (error: any) {
    console.error("[LiveSession] Error joining as spectator:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Leave a live session as a spectator
 */
export async function leaveLiveSessionAsSpectator(
  sessionId: string,
  userId: string,
): Promise<boolean> {
  try {
    const db = getDb();
    const sessionRef = doc(db, COLLECTION_NAME, sessionId);
    const session = await getDoc(sessionRef);

    if (!session.exists()) {
      return false;
    }

    const data = session.data() as LiveSpectatorSession;
    const spectator = data.spectators.find((s) => s.id === userId);

    if (!spectator) {
      return true; // Already not a spectator
    }

    await updateDoc(sessionRef, {
      spectators: arrayRemove(spectator),
      updatedAt: serverTimestamp(),
    });

    console.log(`[LiveSession] User ${userId} left session: ${sessionId}`);
    return true;
  } catch (error) {
    console.error("[LiveSession] Error leaving as spectator:", error);
    return false;
  }
}

// =============================================================================
// Subscription Functions
// =============================================================================

/**
 * Subscribe to live session updates (for spectators)
 *
 * Returns an unsubscribe function.
 */
export function subscribeToLiveSession(
  sessionId: string,
  onUpdate: (session: LiveSpectatorSession | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const db = getDb();
  const sessionRef = doc(db, COLLECTION_NAME, sessionId);

  return onSnapshot(
    sessionRef,
    (snapshot) => {
      if (snapshot.exists()) {
        onUpdate(snapshot.data() as LiveSpectatorSession);
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      console.error("[LiveSession] Subscription error:", error);
      onError?.(error);
    },
  );
}

/**
 * Subscribe to spectator list changes
 */
export function subscribeToSpectators(
  sessionId: string,
  onUpdate: (spectators: LiveSpectator[]) => void,
): Unsubscribe {
  const db = getDb();
  const sessionRef = doc(db, COLLECTION_NAME, sessionId);

  return onSnapshot(
    sessionRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as LiveSpectatorSession;
        onUpdate(data.spectators || []);
      } else {
        onUpdate([]);
      }
    },
    (error) => {
      console.error("[LiveSession] Spectator subscription error:", error);
      onUpdate([]);
    },
  );
}

// =============================================================================
// Cleanup
// =============================================================================

/**
 * Delete a completed/abandoned session (for cleanup)
 */
export async function deleteLiveSession(sessionId: string): Promise<boolean> {
  try {
    const db = getDb();
    await deleteDoc(doc(db, COLLECTION_NAME, sessionId));
    console.log(`[LiveSession] Deleted session: ${sessionId}`);
    return true;
  } catch (error) {
    console.error("[LiveSession] Error deleting session:", error);
    return false;
  }
}
