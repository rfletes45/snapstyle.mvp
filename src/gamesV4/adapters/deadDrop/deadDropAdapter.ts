/**
 * Games V4 — Dead Drop Client Adapter
 *
 * Implements the GameAdapterV4 interface for the Dead Drop team word game.
 *
 * Hidden-information safety:
 *   - createInitialPrivateState provides the key map ONLY to spymasters.
 *   - Operatives and spectators never receive alignment data for unrevealed cards.
 *   - The client adapter's validateMove is advisory only; server is authoritative.
 *
 * The board generation cache pattern follows crazy_eights: createInitialPublicState
 * caches the key map for the sequential createInitialPrivateState call.
 *
 * @module gamesV4/adapters/deadDrop/deadDropAdapter
 */

import type {
  GameAdapterV4,
  MoveValidationResult,
  SettingsFieldDef,
} from "../../types/adapter";
import { registerAdapter } from "../registry";
import {
  computeMaxGuesses,
  generateBoard,
  getOperative,
  getSpymaster,
  getTeamAssignment,
  nextTurnState,
  resolveGuess,
  validateClue,
} from "./deadDropEngine";
import type {
  CardAlignment,
  DeadDropMovePayload,
  DeadDropPrivateState,
  DeadDropPublicState,
  DeadDropSettings,
  TeamAssignment,
  TeamColor,
} from "./deadDropTypes";
import { DEFAULT_DEAD_DROP_SETTINGS } from "./deadDropTypes";

// =============================================================================
// Settings Schema
// =============================================================================

const SETTINGS_SCHEMA: SettingsFieldDef[] = [
  {
    key: "clueLegality",
    label: "Clue Rules",
    type: "select",
    default: "standard",
    options: [
      { label: "Relaxed", value: "relaxed" },
      { label: "Standard", value: "standard" },
      { label: "Tournament", value: "tournament" },
    ],
    helperText: "Controls how strictly clues are validated.",
    group: "Rules",
  },
  {
    key: "advancedClues",
    label: "Advanced Clues",
    type: "select",
    default: "off",
    options: [
      { label: "Off (1+ only)", value: "off" },
      { label: "Allow Zero", value: "zero" },
      { label: "Zero + Unlimited", value: "zero_unlimited" },
    ],
    helperText: "Enable zero-count or unlimited clues for expert play.",
    group: "Rules",
  },
  {
    key: "wordPack",
    label: "Word Pack",
    type: "select",
    default: "classic",
    options: [
      { label: "Classic", value: "classic" },
      { label: "Easy", value: "easy" },
      { label: "Hard", value: "hard" },
    ],
    helperText: "Difficulty and theme of word cards.",
    group: "Content",
  },
  {
    key: "turnTimer",
    label: "Turn Timer",
    type: "select",
    default: "off",
    options: [
      { label: "Off", value: "off" },
      { label: "1 hour", value: "1h" },
      { label: "6 hours", value: "6h" },
      { label: "24 hours", value: "24h" },
      { label: "48 hours", value: "48h" },
    ],
    helperText: "Time limit per turn. Auto-pass on timeout.",
    group: "Timing",
  },
  {
    key: "rematchSeats",
    label: "Rematch Seating",
    type: "select",
    default: "keep",
    options: [
      { label: "Keep Seats", value: "keep" },
      { label: "Shuffle Seats", value: "shuffle" },
    ],
    group: "Match",
  },
];

// =============================================================================
// Board Generation Cache (same pattern as crazy_eights)
// =============================================================================

let _boardCache: {
  keyMap: Record<number, CardAlignment>;
  teams: TeamAssignment[];
} | null = null;

// =============================================================================
// Team Assignment
// =============================================================================

