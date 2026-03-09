/**
 * Games V4 — Constants
 *
 * Canonical constants for the V4 game system.
 * Firestore collection paths, feature flags, and configuration.
 *
 * @module gamesV4/constants
 */

import type { GameId, GameRuntimeType, SoloMode } from "./types/common";

// =============================================================================
// Firestore Collection Paths
// =============================================================================

export const COLLECTIONS = {
  /** Top-level invite docs (chat-facing). */
  GAME_INVITES: "GameInvitesV4",
  /** Top-level session docs (canonical lifecycle). */
  GAME_SESSIONS: "GameSessionsV4",
  /** Subcollection of GameSessions: public state. */
  PUBLIC_STATE: "PublicState",
  /** Subcollection of GameSessions: per-player private state. */
  PRIVATE_STATE: "PrivateState",
  /** Subcollection of GameSessions: moves. */
  MOVES: "Moves",
  /** Top-level result docs (server-written). */
  GAME_RESULTS: "GameResultsV4",
  /** Subcollection of Users: personal bests. */
  GAME_PB: "GamePB",
  /** Subcollection of Users: notifications. */
  NOTIFICATIONS: "Notifications",
  /** Top-level leaderboard docs. */
  LEADERBOARDS: "LeaderboardsV4",
  /** Subcollection of Leaderboards: weekly entries. */
  LEADERBOARD_WEEKS: "Weeks",
  /** Subcollection of Weeks: entries. */
  LEADERBOARD_ENTRIES: "Entries",
} as const;

// =============================================================================
// Firestore Path Helpers
// =============================================================================

export function invitePath(inviteId: string): string {
  return `${COLLECTIONS.GAME_INVITES}/${inviteId}`;
}

export function sessionPath(sessionId: string): string {
  return `${COLLECTIONS.GAME_SESSIONS}/${sessionId}`;
}

export function publicStatePath(sessionId: string, docId = "state"): string {
  return `${COLLECTIONS.GAME_SESSIONS}/${sessionId}/${COLLECTIONS.PUBLIC_STATE}/${docId}`;
}

export function privateStatePath(sessionId: string, uid: string): string {
  return `${COLLECTIONS.GAME_SESSIONS}/${sessionId}/${COLLECTIONS.PRIVATE_STATE}/${uid}`;
}

export function movePath(sessionId: string, moveId: string): string {
  return `${COLLECTIONS.GAME_SESSIONS}/${sessionId}/${COLLECTIONS.MOVES}/${moveId}`;
}

export function resultPath(sessionId: string): string {
  return `${COLLECTIONS.GAME_RESULTS}/${sessionId}`;
}

export function pbPath(uid: string, gameId: GameId): string {
  return `Users/${uid}/${COLLECTIONS.GAME_PB}/${gameId}`;
}

export function leaderboardWeekPath(gameId: GameId, weekKey: string): string {
  return `${COLLECTIONS.LEADERBOARDS}/${gameId}/${COLLECTIONS.LEADERBOARD_WEEKS}/${weekKey}`;
}

export function leaderboardEntryPath(
  gameId: GameId,
  weekKey: string,
  uid: string,
): string {
  return `${COLLECTIONS.LEADERBOARDS}/${gameId}/${COLLECTIONS.LEADERBOARD_WEEKS}/${weekKey}/${COLLECTIONS.LEADERBOARD_ENTRIES}/${uid}`;
}

// =============================================================================
// Pinned Invites Field
// =============================================================================

/**
 * Field name on DM/Group docs that stores pinned V4 invite IDs.
 *
 * For DMs: Chats/{chatId}.pinnedGameInviteIds
 * For groups: Groups/{groupId}.pinnedGameInviteIds
 */
export const PINNED_INVITE_IDS_FIELD = "pinnedGameInviteIds" as const;

// =============================================================================
// Game Metadata Registry
// =============================================================================

export interface GameMetadata {
  gameId: GameId;
  displayName: string;
  runtimeType: GameRuntimeType;
  minPlayers: number;
  maxPlayers: number;
  supportsSpectate: boolean;
  icon: string; // MaterialCommunityIcons name

  // ── Persistent solo / lifecycle policy fields ───────────────────────
  // All optional — existing games default to standard solo behaviour.

