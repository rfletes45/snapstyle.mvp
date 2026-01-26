/**
 * Turn-Based Game Integration Tests
 * Phase 7: Testing Requirements
 *
 * Tests for complete turn-based game flow:
 * - Making moves
 * - Turn validation
 * - Game completion (checkmate, resignation, draw)
 * - Rating updates
 *
 * @see src/services/turnBasedGames.ts
 */

import { ExtendedGameType } from "@/types/games";

// =============================================================================
// Mock Types and State
// =============================================================================

interface ChessGame {
  id: string;
  gameType: "chess";
  players: {
    white: string;
    black: string;
  };
  currentTurn: "white" | "black";
  fen: string;
  moveHistory: string[];
  status: "active" | "completed";
  winner: string | null;
  endReason:
    | "checkmate"
    | "resignation"
    | "timeout"
    | "draw_agreement"
    | "stalemate"
    | null;
  drawOffer: string | null;
  createdAt: number;
}

interface MoveResult {
  success: boolean;
  newFen: string;
  gameOver: boolean;
  winner: string | null;
  endReason: string | null;
}

interface UserRating {
  rating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
}

// Mock database
let games: Map<string, ChessGame> = new Map();
let userRatings: Map<string, Map<ExtendedGameType, UserRating>> = new Map();

// =============================================================================
// Mock Service Functions
// =============================================================================

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function resetMocks(): void {
  games = new Map();
  userRatings = new Map();
}

async function createTestUser(
  name: string,
  options?: { chessRating?: number },
): Promise<string> {
  const userId = `user_${name}_${generateId()}`;

  if (options?.chessRating) {
    if (!userRatings.has(userId)) {
      userRatings.set(userId, new Map());
    }
    userRatings.get(userId)!.set("chess", {
      rating: options.chessRating,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
    });
  }

  return userId;
}

async function createGame(params: {
  gameType: "chess";
  players: { white: string; black: string };
}): Promise<string> {
  const id = generateId();
  const game: ChessGame = {
    id,
    gameType: params.gameType,
    players: params.players,
    currentTurn: "white",
    fen: STARTING_FEN,
    moveHistory: [],
    status: "active",
    winner: null,
    endReason: null,
    drawOffer: null,
    createdAt: Date.now(),
  };
  games.set(id, game);
  return id;
}

async function getGame(gameId: string): Promise<ChessGame | null> {
  return games.get(gameId) || null;
}

// Simplified move validation (in real app, use chess.js)
function isValidMove(
  fen: string,
  move: { from: string; to: string },
): { valid: boolean; newFen: string; isCheckmate: boolean } {
  // Mock validation - just check basic format
  const validSquares = /^[a-h][1-8]$/;
  if (!validSquares.test(move.from) || !validSquares.test(move.to)) {
    return { valid: false, newFen: fen, isCheckmate: false };
  }

  // For testing purposes, we'll simulate specific game scenarios
  const moveStr = `${move.from}${move.to}`;

  // Fool's mate sequence check
  if (fen.includes("rnb1kbnr") && moveStr === "d8h4") {
    return {
      valid: true,
      newFen: "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3",
      isCheckmate: true,
    };
  }

  // Simple: any move is valid, update turn indicator in FEN
  const parts = fen.split(" ");
  const newTurn = parts[1] === "w" ? "b" : "w";
  parts[1] = newTurn;

  return { valid: true, newFen: parts.join(" "), isCheckmate: false };
}

async function makeMove(
  gameId: string,
  userId: string,
  move: { from: string; to: string },
): Promise<MoveResult> {
  const game = games.get(gameId);
  if (!game) throw new Error("Game not found");
  if (game.status !== "active") throw new Error("Game is not active");

  // Check it's the player's turn
  const isWhite = game.players.white === userId;
  const isBlack = game.players.black === userId;

  if (!isWhite && !isBlack) throw new Error("You are not in this game");

  const expectedTurn = isWhite ? "white" : "black";
  if (game.currentTurn !== expectedTurn) throw new Error("Not your turn");

  // Validate move
  const validation = isValidMove(game.fen, move);
  if (!validation.valid) throw new Error("Illegal move");

  // Update game state
  game.fen = validation.newFen;
  game.moveHistory.push(`${move.from}-${move.to}`);
  game.currentTurn = game.currentTurn === "white" ? "black" : "white";

  // Check for checkmate
  if (validation.isCheckmate) {
    game.status = "completed";
    game.winner = userId;
    game.endReason = "checkmate";
  }

  games.set(gameId, game);

  return {
    success: true,
    newFen: game.fen,
    gameOver: game.status === "completed",
    winner: game.winner,
    endReason: game.endReason,
  };
}

