/**
 * Turn-Based Game Types
 *
 * Type definitions for turn-based multiplayer games including:
 * - Chess, Checkers, Tic-Tac-Toe, Crazy Eights
 *
 * @see docs/GAMES_SYSTEM.md
 */

import type {
  TurnBasedGameType as CatalogTurnBasedGameType,
  RealTimeGameType,
} from "@/types/games";

// =============================================================================
// Generic Turn-Based Types
// =============================================================================

/**
 * Base interface for any turn-based game match
 */
export interface TurnBasedMatch<
  TGameState,
  TMove,
  TPlayerState = Record<string, unknown>,
> {
  /** Unique match identifier */
  id: string;

  /** Game type identifier */
  gameType: TurnBasedGameType;

  /** Players in this match */
  players: {
    player1: TurnBasedPlayer<TPlayerState>;
    player2: TurnBasedPlayer<TPlayerState>;
  };

  /** Current game state */
  gameState: TGameState;

  /** Move history for replay/undo functionality */
  moveHistory: TMove[];

  /** Whose turn is it (userId) */
  currentTurn: string;

  /** Current turn number (1-indexed) */
  turnNumber: number;

  /** Match status */
  status: MatchStatus;

  /** Winner user ID (if status is 'completed') */
  winnerId?: string;

  /** How the game ended */
  endReason?: GameEndReason;

  /** Match configuration */
  config: TurnBasedMatchConfig;

  /** Timestamps */
  createdAt: number;
  updatedAt: number;
  lastMoveAt?: number;

  /** Time control state */
  timeControl?: TimeControlState;

  // =========================================================================
  // Phase 1: Conversation Context & Archive Support (Game System Overhaul)
  // =========================================================================

  /** Conversation context - where this game originated */
  conversationId?: string;

  /** Type of conversation (DM or group chat) */
  conversationType?: "dm" | "group";

  /** Per-player archive status (playerUid -> timestamp when archived) */
  playerArchivedAt?: Record<string, number>;

  // =========================================================================
  // Phase 3: Draw Offer System (Game System Overhaul)
  // =========================================================================

  /** User ID of player who offered the draw */
  drawOfferedBy?: string;

  /** Timestamp when draw was offered */
  drawOfferedAt?: number;

  // =========================================================================
  // Phase 4: Invite Lifecycle (Game System Overhaul)
  // =========================================================================

  /** ID of originating invite (for completion propagation) */
  inviteId?: string;
}

/**
 * Turn-based game IDs are defined in the canonical game registry.
 */
export type TurnBasedGameType = CatalogTurnBasedGameType;

/**
 * Match status
 */
export type MatchStatus =
  | "waiting" // Waiting for opponent
  | "active" // Game in progress
  | "completed" // Game finished
  | "abandoned" // Player left
  | "expired"; // Time limit exceeded

/**
 * How a game ended
 */
export type GameEndReason =
  | "checkmate"
  | "resignation"
  | "timeout"
  | "stalemate"
  | "draw_agreement"
  | "draw_repetition"
  | "draw_50_moves"
  | "draw_insufficient"
  | "forfeit"
  | "disconnect"
  | "normal"; // Standard win (Tic-Tac-Toe, card games, etc.)

/**
 * Player in a turn-based match
 */
export interface TurnBasedPlayer<TPlayerState = Record<string, unknown>> {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  rating?: number;
  color?: "white" | "black" | "red"; // For chess/checkers
  playerState?: TPlayerState; // Game-specific player state (hand, etc.)
}

/**
 * Match configuration
 */
export interface TurnBasedMatchConfig {
  /** Time control in seconds per player (null = no limit) */
  timeControl?: number;
  /** Increment per move in seconds */
  increment?: number;
  /** Whether rated */
  isRated: boolean;
  /** Chat enabled */
  chatEnabled: boolean;
}

/**
 * Time control state
 */
export interface TimeControlState {
  player1TimeMs: number;
  player2TimeMs: number;
  lastMoveTimestamp: number;
}

// =============================================================================
// Chess Types
// =============================================================================

/**
 * Chess piece types
 */
export type ChessPieceType =
  | "pawn"
  | "knight"
  | "bishop"
  | "rook"
  | "queen"
  | "king";

/**
 * Chess piece color
 */
export type ChessColor = "white" | "black";

/**
 * Chess piece
 */
