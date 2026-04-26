import type { AppTabsParamList } from "@/types/navigation/root";

export const MAIN_NAV_SCHEMA_VERSION = 1;

export type MainNavItemId =
  | "messages"
  | "calls"
  | "profile"
  | "shop"
  | "games"
  | "customize";

export type MainNavTabRouteName = keyof AppTabsParamList;

export type MainNavBadgeKey = "messages";

export type MainNavFeatureFlag = "gamesV4";

export interface MainNavItem {
  id: MainNavItemId;
  position: number;
}

export interface MainNavLayout {
  schemaVersion: number;
  items: MainNavItem[];
}

export interface MainNavItemDefinition {
  itemId: MainNavItemId;
  label: string;
  icon: string;
  routeName: MainNavTabRouteName;
  isCore: boolean;
  canRemove: boolean;
  canReorder: boolean;
  eligible: boolean;
  defaultEnabled: boolean;
  defaultPosition: number;
  featureFlag?: MainNavFeatureFlag;
  badgeKey?: MainNavBadgeKey;
  disabledReason?: string;
}

export const MIN_MAIN_NAV_ITEMS = 3;
export const MAX_MAIN_NAV_ITEMS = 6;