function assignTeams(
  players: Array<{ uid: string; slotIndex: number }>,
): TeamAssignment[] {
  if (players.length < 4) {
    throw new Error(
      `Dead Drop requires exactly 4 players, got ${players.length}.`,
    );
  }
  // Slot 0: Red Spymaster, Slot 1: Red Operative
  // Slot 2: Blue Spymaster, Slot 3: Blue Operative
  const sorted = [...players].sort((a, b) => a.slotIndex - b.slotIndex);
  return [
    { uid: sorted[0].uid, team: "red", role: "spymaster" },
    { uid: sorted[1].uid, team: "red", role: "operative" },
    { uid: sorted[2].uid, team: "blue", role: "spymaster" },
    { uid: sorted[3].uid, team: "blue", role: "operative" },
  ];
}

// =============================================================================
// Adapter Implementation
// =============================================================================

const deadDropAdapter: GameAdapterV4 = {
  gameId: "dead_drop",
  runtimeType: "turnBased",
  maxPlayers: 4,
  minPlayers: 4,
  supportsSpectate: true,
  spectateMode: "public_only",
  scoreboardDescriptor: {
    title: "MISSION RESULT",
    formatScore: (s: number) => (s === 1 ? "Win" : s === 0 ? "Loss" : "Draw"),
    sortDirection: "desc",
  },

  settingsSchema: SETTINGS_SCHEMA,
  defaultSettings: DEFAULT_DEAD_DROP_SETTINGS as unknown as Record<
    string,
    unknown
  >,

  createInitialPublicState(
    players: Array<{ uid: string; slotIndex: number }>,
    settings: Record<string, unknown>,
  ): Record<string, unknown> {
    const s = settings as unknown as DeadDropSettings;
    const teams = assignTeams(players);

    // Random starting team
    const startingTeam: TeamColor = Math.random() < 0.5 ? "red" : "blue";
    const board = generateBoard(s.wordPack ?? "classic", startingTeam);

    // Cache key map for createInitialPrivateState
    _boardCache = { keyMap: board.keyMap, teams };

    const startingSpymaster = getSpymaster(teams, startingTeam)!;

    const state: DeadDropPublicState = {
      boardSize: 5,
      cards: board.cards,
      startingTeam,
      phase: "clue_input",
      turnTeam: startingTeam,
      currentTurnPlayerId: startingSpymaster.uid,
      currentTurnRole: "spymaster",
      turnNumber: 1,
      redRemaining: board.redTotal,
      blueRemaining: board.blueTotal,
      currentClue: null,
      clueHistory: [],
      guessHistory: [],
      guessesUsedThisTurn: 0,
      maxGuessesThisTurn: 0,
      bonusGuessAllowed: true, // always allow +1 bonus guess
      winnerTeam: null,
      endReason: null,
      teams,
      turnDeadlineAt: null,
      moveCount: 0,
      nextClueId: 1,
      settings: s,
      revealedKeyMap: null,
    };

    return state as unknown as Record<string, unknown>;
  },

  createInitialPrivateState(
    players: Array<{ uid: string; slotIndex: number }>,
    _settings: Record<string, unknown>,
  ): Record<string, Record<string, unknown>> {
    if (!_boardCache) {
      throw new Error(
        "Dead Drop: createInitialPrivateState called without prior createInitialPublicState.",
      );
    }
    const { keyMap, teams } = _boardCache;
    _boardCache = null; // consume cache

    const result: Record<string, Record<string, unknown>> = {};
    for (const p of players) {
      const assignment = teams.find((t) => t.uid === p.uid);
      if (!assignment) continue;

      if (assignment.role === "spymaster") {
        // Spymasters get the full secret key
        const priv: DeadDropPrivateState = {
          role: "spymaster",
          team: assignment.team,
          keyMap,
          keyVersion: 1,
        };
        result[p.uid] = priv as unknown as Record<string, unknown>;
      } else {
        // Operatives get role info but NO key
        result[p.uid] = {
          role: "operative",
          team: assignment.team,
        };
      }
    }
    return result;
  },

  validateMove(
    publicState: Record<string, unknown>,
    privateStateByPlayer: Record<string, Record<string, unknown>>,
    movePayload: Record<string, unknown>,
    ctx: {
      uid: string;
      turnOrder: string[];
      currentTurnIndex: number;
      settings: Record<string, unknown>;
    },
  ): MoveValidationResult {
    const state = publicState as unknown as DeadDropPublicState;
    const move = movePayload as unknown as DeadDropMovePayload;
    const { uid } = ctx;
    const settings = state.settings;

    // Phase checks
    if (state.phase === "game_over") {
      return { ok: false, error: "Game is already over." };
    }

    // Authority check
    if (uid !== state.currentTurnPlayerId) {
      return { ok: false, error: "It's not your turn." };
    }

    const assignment = getTeamAssignment(state.teams, uid);
    if (!assignment) {
      return { ok: false, error: "You are not a player in this game." };
    }

    switch (move.action) {
      case "submit_clue":
        return handleSubmitClue(
          state,
          move,
          assignment,
          settings,
          privateStateByPlayer,
        );
      case "guess_word":
        return handleGuessWord(
          state,
          move,
          assignment,
          uid,
          privateStateByPlayer,
        );
      case "stop_guessing":
        return handleStopGuessing(state, assignment);
      default:
        return { ok: false, error: "Unknown action." };
    }
  },

  computeOutcome(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string; slotIndex: number }>,
  ) {
    const state = publicState as unknown as DeadDropPublicState;
    const winnerUids = state.winnerTeam
      ? state.teams.filter((t) => t.team === state.winnerTeam).map((t) => t.uid)
      : [];

    return {
      winnerIds: winnerUids,
      finalScoreboard: players.map((p) => {
        const assignment = state.teams.find((t) => t.uid === p.uid);
        const isWinner = winnerUids.includes(p.uid);
        return {
          uid: p.uid,
          score: isWinner ? 1 : 0,
          placement: isWinner ? 1 : 2,
          stats: {
            team: assignment?.team ?? "unknown",
            role: assignment?.role ?? "unknown",
            endReason: state.endReason,
          },
        };
      }),
    };
  },

  extractPerformanceMetrics(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string }>,
  ): Record<string, unknown> {
    const state = publicState as unknown as DeadDropPublicState;

    // Per-player metrics for achievement evaluation
    const perPlayer: Record<string, Record<string, unknown>> = {};

    for (const p of players) {
      const assignment = state.teams.find((t) => t.uid === p.uid);
      if (!assignment) continue;

      const isWinner = state.winnerTeam === assignment.team;
      const myClues = state.clueHistory.filter((c) => c.spymasterUid === p.uid);
      const myGuesses = state.guessHistory.filter((g) => g.guessedBy === p.uid);
      const correctGuesses = myGuesses.filter(
        (g) => g.result === "correct",
      ).length;
      const wrongGuesses = myGuesses.filter(
        (g) => g.result !== "correct",
      ).length;
      const enemyReveals = myGuesses.filter((g) => g.result === "enemy").length;
      const neutralReveals = myGuesses.filter(
        (g) => g.result === "neutral",
      ).length;
      const triggeredAssassin = myGuesses.some((g) => g.result === "assassin");

      // Max correct from single clue
      let maxCorrectFromSingleClue = 0;
      for (const clue of myClues) {
        const guessesForClue = state.guessHistory.filter(
          (g) =>
            g.clueId === clue.clueId &&
            g.team === assignment.team &&
            g.result === "correct",
        );
        maxCorrectFromSingleClue = Math.max(
          maxCorrectFromSingleClue,
          guessesForClue.length,
        );
      }

      // Check if team's guesses had zero enemy/neutral reveals
      const teamGuesses = state.guessHistory.filter(
        (g) => g.team === assignment.team,
      );
      const teamCleanGuesses = teamGuesses.every((g) => g.result === "correct");

      // Comeback: team was behind in remaining count before winning
      const wasTrailing = isWinner && state.startingTeam !== assignment.team;

      perPlayer[p.uid] = {
        team: assignment.team,
        role: assignment.role,
        won: isWinner,
        wonAsSpymaster: isWinner && assignment.role === "spymaster",
        wonAsOperative: isWinner && assignment.role === "operative",
        cluesGiven: myClues.length,
        guessesMade: myGuesses.length,
        correctGuesses,
        wrongGuesses,
        enemyWordsRevealed: enemyReveals,
        neutralWordsRevealed: neutralReveals,
        triggeredAssassin,
        maxCorrectFromSingleClue,
        cleanWin: isWinner && teamCleanGuesses,
        cameFromBehind: wasTrailing,
        turnsElapsed: state.turnNumber,
        startingTeam: state.startingTeam,
      };
    }

    return {
      endReason: state.endReason,
      winnerTeam: state.winnerTeam,
      turnsElapsed: state.turnNumber,
      startingTeam: state.startingTeam,
      totalClues: state.clueHistory.length,
      totalGuesses: state.guessHistory.length,
      perPlayer,
    };
  },

  getSpectatorView(
    publicState: Record<string, unknown>,
  ): Record<string, unknown> {
    // Public state is already spectator-safe by design.
    // Unrevealed cards never have alignment info in public state.
    return publicState;
  },

  validateSettings(patch: Record<string, unknown>): Record<string, unknown> {
    const clean: Record<string, unknown> = {};
    if (
      patch.clueLegality &&
      ["relaxed", "standard", "tournament"].includes(
        patch.clueLegality as string,
      )
    ) {
      clean.clueLegality = patch.clueLegality;
    }
    if (
      patch.advancedClues &&
      ["off", "zero", "zero_unlimited"].includes(patch.advancedClues as string)
    ) {
      clean.advancedClues = patch.advancedClues;
    }
    if (
      patch.wordPack &&
      ["classic", "easy", "hard"].includes(patch.wordPack as string)
    ) {
      clean.wordPack = patch.wordPack;
    }
    if (
      patch.turnTimer &&
      ["off", "1h", "6h", "24h", "48h"].includes(patch.turnTimer as string)
    ) {
      clean.turnTimer = patch.turnTimer;
    }
    if (
      patch.rematchSeats &&
      ["keep", "shuffle"].includes(patch.rematchSeats as string)
    ) {
      clean.rematchSeats = patch.rematchSeats;
    }
    if (typeof patch.allowSpectators === "boolean") {
      clean.allowSpectators = patch.allowSpectators;
    }
    return clean;
  },

  computeSummary(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string; displayName: string }>,
    currentTurnPlayerId: string | null,
  ) {
    const state = publicState as unknown as DeadDropPublicState;
    return {
      turnPlayerId: currentTurnPlayerId,
      scoreSummary: players.map((p) => {
        const assignment = state.teams.find((t) => t.uid === p.uid);
        const isWinner =
          state.phase === "game_over" && state.winnerTeam === assignment?.team;
        return {
          uid: p.uid,
          displayName: p.displayName,
          score: isWinner ? 1 : 0,
        };
      }),
    };
  },
};

