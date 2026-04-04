/**
 * Composer Toolbar Types
 *
 * Core type definitions for the customizable chat composer toolbar.
 * Defines toolbar item identifiers, layout models, and persistence schemas.
 *
 * @module components/chat/ComposerToolbar/types
 */

// =============================================================================
// Schema Version
// =============================================================================

/** Current toolbar layout schema version — bump on breaking changes. */
export const TOOLBAR_SCHEMA_VERSION = 1;

// =============================================================================
// Toolbar Item Identifiers
// =============================================================================

/**
 * Known toolbar item identifiers.
 *
 * - `message-bar`: The text input + voice button. Always present, cannot be removed.
 *   Supports horizontal resizing (flex weight).
 * - `camera`: Camera (tap) + gallery (long press) dual-mode button.
 * - `game`: Opens the game picker modal.
 * - `animal`: Sends equipped animal / opens animal picker on long press.
 * - `send`: Dedicated send button (arrow-up icon). Shows when text present.
 * - `emoji`: Opens emoji keyboard for inserting emoji into text input.
 * - `schedule`: Schedule message button (clock icon, DM only).
 * - `gif`: GIF picker button (future).
 * - `sticker`: Sticker picker button (future).
 */
export type ComposerToolbarItemId =
  | "message-bar"
  | "camera"
  | "game"
  | "animal"
  | "send"
  | "emoji"
  | "schedule"
  | "gif"
  | "sticker";

// =============================================================================
// Toolbar Item Instance
// =============================================================================

/**
 * A single toolbar item in the user's layout.
 */
export interface ComposerToolbarItem {
  /** The item type identifier. */
  id: ComposerToolbarItemId;
  /** Zero-based position in the toolbar (left-to-right). */
  position: number;
  /**
   * Flex weight for the message bar (0.3–0.8).
   * Only meaningful for `id === "message-bar"`. Other items ignore this.
   * @default 1 (fills remaining space)
   */
  flexWeight?: number;
}

// =============================================================================
// Persisted Layout
// =============================================================================

/**
 * The full persisted toolbar layout document.
 */
export interface ComposerToolbarLayout {
  /** Schema version for forward-compatibility. */
  schemaVersion: number;
  /** Ordered list of toolbar items. */
  items: ComposerToolbarItem[];
}

// =============================================================================
// Toolbar Item Definition (Registry)
// =============================================================================

/** Categories for grouping items in the picker. */
export type ToolbarItemCategory = "core" | "actions" | "media" | "extras";

/**
 * Static metadata for a toolbar item type.
 * Defines its display properties and behavior constraints.
 */
export interface ToolbarItemDefinition {
  /** Unique identifier matching ComposerToolbarItemId. */
  itemId: ComposerToolbarItemId;
  /** Human-readable name shown in the picker. */
  displayName: string;
  /** Short description shown in the picker. */
  description: string;
  /** MaterialCommunityIcons icon name. */
  icon: string;
  /** Category for grouping in the picker. */
  category: ToolbarItemCategory;
  /** Whether this item can be removed from the toolbar. */
  canRemove: boolean;
  /** Whether this item supports horizontal resizing (message-bar only). */
  canResize: boolean;
  /** Maximum instances allowed in the toolbar. */
  maxInstances: number;
  /** Default position when first added to the toolbar. */
  defaultPosition: number;
  /** Whether this item is available (false = coming soon). */
  available: boolean;
}

// =============================================================================
// Constants
// =============================================================================

/** Maximum number of toolbar items allowed (prevents overflow). */
export const MAX_TOOLBAR_ITEMS = 6;

/** Minimum flex weight for the message bar. */
export const MIN_MESSAGE_BAR_FLEX = 0.3;

/** Maximum flex weight for the message bar. */
export const MAX_MESSAGE_BAR_FLEX = 0.8;

/** Default flex weight for the message bar. */
export const DEFAULT_MESSAGE_BAR_FLEX = 1;

/** Size of toolbar action buttons in pixels. */
export const TOOLBAR_BUTTON_SIZE = 40;

/** Duration in ms for long-press to enter edit mode. */
export const EDIT_MODE_LONG_PRESS_DURATION = 500;

// =============================================================================
// Default Layout
// =============================================================================

/**
 * The default toolbar layout matching the current hardcoded order:
 * [Camera] [MessageBar] [Game] [Animal]
 */
export const DEFAULT_TOOLBAR_ITEMS: ComposerToolbarItem[] = [
  { id: "camera", position: 0 },
  { id: "message-bar", position: 1 },
  { id: "game", position: 2 },
  { id: "animal", position: 3 },
];
