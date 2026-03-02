/**
 * Game Adapter Registry — Unified metadata for the v3 lobby pipeline.
 *
 * Each multiplayer game has an adapter entry that tells SessionLobbyScreen
 * how to interact with it:
 *
 *   - **lobby-managed** → The Cloud Function (`startSessionV3`) creates the
 *     Colyseus room; the lobby passes the `colyseusRoomId` to the game
 *     screen as `matchId`.
 *
 *   - **game-managed** → The lobby only transitions the session to "active";
 *     the game screen creates / joins the room itself.
 *
 * @module config/gameAdapters
 */

import type {
  GameResultFacts,
  PerformanceMetric,
  ScoreboardEntry,
} from "@/types/gameResultFacts";
import type { ExtendedGameType, GameRuntimeType } from "@/types/games";
import { GAME_METADATA, GAME_RUNTIME_TYPE } from "@/types/games";
import { COLYSEUS_GAME_MAPPING } from "./colyseus";

// =============================================================================
// Types
// =============================================================================

/**
 * How the lobby handles Colyseus room creation.
 *
 * - `lobby-managed`  – `startSessionV3` creates the room; lobby passes
 *   `matchId = colyseusRoomId` to the game screen.
 * - `game-managed`   – The game screen creates / joins the room itself.
 *   Useful for games with custom connection protocols (WebView, custom queue).
 */
export type ConnectionMode = "lobby-managed" | "game-managed";

// =============================================================================
// Result Snapshot Context — passed to adapter methods at game completion
// =============================================================================

/**
 * Context object given to adapter result-snapshot methods.
 * Contains everything the adapter needs to build a GameResultFacts.
 */
export interface ResultSnapshotContext {
  /** Current user's UID */
  uid: string;
  /** Current user's display name */
  displayName: string;
  /** Current user's avatar URL */
  avatarUrl?: string;
  /** V3 session ID (if multiplayer) */
  sessionId?: string;
  /** Game duration in milliseconds */
  durationMs: number;
  /** Game-specific state object (varies per game) */
  gameState: unknown;
}

/**
 * Context object for Colyseus room connection helpers.
 */
export interface RoomConnectionContext {
  /** V3 session ID */
  sessionId: string;
  /** Current user's UID */
  uid: string;
  /** Current user's display name */
  displayName: string;
  /** Colyseus room ID (if lobby-managed) */
  colyseusRoomId?: string;
  /** Firestore game doc ID (if turn-based) */
  firestoreGameId?: string;
}

export interface GameAdapter {
  /** Game identifier (matches ExtendedGameType). */
  gameId: ExtendedGameType;
  /** Screen name in PlayStack (from GAME_SCREEN_MAP). */
  screenName: string;

  // ── Routing & Connection ──────────────────────────────────────────────

  /** How the lobby handles Colyseus room creation. */
  connectionMode: ConnectionMode;
  /** Runtime category (solo | turnBased | realtime). */
  runtimeType: GameRuntimeType;

  // ── Capacity ──────────────────────────────────────────────────────────

  /** Whether the game supports AI / solo opponents (bypass lobby). */
  hasAiMode: boolean;
  /** Minimum real players needed to start (excluding AI). */
  minRealPlayers: number;
  /** Maximum participants. */
  maxPlayers: number;
  /** Whether the game supports spectators. */
  supportsSpectators: boolean;
  /** Whether the game uses turn-based overlays vs score-race. */
  isTurnBased: boolean;

  // ── System-owned UI Flags ─────────────────────────────────────────────

  /**
   * Whether the MultiplayerRuntimeShell resign button replaces per-game
   * resign UI.  When `true` the game screen must suppress its own
   * resign button / dialog in v3 mode.
   */
  supportsSystemResign: boolean;
  /**
   * Whether the game delegates end-of-match UI to SessionGameOverScreen.
   * When `true` the game screen must suppress its own game-over overlay
   * in v3 mode (the shell navigates automatically).
   */
  supportsSystemGameOver: boolean;

  // ── Colyseus Room Helpers (realtime games) ────────────────────────────

