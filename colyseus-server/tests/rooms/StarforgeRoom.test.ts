/**
 * StarforgeRoom tests — schema defaults, co-op presence, and pure sim integration.
 *
 * Follows the project pattern of testing schema classes and pure logic in isolation
 * rather than full Colyseus room lifecycle.
 */

// Mock firebase + persistence services
jest.mock("../../src/services/firebase", () => ({
  initializeFirebaseAdmin: jest.fn(),
  verifyFirebaseToken: jest.fn().mockResolvedValue({
    uid: "test-uid-1",
    name: "Player 1",
  }),
  getFirestoreDb: jest.fn().mockReturnValue(null),
}));

jest.mock("../../src/services/coldStorage", () => ({
  saveSnapshot: jest.fn().mockResolvedValue(true),
  loadSnapshot: jest.fn().mockResolvedValue(null),
  deleteSnapshot: jest.fn().mockResolvedValue(true),
}));

import { MapSchema, ArraySchema } from "@colyseus/schema";
import {
  StarforgeState,
  StarforgeResources,
  StarforgeResourceCaps,
  StarforgeMachineStack,
  StarforgeStats,
  StarforgeWrecksField,
  StarforgeContractState,
  StarforgeEventState,
  StarforgeMilestoneState,
  StarforgeCoopPresence,
} from "../../src/schemas/starforge";

// ─── Schema Defaults ────────────────────────────────────────

describe("StarforgeState Schema", () => {
  it("has correct default values", () => {
    const state = new StarforgeState();
    expect(state.tick).toBe(0);
    expect(state.seed).toBe(12345);
    expect(state.gameType).toBe("");
    expect(state.phase).toBe("waiting");
  });

  it("creates resources with zero defaults", () => {
    const resources = new StarforgeResources();
    expect(resources.flux).toBe(0);
    expect(resources.alloy).toBe(0);
    expect(resources.signal).toBe(0);
  });

  it("creates resource caps with correct defaults", () => {
    const caps = new StarforgeResourceCaps();
    expect(caps.flux).toBe(10000);
    expect(caps.alloy).toBe(5000);
    expect(caps.signal).toBe(3000);
  });

  it("creates stats with zero defaults", () => {
    const stats = new StarforgeStats();
    expect(stats.totalFluxEarned).toBe(0);
    expect(stats.totalTaps).toBe(0);
    expect(stats.overflowLost).toBe(0);
  });

  it("creates empty machines MapSchema", () => {
    const state = new StarforgeState();
    expect(state.machines).toBeInstanceOf(MapSchema);
    expect(state.machines.size).toBe(0);
  });

  it("creates empty upgrades ArraySchema", () => {
    const state = new StarforgeState();
    expect(state.upgradesPurchased).toBeInstanceOf(ArraySchema);
    expect(state.upgradesPurchased.length).toBe(0);
  });
});

// ─── Machine Stack ──────────────────────────────────────────

describe("StarforgeMachineStack", () => {
  it("has correct default values", () => {
    const stack = new StarforgeMachineStack();
    expect(stack.code).toBe("");
    expect(stack.count).toBe(0);
    expect(stack.tier).toBe(1);
    expect(stack.level).toBe(1);
    expect(stack.enabled).toBe(true);
  });

  it("can be added to state machines MapSchema", () => {
    const state = new StarforgeState();
    const stack = new StarforgeMachineStack();
    stack.code = "smelter";
    stack.count = 5;
    stack.tier = 2;
    state.machines.set("smelter", stack);

    expect(state.machines.size).toBe(1);
    expect(state.machines.get("smelter")?.count).toBe(5);
    expect(state.machines.get("smelter")?.tier).toBe(2);
  });
});

// ─── Wrecks ─────────────────────────────────────────────────

describe("StarforgeWrecksField", () => {
  it("has default values", () => {
    const wrecks = new StarforgeWrecksField();
    expect(wrecks.nextId).toBe(0);
    expect(wrecks.lastSpawnRollTick).toBe(0);
    expect(wrecks.active).toBeInstanceOf(MapSchema);
    expect(wrecks.active.size).toBe(0);
  });
});

// ─── Contracts ──────────────────────────────────────────────

describe("StarforgeContractState", () => {
  it("has default values", () => {
    const contracts = new StarforgeContractState();
    expect(contracts.active).toBeNull();
    expect(contracts.revealed).toBeInstanceOf(ArraySchema);
    expect(contracts.revealed.length).toBe(0);
    expect(contracts.completed).toBeInstanceOf(ArraySchema);
    expect(contracts.completed.length).toBe(0);
    expect(contracts.lastRevealRollTick).toBe(0);
  });
});

