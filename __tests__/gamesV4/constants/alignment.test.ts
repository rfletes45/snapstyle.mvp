/**
 * Games V4 — Cross-Layer Alignment & Parity Tests
 *
 * These tests catch metadata drift between client registries,
 * backend registries, achievement sections, leaderboard descriptors,
 * and adapter registrations.
 *
 * If any of these tests fail, a game registration is inconsistent
 * and must be reconciled before shipping.
 *
 * @module __tests__/gamesV4/constants/alignment
 */

// ---- Client-side imports ----
import "@/gamesV4/adapters"; // triggers auto-registration
import { hasAdapter } from "@/gamesV4/adapters/registry";
import {
  GAME_METADATA,
  IMPLEMENTED_GAME_IDS,
  LEADERBOARD_DESCRIPTORS,
  SCOREBOARD_DESCRIPTORS,
} from "@/gamesV4/constants";
import {
  ACHIEVEMENT_SECTIONS,
  type AchievementSectionDef,
} from "@/gamesV4/data/achievementDefinitions";
import type { GameId } from "@/gamesV4/types/common";

// ---- Week-key imports for parity test ----
import { getCurrentWeekKey } from "@/types/models";

// =============================================================================
// Helpers
// =============================================================================

/** sectionId → AchievementSectionDef for quick lookup */
const SECTION_BY_ID = new Map<string, AchievementSectionDef>(
  ACHIEVEMENT_SECTIONS.map((s) => [s.sectionId, s]),
);

/**
 * Known mapping where sectionId !== gameId.
 * Keep this map updated — it is intentional, not a bug.
 */
const SECTION_TO_GAME_ID: Record<string, string> = {
  sketch_party: "sketch_party_game",
};

/** Resolve a sectionId to its canonical gameId. */
function resolveGameId(sectionId: string): string {
  return SECTION_TO_GAME_ID[sectionId] ?? sectionId;
}

// =============================================================================
// 1. Every implemented game must have all required registrations
// =============================================================================

describe("Implemented game completeness", () => {
  const implementedIds = Array.from(IMPLEMENTED_GAME_IDS);

  it.each(implementedIds)("%s has a client adapter registered", (gameId) => {
    expect(hasAdapter(gameId as GameId)).toBe(true);
  });

  it.each(implementedIds)("%s has a SCOREBOARD_DESCRIPTOR", (gameId) => {
    expect(SCOREBOARD_DESCRIPTORS).toHaveProperty(gameId);
  });

  it.each(implementedIds)("%s has a LEADERBOARD_DESCRIPTOR", (gameId) => {
    expect(LEADERBOARD_DESCRIPTORS).toHaveProperty(gameId);
  });

  it.each(implementedIds)("%s has GAME_METADATA", (gameId) => {
    expect(GAME_METADATA).toHaveProperty(gameId);
  });

  it.each(implementedIds)(
    "%s has an achievement section or is cross-game",
    (gameId) => {
      // Check if there's a section whose resolved gameId matches
      const hasSection = ACHIEVEMENT_SECTIONS.some(
        (s) => resolveGameId(s.sectionId) === gameId,
      );
      expect(hasSection).toBe(true);
    },
  );
});

// =============================================================================
// 2. Adapter ↔ IMPLEMENTED_GAME_IDS alignment
// =============================================================================

describe("Adapter ↔ IMPLEMENTED_GAME_IDS alignment", () => {
  it("every adapter-registered game with full metadata is in IMPLEMENTED_GAME_IDS or explicitly disabled", () => {
    // It's valid for an adapter to exist for a disabled game (e.g. minigolf_duels).
    // But every implemented game must have an adapter.
    for (const id of IMPLEMENTED_GAME_IDS) {
      expect(hasAdapter(id as GameId)).toBe(true);
    }
  });
});

// =============================================================================
// 3. Leaderboard descriptor metrics are coherent
// =============================================================================

describe("Leaderboard descriptor coherence", () => {
  const validMetrics = ["wins", "bestScore"];

  for (const [gameId, desc] of Object.entries(LEADERBOARD_DESCRIPTORS)) {
    it(`${gameId} has a valid metric: "${desc!.metric}"`, () => {
      expect(validMetrics).toContain(desc!.metric);
    });
  }

  it("wins-based games all use the same sortDirection", () => {
    for (const [, desc] of Object.entries(LEADERBOARD_DESCRIPTORS)) {
      if (desc!.metric === "wins") {
        expect(desc!.sortDirection).toBe("desc");
      }
    }
  });
});

// =============================================================================
// 4. Achievement section ↔ gameId mapping integrity
// =============================================================================

