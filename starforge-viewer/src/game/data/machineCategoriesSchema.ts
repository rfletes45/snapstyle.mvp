/**
 * TypeScript types for machineCategories.v1.json.
 */

export type MachineCategory =
  | "HARVEST"
  | "CONVERT"
  | "STORAGE"
  | "BOOST"
  | "SPECIAL";

export interface MachineCategoriesCatalog {
  schemaVersion: "starforge.machineCategories.v1";
  categories: Record<MachineCategory, string[]>;
}
