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
 *
 * Models exports ExtendedGameType, RealTimeGameType, etc. which conflict with games.ts
 * Import game types from ./games directly when needed.
 */

export * from "./achievements";
export * from "./messaging";
export * from "./models";
export * from "./poolGame";
