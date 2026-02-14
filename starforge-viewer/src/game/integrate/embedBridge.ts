/**
 * Embed bridge — lightweight host communication layer.
 *
 * Simple postToHost() for basic outbound messages.
 * For full two-way invite flow, use HostAppBridge from inviteAdapter.ts.
 */

export interface EmbedBridge {
  /** Send a message to the host (no-op in standalone mode). */
  postToHost(type: string, payload?: unknown): void;
}

/**
 * Create an embed bridge that posts messages to the parent window.
 * Falls back to a no-op if there is no parent (standalone mode).
 */
export function createEmbedBridge(): EmbedBridge {
  return {
    postToHost(type: string, payload?: unknown): void {
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type, payload }, "*");
        }
      } catch {
        // standalone mode — no parent
      }
    },
  };
}
