/**
 * Turn-Based Game Service
 *
 * Handles all turn-based game operations including:
 * - Match creation and management
 * - Move validation and submission
 * - Real-time subscriptions
 * - Matchmaking queue
 *
 * @see docs/06_GAMES_RESEARCH.md Section 5
 */

import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import {
  AnyGameState,
  AnyMatch,
  AnyMove,
  Card,
  CheckersGameState,
  ChessGameState,
  CrazyEightsGameState,
  createDeck,
  createInitialCheckersBoard,
  createInitialChessBoard,
  createInitialSnapDotsBoard,
  createInitialSnapFourBoard,
  createInitialSnapGomokuBoard,
  createInitialTicTacToeBoard,
  GameEndReason,
  GameInvite,
  MatchChatMessage,
  MatchmakingQueueEntry,
  MatchStatus,
  RatingUpdate,
  shuffleArray,
  SnapDotsGameState,
  SnapFourGameState,
  SnapGomokuGameState,
  Spectator,
  TicTacToeGameState,
  TurnBasedGameType,
  TurnBasedMatchConfig,
  TurnBasedPlayer,
} from "../types/turnBased";
import { getFirestoreInstance } from "./firebase";

// =============================================================================
// Firestore Collections
// =============================================================================

const COLLECTIONS = {
  matches: "TurnBasedGames",
  invites: "GameInvites",
  queue: "MatchmakingQueue",
  ratings: "PlayerRatings",
  spectators: "MatchSpectators",
  chat: "MatchChat",
} as const;

/**
 * Get Firestore instance (lazy load)
 */
function getDb() {
  return getFirestoreInstance();
}

/**
 * Convert Firestore Timestamp to milliseconds number
 * Handles both Firestore Timestamp objects and plain numbers
 */
function toMillis(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof (value as any).toMillis === "function"
  ) {
    return (value as any).toMillis();
  }
  // Fallback - try to parse as Date
  return new Date(value as any).getTime() || Date.now();
}

/**
 * Convert invite document data to properly typed GameInvite
 * Converts Firestore Timestamps to millisecond numbers
 */
function parseInviteDoc(
  docId: string,
  data: Record<string, unknown>,
): GameInvite {
  return {
    ...data,
    id: docId,
    createdAt: toMillis(data.createdAt),
    expiresAt: toMillis(data.expiresAt),
  } as GameInvite;
}

/**
 * Remove undefined values from an object (Firestore rejects undefined)
 * Works recursively on nested objects
 */
function removeUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      result[key] = removeUndefined(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

/**
 * Convert a 2D board array to a Firestore-compatible map format.
 * Firestore doesn't support nested arrays, so we store as { "row,col": value }
 */
function boardToMap<T>(board: (T | null)[][]): Record<string, T> {
  const map: Record<string, T> = {};
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const cell = board[row][col];
      if (cell !== null) {
        map[`${row},${col}`] = cell;
      }
    }
  }
  return map;
}

/**
 * Convert a Firestore map back to a 2D board array
 */
function mapToBoard<T>(
  map: Record<string, T>,
  rows: number,
  cols: number,
): (T | null)[][] {
  const board: (T | null)[][] = Array(rows)
    .fill(null)
    .map(() => Array(cols).fill(null));

  for (const [key, value] of Object.entries(map)) {
    const [row, col] = key.split(",").map(Number);
    if (row >= 0 && row < rows && col >= 0 && col < cols) {
      board[row][col] = value;
    }
  }
  return board;
}

/**
 * Convert game state to Firestore-compatible format
 * Converts 2D board arrays to map format
 * Removes undefined values (Firestore rejects them)
 */
function gameStateToFirestore(
  gameState: AnyGameState,
): Record<string, unknown> {
  const state = { ...gameState } as Record<string, unknown>;

  // Convert board if it exists and is a 2D array
  if (
    state.board &&
    Array.isArray(state.board) &&
    Array.isArray((state.board as unknown[])[0])
  ) {
    state.board = boardToMap(state.board as (unknown | null)[][]);
    state._boardRows = (gameState as { board: unknown[][] }).board.length;
    state._boardCols =
      (gameState as { board: unknown[][] }).board[0]?.length || 0;
  }

  // Handle Snap Dots: convert hLines, vLines, boxes (separate 2D arrays)
  if (
    state.hLines &&
    Array.isArray(state.hLines) &&
    Array.isArray((state.hLines as unknown[])[0])
  ) {
    const hLines = state.hLines as boolean[][];
    state.hLines = boardToMap(hLines as unknown as (unknown | null)[][]);
    state._hLinesRows = hLines.length;
    state._hLinesCols = hLines[0]?.length || 0;
  }
  if (
    state.vLines &&
    Array.isArray(state.vLines) &&
    Array.isArray((state.vLines as unknown[])[0])
  ) {
    const vLines = state.vLines as boolean[][];
    state.vLines = boardToMap(vLines as unknown as (unknown | null)[][]);
    state._vLinesRows = vLines.length;
    state._vLinesCols = vLines[0]?.length || 0;
  }
  if (
    state.boxes &&
    Array.isArray(state.boxes) &&
    Array.isArray((state.boxes as unknown[])[0])
  ) {
    const boxes = state.boxes as number[][];
    state.boxes = boardToMap(boxes as unknown as (unknown | null)[][]);
    state._boxesRows = boxes.length;
    state._boxesCols = boxes[0]?.length || 0;
  }

  // Remove all undefined values recursively (Firestore rejects them)
  return removeUndefined(state);
}

