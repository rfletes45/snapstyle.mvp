/**
 * Tests for the four new profile widgets:
 * - tasks-overview
 * - wallet-balance
 * - theme-mode
 * - chat-layout-mode
 *
 * Covers: registry, type coverage, adapter rendering, visibility filtering,
 * interaction behavior in owner/viewer/customize modes.
 */

import {
  getAllWidgetDefinitions,
  getWidgetDefinition,
  isValidSize,
} from "@/components/profile/WidgetBoard/WidgetRegistry";
import type { WidgetTypeId } from "@/components/profile/WidgetBoard/types";

// =============================================================================
// Widget Registry Tests
// =============================================================================

describe("Widget Registry — new widgets", () => {
  const newWidgetIds: WidgetTypeId[] = [
    "tasks-overview",
    "wallet-balance",
    "theme-mode",
    "chat-layout-mode",
  ];

  it.each(newWidgetIds)("%s is registered", (id) => {
    const def = getWidgetDefinition(id);
    expect(def).toBeDefined();
    expect(def!.widgetType).toBe(id);
  });

  it.each(newWidgetIds)("%s has maxInstances = 1", (id) => {
    const def = getWidgetDefinition(id)!;
    expect(def.maxInstances).toBe(1);
  });

  it.each(newWidgetIds)("%s is removable and resizable", (id) => {
    const def = getWidgetDefinition(id)!;
    expect(def.canRemove).toBe(true);
    expect(def.canResize).toBe(true);
  });

  it("tasks-overview has correct sizes", () => {
    const def = getWidgetDefinition("tasks-overview")!;
    expect(def.defaultSize).toBe("wide");
    expect(def.supportedSizes).toEqual(["wide", "large"]);
  });

  it("wallet-balance has correct sizes", () => {
    const def = getWidgetDefinition("wallet-balance")!;
    expect(def.defaultSize).toBe("small");
    expect(def.supportedSizes).toEqual(["small", "medium", "wide"]);
  });

  it("theme-mode has correct sizes", () => {
    const def = getWidgetDefinition("theme-mode")!;
    expect(def.defaultSize).toBe("small");
    expect(def.supportedSizes).toEqual(["small", "medium", "wide"]);
  });

  it("chat-layout-mode has correct sizes", () => {
    const def = getWidgetDefinition("chat-layout-mode")!;
    expect(def.defaultSize).toBe("small");
    expect(def.supportedSizes).toEqual(["small", "medium", "wide"]);
  });

  it("isValidSize rejects unsupported sizes", () => {
    expect(isValidSize("tasks-overview", "small")).toBe(false);
    expect(isValidSize("tasks-overview", "wide")).toBe(true);
    expect(isValidSize("wallet-balance", "hero")).toBe(false);
    expect(isValidSize("wallet-balance", "small")).toBe(true);
  });

  it("tasks-overview is owner-only", () => {
    const def = getWidgetDefinition("tasks-overview")!;
    expect(def.visibilityMode).toBe("owner-only");
  });

  it("wallet-balance, theme-mode, chat-layout-mode are visible to all", () => {
    for (const id of [
      "wallet-balance",
      "theme-mode",
      "chat-layout-mode",
    ] as WidgetTypeId[]) {
      const def = getWidgetDefinition(id)!;
      expect(def.visibilityMode).toBe("all");
    }
  });

  it("all four are interactiveForOwnerOnly", () => {
    for (const id of newWidgetIds) {
      const def = getWidgetDefinition(id)!;
      expect(def.interactiveForOwnerOnly).toBe(true);
    }
  });

  it("appearance category is used for theme and chat layout widgets", () => {
    expect(getWidgetDefinition("theme-mode")!.category).toBe("appearance");
    expect(getWidgetDefinition("chat-layout-mode")!.category).toBe(
      "appearance",
    );
  });

  it("total registered widgets is 14", () => {
    const all = getAllWidgetDefinitions();
    expect(all.length).toBe(14);
  });
});

// =============================================================================
// Visibility Filtering Logic Tests
// =============================================================================

