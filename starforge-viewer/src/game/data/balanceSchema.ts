/**
 * TypeScript types for balance.v1.json and balance.v2.json.
 * Pure data — no DOM / Three.js.
 */

export interface BalanceV1 {
  schemaVersion: "starforge.balance.v1";
  click: {
    /** Micro-flux earned per tap. */
    baseMicroFlux: number;
  };
  defaultCapsMicro: {
    flux: number;
    alloy: number;
    signal: number;
  };
  /** Sim tick rate (Hz). */
  simHz: number;
  /** Contract reveal settings. */
  contracts: {
    /** Ticks between reveal rolls. */
    revealIntervalTicks: number;
    /** Base chance per roll [0..1]. */
    baseRevealChance: number;
    /** Max contracts revealed at once. */
    maxRevealed: number;
  };
  /** Event spawn settings. */
  events: {
    /** Ticks between event spawn rolls. */
    spawnIntervalTicks: number;
    /** Base chance per spawn roll [0..1]. */
    baseSpawnChance: number;
    /** Max ticks an event orb persists before expiring. */
    eventLifetimeTicks: number;
  };
  /** Wreck spawning & harvesting. */
  wrecks: {
    /** Micro-HP removed per player tap on a wreck. */
    tapDamageMicro: number;
    /** Ticks between wreck-spawn rolls. */
    spawnIntervalTicks: number;
    /** Base chance per spawn roll [0..1]. */
    baseSpawnChance: number;
    /** Max active wrecks on the field at once. */
    maxActiveWrecks: number;
    /** Min radius for wreck placement ring. */
    wreckRingMinRadius: number;
    /** Max radius for wreck placement ring. */
    wreckRingMaxRadius: number;
    /** DRONES_MAG auto-harvest interval in ticks. */
    droneHarvestIntervalTicks: number;
    /** DRONES_MAG damage per virtual tap (micro). */
    droneTapDamageMicro: number;
  };
}

// ─── Balance V2 ─────────────────────────────────────────────

export interface BalanceV2 {
  schemaVersion: "starforge.balance.v2";
  simHz: number;
  currency: { microDivisor: number };
  cut: {
    baseDamageMicroPerTap: number;
    tapCooldownMs: number;
  };
  resources: {
    fluxCapMicroBase: number;
    alloyCapMicroBase: number;
    signalCapMicroBase: number;
  };
  ui: {
    hpBarShowMicroThreshold: number;
    toastDurationMs: number;
  };
  events: {
    enabled: boolean;
    minGapSec: number;
    maxGapSec: number;
    maxActive: number;
  };
  contracts: {
    enabled: boolean;
    revealRollEverySec: number;
    maxRevealed: number;
    maxActive: number;
  };
}

/**
 * Unified balance type — the game can load either v1 or v2.
 * Components should check schemaVersion to determine shape.
 */
export type BalanceAny = BalanceV1 | BalanceV2;