/**
 * Convert Firestore game state back to app format
 * Converts map format back to 2D board arrays
 */
function firestoreToGameState<T extends AnyGameState>(
  data: Record<string, unknown>,
): T {
  const state = { ...data } as Record<string, unknown>;

  // Convert board back if it was stored as a map
  if (
    state.board &&
    !Array.isArray(state.board) &&
    typeof state.board === "object"
  ) {
    const rows = (state._boardRows as number) || 8;
    const cols = (state._boardCols as number) || 8;
    state.board = mapToBoard(
      state.board as Record<string, unknown>,
      rows,
      cols,
    );
    delete state._boardRows;
    delete state._boardCols;
  }

  // Convert Snap Dots arrays back from maps
  if (
    state.hLines &&
    !Array.isArray(state.hLines) &&
    typeof state.hLines === "object"
  ) {
    const rows = (state._hLinesRows as number) || 5;
    const cols = (state._hLinesCols as number) || 4;
    state.hLines = mapToBoard(
      state.hLines as Record<string, unknown>,
      rows,
      cols,
    );
    delete state._hLinesRows;
    delete state._hLinesCols;
  }
  if (
    state.vLines &&
    !Array.isArray(state.vLines) &&
    typeof state.vLines === "object"
  ) {
    const rows = (state._vLinesRows as number) || 4;
    const cols = (state._vLinesCols as number) || 5;
    state.vLines = mapToBoard(
      state.vLines as Record<string, unknown>,
      rows,
      cols,
    );
    delete state._vLinesRows;
    delete state._vLinesCols;
  }
  if (
    state.boxes &&
    !Array.isArray(state.boxes) &&
    typeof state.boxes === "object"
  ) {
    const rows = (state._boxesRows as number) || 4;
    const cols = (state._boxesCols as number) || 4;
    state.boxes = mapToBoard(
      state.boxes as Record<string, unknown>,
      rows,
      cols,
    );
    delete state._boxesRows;
    delete state._boxesCols;
  }

  return state as T;
}

// =============================================================================
// Match Management
// =============================================================================

/**
 * Options for creating a new match
 * Supports conversation context tracking for games originated from chats
 */
export interface CreateMatchOptions {
  gameType: TurnBasedGameType;
  player1: TurnBasedPlayer;
  player2: TurnBasedPlayer;
  config: TurnBasedMatchConfig;
  /** Optional conversation context for tracking game origin */
  context?: {
    conversationId: string;
    conversationType: "dm" | "group";
  };
  /** Optional invite ID that spawned this game */
  inviteId?: string;
}

/**
 * Create a new turn-based match
 *
 * @param gameType - Type of game to create
 * @param player1 - First player (typically goes first)
 * @param player2 - Second player
 * @param config - Match configuration
 * @param context - Optional conversation context
 * @param inviteId - Optional invite ID for tracking
 * @returns The new match ID
 *
 * @example
 * // Simple creation
 * const matchId = await createMatch('chess', player1, player2, config);
 *
 * @example
 * // With conversation context
 * const matchId = await createMatch('chess', player1, player2, config, {
 *   conversationId: 'chat123',
 *   conversationType: 'dm'
 * });
 */
