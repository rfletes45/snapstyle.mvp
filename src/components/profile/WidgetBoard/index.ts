/**
 * Widget Board — Public API
 *
 * Re-exports the primary components and hooks used by profile screens.
 *
 * @module components/profile/WidgetBoard
 */

export type {
  BoardMode,
  WidgetInstance,
  WidgetSizeKey,
  WidgetTypeId,
} from "./types";
export type { UseBoardPersistenceOptions } from "./useBoardPersistence";
export { useBoardState } from "./useBoardState";
export type { BoardState, BoardStateActions } from "./useBoardState";
export { WidgetBoardContainer } from "./WidgetBoardContainer";
export { getAllWidgetDefinitions, getWidgetDefinition } from "./WidgetRegistry";