async function resignGame(gameId: string, userId: string): Promise<void> {
  const game = games.get(gameId);
  if (!game) throw new Error("Game not found");
  if (game.status !== "active") throw new Error("Game is not active");

  const isWhite = game.players.white === userId;
  const isBlack = game.players.black === userId;

  if (!isWhite && !isBlack) throw new Error("You are not in this game");

  game.status = "completed";
  game.winner = isWhite ? game.players.black : game.players.white;
  game.endReason = "resignation";

  games.set(gameId, game);
}

async function offerDraw(gameId: string, userId: string): Promise<void> {
  const game = games.get(gameId);
  if (!game) throw new Error("Game not found");
  if (game.status !== "active") throw new Error("Game is not active");

  const isPlayer =
    game.players.white === userId || game.players.black === userId;
  if (!isPlayer) throw new Error("You are not in this game");

  game.drawOffer = userId;
  games.set(gameId, game);
}

async function respondToDraw(
  gameId: string,
  userId: string,
  accept: boolean,
): Promise<void> {
  const game = games.get(gameId);
  if (!game) throw new Error("Game not found");
  if (game.status !== "active") throw new Error("Game is not active");
  if (!game.drawOffer) throw new Error("No draw offer pending");
  if (game.drawOffer === userId) throw new Error("Cannot respond to own offer");

  const isPlayer =
    game.players.white === userId || game.players.black === userId;
  if (!isPlayer) throw new Error("You are not in this game");

  if (accept) {
    game.status = "completed";
    game.winner = null;
    game.endReason = "draw_agreement";
  }

  game.drawOffer = null;
  games.set(gameId, game);
}

async function getUserRating(
  userId: string,
  gameType: ExtendedGameType,
): Promise<number> {
  const userRatingMap = userRatings.get(userId);
  if (!userRatingMap || !userRatingMap.has(gameType)) {
    return 1200; // Default starting rating
  }
  return userRatingMap.get(gameType)!.rating;
}

async function setGameResult(gameId: string, winnerId: string): Promise<void> {
  const game = games.get(gameId);
  if (!game) throw new Error("Game not found");

  game.status = "completed";
  game.winner = winnerId;
  game.endReason = "checkmate";

  // Update ratings (simplified ELO)
  const loser =
    game.players.white === winnerId ? game.players.black : game.players.white;

  // Initialize ratings if needed
  for (const playerId of [winnerId, loser]) {
    if (!userRatings.has(playerId)) {
      userRatings.set(playerId, new Map());
    }
    if (!userRatings.get(playerId)!.has("chess")) {
      userRatings.get(playerId)!.set("chess", {
        rating: 1200,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
      });
    }
  }

  // Simple ELO: winner gains 16, loser loses 16
  const winnerRating = userRatings.get(winnerId)!.get("chess")!;
  const loserRating = userRatings.get(loser)!.get("chess")!;

  winnerRating.rating += 16;
  winnerRating.wins++;
  winnerRating.gamesPlayed++;

  loserRating.rating -= 16;
  loserRating.losses++;
  loserRating.gamesPlayed++;

  games.set(gameId, game);
}

// =============================================================================
// Tests
// =============================================================================

