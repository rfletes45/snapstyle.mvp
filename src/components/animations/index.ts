/**
 * Animations Components Index
 *
 * Phase 7 of Profile Screen Overhaul
 *
 * Celebration animations:
 * - BadgeEarnAnimation: Badge unlock celebration
 * - LevelUpAnimation: Level up celebration
 *
 * @see docs/PROFILE_SCREEN_OVERHAUL_PLAN.md Phase 7
 */

export {
  BadgeEarnAnimation,
  default as BadgeEarnAnimationDefault,
} from "./BadgeEarnAnimation";
export {
  LevelUpAnimation,
  default as LevelUpAnimationDefault,
} from "./LevelUpAnimation";

export type { BadgeEarnAnimationProps } from "./BadgeEarnAnimation";
export type { LevelUpAnimationProps } from "./LevelUpAnimation";
