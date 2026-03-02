/**
 * Badge Definitions
 *
 * Static data for all badges that can be earned.
 * Badges are earned via achievements, milestones, or special events.
 *
 * @see src/types/profile.ts for Badge interface
 */

import type { AchievementTier, Badge, BadgeCategory } from "@/types/profile";

// =============================================================================
// Badge Definitions
// =============================================================================

export const BADGE_DEFINITIONS: Badge[] = [
  // -------------------------
  // STREAK CATEGORY
  // -------------------------
  {
    id: "streak_7",
    name: "Week Warrior",
    description: "Maintain a 7-day streak",
    icon: "🔥",
    tier: "bronze",
    category: "streak",
    earnedVia: {
      type: "milestone",
      milestoneType: "streak",
      milestoneValue: 7,
    },
    hidden: false,
  },
  {
    id: "streak_30",
    name: "Monthly Champion",
    description: "Maintain a 30-day streak",
    icon: "💪",
    tier: "silver",
    category: "streak",
    earnedVia: {
      type: "milestone",
      milestoneType: "streak",
      milestoneValue: 30,
    },
    hidden: false,
  },
  {
    id: "streak_100",
    name: "Centurion",
    description: "Maintain a 100-day streak",
    icon: "🏅",
    tier: "gold",
    category: "streak",
    earnedVia: {
      type: "milestone",
      milestoneType: "streak",
      milestoneValue: 100,
    },
    frameColor: "#FFD700",
    animated: true,
    hidden: false,
  },
  {
    id: "streak_365",
    name: "Year Master",
    description: "Maintain a 365-day streak",
    icon: "👑",
    tier: "platinum",
    category: "streak",
    earnedVia: {
      type: "milestone",
      milestoneType: "streak",
      milestoneValue: 365,
    },
    frameColor: "#E5E4E2",
    animated: true,
    hidden: false,
  },

  // -------------------------
  // SOCIAL CATEGORY
  // -------------------------
  {
    id: "first_friend",
    name: "First Friend",
    description: "Add your first friend",
    icon: "🤝",
    tier: "bronze",
    category: "social",
    earnedVia: { type: "achievement", achievementId: "social_first_friend" },
    hidden: false,
  },
  {
    id: "social_butterfly",
    name: "Social Butterfly",
    description: "Add 10 friends",
    icon: "🦋",
    tier: "silver",
    category: "social",
    earnedVia: { type: "achievement", achievementId: "social_10_friends" },
    hidden: false,
  },
  {
    id: "popular",
    name: "Popular",
    description: "Add 50 friends",
    icon: "⭐",
    tier: "gold",
    category: "social",
    earnedVia: { type: "achievement", achievementId: "social_50_friends" },
    hidden: false,
  },

  // -------------------------
  // COLLECTION CATEGORY
  // -------------------------
  {
    id: "collector_10",
    name: "Collector",
    description: "Own 10 cosmetic items",
    icon: "📦",
    tier: "bronze",
    category: "collection",
    earnedVia: { type: "achievement", achievementId: "collection_10" },
    hidden: false,
  },
  {
    id: "collector_25",
    name: "Hoarder",
    description: "Own 25 cosmetic items",
    icon: "🎁",
    tier: "silver",
    category: "collection",
    earnedVia: { type: "achievement", achievementId: "collection_25" },
    hidden: false,
  },
  {
    id: "collector_50",
    name: "Fashionista",
    description: "Own 50 cosmetic items",
    icon: "💎",
    tier: "gold",
    category: "collection",
    earnedVia: { type: "achievement", achievementId: "collection_50" },
    hidden: false,
  },

  // -------------------------
  // SPECIAL CATEGORY
  // -------------------------
  {
    id: "beta_tester",
    name: "Beta Tester",
    description: "Participated in the beta",
    icon: "🧪",
    tier: "gold",
    category: "special",
    earnedVia: { type: "event", eventId: "beta_2026" },
    frameColor: "#9C27B0",
    hidden: false,
    limitedTime: true,
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get badge by ID
 */
export function getBadgeById(badgeId: string): Badge | undefined {
  return BADGE_DEFINITIONS.find((b) => b.id === badgeId);
}

/**
 * Get badges by category
 */
export function getBadgesByCategory(category: BadgeCategory): Badge[] {
  return BADGE_DEFINITIONS.filter((b) => b.category === category);
}

/**
 * Get badges by tier
 */
export function getBadgesByTier(tier: AchievementTier): Badge[] {
  return BADGE_DEFINITIONS.filter((b) => b.tier === tier);
}

/**
 * Get visible (non-hidden) badges
 */
export function getVisibleBadges(): Badge[] {
  return BADGE_DEFINITIONS.filter((b) => !b.hidden);
}

/**
 * Get badge for a specific achievement
 */
export function getBadgeForAchievement(
  achievementId: string,
): Badge | undefined {
  return BADGE_DEFINITIONS.find(
    (b) =>
      b.earnedVia.type === "achievement" &&
      b.earnedVia.achievementId === achievementId,
  );
}

/**
 * Get badge for a milestone
 */
export function getBadgeForMilestone(
  milestoneType: string,
  milestoneValue: number,
): Badge | undefined {
  return BADGE_DEFINITIONS.find(
    (b) =>
      b.earnedVia.type === "milestone" &&
      b.earnedVia.milestoneType === milestoneType &&
      b.earnedVia.milestoneValue === milestoneValue,
  );
}

/**
 * Get total badge count
 */
export function getTotalBadgeCount(): number {
  return BADGE_DEFINITIONS.length;
}

/**
 * Get count of visible badges
 */
export function getVisibleBadgeCount(): number {
  return getVisibleBadges().length;
}