export interface ChessPiece {
  type: ChessPieceType;
  color: ChessColor;
  hasMoved: boolean;
}

/**
 * Chess board position (0-7, 0-7)
 */
export interface ChessPosition {
  row: number; // 0-7 (0 = rank 1, 7 = rank 8)
  col: number; // 0-7 (0 = file a, 7 = file h)
}

/**
 * Chess board (8x8 array)
 */
export type ChessBoard = (ChessPiece | null)[][];

/**
 * Chess move
 */
export interface ChessMove {
  from: ChessPosition;
  to: ChessPosition;
  piece: ChessPieceType;
  capture?: ChessPieceType;
  promotion?: ChessPieceType;
  castling?: "kingside" | "queenside";
  enPassant?: boolean;
  check?: boolean;
  checkmate?: boolean;
  notation: string; // Standard algebraic notation (e.g., "e4", "Nxf3+")
  timestamp: number;
}

/**
 * Chess game state
 */
export interface ChessGameState {
  board: ChessBoard;
  currentTurn: ChessColor;
  castlingRights: {
    whiteKingside: boolean;
    whiteQueenside: boolean;
    blackKingside: boolean;
    blackQueenside: boolean;
  };
  enPassantTarget: ChessPosition | null;
  halfMoveClock: number; // For 50-move rule
  fullMoveNumber: number;
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  fen: string; // FEN notation for the current position
}

/**
 * Chess match type
 */
export type ChessMatch = TurnBasedMatch<ChessGameState, ChessMove>;

// =============================================================================
// Checkers Types
// =============================================================================

/**
 * Checkers piece
 */
export interface CheckersPiece {
  color: "red" | "black";
  isKing: boolean;
}

/**
 * Checkers board position (8x8, only dark squares used)
 */
export interface CheckersPosition {
  row: number; // 0-7
  col: number; // 0-7
}

/**
 * Checkers board
 */
export type CheckersBoard = (CheckersPiece | null)[][];

/**
 * Checkers move
 */
export interface CheckersMove {
  from: CheckersPosition;
  to: CheckersPosition;
  captures: CheckersPosition[]; // Multiple captures possible
  promotion: boolean; // Became a king
  timestamp: number;
}

/**
 * Checkers game state
 */
export interface CheckersGameState {
  board: CheckersBoard;
  currentTurn: "red" | "black";
  redPieces: number;
  blackPieces: number;
  redKings: number;
  blackKings: number;
  mustJump: boolean; // If true, current player must make a capture
  selectedPiece?: CheckersPosition; // For multi-jump tracking
}

/**
 * Checkers match type
 */
export type CheckersMatch = TurnBasedMatch<CheckersGameState, CheckersMove>;

// =============================================================================
// Tic-Tac-Toe Types
// =============================================================================

/**
 * Tic-Tac-Toe cell
 */
export type TicTacToeCell = "X" | "O" | null;

/**
 * Tic-Tac-Toe board (3x3)
 */
export type TicTacToeBoard = TicTacToeCell[][];

/**
 * Tic-Tac-Toe position
 */
export interface TicTacToePosition {
  row: number; // 0-2
  col: number; // 0-2
}

/**
 * Tic-Tac-Toe move
 */
export interface TicTacToeMove {
  position: TicTacToePosition;
  symbol: "X" | "O";
  timestamp: number;
}

/**
 * Tic-Tac-Toe game state
 */
export interface TicTacToeGameState {
  board: TicTacToeBoard;
  currentTurn: "X" | "O";
  winner: "X" | "O" | "draw" | null;
  winningLine?: TicTacToePosition[]; // Positions forming the winning line
}

/**
 * Tic-Tac-Toe match type
 */
export type TicTacToeMatch = TurnBasedMatch<TicTacToeGameState, TicTacToeMove>;

// =============================================================================
// Crazy Eights Types
// =============================================================================

/**
 * Card suit
 */
export type CardSuit = "hearts" | "diamonds" | "clubs" | "spades";

/**
 * Card rank
 */
export type CardRank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

/**
 * Playing card
 */
export interface Card {
  suit: CardSuit;
  rank: CardRank;
  id: string; // Unique identifier for this card
}

/**
 * Crazy Eights game configuration
 * @deprecated Use CRAZY_CARDS_CONFIG instead — kept for backward compatibility
 */
