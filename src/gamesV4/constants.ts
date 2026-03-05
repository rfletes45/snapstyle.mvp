/**
 * Games V4 — Constants
 *
 * Canonical constants for the V4 game system.
 * Firestore collection paths, feature flags, and configuration.
 *
 * @module gamesV4/constants
 */

import type { GameId, GameRuntimeType } from "./types/common";

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
    runtimeType: "realtime",
    minPlayers: 2,
    maxPlayers: 4,
    supportsSpectate: false,
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
    formatScore: (s) =>
      s > 0 ? `+${s} pts` : s === 0 ? "0 pts" : `${s} pts`,
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
    label: "Fleet Score",
    metric: "bestScore",
    sortDirection: "desc",
    formatValue: (v) => `${v} pts`,
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
      "The classic game of X's and O's. Take turns placing your mark on a 3x3 grid. Get three in a row to win!",
    howToPlay:
      "Tap any empty cell to place your mark. Players alternate between X and O. The first player to get three marks in a row (horizontal, vertical, or diagonal) wins. If all 9 cells are filled with no winner, it's a draw.",
    tips: "Control the center and corners for the best advantage. If your opponent takes the center, take a corner.",
  },
  connect_four: {
    shortDescription:
      "Drop colored discs into a vertical grid. Connect four of your color in a row to win!",
    howToPlay:
      "Tap a column to drop your disc. Discs fall to the lowest available position. Connect four of your discs horizontally, vertically, or diagonally to win. If the board fills up with no winner, it's a draw.",
    tips: "Try to set up multiple threats at once. The center column is the most powerful starting position.",
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
  },  crazy_eights: {
    shortDescription:
      "The classic party card game for 2\u20136 players! Match colors or numbers, play action cards, and be the first to empty your hand. Call CRAZY! when you\u2019re down to one card!",
    howToPlay:
      "Players take turns playing cards that match the top discard by color or number. Action cards (Skip, Reverse, +2) shake things up. Wild cards let you change the color. Wild +4 forces the next player to draw four\u00a0\u2014 but they can challenge if they think you\u2019re bluffing! Run out of cards first to win. Don\u2019t forget to call CRAZY! when you have one card left, or you\u2019ll draw a penalty!",
    tips: "Save your Wild cards for when you really need them. Watch opponents\u2019 card counts \u2014 catch them if they forget to call CRAZY! In points mode, high-value cards in opponents\u2019 hands score big for you.",
  },};
