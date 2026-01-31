/**
 * Types barrel export
 *
 * Due to overlapping type definitions across modules (games, models, turnBased),
 * this barrel only exports non-conflicting modules.
 *
 * For game-related types, import directly from:
 * - ./games - Primary game type definitions
 * - ./turnBased - Turn-based match and game state types
 * - ./singlePlayerGames - Single player session types
 * - ./poolGame - Pool/billiards specific types
 * - ./gameHistory - Completed game history records
 * - ./multiplayerLeaderboard - Multiplayer leaderboard types (Phase 8)
 *
 * Models exports ExtendedGameType, RealTimeGameType, etc. which conflict with games.ts
 * Import game types from ./games directly when needed.
 *
 * For message adapters, import from:
 * - @/services/messaging/adapters - GroupMessage ↔ MessageV2 conversion
 */

export * from "./achievements";
export * from "./gameFilters";
export * from "./gameHistory";
export * from "./messaging";
export * from "./models";
export * from "./multiplayerLeaderboard";
export * from "./poolGame";

// =============================================================================
// Re-export message adapters for convenience
// =============================================================================
// Note: These are runtime functions, not just types, so we re-export from services
export {
  fromGroupMessage,
  fromGroupMessages,
  isLegacyGroupMessage,
  isMessageV2,
  toGroupMessage,
} from "@/services/messaging/adapters";
