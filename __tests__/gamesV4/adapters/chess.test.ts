/**
 * Games V4 — Chess Adapter Unit Tests
 *
 * Tests the chess adapter integration layer:
 * - Initial state creation
 * - Move validation (legal, illegal, wrong turn)
 * - Draw offer / accept
 * - Claim draw (threefold, fifty-move)
 * - Terminal detection (checkmate, stalemate, insufficient material)
 * - Outcome computation
 * - Performance metrics
 * - Spectator view
 */

// Import adapter directly — auto-registers on import
import chessAdapter from "@/gamesV4/adapters/chess/chessAdapter";
import type { ChessPublicStateV1 } from "@/gamesV4/adapters/chess/chessTypes";

// =============================================================================
// Helpers
// =============================================================================

const PLAYERS = [
  { uid: "white", slotIndex: 0 },
  { uid: "black", slotIndex: 1 },
];

const PLAYERS_NAMED = [
  { uid: "white", displayName: "Alice" },
  { uid: "black", displayName: "Bob" },
];

function makeCtx(side: "white" | "black") {
  return {
    uid: side,
    turnOrder: ["white", "black"],
    currentTurnIndex: side === "white" ? 0 : 1,
    settings: {},
  };
}

function initState(): Record<string, unknown> {
  return chessAdapter.createInitialPublicState(PLAYERS, {});
}

function asChess(s: Record<string, unknown>): ChessPublicStateV1 {
  return s as unknown as ChessPublicStateV1;
}

// Play a series of moves and return final state. Alternates starting from white.
function playMoves(
  state: Record<string, unknown>,
  moves: Array<{ from: string; to: string; promotion?: string }>,
): Record<string, unknown> {
  let current = state;
  let sides: Array<"white" | "black"> = [];
  const cs = asChess(current);
  const startSide = cs.sideToMove === "w" ? "white" : "black";
  const nextSide = startSide === "white" ? "black" : "white";

  for (let i = 0; i < moves.length; i++) {
    const side = i % 2 === 0 ? startSide : nextSide;
    const result = chessAdapter.validateMove!(
      current,
      {},
      { action: "move", ...moves[i] },
      makeCtx(side),
    );
    if (!result.ok) {
      throw new Error(
        `Move ${i} (${side} ${moves[i].from}-${moves[i].to}) failed: ${result.error}`,
      );
    }
    current = result.nextPublicState!;
  }
  return current;
}

// =============================================================================
// Tests
// =============================================================================