export const CRAZY_EIGHTS_CONFIG = {
  /** Initial hand size for each player */
  initialHandSize: 7,
  /** Maximum number of draws per turn (typically 1) */
  maxDrawsPerTurn: 1,
  /** Minimum players for a game */
  minPlayers: 1,
  /** Maximum players for a game */
  maxPlayers: 5,
  /** The rank that allows suit declaration */
  wildRank: "8" as CardRank,
} as const;

// =============================================================================
// Crazy Cards (UNO-Inspired) Types — replaces legacy Crazy Eights
// =============================================================================

/** Card color — "wild" for Wild and Wild Draw Four */
export type CrazyCardColor = "red" | "yellow" | "green" | "blue" | "wild";

/** Card type — actions and wilds */
export type CrazyCardType =
  | "number"
  | "skip"
  | "reverse"
  | "draw_two"
  | "wild"
  | "wild_draw_four";

/** A single Crazy Cards card */
export interface CrazyCard {
  /** Unique identifier (e.g. "red_7_1", "wild_0") */
  id: string;
  /** Card color */
  color: CrazyCardColor;
  /** Card type */
  type: CrazyCardType;
  /** Numeric value 0–9 for number cards, null for actions/wilds */
  value: number | null;
}

/** Crazy Cards game configuration */
export const CRAZY_CARDS_CONFIG = {
  initialHandSize: 7,
  maxDrawsPerTurn: 1,
  minPlayers: 1,
  maxPlayers: 5,
  deckSize: 108,
  /** Display name (internal gameId stays "crazy_eights") */
  displayName: "Crazy Cards",
} as const;

/**
 * Crazy Eights move (now supports UNO-style actions)
 */
export interface CrazyEightsMove {
  type: "play" | "draw" | "pass" | "call_uno" | "challenge_uno";
  card?: Card;
  /** Crazy Cards: card ID for Colyseus play action */
  cardId?: string;
  declaredSuit?: CardSuit; // Legacy: When playing an 8
  chosenColor?: CrazyCardColor; // New: When playing a wild
  targetSessionId?: string; // For challenge_uno
  timestamp: number;
}

/**
 * Crazy Eights player state
 */
export interface CrazyEightsPlayerState {
  hand: Card[];
  handSize: number; // For opponent visibility (don't reveal actual cards)
}

/**
 * Crazy Eights game state (updated for Crazy Cards / UNO-inspired rules)
 */
export interface CrazyEightsGameState {
  discardPile: Card[];
  deckSize: number;
  topCard: Card;
  currentSuit: CardSuit; // Legacy compat
  currentColor?: CrazyCardColor; // New: active color for Crazy Cards mode
  currentTurn: string; // userId
  direction: 1 | -1;
  drawCount: number;
  mustDraw: boolean;
  hasDrawnThisTurn: boolean;
  // Crazy Cards specific
  pendingDrawCount?: number; // Cards next player must draw (+2/+4)
  pendingSkip?: boolean;
  // Online game data (stored in Firestore)
  hands?: Record<string, Card[]>;
  deck?: Card[];
  playerOrder?: string[];
}

/**
 * Crazy Eights match type
 */
export type CrazyEightsMatch = TurnBasedMatch<
  CrazyEightsGameState,
  CrazyEightsMove,
  CrazyEightsPlayerState
>;

// =============================================================================
// Four (Connect Four) Types
// =============================================================================

/**
 * Four cell: 0 = empty, 1 = player 1 (red), 2 = player 2 (yellow)
 */
export type FourCell = 0 | 1 | 2;

/**
 * Four board (6 rows Ãƒâ€” 7 columns)
 */
export type FourBoard = FourCell[][];

/**
 * Four move Ã¢â‚¬â€ drop a disc into a column
 */
export interface FourMove {
  column: number; // 0-6
  row: number; // The row where the disc landed
  player: 1 | 2;
  timestamp: number;
}

/**
 * Four game state
 */
export interface FourGameState {
  board: FourBoard;
  currentTurn: 1 | 2;
}

/**
 * Four match type
 */
export type FourMatch = TurnBasedMatch<FourGameState, FourMove>;

// =============================================================================
// Dots (Dots & Boxes) Types
// =============================================================================

/**
 * Dots box owner: 0 = unclaimed, 1 = player 1, 2 = player 2
 */
export type DotsOwner = 0 | 1 | 2;

/**
 * Dots move Ã¢â‚¬â€ draw a horizontal or vertical line
 */
