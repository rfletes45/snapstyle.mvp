/**
 * Starforge Colyseus server — entry point.
 * Registers the StarforgeRoom and listens on PORT.
 */
import { defineRoom, defineServer, listen } from "colyseus";
import { StarforgeRoom } from "./rooms/StarforgeRoom";

const serverConfig = defineServer({
  express: (app) => {
    app.get("/health", (_req, res) => res.json({ ok: true }));
  },
  rooms: {
    starforge: defineRoom(StarforgeRoom),
  },
});

const PORT = Number(process.env.PORT || 2567);
listen(serverConfig, PORT);

console.log(`Starforge server listening on port ${PORT}`);

export default serverConfig;
