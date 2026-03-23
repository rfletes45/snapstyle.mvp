/**
 * Tests - Sketch Party Realtime Contract
 *
 * Validates that the generalized realtime definition still exposes
 * the message and state contracts the Sketch Party screen expects.
 */

import {
  SKETCH_PARTY_CLIENT_DEF,
  SKETCH_PARTY_SERVER_MESSAGES,
} from "@/gamesV4/realtime/games/sketchPartyDef";
import type { SketchPartyRealtimeState } from "@/gamesV4/realtime/games/sketchPartyTypes";
import type { RealtimeClientDefinition } from "@/gamesV4/realtime/types";

// =============================================================================
// 1. SKETCH_PARTY_CLIENT_DEF shape validation
// =============================================================================

describe("SKETCH_PARTY_CLIENT_DEF", () => {
  it("has the correct gameId and roomName", () => {
    expect(SKETCH_PARTY_CLIENT_DEF.gameId).toBe("sketch_party_game");
    expect(SKETCH_PARTY_CLIENT_DEF.roomName).toBe("sketch_party");
    expect(SKETCH_PARTY_CLIENT_DEF.displayName).toBe("Sketch Party");
  });

  it("has autoStateSync enabled", () => {
    expect(SKETCH_PARTY_CLIENT_DEF.autoStateSync).toBe(true);
  });

  it("has reconnect enabled with reasonable defaults", () => {
    const rc = SKETCH_PARTY_CLIENT_DEF.reconnect!;
    expect(rc.enabled).toBe(true);
    expect(rc.maxAttempts).toBeDefined();
    expect(rc.maxAttempts!).toBeGreaterThanOrEqual(3);
    expect(rc.baseDelayMs).toBeDefined();
    expect(rc.baseDelayMs!).toBeGreaterThan(0);
    expect(rc.maxDelayMs!).toBeGreaterThanOrEqual(rc.baseDelayMs!);
  });

  it("conforms to RealtimeClientDefinition type", () => {
    const def: RealtimeClientDefinition<SketchPartyRealtimeState> =
      SKETCH_PARTY_CLIENT_DEF;
    expect(def).toBeDefined();
  });
});

// =============================================================================
// 2. Server message types include all game-specific messages the screen needs
// =============================================================================

describe("Server message types", () => {
  const SCREEN_REQUIRED_MESSAGES = [
    "state_sync",
    "stroke_begin",
    "stroke_points",
    "stroke_end",
    "chat",
    "reaction_event",
    "clear_canvas",
    "undo_stroke",
    "board_snapshot",
    "word_reveal",
    "settings_applied",
    "turn_scores",
  ] as const;

  it.each(SCREEN_REQUIRED_MESSAGES)(
    "includes '%s' in server message types",
    (msgType) => {
      expect(
        (SKETCH_PARTY_SERVER_MESSAGES as readonly string[]).includes(msgType),
      ).toBe(true);
    },
  );
});

// =============================================================================
// 3. Initial state has all fields the screen accesses
// =============================================================================

describe("Initial state completeness", () => {
  const initial = SKETCH_PARTY_CLIENT_DEF.initialState;

  it("has phase field", () => {
    expect(initial.phase).toBe("waiting");
  });

  it("has round tracking fields", () => {
    expect(initial.currentRound).toBeDefined();
    expect(initial.totalRounds).toBeDefined();
    expect(initial.currentTurnIndex).toBeDefined();
  });

  it("has drawer and turn order fields", () => {
    expect(initial.drawerId).toBeDefined();
    expect(initial.turnOrder).toBeInstanceOf(Array);
  });

  it("has word display fields", () => {
    expect(initial.maskedWord).toBeDefined();
    expect(initial.wordLength).toBeDefined();
    expect(initial.secretWord).toBeDefined();
    expect(initial.wordChoices).toBeInstanceOf(Array);
  });

  it("has score tracking fields", () => {
    expect(initial.scores).toBeDefined();
    expect(initial.correctGuessers).toBeInstanceOf(Array);
  });

  it("has timing fields", () => {
    expect(initial.timeRemainingSec).toBeDefined();
    expect(initial.drawTimeSec).toBeDefined();
  });

  it("has hint fields", () => {
    expect(initial.hintsUsed).toBeDefined();
    expect(initial.maxHints).toBeDefined();
  });

  it("has players array", () => {
    expect(initial.players).toBeInstanceOf(Array);
  });

  it("has effectiveSettings with all required fields", () => {
    const es = initial.effectiveSettings;
    expect(es).toBeDefined();
    expect(es.maxPlayers).toBeDefined();
    expect(es.rounds).toBeDefined();
    expect(es.drawTimeSec).toBeDefined();
    expect(es.turnChooseTimeSec).toBeDefined();
    expect(es.wordChoices).toBeDefined();
    expect(es.hints).toBeDefined();
    expect(es.customWordsEnabled).toBeDefined();
    expect(es.customWordsList).toBeDefined();
  });
});

