/**
 * Server-Side Protocol Constants
 *
 * Mirror of the client's GAME_PROTOCOL_VERSION with server-specific
 * minimum-supported-version gating. When a client connects with a
 * protocolVersion below MINIMUM_PROTOCOL_VERSION, the server rejects
 * the join in onAuth — forcing an app update.
 *
 * @see src/types/gameProtocol.ts (client-side)
 */

// =============================================================================
// Protocol Versioning
// =============================================================================

/**
 * Current server protocol version.
 * Should track the client's GAME_PROTOCOL_VERSION.
 */
export const SERVER_PROTOCOL_VERSION = 1;

/**
 * Minimum protocol version the server will accept.
 * Clients below this are rejected with a clear "update required" error.
 *
 * Bump this when a breaking schema/message change makes older clients
 * incompatible. The gap between MINIMUM and SERVER allows a grace period
 * for staged rollouts.
 */
export const MINIMUM_PROTOCOL_VERSION = 1;

// =============================================================================
// Validation Helpers
// =============================================================================

export interface ProtocolCheckResult {
  ok: boolean;
  reason?: string;
  clientVersion?: number;
}

/**
 * Check whether a client's join options include a compatible protocol version.
 *
 * @param options - The raw join options bag from Colyseus onAuth/onJoin
 * @returns ok: true if compatible, otherwise reason string
 */
export function checkProtocolVersion(
  options: Record<string, any>,
): ProtocolCheckResult {
  const clientVersion = options?.protocolVersion;

  if (clientVersion === undefined || clientVersion === null) {
    return {
      ok: false,
      reason: "Missing protocolVersion — update the app",
      clientVersion: undefined,
    };
  }

  if (typeof clientVersion !== "number" || !Number.isFinite(clientVersion)) {
    return {
      ok: false,
      reason: `Invalid protocolVersion: ${clientVersion}`,
      clientVersion: undefined,
    };
  }

  if (clientVersion < MINIMUM_PROTOCOL_VERSION) {
    return {
      ok: false,
      reason: `Client protocol v${clientVersion} < minimum v${MINIMUM_PROTOCOL_VERSION} — update required`,
      clientVersion,
    };
  }

  return { ok: true, clientVersion };
}
