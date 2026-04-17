/**
 * Widget Registry
 *
 * Central registry of all known widget types.
 * Each type declares its metadata, supported sizes, and behavior flags.
 *
 * @module components/profile/WidgetBoard/WidgetRegistry
 */

import type { WidgetTypeDefinition, WidgetTypeId } from "./types";

// =============================================================================
// Type Definitions
// =============================================================================

const WIDGET_DEFINITIONS: WidgetTypeDefinition[] = [
  {
    widgetType: "profile-header",
    displayName: "Profile Header",
    description: "Your avatar, name, bio, and level progress",
    icon: "account-circle",
    category: "profile",
    defaultSize: "hero",
    supportedSizes: ["wide", "large", "hero", "mega"],
    minSize: "wide",
    maxSize: "mega",
    canRemove: false,
    canResize: true,
    canConfigure: false,
    defaultPlacementHint: "top",
    maxInstances: 1,
  },
  {
    widgetType: "social-proof",
    displayName: "Social Proof",
    description: "Streak summary and recent activity",
    icon: "fire",
    category: "activity",
    defaultSize: "wide",
    supportedSizes: ["wide", "large"],
    minSize: "wide",
    maxSize: "large",
    canRemove: true,
    canResize: true,
    canConfigure: true,
    defaultPlacementHint: "middle",
    maxInstances: 1,
  },
  {
    widgetType: "friends",
    displayName: "Friends",
    description: "Your friend count and friend list",
    icon: "account-group",
    category: "social",
    defaultSize: "medium",
    supportedSizes: ["small", "medium", "wide"],
    minSize: "small",
    maxSize: "wide",
    canRemove: true,
    canResize: true,
    canConfigure: false,
    defaultPlacementHint: "bottom",
    maxInstances: 1,
  },
  {
    widgetType: "badges",
    displayName: "Badges",
    description: "Your featured badges collection",
    icon: "shield-star",
    category: "gaming",
    defaultSize: "medium",
    supportedSizes: ["small", "medium", "wide"],
    minSize: "small",
    maxSize: "wide",
    canRemove: true,
    canResize: true,
    canConfigure: false,
    defaultPlacementHint: "bottom",
    maxInstances: 1,
  },
  {
    widgetType: "achievements",
    displayName: "Achievements",
    description: "Your trophy case and game achievements",
    icon: "trophy",
    category: "gaming",
    defaultSize: "medium",
    supportedSizes: ["small", "medium", "wide"],
    minSize: "small",
    maxSize: "wide",
    canRemove: true,
    canResize: true,
    canConfigure: false,
    defaultPlacementHint: "bottom",
    maxInstances: 1,
  },
  {
    widgetType: "mutual-friends",
    displayName: "Mutual Friends",
    description: "Friends you have in common",
    icon: "account-multiple-check",
    category: "social",
    defaultSize: "medium",
    supportedSizes: ["small", "medium", "wide"],
    minSize: "small",
    maxSize: "wide",
    canRemove: true,
    canResize: true,
    canConfigure: false,
    defaultPlacementHint: "bottom",
    maxInstances: 1,
  },
  {
    widgetType: "favorite-game",
    displayName: "Favorite Game",
    description: "Show off your current favorite game",
    icon: "gamepad-variant",
    category: "gaming",
    defaultSize: "medium",
    supportedSizes: ["small", "medium", "wide"],
    minSize: "small",
    maxSize: "wide",
    canRemove: true,
    canResize: true,
    canConfigure: true,
    defaultPlacementHint: "middle",
    maxInstances: 1,
  },
  {
    widgetType: "profile-stats",
    displayName: "Profile Stats",
    description: "Games played, wins, and play time",
    icon: "chart-bar",
    category: "gaming",
    defaultSize: "wide",
    supportedSizes: ["medium", "wide"],
    minSize: "medium",
    maxSize: "wide",
    canRemove: true,
    canResize: true,
    canConfigure: false,
    defaultPlacementHint: "middle",
    maxInstances: 1,
  },
  {
    widgetType: "recent-activity",
    displayName: "Recent Activity",
    description: "Your latest games and social activity",
    icon: "history",
    category: "activity",
    defaultSize: "wide",
    supportedSizes: ["wide", "large"],
    minSize: "wide",
    maxSize: "large",
    canRemove: true,
    canResize: true,
    canConfigure: false,
    defaultPlacementHint: "bottom",
    maxInstances: 1,
  },
  {
    widgetType: "viewer-actions",
    displayName: "Viewer Actions",
    description: "Friendship info, last active, and action buttons",
    icon: "account-details",
    category: "social",
    defaultSize: "wide",
    supportedSizes: ["wide", "large"],
    minSize: "wide",
    maxSize: "large",
    canRemove: false,
    canResize: false,
    canConfigure: false,
    defaultPlacementHint: "bottom",
    maxInstances: 1,
  },
  // ── New Widgets ───────────────────────────────────────────────────────
  {
    widgetType: "tasks-overview",
    displayName: "Tasks",
    description: "Daily & monthly task progress at a glance",
    icon: "checkbox-marked-circle-outline",
    category: "activity",
    defaultSize: "wide",
    supportedSizes: ["wide", "large"],
    minSize: "wide",
    maxSize: "large",
    canRemove: true,
    canResize: true,
    canConfigure: false,
    defaultPlacementHint: "middle",
    maxInstances: 1,
    visibilityMode: "owner-only",
    interactiveForOwnerOnly: true,
  },
  {
    widgetType: "wallet-balance",
    displayName: "Wallet",
    description: "Your token balance and quick wallet access",
    icon: "wallet-outline",
    category: "profile",
    defaultSize: "small",
    supportedSizes: ["small", "medium", "wide"],
    minSize: "small",
    maxSize: "wide",
    canRemove: true,
    canResize: true,
    canConfigure: false,
    defaultPlacementHint: "middle",
    maxInstances: 1,
    visibilityMode: "owner-only",
    interactiveForOwnerOnly: true,
  },
  {
    widgetType: "theme-mode",
    displayName: "Theme Mode",
    description: "Switch between Light, Dark, and Auto appearance",
    icon: "brightness-6",
    category: "appearance",
    defaultSize: "small",
    supportedSizes: ["small", "wide"],
    minSize: "small",
    maxSize: "wide",
    canRemove: true,
    canResize: true,
    canConfigure: false,
    defaultPlacementHint: "bottom",
    maxInstances: 1,
    visibilityMode: "owner-only",
    interactiveForOwnerOnly: true,
  },
  {
    widgetType: "chat-layout-mode",
    displayName: "Chat Layout",
    description: "Switch between Bubbles and Stacked chat styles",
    icon: "message-text-outline",
    category: "appearance",
    defaultSize: "small",
    supportedSizes: ["small", "wide"],
    minSize: "small",
    maxSize: "wide",
    canRemove: true,
    canResize: true,
    canConfigure: false,
    defaultPlacementHint: "bottom",
    maxInstances: 1,
    visibilityMode: "owner-only",
    interactiveForOwnerOnly: true,
  },
];