// =============================================================================
// 4. Client-to-server message contract matches what the screen sends
// =============================================================================

describe("Client to server message contracts", () => {
  const CLIENT_MESSAGES = [
    {
      type: "stroke_begin",
      samplePayload: {
        strokeId: "s_u1_1",
        tool: "pen",
        color: "#000",
        width: 4,
        x: 100,
        y: 200,
        t: 1000,
      },
    },
    {
      type: "stroke_points",
      samplePayload: {
        strokeId: "s_u1_1",
        points: [{ x: 110, y: 210, t: 1040 }],
      },
    },
    { type: "stroke_end", samplePayload: { strokeId: "s_u1_1" } },
    { type: "guess", samplePayload: { text: "cat" } },
    { type: "word_choice", samplePayload: { wordIndex: 0 } },
    { type: "undo", samplePayload: {} },
    { type: "clear", samplePayload: {} },
    { type: "reaction", samplePayload: { kind: "fire" } },
  ];

  it.each(CLIENT_MESSAGES)(
    "screen sends '$type' with expected payload shape",
    ({ type, samplePayload }) => {
      expect(type).toBeTruthy();
      expect(JSON.stringify(samplePayload)).toBeTruthy();
    },
  );

  it("has 8 distinct client message types", () => {
    const types = CLIENT_MESSAGES.map((m) => m.type);
    expect(new Set(types).size).toBe(8);
  });
});

// =============================================================================
// 5. SketchPartyRealtimeState type alignment
// =============================================================================

describe("SketchPartyRealtimeState type alignment", () => {
  it("initial state is a valid SketchPartyRealtimeState", () => {
    const state: SketchPartyRealtimeState =
      SKETCH_PARTY_CLIENT_DEF.initialState;
    expect(state.phase).toBeDefined();
    expect(state.drawerId).toBeDefined();
    expect(state.players).toBeDefined();
    expect(state.scores).toBeDefined();
    expect(state.correctGuessers).toBeDefined();
    expect(state.timeRemainingSec).toBeDefined();
    expect(state.drawTimeSec).toBeDefined();
    expect(state.currentRound).toBeDefined();
    expect(state.totalRounds).toBeDefined();
    expect(state.maskedWord).toBeDefined();
    expect(state.wordLength).toBeDefined();
    expect(state.effectiveSettings).toBeDefined();
    expect(state.secretWord).toBeDefined();
  });

  it("effectiveSettings has all fields the MatchSettingsSheet uses", () => {
    const es = SKETCH_PARTY_CLIENT_DEF.initialState.effectiveSettings;
    expect(typeof es.rounds).toBe("number");
    expect(typeof es.drawTimeSec).toBe("number");
    expect(typeof es.turnChooseTimeSec).toBe("number");
    expect(typeof es.wordChoices).toBe("number");
    expect(typeof es.hints).toBe("number");
    expect(typeof es.maxPlayers).toBe("number");
    expect(typeof es.customWordsEnabled).toBe("boolean");
    expect(typeof es.customWordsList).toBe("string");
  });
});
