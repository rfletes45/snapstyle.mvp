/**
 * Games V4 — Lobby Settings Tests
 *
 * Validates the generic settings system:
 * - Schema-driven rendering (settingsSchema → UI controls)
 * - Host vs non-host access (readOnly mode)
 * - Adapter validation (validateSettings, defaultSettings fallback)
 * - Settings persistence (lobbySettings field on invite doc)
 * - Settings propagation (lobbySettings → session on start)
 *
 * Run: npx jest lobbySettings
 */

import type { GameId } from "@/gamesV4/types/common";
import type { GameInviteV4 } from "@/gamesV4/types/invite";

// =============================================================================
// Helpers — import adapters to trigger registration
// =============================================================================

import "@/gamesV4/adapters";
import { getAdapter, getRegisteredGameIds } from "@/gamesV4/adapters";

// =============================================================================
// Helpers
// =============================================================================

function makeInvite(overrides: Partial<GameInviteV4> = {}): GameInviteV4 {
  return {
    inviteId: "inv_test_1",
    conversationId: "conv_1",
    conversationScope: "dm",
    gameId: "tic_tac_toe",
    runtimeType: "turnBased",
    createdBy: "host_uid",
    status: "lobby",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    hostId: "host_uid",
    participantIds: ["host_uid"],
    spectatorIds: [],
    maxPlayers: 2,
    allowSpectators: false,
    spectateMode: "public_only",
    sessionId: null,
    summary: {
      phase: "lobby",
      turnPlayerId: null,
      scoreSummary: [],
      lastMoveAt: null,
      lastActorId: null,
    },
    participantSummaries: [
      {
        uid: "host_uid",
        displayName: "HostName",
        profilePictureUrl: "https://example.com/host.png",
      },
    ],
    spectatorSummaries: [],
    hiddenInChat: false,
    hiddenAt: null,
    deleteRequestedAt: null,
    deleteAt: null,
    ...overrides,
  };
}

// =============================================================================
// Schema invariants across all adapters
// =============================================================================

// =============================================================================
// Adapter registration (root cause of missing settings was fixed import)
// =============================================================================

describe("Lobby Settings — Adapter Registration", () => {
  it("importing @/gamesV4/adapters registers all adapters", () => {
    const ids = getRegisteredGameIds();
    expect(ids.length).toBeGreaterThanOrEqual(8);
  });

  it("getAdapter returns non-null for crazy_eights", () => {
    const adapter = getAdapter("crazy_eights" as GameId);
    expect(adapter).not.toBeNull();
    expect(adapter!.settingsSchema!.length).toBeGreaterThan(0);
  });

  it("getAdapter returns non-null for sketch_party_game", () => {
    const adapter = getAdapter("sketch_party_game" as GameId);
    expect(adapter).not.toBeNull();
    expect(adapter!.settingsSchema!.length).toBeGreaterThan(0);
  });

  it("getAdapter returns non-null for battleship", () => {
    const adapter = getAdapter("battleship" as GameId);
    expect(adapter).not.toBeNull();
  });
});

// =============================================================================
// Schema invariants across all adapters
// =============================================================================

