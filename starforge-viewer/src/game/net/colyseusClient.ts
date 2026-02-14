/**
 * Colyseus client singleton — manages the WebSocket connection.
 * Thin wrapper around @colyseus/sdk Client.
 */
import { Client } from "@colyseus/sdk";

let instance: Client | null = null;

/**
 * Get (or create) the Colyseus Client singleton.
 * @param endpoint WebSocket endpoint, e.g. "ws://localhost:2567"
 */
export function getClient(endpoint: string): Client {
  if (!instance) {
    instance = new Client(endpoint);
  }
  return instance;
}

/**
 * Dispose the current client singleton (for testing / hot-reload).
 */
export function resetClient(): void {
  instance = null;
}
