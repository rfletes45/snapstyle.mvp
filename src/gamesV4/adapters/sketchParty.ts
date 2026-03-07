/**
 * Games V4 — Sketch Party Adapter (Client)
 *
 * Minimal client adapter for the realtime Sketch Party game.
 * Gameplay is authoritative on Colyseus, so validateMove is not used.
 * This adapter provides identity, settings, initial state helpers,
 * and summary/outcome computation for invite cards and result pages.
 *
 * @module gamesV4/adapters/sketchParty
 */

import type {
  GameAdapterV4,
  GameOutcome,
  SettingsFieldDef,
} from "../types/adapter";
import { registerAdapter } from "./registry";

// =============================================================================
// Types
// =============================================================================

export interface SketchPartyPublicState {
  /** Current round (1-based). */
  currentRound: number;
  /** Total rounds. */
  totalRounds: number;
  /** Current turn index within the round. */
  currentTurnIndex: number;
  /** Turn order (player UIDs). */
  turnOrder: string[];
  /** Current drawer UID. */
  drawerId: string | null;
  /** Current phase of the turn. */
  phase: "waiting" | "choosing" | "drawing" | "turn_end" | "match_end";
  /** Masked word (guessers see underscores + revealed hints). */
  maskedWord: string;
  /** Full word (only meaningful for drawer; others see masked). */
  wordLength: number;
  /** Per-player scores. */
  scores: Record<string, number>;
  /** Players who guessed correctly this turn. */
  correctGuessers: string[];
  /** Time remaining in seconds. */
  timeRemainingSec: number;
  /** Draw time setting (for UI display). */
  drawTimeSec: number;
  /** Number of hints used this turn. */
  hintsUsed: number;
  /** Max hints per turn. */
  maxHints: number;
}

// =============================================================================
// Settings
// =============================================================================

const SETTINGS_SCHEMA: SettingsFieldDef[] = [
  {
    key: "rounds",
    label: "Rounds",
    type: "number",
    default: 3,
    min: 1,
    max: 10,
  },
  {
    key: "drawTimeSec",
    label: "Draw Time (sec)",
    type: "number",
    default: 80,
    min: 30,
    max: 180,
  },
  {
    key: "turnChooseTimeSec",
    label: "Choose Time (sec)",
    type: "number",
    default: 10,
    min: 5,
    max: 15,
  },
  {
    key: "wordChoices",
    label: "Word Choices",
    type: "number",
    default: 3,
    min: 1,
    max: 5,
  },
  {
    key: "hints",
    label: "Hints per Turn",
    type: "number",
    default: 2,
    min: 0,
    max: 3,
  },
  {
    key: "customWordsEnabled",
    label: "Custom Words",
    type: "boolean",
    default: false,
  },
];

const DEFAULT_SETTINGS: Record<string, unknown> = {
  maxPlayers: 8,
  rounds: 3,
  drawTimeSec: 80,
  turnChooseTimeSec: 10,
  wordChoices: 3,
  hints: 2,
  customWordsEnabled: false,
  customWordsList: "",
};

// =============================================================================
// Adapter Implementation
// =============================================================================