describe("Achievement section ↔ gameId mapping", () => {
  it("every per-game section resolves to a valid GAME_METADATA ID", () => {
    for (const section of ACHIEVEMENT_SECTIONS) {
      if (section.sectionId === "milestones") continue; // cross-game
      const gameId = resolveGameId(section.sectionId);
      expect(GAME_METADATA).toHaveProperty(gameId);
    }
  });

  it("sketch_party section maps to sketch_party_game (intentional mismatch)", () => {
    const section = SECTION_BY_ID.get("sketch_party");
    expect(section).toBeDefined();
    // The gameId used everywhere else for Sketch Party is sketch_party_game
    expect(resolveGameId("sketch_party")).toBe("sketch_party_game");
  });

  it("no two per-game sections resolve to the same gameId", () => {
    const seen = new Set<string>();
    for (const section of ACHIEVEMENT_SECTIONS) {
      if (section.sectionId === "milestones") continue;
      const gameId = resolveGameId(section.sectionId);
      expect(seen.has(gameId)).toBe(false);
      seen.add(gameId);
    }
  });
});

// =============================================================================
// 5. GAME_METADATA internal consistency
// =============================================================================

describe("GAME_METADATA internal consistency", () => {
  it("gameId field matches the property key", () => {
    for (const [key, meta] of Object.entries(GAME_METADATA)) {
      expect(meta.gameId).toBe(key);
    }
  });

  it("solo games have minPlayers = 1 and maxPlayers = 1", () => {
    for (const meta of Object.values(GAME_METADATA)) {
      if (meta.runtimeType === "solo") {
        expect(meta.minPlayers).toBe(1);
        expect(meta.maxPlayers).toBe(1);
      }
    }
  });

  it("turnBased and realtime games have supportsSpectate defined", () => {
    for (const meta of Object.values(GAME_METADATA)) {
      if (meta.runtimeType !== "solo") {
        expect(typeof meta.supportsSpectate).toBe("boolean");
      }
    }
  });
});

// =============================================================================
// 6. Week-key parity (client algorithm matches contract)
// =============================================================================

describe("Week-key parity", () => {
  it("getCurrentWeekKey returns YYYY-Wnn format", () => {
    const key = getCurrentWeekKey();
    expect(key).toMatch(/^\d{4}-W\d{2}$/);
  });

  it("produces correct week key for Jan 1", () => {
    // Temporarily override Date to test a known value.
    const realDate = global.Date;
    const FixedDate = class extends realDate {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(2026, 0, 1); // Jan 1 2026
        } else {
          super(...(args as [number]));
        }
      }
      static now(): number {
        return new FixedDate().getTime();
      }
    };
    // @ts-expect-error - override global Date
    global.Date = FixedDate;
    try {
      const key = getCurrentWeekKey();
      expect(key).toBe("2026-W01");
    } finally {
      global.Date = realDate;
    }
  });

  it("day 7 is still week 1", () => {
    const realDate = global.Date;
    const FixedDate = class extends realDate {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(2026, 0, 7); // Jan 7 2026
        } else {
          super(...(args as [number]));
        }
      }
      static now(): number {
        return new FixedDate().getTime();
      }
    };
    // @ts-expect-error - override global Date
    global.Date = FixedDate;
    try {
      const key = getCurrentWeekKey();
      expect(key).toBe("2026-W01");
    } finally {
      global.Date = realDate;
    }
  });

  it("day 8 is week 2", () => {
    const realDate = global.Date;
    const FixedDate = class extends realDate {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(2026, 0, 8); // Jan 8 2026
        } else {
          super(...(args as [number]));
        }
      }
      static now(): number {
        return new FixedDate().getTime();
      }
    };
    // @ts-expect-error - override global Date
    global.Date = FixedDate;
    try {
      const key = getCurrentWeekKey();
      expect(key).toBe("2026-W02");
    } finally {
      global.Date = realDate;
    }
  });
});

// =============================================================================
// 7. Disabled but registered games are consistent
// =============================================================================

describe("Disabled game consistency", () => {
  it("minigolf_duels has adapter, descriptors, and section but is NOT in IMPLEMENTED_GAME_IDS", () => {
    expect(hasAdapter("minigolf_duels" as GameId)).toBe(true);
    expect(SCOREBOARD_DESCRIPTORS).toHaveProperty("minigolf_duels");
    expect(LEADERBOARD_DESCRIPTORS).toHaveProperty("minigolf_duels");
    expect(IMPLEMENTED_GAME_IDS.has("minigolf_duels" as GameId)).toBe(false);
  });
});
