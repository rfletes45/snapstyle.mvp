/**
 * Colyseus Client Configuration
 *
 * Server URL configuration for development and production.
 * Handles platform-specific localhost resolution.
 */

import { COLYSEUS_FEATURES } from "@/constants/featureFlags";
import { GameErrorCode, createGameError } from "@/types/gameErrors";
import Constants from "expo-constants";
import { Platform } from "react-native";

interface ExpoConstantsLegacyManifest {
  debuggerHost?: string;
}

interface ExpoConstantsManifest2 {
  extra?: {
    expoGo?: {
      debuggerHost?: string;
    };
  };
}

// =============================================================================
// Server URLs
// =============================================================================

/**
 * Resolve the development server hostname.
 *
 * Priority:
 * 1. Expo's debuggerHost / hostUri — gives the dev machine's LAN IP
 *    (works for physical devices AND emulators via Expo Go / Dev Client)
 * 2. Platform-specific fallback:
 *    - Android emulator: 10.0.2.2 (AVD special alias for host loopback)
 *    - iOS simulator / web: localhost
 */
function getDevHost(): string {
  const legacyConstants = Constants as typeof Constants & {
    manifest?: ExpoConstantsLegacyManifest;
    manifest2?: ExpoConstantsManifest2;
  };

  // Expo provides the dev machine's IP:port via debuggerHost or hostUri
  const debuggerHost =
    Constants.expoConfig?.hostUri ??
    legacyConstants.manifest?.debuggerHost ??
    legacyConstants.manifest2?.extra?.expoGo?.debuggerHost;

  if (debuggerHost) {
    // debuggerHost is "192.168.x.x:8081" — strip the Metro port
    const host = debuggerHost.split(":")[0];
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return host; // LAN IP — reachable from physical devices
    }
  }

  // Fallback for emulators / simulators
  return Platform.select({
    android: "10.0.2.2",
    default: "localhost",
  })!;
}

const DEV_URL = `ws://${getDevHost()}:2567`;

/**
 * Production server URL.
 * NOTE: Replace with your actual deployed Colyseus server URL.
 */
const PROD_URL = "wss://games.yourdomain.com";

/**
 * The WebSocket URL for the Colyseus game server.
 * Automatically selects dev vs prod based on __DEV__.
 */
export const COLYSEUS_SERVER_URL: string = __DEV__ ? DEV_URL! : PROD_URL;

// =============================================================================
// Room Name Mapping
// =============================================================================

/**
 * Maps client-side game type keys to Colyseus room names.
 * Must match the room names registered in colyseus-server/src/app.config.ts.
 */
export const COLYSEUS_ROOM_NAMES: Record<string, string> = {
  // Quick-Play
  dot_match_game: "dot_match",

  // Turn-Based
  tic_tac_toe_game: "tic_tac_toe",
  connect_four_game: "connect_four",
  gomoku_master_game: "gomoku",
  reversi_game: "reversi",
  chess_game: "chess",
  checkers_game: "checkers",
  crazy_eights_game: "crazy_eights",

  // Physics / Real-Time
  pong_game: "pong",
  bounce_blitz_game: "bounce_blitz",
  brick_breaker_game: "brick_breaker",

  // Cooperative / Creative
  word_master_game: "word_master",
  crossword_puzzle_game: "crossword",

  // Incremental
  starforge_game: "starforge",

  // Party
  sketch_party_game: "sketch_party",

  // Physics — Mini-Golf
  minigolf_duels: "minigolf_duels",
};

/**
 * Room name for the dedicated single-player spectating room.
 * Matches the registration in colyseus-server/src/app.config.ts.
 */
export const COLYSEUS_SPECTATOR_ROOM = "spectator";

/**
 * Check if a game type supports Colyseus multiplayer.
 */
export function isColyseusEnabled(gameType: string): boolean {
  return gameType in COLYSEUS_ROOM_NAMES;
}

/**
 * Get the Colyseus room name for a game type.
 * Returns null if the game doesn't support Colyseus.
 */
export function getColyseusRoomName(gameType: string): string | null {
  return COLYSEUS_ROOM_NAMES[gameType] || null;
}

/**
 * Resolve the Colyseus room name for a game type — throwing variant.
 *
 * Handles `_game` suffix normalization:
 *  1. Direct lookup: "chess_game" → "chess"
 *  2. Append `_game`:  "chess" → "chess_game" → "chess"
 *  3. Strip `_game`:   "chess_game" (already tried in step 1)
 *
 * @throws GameError with JOIN_ROOM_NOT_FOUND if no mapping exists
 */
