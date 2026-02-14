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
import { attachFishingClientRoutes } from "./services/fishingClientHost";
import { attachGolfClientRoutes } from "./services/golfClientHost";
import { attachStarforgeClientRoutes } from "./services/starforgeClientHost";

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

// ---------------------------------------------------------------------------
// Room Imports — Physics / Real-Time (Phase 4)
// ---------------------------------------------------------------------------
import { AirHockeyRoom } from "./rooms/physics/AirHockeyRoom";
import { BounceBlitzRoom } from "./rooms/physics/BounceBlitzRoom";
import { BrickBreakerRoom } from "./rooms/physics/BrickBreakerRoom";
import { GolfDuelsRoom } from "./rooms/physics/GolfDuelsRoom";
import { PongRoom } from "./rooms/physics/PongRoom";
import { TropicalFishingRoom } from "./rooms/physics/TropicalFishingRoom";
import { PoolRoom } from "./rooms/PoolRoom";

// ---------------------------------------------------------------------------
// Room Imports — Cooperative / Creative (Phase 5)
// ---------------------------------------------------------------------------
import { CrosswordRoom } from "./rooms/coop/CrosswordRoom";
import { WordMasterRoom } from "./rooms/coop/WordMasterRoom";

// ---------------------------------------------------------------------------
// Room Imports — Incremental (Phase 6)
// ---------------------------------------------------------------------------
import { StarforgeRoom } from "./rooms/incremental/StarforgeRoom";

// ---------------------------------------------------------------------------
// Room Imports — Spectator
// ---------------------------------------------------------------------------
import { SpectatorRoom } from "./rooms/spectator/SpectatorRoom";

// ---------------------------------------------------------------------------
// Server Configuration
// ---------------------------------------------------------------------------

const serverConfig = defineServer({
  express: (app) => {
    app.get("/health", (_req, res) => {
      res.json({
        ok: true,
        service: "snapstyle-colyseus",
      });
    });

    attachFishingClientRoutes(app, {
      mountPath: "/fishing",
    });

    attachStarforgeClientRoutes(app, {
      mountPath: "/starforge",
    });

    attachGolfClientRoutes(app, {
      mountPath: "/golf",
    });
  },
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

    // =====================================================================
    // Tier 1: Physics / Real-Time — Phase 4 (LIVE)
    // =====================================================================
    pong: defineRoom(PongRoom).filterBy(["firestoreGameId"]),
    air_hockey: defineRoom(AirHockeyRoom).filterBy(["firestoreGameId"]),
    pool: defineRoom(PoolRoom).filterBy(["firestoreGameId"]),
    bounce_blitz: defineRoom(BounceBlitzRoom).filterBy(["firestoreGameId"]),
    brick_breaker: defineRoom(BrickBreakerRoom).filterBy(["firestoreGameId"]),
    island_room: defineRoom(TropicalFishingRoom).filterBy(["firestoreGameId"]),
    golf_duels: defineRoom(GolfDuelsRoom).filterBy(["firestoreGameId"]),

    // =====================================================================
    // Tier 3: Cooperative / Creative — Phase 5 (LIVE)
    // =====================================================================
    word_master: defineRoom(WordMasterRoom).filterBy(["firestoreGameId"]),
    crossword: defineRoom(CrosswordRoom).filterBy(["firestoreGameId"]),

    // =====================================================================
    // Tier 6: Incremental — Phase 6 (NEW)
    // =====================================================================
    starforge: defineRoom(StarforgeRoom).filterBy(["firestoreGameId"]),

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
