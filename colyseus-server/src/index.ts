/**
 * Colyseus Server — Entry Point
 *
 * Starts the Colyseus game server with all registered rooms.
 * Uses the generalized realtime framework for room registration.
 *
 * Room registration flow:
 * 1. Import game modules (triggers auto-registration in GameRegistry)
 * 2. Import legacy rooms for backward compatibility
 * 3. Register all rooms with Colyseus via filterBy(["sessionId"])
 */

import { WebSocketTransport } from "@colyseus/ws-transport";
import { Server } from "colyseus";
import express from "express";
import { createServer } from "http";

// ── Import game modules (auto-registers via GameRegistry) ───────────
import "./games/knockout";
import "./games/pong";
import "./games/sketch_party";

// ── Framework imports ───────────────────────────────────────────────
import { getAllRealtimeGames } from "./core/GameRegistry";
import { KnockoutRoom } from "./games/knockout/Room";
import { PongRoom } from "./games/pong/Room";
import { SketchPartyRoomV2 } from "./games/sketch_party/Room";

// ── Legacy room import (preserved for migration safety) ─────────────
import { SketchPartyRoom } from "./rooms/SketchPartyRoom";

const app = express();

// Health check — includes all registered realtime games
app.get("/health", (_req, res) => {
  const games = getAllRealtimeGames();
  res.json({
    status: "ok",
    framework: "v2",
    rooms: games.map((g) => ({
      gameId: g.gameId,
      roomName: g.roomName,
      simulationProfile: g.simulationProfile,
    })),
  });
});

const httpServer = createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

// ── Register rooms ──────────────────────────────────────────────────
// New framework-based rooms
gameServer.define("knockout_game", KnockoutRoom).filterBy(["sessionId"]);
gameServer.define("sketch_party", SketchPartyRoomV2).filterBy(["sessionId"]);
gameServer.define("pong_game", PongRoom).filterBy(["sessionId"]);

// Legacy room preserved under a different name for rollback safety
gameServer
  .define("sketch_party_legacy", SketchPartyRoom)
  .filterBy(["sessionId"]);

const PORT = Number(process.env.PORT) || 2567;

async function start() {
  try {
    await gameServer.listen(PORT);
    console.log(`[Colyseus] Server listening on http://localhost:${PORT}`);
    console.log(`[Colyseus] Health check: http://localhost:${PORT}/health`);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EADDRINUSE") {
      console.warn(
        `[Colyseus] Port ${PORT} is already in use. Retrying in 3 seconds...`,
      );
      // Attempt to forcibly close then retry once
      httpServer.close();
      await new Promise((r) => setTimeout(r, 3000));
      try {
        await gameServer.listen(PORT);
        console.log(
          `[Colyseus] Server listening on http://localhost:${PORT} (retry succeeded)`,
        );
      } catch (retryErr) {
        console.error(
          `[Colyseus] Port ${PORT} still in use after retry. Kill the existing process and try again.`,
        );
        console.error(
          `  PowerShell:  Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT} | Select-Object -First 1 -ExpandProperty OwningProcess) -Force`,
        );
        process.exit(1);
      }
    } else {
      console.error("[Colyseus] Failed to start server:", err);
      process.exit(1);
    }
  }
}

start();

// Graceful shutdown — release port on SIGINT / SIGTERM
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`\n[Colyseus] ${signal} received — shutting down...`);
    gameServer.gracefullyShutdown(true);
  });
}
