/**
 * Save file types.
 * Pure data — no DOM / Three.js.
 */
import type { SimStateV1 } from "../sim/types";

export interface SaveFileV1 {
  schemaVersion: "starforge.save.v1";
  simState: SimStateV1;
  lastSavedAt: string; // ISO 8601
}
