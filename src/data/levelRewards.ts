/**
 * Level Rewards V4 — Client Catalog
 *
 * Mirrors LEVEL_REWARDS_V4 from the backend.
 * Used for display purposes only — all grant/claim logic is server-side.
 *
 * Cap: level 50 — no rewards beyond this.
 *
 * @module data/levelRewards
 */

// =============================================================================
// Types
// =============================================================================

export type LevelRewardType = "tokens" | "background_entitlement";

export interface LevelReward {
  /** 1-based level */
  level: number;
  /** Whether this is a milestone (every 5th level) */
  isMilestone: boolean;
  /** What the player gets */
  rewardType: LevelRewardType;
  /** Tokens awarded (non-milestone: 50, milestone: level * 20) */
  amount: number;
  /** Display label */
  label: string;
  /** Icon name (MaterialCommunityIcons) */
  icon: string;
  /** Cosmetic ID to grant (for milestone rewards) */
  cosmeticId?: string;
  /** Description text */
  description: string;
}

// =============================================================================
// Constants
// =============================================================================

/** Maximum level with rewards (level cap) */
export const MAX_REWARD_LEVEL = 50;

/** Small reward: tokens per non-milestone level */
export const SMALL_REWARD_POINTS = 50;

/**
 * Milestone reward definitions (every 5 levels).
 * Levels with cosmeticId grant a real cosmetic entitlement.
 */
const MILESTONE_REWARDS: Record<
  number,
  {
    label: string;
    points: number;
    cosmeticId: string;
    rewardType: LevelRewardType;
  }
> = {
  5: {
    label: "Circling Waves Background",
    points: 100,
    cosmeticId: "bg_circling_waves",
    rewardType: "background_entitlement",
  },
  10: {
    label: "Aurora Borealis Background",
    points: 200,
    cosmeticId: "bg_aurora_borealis",
    rewardType: "background_entitlement",
  },
  15: {
    label: "Level 15 Badge",
    points: 300,
    cosmeticId: "badge_level_15",
    rewardType: "background_entitlement",
  },
  20: {
    label: "Rune Circles Background",
    points: 400,
    cosmeticId: "bg_rune_circles",
    rewardType: "background_entitlement",
  },
  25: {
    label: "Level 25 Badge",
    points: 500,
    cosmeticId: "badge_level_25",
    rewardType: "background_entitlement",
  },
  30: {
    label: "Synthwave Background",
    points: 600,
    cosmeticId: "bg_synthwave",
    rewardType: "background_entitlement",
  },
  35: {
    label: "Level 35 Badge",
    points: 700,
    cosmeticId: "badge_level_35",
    rewardType: "background_entitlement",
  },
  40: {
    label: "Golden Crown Decoration",
    points: 800,
    cosmeticId: "dec_golden_crown",
    rewardType: "background_entitlement",
  },
  45: {
    label: "Level 45 Badge",
    points: 900,
    cosmeticId: "badge_level_45",
    rewardType: "background_entitlement",
  },
  50: {
    label: "Synthwave Videogame Background",
    points: 1000,
    cosmeticId: "bg_synthwave_videogame",
    rewardType: "background_entitlement",
  },
};

// =============================================================================
// Catalog
// =============================================================================

function buildCatalog(): LevelReward[] {
  const rewards: LevelReward[] = [];

  for (let lvl = 1; lvl <= MAX_REWARD_LEVEL; lvl++) {
    const isMilestone = lvl % 5 === 0;

    if (isMilestone) {
      const milestone = MILESTONE_REWARDS[lvl];
      rewards.push({
        level: lvl,
        isMilestone: true,
        rewardType: milestone?.rewardType ?? "background_entitlement",
        amount: milestone?.points ?? 500,
        label: milestone?.label ?? `Milestone Level ${lvl} Reward`,
        icon:
          milestone?.rewardType === "background_entitlement"
            ? "image-area"
            : "trophy-award",
        cosmeticId: milestone?.cosmeticId,
        description: `Milestone reward for reaching level ${lvl}! Includes ${milestone?.points ?? 500} tokens + exclusive cosmetic.`,
      });
    } else {
      rewards.push({
        level: lvl,
        isMilestone: false,
        rewardType: "tokens",
        amount: SMALL_REWARD_POINTS,
        label: `+${SMALL_REWARD_POINTS} Tokens`,
        icon: "star-four-points",
        description: `+${SMALL_REWARD_POINTS} tokens for reaching level ${lvl}.`,
      });
    }
  }

  return rewards;
}

/** Full catalog of level rewards (level 1–50) */
export const LEVEL_REWARDS: LevelReward[] = buildCatalog();

/** Quick lookup by level number */
export function getRewardForLevel(level: number): LevelReward | undefined {
  return LEVEL_REWARDS.find((r) => r.level === level);
}