export interface DotsMove {
  type: "h" | "v"; // horizontal or vertical line
  row: number;
  col: number;
  player: 1 | 2;
  completedBoxes: number; // How many boxes were completed by this move
  timestamp: number;
}

/**
 * Dots game state (5Ãƒâ€”5 dots Ã¢â€ â€™ 4Ãƒâ€”4 boxes)
 *
 * hLines[row][col]: horizontal line from dot(row,col) to dot(row,col+1)
 * vLines[row][col]: vertical line from dot(row,col) to dot(row+1,col)
 * boxes[row][col]: owner of box at position (row,col)
 */
export interface DotsGameState {
  hLines: boolean[][]; // [5][4] Ã¢â‚¬â€ 5 rows of horizontal lines, 4 per row
  vLines: boolean[][]; // [4][5] Ã¢â‚¬â€ 4 rows of vertical lines, 5 per row
  boxes: DotsOwner[][]; // [4][4] Ã¢â‚¬â€ 4Ãƒâ€”4 box grid
  currentTurn: 1 | 2;
  scores: { player1: number; player2: number };
  linesDrawn: number;
}

/**
 * Dots match type
 */
export type DotsMatch = TurnBasedMatch<DotsGameState, DotsMove>;

// =============================================================================
// Gomoku (Five in a Row) Types
// =============================================================================

/**
 * Gomoku cell: 0 = empty, 1 = black, 2 = white
 */
export type GomokuCell = 0 | 1 | 2;

/**
 * Gomoku board (15Ãƒâ€”15)
 */
export type GomokuBoard = GomokuCell[][];

/**
 * Gomoku move Ã¢â‚¬â€ place a stone on an intersection
 */
export interface GomokuMove {
  row: number; // 0-14
  col: number; // 0-14
  player: 1 | 2;
  timestamp: number;
}

/**
 * Gomoku game state
 */
export interface GomokuGameState {
  board: GomokuBoard;
  currentTurn: 1 | 2;
  lastMove?: { row: number; col: number };
}

/**
 * Gomoku match type
 */
export type GomokuMatch = TurnBasedMatch<GomokuGameState, GomokuMove>;

// =============================================================================
// Reversi (Othello) Types
// =============================================================================

/** Reversi cell: 0 = empty, 1 = black, 2 = white */
export type ReversiCell = 0 | 1 | 2;

/** Reversi board (8Ãƒâ€”8) */
export type ReversiBoard = ReversiCell[][];

/** Reversi move Ã¢â‚¬â€ place a disc to outflank opponent */
export interface ReversiMove {
  row: number;
  col: number;
  player: 1 | 2;
  flipped: { row: number; col: number }[];
  timestamp: number;
}

/** Reversi game state */
export interface ReversiGameState {
  board: ReversiBoard;
  currentTurn: 1 | 2;
  scores: { player1: number; player2: number };
  lastMove?: { row: number; col: number };
  consecutivePasses: number;
}

export type ReversiMatch = TurnBasedMatch<ReversiGameState, ReversiMove>;

// =============================================================================
// Game Invite Types
// =============================================================================

/**
 * Game invite status
 */
export type GameInviteStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "expired"
  | "cancelled";

/**
 * Game invite
 */
export interface GameInvite {
  id: string;
  gameType: TurnBasedGameType | RealTimeGameType;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  recipientId: string;
  recipientName: string;
  recipientAvatar?: string;
  status: GameInviteStatus;
  config: TurnBasedMatchConfig;
  message?: string;
  createdAt: number;
  expiresAt: number;
  matchId?: string; // Set when accepted
}

// =============================================================================
// Universal Game Invite Types (NEW)
// =============================================================================

/** Where the invite was sent */
export type InviteContext = "dm" | "group";

/** Invite status (expanded for universal invites) */
export type UniversalInviteStatus =
  | "pending" // Waiting for first player to join (after sender)
  | "filling" // Some players joined, not full yet
  | "ready" // All required slots filled, game starting
  | "starting" // Host triggered start — match being created (transient)
  | "active" // Game in progress
  | "completed" // Game finished
  | "declined" // Recipient declined (DM/specific only)
  | "expired" // Time limit exceeded
  | "cancelled"; // Sender cancelled

/**
 * Canonical status transition graph for universal invites.
 * Keep service and backend lifecycle logic aligned with this map.
 */
export const UNIVERSAL_INVITE_STATUS_TRANSITIONS: Record<
  UniversalInviteStatus,
  readonly UniversalInviteStatus[]
