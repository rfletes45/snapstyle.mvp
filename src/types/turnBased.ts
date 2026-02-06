/**
 * Turn-Based Game Types
 *
 * Type definitions for turn-based multiplayer games including:
 * - Chess, Checkers, Tic-Tac-Toe, Crazy Eights
 *
 * @see docs/06_GAMES_RESEARCH.md Section 5
 */

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
}

/**
 * Turn-based game types
 */
export type TurnBasedGameType =
  | "chess"
  | "checkers"
  | "tic_tac_toe"
  | "crazy_eights"
  | "snap_four"
  | "snap_dots"
  | "snap_gomoku";

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
  /** Allow spectators */
  allowSpectators: boolean;
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
 */
export const CRAZY_EIGHTS_CONFIG = {
  /** Initial hand size for each player */
  initialHandSize: 7,
  /** Maximum number of draws per turn (typically 1) */
  maxDrawsPerTurn: 1,
  /** Minimum players for a game */
  minPlayers: 2,
  /** Maximum players for a game */
  maxPlayers: 4,
  /** The rank that allows suit declaration */
  wildRank: "8" as CardRank,
} as const;

/**
 * Crazy Eights move
 */
export interface CrazyEightsMove {
  type: "play" | "draw" | "pass";
  card?: Card;
  declaredSuit?: CardSuit; // When playing an 8
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
 * Crazy Eights game state
 */
export interface CrazyEightsGameState {
  discardPile: Card[];
  deckSize: number; // Cards remaining in draw pile
  topCard: Card;
  currentSuit: CardSuit; // May differ from top card if 8 was played
  currentTurn: string; // userId
  direction: 1 | -1; // For turn direction in multiplayer
  drawCount: number; // Cards drawn this turn (max 1, then must play or pass)
  mustDraw: boolean; // If player cannot play
  hasDrawnThisTurn: boolean; // Prevents unlimited draws - player draws once then must play or pass
  // Online game data (stored in Firestore)
  hands?: Record<string, Card[]>; // Player hands keyed by playerId
  deck?: Card[]; // Remaining deck for online games
  playerOrder?: string[]; // Order of players for turn management (2-7 players)
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
// Snap Four (Connect Four) Types
// =============================================================================

/**
 * Snap Four cell: 0 = empty, 1 = player 1 (red), 2 = player 2 (yellow)
 */
export type SnapFourCell = 0 | 1 | 2;

/**
 * Snap Four board (6 rows × 7 columns)
 */
export type SnapFourBoard = SnapFourCell[][];

/**
 * Snap Four move — drop a disc into a column
 */
export interface SnapFourMove {
  column: number; // 0-6
  row: number; // The row where the disc landed
  player: 1 | 2;
  timestamp: number;
}

/**
 * Snap Four game state
 */
export interface SnapFourGameState {
  board: SnapFourBoard;
  currentTurn: 1 | 2;
}

/**
 * Snap Four match type
 */
export type SnapFourMatch = TurnBasedMatch<SnapFourGameState, SnapFourMove>;

// =============================================================================
// Snap Dots (Dots & Boxes) Types
// =============================================================================

/**
 * Snap Dots box owner: 0 = unclaimed, 1 = player 1, 2 = player 2
 */
export type SnapDotsOwner = 0 | 1 | 2;

/**
 * Snap Dots move — draw a horizontal or vertical line
 */
export interface SnapDotsMove {
  type: "h" | "v"; // horizontal or vertical line
  row: number;
  col: number;
  player: 1 | 2;
  completedBoxes: number; // How many boxes were completed by this move
  timestamp: number;
}

/**
 * Snap Dots game state (5×5 dots → 4×4 boxes)
 *
 * hLines[row][col]: horizontal line from dot(row,col) to dot(row,col+1)
 * vLines[row][col]: vertical line from dot(row,col) to dot(row+1,col)
 * boxes[row][col]: owner of box at position (row,col)
 */
export interface SnapDotsGameState {
  hLines: boolean[][]; // [5][4] — 5 rows of horizontal lines, 4 per row
  vLines: boolean[][]; // [4][5] — 4 rows of vertical lines, 5 per row
  boxes: SnapDotsOwner[][]; // [4][4] — 4×4 box grid
  currentTurn: 1 | 2;
  scores: { player1: number; player2: number };
  linesDrawn: number;
}

/**
 * Snap Dots match type
 */
export type SnapDotsMatch = TurnBasedMatch<SnapDotsGameState, SnapDotsMove>;

// =============================================================================
// Snap Gomoku (Five in a Row) Types
// =============================================================================

/**
 * Snap Gomoku cell: 0 = empty, 1 = black, 2 = white
 */
export type SnapGomokuCell = 0 | 1 | 2;

/**
 * Snap Gomoku board (15×15)
 */
export type SnapGomokuBoard = SnapGomokuCell[][];

/**
 * Snap Gomoku move — place a stone on an intersection
 */
export interface SnapGomokuMove {
  row: number; // 0-14
  col: number; // 0-14
  player: 1 | 2;
  timestamp: number;
}

/**
 * Snap Gomoku game state
 */
export interface SnapGomokuGameState {
  board: SnapGomokuBoard;
  currentTurn: 1 | 2;
  lastMove?: { row: number; col: number };
}

/**
 * Snap Gomoku match type
 */
export type SnapGomokuMatch = TurnBasedMatch<
  SnapGomokuGameState,
  SnapGomokuMove
>;

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

/**
 * Real-time game types (for invites)
 */
export type RealTimeGameType = "8ball_pool" | "air_hockey";

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
  | "active" // Game in progress
  | "completed" // Game finished
  | "declined" // Recipient declined (DM/specific only)
  | "expired" // Time limit exceeded
  | "cancelled"; // Sender cancelled

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

