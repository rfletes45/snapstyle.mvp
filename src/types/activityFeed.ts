/**
 * Activity Feed Types
 *
 * Defines the data structures for the friends activity feed.
 * Activities are events like game scores, achievements, profile updates, etc.
 *
 * @module types/activityFeed
 */

// =============================================================================
// Activity Event Types
// =============================================================================

/**
 * All possible activity event types
 */
export type ActivityEventType =
  | "achievement" // Friend earned an achievement/badge
  | "streak_milestone" // Friend hit a streak milestone
  | "profile_update" // Friend updated profile picture/bio
  | "new_friend" // Two friends became friends
  | "status_change" // Friend set a new status
  | "decoration_equip" // Friend equipped a new decoration
  | "shop_purchase"; // Friend bought something from shop

/**
 * An individual activity event in the feed
 */
export interface ActivityEvent {
  /** Unique event ID */
  id: string;
  /** The user who performed the activity */
  userId: string;
  /** Display name of the user */
  displayName: string;
  /** Username of the user */
  username?: string;
  /** User's profile picture URL */
  avatarUrl?: string;
  /** Avatar config for fallback */
  avatarConfig?: { baseColor: string };
  /** Equipped avatar decoration ID */
  decorationId?: string | null;
  /** Type of activity */
  type: ActivityEventType;
  /** Timestamp when the activity occurred */
  timestamp: Date;
  /** Activity-specific payload */
  data: ActivityEventData;
  /** Whether the current user has "liked"/reacted to this */
  liked?: boolean;
  /** Number of likes/reactions */
  likeCount?: number;
}

/**
 * Union type for activity-specific data payloads
 */
export type ActivityEventData =
  | AchievementData
  | StreakMilestoneData
  | ProfileUpdateData
  | NewFriendData
  | StatusChangeData
  | DecorationEquipData
  | ShopPurchaseData;

export interface AchievementData {
  type: "achievement";
  achievementId: string;
  achievementName: string;
  achievementIcon: string;
  description: string;
  rarity?: "common" | "uncommon" | "rare" | "epic" | "legendary";
}

export interface StreakMilestoneData {
  type: "streak_milestone";
  streakDays: number;
  friendName: string;
  friendId: string;
}

export interface ProfileUpdateData {
  type: "profile_update";
  updateType: "picture" | "bio" | "theme";
  newValue?: string;
}

export interface NewFriendData {
  type: "new_friend";
  friendName: string;
  friendId: string;
  friendAvatar?: string;
}

export interface StatusChangeData {
  type: "status_change";
  emoji: string;
  text: string;
}

export interface DecorationEquipData {
  type: "decoration_equip";
  decorationId: string;
  decorationName: string;
}

export interface ShopPurchaseData {
  type: "shop_purchase";
  itemName: string;
  itemType: "decoration" | "theme" | "badge" | "other";
}

// =============================================================================
// Feed Configuration
// =============================================================================

/**
 * Activity event display configuration
 */
export interface ActivityDisplayConfig {
  icon: string;
  emoji: string;
  verb: string;
  color: string;
  /** Priority for feed sorting (higher = more important) */
  priority: number;
}

export const ACTIVITY_DISPLAY_CONFIG: Record<
  ActivityEventType,
  ActivityDisplayConfig
> = {
  achievement: {
    icon: "medal",
    emoji: "🏅",
    verb: "earned",
    color: "#9C27B0",
    priority: 9,
  },
  streak_milestone: {
    icon: "fire",
    emoji: "🔥",
    verb: "reached a streak of",
    color: "#F44336",
    priority: 7,
  },
  profile_update: {
    icon: "account-edit",
    emoji: "✨",
    verb: "updated their",
    color: "#607D8B",
    priority: 2,
  },
  new_friend: {
    icon: "account-plus",
    emoji: "🤝",
    verb: "became friends with",
    color: "#00BCD4",
    priority: 5,
  },
  status_change: {
    icon: "emoticon",
    emoji: "💭",
    verb: "set their status to",
    color: "#795548",
    priority: 1,
  },
  decoration_equip: {
    icon: "star-circle",
    emoji: "⭐",
    verb: "equipped",
    color: "#FFC107",
    priority: 3,
  },
  shop_purchase: {
    icon: "shopping",
    emoji: "🛍️",
    verb: "purchased",
    color: "#E91E63",
    priority: 4,
  },
};
