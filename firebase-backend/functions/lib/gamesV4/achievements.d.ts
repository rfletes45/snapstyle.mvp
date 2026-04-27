/**
 * Games V4 — Achievement Evaluator (Sectioned + Difficulty Ranked)
 *
 * Evaluates per-player game achievements after session resolution.
 * Called as part of the resolve pipeline (between Phase 4 and Phase 5).
 *
 * Achievement architecture:
 * - **Sections**: Thematic groupings (Getting Started, Grinder, etc.)
 * - **Difficulty**: easy → medium → hard → expert → legendary
 * - **Rewards**: Token reward automatically granted on each unlock
 *
 * Achievement categories:
 * - Milestone: cumulative play/win thresholds (10/50/100/250 games)
 * - Performance: in-game feats (flawless win, speed demon, etc.)
 * - Game-specific: per-game mastery (TicTacToe perfect, Connect Four streak, etc.)
 *
 * Idempotent: achievements that already exist in Firestore are skipped.
 * Writes atomically:
 *   Users/{uid}/Achievements/{achievementType}
 *   Wallets/{uid}  (token reward increment)
 *   Transactions/{deterministicAchievementRewardTxId}
 *
 * @module gamesV4/achievements
 */
import type { AchievementUnlock, GameResultV4, GameSessionV4 } from "./types";
export type AchievementDifficulty = "easy" | "medium" | "hard" | "expert" | "legendary";
export interface AchievementSectionDef {
    /** Unique section ID. */
    sectionId: string;
    /** Human-readable section name. */
    name: string;
    /** Short description of the section. */
    description: string;
    /** Icon (emoji or MaterialCommunityIcons name). */
    icon: string;
    /** Badge ID granted when all achievements in section are complete. */
    sectionBadgeId: string;
}
/**
 * Legacy section ID → new section ID mapping.
 * Used to resolve claims/data that still reference old section groupings.
 */
export declare const LEGACY_SECTION_MAP: Record<string, string>;
/** Resolve a possibly-legacy sectionId to the current sectionId. */
export declare function resolveSection(sectionId: string): string;
export declare const ACHIEVEMENT_SECTIONS: AchievementSectionDef[];
export declare function getAchievementRewardTransactionId(uid: string, achievementType: string): string;
export declare function formatAchievementDisplayName(achievementType: string, displayName?: string | null): string;
export declare function awardExistingUnclaimedAchievementReward(params: {
    db: FirebaseFirestore.Firestore;
    uid: string;
    achievementType: string;
}): Promise<{
    achievementType: string;
    awarded: boolean;
    repaired: boolean;
    tokensAwarded: number;
    transactionId: string | null;
}>;
/**
 * Evaluate all V4 achievements for each participant after a game resolves.
 *
 * @param db Firestore instance
 * @param session The resolved session
 * @param result The game result (before achievements are populated)
 * @returns Array of achievement unlocks to include in the result doc
 */
export declare function evaluateAchievementsV4(db: FirebaseFirestore.Firestore, session: GameSessionV4, result: Omit<GameResultV4, "achievementUnlocks">): Promise<AchievementUnlock[]>;
/**
 * Get all achievement type IDs belonging to a section.
 */
export declare function getAchievementTypesForSection(sectionId: string): string[];
/**
 * Get the section definition by sectionId.
 */
export declare function getSectionDef(sectionId: string): AchievementSectionDef | undefined;
/**
 * Get all achievement definitions (for client-side rendering).
 */
export declare function getAllAchievementDefs(): Array<{
    type: string;
    name: string;
    description: string;
    sectionId: string;
    difficulty: AchievementDifficulty;
    tokenReward: number;
    badgeId?: string;
}>;