  /**
   * Resolve the Colyseus room name for this game.
   * Default implementation returns the mapping from COLYSEUS_GAME_MAPPING.
   */
  resolveRoomName?: (ctx: RoomConnectionContext) => string;

  /**
   * Build the join-options object passed to `client.joinById()`.
   * Default implementation returns `{ sessionId, uid, displayName }`.
   */
  buildJoinOptions?: (ctx: RoomConnectionContext) => Record<string, unknown>;

  // ── Result Snapshot Extraction ────────────────────────────────────────

  /**
   * Extract a full `GameResultFacts` from the game's internal state.
   * Called by the runtime shell at game completion to drive the end screen.
   *
   * If not provided, the shell falls back to building facts from the
   * session resolution doc (works for most games).
   */
  getResultSnapshot?: (ctx: ResultSnapshotContext) => GameResultFacts;

  /**
   * Extract just the scoreboard from game state.
   * Lighter alternative to `getResultSnapshot` — used when the shell
   * can build the rest from the session doc.
   */
  getScoreboard?: (ctx: ResultSnapshotContext) => ScoreboardEntry[];

  /**
   * Extract game-specific performance metrics for the end screen.
   * E.g. accuracy %, move count, time per turn.
   */
  getPerformanceMetrics?: (ctx: ResultSnapshotContext) => PerformanceMetric[];
}

// =============================================================================
// Registry
// =============================================================================

/**
 * Adapters for all 14 multiplayer games.
 *
 * Solo games (bounce_blitz, play_2048, word_master, brick_breaker,
 * minesweeper_classic, lights_out) are NOT in this registry — they bypass
 * the lobby entirely.
 */
export const GAME_ADAPTER_REGISTRY: Partial<
  Record<ExtendedGameType, GameAdapter>
