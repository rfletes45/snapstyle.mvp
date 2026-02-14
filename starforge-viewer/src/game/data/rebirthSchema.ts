/**
 * TypeScript types for rebirth.v1.json and rebirthTree.v1.json.
 * Pure data — no DOM / Three.js.
 */

// ─── Rebirth config ─────────────────────────────────────────

export interface RebirthGate {
  /** Minimum rebirthCount at which this gate applies. */
  minRebirthCount: number;
  /** Run-stats thresholds to pass the gate. */
  requires: {
    totalFluxEarnedMicro?: number;
    wrecksDestroyedTotal?: number;
  };
}

export interface RebirthShardFormula {
  fluxDivisor: number;
  fluxExponent: number;
  rarityBonus: Record<string, number>;
}

export interface RebirthCatalog {
  schemaVersion: "starforge.rebirth.v1";
  shardFormula: RebirthShardFormula;
  gates: RebirthGate[];
}

// ─── Rebirth Tree ───────────────────────────────────────────

export interface RebirthTreeEffect {
  t: "ADD" | "MUL" | "FLAG";
  path: string;
  value: number;
}

export interface RebirthTreeNode {
  id: string;
  title: string;
  desc: string;
  cost: number; // core shards
  requires: string[]; // node IDs that must be purchased first
  effects: RebirthTreeEffect[];
}

export interface RebirthTreeCatalog {
  schemaVersion: "starforge.rebirthTree.v1";
  nodes: RebirthTreeNode[];
}