> = {
  pending: ["filling", "ready", "starting", "cancelled", "expired", "declined"],
  filling: ["pending", "ready", "starting", "cancelled", "expired", "declined"],
  ready: ["filling", "pending", "starting", "active", "cancelled", "expired"],
  starting: ["active", "ready", "completed"],
  active: ["completed"],
  completed: [],
  declined: [],
  expired: [],
  cancelled: [],
};

export function canTransitionUniversalInviteStatus(
  from: UniversalInviteStatus,
  to: UniversalInviteStatus,
): boolean {
  if (from === to) return true;
  return UNIVERSAL_INVITE_STATUS_TRANSITIONS[from].includes(to);
}

/** A claimed player slot in the invite */
export interface PlayerSlot {
  playerId: string;
  playerName: string;
  playerAvatar?: string;
  claimedAt: number; // Unix timestamp
  isHost: boolean; // true for sender/first player
}

/** A spectator watching the game */
export interface SpectatorEntry {
  userId: string;
  userName: string;
  userAvatar?: string;
  joinedAt: number; // Unix timestamp
}

/**
 * Universal Game Invite - supports both DM and group contexts
 *
 * Key differences from legacy GameInvite:
 * - `context` determines if DM or group
 * - `targetType` determines if specific recipient or anyone can join
 * - `claimedSlots` replaces accept/decline for multi-player
 * - `spectators` allows watching after game starts
 * - `showInPlayPage` controls visibility in Play tab
 */
export interface UniversalGameInvite {
  // ============= IDENTITY =============
  id: string;
  gameType: TurnBasedGameType | RealTimeGameType;

  // ============= SENDER =============
  senderId: string;
  senderName: string;
  senderAvatar?: string;

  // ============= CONTEXT =============
  /** Where was this invite sent? "dm" for 1:1 chat, "group" for group chat */
  context: InviteContext;

  /** The conversation ID (chatId for DM, groupId for group) */
  conversationId: string;

  /** Display name of conversation (group name or recipient name) */
  conversationName?: string;

  // ============= TARGETING =============
  /**
   * Who can claim this invite?
   * - "universal": Anyone in eligibleUserIds can claim a slot
   * - "specific": Only the recipientId can claim (legacy DM behavior)
   */
  targetType: "universal" | "specific";

  /** For specific targeting (DM invites) */
  recipientId?: string;
  recipientName?: string;
  recipientAvatar?: string;

  /** All users who can see/claim this invite */
  eligibleUserIds: string[];

  // ============= PLAYER SLOTS =============
  /** Minimum players needed to start game */
  requiredPlayers: number;

  /** Maximum players allowed */
  maxPlayers: number;

  /** Players who have claimed slots (sender is always index 0) */
  claimedSlots: PlayerSlot[];

  /** When all required slots were filled */
  filledAt?: number;

  // ============= SPECTATING =============
  /** Is spectating enabled? Default true */
  spectatingEnabled: boolean;
  /** Spectator-only invites bypass player slots (reserved for future use). */
  spectatorOnly?: boolean;
  /** Current spectators watching the active game (if tracked on invite doc). */
  spectators?: SpectatorEntry[];
  /** Optional cap on concurrent spectators. */
  maxSpectators?: number;

  // ============= STATUS =============
  status: UniversalInviteStatus;

  // ============= GAME REFERENCE =============
  /** Game ID once created (status becomes 'active') */
  gameId?: string;

  // ============= LIFECYCLE METADATA =============
  /** Schema version — allows future migrations (currently 1) */
  inviteVersion?: number;

  /** Correlation ID for tracing across client → server → Firestore */
  traceId?: string;

  /** When the game finished (status becomes 'completed') */
  completedAt?: number;

  /** Winner's user ID (set on completion) */
  winnerId?: string;

  /** How the game ended (e.g. "checkmate", "resignation", "timeout") */
  winReason?: string;

  // ============= RESOLUTION / FINALIZATION =============
  /** When the invite was finalized (server-authoritative timestamp) */
  resolvedAt?: number;

  /**
   * How the game resolved. Used for analytics / UI decisions.
   * Missing on legacy invites — treat as undefined.
   */
  resolutionType?:
    | "win"
    | "loss"
    | "draw"
    | "resign"
    | "timeout"
    | "disconnect"
    | "cancel"
    | "expire"
    | "error";

