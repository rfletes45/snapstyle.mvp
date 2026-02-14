import { BAIT_DEFINITIONS } from "../../data/baits";
import { ALL_FISH } from "../../data/fish";
import { ROD_DEFINITIONS } from "../../data/rods";
import type {
  BestiaryEntry,
  ChallengeCompletionState,
  GraphicsQuality,
  OasisRelicsState,
  PickupsState,
  QuestProgressState,
  SaveData,
  UserSettingsState
} from "../types";

export const SAVE_STORAGE_KEY = "tropical-island-fishing-save-v1";
export const SAVE_VERSION = 5;

const STARTING_GOLD = 180;

function requireDefined<T>(value: T | undefined, errorMessage: string): T {
  if (value === undefined) {
    throw new Error(errorMessage);
  }
  return value;
}

const STARTER_ROD = requireDefined(
  ROD_DEFINITIONS.find((rod) => rod.ownedByDefault),
  "Starter rod is required."
);
const STARTER_BAIT = requireDefined(
  BAIT_DEFINITIONS.find((bait) => (bait.ownedByDefault ?? 0) > 0),
  "Starter bait is required."
);

function createDefaultBestiary(): Record<string, BestiaryEntry> {
  return Object.fromEntries(
    ALL_FISH.map((fish) => [
      fish.id,
      {
        discovered: false,
        caughtCount: 0,
        lastCaughtAt: 0
      }
    ])
  );
}

function createDefaultBaitOwned(): Record<string, number> {
  return Object.fromEntries(BAIT_DEFINITIONS.map((bait) => [bait.id, bait.ownedByDefault ?? 0]));
}

function createDefaultPickups(): PickupsState {
  return {
    beachZoneRod: false,
    riverZoneRod: false,
    caveZoneRod: false,
    volcanoZoneRod: false,
    oasisZoneRod: false
  };
}

function createDefaultChallengeCompleted(): ChallengeCompletionState {
  return {
    beach: false,
    river: false,
    cave: false,
    volcano: false,
    oasis: false
  };
}

function createDefaultOasisRelics(): OasisRelicsState {
  return {
    beach: false,
    river: false,
    cave: false
  };
}

function createDefaultQuestState(): QuestProgressState {
  return {
    activeQuestId: null,
    completedQuestIds: []
  };
}

function createDefaultSettings(): UserSettingsState {
  return {
    masterVolume: 0.8,
    sfxVolume: 0.8,
    musicVolume: 0.55,
    muted: false,
    graphicsQuality: "medium",
    showDiagnostics: false,
    meshAuditEnabled: false,
    decayGraceEnabled: false
  };
}