> = {
  // ── Turn-based (lobby-managed) ──────────────────────────────────────────
  chess: {
    gameId: "chess",
    screenName: "ChessGame",
    connectionMode: "lobby-managed",
    runtimeType: "turnBased",
    hasAiMode: false,
    minRealPlayers: 2,
    maxPlayers: 2,
    supportsSpectators: true,
    isTurnBased: true,
    supportsSystemResign: true,
    supportsSystemGameOver: true,
  },
  checkers: {
    gameId: "checkers",
    screenName: "CheckersGame",
    connectionMode: "lobby-managed",
    runtimeType: "turnBased",
    hasAiMode: false,
    minRealPlayers: 2,
    maxPlayers: 2,
    supportsSpectators: true,
    isTurnBased: true,
    supportsSystemResign: true,
    supportsSystemGameOver: true,
  },
  tic_tac_toe: {
    gameId: "tic_tac_toe",
    screenName: "TicTacToeGame",
    connectionMode: "lobby-managed",
    runtimeType: "turnBased",
    hasAiMode: false,
    minRealPlayers: 2,
    maxPlayers: 2,
    supportsSpectators: true,
    isTurnBased: true,
    supportsSystemResign: true,
    supportsSystemGameOver: true,
    getPerformanceMetrics: (ctx) => {
      const state = ctx.gameState as { turnNumber?: number } | undefined;
      return [
        {
          label: "Turns",
          value: String(state?.turnNumber ?? 0),
          icon: "counter",
        },
      ];
    },
  },
  connect_four: {
    gameId: "connect_four",
    screenName: "FourGame",
    connectionMode: "lobby-managed",
    runtimeType: "turnBased",
    hasAiMode: true,
    minRealPlayers: 1,
    maxPlayers: 2,
    supportsSpectators: true,
    isTurnBased: true,
    supportsSystemResign: true,
    supportsSystemGameOver: true,
  },
  gomoku_master: {
    gameId: "gomoku_master",
    screenName: "GomokuGame",
    connectionMode: "lobby-managed",
    runtimeType: "turnBased",
    hasAiMode: true,
    minRealPlayers: 1,
    maxPlayers: 2,
    supportsSpectators: true,
    isTurnBased: true,
    supportsSystemResign: true,
    supportsSystemGameOver: true,
  },
  reversi_game: {
    gameId: "reversi_game",
    screenName: "ReversiGame",
    connectionMode: "lobby-managed",
    runtimeType: "turnBased",
    hasAiMode: true,
    minRealPlayers: 1,
    maxPlayers: 2,
    supportsSpectators: true,
    isTurnBased: true,
    supportsSystemResign: true,
    supportsSystemGameOver: true,
  },
  // dot_match uses useMultiplayerGame (realtime hook) despite "turnBased" classification
  dot_match: {
    gameId: "dot_match",
    screenName: "DotsGame",
    connectionMode: "lobby-managed",
    runtimeType: "turnBased",
    hasAiMode: true,
    minRealPlayers: 1,
    maxPlayers: 2,
    supportsSpectators: true,
    isTurnBased: false,
    supportsSystemResign: true,
    supportsSystemGameOver: true,
  },

  // ── Realtime (lobby-managed) ────────────────────────────────────────────
  crazy_eights: {
    gameId: "crazy_eights",
    screenName: "CrazyEightsGame",
    connectionMode: "lobby-managed",
    runtimeType: "realtime",
    hasAiMode: true,
    minRealPlayers: 1,
    maxPlayers: 5,
    supportsSpectators: true,
    isTurnBased: false,
    supportsSystemResign: true,
    supportsSystemGameOver: true,
  },
  pong_game: {
    gameId: "pong_game",
    screenName: "PongGame",
    connectionMode: "lobby-managed",
    runtimeType: "realtime",
    hasAiMode: true,
    minRealPlayers: 1,
    maxPlayers: 2,
    supportsSpectators: true,
    isTurnBased: false,
    supportsSystemResign: true,
    supportsSystemGameOver: true,
    getPerformanceMetrics: (ctx) => {
      const state = ctx.gameState as
        | {
            myScore?: number;
            opponentScore?: number;
          }
        | undefined;
      return [
        {
          label: "My Score",
          value: String(state?.myScore ?? 0),
          icon: "scoreboard",
        },
        {
          label: "Opp Score",
          value: String(state?.opponentScore ?? 0),
          icon: "scoreboard-outline",
        },
      ];
    },
  },

  // ── Game-managed (custom connection protocol) ───────────────────────────
  sketch_party_game: {
    gameId: "sketch_party_game",
    screenName: "SketchPartyGameScreen",
    connectionMode: "game-managed",
    runtimeType: "realtime",
    hasAiMode: false,
    minRealPlayers: 2,
    maxPlayers: 10,
    supportsSpectators: true,
    isTurnBased: false,
    supportsSystemResign: true,
    supportsSystemGameOver: true,
  },
  starforge_game: {
    gameId: "starforge_game",
    screenName: "StarforgeGame",
    connectionMode: "game-managed",
    runtimeType: "realtime",
    hasAiMode: false,
    minRealPlayers: 1,
    maxPlayers: 2,
    supportsSpectators: true,
    isTurnBased: false,
    supportsSystemResign: true,
    supportsSystemGameOver: true,
  },
  crossword_puzzle: {
    gameId: "crossword_puzzle",
    screenName: "CrosswordGame",
    connectionMode: "game-managed",
    runtimeType: "realtime",
    hasAiMode: false,
    minRealPlayers: 1,
    maxPlayers: 1, // Solo by default; co-op behind feature flag
    supportsSpectators: true,
    isTurnBased: false,
    supportsSystemResign: true,
    supportsSystemGameOver: true,
  },
  minigolf_duels: {
    gameId: "minigolf_duels",
    screenName: "MiniGolfDuelsGame",
    connectionMode: "game-managed",
    runtimeType: "realtime",
    hasAiMode: false,
    minRealPlayers: 2,
    maxPlayers: 2,
    supportsSpectators: true,
    isTurnBased: false,
    supportsSystemResign: true,
    supportsSystemGameOver: true,
  },
  battleship: {
    gameId: "battleship",
    screenName: "BattleshipGame",
    connectionMode: "game-managed",
    runtimeType: "realtime",
    hasAiMode: false,
    minRealPlayers: 2,
    maxPlayers: 2,
    supportsSpectators: true,
    isTurnBased: false,
    supportsSystemResign: true,
    supportsSystemGameOver: true,
  },
};

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get the adapter for a game type. Returns `undefined` for solo games.
 */
