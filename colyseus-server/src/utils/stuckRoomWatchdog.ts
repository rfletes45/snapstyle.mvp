/**
 * Stuck Room Watchdog — Server-side diagnostic logging
 *
 * Detects rooms that have all expected players joined but never transition
 * from "waiting" to "playing". Logs diagnostic info with traceId for
 * server-side debugging of stuck lobbies.
 *
 * Usage in any room's onCreate:
 *   this.stuckWatchdog = createStuckRoomWatchdog(this, roomLog);
 *   // On dispose:
 *   this.stuckWatchdog?.dispose();
 *
 * @module utils/stuckRoomWatchdog
 */

import type { ServerLogger } from "./logger";

// =============================================================================
// Config
// =============================================================================

/** Default timeout (ms) before logging a stuck warning. */
const DEFAULT_STUCK_TIMEOUT_MS = 60_000; // 1 minute

// =============================================================================
// Types
// =============================================================================

export interface StuckRoomWatchdog {
  /** Cancel the watchdog. Call in onDispose. */
  dispose: () => void;
  /** Signal that the room has advanced to "playing". Cancels the timer. */
  markPlaying: () => void;
}

interface RoomLike {
  roomId: string;
  state?: {
    phase?: string;
    players?: { size?: number };
    tbPlayers?: { size?: number };
    racePlayers?: { size?: number };
    firestoreGameId?: string;
    maxPlayers?: number;
  };
  clients?: { length?: number } | any[];
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a stuck-room watchdog that logs a warning if the room has
 * players joined (clients > 1 or equivalent) but the phase never reaches
 * "playing" within the timeout window.
 *
 * @param room - The Colyseus room instance (or room-like duck type)
 * @param roomLog - Scoped logger with traceId etc.
 * @param timeoutMs - Milliseconds before logging (default 60s)
 */
export function createStuckRoomWatchdog(
  room: RoomLike,
  roomLog: ServerLogger,
  timeoutMs: number = DEFAULT_STUCK_TIMEOUT_MS,
): StuckRoomWatchdog {
  let resolved = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  timer = setTimeout(() => {
    if (resolved) return;

    // Only log if the room has not advanced and has clients
    const phase = room.state?.phase;
    if (phase === "playing" || phase === "finished") {
      resolved = true;
      return;
    }

    const clientCount = Array.isArray(room.clients) ? room.clients.length : 0;
    const playerCount =
      room.state?.tbPlayers?.size ??
      room.state?.racePlayers?.size ??
      room.state?.players?.size ??
      0;

    // Only log if at least 2 clients are present (both joined but stuck)
    if (clientCount >= 2 || playerCount >= 2) {
      roomLog.warn("STUCK_ROOM: Room has not reached playing phase", {
        roomId: room.roomId,
        phase: phase ?? "unknown",
        clientCount,
        playerCount,
        maxPlayers: room.state?.maxPlayers,
        firestoreGameId: room.state?.firestoreGameId ?? "none",
        elapsedMs: timeoutMs,
      });
    }
  }, timeoutMs);

  return {
    dispose: () => {
      resolved = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
    markPlaying: () => {
      resolved = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}
