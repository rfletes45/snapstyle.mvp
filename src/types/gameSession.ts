/**
 * Game Session Types — Canonical Identifiers & Join Options
 *
 * These types are the SINGLE source of truth for:
 *  - What context a game screen needs to open a session
 *  - What payload is sent in every Colyseus joinOrCreate call
 *
 * All hooks (useColyseus, useTurnBasedGame, useMultiplayerGame, …)
 * should accept / produce these types instead of ad-hoc option bags.
 *
 * @see docs/GAME_SYSTEM_REFERENCE.md §6 (Client-Side Hooks)
 */

import type { ClientBuildInfo } from "@/types/gameProtocol";
import type { ExtendedGameType } from "@/types/games";

// =============================================================================
// Session Context (client-side routing)
// =============================================================================

/**
 * How the user entered the game — determines post-game navigation.
 */
export type GameEntryPoint = "chat" | "play";

/**
 * Transport mode for this session.
 *
 *  "colyseus" — real-time via Colyseus WebSocket room
 *  "online"   — Firestore-based turn-by-turn (legacy path)
 *  "local"    — single-player, no network
 */
export type GameTransportMode = "colyseus" | "online" | "local";

/**
 * Everything a game screen needs to know about the session
 * before it creates or joins a Colyseus room.
 *
 * Built from route params + invite data + feature flags.
 */
export interface GameSessionContext {
  /** Canonical game type key (e.g. "chess", "brick_breaker") */
  gameType: ExtendedGameType;
  /** Firestore game document ID (invite bridge) — undefined for local */
  firestoreGameId?: string;
  /** The invite that spawned this session, if any */
  inviteId?: string;
  /** Chat conversation this game was launched from, if any */
  conversationId?: string;
  /** How the user got here */
  entryPoint: GameEntryPoint;
  /** Resolved transport */
  mode: GameTransportMode;
  /** True if the user is joining as a spectator */
  spectator?: boolean;
  /**
   * Correlation ID for end-to-end tracing.
   *
   * If provided (e.g. from the invite doc), `buildJoinOptions` will
   * propagate it to the Colyseus wire payload.  If absent, a fresh
   * traceId is generated automatically.
   */
  traceId?: string;
}

// =============================================================================
// Colyseus Join Options (sent over the wire)
// =============================================================================

/**
 * The canonical shape sent to `colyseusService.joinOrCreate()`.
 *
 * Every field the server's `onAuth` / `onCreate` / `onJoin` may inspect
 * should live here. This replaces the previous `Record<string, any>` bags.
 */
export interface GameJoinOptions {
  /** Firebase ID token — required for onAuth */
  token: string;
  /** Client protocol version — server rejects if incompatible */
  protocolVersion: number;
  /** Client build metadata for diagnostics */
  buildInfo: ClientBuildInfo;

  // ── Routing ─────────────────────────────────────────────────────────────
  /** Firestore game/invite document ID — used by filterBy to match rooms */
  firestoreGameId?: string;
  /** If true, join as spectator (no gameplay actions) */
  spectator?: boolean;

  // ── Observability ───────────────────────────────────────────────────────
  /** Correlation ID for end-to-end log tracing */
  traceId?: string;

  // ── Invite metadata (informational — server may log/validate) ─────────
  /** The invite document ID that started this game */
  inviteId?: string;
  /** Chat conversation ID (for post-game navigation & chat integration) */
  conversationId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

/**
 * Runtime guard for Colyseus join payloads.
 *
 * Used at the wire boundary before sending options to the server.
 */
export function isGameJoinOptions(value: unknown): value is GameJoinOptions {
  if (!isRecord(value)) return false;

  if (typeof value.token !== "string" || value.token.length === 0) return false;
  if (
    typeof value.protocolVersion !== "number" ||
    !Number.isFinite(value.protocolVersion)
  ) {
    return false;
  }

  if (!isRecord(value.buildInfo)) return false;
  if (
    typeof value.buildInfo.appVersion !== "string" ||
    typeof value.buildInfo.platform !== "string" ||
    typeof value.buildInfo.protocolVersion !== "number"
  ) {
    return false;
  }

  if (
    value.traceId !== undefined &&
    (typeof value.traceId !== "string" || value.traceId.length === 0)
  ) {
    return false;
  }

  return true;
}

/**
 * Assertion wrapper for join payload validation.
 */
export function assertGameJoinOptions(
  value: unknown,
  message = "Invalid GameJoinOptions payload",
): asserts value is GameJoinOptions {
  if (!isGameJoinOptions(value)) {
    throw new Error(message);
  }
}
