/**
 * TypeScript types for baseSlots.v2.json.
 * Pure data — no DOM / Three.js.
 */

export type SlotType = "dock" | "module" | "utility" | "cosmic";

export interface BaseSlotV2Def {
  id: string;
  type: SlotType;
  /** Grid column. */
  gx: number;
  /** Grid row. */
  gz: number;
  /** World-space X coordinate for 3D placement. */
  x: number;
  /** World-space Z coordinate for 3D placement. */
  z: number;
  /** If set, this slot is locked until the named rebirth-tree node is purchased. */
  lockedByNode?: string;
}

export interface BaseSlotsV2Catalog {
  schemaVersion: "starforge.baseSlots.v2";
  gridCellSize: number;
  slots: BaseSlotV2Def[];
  adjacency: [string, string][];
}

/**
 * Placement result: maps each placed machine code to its assigned slot(s)
 * and world coordinates.
 */
export interface PlacementEntry {
  primarySlotId: string;
  secondarySlotId?: string;
  /** World X from the primary slot. */
  x: number;
  /** World Z from the primary slot (for 1×2, midpoint between both slots). */
  z: number;
}

export type PlacementMap = Record<string, PlacementEntry>;
