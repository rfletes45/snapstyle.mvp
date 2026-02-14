/**
 * StarforgeRoom — Colyseus room that runs the sim server-authoritatively.
 *
 * - One SimStateV1 per room; all players share it.
 * - 20 Hz tick (configurable via balance.simHz).
 * - Full SimStateV1 broadcast as a message each tick (~1-3 KB JSON).
 * - Colyseus Schema is only used for lightweight player metadata.
 */
import { Client, Room } from "colyseus";

import type { ErrorCode } from "../../../src/game/net/messageTypes";
import { MSG } from "../../../src/game/net/messageTypes";
import { applyInput, createFreshState } from "../../../src/game/sim/reducer";
import { stepTick } from "../../../src/game/sim/sim";
import type { InputCommand, SimStateV1 } from "../../../src/game/sim/types";
import { balance, initSimLayer } from "../loadCatalogs";
import { PlayerData, StarforgeRoomState } from "../schema/RoomState";

const DEFAULT_SEED = 12345;

/** Valid command types accepted from clients. */
const VALID_COMMANDS = new Set<string>([
  "TAP",
  "BUY_MACHINE",
  "TOGGLE_MACHINE_ENABLED",
  "UPGRADE_MACHINE_TIER",
  "BUY_UPGRADE",
  "START_CONTRACT",
  "CLAIM_CONTRACT_REWARD",
  "TAP_EVENT",
  "TAP_WRECK",
  "DISMISS_MILESTONE_TOAST",
]);

export class StarforgeRoom extends Room {
  maxClients = 8;

  /** Server-authoritative sim state (broadcast as JSON, not via Colyseus Schema). */
  private simState!: SimStateV1;

  /** Queued input commands to apply on the next tick. */
  private pendingInputs: InputCommand[] = [];

  /** Handle for the fixed-rate sim interval. */
  private tickInterval: ReturnType<typeof setInterval> | null = null;

  /* ------------------------------------------------------------------ */
  /*  Lifecycle                                                          */
  /* ------------------------------------------------------------------ */

  onCreate(_options: Record<string, unknown>): void {
    // Initialize the shared sim layer (catalogs etc.)
    initSimLayer();

    // Set up Colyseus Schema state for player metadata
    this.setState(new StarforgeRoomState());
    this.setMetadata({ version: "v1" });

    // Create a fresh sim world
    this.simState = createFreshState(DEFAULT_SEED);

    // Start the fixed-rate sim tick
    const hz = balance.simHz ?? 20;
    this.tickInterval = setInterval(() => this.tick(), 1000 / hz);

    console.log(`[StarforgeRoom] Created — seed=${DEFAULT_SEED}, hz=${hz}`);
  }

  /* ------------------------------------------------------------------ */
  /*  Message handlers (Colyseus v0.17 messages property)                */
  /* ------------------------------------------------------------------ */

  messages = {
    /**
     * Client sends an input command.
     * Spectators are rejected; others get queued for the next tick.
     */
    [MSG.INPUT]: (client: Client, cmd: unknown) => {
      const player = (this.state as StarforgeRoomState).players.get(
        client.sessionId,
      );
      if (!player) {
        this.sendError(client, "UNKNOWN_PLAYER", "Player not found.");
        return;
      }

      // Spectators may not send input
      if (player.role === "spectator") {
        this.sendError(
          client,
          "SPECTATOR_NO_INPUT",
          "Spectators cannot send input commands.",
        );
        return;
      }

      // Basic command validation
      const c = cmd as Record<string, unknown>;
      if (!c || typeof c.t !== "string" || !VALID_COMMANDS.has(c.t)) {
        this.sendError(
          client,
          "INVALID_COMMAND",
          `Unknown command type: ${String(c?.t)}`,
        );
        return;
      }

      // Override atTick with the current server tick (never trust the client)
      const input: InputCommand = {
        ...(c as unknown as InputCommand),
        atTick: this.simState.tick,
      };

      this.pendingInputs.push(input);
    },

    /**
     * Client sends join info (name, role preference).
     */
    [MSG.JOIN_INFO]: (client: Client, info: unknown) => {
      const player = (this.state as StarforgeRoomState).players.get(
        client.sessionId,
      );
      if (!player) return;

      const data = info as Record<string, unknown>;
      if (typeof data.name === "string") player.name = data.name;
      if (data.role === "spectator") player.role = "spectator";
    },
  };

  /* ------------------------------------------------------------------ */
  /*  Join / Leave                                                       */
  /* ------------------------------------------------------------------ */

  onJoin(client: Client, options?: Record<string, unknown>): void {
    const player = new PlayerData();
    const opts = options ?? {};
    player.name =
      typeof opts.name === "string"
        ? opts.name
        : `player_${client.sessionId.slice(0, 4)}`;
    player.role =
      opts.role === "spectator"
        ? "spectator"
        : (this.state as StarforgeRoomState).players.size === 0
          ? "host"
          : "player";

    (this.state as StarforgeRoomState).players.set(client.sessionId, player);

    // Send full sim snapshot immediately so the new client can render
    client.send(MSG.STATE, this.simState);

    console.log(
      `[StarforgeRoom] ${player.name} joined as ${player.role} (${client.sessionId})`,
    );
  }

  onLeave(client: Client): void {
    (this.state as StarforgeRoomState).players.delete(client.sessionId);
    console.log(`[StarforgeRoom] ${client.sessionId} left`);
  }

  onDispose(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    console.log("[StarforgeRoom] Disposed");
  }

  /* ------------------------------------------------------------------ */
  /*  Fixed-rate sim tick                                                 */
  /* ------------------------------------------------------------------ */

  private tick(): void {
    // 1. Apply all queued inputs
    for (const cmd of this.pendingInputs) {
      this.simState = applyInput(this.simState, cmd);
    }
    this.pendingInputs.length = 0;

    // 2. Step the simulation forward
    this.simState = stepTick(this.simState);

    // 3. Broadcast full sim state to all clients
    this.broadcast(MSG.STATE, this.simState);
  }

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  private sendError(client: Client, code: ErrorCode, message: string): void {
    client.send(MSG.ERROR, { code, message });
  }
}