export async function createMatch(
  gameType: TurnBasedGameType,
  player1: TurnBasedPlayer,
  player2: TurnBasedPlayer,
  config: TurnBasedMatchConfig,
  context?: CreateMatchOptions["context"],
  inviteId?: string,
): Promise<string> {
  try {
    const gameState = createInitialGameState(
      gameType,
      player1.userId,
      player2.userId,
    );

    // Convert game state to Firestore-compatible format (no nested arrays)
    const firestoreGameState = gameStateToFirestore(gameState);

    // Clean player objects to remove any undefined values
    const cleanPlayer1 = removeUndefined(
      player1 as unknown as Record<string, unknown>,
    ) as unknown as TurnBasedPlayer;
    const cleanPlayer2 = removeUndefined(
      player2 as unknown as Record<string, unknown>,
    ) as unknown as TurnBasedPlayer;

    const match: Record<string, unknown> = {
      gameType,
      players: { player1: cleanPlayer1, player2: cleanPlayer2 },
      playerIds: [player1.userId, player2.userId], // For security rules array-contains queries
      gameState: firestoreGameState,
      moveHistory: [],
      currentTurn: player1.userId, // Player 1 (white/X) goes first
      turnNumber: 1,
      status: "active" as MatchStatus,
      config,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Only add timeControl if configured (Firestore rejects undefined)
    if (config.timeControl) {
      match.timeControl = {
        player1TimeMs: config.timeControl * 1000,
        player2TimeMs: config.timeControl * 1000,
        lastMoveTimestamp: Date.now(),
      };
    }

    // Add conversation context if provided (Phase 1: Game System Overhaul)
    if (context) {
      match.conversationId = context.conversationId;
      match.conversationType = context.conversationType;
    }

    // Add invite ID if provided (for invite status updates on game completion)
    if (inviteId) {
      match.inviteId = inviteId;
    }

    const docRef = await addDoc(
      collection(getDb(), COLLECTIONS.matches),
      match,
    );
    return docRef.id;
  } catch (error) {
    console.error("[turnBasedGames] createMatch failed:", error);
    throw error;
  }
}

/**
 * Get a match by ID
 */
export async function getMatch(matchId: string): Promise<AnyMatch | null> {
  const docRef = doc(getDb(), COLLECTIONS.matches, matchId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  // Convert game state back from Firestore format
  if (data.gameState) {
    data.gameState = firestoreToGameState(
      data.gameState as Record<string, unknown>,
    );
  }

  return { id: snapshot.id, ...data } as AnyMatch;
}

/**
 * Subscribe to match updates
 */
export function subscribeToMatch(
  matchId: string,
  onUpdate: (match: AnyMatch | null) => void,
  onError?: (error: Error) => void,
): () => void {
  const docRef = doc(getDb(), COLLECTIONS.matches, matchId);

  console.log(
    `[TurnBasedGames][${Date.now()}] Subscribing to match: ${matchId}`,
  );

  /** Terminal statuses — once reached, no further updates are expected */
  const TERMINAL_STATUSES: MatchStatus[] = ["completed", "abandoned"];
  let unsubscribeFn: (() => void) | null = null;

  const unsub = onSnapshot(
    docRef,
    (snapshot) => {
      const meta = snapshot.metadata;
      console.log(
        `[TurnBasedGames][${Date.now()}] Match update received for ${matchId}:`,
        snapshot.exists() ? "exists" : "not found",
        `| fromCache: ${meta.fromCache}`,
        `| hasPendingWrites: ${meta.hasPendingWrites}`,
      );

      if (!snapshot.exists()) {
        onUpdate(null);
        return;
      }
      const data = snapshot.data();
      console.log(`[TurnBasedGames][${Date.now()}] Match data:`, {
        currentTurn: data.currentTurn,
        turnNumber: data.turnNumber,
        moveHistoryLength: data.moveHistory?.length,
        status: data.status,
      });
      // Convert game state back from Firestore format
      if (data.gameState) {
        data.gameState = firestoreToGameState(
          data.gameState as Record<string, unknown>,
        );
      }
      const match = { id: snapshot.id, ...data } as AnyMatch;
      onUpdate(match);

      // Auto-unsubscribe once the game reaches a terminal state.
      // Deliver the final update first, then detach the listener to avoid
      // holding an open Firestore connection for a game that will never
      // change again.
      if (TERMINAL_STATUSES.includes(data.status)) {
        console.log(
          `[TurnBasedGames][${Date.now()}] Match ${matchId} reached terminal state "${data.status}" — unsubscribing`,
        );
        // Use queueMicrotask so the unsubscribe happens after onSnapshot returns
        queueMicrotask(() => unsubscribeFn?.());
      }
    },
    (error) => {
      console.error(
        `[TurnBasedGames][${Date.now()}] Error subscribing to match ${matchId}:`,
        error,
      );
      onError?.(error);
    },
  );

  unsubscribeFn = unsub;
  return unsub;
}

/**
 * Submit a move to a match
 */
export async function submitMove<T extends AnyMove>(
  matchId: string,
  move: T,
  newGameState: AnyGameState,
  nextPlayerId: string,
): Promise<void> {
  const startTime = Date.now();
  console.log(
    `[TurnBasedGames][${startTime}] Submitting move for match ${matchId}:`,
    {
      move: move,
      nextPlayerId,
    },
  );

  const docRef = doc(getDb(), COLLECTIONS.matches, matchId);
  const match = await getMatch(matchId);
  console.log(
    `[TurnBasedGames][${Date.now()}] Fetched current match state (took ${Date.now() - startTime}ms)`,
  );

  if (!match) {
    throw new Error("Match not found");
  }

  // Clean move of undefined values (Firestore rejects them)
  const cleanMove = removeUndefined(
    move as unknown as Record<string, unknown>,
  ) as unknown as T;
  const updatedMoveHistory = [...match.moveHistory, cleanMove];

  // Convert game state to Firestore format
  const firestoreGameState = gameStateToFirestore(newGameState);

  const updateData = {
    gameState: firestoreGameState,
    moveHistory: updatedMoveHistory,
    currentTurn: nextPlayerId,
    turnNumber: match.turnNumber + 1,
    lastMoveAt: Date.now(),
    updatedAt: serverTimestamp(),
  };

  console.log(
    `[TurnBasedGames][${Date.now()}] Updating Firestore document with:`,
    {
      currentTurn: updateData.currentTurn,
      turnNumber: updateData.turnNumber,
      moveHistoryLength: updateData.moveHistory.length,
      lastMoveAt: updateData.lastMoveAt,
    },
  );

  await updateDoc(docRef, updateData);

  console.log(
    `[TurnBasedGames][${Date.now()}] Move submitted successfully for match ${matchId} (total time: ${Date.now() - startTime}ms)`,
  );
}

/**
 * End a match
 */
export async function endMatch(
  matchId: string,
  winnerId: string | null,
  endReason: GameEndReason,
): Promise<void> {
  const docRef = doc(getDb(), COLLECTIONS.matches, matchId);

  await updateDoc(docRef, {
    status: "completed" as MatchStatus,
    winnerId,
    endReason,
    endedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Update ratings if the match was rated
  const match = await getMatch(matchId);
  if (match?.config.isRated && winnerId) {
    await updateRatings(match, winnerId);
  }
}

/**
 * Resign from a match
 */
export async function resignMatch(
  matchId: string,
  userId: string,
): Promise<void> {
  const match = await getMatch(matchId);

  if (!match) {
    throw new Error("Match not found");
  }

  const winnerId =
    match.players.player1.userId === userId
      ? match.players.player2.userId
      : match.players.player1.userId;

  await endMatch(matchId, winnerId, "resignation");
}

// =============================================================================
// Game Archive Functions
// =============================================================================

/**
 * Archive a game for a user
 *
 * The game will be hidden from the user's active games list but can
 * still be accessed via archived games or direct link.
 *
 * @param matchId - The match ID to archive
 * @param userId - The user who is archiving the game
 */
export async function archiveGame(
  matchId: string,
  userId: string,
): Promise<void> {
  const docRef = doc(getDb(), COLLECTIONS.matches, matchId);

  await updateDoc(docRef, {
    [`playerArchivedAt.${userId}`]: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Unarchive a game for a user
 *
 * The game will reappear in the user's active games list.
 *
 * @param matchId - The match ID to unarchive
 * @param userId - The user who is unarchiving the game
 */
export async function unarchiveGame(
  matchId: string,
  userId: string,
): Promise<void> {
  const docRef = doc(getDb(), COLLECTIONS.matches, matchId);

  await updateDoc(docRef, {
    [`playerArchivedAt.${userId}`]: deleteField(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Resign from a game (wrapper for resignMatch for UI consistency)
 *
 * @param matchId - The match ID to resign from
 * @param userId - The user who is resigning
 */
export async function resignGame(
  matchId: string,
  userId: string,
): Promise<void> {
  return resignMatch(matchId, userId);
}

// =============================================================================
// Game Cancellation
// =============================================================================

/**
 * Cancel a game - only allowed if no moves have been made
 *
 * This removes the game entirely rather than marking it as resigned.
 * Use this when a game was started by mistake or before any moves.
 *
 * @param matchId - The match ID to cancel
 * @param userId - The user requesting cancellation
 * @returns Success status and optional error message
 */
export async function cancelGame(
  matchId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  const db = getDb();
  const matchRef = doc(db, COLLECTIONS.matches, matchId);
  const matchDoc = await getDoc(matchRef);

  if (!matchDoc.exists()) {
    return { success: false, error: "Game not found" };
  }

  const match = matchDoc.data() as AnyMatch;

  // Check if user is a player in this game
  const isPlayer =
    match.players.player1.userId === userId ||
    match.players.player2.userId === userId;

  if (!isPlayer) {
    return { success: false, error: "Not a player in this game" };
  }

  // Only allow cancel if no moves have been made
  if (match.moveHistory && match.moveHistory.length > 0) {
    return {
      success: false,
      error: "Cannot cancel after moves have been made. Use resign instead.",
    };
  }

  // Also check turnNumber as a backup
  if (match.turnNumber > 1) {
    return {
      success: false,
      error: "Cannot cancel after the game has progressed. Use resign instead.",
    };
  }

  // Delete the match document
  await deleteDoc(matchRef);

  return { success: true };
}

// =============================================================================
// Draw Offer System
// =============================================================================

/**
 * Offer a draw to the opponent
 *
 * @param matchId - The match ID
 * @param userId - The user offering the draw
 */
export async function offerDraw(
  matchId: string,
  userId: string,
): Promise<void> {
  const docRef = doc(getDb(), COLLECTIONS.matches, matchId);

  await updateDoc(docRef, {
    drawOfferedBy: userId,
    drawOfferedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Accept a pending draw offer
 *
 * Validates that there is a valid draw offer from the opponent.
 *
 * @param matchId - The match ID
 * @param userId - The user accepting the draw
 */
export async function acceptDraw(
  matchId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  const db = getDb();
  const matchRef = doc(db, COLLECTIONS.matches, matchId);
  const matchDoc = await getDoc(matchRef);

  if (!matchDoc.exists()) {
    return { success: false, error: "Match not found" };
  }

  const match = matchDoc.data() as AnyMatch & {
    drawOfferedBy?: string;
    drawOfferedAt?: number;
  };

  // Verify there's a pending draw offer from the OTHER player
  if (!match.drawOfferedBy) {
    return { success: false, error: "No draw offer to accept" };
  }

  if (match.drawOfferedBy === userId) {
    return { success: false, error: "Cannot accept your own draw offer" };
  }

  // Verify user is a player in this game
  const isPlayer =
    match.players.player1.userId === userId ||
    match.players.player2.userId === userId;

  if (!isPlayer) {
    return { success: false, error: "Not a player in this game" };
  }

  // End the match as a draw
  await updateDoc(matchRef, {
    status: "completed",
    endReason: "draw_agreement",
    completedAt: serverTimestamp(),
    drawOfferedBy: deleteField(),
    drawOfferedAt: deleteField(),
    updatedAt: serverTimestamp(),
  });

  return { success: true };
}

/**
 * Decline a pending draw offer
 *
 * @param matchId - The match ID
 * @param userId - The user declining the draw
 */
export async function declineDraw(
  matchId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  const db = getDb();
  const matchRef = doc(db, COLLECTIONS.matches, matchId);
  const matchDoc = await getDoc(matchRef);

  if (!matchDoc.exists()) {
    return { success: false, error: "Match not found" };
  }

  const match = matchDoc.data() as AnyMatch & {
    drawOfferedBy?: string;
    drawOfferedAt?: number;
  };

  // Verify there's a pending draw offer
  if (!match.drawOfferedBy) {
    return { success: false, error: "No draw offer to decline" };
  }

  // Cannot decline your own offer (use withdraw instead)
  if (match.drawOfferedBy === userId) {
    return { success: false, error: "Cannot decline your own draw offer" };
  }

  // Verify user is a player in this game
  const isPlayer =
    match.players.player1.userId === userId ||
    match.players.player2.userId === userId;

  if (!isPlayer) {
    return { success: false, error: "Not a player in this game" };
  }

  // Remove the draw offer
  await updateDoc(matchRef, {
    drawOfferedBy: deleteField(),
    drawOfferedAt: deleteField(),
    updatedAt: serverTimestamp(),
  });

  return { success: true };
}

/**
 * Withdraw a draw offer you made
 *
 * @param matchId - The match ID
 * @param userId - The user withdrawing their draw offer
 */
export async function withdrawDrawOffer(
  matchId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  const db = getDb();
  const matchRef = doc(db, COLLECTIONS.matches, matchId);
  const matchDoc = await getDoc(matchRef);

  if (!matchDoc.exists()) {
    return { success: false, error: "Match not found" };
  }

  const match = matchDoc.data() as AnyMatch & {
    drawOfferedBy?: string;
    drawOfferedAt?: number;
  };

  // Verify the user is the one who offered the draw
  if (match.drawOfferedBy !== userId) {
    return { success: false, error: "You have not offered a draw" };
  }

  // Remove the draw offer
  await updateDoc(matchRef, {
    drawOfferedBy: deleteField(),
    drawOfferedAt: deleteField(),
    updatedAt: serverTimestamp(),
  });

  return { success: true };
}

/**
 * Get active matches for a user
 */
export async function getActiveMatches(userId: string): Promise<AnyMatch[]> {
  const q = query(
    collection(getDb(), COLLECTIONS.matches),
    where("playerIds", "array-contains", userId),
    where("status", "==", "active"),
    orderBy("updatedAt", "desc"),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    // Convert game state back from Firestore format
    if (data.gameState) {
      data.gameState = firestoreToGameState(
        data.gameState as Record<string, unknown>,
      );
    }
    return { id: docSnap.id, ...data } as AnyMatch;
  });
}

/**
 * Subscribe to active matches for a user (real-time)
 *
 * Provides real-time updates when:
 * - A new game is started (from invite or matchmaking)
 * - A game is completed or resigned
 * - A turn is made (updatedAt changes)
 *
 * @param userId - The user to get active matches for
 * @param onUpdate - Callback with updated matches list
 * @param onError - Optional error callback
 * @returns Unsubscribe function
 */
export function subscribeToActiveMatches(
  userId: string,
  onUpdate: (matches: AnyMatch[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const q = query(
    collection(getDb(), COLLECTIONS.matches),
    where("playerIds", "array-contains", userId),
    where("status", "==", "active"),
    orderBy("updatedAt", "desc"),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const matches = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        // Convert game state back from Firestore format
        if (data.gameState) {
          data.gameState = firestoreToGameState(
            data.gameState as Record<string, unknown>,
          );
        }
        return { id: docSnap.id, ...data } as AnyMatch;
      });
      onUpdate(matches);
    },
    (error) => {
      console.error(
        "[turnBasedGames] Active matches subscription error:",
        error,
      );
      onError?.(error);
    },
  );
}

/**
 * Get match history for a user
 */
export async function getMatchHistory(
  userId: string,
  gameType?: TurnBasedGameType,
  maxResults: number = 20,
): Promise<AnyMatch[]> {
  let q = query(
    collection(getDb(), COLLECTIONS.matches),
    where("playerIds", "array-contains", userId),
    where("status", "==", "completed"),
    orderBy("updatedAt", "desc"),
    limit(maxResults),
  );

  if (gameType) {
    q = query(
      collection(getDb(), COLLECTIONS.matches),
      where("playerIds", "array-contains", userId),
      where("status", "==", "completed"),
      where("gameType", "==", gameType),
      orderBy("updatedAt", "desc"),
      limit(maxResults),
    );
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    // Convert game state back from Firestore format
    if (data.gameState) {
      data.gameState = firestoreToGameState(
        data.gameState as Record<string, unknown>,
      );
    }
    return { id: docSnap.id, ...data } as AnyMatch;
  });
}

// =============================================================================
// Game Invites
// NOTE: All invite functions have been moved to gameInvites.ts.
// Use gameInvites.sendGameInvite() or sendUniversalInvite() instead.
// =============================================================================

// =============================================================================
// Matchmaking
// =============================================================================

/**
 * Join matchmaking queue
 */
export async function joinMatchmakingQueue(
  gameType: TurnBasedGameType,
  userId: string,
  displayName: string,
  rating: number,
  config: TurnBasedMatchConfig,
  ratingRange: number = 200,
): Promise<string> {
  // Check if already in queue
  const existing = await getQueueEntry(userId, gameType);
  if (existing) {
    throw new Error("Already in matchmaking queue for this game type");
  }

  const entry: Omit<MatchmakingQueueEntry, "id"> = {
    gameType,
    userId,
    displayName,
    rating,
    config,
    joinedAt: Date.now(),
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    ratingRange: {
      min: rating - ratingRange,
      max: rating + ratingRange,
    },
  };

  const docRef = await addDoc(collection(getDb(), COLLECTIONS.queue), entry);
  return docRef.id;
}

/**
 * Leave matchmaking queue
 */
export async function leaveMatchmakingQueue(
  userId: string,
  gameType: TurnBasedGameType,
): Promise<void> {
  const entry = await getQueueEntry(userId, gameType);
  if (entry) {
    await deleteDoc(doc(getDb(), COLLECTIONS.queue, entry.id));
  }
}

/**
 * Get queue entry for a user
 */
async function getQueueEntry(
  userId: string,
  gameType: TurnBasedGameType,
): Promise<MatchmakingQueueEntry | null> {
  const q = query(
    collection(getDb(), COLLECTIONS.queue),
    where("userId", "==", userId),
    where("gameType", "==", gameType),
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  return {
    id: snapshot.docs[0].id,
    ...snapshot.docs[0].data(),
  } as MatchmakingQueueEntry;
}

/**
 * Find a match in the queue (called by Cloud Function typically)
 */
export async function findMatch(
  entry: MatchmakingQueueEntry,
): Promise<MatchmakingQueueEntry | null> {
  const q = query(
    collection(getDb(), COLLECTIONS.queue),
    where("gameType", "==", entry.gameType),
    where("userId", "!=", entry.userId),
  );

  const snapshot = await getDocs(q);

  for (const doc of snapshot.docs) {
    const candidate = { id: doc.id, ...doc.data() } as MatchmakingQueueEntry;

    // Check rating compatibility
    if (
      candidate.rating >= entry.ratingRange.min &&
      candidate.rating <= entry.ratingRange.max &&
      entry.rating >= candidate.ratingRange.min &&
      entry.rating <= candidate.ratingRange.max
    ) {
      return candidate;
    }
  }

  return null;
}

// =============================================================================
// Ratings
// =============================================================================

/**
 * Get player rating for a game type
 */
export async function getPlayerRating(
  userId: string,
  gameType: TurnBasedGameType,
): Promise<number> {
  const docRef = doc(getDb(), COLLECTIONS.ratings, `${userId}_${gameType}`);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    return 1200; // Default ELO rating
  }

  return snapshot.data().rating as number;
}

/**
 * Update ratings after a match
 */
async function updateRatings(match: AnyMatch, winnerId: string): Promise<void> {
  const player1 = match.players.player1;
  const player2 = match.players.player2;

  const rating1 = await getPlayerRating(player1.userId, match.gameType);
  const rating2 = await getPlayerRating(player2.userId, match.gameType);

  // Calculate ELO changes
  const K = 32; // K-factor
  const expected1 = 1 / (1 + Math.pow(10, (rating2 - rating1) / 400));
  const expected2 = 1 / (1 + Math.pow(10, (rating1 - rating2) / 400));

  let score1: number;
  let score2: number;

  if (winnerId === player1.userId) {
    score1 = 1;
    score2 = 0;
  } else if (winnerId === player2.userId) {
    score1 = 0;
    score2 = 1;
  } else {
    // Draw
    score1 = 0.5;
    score2 = 0.5;
  }

  const newRating1 = Math.round(rating1 + K * (score1 - expected1));
  const newRating2 = Math.round(rating2 + K * (score2 - expected2));

  // Update ratings in Firestore
  const ratingDoc1 = doc(
    getDb(),
    COLLECTIONS.ratings,
    `${player1.userId}_${match.gameType}`,
  );
  const ratingDoc2 = doc(
    getDb(),
    COLLECTIONS.ratings,
    `${player2.userId}_${match.gameType}`,
  );

  await Promise.all([
    setDoc(
      ratingDoc1,
      {
        rating: newRating1,
        userId: player1.userId,
        gameType: match.gameType,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
    setDoc(
      ratingDoc2,
      {
        rating: newRating2,
        userId: player2.userId,
        gameType: match.gameType,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
  ]);

  // Record rating history
  const update1: Omit<RatingUpdate, "userId"> = {
    gameType: match.gameType,
    oldRating: rating1,
    newRating: newRating1,
    matchId: match.id,
    result: score1 === 1 ? "win" : score1 === 0 ? "loss" : "draw",
    timestamp: Date.now(),
  };

  const update2: Omit<RatingUpdate, "userId"> = {
    gameType: match.gameType,
    oldRating: rating2,
    newRating: newRating2,
    matchId: match.id,
    result: score2 === 1 ? "win" : score2 === 0 ? "loss" : "draw",
    timestamp: Date.now(),
  };

  await Promise.all([
    addDoc(
      collection(getDb(), `users/${player1.userId}/ratingHistory`),
      update1,
    ),
    addDoc(
      collection(getDb(), `users/${player2.userId}/ratingHistory`),
      update2,
    ),
  ]);
}

// =============================================================================
// Spectators
// =============================================================================

/**
 * Join as a spectator
 */
export async function joinAsSpectator(
  matchId: string,
  userId: string,
  displayName: string,
): Promise<string> {
  const match = await getMatch(matchId);
  if (!match) {
    throw new Error("Match not found");
  }

  if (!match.config.allowSpectators) {
    throw new Error("Spectators not allowed in this match");
  }

  const spectator: Omit<Spectator, "id"> = {
    userId,
    displayName,
    joinedAt: Date.now(),
  };

  const docRef = await addDoc(
    collection(
      getDb(),
      `${COLLECTIONS.matches}/${matchId}/${COLLECTIONS.spectators}`,
    ),
    spectator,
  );

  return docRef.id;
}

/**
 * Leave as a spectator
 */
export async function leaveAsSpectator(
  matchId: string,
  spectatorId: string,
): Promise<void> {
  await deleteDoc(
    doc(
      getDb(),
      `${COLLECTIONS.matches}/${matchId}/${COLLECTIONS.spectators}`,
      spectatorId,
    ),
  );
}

/**
 * Get spectators for a match
 */
export async function getSpectators(matchId: string): Promise<Spectator[]> {
  const q = query(
    collection(
      getDb(),
      `${COLLECTIONS.matches}/${matchId}/${COLLECTIONS.spectators}`,
    ),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as Spectator,
  );
}

// =============================================================================
// Match Chat
// =============================================================================

/**
 * Send a chat message in a match
 */
export async function sendMatchChatMessage(
  matchId: string,
  userId: string,
  displayName: string,
  content: string,
  type: "chat" | "emote" = "chat",
): Promise<void> {
  const match = await getMatch(matchId);
  if (!match) {
    throw new Error("Match not found");
  }

  if (!match.config.chatEnabled) {
    throw new Error("Chat is not enabled for this match");
  }

  const message: Omit<MatchChatMessage, "id"> = {
    matchId,
    userId,
    displayName,
    content,
    type,
    timestamp: Date.now(),
  };

  await addDoc(
    collection(
      getDb(),
      `${COLLECTIONS.matches}/${matchId}/${COLLECTIONS.chat}`,
    ),
    message,
  );
}

/**
 * Subscribe to match chat
 */
export function subscribeToMatchChat(
  matchId: string,
  onMessage: (messages: MatchChatMessage[]) => void,
): () => void {
  const q = query(
    collection(
      getDb(),
      `${COLLECTIONS.matches}/${matchId}/${COLLECTIONS.chat}`,
    ),
    orderBy("timestamp", "asc"),
  );

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as MatchChatMessage,
    );
    onMessage(messages);
  });
}

// =============================================================================
// Initial Game State Factory
// =============================================================================

/**
 * Create initial game state based on game type
 */
function createInitialGameState(
  gameType: TurnBasedGameType,
  player1Id: string,
  player2Id: string,
): AnyGameState {
  switch (gameType) {
    case "chess":
      return createInitialChessState();
    case "checkers":
      return createInitialCheckersState();
    case "tic_tac_toe":
      return createInitialTicTacToeState();
    case "crazy_eights":
      return createInitialCrazyEightsState(player1Id, player2Id);
    case "connect_four":
      return createInitialSnapFourState();
    case "dot_match":
      return createInitialSnapDotsState();
    case "gomoku_master":
      return createInitialSnapGomokuState();
    default:
      throw new Error(`Unknown game type: ${gameType}`);
  }
}

function createInitialChessState(): ChessGameState {
  return {
    board: createInitialChessBoard(),
    currentTurn: "white",
    castlingRights: {
      whiteKingside: true,
      whiteQueenside: true,
      blackKingside: true,
      blackQueenside: true,
    },
    enPassantTarget: null,
    halfMoveClock: 0,
    fullMoveNumber: 1,
    isCheck: false,
    isCheckmate: false,
    isStalemate: false,
    isDraw: false,
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  };
}

function createInitialCheckersState(): CheckersGameState {
  return {
    board: createInitialCheckersBoard(),
    currentTurn: "red", // Red goes first in American checkers
    redPieces: 12,
    blackPieces: 12,
    redKings: 0,
    blackKings: 0,
    mustJump: false,
  };
}

function createInitialTicTacToeState(): TicTacToeGameState {
  return {
    board: createInitialTicTacToeBoard(),
    currentTurn: "X",
    winner: null,
  };
}

function createInitialCrazyEightsState(
  player1Id: string,
  player2Id: string,
): CrazyEightsGameState {
  let deck = shuffleArray(createDeck());

  // Deal 7 cards to each player
  const INITIAL_HAND_SIZE = 7;
  const hands: Record<string, Card[]> = {
    [player1Id]: [],
    [player2Id]: [],
  };

  for (let i = 0; i < INITIAL_HAND_SIZE; i++) {
    hands[player1Id].push(deck.pop()!);
    hands[player2Id].push(deck.pop()!);
  }

  // Draw first card for discard pile (redraw if it's an 8)
  let topCard = deck.pop()!;
  while (topCard.rank === "8") {
    // Put 8 back in deck and reshuffle
    deck.unshift(topCard);
    deck = shuffleArray(deck);
    topCard = deck.pop()!;
  }

  return {
    discardPile: [topCard],
    deckSize: deck.length,
    topCard,
    currentSuit: topCard.suit,
    currentTurn: player1Id,
    direction: 1,
    drawCount: 0,
    mustDraw: false,
    hasDrawnThisTurn: false,
    // Include hands and deck for online play
    hands,
    deck,
  };
}

function createInitialSnapFourState(): SnapFourGameState {
  return {
    board: createInitialSnapFourBoard(),
    currentTurn: 1, // Player 1 (red) goes first
  };
}

function createInitialSnapDotsState(): SnapDotsGameState {
  const { hLines, vLines, boxes } = createInitialSnapDotsBoard();
  return {
    hLines,
    vLines,
    boxes,
    currentTurn: 1,
    scores: { player1: 0, player2: 0 },
    linesDrawn: 0,
  };
}

function createInitialSnapGomokuState(): SnapGomokuGameState {
  return {
    board: createInitialSnapGomokuBoard(),
    currentTurn: 1, // Black (player 1) goes first
  };
}

// =============================================================================
// Exports
// =============================================================================

export const turnBasedGameService = {
  // Match management
  createMatch,
  getMatch,
  subscribeToMatch,
  subscribeToActiveMatches,
  submitMove,
  endMatch,
  resignMatch,
  getActiveMatches,
  getMatchHistory,

  // Archive & Cancel functions
  archiveGame,
  unarchiveGame,
  resignGame,
  cancelGame,

  // Draw offer system
  offerDraw,
  acceptDraw,
  declineDraw,
  withdrawDrawOffer,

  // Invites: all moved to gameInvites.ts

  // Matchmaking
  joinMatchmakingQueue,
  leaveMatchmakingQueue,
  findMatch,

  // Ratings
  getPlayerRating,

  // Spectators
  joinAsSpectator,
  leaveAsSpectator,
  getSpectators,

  // Chat
  sendMatchChatMessage,
  subscribeToMatchChat,
};

export default turnBasedGameService;