  /** Who finalized the invite (server / client / room / watchdog) */
  resolvedBy?: "server" | "client" | "room" | "watchdog";

  // ============= CHAT VISIBILITY =============
  /**
   * Controls whether this invite renders in chat.
   * Missing on legacy invites — treat missing as "visible".
   */
  chatVisibility?: "visible" | "hidden";

  /** When chatVisibility was set to "hidden" */
  chatHiddenAt?: number;

  /** Conversation IDs where this invite should be hidden */
  chatHiddenInConversationIds?: string[];

  /** Server-set TTL: hard-delete after this timestamp */
  deleteAt?: number;

  // ============= SETTINGS =============
  settings: {
    isRated: boolean;
    timeControl?: {
      type: "none" | "per_turn" | "total";
      seconds: number;
    };
    chatEnabled: boolean;
    /** Pre-created Colyseus room key for real-time games (e.g. Sketch Party) */
    colyseusRoomKey?: string;
  };

  // ============= TIMESTAMPS =============
  createdAt: number; // Unix timestamp
  updatedAt: number; // Unix timestamp
  expiresAt: number; // Unix timestamp
  respondedAt?: number;

  // ============= VISIBILITY =============
  /** Show in Play page? true for DM invites, false for group invites */
  showInPlayPage: boolean;

  /** Message ID in chat (for linking invite to message) */
  chatMessageId?: string;

  /** v3 session ID — set by dual-write when invite was created alongside a v3 session */
  v3SessionId?: string;
}

/** Parameters for creating a universal invite */
export interface SendUniversalInviteParams {
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  gameType: TurnBasedGameType | RealTimeGameType;
  context: InviteContext;
  conversationId: string;
  conversationName?: string;
  /** Required for group invites - all group member IDs */
  eligibleUserIds?: string[];
  /** Required for DM (specific) invites */
  recipientId?: string;
  recipientName?: string;
  recipientAvatar?: string;
  /** Override default player count (for games like Crazy Eights) */
  requiredPlayers?: number;
  settings?: Partial<UniversalGameInvite["settings"]>;
  expirationMinutes?: number;
}

// =============================================================================
// Matchmaking Types
// =============================================================================

/**
 * Player in matchmaking queue
 */
export interface MatchmakingQueueEntry {
  id: string;
  gameType: TurnBasedGameType;
  userId: string;
  displayName: string;
  rating: number;
  config: TurnBasedMatchConfig;
  joinedAt: number;
  expiresAt: number;
  ratingRange: {
    min: number;
    max: number;
  };
}

/**
 * ELO rating update
 */
export interface RatingUpdate {
  userId: string;
  gameType: TurnBasedGameType;
  oldRating: number;
  newRating: number;
  matchId: string;
  result: "win" | "loss" | "draw";
  timestamp: number;
}

/**
 * Chat message in a match
 */
export interface MatchChatMessage {
  id: string;
  matchId: string;
  userId: string;
  displayName: string;
  content: string;
  type: "chat" | "system" | "emote";
  timestamp: number;
}

// =============================================================================
// Helper Types
// =============================================================================

/**
 * Union type for all game states
 */
export type AnyGameState =
  | ChessGameState
  | CheckersGameState
  | TicTacToeGameState
  | CrazyEightsGameState
  | FourGameState
  | DotsGameState
  | GomokuGameState
  | ReversiGameState;

/**
 * Union type for all moves
 */
export type AnyMove =
  | ChessMove
  | CheckersMove
  | TicTacToeMove
  | CrazyEightsMove
  | FourMove
  | DotsMove
  | GomokuMove
  | ReversiMove;

/**
 * Union type for all matches
 */
export type AnyMatch =
  | ChessMatch
  | CheckersMatch
  | TicTacToeMatch
  | CrazyEightsMatch
  | FourMatch
  | DotsMatch
  | GomokuMatch
  | ReversiMatch;

// =============================================================================
// Initial State Factories
// =============================================================================

/**
 * Create initial chess board
 */