  /** Solo sub-mode: "standard" (default) or "persistent" (idle/incremental). */
  soloMode?: SoloMode;
  /** Whether this game exposes a Resign/Forfeit action (default true). */
  allowResign?: boolean;
  /** Whether the in-game menu shows Restart (default true for solo). */
  allowRestart?: boolean;
  /** Whether the Hub should auto-resume an existing active session (default true for solo). */
  autoResumeExisting?: boolean;
  /** Whether leaving the game shows a Game Over screen (default false). */
  showGameOverOnSuspend?: boolean;
  /** Whether archiving/finalizing the run shows a Game Over screen (default true). */
  showGameOverOnArchive?: boolean;
  /** Whether the game supports deterministic offline progression (default false). */
  supportsOfflineProgression?: boolean;
  /** Whether this game uses long-lived sessions (exempt from inactivity auto-resolve). */
  longLivedSession?: boolean;
}

/**
 * Canonical game metadata registry.
 * Used for the games hub, picker, and invite card display.
 */
export const GAME_METADATA: Record<GameId, GameMetadata> = {
  // Solo games
  bounce_blitz: {
    gameId: "bounce_blitz",
    displayName: "Bounce Blitz",
    runtimeType: "solo",
    minPlayers: 1,
    maxPlayers: 1,
    supportsSpectate: false,
    icon: "basketball",
  },
  play_2048: {
    gameId: "play_2048",
    displayName: "2048",
    runtimeType: "solo",
    minPlayers: 1,
    maxPlayers: 1,
    supportsSpectate: false,
    icon: "numeric",
  },
  brick_breaker: {
    gameId: "brick_breaker",
    displayName: "Brick Breaker",
    runtimeType: "solo",
    minPlayers: 1,
    maxPlayers: 1,
    supportsSpectate: false,
    icon: "grid-large",
  },
  word_master: {
    gameId: "word_master",
    displayName: "Word Master",
    runtimeType: "solo",
    minPlayers: 1,
    maxPlayers: 1,
    supportsSpectate: false,
    icon: "alphabetical-variant",
  },
  minesweeper: {
    gameId: "minesweeper",
    displayName: "Minesweeper",
    runtimeType: "solo",
    minPlayers: 1,
    maxPlayers: 1,
    supportsSpectate: false,
    icon: "bomb",
  },
  lights_out: {
    gameId: "lights_out",
    displayName: "Lights Out",
    runtimeType: "solo",
    minPlayers: 1,
    maxPlayers: 1,
    supportsSpectate: false,
    icon: "lightbulb-outline",
  },

  // Turn-based games
  tic_tac_toe: {
    gameId: "tic_tac_toe",
    displayName: "Tic Tac Toe",
    runtimeType: "turnBased",
    minPlayers: 2,
    maxPlayers: 2,
    supportsSpectate: true,
    icon: "grid",
  },
  chess: {
    gameId: "chess",
    displayName: "Chess",
    runtimeType: "turnBased",
    minPlayers: 2,
    maxPlayers: 2,
    supportsSpectate: true,
    icon: "chess-king",
  },
  checkers: {
    gameId: "checkers",
    displayName: "Checkers",
    runtimeType: "turnBased",
    minPlayers: 2,
    maxPlayers: 2,
    supportsSpectate: true,
    icon: "checkerboard",
  },
  connect_four: {
    gameId: "connect_four",
    displayName: "Connect Four",
    runtimeType: "turnBased",
    minPlayers: 2,
    maxPlayers: 2,
    supportsSpectate: true,
    icon: "circle-slice-4",
  },
  gomoku: {
    gameId: "gomoku",
    displayName: "Gomoku",
    runtimeType: "turnBased",
    minPlayers: 2,
    maxPlayers: 2,
    supportsSpectate: true,
    icon: "go-kart",
  },
  reversi: {
    gameId: "reversi",
    displayName: "Reversi",
    runtimeType: "turnBased",
    minPlayers: 2,
    maxPlayers: 2,
    supportsSpectate: true,
    icon: "circle-half-full",
  },
  dots_and_boxes: {
    gameId: "dots_and_boxes",
    displayName: "Dots & Boxes",
    runtimeType: "turnBased",
    minPlayers: 2,
    maxPlayers: 4,
    supportsSpectate: true,
    icon: "dots-grid",
  },
  crazy_eights: {
    gameId: "crazy_eights",
    displayName: "Crazy 8's",
    runtimeType: "turnBased",
    minPlayers: 2,
    maxPlayers: 6,
    supportsSpectate: true,
    icon: "cards-playing-outline",
  },

  // Realtime games
  pong_game: {
    gameId: "pong_game",
    displayName: "Pong",
    runtimeType: "realtime",
    minPlayers: 2,
    maxPlayers: 2,
    supportsSpectate: false,
    icon: "table-tennis",
  },
  battleship: {
    gameId: "battleship",
    displayName: "Battleship",
    runtimeType: "turnBased",
    minPlayers: 2,
    maxPlayers: 2,
    supportsSpectate: true,
    icon: "ship-wheel",
  },
  sketch_party_game: {
    gameId: "sketch_party_game",
    displayName: "Sketch Party",
    runtimeType: "realtime",
    minPlayers: 2,
    maxPlayers: 8,
    supportsSpectate: false,
    icon: "draw",
  },
  starforge_game: {
    gameId: "starforge_game",
    displayName: "Starforge",
    runtimeType: "realtime",
    minPlayers: 2,
    maxPlayers: 4,
    supportsSpectate: false,
    icon: "star-four-points",
  },
  crossword_puzzle: {
    gameId: "crossword_puzzle",
    displayName: "Crossword",
    runtimeType: "realtime",
    minPlayers: 2,
    maxPlayers: 4,
    supportsSpectate: false,
    icon: "crosshairs",
  },
  minigolf_duels: {
    gameId: "minigolf_duels",
    displayName: "Mini Golf",
    runtimeType: "turnBased",
    minPlayers: 2,
    maxPlayers: 3,
    supportsSpectate: true,
    icon: "golf",
  },
  dot_match: {
    gameId: "dot_match",
    displayName: "Dot Match",
    runtimeType: "realtime",
    minPlayers: 2,
    maxPlayers: 2,
    supportsSpectate: false,
    icon: "dots-horizontal-circle",
  },
  solitaire_klondike: {
    gameId: "solitaire_klondike",
    displayName: "Solitaire",
    runtimeType: "solo",
    minPlayers: 1,
    maxPlayers: 1,
    supportsSpectate: false,
    icon: "cards-playing-spade-multiple",
  },
};

