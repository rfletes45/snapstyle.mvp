/**
 * Catalog Sanity Check — Regression Prevention
 *
 * Verifies the cosmetics catalog and shared pricing table are consistent.
 * Catches the exact class of bug that caused the "Item not found" purchase
 * failure: client catalog and server pricing drifting out of sync.
 *
 * Run: npx jest catalogSanityCheck
 */

import {
  COSMETICS_CATALOG,
  getCosmeticById,
  getShopCosmetics,
  validateCatalog,
} from "@/cosmetics/catalog";
import pricingTable from "../../shared/cosmetics/shopPricingTable.json";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface PricingEntry {
  id: string;
  type: string;
  name: string;
  priceTokens: number;
}

const pricingItems: PricingEntry[] = pricingTable.items as PricingEntry[];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Catalog Sanity Check", () => {
  // ── 1. No duplicate IDs ──────────────────────────────────────────────
  test("catalog has no duplicate IDs", () => {
    const ids = COSMETICS_CATALOG.map((c) => c.id);
    const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(duplicates).toEqual([]);
  });

  // ── 2. Every shop item has a price ────────────────────────────────────
  test("every source=shop item has priceTokens > 0", () => {
    const shopItems = COSMETICS_CATALOG.filter((c) => c.source === "shop");
    const missing = shopItems.filter(
      (c) => !c.priceTokens || c.priceTokens <= 0,
    );
    expect(missing.map((c) => c.id)).toEqual([]);
  });

  // ── 3. No free/achievement item has a price ───────────────────────────
  test("non-shop items do not have priceTokens set", () => {
    const nonShop = COSMETICS_CATALOG.filter((c) => c.source !== "shop");
    const withPrice = nonShop.filter(
      (c) => c.priceTokens !== undefined && c.priceTokens > 0,
    );
    expect(withPrice.map((c) => c.id)).toEqual([]);
  });

  // ── 4. Pricing table ↔ catalog: every priced item exists in catalog ──
  test("every pricing table entry exists in client catalog", () => {
    const missing = pricingItems
      .filter((entry) => !getCosmeticById(entry.id))
      .map((e) => e.id);
    expect(missing).toEqual([]);
  });

  // ── 5. Pricing table ↔ catalog: types match ──────────────────────────
  test("pricing table types match catalog types", () => {
    const mismatches = pricingItems
      .map((entry) => {
        const item = getCosmeticById(entry.id);
        if (!item) return null; // covered by test above
        return item.type !== entry.type
          ? `${entry.id}: catalog=${item.type} pricing=${entry.type}`
          : null;
      })
      .filter(Boolean);
    expect(mismatches).toEqual([]);
  });

  // ── 6. Pricing table ↔ catalog: prices match ─────────────────────────
  test("pricing table prices match catalog prices", () => {
    const mismatches = pricingItems
      .map((entry) => {
        const item = getCosmeticById(entry.id);
        if (!item) return null;
        return (item.priceTokens ?? 0) !== entry.priceTokens
          ? `${entry.id}: catalog=${item.priceTokens} pricing=${entry.priceTokens}`
          : null;
      })
      .filter(Boolean);
    expect(mismatches).toEqual([]);
  });

  // ── 7. Every shop item (non-comingSoon) is in the pricing table ──────
  test("every purchasable catalog item is in the pricing table", () => {
    const pricingIds = new Set(pricingItems.map((e) => e.id));
    const shopItems = getShopCosmetics().filter((c) => !c.metadata?.comingSoon);
    const missing = shopItems
      .filter((c) => !pricingIds.has(c.id))
      .map((c) => c.id);
    expect(missing).toEqual([]);
  });

  // ── 8. Required fields present on every catalog item ──────────────────
  test("every catalog item has required fields (id, type, name, source)", () => {
    const invalid = COSMETICS_CATALOG.filter(
      (c) => !c.id || !c.type || !c.name || !c.source,
    ).map((c) => c.id || "(no id)");
    expect(invalid).toEqual([]);
  });

  // ── 9. validateCatalog() returns zero warnings ────────────────────────
  test("validateCatalog() produces no warnings", () => {
    const result = validateCatalog();
    if (result.warnings.length > 0) {
      // Print warnings for debugging before failing
      console.warn("Catalog warnings:", result.warnings);
    }
    expect(result.warnings).toEqual([]);
  });

  // ── 10. Pricing table has no duplicate IDs ────────────────────────────
  test("pricing table has no duplicate IDs", () => {
    const ids = pricingItems.map((e) => e.id);
    const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(duplicates).toEqual([]);
  });

  // ── 11. Item count sanity: at least 20 purchasable items ──────────────
  test("catalog has a reasonable number of purchasable items", () => {
    const shopItems = getShopCosmetics();
    expect(shopItems.length).toBeGreaterThanOrEqual(20);
    expect(pricingItems.length).toBeGreaterThanOrEqual(20);
  });
});
