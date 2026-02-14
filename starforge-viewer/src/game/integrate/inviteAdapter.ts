/**
 * Invite Adapter — integration surface for the host app (React Native WebView).
 * Defines the HostAppBridge interface and invite payload parsing.
 *
 * The host sends a STARFORGE_INVITE postMessage to tell the viewer
 * which room to join. The viewer responds with STARFORGE_READY / STARFORGE_EXIT.
 */
import type { PlayerRole } from "../net/messageTypes";

/* ------------------------------------------------------------------ */
/*  Invite payload                                                     */
/* ------------------------------------------------------------------ */

/** Parsed invite data from the host app. */
export interface InvitePayload {
  /** Server WebSocket endpoint, e.g. "ws://10.0.2.2:2567". */
  server: string;
  /** Room name (defaults to "starforge"). */
  roomName: string;
  /** Optional specific room ID to join (for re-joining). */
  roomId?: string;
  /** Player display name. */
  name?: string;
  /** Requested role (server may override). */
  role?: PlayerRole;
}

/**
 * Parse a raw invite payload from the host into a typed InvitePayload.
 * Returns null if the payload is invalid.
 */
export function parseInvitePayload(raw: unknown): InvitePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  if (typeof obj.server !== "string" || !obj.server) return null;

  return {
    server: obj.server,
    roomName: typeof obj.roomName === "string" ? obj.roomName : "starforge",
    roomId: typeof obj.roomId === "string" ? obj.roomId : undefined,
    name: typeof obj.name === "string" ? obj.name : undefined,
    role: isValidRole(obj.role) ? obj.role : undefined,
  };
}

function isValidRole(v: unknown): v is PlayerRole {
  return v === "host" || v === "player" || v === "spectator";
}

/* ------------------------------------------------------------------ */
/*  Host App Bridge                                                    */
/* ------------------------------------------------------------------ */

/** Events sent from the viewer TO the host app. */
export type OutgoingEvent = "STARFORGE_READY" | "STARFORGE_EXIT";

/** Events sent from the host app TO the viewer. */
export type IncomingEvent = "STARFORGE_INVITE";

/** Bridge for two-way communication with the host app via postMessage. */
export interface HostAppBridge {
  /** Register a handler for incoming events from the host. */
  on(event: IncomingEvent, cb: (payload: unknown) => void): void;

  /** Remove a handler for an incoming event. */
  off(event: IncomingEvent, cb: (payload: unknown) => void): void;

  /** Emit an event to the host app. */
  emit(event: OutgoingEvent, data?: unknown): void;

  /** Tear down listeners. */
  destroy(): void;
}

/**
 * Create a HostAppBridge that communicates via window.postMessage.
 *
 * - Listens for `message` events whose `data.type` matches IncomingEvent.
 * - Emits to `window.parent.postMessage(...)` (for iframe/WebView embedding).
 * - Emits STARFORGE_READY immediately on creation.
 * - Works as a no-op if there is no parent window (standalone mode).
 */
export function createHostAppBridge(): HostAppBridge {
  const listeners = new Map<IncomingEvent, Set<(payload: unknown) => void>>();

  /** Handle incoming postMessage events. */
  function handleMessage(event: MessageEvent): void {
    const data = event.data;
    if (!data || typeof data !== "object" || typeof data.type !== "string") {
      return;
    }

    const eventType = data.type as string;
    const handlers = listeners.get(eventType as IncomingEvent);
    if (handlers) {
      for (const cb of handlers) {
        try {
          cb(data.payload);
        } catch (err) {
          console.error(
            `[HostAppBridge] Error in handler for ${eventType}:`,
            err,
          );
        }
      }
    }
  }

  // Start listening
  window.addEventListener("message", handleMessage);

  const bridge: HostAppBridge = {
    on(event: IncomingEvent, cb: (payload: unknown) => void): void {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(cb);
    },

    off(event: IncomingEvent, cb: (payload: unknown) => void): void {
      listeners.get(event)?.delete(cb);
    },

    emit(event: OutgoingEvent, data?: unknown): void {
      const message = { type: event, payload: data };
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(message, "*");
        }
      } catch {
        // Standalone mode — no parent to post to
      }
    },

    destroy(): void {
      window.removeEventListener("message", handleMessage);
      listeners.clear();
    },
  };

  // Signal readiness to the host
  bridge.emit("STARFORGE_READY");

  return bridge;
}