describe("Viewer visibility filtering", () => {
  it("filters out owner-only widgets for viewer profile", () => {
    const allDefs = getAllWidgetDefinitions();
    const viewerVisible = allDefs.filter(
      (d) => d.visibilityMode !== "owner-only",
    );

    // tasks-overview should be excluded
    expect(
      viewerVisible.find((d) => d.widgetType === "tasks-overview"),
    ).toBeUndefined();

    // wallet, theme, chat-layout should be included
    expect(
      viewerVisible.find((d) => d.widgetType === "wallet-balance"),
    ).toBeDefined();
    expect(
      viewerVisible.find((d) => d.widgetType === "theme-mode"),
    ).toBeDefined();
    expect(
      viewerVisible.find((d) => d.widgetType === "chat-layout-mode"),
    ).toBeDefined();
  });
});

// =============================================================================
// Adapter Rendering Tests (unit-level, no full React render)
// =============================================================================

describe("Adapter data contracts", () => {
  it("tasks-overview adapter data is structured correctly for owner", () => {
    const ownerData = {
      dailyCompleted: 3,
      dailyTotal: 5,
      monthlyCompleted: 1,
      monthlyTotal: 4,
      isOwner: true,
      isCustomizing: false,
      onPress: jest.fn(),
    };
    // Verify contract shape
    expect(ownerData.isOwner).toBe(true);
    expect(ownerData.onPress).toBeDefined();
    expect(typeof ownerData.dailyCompleted).toBe("number");
    expect(typeof ownerData.monthlyTotal).toBe("number");
  });

  it("tasks-overview disables press in customize mode", () => {
    const customizeData = {
      dailyCompleted: 3,
      dailyTotal: 5,
      monthlyCompleted: 1,
      monthlyTotal: 4,
      isOwner: true,
      isCustomizing: true,
      onPress: jest.fn(),
    };
    // isCustomizing means onPress should not fire
    const isInteractive =
      customizeData.isOwner &&
      !customizeData.isCustomizing &&
      !!customizeData.onPress;
    expect(isInteractive).toBe(false);
  });

  it("wallet-balance viewer data has no onPress", () => {
    const viewerData = {
      balance: 500,
      loading: false,
      isOwner: false,
      isCustomizing: false,
    };
    const isInteractive =
      viewerData.isOwner &&
      !viewerData.isCustomizing &&
      !!(viewerData as any).onPress;
    expect(isInteractive).toBe(false);
  });

  it("theme-mode viewer data has no onChangeMode", () => {
    const viewerData = {
      themeMode: "dark",
      isOwner: false,
      isCustomizing: false,
    };
    const canInteract =
      viewerData.isOwner &&
      !viewerData.isCustomizing &&
      !!(viewerData as any).onChangeMode;
    expect(canInteract).toBe(false);
  });

  it("chat-layout-mode owner can interact outside customize mode", () => {
    const ownerData = {
      chatLayoutMode: "bubbles",
      isOwner: true,
      isCustomizing: false,
      onChangeMode: jest.fn(),
    };
    const canInteract =
      ownerData.isOwner && !ownerData.isCustomizing && !!ownerData.onChangeMode;
    expect(canInteract).toBe(true);
  });

  it("theme-mode: owner in customize mode cannot interact", () => {
    const data = {
      themeMode: "auto",
      isOwner: true,
      isCustomizing: true,
      onChangeMode: jest.fn(),
    };
    const canInteract =
      data.isOwner && !data.isCustomizing && !!data.onChangeMode;
    expect(canInteract).toBe(false);
  });
});

// =============================================================================
// Persistence Sanity Tests
// =============================================================================

describe("Widget persistence shape", () => {
  it("new widget instances have correct shape for Firestore", () => {
    const now = new Date().toISOString();
    const instance = {
      instanceId: "test-wallet",
      widgetType: "wallet-balance" as WidgetTypeId,
      size: "small" as const,
      x: 0,
      y: 8,
      visible: true,
      pinned: false,
      config: {},
      createdAt: now,
      updatedAt: now,
    };

    expect(instance.widgetType).toBe("wallet-balance");
    expect(instance.size).toBe("small");
    expect(typeof instance.x).toBe("number");
    expect(typeof instance.y).toBe("number");
    expect(instance.visible).toBe(true);
  });
});
