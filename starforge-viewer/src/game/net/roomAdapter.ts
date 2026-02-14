/**
 * RoomAdapter — wraps a Colyseus Room connection.
 * Provides typed send/receive and manages room lifecycle.
 */
import type { Room } from "@colyseus/sdk";

import type { InputCommand, SimStateV1 } from "../sim/types";
import { getClient } from "./colyseusClient";
import type { JoinOptions, PlayerRole, ServerErrorMsg } from "./messageTypes";
import { MSG } from "./messageTypes";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type GameMode = "SOLO" | "MULTI";

export interface RoomAdapter {
  /** Connect to the Colyseus server and join/create a room. */
  connect(
    endpoint: string,
    roomName: string,
    options?: JoinOptions,
  ): Promise<void>;

  /** Send an input command to the server. */
  sendInput(cmd: InputCommand): void;

  /** Register a callback for incoming state snapshots. */
  onState(cb: (state: SimStateV1) => void): void;

  /** Register a callback for server errors. */
  onError(cb: (err: ServerErrorMsg) => void): void;

  /** Register a callback for spectator count changes. */
  onSpectatorCount(cb: (count: number) => void): void;

  /** Leave the current room gracefully. */
  leave(): Promise<void>;

  /** The role assigned to the local player. */
  getRole(): PlayerRole;

  /** Whether we are currently connected. */
  isConnected(): boolean;

  /** Session ID assigned by the server. */
  getSessionId(): string | null;
}

/* ------------------------------------------------------------------ */
/*  Factory                                                            */
/* ------------------------------------------------------------------ */

export function createRoomAdapter(): RoomAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let room: Room<any> | null = null;
  let role: PlayerRole = "player";
  let sessionId: string | null = null;
  let stateCb: ((state: SimStateV1) => void) | null = null;
  let errorCb: ((err: ServerErrorMsg) => void) | null = null;
  let spectatorCountCb: ((count: number) => void) | null = null;

  /** Post a message to the parent WebView (if embedded). */
  function postToParent(payload: Record<string, unknown>): void {
    try {
      // @ts-expect-error — ReactNativeWebView is injected by RN WebView
      if (typeof window.ReactNativeWebView?.postMessage === "function") {
        // @ts-expect-error
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ source: "starforge", ...payload }),
        );
      }
    } catch {
      // Not embedded — ignore
    }
  }

  return {
    async connect(
      endpoint: string,
      roomName: string,
      options?: JoinOptions,
    ): Promise<void> {
      const client = getClient(endpoint);
      room = await client.joinOrCreate(roomName, options ?? {});
      sessionId = room.sessionId;

      // Determine role from join options (server may override via schema)
      role = options?.role ?? "player";

      // Listen for server messages
      room.onMessage(MSG.STATE, (state: SimStateV1) => {
        stateCb?.(state);
      });

      room.onMessage(MSG.ERROR, (err: ServerErrorMsg) => {
        console.warn("[RoomAdapter] Server error:", err);
        errorCb?.(err);
      });

      room.onMessage(MSG.WELCOME, (info: Record<string, unknown>) => {
        console.log("[RoomAdapter] Welcome:", info);
        postToParent({
          type: "session_info",
          sessionId: info.sessionId,
          mode: role,
        });
      });

      room.onMessage(MSG.SPECTATOR_COUNT, (data: { count: number }) => {
        spectatorCountCb?.(data.count);
        postToParent({
          type: "spectator_count",
          count: data.count,
        });
      });

      room.onLeave((code: number) => {
        console.log(`[RoomAdapter] Left room (code=${code})`);
        room = null;
        sessionId = null;
      });

      console.log(
        `[RoomAdapter] Joined room "${roomName}" as ${role} (session=${room.sessionId})`,
      );

      // Notify parent of initial session info
      postToParent({
        type: "session_info",
        sessionId: room.sessionId,
        mode: role,
      });
    },

    sendInput(cmd: InputCommand): void {
      if (!room) return;
      room.send(MSG.INPUT, cmd);
    },

    onState(cb: (state: SimStateV1) => void): void {
      stateCb = cb;
    },

    onError(cb: (err: ServerErrorMsg) => void): void {
      errorCb = cb;
    },

    onSpectatorCount(cb: (count: number) => void): void {
      spectatorCountCb = cb;
    },

    async leave(): Promise<void> {
      if (!room) return;
      await room.leave();
      room = null;
      sessionId = null;
    },

    getRole(): PlayerRole {
      return role;
    },

    isConnected(): boolean {
      return room !== null;
    },

    getSessionId(): string | null {
      return sessionId;
    },
  };
}
