import { BAIT_DEFINITIONS, getBaitById } from "../../data/baits";
import {
  INVENTORY_CAPACITY_BY_LEVEL,
  INVENTORY_UPGRADE_COST_BY_LEVEL,
  MAX_INVENTORY_LEVEL,
} from "../../data/config";
import { ALL_FISH_BY_ID } from "../../data/fish";
import { getRodById, ROD_DEFINITIONS } from "../../data/rods";
import {
  getOasisChecklist,
  getVolcanoChecklist,
  getZoneProgress,
} from "../logic/progression";
import type {
  ChallengeCompletionState,
  FishDefinition,
  GraphicsQuality,
  OasisRelicsState,
  PickupsState,
  SaveData,
  ZoneId,
} from "../types";
import { loadSaveData, persistSaveData, resetSaveData } from "./saveSchema";

type Listener = (data: SaveData) => void;

export interface CatchAddResult {
  stored: boolean;
  inventoryFull: boolean;
}

export interface SellResult {
  soldCount: number;
  earnedGold: number;
  baseGold: number;
  multiplierApplied: number;
}

export type SettingsPatch = Partial<SaveData["settings"]>;

export class SaveStore {
  private state: SaveData;
  private readonly listeners = new Set<Listener>();

  constructor() {
    this.state = loadSaveData();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): SaveData {
    return this.state;
  }

  getSettings(): SaveData["settings"] {
    return this.state.settings;
  }

  replaceFromReset(): void {
    this.state = resetSaveData();
    this.emit();
  }

  getInventoryCapacity(): number {
    return INVENTORY_CAPACITY_BY_LEVEL[this.state.inventoryCapacityLevel];
  }

  getInventoryCount(): number {
    return Object.values(this.state.fishInventory).reduce(
      (sum, count) => sum + count,
      0,
    );
  }

  getFishCount(fishId: string): number {
    return this.state.fishInventory[fishId] ?? 0;
  }

  getBaitQuantity(baitId: string): number {
    return this.state.baitOwned[baitId] ?? 0;
  }

  getEquippedRod() {
    return getRodById(this.state.equippedRodId) ?? ROD_DEFINITIONS[0];
  }

  getEquippedBait() {
    return getBaitById(this.state.equippedBaitType) ?? BAIT_DEFINITIONS[0];
  }

  hasRod(rodId: string): boolean {
    return this.state.ownedRods.includes(rodId);
  }

  unlockRod(rodId: string): boolean {
    if (!getRodById(rodId)) {
      return false;
    }
    if (this.state.ownedRods.includes(rodId)) {
      return false;
    }
    this.state = {
      ...this.state,
      ownedRods: [...this.state.ownedRods, rodId],
    };
    this.emit();
    return true;
  }

  collectZoneRodPickup(
    pickupKey: keyof PickupsState,
    rodId: string,
  ): "granted" | "already_collected" | "invalid" {
    if (!getRodById(rodId)) {
      return "invalid";
    }
    if (this.state.pickups[pickupKey]) {
      return "already_collected";
    }

    const ownedRods = this.state.ownedRods.includes(rodId)
      ? this.state.ownedRods
      : [...this.state.ownedRods, rodId];
    this.state = {
      ...this.state,
      ownedRods,
      pickups: {
        ...this.state.pickups,
        [pickupKey]: true,
      },
    };
    this.emit();
    return "granted";
  }

  isPickupCollected(pickupKey: keyof PickupsState): boolean {
    return Boolean(this.state.pickups[pickupKey]);
  }

  collectOasisRelic(
    relicZone: keyof OasisRelicsState,
  ): "granted" | "already_collected" {
    if (this.state.oasisRelics[relicZone]) {
      return "already_collected";
    }
    this.state = {
      ...this.state,
      oasisRelics: {
        ...this.state.oasisRelics,
        [relicZone]: true,
      },
    };
    this.emit();
    return "granted";
  }

  isOasisRelicCollected(relicZone: keyof OasisRelicsState): boolean {
    return Boolean(this.state.oasisRelics[relicZone]);
  }

  areAllOasisRelicsCollected(): boolean {
    const relics = this.state.oasisRelics;
    return relics.beach && relics.river && relics.cave;
  }