// =============================================================================
// Implemented Games Registry
// =============================================================================

/**
 * Games that have full client + server implementation.
 * Used for UI gating ("Coming Soon" badges, disabled Start button, etc.).
 * Update this set whenever a new adapter + screen is added.
 */
export const IMPLEMENTED_GAME_IDS = new Set<GameId>([
  "tic_tac_toe",
  "connect_four",
  "play_2048",
  "chess",
  "sketch_party_game",
  "battleship",
  "brick_breaker",
  "crazy_eights",
  "minesweeper",
  "solitaire_klondike",
  // "minigolf_duels", // disabled — not working, deferred until ready
]);

// =============================================================================
// Limits & Timeouts
// =============================================================================

/** Maximum number of pinned invites per conversation. */
export const MAX_PINNED_INVITES = 5;

/** Maximum number of players per session. */
export const MAX_PLAYERS = 8;

/** TTL (ms) for resolved invite deletion (backup watchdog). */
export const RESOLVED_INVITE_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Lobby expiration timeout (ms) — lobby_open with no start. */
export const LOBBY_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Stale presence threshold (ms). */
export const PRESENCE_STALE_MS = 60 * 1000; // 60 seconds

/** Turn inactivity timeout (ms) before auto-resolve (optional). */
export const TURN_INACTIVITY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// =============================================================================
// Persistent Solo — Lifecycle Policy & Helpers
// =============================================================================

/**
 * Session lifecycle policy derived from game metadata.
 * Controls how the shell, service layer, and backend treat sessions.
 */
