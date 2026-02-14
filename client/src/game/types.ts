export type ZoneId = "beach" | "river" | "cave" | "volcano" | "oasis";

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "mythic";

export type RodSource = "starter" | "shop" | "zone_pickup" | "challenge_reward";

export interface RodZonePassive {
  type: "zoneLuck";
  zoneId: ZoneId;
  zoneLuckBonusMult: number;
}

export interface FishDefinition {
  id: string;
  name: string;
  zone: ZoneId;
  rarity: Rarity;
  sellPrice: number;
  catchTimeSeconds: number;
  targetWidth: number;
  targetBaseSpeed: number;
  targetErraticness: number;
  encounterWeight: number;
  flavor: string;
}

export interface RodDefinition {
  id: string;
  name: string;
  luck: number;
  sturdiness: number;
  price: number;
  source: RodSource;
  ownedByDefault?: boolean;
  phaseLocked?: boolean;
  zonePassive?: RodZonePassive;
}

export interface BaitDefinition {
  id: string;
  name: string;
  luckMultiplier: number;
  zoneRestriction?: ZoneId;
  price: number;
  ownedByDefault?: number;
  purchasable: boolean;
  phaseLocked?: boolean;
}

export interface RarityWeights {
  common: number;
  uncommon: number;
  rare: number;
  epic: number;
  mythic: number;
}

export interface BestiaryEntry {
  discovered: boolean;
  caughtCount: number;
  lastCaughtAt?: number;
}

export interface PickupsState {
  beachZoneRod: boolean;
  riverZoneRod: boolean;
  caveZoneRod: boolean;
  volcanoZoneRod: boolean;
  oasisZoneRod: boolean;
}

export interface ChallengeCompletionState {
  beach: boolean;
  river: boolean;
  cave: boolean;
  volcano: boolean;
  oasis: boolean;
}

export interface OasisRelicsState {
  beach: boolean;
  river: boolean;
  cave: boolean;
}

export interface QuestProgressState {
  activeQuestId: string | null;
  completedQuestIds: string[];
}

export type GraphicsQuality = "low" | "medium" | "high";

export interface UserSettingsState {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  muted: boolean;
  graphicsQuality: GraphicsQuality;
  showDiagnostics: boolean;
  meshAuditEnabled: boolean;
  decayGraceEnabled: boolean;
}

export interface SaveData {
  version: number;
  gold: number;
  inventoryCapacityLevel: number;
  fishInventory: Record<string, number>;
  bestiary: Record<string, BestiaryEntry>;
  ownedRods: string[];
  equippedRodId: string;
  baitOwned: Record<string, number>;
  equippedBaitType: string;
  pickups: PickupsState;
  challengeCompleted: ChallengeCompletionState;
  oasisRelics: OasisRelicsState;
  quests: QuestProgressState;
  settings: UserSettingsState;
}

export type QuestType = "catch_count" | "rarity_catch" | "discovery_count";

export interface CatchRequirement {
  zoneId: ZoneId;
  rarityMin: Rarity;
  count: number;
}

export interface DiscoveryRequirement {
  zoneId: ZoneId;
  discoveredCount: number;
}

export interface QuestReward {
  goldAmount?: number;
  baitPack?: {
    baitType: string;
    quantity: number;
  };
}

interface BaseQuestDefinition {
  id: string;
  title: string;
  description: string;
  reward: QuestReward;
  hint: string;
}

export interface CatchCountQuestDefinition extends BaseQuestDefinition {
  type: "catch_count";
  requirement: CatchRequirement;
}

export interface RarityCatchQuestDefinition extends BaseQuestDefinition {
  type: "rarity_catch";
  requirement: CatchRequirement;
}

export interface DiscoveryCountQuestDefinition extends BaseQuestDefinition {
  type: "discovery_count";
  requirement: DiscoveryRequirement;
}

export type QuestDefinition =
  | CatchCountQuestDefinition
  | RarityCatchQuestDefinition
  | DiscoveryCountQuestDefinition;

export type FishingState =
  | "idle"
  | "ready"
  | "casting"
  | "waiting_for_bite"
  | "hooked"
  | "minigame"
  | "result_success"
  | "result_fail";

export interface MinigameSnapshot {
  fish: FishDefinition;
  progress: number;
  userBarX: number;
  userBarWidth: number;
  targetX: number;
  targetWidth: number;
  holdActive: boolean;
  overlap: boolean;
  timeLeftSeconds: number;
}

export interface FishingSnapshot {
  state: FishingState;
  biteInSeconds: number;
  currentFish: FishDefinition | null;
  minigame: MinigameSnapshot | null;
  failureReason: string | null;
  lastResultWasSuccess: boolean;
}