export function createDefaultSaveData(): SaveData {
  return {
    version: SAVE_VERSION,
    gold: STARTING_GOLD,
    inventoryCapacityLevel: 0,
    fishInventory: {},
    bestiary: createDefaultBestiary(),
    ownedRods: [STARTER_ROD.id],
    equippedRodId: STARTER_ROD.id,
    baitOwned: createDefaultBaitOwned(),
    equippedBaitType: STARTER_BAIT.id,
    pickups: createDefaultPickups(),
    challengeCompleted: createDefaultChallengeCompleted(),
    oasisRelics: createDefaultOasisRelics(),
    quests: createDefaultQuestState(),
    settings: createDefaultSettings()
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sanitizeBestiary(rawBestiary: unknown): Record<string, BestiaryEntry> {
  const defaults = createDefaultBestiary();
  if (!isObject(rawBestiary)) {
    return defaults;
  }

  const bestiary: Record<string, BestiaryEntry> = { ...defaults };
  for (const fish of ALL_FISH) {
    const rawEntry = rawBestiary[fish.id];
    if (!isObject(rawEntry)) {
      continue;
    }

    const discovered = Boolean(rawEntry.discovered);
    const caughtCount = Number.isFinite(rawEntry.caughtCount) ? Math.max(0, Number(rawEntry.caughtCount)) : 0;
    bestiary[fish.id] = {
      discovered,
      caughtCount,
      lastCaughtAt: Number.isFinite(rawEntry.lastCaughtAt) ? Math.max(0, Number(rawEntry.lastCaughtAt)) : 0
    };
  }
  return bestiary;
}

function sanitizeFishInventory(rawFishInventory: unknown): Record<string, number> {
  if (!isObject(rawFishInventory)) {
    return {};
  }

  const result: Record<string, number> = {};
  for (const fish of ALL_FISH) {
    const value = rawFishInventory[fish.id];
    if (Number.isFinite(value) && Number(value) > 0) {
      result[fish.id] = Math.floor(Number(value));
    }
  }
  return result;
}

function sanitizeBaitOwned(rawBaitOwned: unknown): Record<string, number> {
  const defaults = createDefaultBaitOwned();
  if (!isObject(rawBaitOwned)) {
    return defaults;
  }

  const baitOwned: Record<string, number> = { ...defaults };
  for (const bait of BAIT_DEFINITIONS) {
    const value = rawBaitOwned[bait.id];
    if (Number.isFinite(value) && Number(value) >= 0) {
      baitOwned[bait.id] = Math.floor(Number(value));
    }
  }
  return baitOwned;
}

function sanitizeOwnedRods(rawOwnedRods: unknown): string[] {
  const fallback = [STARTER_ROD.id];
  if (!Array.isArray(rawOwnedRods)) {
    return fallback;
  }

  const validRodIds = new Set(ROD_DEFINITIONS.map((rod) => rod.id));
  const owned = rawOwnedRods.filter((value): value is string => typeof value === "string" && validRodIds.has(value));
  if (!owned.includes(STARTER_ROD.id)) {
    owned.unshift(STARTER_ROD.id);
  }
  return Array.from(new Set(owned));
}

function sanitizePickups(rawPickups: unknown): PickupsState {
  const defaults = createDefaultPickups();
  if (!isObject(rawPickups)) {
    return defaults;
  }
  return {
    beachZoneRod: Boolean(rawPickups.beachZoneRod),
    riverZoneRod: Boolean(rawPickups.riverZoneRod),
    caveZoneRod: Boolean(rawPickups.caveZoneRod),
    volcanoZoneRod: Boolean(rawPickups.volcanoZoneRod),
    oasisZoneRod: Boolean(rawPickups.oasisZoneRod)
  };
}

function sanitizeChallengeCompleted(rawChallenges: unknown): ChallengeCompletionState {
  const defaults = createDefaultChallengeCompleted();
  if (!isObject(rawChallenges)) {
    return defaults;
  }
  return {
    beach: Boolean(rawChallenges.beach),
    river: Boolean(rawChallenges.river),
    cave: Boolean(rawChallenges.cave),
    volcano: Boolean(rawChallenges.volcano),
    oasis: Boolean(rawChallenges.oasis)
  };
}

function sanitizeOasisRelics(rawRelics: unknown): OasisRelicsState {
  const defaults = createDefaultOasisRelics();
  if (!isObject(rawRelics)) {
    return defaults;
  }
  return {
    beach: Boolean(rawRelics.beach),
    river: Boolean(rawRelics.river),
    cave: Boolean(rawRelics.cave)
  };
}

function sanitizeQuestState(rawQuestState: unknown): QuestProgressState {
  const defaults = createDefaultQuestState();
  if (!isObject(rawQuestState)) {
    return defaults;
  }

  const activeQuestId = typeof rawQuestState.activeQuestId === "string" ? rawQuestState.activeQuestId : null;
  const completedQuestIds = Array.isArray(rawQuestState.completedQuestIds)
    ? rawQuestState.completedQuestIds.filter((value): value is string => typeof value === "string")
    : [];

  return {
    activeQuestId,
    completedQuestIds: Array.from(new Set(completedQuestIds))
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function sanitizeGraphicsQuality(value: unknown): GraphicsQuality {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }
  return "medium";
}

function sanitizeSettings(rawSettings: unknown): UserSettingsState {
  const defaults = createDefaultSettings();
  if (!isObject(rawSettings)) {
    return defaults;
  }
  return {
    masterVolume: Number.isFinite(rawSettings.masterVolume) ? clamp01(Number(rawSettings.masterVolume)) : defaults.masterVolume,
    sfxVolume: Number.isFinite(rawSettings.sfxVolume) ? clamp01(Number(rawSettings.sfxVolume)) : defaults.sfxVolume,
    musicVolume: Number.isFinite(rawSettings.musicVolume) ? clamp01(Number(rawSettings.musicVolume)) : defaults.musicVolume,
    muted: Boolean(rawSettings.muted),
    graphicsQuality: sanitizeGraphicsQuality(rawSettings.graphicsQuality),
    showDiagnostics: Boolean(rawSettings.showDiagnostics),
    meshAuditEnabled: Boolean(rawSettings.meshAuditEnabled),
    decayGraceEnabled: Boolean(rawSettings.decayGraceEnabled)
  };
}

export function sanitizeSaveData(raw: unknown): SaveData {
  const defaults = createDefaultSaveData();
  if (!isObject(raw)) {
    return defaults;
  }

  const ownedRods = sanitizeOwnedRods(raw.ownedRods);
  const equippedRodId =
    typeof raw.equippedRodId === "string" && ownedRods.includes(raw.equippedRodId)
      ? raw.equippedRodId
      : defaults.equippedRodId;

  const baitOwned = sanitizeBaitOwned(raw.baitOwned);
  const equippedBaitType =
    typeof raw.equippedBaitType === "string" && Object.prototype.hasOwnProperty.call(baitOwned, raw.equippedBaitType)
      ? raw.equippedBaitType
      : defaults.equippedBaitType;

  const inventoryCapacityLevel = Number.isFinite(raw.inventoryCapacityLevel)
    ? Math.max(0, Math.min(5, Math.floor(Number(raw.inventoryCapacityLevel))))
    : defaults.inventoryCapacityLevel;

  return {
    version: SAVE_VERSION,
    gold: Number.isFinite(raw.gold) ? Math.max(0, Math.floor(Number(raw.gold))) : defaults.gold,
    inventoryCapacityLevel,
    fishInventory: sanitizeFishInventory(raw.fishInventory),
    bestiary: sanitizeBestiary(raw.bestiary),
    ownedRods,
    equippedRodId,
    baitOwned,
    equippedBaitType,
    pickups: sanitizePickups(raw.pickups),
    challengeCompleted: sanitizeChallengeCompleted(raw.challengeCompleted),
    oasisRelics: sanitizeOasisRelics(raw.oasisRelics),
    quests: sanitizeQuestState(raw.quests),
    settings: sanitizeSettings(raw.settings)
  };
}

export function loadSaveData(): SaveData {
  try {
    const serialized = localStorage.getItem(SAVE_STORAGE_KEY);
    if (!serialized) {
      return createDefaultSaveData();
    }
    const parsed = JSON.parse(serialized);
    const sourceVersion =
      typeof parsed?.version === "number" && Number.isFinite(parsed.version) ? Math.max(0, Math.floor(parsed.version)) : 0;
    const sanitized = sanitizeSaveData(parsed);
    if (sourceVersion !== SAVE_VERSION) {
      // Keep a short migration report for debugging save upgrades.
      // eslint-disable-next-line no-console
      console.info(`[save] migrated schema v${sourceVersion} -> v${SAVE_VERSION}`);
    }
    return sanitized;
  } catch {
    return createDefaultSaveData();
  }
}

export function persistSaveData(data: SaveData): void {
  localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(data));
}

export function resetSaveData(): SaveData {
  const defaults = createDefaultSaveData();
  persistSaveData(defaults);
  return defaults;
}
