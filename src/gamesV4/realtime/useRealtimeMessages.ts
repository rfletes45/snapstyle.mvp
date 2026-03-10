/**
 * Games V4 — useRealtimeMessages Hook
 *
 * Convenience hook for registering multiple typed message handlers
 * on a RealtimeRoomClient. Automatically wires/unwires handlers
 * when the room connects/reconnects.
 *
 * Usage:
 *   useRealtimeMessages(client, {
 *     stroke_begin: (data) => addStroke(data),
 *     chat: (data) => appendChat(data),
 *     clear_canvas: () => clearCanvas(),
 *   });
 *
 * @module gamesV4/realtime/useRealtimeMessages
 */

import { useEffect, useRef } from "react";
import type { RealtimeRoomClient } from "./realtimeClient";
import type { MessageHandler } from "./types";

/**
 * Map of message type → handler function.
 */
export type MessageHandlerMap = Record<string, MessageHandler>;

/**
 * Register multiple message handlers on a RealtimeRoomClient.
 * Handlers are re-registered whenever the handler map identity changes.
 *
 * @param client The RealtimeRoomClient instance
 * @param handlers Map of message type → handler
 */
export function useRealtimeMessages(
  client: RealtimeRoomClient | null,
  handlers: MessageHandlerMap,
): void {
  // Store the latest handlers in a ref to avoid re-subscribing on every render
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!client) return;

    const unsubs: Array<() => void> = [];

    for (const [type, handler] of Object.entries(handlersRef.current)) {
      if (typeof handler === "function") {
        const unsub = client.onMessage(type, (data: unknown) => {
          // Always call the latest handler ref
          handlersRef.current[type]?.(data);
        });
        unsubs.push(unsub);
      }
    }

    return () => {
      for (const unsub of unsubs) {
        unsub();
      }
    };
  }, [client]); // Re-subscribe when client instance changes
}
