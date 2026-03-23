/**
 * Colyseus Server - Entry Point
 *
 * Starts the Colyseus game server with all registered rooms.
 * Uses the generalized realtime framework for room registration.
 *
 * Room registration flow:
 * 1. Import game modules (triggers auto-registration in GameRegistry)
 * 2. Register all active rooms with Colyseus via filterBy(["sessionId"])
 */

import { WebSocketTransport } from "@colyseus/ws-transport";
import { Server } from "colyseus";
import express from "express";
import { createServer } from "http";

import "./games/knockout";
import "./games/pong";
import "./games/sketch_party";

import { getAllRealtimeGames } from "./core/GameRegistry";
import { KnockoutRoom } from "./games/knockout/Room";
import { PongRoom } from "./games/pong/Room";
import { SketchPartyRoomV2 } from "./games/sketch_party/Room";

const app = express();

app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

app.get("/health", (_req, res) => {
  const games = getAllRealtimeGames();
  res.json({
    status: "ok",
    framework: "v2",
    devBypass: process.env.COLYSEUS_DEV_BYPASS ?? "auto",
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

gameServer.define("knockout_game", KnockoutRoom).filterBy(["sessionId"]);
gameServer.define("sketch_party", SketchPartyRoomV2).filterBy(["sessionId"]);
gameServer.define("pong_game", PongRoom).filterBy(["sessionId"]);

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || "0.0.0.0";

async function start() {
  try {
    await gameServer.listen(PORT, HOST);
    console.log(`[Colyseus] Server listening on http://${HOST}:${PORT}`);
    console.log(`[Colyseus] Health check: http://${HOST}:${PORT}/health`);
    if (HOST === "0.0.0.0") {
      console.log(
        "[Colyseus] Accepting connections from all network interfaces.",
      );
      console.log(
        "[Colyseus] For production, place behind a reverse proxy (nginx/Caddy/ALB) with TLS for wss:// support.",
      );
    }
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EADDRINUSE") {
      console.warn(
        `[Colyseus] Port ${PORT} is already in use. Retrying in 3 seconds...`,
      );
      httpServer.close();
      await new Promise((r) => setTimeout(r, 3000));
      try {
        await gameServer.listen(PORT, HOST);
        console.log(
          `[Colyseus] Server listening on http://${HOST}:${PORT} (retry succeeded)`,
        );
      } catch (_retryErr) {
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

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`\n[Colyseus] ${signal} received - shutting down...`);
    gameServer.gracefullyShutdown(true);
  });
}
