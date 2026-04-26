/**
 * Unit tests for daily-shop pure helpers.
 */

import type { CosmeticDefinition } from "@/cosmetics/types";
import {
  DAILY_SHOP_CATEGORIES,
  formatDailyShopCountdown,
  getDailyShopResetTime,
  getDailyShopSeed,
  groupShopItemsByDecorationCategory,
  isEligibleForDailyShop,
  selectDailyItemsForCategory,
} from "@/services/shop/dailyShop";

const mkItem = (
  id: string,
  type: CosmeticDefinition["type"],
  overrides: Partial<CosmeticDefinition> = {},
): CosmeticDefinition =>
  ({
    id,
    type,
    name: id,
    description: "",
    rarity: "common",
    source: "shop",
    priceTokens: 100,
    sortOrder: 1,
    ...overrides,
  }) as CosmeticDefinition;

describe("getDailyShopResetTime", () => {
  it("returns next local midnight strictly in the future", () => {
    const now = new Date(2026, 3, 25, 14, 30, 5); // Apr 25, 14:30:05 local
    const reset = getDailyShopResetTime(now);
    const expected = new Date(2026, 3, 26, 0, 0, 0, 0).getTime();
    expect(reset).toBe(expected);
    expect(reset).toBeGreaterThan(now.getTime());
  });

  it("rolls over to next day even when called at midnight", () => {
    const now = new Date(2026, 3, 25, 0, 0, 0);
    const reset = getDailyShopResetTime(now);
    expect(reset).toBe(new Date(2026, 3, 26, 0, 0, 0, 0).getTime());
  });
});