describe("Chess Adapter V4", () => {
  describe("metadata", () => {
    it("has correct game ID and runtime type", () => {
      expect(chessAdapter.gameId).toBe("chess");
      expect(chessAdapter.runtimeType).toBe("turnBased");
      expect(chessAdapter.maxPlayers).toBe(2);
      expect(chessAdapter.minPlayers).toBe(2);
      expect(chessAdapter.supportsSpectate).toBe(true);
      expect(chessAdapter.spectateMode).toBe("full_state");
    });
  });

  describe("createInitialPublicState", () => {
    it("creates a valid initial chess state", () => {
      const state = asChess(initState());
      expect(state.schemaVersion).toBe(1);
      expect(state.sideToMove).toBe("w");
      expect(state.board.length).toBe(8);
      expect(state.board[0].length).toBe(8);
      expect(state.castling).toEqual({
        wK: true,
        wQ: true,
        bK: true,
        bQ: true,
      });
      expect(state.terminal).toBeNull();
      expect(state.plyCount).toBe(0);
    });
  });

  describe("validateMove — basic moves", () => {
    it("accepts a valid pawn push e2-e4", () => {
      const state = initState();
      const result = chessAdapter.validateMove!(
        state,
        {},
        { action: "move", from: "e2", to: "e4" },
        makeCtx("white"),
      );

      expect(result.ok).toBe(true);
      expect(result.turnAdvance).toBe(true);
      expect(result.terminal).toBeUndefined();

      const next = asChess(result.nextPublicState!);
      expect(next.sideToMove).toBe("b");
      expect(next.board[4][4]).toBe("wP"); // e4 = row 4, col 4
    });

    it("rejects a move when it's not your turn", () => {
      const state = initState();
      const result = chessAdapter.validateMove!(
        state,
        {},
        { action: "move", from: "e7", to: "e5" },
        makeCtx("black"), // It's white's turn
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain("Not your turn");
    });

    it("rejects an illegal move", () => {
      const state = initState();
      const result = chessAdapter.validateMove!(
        state,
        {},
        { action: "move", from: "e2", to: "e5" }, // 3-square pawn push is illegal
        makeCtx("white"),
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain("Illegal");
    });

    it("rejects a move on an already-terminal game", () => {
      // Create a terminal state
      const state = initState();
      const cs = asChess(state);
      (cs as any).terminal = { type: "draw", reason: "draw_agreed" };

      const result = chessAdapter.validateMove!(
        state,
        {},
        { action: "move", from: "e2", to: "e4" },
        makeCtx("white"),
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain("already over");
    });
  });

  describe("validateMove — draw mechanics", () => {
    it("offerDraw sets pendingDrawOfferByUid", () => {
      const state = initState();
      const result = chessAdapter.validateMove!(
        state,
        {},
        { action: "move", from: "e2", to: "e4", offerDraw: true },
        makeCtx("white"),
      );

      expect(result.ok).toBe(true);
      const next = asChess(result.nextPublicState!);
      expect(next.pendingDrawOfferByUid).toBe("white");
    });

    it("normal move clears pending draw offer", () => {
      // White offers draw, black plays a normal move — draw offer cleared
      let state = initState();
      let result = chessAdapter.validateMove!(
        state,
        {},
        { action: "move", from: "e2", to: "e4", offerDraw: true },
        makeCtx("white"),
      );
      state = result.nextPublicState!;
      expect(asChess(state).pendingDrawOfferByUid).toBe("white");

      result = chessAdapter.validateMove!(
        state,
        {},
        { action: "move", from: "e7", to: "e5" },
        makeCtx("black"),
      );
      expect(result.ok).toBe(true);
      expect(asChess(result.nextPublicState!).pendingDrawOfferByUid).toBeNull();
    });

    it("acceptDraw works when opponent offered", () => {
      let state = initState();
      // White plays with draw offer
      let result = chessAdapter.validateMove!(
        state,
        {},
        { action: "move", from: "e2", to: "e4", offerDraw: true },
        makeCtx("white"),
      );
      state = result.nextPublicState!;

      // Black accepts
      result = chessAdapter.validateMove!(
        state,
        {},
        { action: "acceptDraw" },
        makeCtx("black"),
      );

      expect(result.ok).toBe(true);
      expect(result.terminal).toBeDefined();
      expect(result.terminal!.type).toBe("draw");
      expect(result.terminal!.reason).toBe("draw_agreed");
    });

    it("cannot acceptDraw when no offer pending", () => {
      const state = initState();
      const result = chessAdapter.validateMove!(
        state,
        {},
        { action: "acceptDraw" },
        makeCtx("white"),
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain("No draw offer");
    });

    it("cannot accept your own draw offer", () => {
      let state = initState();
      // White plays e4 with draw offer
      let result = chessAdapter.validateMove!(
        state,
        {},
        { action: "move", from: "e2", to: "e4", offerDraw: true },
        makeCtx("white"),
      );
      state = result.nextPublicState!;

      // Black makes a move keeping the draw offer somehow? Actually after black moves it gets cleared.
      // Let's manually set pendingDrawOfferByUid to self
      const cs = asChess(state);
      // pendingDrawOfferByUid is "white", and it's black's turn
      // If white somehow tries to accept during white's turn... not possible since it's black's turn
      // The scenario: white offers, it's black's turn, white can't accept own offer (it's not white's turn anyway)
      // Let's just test the direct check
      (cs as any).sideToMove = "w"; // hack for testing
      (cs as any).pendingDrawOfferByUid = "white";

      result = chessAdapter.validateMove!(
        state,
        {},
        { action: "acceptDraw" },
        makeCtx("white"),
      );

      expect(result.ok).toBe(false);
    });

    it("claimDraw with threefold requires 3 repetitions", () => {
      const state = initState();
      // Attempting without actual repetition
      const result = chessAdapter.validateMove!(
        state,
        {},
        { action: "claimDraw", claim: "threefold" },
        makeCtx("white"),
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain("Threefold");
    });

    it("claimDraw with fiftyMove requires halfmoveClock >= 100", () => {
      const state = initState();
      const result = chessAdapter.validateMove!(
        state,
        {},
        { action: "claimDraw", claim: "fiftyMove" },
        makeCtx("white"),
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain("50-move");
    });
  });

  describe("fool's mate via adapter", () => {
    it("detects checkmate after f3 e5 g4 Qh4#", () => {
      const state = playMoves(initState(), [
        { from: "f2", to: "f3" }, // 1. f3
        { from: "e7", to: "e5" }, // 1... e5
        { from: "g2", to: "g4" }, // 2. g4
        { from: "d8", to: "h4" }, // 2... Qh4#
      ]);

      const cs = asChess(state);
      expect(cs.terminal).not.toBeNull();
      expect(cs.terminal!.type).toBe("win");
      expect(cs.terminal!.reason).toBe("checkmate");
      expect(cs.terminal!.winnerUids).toEqual(["black"]);
    });
  });

  describe("computeOutcome", () => {
    it("returns correct outcome for checkmate", () => {
      const state = playMoves(initState(), [
        { from: "f2", to: "f3" },
        { from: "e7", to: "e5" },
        { from: "g2", to: "g4" },
        { from: "d8", to: "h4" }, // Qh4#
      ]);

      const outcome = chessAdapter.computeOutcome!(state, PLAYERS);
      expect(outcome.winnerIds).toEqual(["black"]);
      expect(outcome.finalScoreboard).toHaveLength(2);

      const winnerEntry = outcome.finalScoreboard.find(
        (e: any) => e.uid === "black",
      )!;
      expect(winnerEntry.score).toBe(1);
      expect(winnerEntry.placement).toBe(1);

      const loserEntry = outcome.finalScoreboard.find(
        (e: any) => e.uid === "white",
      )!;
      expect(loserEntry.score).toBe(0);
      expect(loserEntry.placement).toBe(2);
    });

    it("returns correct outcome for draw", () => {
      let state = initState();
      // White offers draw, black accepts
      let result = chessAdapter.validateMove!(
        state,
        {},
        { action: "move", from: "e2", to: "e4", offerDraw: true },
        makeCtx("white"),
      );
      state = result.nextPublicState!;
      result = chessAdapter.validateMove!(
        state,
        {},
        { action: "acceptDraw" },
        makeCtx("black"),
      );
      state = result.nextPublicState!;

      const outcome = chessAdapter.computeOutcome!(state, PLAYERS);
      expect(outcome.winnerIds).toEqual([]);
      expect(outcome.finalScoreboard.every((e: any) => e.score === 0)).toBe(
        true,
      );
    });
  });

  describe("computeSummary", () => {
    it("returns captures in summary", () => {
      const state = initState();
      const summary = chessAdapter.computeSummary!(
        state,
        PLAYERS_NAMED,
        "white",
      );
      expect(summary.turnPlayerId).toBe("white");
      expect(summary.scoreSummary).toHaveLength(2);
    });
  });

  describe("getSpectatorView", () => {
    it("returns full state for chess (no hidden info)", () => {
      const state = initState();
      const view = chessAdapter.getSpectatorView!(state);
      expect(view).toEqual(state);
    });
  });

  describe("extractPerformanceMetrics", () => {
    it("returns expected metric keys", () => {
      const state = playMoves(initState(), [
        { from: "f2", to: "f3" },
        { from: "e7", to: "e5" },
        { from: "g2", to: "g4" },
        { from: "d8", to: "h4" }, // Qh4#
      ]);

      const metrics = chessAdapter.extractPerformanceMetrics!(
        state,
        PLAYERS,
      ) as any;
      expect(metrics.totalMoves).toBe(4);
      expect(metrics.endedBy).toBe("checkmate");
      expect(metrics.shortMatePly).toBe(4);
      expect(metrics.capturesByUid).toBeDefined();
      expect(metrics.promotionsByUid).toBeDefined();
      expect(metrics.enPassantByUid).toBeDefined();
      expect(metrics.castlesByUid).toBeDefined();
      expect(metrics.checksByUid).toBeDefined();
    });
  });

  describe("scoreboardDescriptor", () => {
    it("formats scores correctly", () => {
      const desc = chessAdapter.scoreboardDescriptor;
      expect(desc.formatScore(1)).toBe("Win");
      expect(desc.formatScore(0)).toBe("Loss");
      expect(desc.formatScore(0.5)).toBe("Draw");
    });
  });

  describe("promotion through adapter", () => {
    it("rejects promotion move without specifying piece", () => {
      // We need to get a pawn to the 7th rank. It's easier to test validateMove
      // with a manually-constructed state.
      const state = initState();
      const cs = asChess(state);

      // Place white pawn on e7, clear path
      cs.board[1][4] = "wP"; // e7 row
      cs.board[6][4] = null; // remove original pawn
      // Move black king away from e8
      cs.board[0][4] = null;
      cs.board[0][0] = "bK";

      const result = chessAdapter.validateMove!(
        state,
        {},
        { action: "move", from: "e7", to: "e8" },
        makeCtx("white"),
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain("Promotion piece required");
    });

    it("accepts promotion move with piece specified", () => {
      const state = initState();
      const cs = asChess(state);

      cs.board[1][4] = "wP"; // e7
      cs.board[6][4] = null;
      cs.board[0][4] = null; // clear e8
      cs.board[0][0] = "bK";

      const result = chessAdapter.validateMove!(
        state,
        {},
        { action: "move", from: "e7", to: "e8", promotion: "q" },
        makeCtx("white"),
      );

      expect(result.ok).toBe(true);
      const next = asChess(result.nextPublicState!);
      expect(next.board[0][4]).toBe("wQ");
    });
  });
});
