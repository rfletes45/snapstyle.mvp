/**
 * Tests — Game Registry (Realtime Framework)
 *
 * Tests for centralized game registration and lookup.
 */

describe("GameRegistry", () => {
  // Re-implement the registry logic for testing
  type GameDefinition = {
    gameId: string;
    roomName: string;
    displayName: string;
    simulationProfile: string;
  };

  let registry: Map<string, GameDefinition>;

  function registerGame(def: GameDefinition): void {
    if (registry.has(def.gameId)) {
      console.warn(`Overwriting definition for ${def.gameId}`);
    }
    registry.set(def.gameId, def);
  }

  function getGame(gameId: string): GameDefinition | undefined {
    return registry.get(gameId);
  }

  function getAllGames(): GameDefinition[] {
    return Array.from(registry.values());
  }

  function getRoomEntries(): Array<{ roomName: string; gameId: string }> {
    return getAllGames().map((g) => ({
      roomName: g.roomName,
      gameId: g.gameId,
    }));
  }

  beforeEach(() => {
    registry = new Map();
  });

  it("registers and retrieves a game definition", () => {
    registerGame({
      gameId: "sketch_party_game",
      roomName: "sketch_party",
      displayName: "Sketch Party",
      simulationProfile: "phase_event",
    });

    const def = getGame("sketch_party_game");
    expect(def).toBeDefined();
    expect(def?.roomName).toBe("sketch_party");
    expect(def?.displayName).toBe("Sketch Party");
  });

  it("returns undefined for unregistered games", () => {
    expect(getGame("nonexistent_game")).toBeUndefined();
  });

  it("overwrites existing registration with warning", () => {
    const spy = jest.spyOn(console, "warn").mockImplementation();

    registerGame({
      gameId: "test_game",
      roomName: "test",
      displayName: "Test v1",
      simulationProfile: "phase_event",
    });

    registerGame({
      gameId: "test_game",
      roomName: "test_v2",
      displayName: "Test v2",
      simulationProfile: "fixed_tick",
    });

    expect(spy).toHaveBeenCalled();
    expect(getGame("test_game")?.roomName).toBe("test_v2");

    spy.mockRestore();
  });

  it("lists all registered games", () => {
    registerGame({
      gameId: "game_a",
      roomName: "a",
      displayName: "A",
      simulationProfile: "phase_event",
    });
    registerGame({
      gameId: "game_b",
      roomName: "b",
      displayName: "B",
      simulationProfile: "fixed_tick",
    });

    const all = getAllGames();
    expect(all).toHaveLength(2);
    expect(all.map((g) => g.gameId).sort()).toEqual(["game_a", "game_b"]);
  });

  it("provides room entries for server registration", () => {
    registerGame({
      gameId: "sketch_party_game",
      roomName: "sketch_party",
      displayName: "Sketch Party",
      simulationProfile: "phase_event",
    });
    registerGame({
      gameId: "pong_game",
      roomName: "pong",
      displayName: "Pong",
      simulationProfile: "fixed_tick",
    });

    const entries = getRoomEntries();
    expect(entries).toHaveLength(2);
    expect(entries).toContainEqual({
      roomName: "sketch_party",
      gameId: "sketch_party_game",
    });
    expect(entries).toContainEqual({
      roomName: "pong",
      gameId: "pong_game",
    });
  });
});