const sketchPartyAdapter: GameAdapterV4 = {
  gameId: "sketch_party_game",
  runtimeType: "realtime",
  maxPlayers: 8,
  minPlayers: 2,
  supportsSpectate: false,
  spectateMode: "public_only",

  scoreboardDescriptor: {
    title: "FINAL SCORES",
    formatScore: (s) => s.toLocaleString(),
    sortDirection: "desc",
  },

  settingsSchema: SETTINGS_SCHEMA,
  defaultSettings: DEFAULT_SETTINGS,

  // ── State Creation ──────────────────────────────────────────────────
  createInitialPublicState(
    players: Array<{ uid: string; slotIndex: number }>,
    settings: Record<string, unknown>,
  ): Record<string, unknown> {
    const turnOrder = players.sort(() => Math.random() - 0.5).map((p) => p.uid);
    const scores: Record<string, number> = {};
    for (const p of players) {
      scores[p.uid] = 0;
    }
    const state: SketchPartyPublicState = {
      currentRound: 1,
      totalRounds: (settings.rounds as number) ?? 3,
      currentTurnIndex: 0,
      turnOrder,
      drawerId: turnOrder[0] ?? null,
      phase: "waiting",
      maskedWord: "",
      wordLength: 0,
      scores,
      correctGuessers: [],
      timeRemainingSec: (settings.drawTimeSec as number) ?? 80,
      drawTimeSec: (settings.drawTimeSec as number) ?? 80,
      hintsUsed: 0,
      maxHints: (settings.hints as number) ?? 2,
    };
    return state as unknown as Record<string, unknown>;
  },

  // ── Summary (for pinned invite cards) ──────────────────────────────
  computeSummary(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string; displayName: string }>,
    _currentTurnPlayerId: string | null,
  ) {
    const state = publicState as unknown as SketchPartyPublicState;
    return {
      turnPlayerId: state.drawerId,
      scoreSummary: players.map((p) => ({
        uid: p.uid,
        displayName: p.displayName,
        score: state.scores?.[p.uid] ?? 0,
      })),
    };
  },

  // ── Outcome ────────────────────────────────────────────────────────
  computeOutcome(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string; slotIndex: number }>,
  ): GameOutcome {
    const state = publicState as unknown as SketchPartyPublicState;
    const sorted = players
      .map((p) => ({
        uid: p.uid,
        score: state.scores?.[p.uid] ?? 0,
      }))
      .sort((a, b) => b.score - a.score);

    const maxScore = sorted[0]?.score ?? 0;
    const winnerIds = sorted
      .filter((p) => p.score === maxScore && p.score > 0)
      .map((p) => p.uid);

    return {
      winnerIds,
      finalScoreboard: sorted.map((p, i) => ({
        uid: p.uid,
        score: p.score,
        placement: i + 1,
        stats: {},
      })),
    };
  },

  // ── Performance Metrics ────────────────────────────────────────────
  extractPerformanceMetrics(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string }>,
  ): Record<string, unknown> {
    const state = publicState as unknown as SketchPartyPublicState;
    return {
      totalRounds: state.totalRounds,
      scores: state.scores,
      playerCount: players.length,
    };
  },

  // ── Settings Validation ────────────────────────────────────────────
  validateSettings(patch: Record<string, unknown>): Record<string, unknown> {
    const validated: Record<string, unknown> = {};
    if (typeof patch.maxPlayers === "number") {
      validated.maxPlayers = Math.max(2, Math.min(8, patch.maxPlayers));
    }
    if (typeof patch.rounds === "number") {
      validated.rounds = Math.max(1, Math.min(10, patch.rounds));
    }
    if (typeof patch.drawTimeSec === "number") {
      validated.drawTimeSec = Math.max(30, Math.min(180, patch.drawTimeSec));
    }
    if (typeof patch.turnChooseTimeSec === "number") {
      validated.turnChooseTimeSec = Math.max(
        5,
        Math.min(15, patch.turnChooseTimeSec),
      );
    }
    if (typeof patch.wordChoices === "number") {
      validated.wordChoices = Math.max(1, Math.min(5, patch.wordChoices));
    }
    if (typeof patch.hints === "number") {
      validated.hints = Math.max(0, Math.min(3, patch.hints));
    }
    if (typeof patch.customWordsEnabled === "boolean") {
      validated.customWordsEnabled = patch.customWordsEnabled;
    }
    if (typeof patch.customWordsList === "string") {
      validated.customWordsList = patch.customWordsList.slice(0, 2000);
    }
    return validated;
  },
};

// Auto-register on import
registerAdapter(sketchPartyAdapter);

export default sketchPartyAdapter;