// =============================================================================
// Registry Map
// =============================================================================

const REGISTRY_MAP = new Map<WidgetTypeId, WidgetTypeDefinition>(
  WIDGET_DEFINITIONS.map((d) => [d.widgetType, d]),
);

// =============================================================================
// Public API
// =============================================================================

/** Get the definition for a specific widget type. */
export function getWidgetDefinition(
  typeId: WidgetTypeId,
): WidgetTypeDefinition | undefined {
  return REGISTRY_MAP.get(typeId);
}

/** Get all registered widget type definitions. */
export function getAllWidgetDefinitions(): WidgetTypeDefinition[] {
  return WIDGET_DEFINITIONS;
}

/** Get all widget types that are not currently on a board. */
export function getAvailableWidgetTypes(
  placedTypes: WidgetTypeId[],
): WidgetTypeDefinition[] {
  return WIDGET_DEFINITIONS.filter((d) => {
    const max = d.maxInstances ?? 1;
    const count = placedTypes.filter((t) => t === d.widgetType).length;
    return count < max;
  });
}

/** Check whether a size key is valid for a given widget type. */
export function isValidSize(typeId: WidgetTypeId, sizeKey: string): boolean {
  const def = REGISTRY_MAP.get(typeId);
  if (!def) return false;
  return def.supportedSizes.includes(sizeKey as any);
}
