/**
 * TypeScript types for wrecks.v1.json.
 * Pure data — no DOM / Three.js.
 */

export interface WreckArchetypeDef {
  id: string;
  /** Matches an archetype key in the WRECK ModuleDef (e.g. "CargoBarge"). */
  moduleArchetype: string;
  /** Rarity tier 1..3 — used for visual tier selection. */
  rarity: number;
  /** Weight for weighted random spawn selection. */
  weight: number;
  /** Total HP in micro-units — wreck is depleted when HP reaches 0. */
  hpMicro: number;
  /** Total resources contained in this wreck. */
  baseYieldMicro: { flux: number; alloy: number; signal: number };
  /** Resources extracted per tap. */
  yieldPerTapMicro: { flux: number; alloy: number; signal: number };
  /** Multiplier applied when hitting a weakpoint. */
  weakpointBonusMult: number;
  /** Whether the wreck is removed from scene when fully depleted. */
  despawnOnDepleted: boolean;
}

export interface WrecksCatalog {
  schemaVersion: "starforge.wrecks.v1";
  wreckArchetypes: WreckArchetypeDef[];
}