// ─── Events ─────────────────────────────────────────────────

describe("StarforgeEventState", () => {
  it("has default values", () => {
    const events = new StarforgeEventState();
    expect(events.activeEvent).toBeNull();
    expect(events.lastSpawnRollTick).toBe(0);
    expect(events.prodBoosts).toBeInstanceOf(ArraySchema);
    expect(events.prodBoosts.length).toBe(0);
    expect(events.capBoosts).toBeInstanceOf(ArraySchema);
    expect(events.capBoosts.length).toBe(0);
  });
});

// ─── Milestones ─────────────────────────────────────────────

describe("StarforgeMilestoneState", () => {
  it("has default values", () => {
    const milestones = new StarforgeMilestoneState();
    expect(milestones.claimed).toBeInstanceOf(ArraySchema);
    expect(milestones.claimed.length).toBe(0);
    expect(milestones.pendingToast).toBeInstanceOf(ArraySchema);
    expect(milestones.pendingToast.length).toBe(0);
  });
});

// ─── Cooperative Presence ───────────────────────────────────

describe("StarforgeCoopPresence", () => {
  it("has correct default values", () => {
    const presence = new StarforgeCoopPresence();
    expect(presence.uid).toBe("");
    expect(presence.displayName).toBe("");
    expect(presence.lastAction).toBe("");
    expect(presence.lastActionTick).toBe(0);
    expect(presence.totalInputs).toBe(0);
    expect(presence.online).toBe(true);
  });

  it("can be added to coopPresence MapSchema", () => {
    const state = new StarforgeState();
    const presence = new StarforgeCoopPresence();
    presence.uid = "user-123";
    presence.displayName = "Alice";
    presence.lastAction = "TAP";
    presence.lastActionTick = 100;
    presence.totalInputs = 42;
    presence.online = true;

    state.coopPresence.set("session-abc", presence);

    expect(state.coopPresence.size).toBe(1);
    const p = state.coopPresence.get("session-abc");
    expect(p?.uid).toBe("user-123");
    expect(p?.displayName).toBe("Alice");
    expect(p?.lastAction).toBe("TAP");
    expect(p?.totalInputs).toBe(42);
  });

  it("can track player going offline", () => {
    const presence = new StarforgeCoopPresence();
    presence.online = true;
    expect(presence.online).toBe(true);

    presence.online = false;
    expect(presence.online).toBe(false);
  });
});

// ─── State Composition ──────────────────────────────────────

describe("StarforgeState — composition", () => {
  it("tracks multiple machines", () => {
    const state = new StarforgeState();
    const machines = ["smelter", "harvester", "refinery"];
    machines.forEach((code, i) => {
      const stack = new StarforgeMachineStack();
      stack.code = code;
      stack.count = (i + 1) * 3;
      state.machines.set(code, stack);
    });

    expect(state.machines.size).toBe(3);
    expect(state.machines.get("harvester")?.count).toBe(6);
  });

  it("tracks multiple co-op players", () => {
    const state = new StarforgeState();

    const p1 = new StarforgeCoopPresence();
    p1.uid = "uid-1";
    p1.displayName = "Alice";
    p1.totalInputs = 10;

    const p2 = new StarforgeCoopPresence();
    p2.uid = "uid-2";
    p2.displayName = "Bob";
    p2.totalInputs = 7;

    state.coopPresence.set("session-1", p1);
    state.coopPresence.set("session-2", p2);

    expect(state.coopPresence.size).toBe(2);
    expect(state.coopPresence.get("session-1")?.displayName).toBe("Alice");
    expect(state.coopPresence.get("session-2")?.displayName).toBe("Bob");
  });

  it("resource values can be updated", () => {
    const state = new StarforgeState();
    state.resources.flux = 5000;
    state.resources.alloy = 2500;
    state.resources.signal = 1000;

    expect(state.resources.flux).toBe(5000);
    expect(state.resources.alloy).toBe(2500);
    expect(state.resources.signal).toBe(1000);
  });

  it("tick and seed can be updated", () => {
    const state = new StarforgeState();
    state.tick = 12345;
    state.seed = 99999;
    state.gameType = "starforge_game";
    state.phase = "playing";

    expect(state.tick).toBe(12345);
    expect(state.seed).toBe(99999);
    expect(state.gameType).toBe("starforge_game");
    expect(state.phase).toBe("playing");
  });
});
