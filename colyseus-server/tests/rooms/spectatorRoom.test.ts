/**
 * Tests for SpectatorRoom throttling, capacity, and load shedding
 *
 * These tests verify the static load tier configuration and the
 * throttle/capacity behaviours introduced in Segment 8.
 */

describe("SpectatorRoom — load shedding config", () => {
  // We can't easily instantiate a Colyseus Room in a unit test,
  // but we CAN test the static configuration and utility logic.

  // Import the class to read its statics
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { SpectatorRoom } = require("../../src/rooms/spectator/SpectatorRoom");

  it("LOAD_TIERS is defined and sorted ascending by maxSpectators", () => {
    const tiers = (SpectatorRoom as any).LOAD_TIERS;
    expect(Array.isArray(tiers)).toBe(true);
    expect(tiers.length).toBeGreaterThanOrEqual(3);

    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i].maxSpectators).toBeGreaterThanOrEqual(
        tiers[i - 1].maxSpectators,
      );
    }
  });

  it("last LOAD_TIER covers Infinity (catch-all)", () => {
    const tiers = (SpectatorRoom as any).LOAD_TIERS;
    const last = tiers[tiers.length - 1];
    expect(last.maxSpectators).toBe(Infinity);
  });

  it("all patchRates are positive numbers in [50, 2000]", () => {
    const tiers = (SpectatorRoom as any).LOAD_TIERS;
    for (const tier of tiers) {
      expect(tier.patchRate).toBeGreaterThanOrEqual(50);
      expect(tier.patchRate).toBeLessThanOrEqual(2000);
    }
  });

  it("higher spectator tiers have equal or slower patchRate", () => {
    const tiers = (SpectatorRoom as any).LOAD_TIERS;
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i].patchRate).toBeGreaterThanOrEqual(tiers[i - 1].patchRate);
    }
  });

  it("maxClients is large enough for host + maxSpectators soft cap", () => {
    const room = new SpectatorRoom();
    // maxClients should be at least 1 (host) + soft cap number
    expect(room.maxClients).toBeGreaterThanOrEqual(11);
  });

  it("default patchRate is the lowest tier rate", () => {
    const tiers = (SpectatorRoom as any).LOAD_TIERS;
    const room = new SpectatorRoom();
    expect(room.patchRate).toBe(tiers[0].patchRate);
  });
});

describe("SpectatorRoom — throttle logic", () => {
  it("gameStateJsonMinIntervalMs defaults to 500", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {
      SpectatorRoom,
    } = require("../../src/rooms/spectator/SpectatorRoom");
    const room = new SpectatorRoom();
    expect((room as any).gameStateJsonMinIntervalMs).toBe(500);
  });

  it("droppedGameStateUpdates starts at 0", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {
      SpectatorRoom,
    } = require("../../src/rooms/spectator/SpectatorRoom");
    const room = new SpectatorRoom();
    expect((room as any).droppedGameStateUpdates).toBe(0);
  });
});