export interface SessionLifecyclePolicy {
  runtimeType: GameRuntimeType;
  soloMode: SoloMode;
  /** Can the player resign / forfeit? */
  allowResign: boolean;
  /** Should the session be saved/suspended when the player exits? */
  suspendOnExit: boolean;
  /** Should the session be resolved (terminal) when the player exits? */
  resolveOnExit: boolean;
  /** Should the Hub auto-resume an existing active/suspended session? */
  autoResumeExisting: boolean;
  /** Should the watchdog auto-resolve this session after inactivity? */
  inactivityAutoResolve: boolean;
  /** Should the terminal/game-over screen be shown when the player suspends? */
  showTerminalScreenOnSuspend: boolean;
  /** Can the player restart the run from the in-game menu? */
  allowRestart: boolean;
  /** Does this game support deterministic offline progression? */
  supportsOfflineProgression: boolean;
}

/**
 * Return the effective `SoloMode` for a game.
 * Non-solo games return "standard" (callers should gate on runtimeType).
 */
export function getSoloMode(gameId: GameId): SoloMode {
  return GAME_METADATA[gameId]?.soloMode ?? "standard";
}

/** Convenience: `true` when `soloMode === "persistent"`. */
export function isPersistentSoloGame(gameId: GameId): boolean {
  const meta = GAME_METADATA[gameId];
  return (
    meta?.runtimeType === "solo" &&
    (meta.soloMode ?? "standard") === "persistent"
  );
}

/**
 * Build the full lifecycle policy for a game.
 * Uses metadata fields with sensible defaults so existing games are unaffected.
 */
export function getGameLifecyclePolicy(gameId: GameId): SessionLifecyclePolicy {
  const meta = GAME_METADATA[gameId];
  const rt: GameRuntimeType = meta?.runtimeType ?? "turnBased";
  const sm: SoloMode = meta?.soloMode ?? "standard";
  const persistent = rt === "solo" && sm === "persistent";

  return {
    runtimeType: rt,
    soloMode: sm,

    allowResign: meta?.allowResign ?? !persistent,
    suspendOnExit: rt === "solo", // all solo games suspend on exit
    resolveOnExit: false, // no game auto-resolves on exit currently
    autoResumeExisting: meta?.autoResumeExisting ?? rt === "solo",
    inactivityAutoResolve: !persistent && rt === "turnBased",
    showTerminalScreenOnSuspend: meta?.showGameOverOnSuspend ?? false,
    allowRestart: meta?.allowRestart ?? rt === "solo",
    supportsOfflineProgression: meta?.supportsOfflineProgression ?? false,
  };
}

/** Maximum offline time (ms) that can be claimed in a single resume. */
export const MAX_OFFLINE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

// =============================================================================
// XP Configuration
// =============================================================================

export const XP_CONFIG = {
  /** Base XP for playing a game to completion. */
  BASE_PARTICIPATION: 10,
  /** Bonus XP for winning. */
  WIN_BONUS: 15,
  /** Bonus XP for a draw. */
  DRAW_BONUS: 5,
  /** Maximum performance bonus XP. */
  MAX_PERFORMANCE_BONUS: 10,
  /** XP required to reach level N: floor(100 * 1.2^(N-1)). */
  levelXpThreshold(level: number): number {
    return Math.floor(100 * Math.pow(1.2, level - 1));
  },
} as const;

// =============================================================================
// Scoreboard Descriptors
// =============================================================================

/**
 * Per-game scoreboard formatting for the Game Over screen.
 * - title: section header (e.g. "FINAL SCORES")
 * - formatScore: turns raw numeric score into display string
 * - sortDirection: hint for display ordering ("desc" = highest first)
 */
export interface ScoreboardDescriptor {
  title: string;
  formatScore?: (score: number) => string;
  sortDirection: "asc" | "desc";
}

export const SCOREBOARD_DESCRIPTORS: Partial<
  Record<GameId, ScoreboardDescriptor>
