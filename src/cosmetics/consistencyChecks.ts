/**
 * Cosmetics Consistency Checks
 *
 * Dev-only runtime assertions and a CLI-friendly coverage report.
 * These detect drift between catalog, asset registry, and entitlements.
 *
 * Usage in dev:
 *   import { runCosmeticsConsistencyChecks } from "@/cosmetics/consistencyChecks";
 *   runCosmeticsConsistencyChecks(); // logs warnings to console
 *
 * @module cosmetics/consistencyChecks
 */

import { getAllLoadedIds, hasCosmeticAsset } from "./assetRegistry";
import { COSMETICS_CATALOG, getCosmeticById } from "./catalog";
import type { CosmeticType } from "./types";

export interface ConsistencyReport {
  /** Catalog items that have no corresponding asset. */
  catalogMissingAsset: { id: string; type: CosmeticType }[];
  /** Assets that exist but have no catalog entry. */
  assetMissingCatalog: { id: string; type: CosmeticType }[];
  /** Per-type summary counts. */
  summary: Record<
    CosmeticType,
    { catalogCount: number; assetCount: number; matchedCount: number }
  >;
}

/**
 * Build a consistency report comparing catalog ↔ asset registry.
 */
export function buildConsistencyReport(): ConsistencyReport {
  const types: CosmeticType[] = ["badge", "background", "decoration", "theme"];
  const allLoaded = getAllLoadedIds();

  const catalogMissingAsset: ConsistencyReport["catalogMissingAsset"] = [];
  const assetMissingCatalog: ConsistencyReport["assetMissingCatalog"] = [];
  const summary = {} as ConsistencyReport["summary"];

  for (const type of types) {
    const catalogItems = COSMETICS_CATALOG.filter((c) => c.type === type);
    const assetIds = allLoaded[type] ?? [];

    let matchedCount = 0;

    // Check catalog → asset
    for (const item of catalogItems) {
      const key = item.assetKey ?? item.id;
      if (hasCosmeticAsset(type, key)) {
        matchedCount++;
      } else {
        catalogMissingAsset.push({ id: item.id, type });
      }
    }

    // Check asset → catalog
    for (const assetId of assetIds) {
      if (!getCosmeticById(assetId)) {
        assetMissingCatalog.push({ id: assetId, type });
      }
    }

    summary[type] = {
      catalogCount: catalogItems.length,
      assetCount: assetIds.length,
      matchedCount,
    };
  }

  return { catalogMissingAsset, assetMissingCatalog, summary };
}

/**
 * Run consistency checks and log results (dev-only).
 * Safe to call in production — early-returns if __DEV__ is false.
 */
export function runCosmeticsConsistencyChecks(): void {
  if (typeof __DEV__ !== "undefined" && !__DEV__) return;

  const report = buildConsistencyReport();

  // Summary
  console.log("[Cosmetics] Consistency Report:");
  for (const [type, stats] of Object.entries(report.summary)) {
    console.log(
      `  ${type}: ${stats.matchedCount}/${stats.catalogCount} catalog items have assets (${stats.assetCount} total assets)`,
    );
  }

  // Warnings
  if (report.catalogMissingAsset.length > 0) {
    console.warn(
      `[Cosmetics] ${report.catalogMissingAsset.length} catalog items WITHOUT assets:`,
    );
    for (const item of report.catalogMissingAsset) {
      console.warn(`  ⚠ [${item.type}] ${item.id}`);
    }
  }

  if (report.assetMissingCatalog.length > 0) {
    console.warn(
      `[Cosmetics] ${report.assetMissingCatalog.length} assets WITHOUT catalog entries:`,
    );
    for (const item of report.assetMissingCatalog) {
      console.warn(`  ⚠ [${item.type}] ${item.id}`);
    }
  }

  if (
    report.catalogMissingAsset.length === 0 &&
    report.assetMissingCatalog.length === 0
  ) {
    console.log("[Cosmetics] ✓ All catalog items and assets are consistent.");
  }
}

/**
 * Validate that an equipped cosmetic is owned (except "default" values).
 * Call this from profile hydration to detect data drift.
 *
 * @param equippedId - The equipped cosmetic ID
 * @param ownedIds - Set of owned cosmetic IDs
 * @param slotName - Name of the equipped slot (for logging)
 * @returns true if valid or if equippedId is null/"default"
 */
export function validateEquippedIsOwned(
  equippedId: string | null | undefined,
  ownedIds: Set<string>,
  slotName: string,
): boolean {
  if (!equippedId || equippedId === "default") return true;
  if (!ownedIds.has(equippedId)) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn(
        `[Cosmetics] Equipped ${slotName}="${equippedId}" but user does not own it.`,
      );
    }
    return false;
  }
  return true;
}
