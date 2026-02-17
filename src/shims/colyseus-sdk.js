/**
 * Polyfill for @colyseus/sdk DEFAULT_ENDPOINT
 *
 * The Colyseus SDK (Client.mjs) evaluates at module-load time:
 *
 *   const DEFAULT_ENDPOINT =
 *     (typeof window !== "undefined" && typeof window?.location?.hostname !== "undefined")
 *       ? `${window.location.protocol.replace("http","ws")}//...`
 *       : "ws://127.0.0.1:2567";
 *
 * In React Native, `window` exists (globalThis alias).  Some Expo / RN
 * runtime versions partially populate `window.location` with `hostname`
 * but leave `protocol` undefined.  The SDK guard only checks `hostname`,
 * so the truthy branch calls `undefined.replace(...)` and crashes.
 *
 * This shim must be imported BEFORE @colyseus/sdk to guarantee safe evaluation.
 */
if (
  typeof window !== "undefined" &&
  typeof window.location !== "undefined" &&
  window.location !== null
) {
  // Ensure `protocol` is a string so the SDK's .replace() never throws.
  if (typeof window.location.protocol === "undefined") {
    try {
      window.location.protocol = "ws:";
    } catch (_e) {
      // In strict environments location properties may be read-only;
      // swallow and let the SDK fall through to its own fallback.
    }
  }
}
