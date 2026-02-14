/**
 * TypeScript types for tierUnlocks.v1.json.
 * Pure data — no DOM / Three.js.
 */

export interface TierUnlockCost {
  fluxMicro?: number;
  alloyMicro?: number;
  signalMicro?: number;
}

export interface MachineTierUnlockDef {
  /** Cost to purchase the UNLOCK_T2 upgrade. */
  unlockT2: {
    cost: TierUnlockCost;
    /** Upgrade IDs that must be purchased first. */
    prereqs: string[];
  };
  /** Cost to purchase the UNLOCK_T3 upgrade. */
  unlockT3: {
    cost: TierUnlockCost;
    /** Upgrade IDs that must be purchased first (usually includes UNLOCK_T2_<CODE>). */
    prereqs: string[];
  };
  /** Resource cost to actually upgrade the machine stack to tier 2 (after T2 unlocked). */
  tier2UpgradeCost: TierUnlockCost;
  /** Resource cost to actually upgrade the machine stack to tier 3 (after T3 unlocked). */
  tier3UpgradeCost: TierUnlockCost;
}

export interface TierUnlocksCatalog {
  schemaVersion: "starforge.tierUnlocks.v1";
  perMachine: Record<string, MachineTierUnlockDef>;
}