  setChallengeCompleted(zoneId: keyof ChallengeCompletionState): boolean {
    if (this.state.challengeCompleted[zoneId]) {
      return false;
    }
    this.state = {
      ...this.state,
      challengeCompleted: {
        ...this.state.challengeCompleted,
        [zoneId]: true,
      },
    };
    this.emit();
    return true;
  }

  isChallengeCompleted(zoneId: keyof ChallengeCompletionState): boolean {
    return Boolean(this.state.challengeCompleted[zoneId]);
  }

  setActiveQuest(questId: string | null): void {
    this.state = {
      ...this.state,
      quests: {
        ...this.state.quests,
        activeQuestId: questId,
      },
    };
    this.emit();
  }

  clearActiveQuest(): void {
    this.setActiveQuest(null);
  }

  isQuestCompleted(questId: string): boolean {
    return this.state.quests.completedQuestIds.includes(questId);
  }

  completeQuest(questId: string): boolean {
    if (this.state.quests.completedQuestIds.includes(questId)) {
      return false;
    }
    const completedQuestIds = [...this.state.quests.completedQuestIds, questId];
    this.state = {
      ...this.state,
      quests: {
        activeQuestId:
          this.state.quests.activeQuestId === questId
            ? null
            : this.state.quests.activeQuestId,
        completedQuestIds,
      },
    };
    this.emit();
    return true;
  }

  addGold(amount: number): void {
    this.state = {
      ...this.state,
      gold: this.state.gold + Math.max(0, Math.floor(amount)),
    };
    this.emit();
  }

  addBait(baitId: string, quantity: number): boolean {
    const bait = getBaitById(baitId);
    if (!bait) {
      return false;
    }
    const addAmount = Math.max(0, Math.floor(quantity));
    if (addAmount <= 0) {
      return false;
    }
    this.state = {
      ...this.state,
      baitOwned: {
        ...this.state.baitOwned,
        [baitId]: (this.state.baitOwned[baitId] ?? 0) + addAmount,
      },
    };
    this.emit();
    return true;
  }

  spendGold(amount: number): boolean {
    const rounded = Math.max(0, Math.floor(amount));
    if (this.state.gold < rounded) {
      return false;
    }
    this.state = {
      ...this.state,
      gold: this.state.gold - rounded,
    };
    this.emit();
    return true;
  }

  equipRod(rodId: string): boolean {
    if (!this.state.ownedRods.includes(rodId)) {
      return false;
    }
    if (!getRodById(rodId)) {
      return false;
    }
    this.state = {
      ...this.state,
      equippedRodId: rodId,
    };
    this.emit();
    return true;
  }

  equipBait(baitId: string): boolean {
    if (!getBaitById(baitId)) {
      return false;
    }
    this.state = {
      ...this.state,
      equippedBaitType: baitId,
    };
    this.emit();
    return true;
  }

  buyBait(baitId: string, quantity: number): { ok: boolean; spent: number } {
    const bait = getBaitById(baitId);
    const clampedQuantity = Math.max(1, Math.floor(quantity));
    if (!bait || !bait.purchasable) {
      return { ok: false, spent: 0 };
    }

    const totalPrice = bait.price * clampedQuantity;
    if (this.state.gold < totalPrice) {
      return { ok: false, spent: 0 };
    }

    this.state = {
      ...this.state,
      gold: this.state.gold - totalPrice,
      baitOwned: {
        ...this.state.baitOwned,
        [baitId]: (this.state.baitOwned[baitId] ?? 0) + clampedQuantity,
      },
    };
    this.emit();
    return { ok: true, spent: totalPrice };
  }

  consumeEquippedBait(): boolean {
    const baitId = this.state.equippedBaitType;
    const current = this.state.baitOwned[baitId] ?? 0;
    if (current <= 0) {
      return false;
    }
    this.state = {
      ...this.state,
      baitOwned: {
        ...this.state.baitOwned,
        [baitId]: current - 1,
      },
    };
    this.emit();
    return true;
  }

