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
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
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
  createInitialTicTacToeBoard,
  GameEndReason,
  GameInvite,
  GameInviteStatus,
  MatchChatMessage,
  MatchmakingQueueEntry,
  MatchStatus,
  RatingUpdate,
  shuffleArray,
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

  // Remove undefined values (Firestore rejects them)
  for (const key of Object.keys(state)) {
    if (state[key] === undefined) {
      delete state[key];
    }
  }

  return state;
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

  return state as T;
}

// =============================================================================
// Match Management
// =============================================================================

/**
 * Create a new turn-based match
 */
export async function createMatch(
  gameType: TurnBasedGameType,
  player1: TurnBasedPlayer,
  player2: TurnBasedPlayer,
  config: TurnBasedMatchConfig,
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
): () => void {
  const docRef = doc(getDb(), COLLECTIONS.matches, matchId);

  return onSnapshot(docRef, (snapshot) => {
    if (!snapshot.exists()) {
      onUpdate(null);
      return;
    }
    const data = snapshot.data();
    // Convert game state back from Firestore format
    if (data.gameState) {
      data.gameState = firestoreToGameState(
        data.gameState as Record<string, unknown>,
      );
    }
    onUpdate({ id: snapshot.id, ...data } as AnyMatch);
  });
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
  const docRef = doc(getDb(), COLLECTIONS.matches, matchId);
  const match = await getMatch(matchId);

  if (!match) {
    throw new Error("Match not found");
  }

  const updatedMoveHistory = [...match.moveHistory, move];

  // Convert game state to Firestore format
  const firestoreGameState = gameStateToFirestore(newGameState);

  await updateDoc(docRef, {
    gameState: firestoreGameState,
    moveHistory: updatedMoveHistory,
    currentTurn: nextPlayerId,
    turnNumber: match.turnNumber + 1,
    lastMoveAt: Date.now(),
    updatedAt: serverTimestamp(),
  });
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

/**
 * Offer a draw
 */
export async function offerDraw(
  matchId: string,
  userId: string,
): Promise<void> {
  const docRef = doc(getDb(), COLLECTIONS.matches, matchId);

  await updateDoc(docRef, {
    drawOfferedBy: userId,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Accept a draw offer
 */
export async function acceptDraw(matchId: string): Promise<void> {
  await endMatch(matchId, null, "draw_agreement");
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
// NOTE: sendGameInvite has been moved to gameInvites.ts to avoid duplication.
// Use gameInvites.sendGameInvite() or the new sendUniversalInvite() instead.
// =============================================================================

/**
 * Get pending invites for a user
 */
export async function getPendingInvites(userId: string): Promise<GameInvite[]> {
  const q = query(
    collection(getDb(), COLLECTIONS.invites),
    where("recipientId", "==", userId),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc"),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnapshot) => {
    const data = docSnapshot.data();
    return parseInviteDoc(docSnapshot.id, data);
  });
}

/**
 * Subscribe to invites for a user
 */
export function subscribeToInvites(
  userId: string,
  onUpdate: (invites: GameInvite[]) => void,
): () => void {
  const q = query(
    collection(getDb(), COLLECTIONS.invites),
    where("recipientId", "==", userId),
    where("status", "==", "pending"),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const invites = snapshot.docs.map((docSnapshot) => {
        const data = docSnapshot.data();
        return parseInviteDoc(docSnapshot.id, data);
      });
      onUpdate(invites);
    },
    (error) => {
      console.error("[turnBasedGames] subscribeToInvites - Error:", error);
    },
  );
}

/**
 * Respond to a game invite
 */
export async function respondToInvite(
  inviteId: string,
  accept: boolean,
): Promise<string | null> {
  const docRef = doc(getDb(), COLLECTIONS.invites, inviteId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    throw new Error("Invite not found");
  }

  const invite = parseInviteDoc(snapshot.id, snapshot.data());

  if (invite.status !== "pending") {
    throw new Error("Invite is no longer pending");
  }

  if (!accept) {
    await updateDoc(docRef, { status: "declined" as GameInviteStatus });
    return null;
  }

  // Build player objects, excluding undefined values (Firestore rejects undefined)
  const player1: TurnBasedPlayer = {
    userId: invite.senderId,
    displayName: invite.senderName,
    color: "white",
  };
  // Only add avatarUrl if it exists
  if (invite.senderAvatar) {
    player1.avatarUrl = invite.senderAvatar;
  }

  const player2: TurnBasedPlayer = {
    userId: invite.recipientId,
    displayName: invite.recipientName,
    color: "black",
  };
  // Only add avatarUrl if it exists
  if (invite.recipientAvatar) {
    player2.avatarUrl = invite.recipientAvatar;
  }

  const matchId = await createMatch(
    invite.gameType as TurnBasedGameType,
    player1,
    player2,
    invite.config,
  );

  await updateDoc(docRef, {
    status: "accepted" as GameInviteStatus,
    matchId,
  });

  return matchId;
}

/**
 * Cancel a sent invite
 */
export async function cancelInvite(inviteId: string): Promise<void> {
  const docRef = doc(getDb(), COLLECTIONS.invites, inviteId);
  await updateDoc(docRef, { status: "cancelled" as GameInviteStatus });
}

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
    updateDoc(ratingDoc1, { rating: newRating1, updatedAt: serverTimestamp() }),
    updateDoc(ratingDoc2, { rating: newRating2, updatedAt: serverTimestamp() }),
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

// =============================================================================
// Exports
// =============================================================================

export const turnBasedGameService = {
  // Match management
  createMatch,
  getMatch,
  subscribeToMatch,
  submitMove,
  endMatch,
  resignMatch,
  offerDraw,
  acceptDraw,
  getActiveMatches,
  getMatchHistory,

  // Invites (NOTE: sendGameInvite moved to gameInvites.ts)
  getPendingInvites,
  subscribeToInvites,
  respondToInvite,
  cancelInvite,

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
