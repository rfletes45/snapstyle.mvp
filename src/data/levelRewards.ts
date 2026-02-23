/**
 * Level Rewards Catalog
 *
 * Defines the reward granted at each level (1–50).
 * Every 5th level is a "big" milestone; all others grant tokens.
 *
 * Milestone levels grant real background entitlements where available,
 * otherwise placeholder_decoration for future content.
 *
 * Cap: level 50 — no rewards beyond this.
 *
 * @module data/levelRewards
 */

// =============================================================================
// Types
// =============================================================================

export type LevelRewardType =
  | "tokens"
  | "cosmetic_points"
  | "placeholder_decoration"
  | "background_entitlement";

export interface LevelReward {
  /** 1-based level */
  level: number;
  /** Whether this is a milestone (every 5th level) */
  isMilestone: boolean;
  /** What the player gets */
  rewardType: LevelRewardType;
  /** Cosmetic points awarded (non-milestone levels) */
  amount: number;
  /** Display label */
  label: string;
  /** Icon name (MaterialCommunityIcons) */
  icon: string;
  /** Cosmetic ID to grant (for background_entitlement rewards) */
  cosmeticId?: string;
}

// =============================================================================
// Constants
// =============================================================================

/** Maximum level with rewards */
export const MAX_REWARD_LEVEL = 50;

/** Small reward: tokens per non-milestone level */
export const SMALL_REWARD_POINTS = 50;

/**
 * Milestone reward definitions.
 * Levels with cosmeticId grant a real background entitlement.
 * Levels without cosmeticId remain placeholders for future content.
 */
const MILESTONE_REWARDS: Record<
  number,
  {
    label: string;
    points: number;
    cosmeticId?: string;
    rewardType: LevelRewardType;
  }
> = {
  5: {
    label: "Circling Waves Background",
    points: 200,
    cosmeticId: "bg_circling_waves",
    rewardType: "background_entitlement",
  },
  10: {
    label: "Aurora Borealis Background",
    points: 300,
    cosmeticId: "bg_aurora_borealis",
    rewardType: "background_entitlement",
  },
  15: {
    label: "Placeholder: Name Color (future)",
    points: 400,
    rewardType: "placeholder_decoration",
  },
  20: {
    label: "Rune Circles Background",
    points: 500,
    cosmeticId: "bg_rune_circles",
    rewardType: "background_entitlement",
  },
  25: {
    label: "Placeholder: Avatar Border (future)",
    points: 600,
    rewardType: "placeholder_decoration",
  },
  30: {
    label: "Synthwave Background",
    points: 700,
    cosmeticId: "bg_synthwave",
    rewardType: "background_entitlement",
  },
  35: {
    label: "Placeholder: Animated Emote (future)",
    points: 800,
    rewardType: "placeholder_decoration",
  },
  40: {
    label: "Placeholder: Profile Badge (future)",
    points: 900,
    rewardType: "placeholder_decoration",
  },
  45: {
    label: "Placeholder: Exclusive Sticker Pack (future)",
    points: 1000,
    rewardType: "placeholder_decoration",
  },
  50: {
    label: "Synthwave Videogame Background",
    points: 2000,
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
        rewardType: milestone?.rewardType ?? "placeholder_decoration",
        amount: milestone?.points ?? 500,
        label: milestone?.label ?? `Milestone Level ${lvl} Reward`,
        icon:
          milestone?.rewardType === "background_entitlement"
            ? "image-area"
            : "trophy-award",
        cosmeticId: milestone?.cosmeticId,
      });
    } else {
      rewards.push({
        level: lvl,
        isMilestone: false,
        rewardType: "tokens",
        amount: SMALL_REWARD_POINTS,
        label: `+${SMALL_REWARD_POINTS} Tokens`,
        icon: "star-four-points",
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
