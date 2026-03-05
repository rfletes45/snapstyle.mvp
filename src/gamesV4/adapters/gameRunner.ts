/**
 * Games V4 — Game Runner
 *
 * Server-side module that delegates move validation and state
 * transitions to the appropriate game adapter.
 *
 * Called by the session pipeline (submitTurnMoveV4) to:
 * 1. Validate the move via the adapter
 * 2. Produce the new public/private state
 * 3. Detect terminal conditions (win/draw)
 * 4. Compute score deltas
 *
 * Also provides helpers for:
 * - Creating initial game state from an adapter
 * - Computing final outcomes
 * - Extracting performance metrics
 *
 * @module gamesV4/adapters/gameRunner
 */

import type { GameOutcome, MoveValidationResult } from "../types/adapter";
import type { GameId } from "../types/common";
import { requireAdapter } from "./registry";

// =============================================================================
// Types
// =============================================================================

export interface InitialStateResult {
  publicState: Record<string, unknown>;
  privateStateByPlayer: Record<string, Record<string, unknown>>;
}

export interface RunMoveInput {
  gameId: GameId;
  publicState: Record<string, unknown>;
  privateStateByPlayer: Record<string, Record<string, unknown>>;
  movePayload: Record<string, unknown>;
  uid: string;
  turnOrder: string[];
  currentTurnIndex: number;
  settings: Record<string, unknown>;
}

export interface RunMoveResult {
  valid: boolean;
  error?: string;
  nextPublicState: Record<string, unknown>;
  nextPrivateState: Record<string, Record<string, unknown>>;
  scoreDelta: Array<{ uid: string; delta: number }>;
  turnAdvance: boolean;
  nextTurnPlayerId?: string;
  terminal: MoveValidationResult["terminal"];
}

// =============================================================================
// State Creation
// =============================================================================

/**
 * Create initial game state using the adapter for the given gameId.
 */
export function createInitialState(
  gameId: GameId,
  players: Array<{ uid: string; slotIndex: number }>,
  settings: Record<string, unknown>,
): InitialStateResult {
  const adapter = requireAdapter(gameId);

  const publicState = adapter.createInitialPublicState(players, settings);

  const privateStateByPlayer = adapter.createInitialPrivateState
    ? adapter.createInitialPrivateState(players, settings)
    : {};

  return { publicState, privateStateByPlayer };
}

// =============================================================================
// Move Execution
// =============================================================================

/**
 * Validate and apply a move using the game adapter.
 *
 * If the adapter does not implement validateMove (e.g., realtime games),
 * the move is accepted as-is (passthrough).
 */
export function runMove(input: RunMoveInput): RunMoveResult {
  const adapter = requireAdapter(input.gameId);

  // For games without server-side move validation (realtime, solo)
  if (!adapter.validateMove) {
    return {
      valid: true,
      nextPublicState: input.publicState,
      nextPrivateState: input.privateStateByPlayer,
      scoreDelta: [],
      turnAdvance: true,
      terminal: undefined,
    };
  }

  const result = adapter.validateMove(
    input.publicState,
    input.privateStateByPlayer,
    input.movePayload,
    {
      uid: input.uid,
      turnOrder: input.turnOrder,
      currentTurnIndex: input.currentTurnIndex,
      settings: input.settings,
    },
  );

  return {
    valid: result.ok,
    error: result.error,
    nextPublicState: result.nextPublicState ?? input.publicState,
    nextPrivateState: result.nextPrivateState ?? input.privateStateByPlayer,
    scoreDelta: result.scoreDelta ?? [],
    turnAdvance: result.turnAdvance ?? true,
    nextTurnPlayerId: result.nextTurnPlayerId,
    terminal: result.terminal,
  };
}

// =============================================================================
// Outcome Computation
// =============================================================================

/**
 * Compute final game outcome from the current state.
 * Falls back to a default outcome if the adapter doesn't implement it.
 */
export function computeOutcome(
  gameId: GameId,
  publicState: Record<string, unknown>,
  players: Array<{ uid: string; slotIndex: number }>,
  fallbackWinnerIds: string[] = [],
): GameOutcome {
  const adapter = requireAdapter(gameId);

  if (adapter.computeOutcome) {
    return adapter.computeOutcome(publicState, players);
  }

  // Fallback: build scoreboard from fallbackWinnerIds
  return {
    winnerIds: fallbackWinnerIds,
    finalScoreboard: players.map((p, i) => ({
      uid: p.uid,
      score: fallbackWinnerIds.includes(p.uid) ? 1 : 0,
      placement: fallbackWinnerIds.includes(p.uid) ? 1 : i + 1,
      stats: {},
    })),
  };
}

// =============================================================================
// Performance Metrics
// =============================================================================

/**
 * Extract performance metrics from the game adapter for XP scaling.
 */
export function extractPerformanceMetrics(
  gameId: GameId,
  publicState: Record<string, unknown>,
  players: Array<{ uid: string }>,
): Record<string, unknown> {
  const adapter = requireAdapter(gameId);

  if (adapter.extractPerformanceMetrics) {
    return adapter.extractPerformanceMetrics(publicState, players);
  }

  return {};
}

// =============================================================================
// Settings Validation
// =============================================================================

/**
 * Validate a settings patch using the game adapter.
 */
export function validateSettings(
  gameId: GameId,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const adapter = requireAdapter(gameId);

  if (adapter.validateSettings) {
    return adapter.validateSettings(patch);
  }

  // Default: merge with defaults
  return { ...adapter.defaultSettings, ...patch };
}

/**
 * Get the default settings for a game.
 */
export function getDefaultSettings(gameId: GameId): Record<string, unknown> {
  const adapter = requireAdapter(gameId);
  return { ...adapter.defaultSettings };
}

// =============================================================================
// Spectator View
// =============================================================================

/**
 * Filter public state for spectator display.
 */
export function getSpectatorView(
  gameId: GameId,
  publicState: Record<string, unknown>,
): Record<string, unknown> {
  const adapter = requireAdapter(gameId);

  if (adapter.getSpectatorView) {
    return adapter.getSpectatorView(publicState);
  }

  return publicState;
}