// =============================================================================
// Move Handlers
// =============================================================================

function handleSubmitClue(
  state: DeadDropPublicState,
  move: { action: "submit_clue"; word: string; count: number },
  assignment: TeamAssignment,
  settings: DeadDropSettings,
  _privateStateByPlayer: Record<string, Record<string, unknown>>,
): MoveValidationResult {
  if (state.phase !== "clue_input") {
    return { ok: false, error: "Not the clue phase." };
  }
  if (assignment.role !== "spymaster") {
    return { ok: false, error: "Only the Spymaster can give clues." };
  }
  if (assignment.team !== state.turnTeam) {
    return { ok: false, error: "It's not your team's turn." };
  }

  // Validate clue
  const validation = validateClue(
    move.word,
    move.count,
    state.cards,
    settings.clueLegality,
    settings.advancedClues,
  );
  if (!validation.valid) {
    return { ok: false, error: validation.error };
  }

  const clueEntry = {
    clueId: state.nextClueId,
    team: state.turnTeam,
    spymasterUid: assignment.uid,
    word: move.word.trim().toUpperCase(),
    count: move.count,
    turnNumber: state.turnNumber,
    timestamp: Date.now(),
  };

  const operative = getOperative(state.teams, state.turnTeam)!;
  const maxGuesses = computeMaxGuesses(move.count, state.bonusGuessAllowed);

  const nextState: DeadDropPublicState = {
    ...state,
    phase: "guessing",
    currentClue: clueEntry,
    clueHistory: [...state.clueHistory, clueEntry],
    currentTurnPlayerId: operative.uid,
    currentTurnRole: "operative",
    guessesUsedThisTurn: 0,
    maxGuessesThisTurn: maxGuesses,
    moveCount: state.moveCount + 1,
    nextClueId: state.nextClueId + 1,
  };

  return {
    ok: true,
    nextPublicState: nextState as unknown as Record<string, unknown>,
    nextTurnPlayerId: operative.uid,
  };
}

