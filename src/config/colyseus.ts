/**
 * Colyseus Client Configuration
 *
 * Server URL configuration for development and production.
 * Handles platform-specific localhost resolution.
 */

import { COLYSEUS_FEATURES } from "@/constants/featureFlags";
import { GameErrorCode, createGameError } from "@/types/gameErrors";
import {
  type ExtendedGameType,
  GAME_METADATA,
  getGameRuntimeType,
} from "@/types/games";
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

type ColyseusMappedGameType = Extract<
  ExtendedGameType,
  | "dot_match"
  | "tic_tac_toe"
  | "connect_four"
  | "gomoku_master"
  | "reversi_game"
  | "chess"
  | "checkers"
  | "crazy_eights"
  | "pong_game"
  | "bounce_blitz"
  | "brick_breaker"
  | "word_master"
  | "crossword_puzzle"
  | "starforge_game"
  | "sketch_party_game"
  | "minigolf_duels"
  | "battleship"
>;

export interface ColyseusGameMappingEntry {
  /**
   * Client lookup key used by join hooks.
   * Some entries use a `_game` suffix for backward compatibility.
   */
  clientKey: string;
  /** Registered room name in colyseus-server/src/app.config.ts */
  roomName: string;
  /** Feature-flag category */
  category: ColyseusGameCategory;
}

/**
 * Canonical mapping table for gameId -> client join key -> room name.
 */
export const COLYSEUS_GAME_MAPPING: Record<
  ColyseusMappedGameType,
  ColyseusGameMappingEntry
> = {
  dot_match: {
    clientKey: "dot_match_game",
    roomName: "dot_match",
    category: "quickplay",
  },
  tic_tac_toe: {
    clientKey: "tic_tac_toe_game",
    roomName: "tic_tac_toe",
    category: "turnbased",
  },
  connect_four: {
    clientKey: "connect_four_game",
    roomName: "connect_four",
    category: "turnbased",
  },
  gomoku_master: {
    clientKey: "gomoku_master_game",
    roomName: "gomoku",
    category: "turnbased",
  },
  reversi_game: {
    clientKey: "reversi_game",
    roomName: "reversi",
    category: "turnbased",
  },
  chess: {
    clientKey: "chess_game",
    roomName: "chess",
    category: "complex",
  },
  checkers: {
    clientKey: "checkers_game",
    roomName: "checkers",
    category: "complex",
  },
  crazy_eights: {
    clientKey: "crazy_eights_game",
    roomName: "crazy_eights",
    category: "complex",
  },
  pong_game: {
    clientKey: "pong_game",
    roomName: "pong",
    category: "physics",
  },
  bounce_blitz: {
    clientKey: "bounce_blitz_game",
    roomName: "bounce_blitz",
    category: "physics",
  },
  brick_breaker: {
    clientKey: "brick_breaker_game",
    roomName: "brick_breaker",
    category: "physics",
  },
  word_master: {
    clientKey: "word_master_game",
    roomName: "word_master",
    category: "coop",
  },
  crossword_puzzle: {
    clientKey: "crossword_puzzle_game",
    roomName: "crossword",
    category: "coop",
  },
  starforge_game: {
    clientKey: "starforge_game",
    roomName: "starforge",
    category: "incremental",
  },
  sketch_party_game: {
    clientKey: "sketch_party_game",
    roomName: "sketch_party",
    category: "party",
  },
  minigolf_duels: {
    clientKey: "minigolf_duels",
    roomName: "minigolf_duels",
    category: "physics",
  },
  battleship: {
    clientKey: "battleship_game",
    roomName: "battleship",
    category: "complex",
  },
};

/**
 * Maps client-side game type keys to Colyseus room names.
 * Must match the room names registered in colyseus-server/src/app.config.ts.
 */
export const COLYSEUS_ROOM_NAMES: Record<string, string> = Object.values(
  COLYSEUS_GAME_MAPPING,
).reduce<Record<string, string>>((acc, entry) => {
  acc[entry.clientKey] = entry.roomName;
  return acc;
}, {});

/**
 * Maps each game type key to its Colyseus tier category.
 * Used by shouldUseColyseus() to check the correct feature flag.
 */
export const GAME_CATEGORY_MAP: Record<string, ColyseusGameCategory> =
  Object.values(COLYSEUS_GAME_MAPPING).reduce<
    Record<string, ColyseusGameCategory>
  >((acc, entry) => {
    acc[entry.clientKey] = entry.category;
    return acc;
  }, {});

export function getColyseusClientKey(
  gameType: ExtendedGameType,
): string | null {
  const entry = COLYSEUS_GAME_MAPPING[gameType as ColyseusMappedGameType];
  return entry?.clientKey ?? null;
}

function assertColyseusMappingIntegrity(): void {
  // Ensure every mapping entry points to a real registry game.
  for (const gameId of Object.keys(COLYSEUS_GAME_MAPPING)) {
    if (!(gameId in GAME_METADATA)) {
      throw new Error(
        `[colyseus] Mapping key "${gameId}" is missing from GAME_METADATA`,
      );
    }
  }

  // Ensure every realtime runtime game has a mapping.
  for (const gameId of Object.keys(GAME_METADATA) as ExtendedGameType[]) {
    if (getGameRuntimeType(gameId) !== "realtime") continue;
    const mapped =
      !!COLYSEUS_ROOM_NAMES[gameId] || !!COLYSEUS_ROOM_NAMES[`${gameId}_game`];
    if (!mapped) {
      throw new Error(
        `[colyseus] Missing room mapping for realtime game "${gameId}"`,
      );
    }
  }
}

if (typeof __DEV__ !== "undefined" && __DEV__) {
  assertColyseusMappingIntegrity();
}

/**
 * Room name for the dedicated single-player spectating room.
 * Matches the registration in colyseus-server/src/app.config.ts.
 */
export const COLYSEUS_SPECTATOR_ROOM = "spectator";

/**
 * Check if a game type supports Colyseus multiplayer.
 * Accepts both ExtendedGameType IDs ("battleship") and clientKeys ("battleship_game").
 */
export function isColyseusEnabled(gameType: string): boolean {
  // Direct match against clientKey-keyed room names
  if (gameType in COLYSEUS_ROOM_NAMES) return true;
  // Fall back: check if appending "_game" hits (ExtendedGameType → clientKey)
  if (gameType + "_game" in COLYSEUS_ROOM_NAMES) return true;
  // Fall back: check if it's a key in the COLYSEUS_GAME_MAPPING (ExtendedGameType)
  if (gameType in COLYSEUS_GAME_MAPPING) return true;
  return false;
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
 * Get the Colyseus category for a game type.
 * Accepts both ExtendedGameType IDs and clientKeys.
 */
export function getGameCategory(gameType: string): ColyseusGameCategory | null {
  // Direct match (clientKey-keyed)
  const direct = GAME_CATEGORY_MAP[gameType];
  if (direct) return direct;
  // Try appending _game (ExtendedGameType → clientKey)
  const withSuffix = GAME_CATEGORY_MAP[gameType + "_game"];
  if (withSuffix) return withSuffix;
  // Fall back via COLYSEUS_GAME_MAPPING (keyed by ExtendedGameType)
  const mapping = COLYSEUS_GAME_MAPPING[gameType as ColyseusMappedGameType];
  return mapping?.category ?? null;
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
