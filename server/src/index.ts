import http from "node:http";
import express from "express";
import { Server } from "colyseus";
import { IslandRoom } from "./rooms/IslandRoom.js";

const PORT = Number(process.env.PORT ?? 2567);

async function bootstrap(): Promise<void> {
  const app = express();
  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "tropical-island-fishing-server", phase: 5 });
  });

  const server = http.createServer(app);
  const gameServer = new Server({ server });
  gameServer.define("island_room", IslandRoom).filterBy(["inviteCode"]);

  // Room rules:
  // - max 10 players
  // - reject mode === "spectate" at handshake
  // - only transform/fishing state sync; progression remains local on client
  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Colyseus server listening on http://localhost:${PORT}`);
  });
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server scaffold:", error);
  process.exit(1);
});
