import type { GraphicsQuality, Rarity, RodSource, ZoneId } from "../game/types";

export interface HudViewModel {
  gold: number;
  inventoryCount: number;
  inventoryCapacity: number;
  equippedRodName: string;
  equippedRodLuck: number;
  equippedRodSturdiness: number;
  equippedBaitName: string;
  equippedBaitQuantity: number;
  partyBonusPercent: number;
  zoneBonusActive: boolean;
  zoneBonusPercent: number;
}

export interface FishInventoryItemViewModel {
  fishId: string;
  name: string;
  zoneId: ZoneId;
  rarity: Rarity;
  count: number;
  sellPrice: number;
  lastCaughtAt: number;
}

export type InventorySortMode = "rarity_desc" | "sell_desc" | "zone" | "newest";

export type InventoryFilterMode = "all" | ZoneId | "rare_plus";

export interface RodViewModel {
  id: string;
  name: string;
  luck: number;
  sturdiness: number;
  price: number;
  source: RodSource;
  owned: boolean;
  phaseLocked: boolean;
  zoneBonusPercent: number;
  zoneBonusZoneId: ZoneId | null;
  zoneBonusActive: boolean;
}

export interface BaitViewModel {
  id: string;
  name: string;
  luckMultiplier: number;
  price: number;
  quantity: number;
  purchasable: boolean;
  phaseLocked: boolean;
}

export interface UpgradeViewModel {
  level: number;
  capacity: number;
  cost: number;
  status: "owned" | "available" | "locked";
}

export interface BestiaryEntryViewModel {
  fishId: string;
  name: string;
  rarity: Rarity;
  discovered: boolean;
  caughtCount: number;
}

export interface ZoneBestiaryViewModel {
  zoneId: ZoneId;
  zoneName: string;
  entries: BestiaryEntryViewModel[];
  discoveredUnique: number;
  total: number;
  percent: number;
}

export interface VolcanoChecklistViewModel {
  beachUnique: number;
  riverUnique: number;
  required: number;
  unlocked: boolean;
}

export interface OasisChecklistViewModel {
  beachUnique: number;
  riverUnique: number;
  caveUnique: number;
  volcanoUnique: number;
  required: number;
  unlocked: boolean;
}

export interface OasisRelicProgressViewModel {
  beach: boolean;
  river: boolean;
  cave: boolean;
}

export interface GatePanelRequirementViewModel {
  label: string;
  current: number;
  required: number;
  met: boolean;
}

export interface GatePanelViewModel {
  title: string;
  description: string;
  unlocked: boolean;
  requirements: GatePanelRequirementViewModel[];
  footer?: string;
}

export interface OnlineStatusViewModel {
  connected: boolean;
  roomId: string | null;
  playerCount: number;
  playerCap: number;
  partyBonusPercent: number;
}

export interface QuestViewModel {
  id: string;
  title: string;
  description: string;
  hint: string;
  progressText: string;
  status: "available" | "active" | "claimable" | "completed";
  rewardText: string;
}

export interface SettingsViewModel {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  muted: boolean;
  graphicsQuality: GraphicsQuality;
  showDiagnostics: boolean;
  meshAuditEnabled: boolean;
  decayGraceEnabled: boolean;
}
