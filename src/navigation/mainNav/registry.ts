import { GAMES_V4_ENABLED } from "@/constants/featureFlags";

import type {
  MainNavFeatureFlag,
  MainNavItem,
  MainNavItemDefinition,
  MainNavItemId,
  MainNavLayout,
  MainNavTabRouteName,
} from "./types";
import {
  MAIN_NAV_SCHEMA_VERSION,
  MAX_MAIN_NAV_ITEMS,
  MIN_MAIN_NAV_ITEMS,
} from "./types";

const FEATURE_FLAGS: Record<MainNavFeatureFlag, boolean> = {
  gamesV4: GAMES_V4_ENABLED,
};

const MAIN_NAV_ITEM_DEFINITIONS: MainNavItemDefinition[] = [
  {
    itemId: "messages",
    label: "Messages",
    icon: "message-outline",
    routeName: "Messages",
    isCore: true,
    canRemove: false,
    canReorder: true,
    eligible: true,
    defaultEnabled: true,
    defaultPosition: 0,
    badgeKey: "messages",
  },
  {
    itemId: "calls",
    label: "Calls",
    icon: "phone-outline",
    routeName: "Calls",
    isCore: true,
    canRemove: false,
    canReorder: true,
    eligible: true,
    defaultEnabled: true,
    defaultPosition: 1,
  },
  {
    itemId: "profile",
    label: "Profile",
    icon: "account-circle-outline",
    routeName: "Profile",
    isCore: true,
    canRemove: false,
    canReorder: true,
    eligible: true,
    defaultEnabled: true,
    defaultPosition: 2,
  },
  {
    itemId: "shop",
    label: "Shop",
    icon: "store-outline",
    routeName: "ShopRoot",
    isCore: false,
    canRemove: true,
    canReorder: true,
    eligible: true,
    defaultEnabled: false,
    defaultPosition: 3,
  },
  {
    itemId: "games",
    label: "Games",
    icon: "gamepad-variant-outline",
    routeName: "GamesRoot",
    isCore: false,
    canRemove: true,
    canReorder: true,
    eligible: true,
    defaultEnabled: false,
    defaultPosition: 4,
    featureFlag: "gamesV4",
    disabledReason: "Games are unavailable in this build.",
  },
  {
    itemId: "customize",
    label: "Customize",
    icon: "palette-outline",
    routeName: "CustomizeRoot",
    isCore: false,
    canRemove: true,
    canReorder: true,
    eligible: true,
    defaultEnabled: false,
    defaultPosition: 5,
  },
];

const DEFINITION_MAP = new Map<MainNavItemId, MainNavItemDefinition>(
  MAIN_NAV_ITEM_DEFINITIONS.map((definition) => [
    definition.itemId,
    definition,
  ]),
);

const ROUTE_DEFINITION_MAP = new Map<
  MainNavTabRouteName,
  MainNavItemDefinition
>(
  MAIN_NAV_ITEM_DEFINITIONS.map((definition) => [
    definition.routeName,
    definition,
  ]),
);

export function isMainNavItemAvailable(
  definition: MainNavItemDefinition,
): boolean {
  if (!definition.eligible) return false;
  if (!definition.featureFlag) return true;
  return FEATURE_FLAGS[definition.featureFlag];
}

export function getAllMainNavItemDefinitions(): MainNavItemDefinition[] {
  return MAIN_NAV_ITEM_DEFINITIONS;
}

export function getAvailableMainNavItemDefinitions(): MainNavItemDefinition[] {
  return MAIN_NAV_ITEM_DEFINITIONS.filter(isMainNavItemAvailable);
}

export function getMainNavItemDefinition(
  itemId: MainNavItemId,
): MainNavItemDefinition | undefined {
  return DEFINITION_MAP.get(itemId);
}

export function getMainNavItemDefinitionByRouteName(
  routeName: MainNavTabRouteName,
): MainNavItemDefinition | undefined {
  return ROUTE_DEFINITION_MAP.get(routeName);
}

export function getDefaultMainNavItems(): MainNavItem[] {
  return getAvailableMainNavItemDefinitions()
    .filter((definition) => definition.defaultEnabled)
    .sort((a, b) => a.defaultPosition - b.defaultPosition)
    .map((definition, position) => ({
      id: definition.itemId,
      position,
    }));
}

export function normalizeMainNavItems(items: MainNavItem[]): MainNavItem[] {
  return [...items]
    .sort((a, b) => a.position - b.position)
    .map((item, position) => ({ ...item, position }));
}

function isKnownMainNavItemId(value: unknown): value is MainNavItemId {
  return (
    typeof value === "string" && DEFINITION_MAP.has(value as MainNavItemId)
  );
}

function coercePersistedItems(items: unknown[]): MainNavItem[] {
  const availableIds = new Set(
    getAvailableMainNavItemDefinitions().map((definition) => definition.itemId),
  );
  const seenIds = new Set<MainNavItemId>();
  const validItems: MainNavItem[] = [];

  items.forEach((value, index) => {
    if (!value || typeof value !== "object") return;
    const candidate = value as Partial<MainNavItem>;
    if (!isKnownMainNavItemId(candidate.id)) return;
    if (!availableIds.has(candidate.id)) return;
    if (seenIds.has(candidate.id)) return;

    seenIds.add(candidate.id);
    validItems.push({
      id: candidate.id,
      position:
        typeof candidate.position === "number" ? candidate.position : index,
    });
  });

  return validItems;
}

function restoreRequiredDefaults(items: MainNavItem[]): MainNavItem[] {
  const next = [...items];
  const seenIds = new Set(next.map((item) => item.id));
  const requiredDefinitions = getAvailableMainNavItemDefinitions()
    .filter((definition) => definition.isCore || definition.defaultEnabled)
    .sort((a, b) => a.defaultPosition - b.defaultPosition);

  for (const definition of requiredDefinitions) {
    if (seenIds.has(definition.itemId)) continue;
    seenIds.add(definition.itemId);
    next.push({ id: definition.itemId, position: next.length });
  }

  return next;
}

function trimToMaximum(items: MainNavItem[]): MainNavItem[] {
  if (items.length <= MAX_MAIN_NAV_ITEMS) return items;

  const coreItems: MainNavItem[] = [];
  const optionalItems: MainNavItem[] = [];

  for (const item of items) {
    const definition = getMainNavItemDefinition(item.id);
    if (definition?.isCore) {
      coreItems.push(item);
    } else {
      optionalItems.push(item);
    }
  }

  return [...coreItems, ...optionalItems].slice(0, MAX_MAIN_NAV_ITEMS);
}

export function validateMainNavLayout(data: unknown): MainNavItem[] | null {
  if (!data || typeof data !== "object") return null;
  const layout = data as Partial<MainNavLayout>;

  if (typeof layout.schemaVersion !== "number") return null;
  if (layout.schemaVersion > MAIN_NAV_SCHEMA_VERSION) return null;
  if (!Array.isArray(layout.items)) return null;

  const validItems = normalizeMainNavItems(coercePersistedItems(layout.items));
  const withRequiredDefaults = restoreRequiredDefaults(validItems);

  if (withRequiredDefaults.length < MIN_MAIN_NAV_ITEMS) {
    return getDefaultMainNavItems();
  }

  const trimmedItems = trimToMaximum(withRequiredDefaults);
  return normalizeMainNavItems(trimmedItems);
}