  /** Is this invite ONLY for spectating an existing game? */
  spectatorOnly: boolean;

  /** Users currently spectating */
  spectators: SpectatorEntry[];

  /** Max spectators allowed (undefined = unlimited) */
  maxSpectators?: number;

  // ============= STATUS =============
  status: UniversalInviteStatus;

  // ============= GAME REFERENCE =============
  /** Game ID once created (status becomes 'active') */
  gameId?: string;

  // ============= SETTINGS =============
  settings: {
    isRated: boolean;
    timeControl?: {
      type: "none" | "per_turn" | "total";
      seconds: number;
    };
    chatEnabled: boolean;
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

// =============================================================================
// Spectator Types
// =============================================================================

/**
 * Spectator in a match
 */
export interface Spectator {
  id: string;
  userId: string;
  displayName: string;
  joinedAt: number;
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
  | SnapFourGameState
  | SnapDotsGameState
  | SnapGomokuGameState;

/**
 * Union type for all moves
 */
export type AnyMove =
  | ChessMove
  | CheckersMove
  | TicTacToeMove
  | CrazyEightsMove
  | SnapFourMove
  | SnapDotsMove
  | SnapGomokuMove;

/**
 * Union type for all matches
 */
export type AnyMatch =
  | ChessMatch
  | CheckersMatch
  | TicTacToeMatch
  | CrazyEightsMatch
  | SnapFourMatch
  | SnapDotsMatch
  | SnapGomokuMatch;

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
 * Create initial Snap Four (Connect Four) board — 6 rows × 7 columns, all empty
 */
export function createInitialSnapFourBoard(): SnapFourBoard {
  return Array.from({ length: 6 }, () => Array(7).fill(0) as SnapFourCell[]);
}

/**
 * Create initial Snap Dots (Dots & Boxes) board state — 5×5 dots
 */
export function createInitialSnapDotsBoard(): {
  hLines: boolean[][];
  vLines: boolean[][];
  boxes: SnapDotsOwner[][];
} {
  return {
    hLines: Array.from({ length: 5 }, () => Array(4).fill(false)),
    vLines: Array.from({ length: 4 }, () => Array(5).fill(false)),
    boxes: Array.from({ length: 4 }, () => Array(4).fill(0) as SnapDotsOwner[]),
  };
}

/**
 * Create initial Snap Gomoku board — 15×15, all empty
 */
export function createInitialSnapGomokuBoard(): SnapGomokuBoard {
  return Array.from(
    { length: 15 },
    () => Array(15).fill(0) as SnapGomokuCell[],
  );
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