export function createInitialChessBoard(): ChessBoard {
  const board: ChessBoard = Array(8)
    .fill(null)
    .map(() => Array(8).fill(null));

  // Set up pawns
  for (let col = 0; col < 8; col++) {
    board[1][col] = { type: "pawn", color: "white", hasMoved: false };
    board[6][col] = { type: "pawn", color: "black", hasMoved: false };
  }

  // Set up back ranks
  const backRankPieces: ChessPieceType[] = [
    "rook",
    "knight",
    "bishop",
    "queen",
    "king",
    "bishop",
    "knight",
    "rook",
  ];

  for (let col = 0; col < 8; col++) {
    board[0][col] = {
      type: backRankPieces[col],
      color: "white",
      hasMoved: false,
    };
    board[7][col] = {
      type: backRankPieces[col],
      color: "black",
      hasMoved: false,
    };
  }

  return board;
}

/**
 * Create initial checkers board
 */
export function createInitialCheckersBoard(): CheckersBoard {
  const board: CheckersBoard = Array(8)
    .fill(null)
    .map(() => Array(8).fill(null));

  // Set up red pieces (rows 0-2)
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) {
        board[row][col] = { color: "red", isKing: false };
      }
    }
  }

  // Set up black pieces (rows 5-7)
  for (let row = 5; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) {
        board[row][col] = { color: "black", isKing: false };
      }
    }
  }

  return board;
}

/**
 * Create initial Tic-Tac-Toe board
 */
export function createInitialTicTacToeBoard(): TicTacToeBoard {
  return [
    [null, null, null],
    [null, null, null],
    [null, null, null],
  ];
}

/**
 * Create initial Four (Connect Four) board Ã¢â‚¬â€ 6 rows Ãƒâ€” 7 columns, all empty
 */
export function createInitialFourBoard(): FourBoard {
  return Array.from({ length: 6 }, () => Array(7).fill(0) as FourCell[]);
}

/**
 * Create initial Dots (Dots & Boxes) board state Ã¢â‚¬â€ 5Ãƒâ€”5 dots
 */
export function createInitialDotsBoard(): {
  hLines: boolean[][];
  vLines: boolean[][];
  boxes: DotsOwner[][];
} {
  return {
    hLines: Array.from({ length: 5 }, () => Array(4).fill(false)),
    vLines: Array.from({ length: 4 }, () => Array(5).fill(false)),
    boxes: Array.from({ length: 4 }, () => Array(4).fill(0) as DotsOwner[]),
  };
}

/**
 * Create initial Gomoku board Ã¢â‚¬â€ 15Ãƒâ€”15, all empty
 */
export function createInitialGomokuBoard(): GomokuBoard {
  return Array.from({ length: 15 }, () => Array(15).fill(0) as GomokuCell[]);
}

/**
 * Create initial Reversi (Othello) board Ã¢â‚¬â€ 8Ãƒâ€”8 with 4 center pieces
 */
export function createInitialReversiBoard(): ReversiBoard {
  const board: ReversiBoard = Array.from(
    { length: 8 },
    () => Array(8).fill(0) as ReversiCell[],
  );
  // Standard Othello starting position
  board[3][3] = 2; // white
  board[3][4] = 1; // black
  board[4][3] = 1; // black
  board[4][4] = 2; // white
  return board;
}

/**
 * Create a standard 52-card deck
 */
export function createDeck(): Card[] {
  const suits: CardSuit[] = ["hearts", "diamonds", "clubs", "spades"];
  const ranks: CardRank[] = [
    "A",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "J",
    "Q",
    "K",
  ];

  const deck: Card[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({
        suit,
        rank,
        id: `${rank}-${suit}`,
      });
    }
  }

  return deck;
}

/**
 * Shuffle an array (Fisher-Yates)
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// =============================================================================
// Notation Helpers
// =============================================================================

/**
 * Convert chess position to algebraic notation
 */
export function positionToAlgebraic(pos: ChessPosition): string {
  const file = String.fromCharCode(97 + pos.col); // a-h
  const rank = (pos.row + 1).toString(); // 1-8
  return file + rank;
}

/**
 * Convert algebraic notation to chess position
 */
export function algebraicToPosition(notation: string): ChessPosition | null {
  if (notation.length !== 2) return null;

  const col = notation.charCodeAt(0) - 97;
  const row = parseInt(notation[1], 10) - 1;

  if (col < 0 || col > 7 || row < 0 || row > 7) return null;

  return { row, col };
}

/**
 * Get piece symbol for notation
 */
export function getPieceSymbol(type: ChessPieceType): string {
  const symbols: Record<ChessPieceType, string> = {
    king: "K",
    queen: "Q",
    rook: "R",
    bishop: "B",
    knight: "N",
    pawn: "",
  };
  return symbols[type];
}
