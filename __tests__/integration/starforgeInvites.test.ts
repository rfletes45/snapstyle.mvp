/**
 * Starforge game invite integration test.
 *
 * Tests that starforge_game is properly registered across the game system:
 * - Type unions include starforge_game
 * - GAME_METADATA entry exists
 * - GAME_SCREEN_MAP routes to StarforgeGame
 * - Colyseus config includes the room
 * - Feature flags enable the incremental category
 */

import { COLYSEUS_FEATURES } from "../../constants/featureFlags";
import {
  COLYSEUS_ROOM_NAMES,
  GAME_CATEGORY_MAP,
} from "../../src/config/colyseus";
import { GAME_SCREEN_MAP } from "../../src/config/gameCategories";
import {
  GAME_METADATA,
  GAME_SCORE_LIMITS,
  formatGameScore,
} from "../../src/types/games";

describe("Starforge game type registration", () => {
  it("has GAME_METADATA entry", () => {
    const meta = GAME_METADATA.starforge_game;
    expect(meta).toBeDefined();
    expect(meta.name).toBe("Starforge");
    expect(meta.minPlayers).toBe(1);
    expect(meta.maxPlayers).toBe(2);
    expect(meta.category).toBe("multiplayer");
  });

  it("has GAME_SCORE_LIMITS entry", () => {
    const limits = GAME_SCORE_LIMITS.starforge_game;
    expect(limits).toBeDefined();
    expect(limits.maxScore).toBe(999999999);
    expect(limits.scoreDirection).toBe("higher");
  });

  it("formats game score as flux", () => {
    const formatted = formatGameScore("starforge_game", 150000);
    expect(formatted).toContain("flux");
    expect(formatted).toContain("150.0");
  });

  it("maps to StarforgeGame screen", () => {
    expect(GAME_SCREEN_MAP.starforge_game).toBe("StarforgeGame");
  });

  it("has Colyseus room name mapping", () => {
    expect(COLYSEUS_ROOM_NAMES.starforge_game).toBe("starforge");
  });

  it("maps to incremental game category", () => {
    expect(GAME_CATEGORY_MAP.starforge_game).toBe("incremental");
  });

  it("has incremental feature flag enabled", () => {
    expect(COLYSEUS_FEATURES.INCREMENTAL_ENABLED).toBe(true);
  });
});