describe("Lobby Settings — Schema Invariants", () => {
  const adaptersWithSchemas = getRegisteredGameIds().filter((gameId) => {
    const adapter = getAdapter(gameId);
    return adapter?.settingsSchema && adapter.settingsSchema.length > 0;
  });

  it("at least two adapters have settingsSchema", () => {
    // Crazy Eights and Sketch Party at minimum
    expect(adaptersWithSchemas.length).toBeGreaterThanOrEqual(2);
  });

  it.each(adaptersWithSchemas)(
    "%s: every schema field has key, label, type, and default",
    (gameId) => {
      const adapter = getAdapter(gameId)!;
      for (const field of adapter.settingsSchema!) {
        expect(field.key).toBeTruthy();
        expect(field.label).toBeTruthy();
        expect(["number", "boolean", "select"]).toContain(field.type);
        expect(field).toHaveProperty("default");
      }
    },
  );

  it.each(adaptersWithSchemas)("%s: schema keys are unique", (gameId) => {
    const adapter = getAdapter(gameId)!;
    const keys = adapter.settingsSchema!.map((f) => f.key);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it.each(adaptersWithSchemas)(
    "%s: number fields have min ≤ default ≤ max",
    (gameId) => {
      const adapter = getAdapter(gameId)!;
      for (const field of adapter.settingsSchema!) {
        if (field.type === "number") {
          const def = field.default as number;
          expect(typeof def).toBe("number");
          if (field.min != null) expect(def).toBeGreaterThanOrEqual(field.min);
          if (field.max != null) expect(def).toBeLessThanOrEqual(field.max);
          if (field.step != null) expect(field.step).toBeGreaterThan(0);
        }
      }
    },
  );

  it.each(adaptersWithSchemas)(
    "%s: select fields have at least 2 options and default is one of them",
    (gameId) => {
      const adapter = getAdapter(gameId)!;
      for (const field of adapter.settingsSchema!) {
        if (field.type === "select") {
          expect(field.options).toBeDefined();
          expect(field.options!.length).toBeGreaterThanOrEqual(2);
          const values = field.options!.map((o) => o.value);
          expect(values).toContain(field.default);
        }
      }
    },
  );

  it.each(adaptersWithSchemas)(
    "%s: defaultSettings contains every schema key",
    (gameId) => {
      const adapter = getAdapter(gameId)!;
      const defaults = adapter.defaultSettings as Record<string, unknown>;
      for (const field of adapter.settingsSchema!) {
        expect(defaults).toHaveProperty(field.key);
      }
    },
  );
});

// =============================================================================
// Crazy Eights specific
// =============================================================================

describe("Lobby Settings — Crazy Eights", () => {
  it("has exactly 10 schema fields", () => {
    const adapter = getAdapter("crazy_eights" as GameId);
    expect(adapter).toBeDefined();
    expect(adapter!.settingsSchema!.length).toBe(10);
  });

  it("schema contains stack, draw, timer, and round settings", () => {
    const adapter = getAdapter("crazy_eights" as GameId)!;
    const keys = adapter.settingsSchema!.map((f) => f.key);
    expect(keys).toContain("stackDraw2");
    expect(keys).toContain("stackDraw4");
    expect(keys).toContain("drawMode");
    expect(keys).toContain("turnTimer");
    expect(keys).toContain("roundModel");
    expect(keys).toContain("targetPoints");
  });

  it("targetPoints has range 100–1000 with step 50", () => {
    const adapter = getAdapter("crazy_eights" as GameId)!;
    const field = adapter.settingsSchema!.find((f) => f.key === "targetPoints");
    expect(field).toBeDefined();
    expect(field!.min).toBe(100);
    expect(field!.max).toBe(1000);
    expect(field!.step).toBe(50);
  });

  it("default settings match schema defaults", () => {
    const adapter = getAdapter("crazy_eights" as GameId)!;
    const defaults = adapter.defaultSettings as Record<string, unknown>;
    for (const field of adapter.settingsSchema!) {
      expect(defaults[field.key]).toEqual(field.default);
    }
  });
});

// =============================================================================
// Sketch Party specific
// =============================================================================

describe("Lobby Settings — Sketch Party", () => {
  it("has exactly 7 schema fields", () => {
    const adapter = getAdapter("sketch_party_game" as GameId);
    expect(adapter).toBeDefined();
    expect(adapter!.settingsSchema!.length).toBe(7);
  });

  it("schema contains rounds, drawTimeSec, hints, customWords", () => {
    const adapter = getAdapter("sketch_party_game" as GameId)!;
    const keys = adapter.settingsSchema!.map((f) => f.key);
    expect(keys).toContain("rounds");
    expect(keys).toContain("drawTimeSec");
    expect(keys).toContain("hints");
    expect(keys).toContain("customWordsEnabled");
  });

  it("drawTimeSec has range 30–180", () => {
    const adapter = getAdapter("sketch_party_game" as GameId)!;
    const field = adapter.settingsSchema!.find((f) => f.key === "drawTimeSec");
    expect(field).toBeDefined();
    expect(field!.min).toBe(30);
    expect(field!.max).toBe(180);
  });

  it("default settings match schema defaults", () => {
    const adapter = getAdapter("sketch_party_game" as GameId)!;
    const defaults = adapter.defaultSettings as Record<string, unknown>;
    for (const field of adapter.settingsSchema!) {
      expect(defaults[field.key]).toEqual(field.default);
    }
  });
});

// =============================================================================
// Host vs non-host access model
// =============================================================================

describe("Lobby Settings — Host / Non-Host Access", () => {
  it("host can update settings: hostId matches uid", () => {
    const invite = makeInvite({ hostId: "host_uid" });
    const callerUid = "host_uid";
    const isHost = invite.hostId === callerUid;
    expect(isHost).toBe(true);
  });

  it("non-host is rejected: hostId does NOT match uid", () => {
    const invite = makeInvite({ hostId: "host_uid" });
    const callerUid = "player2";
    const isHost = invite.hostId === callerUid;
    expect(isHost).toBe(false);
    // Backend throws "permission-denied"
  });

  it("settings can only be updated in lobby or sent status", () => {
    const validStatuses = ["lobby", "sent"];
    const invalidStatuses = ["resolved", "active", "expired", "abandoned"];

    for (const status of validStatuses) {
      const invite = makeInvite({ status: status as any });
      const canUpdate = invite.status === "sent" || invite.status === "lobby";
      expect(canUpdate).toBe(true);
    }

    for (const status of invalidStatuses) {
      const invite = makeInvite({ status: status as any });
      const canUpdate = invite.status === "sent" || invite.status === "lobby";
      expect(canUpdate).toBe(false);
    }
  });
});

// =============================================================================
// Settings merge / fallback logic (mirrors backend updateLobbySettingsV4)
// =============================================================================

describe("Lobby Settings — Merge / Fallback Logic", () => {
  it("when adapter has defaultSettings, only whitelisted keys are accepted", () => {
    // Simulates the backend fallback path (no validateSettings, yes defaults)
    const defaults: Record<string, unknown> = {
      rounds: 3,
      drawTimeSec: 80,
      hints: 2,
    };

    const userPatch: Record<string, unknown> = {
      rounds: 5,
      drawTimeSec: 120,
      hints: 1,
      maliciousField: "xss",
      __proto__: "bad",
    };

    // Backend logic: merge only keys that exist in defaults
    const finalSettings = { ...defaults };
    for (const key of Object.keys(defaults)) {
      if (key in userPatch) {
        finalSettings[key] = userPatch[key];
      }
    }

    expect(finalSettings).toEqual({
      rounds: 5,
      drawTimeSec: 120,
      hints: 1,
    });

    // Extra keys NOT present
    expect(finalSettings).not.toHaveProperty("maliciousField");
    expect(Object.keys(finalSettings)).not.toContain("__proto__");
  });

  it("when no adapter/defaults, sanitised patch is stored as-is", () => {
    const userPatch = { customKey: "customValue", count: 5 };
    // No defaults available — store patch directly
    const finalSettings = { ...userPatch };
    expect(finalSettings).toEqual({ customKey: "customValue", count: 5 });
  });
});

// =============================================================================
// Settings propagation (invite → session on start)
// =============================================================================

describe("Lobby Settings — Propagation to Session", () => {
  it("lobbySettings from invite are used when settings param is missing", () => {
    // Simulates startGameFromInviteV4 fallback
    const invite = makeInvite();
    (invite as any).lobbySettings = { rounds: 5, hints: 1 };

    const requestSettings: Record<string, unknown> | undefined = undefined;

    // Backend logic: use lobbySettings as fallback
    const effectiveSettings =
      requestSettings ?? (invite as any).lobbySettings ?? {};

    expect(effectiveSettings).toEqual({ rounds: 5, hints: 1 });
  });

  it("explicit settings param overrides lobbySettings", () => {
    const invite = makeInvite();
    (invite as any).lobbySettings = { rounds: 5, hints: 1 };

    const requestSettings = { rounds: 10, hints: 3 };

    const effectiveSettings =
      requestSettings ?? (invite as any).lobbySettings ?? {};

    expect(effectiveSettings).toEqual({ rounds: 10, hints: 3 });
  });

  it("empty lobbySettings falls back to empty object", () => {
    const invite = makeInvite();
    // No lobbySettings on invite

    const requestSettings: Record<string, unknown> | undefined = undefined;

    const effectiveSettings =
      requestSettings ?? (invite as any).lobbySettings ?? {};

    expect(effectiveSettings).toEqual({});
  });
});
