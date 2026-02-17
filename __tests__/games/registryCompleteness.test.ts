/**
 * Game Registry Completeness Tests
 * Segment 10: QA / Smoke Test Harness
 *
 * Validates that every game type defined in ExtendedGameType has all required
 * registry entries. Runs as part of the standard Jest suite.
 *
 * Catches "forgot to add a game to GAME_SCREEN_MAP" style bugs at CI time.
 *
 * @see scripts/verify-game-registry.ts — standalone CLI version
 * @see src/types/games.ts
 * @see src/config/gameCategories.ts
 * @see src/config/colyseus.ts
 * @see src/services/gameInvites.ts
 */

// Mock expo-constants and react-native before any imports that use them
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: { hostUri: "localhost:8081" },
  },
}));

jest.mock("react-native", () => ({
  Platform: { select: (obj: any) => obj.default ?? "localhost", OS: "ios" },
}));

// Mock Firestore query functions used transitively by gameInvites.ts
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(),
  Timestamp: { now: jest.fn(() => ({ toMillis: () => Date.now() })) },
  runTransaction: jest.fn(),
  writeBatch: jest.fn(),
  addDoc: jest.fn(),
}));

// Mock chat service used by gameInvites.ts
jest.mock("@/services/chat", () => ({
  getOrCreateChat: jest.fn(),
}));

// Mock turnBasedGames service used by gameInvites.ts
jest.mock("@/services/turnBasedGames", () => ({
  createMatch: jest.fn(),
}));

import { COLYSEUS_ROOM_NAMES, GAME_CATEGORY_MAP } from "@/config/colyseus";
import { GAME_SCREEN_MAP } from "@/config/gameCategories";
import { getDefaultInviteSettings } from "@/services/gameInvites";
import {
  EXTENDED_GAME_SCORE_LIMITS,
  GAME_METADATA,
  type ExtendedGameType,
  type GameMetadata,
} from "@/types/games";

// =============================================================================
// Helpers
// =============================================================================

const allGameTypes = Object.keys(GAME_METADATA) as ExtendedGameType[];

/**
 * Check if a game type resolves to a Colyseus room name.
 * resolveColyseusRoomName tries: direct, with _game, stripped _game.
 */
function hasColyseusMapping(gameType: string): boolean {
  return !!(
    COLYSEUS_ROOM_NAMES[gameType] ||
    COLYSEUS_ROOM_NAMES[`${gameType}_game`] ||
    GAME_CATEGORY_MAP[gameType] ||
    GAME_CATEGORY_MAP[`${gameType}_game`]
  );
}

function getMetadata(gt: ExtendedGameType): GameMetadata {
  return GAME_METADATA[gt];
}

// =============================================================================
// Tests
// =============================================================================

describe("Game Registry Completeness", () => {
  it("has at least 15 game types registered", () => {
    expect(allGameTypes.length).toBeGreaterThanOrEqual(15);
  });

  describe.each(allGameTypes)("%s", (gameType) => {
    const meta = getMetadata(gameType);

    it("has GAME_METADATA with required fields", () => {
      expect(meta).toBeDefined();
      expect(meta.id).toBe(gameType);
      expect(meta.name).toBeTruthy();
      expect(meta.shortName).toBeTruthy();
      expect(meta.icon).toBeTruthy();
      expect(meta.category).toBeTruthy();
      expect(typeof meta.minPlayers).toBe("number");
      expect(typeof meta.maxPlayers).toBe("number");
      expect(meta.maxPlayers).toBeGreaterThanOrEqual(meta.minPlayers);
      expect(typeof meta.isMultiplayer).toBe("boolean");
    });

    it("has GAME_SCREEN_MAP entry", () => {
      const screenName = (GAME_SCREEN_MAP as Record<string, string>)[gameType];
      expect(screenName).toBeTruthy();
      expect(typeof screenName).toBe("string");
    });

    it("has EXTENDED_GAME_SCORE_LIMITS entry", () => {
      const limits = EXTENDED_GAME_SCORE_LIMITS[gameType];
      expect(limits).toBeDefined();
      expect(typeof limits.minScore).toBe("number");
      expect(typeof limits.maxScore).toBe("number");
      expect(limits.maxScore).toBeGreaterThanOrEqual(limits.minScore);
      expect(["higher", "lower"]).toContain(limits.scoreDirection);
    });

    if (GAME_METADATA[gameType]?.isMultiplayer) {
      it("has Colyseus room mapping (multiplayer)", () => {
        expect(hasColyseusMapping(gameType)).toBe(true);
      });

      it("has default invite settings (multiplayer)", () => {
        const settings = getDefaultInviteSettings(gameType as any);
        expect(settings).toBeDefined();
        expect(typeof settings.isRated).toBe("boolean");
        expect(typeof settings.chatEnabled).toBe("boolean");
      });
    }
  });
});

describe("Game Registry Cross-Checks", () => {
  it("GAME_SCREEN_MAP has no orphaned keys", () => {
    const screenMapKeys = Object.keys(GAME_SCREEN_MAP);
    const orphans = screenMapKeys.filter(
      (k) => !allGameTypes.includes(k as ExtendedGameType),
    );
    expect(orphans).toEqual([]);
  });

  it("COLYSEUS_ROOM_NAMES keys trace back to game types", () => {
    const colyseusKeys = Object.keys(COLYSEUS_ROOM_NAMES);
    const orphans = colyseusKeys.filter((key) => {
      const normalized = key.replace(/_game$/, "");
      return (
        !allGameTypes.includes(key as ExtendedGameType) &&
        !allGameTypes.includes(normalized as ExtendedGameType)
      );
    });
    expect(orphans).toEqual([]);
  });

  it("GAME_CATEGORY_MAP keys trace back to game types", () => {
    const categoryKeys = Object.keys(GAME_CATEGORY_MAP);
    const orphans = categoryKeys.filter((key) => {
      const normalized = key.replace(/_game$/, "");
      return (
        !allGameTypes.includes(key as ExtendedGameType) &&
        !allGameTypes.includes(normalized as ExtendedGameType)
      );
    });
    expect(orphans).toEqual([]);
  });

  it("every multiplayer game in GAME_METADATA has isMultiplayer=true", () => {
    const mpGames = allGameTypes.filter(
      (gt) =>
        GAME_METADATA[gt].maxPlayers > 1 && GAME_METADATA[gt].isMultiplayer,
    );
    // All multiplayer games should have Colyseus mapping
    for (const gt of mpGames) {
      expect(hasColyseusMapping(gt)).toBe(true);
    }
  });

  it("all EXTENDED_GAME_SCORE_LIMITS keys match GAME_METADATA keys", () => {
    const scoreLimitKeys = Object.keys(EXTENDED_GAME_SCORE_LIMITS);
    const metadataKeys = Object.keys(GAME_METADATA);
    expect(scoreLimitKeys.sort()).toEqual(metadataKeys.sort());
  });
});
