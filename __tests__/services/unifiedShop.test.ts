/**
 * Unit tests for the unified shop service helpers.
 *
 * These tests cover only pure helpers (no Firestore I/O):
 *   - normalizePurchaseRecord coerces raw Firestore docs into PurchaseRecord
 *   - getShopCosmetics returns only token-priced items (priceTokens > 0)
 */

// Firestore / Functions are exercised only by purchase + subscription paths,
// not by the pure helpers tested here. Stub them so the module loads cleanly.
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDocs: jest.fn(),
  limit: jest.fn(),
  onSnapshot: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
}));
jest.mock("firebase/functions", () => ({
  getFunctions: jest.fn(() => ({})),
  httpsCallable: jest.fn(() => jest.fn()),
}));

import { getShopCosmetics } from "@/cosmetics/catalog";
import {
  normalizePurchaseRecord,
  PURCHASE_HISTORY_PAGE_SIZE,
} from "@/services/shop/unifiedShop";

describe("unifiedShop helpers", () => {
  describe("PURCHASE_HISTORY_PAGE_SIZE", () => {
    it("is a sensible page size", () => {
      expect(typeof PURCHASE_HISTORY_PAGE_SIZE).toBe("number");
      expect(PURCHASE_HISTORY_PAGE_SIZE).toBeGreaterThan(0);
      expect(PURCHASE_HISTORY_PAGE_SIZE).toBeLessThanOrEqual(200);
    });
  });

  describe("normalizePurchaseRecord", () => {
    it("normalizes a complete record from cosmeticEntitlements", () => {
      const ts = { toMillis: () => 1700000000000 };
      const record = normalizePurchaseRecord("tx_123", {
        transactionId: "tx_123",
        itemId: "decoration_gold_frame",
        itemName: "Gold Frame",
        itemType: "decoration",
        priceTokens: 250,
        purchasedAt: ts,
        source: "cosmetics_shop",
      });

      expect(record.id).toBe("tx_123");
      expect(record.transactionId).toBe("tx_123");
      expect(record.itemId).toBe("decoration_gold_frame");
      expect(record.itemName).toBe("Gold Frame");
      expect(record.itemType).toBe("decoration");
      expect(record.priceTokens).toBe(250);
      expect(record.currency).toBe("tokens");
      expect(record.status).toBe("completed");
      expect(record.purchasedAt).toBe(1700000000000);
      expect(record.itemSnapshot.id).toBe("decoration_gold_frame");
      expect(record.itemSnapshot.priceTokens).toBe(250);
    });

    it("falls back when fields are missing", () => {
      const record = normalizePurchaseRecord("tx_empty", {});
      expect(record.id).toBe("tx_empty");
      expect(record.transactionId).toBe("tx_empty");
      // itemId falls back to docId when missing so callers always have a key.
      expect(record.itemId).toBe("tx_empty");
      // itemName falls back to itemId (which itself fell back to docId).
      expect(record.itemName).toBe("tx_empty");
      expect(record.priceTokens).toBe(0);
      expect(record.currency).toBe("tokens");
      expect(record.status).toBe("completed");
      expect(typeof record.purchasedAt).toBe("number");
    });

    it("handles numeric purchasedAt (epoch ms) and Date instances", () => {
      const epoch = 1234567890123;
      const a = normalizePurchaseRecord("a", { purchasedAt: epoch });
      expect(a.purchasedAt).toBe(epoch);

      const d = new Date(1500000000000);
      const b = normalizePurchaseRecord("b", { purchasedAt: d });
      expect(b.purchasedAt).toBe(d.getTime());
    });
  });

  describe("getShopCosmetics catalog filter", () => {
    it("returns only items priced in tokens (priceTokens > 0)", () => {
      const items = getShopCosmetics();
      expect(Array.isArray(items)).toBe(true);
      // Every item exposed to the unified shop must have a positive token price.
      for (const item of items) {
        expect(typeof item.priceTokens).toBe("number");
        expect(item.priceTokens ?? 0).toBeGreaterThan(0);
      }
    });

    it("never returns duplicate item ids", () => {
      const items = getShopCosmetics();
      const ids = items.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});
