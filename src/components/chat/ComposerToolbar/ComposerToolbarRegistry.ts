/**
 * Composer Toolbar Registry
 *
 * Central registry of all known toolbar item types for the chat composer.
 * Each type declares its metadata, behavior constraints, and display properties.
 *
 * Modeled after the WidgetBoard's WidgetRegistry pattern.
 *
 * @module components/chat/ComposerToolbar/ComposerToolbarRegistry
 */

import type { ComposerToolbarItemId, ToolbarItemDefinition } from "./types";

// =============================================================================
// Item Definitions
// =============================================================================

const TOOLBAR_ITEM_DEFINITIONS: ToolbarItemDefinition[] = [
  {
    itemId: "message-bar",
    displayName: "Message Bar",
    description: "Text input with voice recording. Always present.",
    icon: "message-text-outline",
    category: "core",
    canRemove: false,
    canResize: true,
    maxInstances: 1,
    defaultPosition: 1,
    available: true,
  },
  {
    itemId: "camera",
    displayName: "Camera",
    description: "Tap for camera, hold for photo gallery.",
    icon: "camera",
    category: "media",
    canRemove: true,
    canResize: false,
    maxInstances: 1,
    defaultPosition: 0,
    available: true,
  },
  {
    itemId: "game",
    displayName: "Games",
    description: "Open the game picker to start a game.",
    icon: "gamepad-variant-outline",
    category: "actions",
    canRemove: true,
    canResize: false,
    maxInstances: 1,
    defaultPosition: 2,
    available: true,
  },
  {
    itemId: "animal",
    displayName: "Animal",
    description: "Send your equipped animal or pick a new one.",
    icon: "paw",
    category: "actions",
    canRemove: true,
    canResize: false,
    maxInstances: 1,
    defaultPosition: 3,
    available: true,
  },
  {
    itemId: "send",
    displayName: "Send Button",
    description: "Dedicated send button for sending messages.",
    icon: "send",
    category: "core",
    canRemove: true,
    canResize: false,
    maxInstances: 1,
    defaultPosition: 4,
    available: true,
  },
  {
    itemId: "emoji",
    displayName: "Emoji",
    description: "Open the emoji picker to insert an emoji.",
    icon: "emoticon-happy-outline",
    category: "actions",
    canRemove: true,
    canResize: false,
    maxInstances: 1,
    defaultPosition: 4,
    available: true,
  },
  {
    itemId: "schedule",
    displayName: "Schedule",
    description: "Schedule a message to send later.",
    icon: "clock-outline",
    category: "actions",
    canRemove: true,
    canResize: false,
    maxInstances: 1,
    defaultPosition: 4,
    available: true,
  },
  {
    itemId: "gif",
    displayName: "GIF",
    description: "Search and send animated GIFs powered by KLIPY.",
    icon: "file-gif-box",
    category: "media",
    canRemove: true,
    canResize: false,
    maxInstances: 1,
    defaultPosition: 5,
    available: true,
  },
  {
    itemId: "sticker",
    displayName: "Stickers",
    description: "Browse and send sticker packs.",
    icon: "sticker-emoji",
    category: "media",
    canRemove: true,
    canResize: false,
    maxInstances: 1,
    defaultPosition: 5,
    available: true,
  },
  {
    itemId: "gif-sticker",
    displayName: "GIFs & Stickers",
    description: "Combined GIF and sticker picker in one modal.",
    icon: "image-multiple",
    category: "media",
    canRemove: true,
    canResize: false,
    maxInstances: 1,
    defaultPosition: 5,
    available: true,
  },
  {
    itemId: "image-picker",
    displayName: "Photos",
    description: "Pick and send photos from your library.",
    icon: "image-outline",
    category: "media",
    canRemove: true,
    canResize: false,
    maxInstances: 1,
    defaultPosition: 5,
    available: true,
  },
];

// =============================================================================
// Lookup Helpers
// =============================================================================

/** Map for O(1) lookup by item ID. */
const DEFINITION_MAP = new Map<ComposerToolbarItemId, ToolbarItemDefinition>(
  TOOLBAR_ITEM_DEFINITIONS.map((d) => [d.itemId, d]),
);

/** Get all toolbar item definitions. */
export function getAllToolbarItemDefinitions(): ToolbarItemDefinition[] {
  return TOOLBAR_ITEM_DEFINITIONS;
}

/** Get all available (non-coming-soon) toolbar item definitions. */
export function getAvailableToolbarItemDefinitions(): ToolbarItemDefinition[] {
  return TOOLBAR_ITEM_DEFINITIONS.filter((d) => d.available);
}

/** Get a single toolbar item definition by ID. Returns undefined if unknown. */
export function getToolbarItemDefinition(
  itemId: ComposerToolbarItemId,
): ToolbarItemDefinition | undefined {
  return DEFINITION_MAP.get(itemId);
}

/** Category display metadata for the picker. */
export const TOOLBAR_CATEGORY_META: Record<
  string,
  { label: string; icon: string }
> = {
  core: { label: "Core", icon: "message-text-outline" },
  actions: { label: "Actions", icon: "lightning-bolt-outline" },
  media: { label: "Media", icon: "image-outline" },
  extras: { label: "Extras", icon: "puzzle-outline" },
};

/** Ordered categories for the picker. */
export const TOOLBAR_CATEGORY_ORDER = [
  "core",
  "actions",
  "media",
  "extras",
] as const;