export function resolveColyseusRoomName(gameType: string): string {
  // 1. Direct match
  const direct = COLYSEUS_ROOM_NAMES[gameType];
  if (direct) return direct;

  // 2. Try appending _game (handles ExtendedGameType like "chess" → "chess_game")
  const withSuffix = COLYSEUS_ROOM_NAMES[gameType + "_game"];
  if (withSuffix) return withSuffix;

  // 3. Try stripping _game (handles double-suffix edge cases)
  if (gameType.endsWith("_game")) {
    const stripped = COLYSEUS_ROOM_NAMES[gameType.slice(0, -5)];
    if (stripped) return stripped;
  }

  throw createGameError(GameErrorCode.JOIN_ROOM_NOT_FOUND, {
    message: `No Colyseus room mapping for game type "${gameType}"`,
    context: { gameType },
  });
}

// =============================================================================
// Game Category Mapping
// =============================================================================

/**
 * Game category types for Colyseus feature-flag gating.
 */
export type ColyseusGameCategory =
  | "physics"
  | "quickplay"
  | "turnbased"
  | "complex"
  | "coop"
  | "incremental"
  | "party";

/**
 * Maps each game type key to its Colyseus tier category.
 * Used by shouldUseColyseus() to check the correct feature flag.
 */
export const GAME_CATEGORY_MAP: Record<string, ColyseusGameCategory> = {
  // Quick-Play (score race)
  dot_match_game: "quickplay",

  // Turn-Based (simple)
  tic_tac_toe_game: "turnbased",
  connect_four_game: "turnbased",
  gomoku_master_game: "turnbased",
  reversi_game: "turnbased",

  // Complex Turn-Based
  chess_game: "complex",
  checkers_game: "complex",
  crazy_eights_game: "complex",

  // Physics / Real-Time
  pong_game: "physics",
  bounce_blitz_game: "physics",
  brick_breaker_game: "physics",

  // Cooperative / Creative
  word_master_game: "coop",
  crossword_puzzle_game: "coop",

  // Incremental
  starforge_game: "incremental",

  // Party
  sketch_party_game: "party",

  // Physics — Mini-Golf
  minigolf_duels: "physics",
};

/**
 * Get the Colyseus category for a game type.
 */
export function getGameCategory(gameType: string): ColyseusGameCategory | null {
  return GAME_CATEGORY_MAP[gameType] ?? null;
}

/**
 * Determines whether a game should use Colyseus when opened from an invite.
 *
 * Returns true only if:
 * 1. The game has a registered Colyseus room
 * 2. The master COLYSEUS_ENABLED flag is on
 * 3. The category-specific feature flag is on
 */
export function shouldUseColyseus(gameType: string): boolean {
  if (!COLYSEUS_FEATURES.COLYSEUS_ENABLED) return false;
  if (!isColyseusEnabled(gameType)) return false;

  const category = getGameCategory(gameType);
  switch (category) {
    case "physics":
      return !!COLYSEUS_FEATURES.PHYSICS_ENABLED;
    case "quickplay":
      return !!COLYSEUS_FEATURES.QUICKPLAY_ENABLED;
    case "turnbased":
      return !!COLYSEUS_FEATURES.TURNBASED_ENABLED;
    case "complex":
      return !!COLYSEUS_FEATURES.COMPLEX_TURNBASED_ENABLED;
    case "coop":
      return !!COLYSEUS_FEATURES.COOP_ENABLED;
    case "incremental":
      return !!COLYSEUS_FEATURES.INCREMENTAL_ENABLED;
    case "party":
      return !!COLYSEUS_FEATURES.PARTY_ENABLED;
    default:
      return false;
  }
}

// =============================================================================
// Reconnection Configuration
// =============================================================================

export const RECONNECTION_CONFIG = {
  /** Max retry attempts before giving up */
  maxRetries: 20,

  /** Initial delay between retries (ms) */
  delay: 100,

  /** Minimum delay between retries (ms) */
  minDelay: 100,

  /** Maximum delay between retries (ms) */
  maxDelay: 8000,

  /** Minimum time connected before considering it "stable" (ms) */
  minUptime: 3000,

  /** Max messages to buffer while disconnected */
  maxEnqueuedMessages: 15,
} as const;
