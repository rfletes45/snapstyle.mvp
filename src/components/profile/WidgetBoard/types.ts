/**
 * Widget Board Types
 *
 * Core type definitions for the profile widget board system.
 * Defines widget sizes, layout models, registry types, and persistence schemas.
 *
 * @module components/profile/WidgetBoard/types
 */

// =============================================================================
// Schema Version
// =============================================================================

/** Current layout schema version — bump on breaking changes. */
export const LAYOUT_SCHEMA_VERSION = 1;

// =============================================================================
// Grid Constants
// =============================================================================

/** Number of columns in the widget grid (phone portrait). */
export const GRID_COLUMNS = 4;

/** Gutter size between widgets in pixels. */
export const GRID_GUTTER = 8;

/** Base cell height in pixels. Widgets' pixel height = rows × CELL_HEIGHT. */
export const CELL_HEIGHT = 88;

// =============================================================================
// Widget Size Presets
// =============================================================================

/**
 * Named size keys. Each maps to a (columns × rows) grid span.
 *
 * - small:  2 × 1
 * - medium: 2 × 2
 * - wide:   4 × 1
 * - large:  4 × 2
 * - hero:   4 × 4  (profile header only)
 */
export type WidgetSizeKey = "small" | "medium" | "wide" | "large" | "hero";

export interface WidgetSpan {
  /** Columns occupied (1-4). */
  w: number;
  /** Rows occupied (1+). */
  h: number;
}

export const SIZE_PRESETS: Record<WidgetSizeKey, WidgetSpan> = {
  small: { w: 2, h: 1 },
  medium: { w: 2, h: 2 },
  wide: { w: 4, h: 1 },
  large: { w: 4, h: 2 },
  hero: { w: 4, h: 4 },
} as const;

// =============================================================================
// Widget Type Registry
// =============================================================================

/**
 * Known widget type identifiers.
 * New widget types are added here, keeping the union exhaustive.
 */
export type WidgetTypeId =
  | "profile-header"
  | "social-proof"
  | "friends"
  | "badges"
  | "achievements"
  | "mutual-friends"
  | "favorite-game"
  | "profile-stats"
  | "recent-activity"
  | "viewer-actions"
  | "tasks-overview"
  | "wallet-balance"
  | "theme-mode"
  | "chat-layout-mode";

/** Metadata that every widget type must declare. */
export interface WidgetTypeDefinition {
  widgetType: WidgetTypeId;
  displayName: string;
  description: string;
  icon: string;
  /** Category for gallery grouping. */
  category: "profile" | "social" | "gaming" | "activity" | "appearance";
  defaultSize: WidgetSizeKey;
  supportedSizes: WidgetSizeKey[];
  minSize: WidgetSizeKey;
  maxSize: WidgetSizeKey;
  canRemove: boolean;
  canResize: boolean;
  canConfigure: boolean;
  /** Hint for auto-placement when adding to the board. */
  defaultPlacementHint?: "top" | "middle" | "bottom";
  /** Maximum number of instances allowed (default 1). */
  maxInstances?: number;
  /** Visibility scope: "all" shows on owner + viewer; "owner-only" hides for viewers. */
  visibilityMode?: "all" | "owner-only";
  /** When true, interactive controls (toggles, navigation) are disabled for viewers. */
  interactiveForOwnerOnly?: boolean;
}

// =============================================================================
// Widget Instance (Persisted)
// =============================================================================

/** Configuration payload — each widget type can narrow this. */
export type WidgetConfig = Record<string, unknown>;

/** A single widget instance stored per user. */
export interface WidgetInstance {
  /** Unique instance identifier. */
  instanceId: string;
  /** Which widget type. */
  widgetType: WidgetTypeId;
  /** Current size key. */
  size: WidgetSizeKey;
  /** Grid position: column (0-based). */
  x: number;
  /** Grid position: row (0-based). */
  y: number;
  /** Whether this widget is visible on the board. */
  visible: boolean;
  /** Whether this widget is locked (non-removable, always visible). */
  pinned: boolean;
  /** Type-specific configuration. */
  config: WidgetConfig;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** ISO timestamp of last update. */
  updatedAt: string;
}

// =============================================================================
// Persisted Layout
// =============================================================================

/** Root persistence object stored per user. */
export interface PersistedBoardLayout {
  /** Schema version for migration safety. */
  schemaVersion: number;
  /** Ordered list of widget instances. */
  widgets: WidgetInstance[];
  /** ISO timestamp of last save. */
  updatedAt: string;
}

// =============================================================================
// Transient Board State (Runtime Only)
// =============================================================================

/** Computed grid cell occupancy — used by the layout engine. */
export interface OccupancyCell {
  /** Instance ID occupying this cell, or null if empty. */
  instanceId: string | null;
}

/** Describes a rectangular region on the grid. */
export interface GridRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Result of a placement query. */
export interface PlacementResult {
  valid: boolean;
  rect: GridRect;
  /** IDs of widgets that need to shift to make room. */
  displaced: string[];
}

/** Drag gesture transient state. */
export interface DragState {
  /** ID of widget being dragged, or null. */
  activeId: string | null;
  /** Current finger offset from widget origin (pixels). */
  offsetX: number;
  offsetY: number;
  /** Nearest valid slot while hovering. */
  hoverSlot: { x: number; y: number } | null;
}

/** Resize transient state. */
export interface ResizeState {
  /** ID of widget being resized, or null. */
  activeId: string | null;
  /** Candidate size key. */
  candidateSize: WidgetSizeKey | null;
}

/** Top-level customize mode status. */
export type BoardMode = "view" | "customize";