export function getGameAdapter(
  gameId: ExtendedGameType,
): GameAdapter | undefined {
  return GAME_ADAPTER_REGISTRY[gameId];
}

/**
 * Whether a game type has an adapter (i.e. is multiplayer and lobby-aware).
 */
export function isLobbyGame(gameId: ExtendedGameType): boolean {
  return gameId in GAME_ADAPTER_REGISTRY;
}

/**
 * Whether the lobby should route through SessionLobbyScreen for this game.
 *
 * Returns `true` for multiplayer games (even those with AI mode — when
 * a session is explicitly created, the lobby flow is used). Solo games
 * always return `false`.
 */
export function shouldUseLobby(gameId: ExtendedGameType): boolean {
  const adapter = GAME_ADAPTER_REGISTRY[gameId];
  if (!adapter) return false;
  // Multiplayer game → always use lobby when a session exists
  return true;
}

/**
 * Get the max participants for lobby creation from the adapter, falling back
 * to GAME_METADATA.maxPlayers.
 */
export function getLobbyMaxParticipants(gameId: ExtendedGameType): number {
  const adapter = GAME_ADAPTER_REGISTRY[gameId];
  if (adapter) return adapter.maxPlayers;
  return GAME_METADATA[gameId]?.maxPlayers ?? 2;
}

/**
 * Whether this game supports solo / AI play and can bypass the lobby.
 */
export function canPlaySolo(gameId: ExtendedGameType): boolean {
  const runtimeType = GAME_RUNTIME_TYPE[gameId];
  if (runtimeType === "solo") return true;
  const adapter = GAME_ADAPTER_REGISTRY[gameId];
  return adapter?.hasAiMode ?? false;
}

// =============================================================================
// Colyseus Room Resolution
// =============================================================================

/**
 * Resolve the Colyseus room name for a game, using the adapter's
 * `resolveRoomName` override if present, otherwise falling back to
 * `COLYSEUS_GAME_MAPPING`.
 */
export function resolveRoomName(
  gameId: ExtendedGameType,
  ctx: RoomConnectionContext,
): string | undefined {
  const adapter = GAME_ADAPTER_REGISTRY[gameId];
  if (adapter?.resolveRoomName) {
    return adapter.resolveRoomName(ctx);
  }
  // Fallback to canonical mapping
  const mapping =
    COLYSEUS_GAME_MAPPING[gameId as keyof typeof COLYSEUS_GAME_MAPPING];
  return mapping?.roomName;
}

/**
 * Build join options for a Colyseus room, using the adapter's
 * `buildJoinOptions` override if present.
 */
export function buildJoinOptions(
  gameId: ExtendedGameType,
  ctx: RoomConnectionContext,
): Record<string, unknown> {
  const adapter = GAME_ADAPTER_REGISTRY[gameId];
  if (adapter?.buildJoinOptions) {
    return adapter.buildJoinOptions(ctx);
  }
  // Default join options
  return {
    sessionId: ctx.sessionId,
    uid: ctx.uid,
    displayName: ctx.displayName,
  };
}

/**
 * Extract a GameResultFacts from the game's internal state using the
 * adapter's `getResultSnapshot` method. Returns undefined if the
 * adapter doesn't implement it.
 */
export function getAdapterResultSnapshot(
  gameId: ExtendedGameType,
  ctx: ResultSnapshotContext,
): GameResultFacts | undefined {
  const adapter = GAME_ADAPTER_REGISTRY[gameId];
  return adapter?.getResultSnapshot?.(ctx);
}

/**
 * Extract performance metrics from game state using the adapter.
 * Returns undefined if the adapter doesn't implement it.
 */
export function getAdapterPerformanceMetrics(
  gameId: ExtendedGameType,
  ctx: ResultSnapshotContext,
): PerformanceMetric[] | undefined {
  const adapter = GAME_ADAPTER_REGISTRY[gameId];
  return adapter?.getPerformanceMetrics?.(ctx);
}
