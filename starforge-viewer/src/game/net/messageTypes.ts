/**
 * Shared message type definitions for client ↔ server communication.
 * Used by both the Colyseus server and the client net layer.
 * No DOM, no Three.js, no Colyseus imports.
 */
import type { InputCommand, SimStateV1 } from "../sim/types";

/* ------------------------------------------------------------------ */
/*  Player roles                                                       */
/* ------------------------------------------------------------------ */

export type PlayerRole = "host" | "player" | "spectator";

/* ------------------------------------------------------------------ */
/*  Client → Server                                                    */
/* ------------------------------------------------------------------ */

/** Client sends an input command to the server. */
export interface ClientInputMsg {
  /** Must match an InputCommand.t value. */
  t: InputCommand["t"];
  /** Remaining command fields (code, machineId, upgradeId, etc.). */
  [key: string]: unknown;
}

/** Client sends join info after connecting. */
export interface ClientJoinInfoMsg {
  name?: string;
  role?: PlayerRole;
}

/** Options passed when joining a room. */
export interface JoinOptions {
  name?: string;
  role?: PlayerRole;
}

/* ------------------------------------------------------------------ */
/*  Server → Client                                                    */
/* ------------------------------------------------------------------ */

/** Full sim state snapshot, broadcast every tick. */
export type ServerStateMsg = SimStateV1;

/** Error message from the server. */
export interface ServerErrorMsg {
  code: ErrorCode;
  message: string;
}

/* ------------------------------------------------------------------ */
/*  Error codes                                                        */
/* ------------------------------------------------------------------ */

export type ErrorCode =
  | "SPECTATOR_NO_INPUT"
  | "INVALID_COMMAND"
  | "UNKNOWN_PLAYER"
  | "ROOM_FULL"
  | "INTERNAL_ERROR";

/* ------------------------------------------------------------------ */
/*  Message channel names                                              */
/* ------------------------------------------------------------------ */

/** Message channels used between client and server. */
export const MSG = {
  /** client → server: input command */
  INPUT: "input" as const,
  /** client → server: join info */
  JOIN_INFO: "joinInfo" as const,
  /** server → client: full sim state */
  STATE: "state" as const,
  /** server → client: error */
  ERROR: "error" as const,
  /** server → client: welcome/session info */
  WELCOME: "welcome" as const,
  /** server → client: spectator count changed */
  SPECTATOR_COUNT: "spectator_count" as const,
  /** server → client: player disconnected */
  PLAYER_DISCONNECTED: "player_disconnected" as const,
  /** server → client: player reconnected */
  PLAYER_RECONNECTED: "player_reconnected" as const,
} as const;
