/**
 * Physics utilities compatibility exports.
 *
 * Pool physics moved to `src/services/games/poolEngine.ts`.
 */

export {
  canPlaceCueBall,
  createInitialBalls,
  createTable as createStandardTable,
  placeCueBall,
  simulateShot,
  type PoolBall as Ball,
  type ShotParams as Shot,
  type TableConfig as PoolTable,
} from "@/services/games/poolEngine";