> = {
  tic_tac_toe: {
    title: "MATCH RESULT",
    formatScore: (s) => (s === 1 ? "Win" : s === 0 ? "Loss" : "Draw"),
    sortDirection: "desc",
  },
  connect_four: {
    title: "MATCH RESULT",
    formatScore: (s) => (s === 1 ? "Win" : s === 0 ? "Loss" : "Draw"),
    sortDirection: "desc",
  },
  play_2048: {
    title: "FINAL SCORE",
    formatScore: (s) => s.toLocaleString(),
    sortDirection: "desc",
  },
  chess: {
    title: "MATCH RESULT",
    formatScore: (s) => (s === 1 ? "Win" : s === 0 ? "Loss" : "Draw"),
    sortDirection: "desc",
  },
  sketch_party_game: {
    title: "FINAL SCORES",
    formatScore: (s) => s.toLocaleString(),
    sortDirection: "desc",
  },
  battleship: {
    title: "BATTLE RESULT",
    formatScore: (s) => `${s} pts`,
    sortDirection: "desc",
  },
  brick_breaker: {
    title: "FINAL SCORE",
    formatScore: (s) => s.toLocaleString(),
    sortDirection: "desc",
  },
  crazy_eights: {
    title: "ROUND RESULT",
    formatScore: (s) => (s > 0 ? `+${s} pts` : s === 0 ? "0 pts" : `${s} pts`),
    sortDirection: "desc",
  },
  minigolf_duels: {
    title: "TOTAL STROKES",
    formatScore: (s) => `${Math.abs(s)}`,
    sortDirection: "desc",
  },
  minesweeper: {
    title: "CLEAR TIME",
    formatScore: (s) => {
      if (s <= 0) return "No clear";
      // Decode: tier * 1_000_000 + inverted time
      let tier = "Easy";
      let base = 1_000_000;
      if (s >= 3_000_000) {
        tier = "Expert";
        base = 3_000_000;
      } else if (s >= 2_000_000) {
        tier = "Intermediate";
        base = 2_000_000;
      }
      const ms = 999_999 - (s - base);
      const sec = Math.floor(ms / 1000);
      const m = Math.floor(sec / 60);
      const ss = sec % 60;
      return `${tier} • ${m}:${String(ss).padStart(2, "0")}`;
    },
    sortDirection: "desc",
  },
  solitaire_klondike: {
    title: "FINAL SCORE",
    formatScore: (s) => s.toLocaleString(),
    sortDirection: "desc",
  },
};

// =============================================================================
// Leaderboard Descriptors — per-game metric / formatter for leaderboards
// =============================================================================

/**
 * Per-game leaderboard configuration.
 * Controls how leaderboard entries are displayed and sorted.
 * - label: visible column header (e.g. "Wins", "Score")
 * - metric: source field on PB doc or leaderboard entry
 * - sortDirection: "desc" = higher is better, "asc" = lower is better
 * - formatValue: display formatter
 */
export interface LeaderboardDescriptor {
  label: string;
  metric: "score" | "wins" | "bestScore" | "bestTime";
  sortDirection: "asc" | "desc";
  formatValue: (value: number) => string;
}

export const LEADERBOARD_DESCRIPTORS: Partial<
  Record<GameId, LeaderboardDescriptor>
> = {
  tic_tac_toe: {
    label: "Wins",
    metric: "wins",
    sortDirection: "desc",
    formatValue: (v) => `${v} win${v !== 1 ? "s" : ""}`,
  },
  connect_four: {
    label: "Wins",
    metric: "wins",
    sortDirection: "desc",
    formatValue: (v) => `${v} win${v !== 1 ? "s" : ""}`,
  },
  play_2048: {
    label: "Best Score",
    metric: "bestScore",
    sortDirection: "desc",
    formatValue: (v) => v.toLocaleString(),
  },
  chess: {
    label: "Wins",
    metric: "wins",
    sortDirection: "desc",
    formatValue: (v) => `${v} win${v !== 1 ? "s" : ""}`,
  },
  sketch_party_game: {
    label: "Best Score",
    metric: "bestScore",
    sortDirection: "desc",
    formatValue: (v) => v.toLocaleString(),
  },
  battleship: {
    label: "Wins",
    metric: "wins",
    sortDirection: "desc",
    formatValue: (v) => `${v} win${v !== 1 ? "s" : ""}`,
  },
  brick_breaker: {
    label: "Best Campaign",
    metric: "bestScore",
    sortDirection: "desc",
    formatValue: (v) => v.toLocaleString(),
  },
  crazy_eights: {
    label: "Wins",
    metric: "wins",
    sortDirection: "desc",
    formatValue: (v) => `${v} win${v !== 1 ? "s" : ""}`,
  },
  minigolf_duels: {
    label: "Best (Strokes)",
    metric: "bestScore",
    sortDirection: "desc",
    formatValue: (v) => `${Math.abs(v)} strokes`,
  },
  minesweeper: {
    label: "Best Clear",
    metric: "bestScore",
    sortDirection: "desc",
    formatValue: (v) => {
      if (v <= 0) return "No clear";
      let tier = "Easy";
      let base = 1_000_000;
      if (v >= 3_000_000) {
        tier = "Expert";
        base = 3_000_000;
      } else if (v >= 2_000_000) {
        tier = "Intermediate";
        base = 2_000_000;
      }
      const ms = 999_999 - (v - base);
      const sec = Math.floor(ms / 1000);
      const m = Math.floor(sec / 60);
      const ss = sec % 60;
      return `${tier} • ${m}:${String(ss).padStart(2, "0")}`;
    },
  },
  solitaire_klondike: {
    label: "Best Score",
    metric: "bestScore",
    sortDirection: "desc",
    formatValue: (v) => v.toLocaleString(),
  },
};

