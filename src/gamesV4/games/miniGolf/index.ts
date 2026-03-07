/**
 * Mini Golf — Barrel Export
 *
 * Re-exports the core shared modules for use by adapter and UI.
 *
 * @module gamesV4/games/miniGolf
 */

export {
  PIGEON_CLASSIC,
  getCoursePack,
  getTotalPar,
} from "./courses/pigeonClassic";
export { useRollingPlayback } from "./hooks/useRollingPlayback";
export { simulateShot, simulateShotPositions } from "./physics/sim";
export * from "./types";
export * from "./utils/quantize";
