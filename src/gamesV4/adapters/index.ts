/**
 * Games V4 — Adapters Barrel Export
 *
 * Importing this module registers all pilot adapters and re-exports
 * the registry and game runner utilities.
 *
 * Usage:
 *   import { getAdapter, runMove } from "@/gamesV4/adapters";
 *
 * @module gamesV4/adapters/index
 */

// Registry + runner
export {
  getAdapter,
  getRegisteredGameIds,
  hasAdapter,
  registerAdapter,
  requireAdapter,
} from "./registry";

export {
  computeOutcome,
  createInitialState,
  extractPerformanceMetrics,
  getDefaultSettings,
  getSpectatorView,
  runMove,
  validateSettings,
} from "./gameRunner";

export type {
  InitialStateResult,
  RunMoveInput,
  RunMoveResult,
} from "./gameRunner";

// Registered adapters — import triggers auto-registration
import "./battleship";
import "./brickBreaker";
import "./chess";
import "./connectFour";
import "./crazyEights";
import "./deadDrop";
import "./dotsAndBoxes";
import "./hex";
import "./knockout";
import "./metroMagnate";
import "./minesweeper";
import "./minigolf";
import "./play2048";
import "./pong";
import "./reversi";
import "./sketchParty";
import "./solitaireKlondike";
import "./ticTacToe";
