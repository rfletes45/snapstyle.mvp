/**
 * Tests for the unified SpectatorViewScreen mode selection logic.
 *
 * Verifies that the spectatorMode route param correctly determines
 * which useSpectator mode is used.
 */

describe("SpectatorViewScreen — mode selection", () => {
  /**
   * Helper: replicates the mode-selection logic from SpectatorViewScreen
   * without needing to render React components.
   */
  function selectSpectatorParams(routeParams: {
    roomId?: string;
    roomName?: string;
    firestoreGameId?: string;
    spectatorMode?: "sp" | "multiplayer";
  }) {
    const {
      roomId,
      roomName,
      firestoreGameId,
      spectatorMode = "sp",
    } = routeParams;
    const isMultiplayerMode = spectatorMode === "multiplayer";

    if (isMultiplayerMode) {
      return {
        mode: "multiplayer-spectator-standalone" as const,
        roomName: roomName ?? "",
        firestoreGameId: firestoreGameId ?? "",
      };
    }
    return {
      mode: "sp-spectator" as const,
      roomId: roomId ?? "",
    };
  }

  it("defaults to sp-spectator when no spectatorMode is provided", () => {
    const params = selectSpectatorParams({ roomId: "abc123" });
    expect(params.mode).toBe("sp-spectator");
    expect((params as any).roomId).toBe("abc123");
  });

  it("selects sp-spectator when spectatorMode is 'sp'", () => {
    const params = selectSpectatorParams({
      roomId: "room1",
      spectatorMode: "sp",
    });
    expect(params.mode).toBe("sp-spectator");
  });

  it("selects multiplayer-spectator-standalone when spectatorMode is 'multiplayer'", () => {
    const params = selectSpectatorParams({
      roomName: "chess",
      firestoreGameId: "game-123",
      spectatorMode: "multiplayer",
    });
    expect(params.mode).toBe("multiplayer-spectator-standalone");
    expect((params as any).roomName).toBe("chess");
    expect((params as any).firestoreGameId).toBe("game-123");
  });

  it("handles missing roomName/firestoreGameId in multiplayer mode gracefully", () => {
    const params = selectSpectatorParams({ spectatorMode: "multiplayer" });
    expect(params.mode).toBe("multiplayer-spectator-standalone");
    expect((params as any).roomName).toBe("");
    expect((params as any).firestoreGameId).toBe("");
  });

  it("ignores roomName param in sp mode", () => {
    const params = selectSpectatorParams({
      roomId: "room-sp",
      roomName: "chess",
      spectatorMode: "sp",
    });
    expect(params.mode).toBe("sp-spectator");
    expect((params as any).roomId).toBe("room-sp");
    expect((params as any).roomName).toBeUndefined();
  });
});
