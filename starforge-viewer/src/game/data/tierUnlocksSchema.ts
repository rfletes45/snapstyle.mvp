/**
 * TypeScript types for tierUnlocks.v1.json and tierUnlocks.v2.json.
 * Pure data — no DOM / Three.js.
 */

// ═══════════════════════════════════════════════════════════
// ── Tier Unlocks V1 (legacy) ─────────────────────────────
// ═══════════════════════════════════════════════════════════

export interface TierUnlockCost {
  fluxMicro?: number;
  alloyMicro?: number;
  signalMicro?: number;
}

export interface MachineTierUnlockDef {
  unlockT2: {
    cost: TierUnlockCost;
    prereqs: string[];
  };
  unlockT3: {
    cost: TierUnlockCost;
    prereqs: string[];
  };
  tier2UpgradeCost: TierUnlockCost;
  tier3UpgradeCost: TierUnlockCost;
}

export interface TierUnlocksCatalog {
  schemaVersion: "starforge.tierUnlocks.v1";
  perMachine: Record<string, MachineTierUnlockDef>;
}

// ═══════════════════════════════════════════════════════════
// ── Tier Unlocks V2 ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════

export interface TierV2Def {
  unlockUpgradeId: string;
  cost: TierUnlockCost;
}

export interface MachineV2TiersDef {
  code: string;
  tiers: Record<string, TierV2Def>;
}

export interface TierUnlocksV2Catalog {
  schemaVersion: "starforge.tierUnlocks.v2";
  machines: MachineV2TiersDef[];
}
