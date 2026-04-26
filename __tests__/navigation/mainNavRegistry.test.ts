import {
  getDefaultMainNavItems,
  MAIN_NAV_SCHEMA_VERSION,
  MAX_MAIN_NAV_ITEMS,
  validateMainNavLayout,
} from "@/navigation/mainNav";

describe("main navigation registry validation", () => {
  it("uses core defaults when persisted data is missing", () => {
    expect(validateMainNavLayout(null)).toBeNull();
    expect(getDefaultMainNavItems().map((item) => item.id)).toEqual([
      "messages",
      "calls",
      "profile",
    ]);
  });

  it("drops unknown and duplicate items while restoring missing core items", () => {
    const result = validateMainNavLayout({
      schemaVersion: MAIN_NAV_SCHEMA_VERSION,
      items: [
        { id: "shop", position: 0 },
        { id: "shop", position: 1 },
        { id: "not-real", position: 2 },
        { id: "messages", position: 3 },
      ],
    });

    expect(result?.map((item) => item.id)).toEqual([
      "shop",
      "messages",
      "calls",
      "profile",
    ]);
  });

  it("rejects layouts from future schemas", () => {
    expect(
      validateMainNavLayout({
        schemaVersion: MAIN_NAV_SCHEMA_VERSION + 1,
        items: [{ id: "messages", position: 0 }],
      }),
    ).toBeNull();
  });

  it("normalizes positions and keeps at most the supported maximum", () => {
    const result = validateMainNavLayout({
      schemaVersion: MAIN_NAV_SCHEMA_VERSION,
      items: [
        { id: "customize", position: 10 },
        { id: "games", position: 8 },
        { id: "shop", position: 6 },
        { id: "profile", position: 4 },
        { id: "calls", position: 2 },
        { id: "messages", position: 0 },
      ],
    });

    expect(result).toHaveLength(MAX_MAIN_NAV_ITEMS);
    expect(result?.map((item) => item.position)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