  addCatch(fish: FishDefinition): CatchAddResult {
    const currentBestiaryEntry = this.state.bestiary[fish.id] ?? {
      discovered: false,
      caughtCount: 0,
      lastCaughtAt: 0,
    };
    const now = Date.now();
    const nextBestiary = {
      ...this.state.bestiary,
      [fish.id]: {
        discovered: true,
        caughtCount: currentBestiaryEntry.caughtCount + 1,
        lastCaughtAt: now,
      },
    };

    const currentCount = this.getInventoryCount();
    const capacity = this.getInventoryCapacity();
    if (currentCount >= capacity) {
      this.state = {
        ...this.state,
        bestiary: nextBestiary,
      };
      this.emit();
      return { stored: false, inventoryFull: true };
    }

    const nextFishInventory = {
      ...this.state.fishInventory,
      [fish.id]: (this.state.fishInventory[fish.id] ?? 0) + 1,
    };

    this.state = {
      ...this.state,
      fishInventory: nextFishInventory,
      bestiary: nextBestiary,
    };
    this.emit();
    return { stored: true, inventoryFull: false };
  }

  sellFish(fishIds: string[], goldMultiplier = 1): SellResult {
    if (fishIds.length === 0) {
      return { soldCount: 0, earnedGold: 0, baseGold: 0, multiplierApplied: 1 };
    }

    let soldCount = 0;
    let baseGold = 0;
    const nextInventory = { ...this.state.fishInventory };

    for (const fishId of fishIds) {
      const count = nextInventory[fishId] ?? 0;
      if (count <= 0) {
        continue;
      }
      const fish = ALL_FISH_BY_ID[fishId];
      if (!fish) {
        continue;
      }
      soldCount += 1;
      baseGold += fish.sellPrice;
      if (count === 1) {
        delete nextInventory[fishId];
      } else {
        nextInventory[fishId] = count - 1;
      }
    }

    if (soldCount === 0) {
      return { soldCount: 0, earnedGold: 0, baseGold: 0, multiplierApplied: 1 };
    }

    const multiplierApplied = Math.max(1, goldMultiplier);
    const earnedGold = Math.floor(baseGold * multiplierApplied);

    this.state = {
      ...this.state,
      fishInventory: nextInventory,
      gold: this.state.gold + earnedGold,
    };
    this.emit();
    return { soldCount, earnedGold, baseGold, multiplierApplied };
  }

  sellAllFish(goldMultiplier = 1): SellResult {
    const fishIdsToSell: string[] = [];
    for (const [fishId, count] of Object.entries(this.state.fishInventory)) {
      for (let i = 0; i < count; i += 1) {
        fishIdsToSell.push(fishId);
      }
    }
    return this.sellFish(fishIdsToSell, goldMultiplier);
  }

  getZoneDiscoveredUnique(zoneId: ZoneId): number {
    return getZoneProgress(this.state, zoneId).discoveredUnique;
  }

  getZoneProgressPercent(zoneId: ZoneId): number {
    return getZoneProgress(this.state, zoneId).percent;
  }

  getVolcanoChecklist() {
    return getVolcanoChecklist(this.state);
  }

  getOasisChecklist() {
    return getOasisChecklist(this.state);
  }

  purchaseNextInventoryUpgrade(): { ok: boolean; newLevel: number } {
    const currentLevel = this.state.inventoryCapacityLevel;
    const targetLevel = currentLevel + 1;
    if (targetLevel > MAX_INVENTORY_LEVEL) {
      return { ok: false, newLevel: currentLevel };
    }

    const cost = INVENTORY_UPGRADE_COST_BY_LEVEL[currentLevel];
    if (this.state.gold < cost) {
      return { ok: false, newLevel: currentLevel };
    }

    this.state = {
      ...this.state,
      gold: this.state.gold - cost,
      inventoryCapacityLevel: targetLevel,
    };
    this.emit();
    return { ok: true, newLevel: targetLevel };
  }

  updateSettings(patch: SettingsPatch): void {
    const next = {
      ...this.state.settings,
      ...patch,
    };
    next.masterVolume = clamp01(next.masterVolume);
    next.sfxVolume = clamp01(next.sfxVolume);
    next.musicVolume = clamp01(next.musicVolume);
    next.graphicsQuality = sanitizeGraphicsQuality(next.graphicsQuality);
    next.showDiagnostics = Boolean(next.showDiagnostics);
    next.meshAuditEnabled = Boolean(next.meshAuditEnabled);
    next.decayGraceEnabled = Boolean(next.decayGraceEnabled);
    next.muted = Boolean(next.muted);

    this.state = {
      ...this.state,
      settings: next,
    };
    this.emit();
  }

  private emit(): void {
    persistSaveData(this.state);
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function sanitizeGraphicsQuality(value: unknown): GraphicsQuality {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }
  return "medium";
}
