/**
 * Colyseus Server — Entry Point
 *
 * Starts the Colyseus game server with all registered rooms.
 */

import { WebSocketTransport } from "@colyseus/ws-transport";
import { Server } from "colyseus";
import express from "express";
import { createServer } from "http";
import { SketchPartyRoom } from "./rooms/SketchPartyRoom";

const app = express();

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", rooms: ["sketch_party"] });
});

const httpServer = createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

// Register rooms — filterBy ensures players with the same sessionId
// are routed to the same room instance during joinOrCreate.
gameServer.define("sketch_party", SketchPartyRoom).filterBy(["sessionId"]);

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
