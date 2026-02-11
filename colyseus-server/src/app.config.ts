/**
 * SnapStyle Colyseus Game Server — Entry Point
 *
 * Registers all game rooms and starts the server.
 * Uses Colyseus v0.17 defineServer/defineRoom API.
 *
 * @see docs/COLYSEUS_MULTIPLAYER_PLAN.md
 */

import { defineRoom, defineServer, listen } from "colyseus";
import dotenv from "dotenv";
import { initializeFirebaseAdmin } from "./services/firebase";

// Load environment variables
dotenv.config();

// Initialize Firebase Admin SDK
initializeFirebaseAdmin();

// ---------------------------------------------------------------------------
// Room Imports — Quick-Play (Phase 1)
// ---------------------------------------------------------------------------
import { DotMatchRoom } from "./rooms/quickplay/DotMatchRoom";
import { ReactionRoom } from "./rooms/quickplay/ReactionRoom";
import { TimedTapRoom } from "./rooms/quickplay/TimedTapRoom";

// ---------------------------------------------------------------------------
// Room Imports — Turn-Based (Phase 2)
// ---------------------------------------------------------------------------
import { ConnectFourRoom } from "./rooms/turnbased/ConnectFourRoom";
import { GomokuRoom } from "./rooms/turnbased/GomokuRoom";
import { ReversiRoom } from "./rooms/turnbased/ReversiRoom";
import { TicTacToeRoom } from "./rooms/turnbased/TicTacToeRoom";

// ---------------------------------------------------------------------------
// Room Imports — Complex Turn-Based (Phase 3)
// ---------------------------------------------------------------------------
import { CheckersRoom } from "./rooms/turnbased/CheckersRoom";
import { ChessRoom } from "./rooms/turnbased/ChessRoom";
import { CrazyEightsRoom } from "./rooms/turnbased/CrazyEightsRoom";
import { WarRoom } from "./rooms/turnbased/WarRoom";

// ---------------------------------------------------------------------------
// Room Imports — Physics / Real-Time (Phase 4)
// ---------------------------------------------------------------------------
import { AirHockeyRoom } from "./rooms/physics/AirHockeyRoom";
import { BounceBlitzRoom } from "./rooms/physics/BounceBlitzRoom";
import { BrickBreakerRoom } from "./rooms/physics/BrickBreakerRoom";
import { PongRoom } from "./rooms/physics/PongRoom";
import { PoolRoom } from "./rooms/PoolRoom";
import { RaceRoom } from "./rooms/physics/RaceRoom";
import { SnakeRoom } from "./rooms/physics/SnakeRoom";

// ---------------------------------------------------------------------------
// Room Imports — Cooperative / Creative (Phase 5)
// ---------------------------------------------------------------------------
import { CrosswordRoom } from "./rooms/coop/CrosswordRoom";
import { WordMasterRoom } from "./rooms/coop/WordMasterRoom";

// ---------------------------------------------------------------------------
// Room Imports — Spectator
// ---------------------------------------------------------------------------
import { SpectatorRoom } from "./rooms/spectator/SpectatorRoom";

// ---------------------------------------------------------------------------
// Server Configuration
// ---------------------------------------------------------------------------

const serverConfig = defineServer({
  rooms: {
    // =====================================================================
    // Tier 4: Quick-Play Score Race — Phase 1 (LIVE)
    // =====================================================================
    reaction: defineRoom(ReactionRoom).filterBy(["firestoreGameId"]),
    timed_tap: defineRoom(TimedTapRoom).filterBy(["firestoreGameId"]),
    dot_match: defineRoom(DotMatchRoom).filterBy(["firestoreGameId"]),

    // =====================================================================
    // Tier 2: Simple Turn-Based — Phase 2 (LIVE)
    // =====================================================================
    tic_tac_toe: defineRoom(TicTacToeRoom).filterBy(["firestoreGameId"]),
    connect_four: defineRoom(ConnectFourRoom).filterBy(["firestoreGameId"]),
    gomoku: defineRoom(GomokuRoom).filterBy(["firestoreGameId"]),
    reversi: defineRoom(ReversiRoom).filterBy(["firestoreGameId"]),

    // =====================================================================
    // Tier 3: Complex Turn-Based — Phase 3 (LIVE)
    // =====================================================================
    chess: defineRoom(ChessRoom).filterBy(["firestoreGameId"]),
    checkers: defineRoom(CheckersRoom).filterBy(["firestoreGameId"]),
    crazy_eights: defineRoom(CrazyEightsRoom).filterBy(["firestoreGameId"]),
    war: defineRoom(WarRoom).filterBy(["firestoreGameId"]),

    // =====================================================================
    // Tier 1: Physics / Real-Time — Phase 4 (LIVE)
    // =====================================================================
    pong: defineRoom(PongRoom).filterBy(["firestoreGameId"]),
    air_hockey: defineRoom(AirHockeyRoom).filterBy(["firestoreGameId"]),
    pool: defineRoom(PoolRoom).filterBy(["firestoreGameId"]),
    bounce_blitz: defineRoom(BounceBlitzRoom).filterBy(["firestoreGameId"]),
    brick_breaker: defineRoom(BrickBreakerRoom).filterBy(["firestoreGameId"]),
    snake: defineRoom(SnakeRoom).filterBy(["firestoreGameId"]),
    race: defineRoom(RaceRoom).filterBy(["firestoreGameId"]),

    // =====================================================================
    // Tier 3: Cooperative / Creative — Phase 5 (LIVE)
    // =====================================================================
    word_master: defineRoom(WordMasterRoom).filterBy(["firestoreGameId"]),
    crossword: defineRoom(CrosswordRoom).filterBy(["firestoreGameId"]),

    // =====================================================================
    // Spectator Room — Single-Player Game Spectating
    // =====================================================================
    spectator: defineRoom(SpectatorRoom),
  },
});

// ---------------------------------------------------------------------------
// Start the server — listen() binds HTTP + WebSocket on the given port.
// Default port 2567 (or PORT env var).
// ---------------------------------------------------------------------------
const PORT = Number(process.env.PORT || 2567);
listen(serverConfig, PORT);

// Also export the config for @colyseus/testing and other tooling
export default serverConfig;