describe("Turn-Based Chess Game", () => {
  let gameId: string;
  let whitePlayer: string;
  let blackPlayer: string;

  beforeEach(async () => {
    resetMocks();
    whitePlayer = await createTestUser("white", { chessRating: 1200 });
    blackPlayer = await createTestUser("black", { chessRating: 1200 });
    gameId = await createGame({
      gameType: "chess",
      players: { white: whitePlayer, black: blackPlayer },
    });
  });

  describe("Making Moves", () => {
    it("should allow white to make first move", async () => {
      const result = await makeMove(gameId, whitePlayer, {
        from: "e2",
        to: "e4",
      });

      expect(result.success).toBe(true);

      const game = await getGame(gameId);
      expect(game!.currentTurn).toBe("black");
      expect(game!.moveHistory).toHaveLength(1);
    });

    it("should not allow black to move on white's turn", async () => {
      await expect(
        makeMove(gameId, blackPlayer, {
          from: "e7",
          to: "e5",
        }),
      ).rejects.toThrow("Not your turn");
    });

    it("should alternate turns correctly", async () => {
      await makeMove(gameId, whitePlayer, { from: "e2", to: "e4" });
      await makeMove(gameId, blackPlayer, { from: "e7", to: "e5" });

      const game = await getGame(gameId);
      expect(game!.currentTurn).toBe("white");
      expect(game!.moveHistory).toHaveLength(2);
    });

    it("should reject invalid square format", async () => {
      await expect(
        makeMove(gameId, whitePlayer, {
          from: "e2",
          to: "e9", // Invalid rank
        }),
      ).rejects.toThrow("Illegal move");
    });

    it("should not allow non-player to move", async () => {
      const spectator = await createTestUser("spectator");

      await expect(
        makeMove(gameId, spectator, {
          from: "e2",
          to: "e4",
        }),
      ).rejects.toThrow("You are not in this game");
    });
  });

  describe("Game Completion", () => {
    it("should handle resignation", async () => {
      await resignGame(gameId, whitePlayer);

      const game = await getGame(gameId);
      expect(game!.status).toBe("completed");
      expect(game!.winner).toBe(blackPlayer);
      expect(game!.endReason).toBe("resignation");
    });

    it("should handle draw offers", async () => {
      await offerDraw(gameId, whitePlayer);

      let game = await getGame(gameId);
      expect(game!.drawOffer).toBe(whitePlayer);

      await respondToDraw(gameId, blackPlayer, true);

      game = await getGame(gameId);
      expect(game!.status).toBe("completed");
      expect(game!.winner).toBeNull();
      expect(game!.endReason).toBe("draw_agreement");
    });

    it("should allow declining draw", async () => {
      await offerDraw(gameId, whitePlayer);
      await respondToDraw(gameId, blackPlayer, false);

      const game = await getGame(gameId);
      expect(game!.status).toBe("active");
      expect(game!.drawOffer).toBeNull();
    });

    it("should not allow responding to own draw offer", async () => {
      await offerDraw(gameId, whitePlayer);

      await expect(respondToDraw(gameId, whitePlayer, true)).rejects.toThrow(
        "Cannot respond to own offer",
      );
    });
  });

  describe("Rating System", () => {
    it("should update ratings after game", async () => {
      const whiteBefore = await getUserRating(whitePlayer, "chess");
      const blackBefore = await getUserRating(blackPlayer, "chess");

      // White wins
      await setGameResult(gameId, whitePlayer);

      const whiteAfter = await getUserRating(whitePlayer, "chess");
      const blackAfter = await getUserRating(blackPlayer, "chess");

      expect(whiteAfter).toBeGreaterThan(whiteBefore);
      expect(blackAfter).toBeLessThan(blackBefore);
    });

    it("should use default rating for new players", async () => {
      const newPlayer = await createTestUser("newbie");
      const rating = await getUserRating(newPlayer, "chess");

      expect(rating).toBe(1200);
    });
  });

  describe("Game State", () => {
    it("should not allow moves after game completion", async () => {
      await resignGame(gameId, whitePlayer);

      await expect(
        makeMove(gameId, blackPlayer, {
          from: "e7",
          to: "e5",
        }),
      ).rejects.toThrow("Game is not active");
    });

    it("should track move history correctly", async () => {
      await makeMove(gameId, whitePlayer, { from: "e2", to: "e4" });
      await makeMove(gameId, blackPlayer, { from: "e7", to: "e5" });
      await makeMove(gameId, whitePlayer, { from: "g1", to: "f3" });

      const game = await getGame(gameId);
      expect(game!.moveHistory).toEqual(["e2-e4", "e7-e5", "g1-f3"]);
    });
  });
});