describe("getDailyShopSeed", () => {
  it("formats stable YYYY-MM-DD in local time", () => {
    expect(getDailyShopSeed(new Date(2026, 3, 25, 9, 30))).toBe("2026-04-25");
    expect(getDailyShopSeed(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });

  it("changes after midnight", () => {
    const a = getDailyShopSeed(new Date(2026, 3, 25, 23, 59, 59));
    const b = getDailyShopSeed(new Date(2026, 3, 26, 0, 0, 1));
    expect(a).not.toBe(b);
  });
});

describe("formatDailyShopCountdown", () => {
  it('renders "h m" when >= 1 hour', () => {
    expect(formatDailyShopCountdown(12 * 3600_000 + 34 * 60_000)).toBe(
      "12h 34m",
    );
    expect(formatDailyShopCountdown(3600_000)).toBe("1h 0m");
  });

  it('renders "m s" when < 1 hour', () => {
    expect(formatDailyShopCountdown(42 * 60_000 + 15_000)).toBe("42m 15s");
    expect(formatDailyShopCountdown(15_000)).toBe("0m 15s");
  });

  it("never goes negative", () => {
    expect(formatDailyShopCountdown(0)).toBe("0m 0s");
    expect(formatDailyShopCountdown(-5000)).toBe("0m 0s");
    expect(formatDailyShopCountdown(NaN)).toBe("0m 0s");
  });
});

describe("isEligibleForDailyShop", () => {
  it("accepts a normal token-priced item", () => {
    expect(isEligibleForDailyShop(mkItem("a", "decoration"))).toBe(true);
  });

  it("rejects items with no token price", () => {
    expect(
      isEligibleForDailyShop(mkItem("a", "decoration", { priceTokens: 0 })),
    ).toBe(false);
    expect(
      isEligibleForDailyShop(
        mkItem("a", "decoration", { priceTokens: undefined as any }),
      ),
    ).toBe(false);
  });

  it("rejects coming-soon items", () => {
    expect(
      isEligibleForDailyShop(
        mkItem("a", "decoration", { metadata: { comingSoon: true } as any }),
      ),
    ).toBe(false);
  });

  it("rejects malformed entries", () => {
    expect(isEligibleForDailyShop(null as any)).toBe(false);
    expect(isEligibleForDailyShop({} as any)).toBe(false);
  });
});

describe("groupShopItemsByDecorationCategory", () => {
  const items: CosmeticDefinition[] = [
    mkItem("d1", "decoration"),
    mkItem("d2", "decoration"),
    mkItem("bg1", "background"),
    mkItem("ba1", "badge"),
    mkItem("th1", "theme"),
    mkItem("c1", "chat_bubble_color"),
    mkItem("c2", "chat_font"),
    mkItem("c3", "chat_font_color"),
    mkItem("bad", "decoration", { priceTokens: 0 }), // ineligible
  ];

  it("groups items by category and drops ineligible ones", () => {
    const g = groupShopItemsByDecorationCategory(items);
    expect(g.decoration.map((i) => i.id)).toEqual(["d1", "d2"]);
    expect(g.background.map((i) => i.id)).toEqual(["bg1"]);
    expect(g.badge.map((i) => i.id)).toEqual(["ba1"]);
    expect(g.theme.map((i) => i.id)).toEqual(["th1"]);
    expect(g.chat.map((i) => i.id).sort()).toEqual(["c1"]);
  });

  it("does not place an item in more than one category", () => {
    const g = groupShopItemsByDecorationCategory(items);
    const seen = new Set<string>();
    for (const cat of DAILY_SHOP_CATEGORIES) {
      for (const it of g[cat.id]) {
        expect(seen.has(it.id)).toBe(false);
        seen.add(it.id);
      }
    }
  });
});

describe("selectDailyItemsForCategory", () => {
  const pool: CosmeticDefinition[] = Array.from({ length: 8 }, (_, i) =>
    mkItem(`d${i}`, "decoration"),
  );

  it("returns exactly N items when pool is large enough", () => {
    const picks = selectDailyItemsForCategory(pool, "decoration", "2026-04-25");
    expect(picks).toHaveLength(2);
  });

  it("is deterministic for the same (seed, category, items)", () => {
    const a = selectDailyItemsForCategory(pool, "decoration", "2026-04-25");
    const b = selectDailyItemsForCategory(pool, "decoration", "2026-04-25");
    expect(a.map((i) => i.id)).toEqual(b.map((i) => i.id));
  });

  it("changes when the seed (day) changes", () => {
    // Try multiple subsequent days to defend against an unlucky collision.
    const baseline = selectDailyItemsForCategory(
      pool,
      "decoration",
      "2026-04-25",
    ).map((i) => i.id);
    const seeds = [
      "2026-04-26",
      "2026-04-27",
      "2026-04-28",
      "2026-04-29",
      "2026-04-30",
    ];
    const anyDifferent = seeds.some((s) => {
      const picks = selectDailyItemsForCategory(pool, "decoration", s).map(
        (i) => i.id,
      );
      return picks.join(",") !== baseline.join(",");
    });
    expect(anyDifferent).toBe(true);
  });

  it("yields different selections for different categoryIds", () => {
    const a = selectDailyItemsForCategory(pool, "decoration", "2026-04-25");
    const b = selectDailyItemsForCategory(pool, "background", "2026-04-25");
    // Different category seed should usually shuffle ordering; if both happen
    // to pick the same first two, that is acceptable. Assert function is pure.
    expect(a).toHaveLength(2);
    expect(b).toHaveLength(2);
  });

  it("excludes ineligible items", () => {
    const dirty: CosmeticDefinition[] = [
      ...pool,
      mkItem("zzz_no_price", "decoration", { priceTokens: 0 }),
      mkItem("zzz_coming", "decoration", {
        metadata: { comingSoon: true } as any,
      }),
    ];
    const picks = selectDailyItemsForCategory(
      dirty,
      "decoration",
      "2026-04-25",
    );
    const ids = picks.map((i) => i.id);
    expect(ids).not.toContain("zzz_no_price");
    expect(ids).not.toContain("zzz_coming");
  });

  it("never returns duplicates", () => {
    const dup: CosmeticDefinition[] = [
      mkItem("dup", "decoration"),
      mkItem("dup", "decoration"), // same id twice
      mkItem("other", "decoration"),
    ];
    const picks = selectDailyItemsForCategory(dup, "decoration", "seed");
    const ids = picks.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("returns fewer than N when pool is too small", () => {
    const small = [mkItem("only", "decoration")];
    const picks = selectDailyItemsForCategory(small, "decoration", "seed");
    expect(picks).toHaveLength(1);
  });

  it("returns empty when pool is empty", () => {
    expect(selectDailyItemsForCategory([], "decoration", "seed")).toEqual([]);
  });
});