function handleGuessWord(
  state: DeadDropPublicState,
  move: { action: "guess_word"; cardId: number },
  assignment: TeamAssignment,
  uid: string,
  privateStateByPlayer: Record<string, Record<string, unknown>>,
): MoveValidationResult {
  if (state.phase !== "guessing") {
    return { ok: false, error: "Not the guessing phase." };
  }
  if (assignment.role !== "operative") {
    return { ok: false, error: "Only the Operative can guess." };
  }
  if (assignment.team !== state.turnTeam) {
    return { ok: false, error: "It's not your team's turn." };
  }

  const card = state.cards.find((c) => c.id === move.cardId);
  if (!card) {
    return { ok: false, error: "Invalid card ID." };
  }
  if (card.revealed) {
    return { ok: false, error: "That word has already been revealed." };
  }

  if (
    state.maxGuessesThisTurn > 0 &&
    state.guessesUsedThisTurn >= state.maxGuessesThisTurn
  ) {
    return { ok: false, error: "No guesses remaining this turn." };
  }

  // On the client side, we don't have the key map for operatives
  // so we can only do partial validation. The server is authoritative.
  // But if we DO have spymaster private state (e.g. in tests), use it.
  const teamSpymaster = getSpymaster(state.teams, state.turnTeam);
  const spymasterPriv =
    teamSpymaster &&
    (privateStateByPlayer[teamSpymaster.uid] as unknown as
      | DeadDropPrivateState
      | undefined);

  if (!spymasterPriv?.keyMap) {
    // Client operative path: can't validate result, just accept structurally
    // Server will do authoritative validation
    return { ok: true };
  }

  // Full validation with key (server path or test path)
  const guessResult = resolveGuess(
    move.cardId,
    state.turnTeam,
    spymasterPriv.keyMap,
    state.redRemaining,
    state.blueRemaining,
  );

  const newCards = state.cards.map((c) =>
    c.id === move.cardId
      ? {
          ...c,
          revealed: true,
          revealedAs: guessResult.alignment,
          revealedByTeam: state.turnTeam,
          revealedTurn: state.turnNumber,
          revealedFromClueId: state.currentClue?.clueId ?? null,
        }
      : c,
  );

  const guessEntry = {
    cardId: move.cardId,
    word: card.word,
    guessedBy: uid,
    result: guessResult.outcome,
    team: state.turnTeam,
    turnNumber: state.turnNumber,
    clueId: state.currentClue?.clueId ?? 0,
    timestamp: Date.now(),
  };

  const newRedRemaining =
    guessResult.alignment === "red"
      ? state.redRemaining - 1
      : state.redRemaining;
  const newBlueRemaining =
    guessResult.alignment === "blue"
      ? state.blueRemaining - 1
      : state.blueRemaining;

  const guessesUsed = state.guessesUsedThisTurn + 1;

  if (guessResult.gameEnds) {
    const nextState: DeadDropPublicState = {
      ...state,
      cards: newCards,
      phase: "game_over",
      redRemaining: newRedRemaining,
      blueRemaining: newBlueRemaining,
      guessHistory: [...state.guessHistory, guessEntry],
      guessesUsedThisTurn: guessesUsed,
      winnerTeam: guessResult.winnerTeam!,
      endReason: guessResult.endReason!,
      moveCount: state.moveCount + 1,
      revealedKeyMap: spymasterPriv?.keyMap ?? null,
    };
    return {
      ok: true,
      nextPublicState: nextState as unknown as Record<string, unknown>,
      terminal: {
        type: "win",
        winnerIds: state.teams
          .filter((t) => t.team === guessResult.winnerTeam)
          .map((t) => t.uid),
        reason: guessResult.endReason,
      },
    };
  }

  if (guessResult.turnEnds) {
    const { turnTeam, currentTurnPlayerId, currentTurnRole, phase } =
      nextTurnState(state.turnTeam, state.teams);
    const nextState: DeadDropPublicState = {
      ...state,
      cards: newCards,
      phase,
      turnTeam,
      currentTurnPlayerId,
      currentTurnRole,
      turnNumber: state.turnNumber + 1,
      redRemaining: newRedRemaining,
      blueRemaining: newBlueRemaining,
      currentClue: null,
      guessHistory: [...state.guessHistory, guessEntry],
      guessesUsedThisTurn: 0,
      maxGuessesThisTurn: 0,
      moveCount: state.moveCount + 1,
    };
    return {
      ok: true,
      nextPublicState: nextState as unknown as Record<string, unknown>,
      nextTurnPlayerId: currentTurnPlayerId,
      turnAdvance: true,
    };
  }

  // Correct guess, continue guessing
  const outOfGuesses =
    state.maxGuessesThisTurn > 0 && guessesUsed >= state.maxGuessesThisTurn;

  if (outOfGuesses) {
    // Auto end turn
    const { turnTeam, currentTurnPlayerId, currentTurnRole, phase } =
      nextTurnState(state.turnTeam, state.teams);
    const nextState: DeadDropPublicState = {
      ...state,
      cards: newCards,
      phase,
      turnTeam,
      currentTurnPlayerId,
      currentTurnRole,
      turnNumber: state.turnNumber + 1,
      redRemaining: newRedRemaining,
      blueRemaining: newBlueRemaining,
      currentClue: null,
      guessHistory: [...state.guessHistory, guessEntry],
      guessesUsedThisTurn: 0,
      maxGuessesThisTurn: 0,
      moveCount: state.moveCount + 1,
    };
    return {
      ok: true,
      nextPublicState: nextState as unknown as Record<string, unknown>,
      nextTurnPlayerId: currentTurnPlayerId,
      turnAdvance: true,
    };
  }

  // Continue with same operative
  const nextState: DeadDropPublicState = {
    ...state,
    cards: newCards,
    redRemaining: newRedRemaining,
    blueRemaining: newBlueRemaining,
    guessHistory: [...state.guessHistory, guessEntry],
    guessesUsedThisTurn: guessesUsed,
    moveCount: state.moveCount + 1,
  };

  return {
    ok: true,
    nextPublicState: nextState as unknown as Record<string, unknown>,
  };
}

function handleStopGuessing(
  state: DeadDropPublicState,
  assignment: TeamAssignment,
): MoveValidationResult {
  if (state.phase !== "guessing") {
    return { ok: false, error: "Not the guessing phase." };
  }
  if (assignment.role !== "operative") {
    return { ok: false, error: "Only the Operative can stop guessing." };
  }
  if (assignment.team !== state.turnTeam) {
    return { ok: false, error: "It's not your team's turn." };
  }

  const { turnTeam, currentTurnPlayerId, currentTurnRole, phase } =
    nextTurnState(state.turnTeam, state.teams);

  const nextState: DeadDropPublicState = {
    ...state,
    phase,
    turnTeam,
    currentTurnPlayerId,
    currentTurnRole,
    turnNumber: state.turnNumber + 1,
    currentClue: null,
    guessesUsedThisTurn: 0,
    maxGuessesThisTurn: 0,
    moveCount: state.moveCount + 1,
  };

  return {
    ok: true,
    nextPublicState: nextState as unknown as Record<string, unknown>,
    nextTurnPlayerId: currentTurnPlayerId,
    turnAdvance: true,
  };
}

// =============================================================================
// Register
// =============================================================================

registerAdapter(deadDropAdapter);

export default deadDropAdapter;