// =============================================================================
// Game Descriptions — for game detail pages
// =============================================================================

export interface GameDescription {
  shortDescription: string;
  howToPlay: string;
  tips?: string;
}

export const GAME_DESCRIPTIONS: Partial<Record<GameId, GameDescription>> = {
  tic_tac_toe: {
    shortDescription:
      "The timeless duel of X's and O's — elegant, fast, and deceptively strategic. Challenge a friend and prove you can think one step ahead.",
    howToPlay:
      "Tap any empty cell to place your mark. Players alternate turns — first player is X, second is O. Line up three of your marks in a row, column, or diagonal to win. If all nine cells are filled with no winner, the match ends in a draw.",
    tips: "Start in the center or a corner for the strongest opening. If your opponent takes the center, always grab a corner. Watch for forks — positions where you create two threats at once.",
  },
  connect_four: {
    shortDescription:
      "A gravity-powered strategy classic. Drop your discs, build your line, and outsmart your opponent in this addictive head-to-head showdown.",
    howToPlay:
      "Tap a column to drop your disc — it falls to the lowest open slot. Be the first to connect four discs in a row horizontally, vertically, or diagonally to win. If the board fills completely with no winner, the match is a draw.",
    tips: "The center column gives you the most connection options — fight for it early. Build threats in multiple directions to force your opponent into a losing position. Watch both offence and defence — block their three-in-a-row before it becomes four.",
  },
  play_2048: {
    shortDescription:
      "Slide numbered tiles on a 4x4 grid. Merge matching tiles to reach the 2048 tile!",
    howToPlay:
      "Swipe in any direction to slide all tiles. Tiles with the same number merge into one with double the value. A new tile appears after each move. The game ends when no moves are possible. Try to reach 2048 or higher!",
    tips: "Keep your highest tile in a corner. Build a chain of descending values along one edge.",
  },
  chess: {
    shortDescription:
      "The classic strategy showdown. Outthink your opponent, control the center, and deliver checkmate.",
    howToPlay:
      "You and your opponent take turns moving pieces. Your goal is to checkmate the enemy king—put it in check with no legal escape. Tap a piece to see legal moves, then tap a destination square. Special moves are supported: castling, en passant, and promotion. The game can end by checkmate, resignation, or draw (stalemate, repetition, 50-move rule, or insufficient material). If a draw is offered, you can accept instead of making a move.",
    tips: "Develop pieces early, don't neglect king safety, and look for tactics: forks, pins, and discovered attacks.",
  },
  sketch_party_game: {
    shortDescription:
      "A real-time drawing and guessing party game for 2–8 players! Take turns sketching a secret word while others race to guess it.",
    howToPlay:
      "Players take turns as the drawer. The drawer picks a secret word from three choices and sketches it on the canvas. Other players type guesses in the chat. Correct guesses earn points for both the guesser (speed bonus!) and the drawer. After all rounds, the player with the most points wins! Hints are revealed over time to help guessers.",
    tips: "As the drawer, start with the outline and add details. As a guesser, watch the hint letters and guess early for maximum points. Don't be afraid to guess often — there's no penalty for wrong answers!",
  },
  battleship: {
    shortDescription:
      "Classic naval warfare! Place your fleet secretly, then take turns firing shots to find and sink your opponent's ships. The last fleet standing wins.",
    howToPlay:
      "Each player secretly places their fleet on a grid. Take turns calling shots on your opponent's grid. Hits are marked red, misses are marked white. When all cells of a ship are hit, it sinks. Sink all enemy ships to win! In Salvo mode, you fire as many shots per turn as ships you have remaining.",
    tips: "Spread your ships out to make them harder to find. After a hit, fire adjacent cells to sink the ship quickly. Track your misses to narrow down remaining targets.",
  },
  brick_breaker: {
    shortDescription:
      "Break bricks with a bouncing ball across 30 campaign levels. Collect powerups, build combos, and conquer the last wall!",
    howToPlay:
      "Drag your finger to move the paddle. Tap to launch the ball. Break all breakable bricks to clear each level. Lose a life when the ball falls past your paddle. Collect falling powerups for boosts. Complete all 30 levels to finish the campaign.",
    tips: "Aim for the edges of your paddle to steer the ball at sharper angles. Build combos by breaking bricks without losing a ball. Target explosive (yellow) bricks to chain-destroy neighbors. Power bricks (purple) always drop a powerup. Keep an eye on moving bricks — they shift position!",
  },
  crazy_eights: {
    shortDescription:
      "The classic party card game for 2\u20136 players! Match colors or numbers, play action cards, and be the first to empty your hand. Call CRAZY! when you\u2019re down to one card!",
    howToPlay:
      "Players take turns playing cards that match the top discard by color or number. Action cards (Skip, Reverse, +2) shake things up. Wild cards let you change the color. Wild +4 forces the next player to draw four\u00a0\u2014 but they can challenge if they think you\u2019re bluffing! Run out of cards first to win. Don\u2019t forget to call CRAZY! when you have one card left, or you\u2019ll draw a penalty!",
    tips: "Save your Wild cards for when you really need them. Watch opponents\u2019 card counts \u2014 catch them if they forget to call CRAZY! In points mode, high-value cards in opponents\u2019 hands score big for you.",
  },
  minigolf_duels: {
    shortDescription:
      "Putt your way through creative holes in this turn-based mini golf duel! Bank shots off walls, dodge hazards, and sink it in the fewest strokes to win.",
    howToPlay:
      "Take turns putting your ball by dragging to aim and set power (slingshot style). Each shot moves your ball across the course. Sink the ball in the cup in as few strokes as possible. Avoid water and out-of-bounds hazards \u2014 they add penalty strokes. The player with the lowest total strokes after all holes wins!",
    tips: "Use bank shots off walls to navigate tricky corners. Watch for surface types \u2014 sand slows you down, ice makes you slide. Keep power low near the cup for an easy sink. Study the hole layout before your first shot!",
  },
  minesweeper: {
    shortDescription:
      "The classic logic puzzle! Reveal cells, use numbered clues to deduce mine locations, and clear the board without hitting a mine. Three difficulty levels from Easy to Expert.",
    howToPlay:
      "Tap a cell to reveal it. Numbers indicate how many adjacent cells contain mines. Use logic to figure out where mines are and flag them. Reveal all safe cells to win! Long-press or use Flag Mode to place flags. Tap a revealed number with matching adjacent flags to chord-reveal the remaining neighbors. Your first click is always safe.",
    tips: "Start near the center for larger openings. Use chord reveals to clear faster once you've flagged correctly. The mine counter shows remaining mines minus placed flags — keep it balanced. Expert boards support scrolling for the full 30×16 grid.",
  },
  solitaire_klondike: {
    shortDescription:
      "A polished solo Klondike experience where careful sequencing, stock management, and efficient foundation building determine your final score.",
    howToPlay:
      "Build four foundation piles by suit from Ace to King. On the tableau, stack cards in descending rank with alternating colors (red on black, black on red). Move entire valid runs between columns. Only Kings can fill empty tableau slots. Tap the stock to deal 3 cards to the waste pile — play the top waste card to tableau or foundation. When the stock is empty, tap to recycle the waste back into the stock.",
    tips: "Prioritize revealing hidden tableau cards — the more face-up cards you have, the more options you create. Avoid unnecessary foundation backtracking as it costs points. Use empty columns strategically for Kings that unlock buried cards. Think before recycling the waste — each recycle costs 20 points.",
  },
};
