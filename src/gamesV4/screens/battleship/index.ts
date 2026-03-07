/**
 * Battleship UI Components — Barrel Export
 *
 * @module gamesV4/screens/battleship
 */

export { BS, useBattleshipTheme } from "./battleshipTheme";
export type { BattleshipTokens } from "./battleshipTheme";
export { BattleshipGrid, BoardCard } from "./BoardCard";
export type {
  BattleshipGridProps,
  BoardCardProps,
  CellStatus,
  GridCellData,
} from "./BoardCard";
export {
  HitMarker,
  MissMarker,
  SelectedMarker,
  SunkMarker,
} from "./CellMarkers";
export { EventRibbon } from "./EventRibbon";
export type { BattleLogEntry, EventRibbonProps } from "./EventRibbon";
export { GameHeader, PhaseChip } from "./GameHeader";
export type { BattlePhaseId, GameHeaderProps } from "./GameHeader";
export { FleetStatus, ShipCarousel, StatBadge } from "./ShipCarousel";
export { useBattleshipFeedback } from "./useBattleshipFeedback";
