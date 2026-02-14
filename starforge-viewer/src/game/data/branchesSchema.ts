/**
 * TypeScript types for branches.v1.json.
 * Pure data — no DOM / Three.js.
 */

export interface BranchDef {
  id: string;
  title: string;
  desc: string;
  /** Machine code that unlocks this branch when purchased. */
  keystone: string;
  /** Machine codes unlocked once the branch is active. */
  unlocks: string[];
}

export interface BranchesCatalog {
  schemaVersion: "starforge.branches.v1";
  /** Minimum rebirth count before non-starter machines are available. */
  fullEraMinRebirthCount: number;
  /** Machine codes always available (even before rebirth). */
  starterMachines: string[];
  /** Branch definitions keyed by branch id. */
  branches: Record<string, BranchDef>;
}
