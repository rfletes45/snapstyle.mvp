/**
 * Game Protocol Versioning
 *
 * Defines the protocol version exchanged between client and Colyseus server.
 * The server can reject clients whose version is too old, enabling safe
 * schema migrations without silent desync.
 *
 * Bump GAME_PROTOCOL_VERSION whenever:
 *  - A Colyseus Schema class adds/removes/reorders fields
 *  - A message type name or payload shape changes
 *  - Room join-option semantics change
 *
 * @see docs/GAME_SYSTEM_REFERENCE.md §3 (Colyseus Server Architecture)
 */

import Constants from "expo-constants";
import { Platform } from "react-native";

// =============================================================================
// Protocol Version
// =============================================================================

/**
 * Current protocol version.
 * Increment on breaking server↔client contract changes.
 */
export const GAME_PROTOCOL_VERSION = 1;

// =============================================================================
// Client Build Info
// =============================================================================

/**
 * Metadata about the running client build.
 * Sent in every Colyseus join request for diagnostics & compatibility checks.
 */
export interface ClientBuildInfo {
  /** Semantic version from app.json / Constants.expoConfig */
  appVersion: string;
  /** "ios" | "android" | "web" */
  platform: string;
  /** Short git SHA, if available at build time */
  commitHash?: string;
  /** EAS / native build number */
  buildNumber?: string;
  /** Must match GAME_PROTOCOL_VERSION */
  protocolVersion: number;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Build a ClientBuildInfo snapshot from the running Expo app.
 * Safe to call anywhere — falls back to sensible defaults when
 * Constants values are unavailable (e.g. in Jest).
 */
export function getClientBuildInfo(): ClientBuildInfo {
  const expoConfig = Constants.expoConfig ?? Constants.manifest;
  return {
    appVersion: expoConfig?.version ?? "0.0.0",
    platform: Platform.OS,
    commitHash: (expoConfig?.extra as Record<string, unknown> | undefined)
      ?.commitHash as string | undefined,
    buildNumber:
      Platform.OS === "ios"
        ? (expoConfig?.ios?.buildNumber as string | undefined)
        : (expoConfig?.android?.versionCode?.toString() as string | undefined),
    protocolVersion: GAME_PROTOCOL_VERSION,
  };
}
