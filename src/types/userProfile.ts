/**
 * User Profile Types
 *
 * Types for the new profile system including:
 * - Profile picture and avatar decorations
 * - User bio and status
 * - Privacy settings
 * - Profile themes
 * - Mutual friends
 * - Profile sharing
 * - Relationship states
 *
 * @module types/userProfile
 */

import type { AvatarConfig, Friend } from "./models";

// =============================================================================
// PROFILE PICTURE & AVATAR DECORATIONS
// =============================================================================

/**
 * User's profile picture configuration
 */
export interface ProfilePicture {
  /** Firebase Storage URL of the profile picture */
  url: string | null;
  /** Thumbnail URL (lower resolution for lists) */
  thumbnailUrl?: string;
  /** When the picture was last updated */
  updatedAt: number;
  /** Original filename for reference */
  originalFilename?: string;
}

/**
 * Avatar decoration rarity
 */
export type DecorationRarity =
  | "common"
  | "rare"
  | "epic"
  | "legendary"
  | "mythic";

/**
 * Decoration category for organization
 */
export type DecorationCategory =
  | "seasonal" // Holiday/event themed
  | "achievement" // Earned through gameplay
  | "premium" // Purchased
  | "exclusive" // Limited time/special
  | "basic"; // Default/starter options

/**
 * How to obtain a decoration
 */
export interface DecorationObtainMethod {
  type: "free" | "achievement" | "purchase" | "event" | "exclusive";
  /** For achievements */
  achievementId?: string;
  /** For purchases */
  priceTokens?: number;
  priceUSD?: number;
  /** For events */
  eventId?: string;
  eventName?: string;
  /** For time-limited availability */
  availableFrom?: number;
  availableTo?: number;
}

/**
 * Avatar decoration definition (stored in app assets)
 */
export interface AvatarDecoration {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description of the decoration */
  description?: string;
  /** Path to the decoration asset (PNG or GIF) - can be require() result */
  assetPath: any;
  /** Whether this is an animated decoration (GIF) */
  animated: boolean;
  /** Rarity for display styling */
  rarity: DecorationRarity;
  /** How to obtain this decoration */
  obtainMethod: DecorationObtainMethod;
  /** Category for organization */
  category: DecorationCategory;
  /** Whether this is currently available */
  available: boolean;
  /** Tags for filtering */
  tags?: string[];
  /** Sort order in lists */
  sortOrder?: number;
}

/**
 * User's equipped avatar decoration
 */
export interface UserAvatarDecoration {
  /** ID of the equipped decoration (null if none) */
  decorationId: string | null;
  /** When it was equipped */
  equippedAt?: number;
}

/**
 * User's owned decorations (stored in Firestore)
 */
export interface UserOwnedDecoration {
  decorationId: string;
  obtainedAt: number;
  obtainedVia: "free" | "achievement" | "purchase" | "event" | "gift";
}

// =============================================================================
// USER BIO & STATUS
// =============================================================================

/**
 * User's bio configuration
 */
export interface ProfileBio {
  /** The bio text (max 200 chars) */
  text: string;
  /** When it was last updated */
  updatedAt: number;
}

/**
 * Available mood types
 */
export type MoodType =
  | "happy"
  | "excited"
  | "chill"
  | "busy"
  | "gaming"
  | "studying"
  | "away"
  | "sleeping"
  | "custom";

/**
 * Mood configuration with emoji and display text
 */
export const MOOD_CONFIG: Record<
  MoodType,
  { emoji: string; label: string; color: string }
> = {
  happy: { emoji: "😊", label: "Happy", color: "#FFD700" },
  excited: { emoji: "🎉", label: "Excited", color: "#FF69B4" },
  chill: { emoji: "😎", label: "Chillin", color: "#87CEEB" },
  busy: { emoji: "💼", label: "Busy", color: "#FF4500" },
  gaming: { emoji: "🎮", label: "Gaming", color: "#9B59B6" },
  studying: { emoji: "📚", label: "Studying", color: "#3498DB" },
  away: { emoji: "🌙", label: "Away", color: "#95A5A6" },
  sleeping: { emoji: "😴", label: "Sleeping", color: "#34495E" },
  custom: { emoji: "✨", label: "Custom", color: "#E91E63" },
};

/**
 * User's profile status/mood
 */
export interface ProfileStatus {
  /** Status text or emoji */
  text: string;
  /** Mood indicator */
  mood: MoodType;
  /** When it was set */
  setAt: number;
  /** Auto-expire timestamp (optional) - status clears after this time */
  expiresAt?: number;
  /** Custom emoji if mood is 'custom' */
  customEmoji?: string;
}

// =============================================================================
// PRIVACY SETTINGS
// =============================================================================

/**
 * Privacy visibility options
 */
export type PrivacyVisibility = "everyone" | "friends" | "nobody";

/**
 * Comprehensive privacy settings for profile
 * Provides granular control over what information is visible and to whom
 */
export interface ProfilePrivacySettings {
  // === PROFILE VISIBILITY ===
  /** Who can see your full profile (strangers may see limited view) */
  profileVisibility: PrivacyVisibility;
  /** Who can see your profile picture */
  showProfilePicture: PrivacyVisibility;
  /** Who can see your bio */
  showBio: PrivacyVisibility;
  /** Who can see your status/mood */
  showStatus: PrivacyVisibility;

  // === ACTIVITY VISIBILITY ===
  /** Who can see your game scores */
  showGameScores: PrivacyVisibility;
  /** Who can see your badges */
  showBadges: PrivacyVisibility;
  /** Who can see your last active time */
  showLastActive: PrivacyVisibility;
  /** Who can see your online status */
  showOnlineStatus: PrivacyVisibility;
  /** Who can see your friendship anniversary info */
  showFriendshipInfo: PrivacyVisibility;

  // === SOCIAL VISIBILITY ===
  /** Show mutual friends on your profile */
  showMutualFriends: boolean;
  /** Show your friend count on profile */
  showFriendCount: boolean;
  /** Who can see your friends list */
  showFriendsList: PrivacyVisibility;

  // === CONTACT PERMISSIONS ===
  /** Who can send you friend requests */
  allowFriendRequests: PrivacyVisibility;
  /** Who can send you direct messages (requires friendship or request) */
  allowMessages: PrivacyVisibility;
  /** Who can call you */
  allowCalls: PrivacyVisibility;
  /** Who can send you game invites */
  allowGameInvites: PrivacyVisibility;

  // === DISCOVERY SETTINGS ===
  /** Allow your profile to appear in search results */
  appearInSearch: boolean;
  /** Allow your profile to be shared via link */
  allowProfileSharing: boolean;
  /** Allow your username to be suggested to others */
  allowSuggestions: boolean;

  // === ANALYTICS ===
  /** Track and display profile view count */
  trackProfileViews: boolean;
}

/**
 * Default privacy settings for new users (balanced privacy)
 */
export const DEFAULT_PRIVACY_SETTINGS: ProfilePrivacySettings = {
  // Profile visibility
  profileVisibility: "everyone",
  showProfilePicture: "everyone",
  showBio: "everyone",
  showStatus: "friends",

  // Activity visibility
  showGameScores: "everyone",
  showBadges: "everyone",
  showLastActive: "friends",
  showOnlineStatus: "friends",
  showFriendshipInfo: "friends",

  // Social visibility
  showMutualFriends: true,
  showFriendCount: true,
  showFriendsList: "friends",

  // Contact permissions
  allowFriendRequests: "everyone",
  allowMessages: "friends",
  allowCalls: "friends",
  allowGameInvites: "friends",

  // Discovery
  appearInSearch: true,
  allowProfileSharing: true,
  allowSuggestions: true,

  // Analytics
  trackProfileViews: true,
};

/**
 * Privacy presets for quick configuration
 */
export const PRIVACY_PRESETS = {
  /** Public - Most open, for users who want maximum visibility */
  public: {
    name: "Public",
    description: "Everyone can see your profile and contact you",
    settings: {
      profileVisibility: "everyone",
      showProfilePicture: "everyone",
      showBio: "everyone",
      showStatus: "everyone",
      showGameScores: "everyone",
      showBadges: "everyone",
      showLastActive: "everyone",
      showOnlineStatus: "everyone",
      showFriendshipInfo: "everyone",
      showMutualFriends: true,
      showFriendCount: true,
      showFriendsList: "everyone",
      allowFriendRequests: "everyone",
      allowMessages: "everyone",
      allowCalls: "everyone",
      allowGameInvites: "everyone",
      appearInSearch: true,
      allowProfileSharing: true,
      allowSuggestions: true,
      trackProfileViews: true,
    } as ProfilePrivacySettings,
  },
  /** Friends Only - Balanced, visible only to friends */
  friendsOnly: {
    name: "Friends Only",
    description: "Only friends can see your full profile",
    settings: {
      profileVisibility: "friends",
      showProfilePicture: "friends",
      showBio: "friends",
      showStatus: "friends",
      showGameScores: "friends",
      showBadges: "friends",
      showLastActive: "friends",
      showOnlineStatus: "friends",
      showFriendshipInfo: "friends",
      showMutualFriends: true,
      showFriendCount: false,
      showFriendsList: "friends",
      allowFriendRequests: "everyone",
      allowMessages: "friends",
      allowCalls: "friends",
      allowGameInvites: "friends",
      appearInSearch: true,
      allowProfileSharing: false,
      allowSuggestions: true,
      trackProfileViews: false,
    } as ProfilePrivacySettings,
  },
  /** Private - Maximum privacy, minimal visibility */
  private: {
    name: "Private",
    description: "Minimal profile visibility",
    settings: {
      profileVisibility: "nobody",
      showProfilePicture: "friends",
      showBio: "friends",
      showStatus: "nobody",
      showGameScores: "nobody",
      showBadges: "friends",
      showLastActive: "nobody",
      showOnlineStatus: "nobody",
      showFriendshipInfo: "friends",
      showMutualFriends: false,
      showFriendCount: false,
      showFriendsList: "nobody",
      allowFriendRequests: "nobody",
      allowMessages: "friends",
      allowCalls: "friends",
      allowGameInvites: "friends",
      appearInSearch: false,
      allowProfileSharing: false,
      allowSuggestions: false,
      trackProfileViews: false,
    } as ProfilePrivacySettings,
  },
} as const;

/**
 * Status expiry duration options (in milliseconds)
 */
export const STATUS_EXPIRY_OPTIONS = [
  { label: "Don't clear", value: null },
  { label: "30 minutes", value: 30 * 60 * 1000 },
  { label: "1 hour", value: 60 * 60 * 1000 },
  { label: "4 hours", value: 4 * 60 * 60 * 1000 },
  { label: "Today", value: 24 * 60 * 60 * 1000 },
  { label: "1 week", value: 7 * 24 * 60 * 60 * 1000 },
] as const;

// =============================================================================
// PROFILE THEMES
// =============================================================================

/**
 * Profile theme type
 */
export type ProfileThemeType =
  | "solid"
  | "gradient"
  | "image"
  | "pattern"
  | "animated";

/**
 * Theme configuration for solid color
 */
export interface SolidThemeConfig {
  type: "solid";
  color: string;
}

/**
 * Theme configuration for gradient
 */
export interface GradientThemeConfig {
  type: "gradient";
  colors: string[];
  angle: number; // 0-360
}

/**
 * Theme configuration for image background
 */
export interface ImageThemeConfig {
  type: "image";
  imageUrl: string;
  fit: "cover" | "contain" | "fill";
  overlay?: string; // rgba color for text readability
}

/**
 * Theme configuration for pattern
 */
export interface PatternThemeConfig {
  type: "pattern";
  patternId: string;
  primaryColor: string;
  secondaryColor?: string;
}

/**
 * Theme configuration for animated background
 */
export interface AnimatedThemeConfig {
  type: "animated";
  animationUrl: string;
  fallbackImageUrl: string;
}

/**
 * Union type for all theme configs
 */
export type ProfileThemeConfig =
  | SolidThemeConfig
  | GradientThemeConfig
  | ImageThemeConfig
  | PatternThemeConfig
  | AnimatedThemeConfig;

/**
 * How to obtain a theme
 */
export interface ThemeObtainMethod {
  type: "free" | "default" | "achievement" | "purchase" | "event" | "exclusive";
  achievementId?: string;
  priceTokens?: number;
  priceUSD?: number;
  eventId?: string;
}

/**
 * Profile theme definition
 */
export interface ProfileTheme {
  id: string;
  name: string;
  description?: string;
  previewPath: any; // require() result or URL
  type: ProfileThemeType;
  config: ProfileThemeConfig;
  rarity: DecorationRarity;
  obtainMethod: ThemeObtainMethod;
  available: boolean;
  /** Text color mode for readability */
  textColorMode: "light" | "dark" | "auto";
}

/**
 * User's equipped theme configuration
 */
export interface UserThemeConfig {
  /** Currently equipped theme ID */
  equippedThemeId: string;
  /** Custom uploaded background (premium) */
  customBackgroundUrl?: string;
  /** When theme was last changed */
  updatedAt: number;
}

// =============================================================================
// GAME SCORES DISPLAY
// =============================================================================

/**
 * Game score for profile display
 */
export interface ProfileGameScore {
  gameId: string;
  gameName: string;
  gameIcon: string;
  score: number;
  achievedAt: number;
  displayOrder: number;
}

/**
 * Game scores display configuration
 */
export interface ProfileGameScoresConfig {
  enabled: boolean;
  displayedGames: ProfileGameScore[];
  updatedAt: number;
}

// =============================================================================
// FEATURED BADGES
// =============================================================================

/**
 * Featured badges configuration (up to 5 badges)
 */
export interface FeaturedBadgesConfig {
  badgeIds: string[];
  updatedAt: number;
}

// =============================================================================
// MUTUAL FRIENDS
// =============================================================================

/**
 * Mutual friend info for display
 */
export interface MutualFriendInfo {
  userId: string;
  username: string;
  displayName: string;
  avatarConfig: AvatarConfig;
  profilePictureUrl?: string;
}

// =============================================================================
// PROFILE SHARING
// =============================================================================

/**
 * Profile share data
 */
export interface ProfileShareData {
  /** User ID */
  userId: string;
  /** Username for URL */
  username: string;
  /** Display name */
  displayName: string;
  /** Short code for sharing */
  shareCode: string;
  /** Full share URL */
  shareUrl: string;
  /** QR code data URL */
  qrCodeDataUrl?: string;
  /** When the share was generated */
  generatedAt: number;
}

// =============================================================================
// RELATIONSHIP & PROFILE VIEW CONTEXT
// =============================================================================

/**
 * Relationship type between viewer and profile owner
 */
export type ProfileRelationshipType =
  | "self"
  | "stranger"
  | "friend"
  | "pending_sent"
  | "pending_received"
  | "blocked_by_you"
  | "blocked_by_them";

/**
 * Relationship state with full details
 */
export type ProfileRelationship =
  | { type: "self" }
  | { type: "stranger" }
  | {
      type: "friend";
      friendshipId: string;
      streakCount: number;
      friendsSince: number;
    }
  | { type: "pending_sent"; requestId: string; sentAt: number }
  | { type: "pending_received"; requestId: string; receivedAt: number }
  | { type: "blocked_by_you"; blockedAt: number }
  | { type: "blocked_by_them" };

/**
 * Friendship details for display
 */
export interface FriendshipDetails {
  friendshipId: string;
  friendsSince: number;
  streakCount: number;
  streakUpdatedDay: string;
  /** Days as friends */
  daysAsFriends: number;
  /** Human-readable duration */
  friendshipDuration: string;
}

/**
 * Context for profile view
 */
export interface ProfileViewContext {
  userId: string;
  isOwnProfile: boolean;
  relationship: ProfileRelationship;
  mutualFriends?: MutualFriendInfo[];
  friendshipDetails?: FriendshipDetails;
}

// =============================================================================
// PROFILE ACTIONS
// =============================================================================

/**
 * Available actions on a profile based on relationship
 */
export interface ProfileActions {
  canAddFriend: boolean;
  canCancelRequest: boolean;
  canAcceptRequest: boolean;
  canDeclineRequest: boolean;
  canMessage: boolean;
  canCall: boolean;
  canRemoveFriend: boolean;
  canBlock: boolean;
  canUnblock: boolean;
  canMute: boolean;
  canUnmute: boolean;
  canReport: boolean;
  canShare: boolean;
}

/**
 * Get available actions based on relationship
 */
export function getProfileActions(
  relationship: ProfileRelationship,
): ProfileActions {
  const baseActions: ProfileActions = {
    canAddFriend: false,
    canCancelRequest: false,
    canAcceptRequest: false,
    canDeclineRequest: false,
    canMessage: false,
    canCall: false,
    canRemoveFriend: false,
    canBlock: true,
    canUnblock: false,
    canMute: false,
    canUnmute: false,
    canReport: true,
    canShare: true,
  };

  switch (relationship.type) {
    case "self":
      return {
        ...baseActions,
        canBlock: false,
        canReport: false,
        canShare: true,
      };
    case "stranger":
      return {
        ...baseActions,
        canAddFriend: true,
      };
    case "friend":
      return {
        ...baseActions,
        canMessage: true,
        canCall: true,
        canRemoveFriend: true,
        canMute: true,
      };
    case "pending_sent":
      return {
        ...baseActions,
        canCancelRequest: true,
      };
    case "pending_received":
      return {
        ...baseActions,
        canAcceptRequest: true,
        canDeclineRequest: true,
      };
    case "blocked_by_you":
      return {
        ...baseActions,
        canBlock: false,
        canUnblock: true,
        canReport: false,
        canShare: false,
      };
    case "blocked_by_them":
      return {
        ...baseActions,
        canBlock: false,
        canReport: false,
        canShare: false,
      };
    default:
      return baseActions;
  }
}

// =============================================================================
// FULL USER PROFILE DATA
// =============================================================================

/**
 * Complete user profile data (stored in Firestore Users collection)
 */
export interface UserProfileData {
  // Core user fields
  uid: string;
  username: string;
  usernameLower: string;
  displayName: string;

  // Profile picture (replaces old avatarConfig for display)
  profilePicture: ProfilePicture;

  // Legacy avatar config (for fallback)
  avatarConfig: AvatarConfig;

  // Avatar decoration
  avatarDecoration: UserAvatarDecoration;

  // Bio
  bio: ProfileBio;

  // Status/Mood (optional)
  status?: ProfileStatus;

  // Game scores display
  gameScores: ProfileGameScoresConfig;

  // Theme configuration
  theme: UserThemeConfig;

  // Featured badges
  featuredBadges: FeaturedBadgesConfig;

  // Privacy settings
  privacy: ProfilePrivacySettings;

  // Owned items
  ownedDecorations: string[];
  ownedThemes: string[];

  // Metadata
  createdAt: number;
  lastActive: number;
  lastProfileUpdate: number;
  profileViews?: number;
  expoPushToken?: string;
}

/**
 * Default profile data for new users
 */
export const DEFAULT_USER_PROFILE_DATA: Omit<
  UserProfileData,
  | "uid"
  | "username"
  | "usernameLower"
  | "displayName"
  | "avatarConfig"
  | "createdAt"
  | "lastActive"
> = {
  profilePicture: {
    url: null,
    updatedAt: Date.now(),
  },
  avatarDecoration: {
    decorationId: null,
  },
  bio: {
    text: "",
    updatedAt: Date.now(),
  },
  gameScores: {
    enabled: false,
    displayedGames: [],
    updatedAt: Date.now(),
  },
  theme: {
    equippedThemeId: "default",
    updatedAt: Date.now(),
  },
  featuredBadges: {
    badgeIds: [],
    updatedAt: Date.now(),
  },
  privacy: DEFAULT_PRIVACY_SETTINGS,
  ownedDecorations: [],
  ownedThemes: ["default"],
  lastProfileUpdate: Date.now(),
};

// =============================================================================
// MUTE SETTINGS
// =============================================================================

/**
 * Mute configuration for a user
 */
export interface UserMuteConfig {
  mutedUserId: string;
  mutedAt: number;
  mutedUntil?: number; // undefined = indefinite
  reason?: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate days as friends
 */
export function calculateDaysAsFriends(friendsSince: number): number {
  const now = Date.now();
  const diff = now - friendsSince;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Format friendship duration as human-readable string
 */
export function formatFriendshipDuration(friendsSince: number): string {
  const days = calculateDaysAsFriends(friendsSince);

  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  if (days < 7) return `${days} days`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? "1 week" : `${weeks} weeks`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return months === 1 ? "1 month" : `${months} months`;
  }
  const years = Math.floor(days / 365);
  const remainingMonths = Math.floor((days % 365) / 30);
  if (remainingMonths === 0) {
    return years === 1 ? "1 year" : `${years} years`;
  }
  return years === 1
    ? `1 year, ${remainingMonths} months`
    : `${years} years, ${remainingMonths} months`;
}

/**
 * Get friendship details from a Friend object
 */
export function getFriendshipDetails(friendship: Friend): FriendshipDetails {
  const daysAsFriends = calculateDaysAsFriends(friendship.createdAt);
  const friendshipDuration = formatFriendshipDuration(friendship.createdAt);

  return {
    friendshipId: friendship.id,
    friendsSince: friendship.createdAt,
    streakCount: friendship.streakCount,
    streakUpdatedDay: friendship.streakUpdatedDay,
    daysAsFriends,
    friendshipDuration,
  };
}

/**
 * Check if a privacy setting allows viewing based on relationship
 */
export function canViewWithPrivacy(
  setting: PrivacyVisibility,
  relationship: ProfileRelationship,
): boolean {
  if (relationship.type === "self") return true;
  if (setting === "everyone") return true;
  if (setting === "friends" && relationship.type === "friend") return true;
  return false;
}

/**
 * Format last active time
 */
export function formatLastActive(lastActive: number): string {
  const now = Date.now();
  const diff = now - lastActive;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(lastActive).toLocaleDateString();
}

// =============================================================================
// BLOCK/REPORT/MUTE SYSTEM
// =============================================================================

/**
 * Block record stored in Firestore
 */
export interface UserBlock {
  /** ID of the user who did the blocking */
  blockerId: string;
  /** ID of the user who was blocked */
  blockedId: string;
  /** When the block occurred */
  blockedAt: number;
  /** Optional reason (for user's reference only) */
  reason?: string;
}

/**
 * Report categories for user reporting
 */
export type ReportCategory =
  | "harassment"
  | "spam"
  | "inappropriate_content"
  | "impersonation"
  | "scam"
  | "underage"
  | "hate_speech"
  | "threats"
  | "other";

/**
 * Report record stored in Firestore
 */
export interface UserReport {
  /** Unique report ID */
  id: string;
  /** User who submitted the report */
  reporterId: string;
  /** User being reported */
  reportedId: string;
  /** Category of the report */
  category: ReportCategory;
  /** Detailed description */
  description: string;
  /** Optional evidence URLs (screenshots, etc.) */
  evidenceUrls?: string[];
  /** When the report was submitted */
  createdAt: number;
  /** Report status for moderation */
  status: "pending" | "reviewed" | "action_taken" | "dismissed";
  /** Moderator notes (internal) */
  moderatorNotes?: string;
  /** When the report was reviewed */
  reviewedAt?: number;
  /** Which moderator reviewed it */
  reviewedBy?: string;
}

/**
 * Report category labels and descriptions
 */
export const REPORT_CATEGORIES: Record<
  ReportCategory,
  { label: string; description: string }
> = {
  harassment: {
    label: "Harassment",
    description: "Bullying, targeted abuse, or intimidation",
  },
  spam: {
    label: "Spam",
    description: "Unwanted or repetitive messages",
  },
  inappropriate_content: {
    label: "Inappropriate Content",
    description: "NSFW, explicit, or offensive content",
  },
  impersonation: {
    label: "Impersonation",
    description: "Pretending to be someone else",
  },
  scam: {
    label: "Scam/Fraud",
    description: "Attempting to deceive or defraud",
  },
  underage: {
    label: "Underage User",
    description: "User appears to be under 13 years old",
  },
  hate_speech: {
    label: "Hate Speech",
    description: "Discriminatory or hateful content",
  },
  threats: {
    label: "Threats",
    description: "Threats of violence or harm",
  },
  other: {
    label: "Other",
    description: "Something else not listed above",
  },
};

/**
 * Mute duration options (in milliseconds)
 */
export const MUTE_DURATION_OPTIONS = [
  { label: "1 hour", value: 60 * 60 * 1000 },
  { label: "8 hours", value: 8 * 60 * 60 * 1000 },
  { label: "24 hours", value: 24 * 60 * 60 * 1000 },
  { label: "1 week", value: 7 * 24 * 60 * 60 * 1000 },
  { label: "1 month", value: 30 * 24 * 60 * 60 * 1000 },
  { label: "Forever", value: null },
] as const;

/**
 * Extended mute configuration
 */
export interface ExtendedMuteConfig {
  /** ID of the user who muted */
  muterId: string;
  /** ID of the muted user */
  mutedId: string;
  /** When the mute was applied */
  mutedAt: number;
  /** When the mute expires (null = indefinite) */
  mutedUntil: number | null;
  /** What to mute */
  muteSettings: {
    /** Hide their posts/content */
    hideContent: boolean;
    /** Mute notifications from them */
    muteNotifications: boolean;
    /** Hide their status updates */
    hideStatus: boolean;
  };
  /** Reason for muting (user's reference) */
  reason?: string;
}

// =============================================================================
// STREAK MILESTONES
// =============================================================================

/**
 * Streak milestone definition
 */
export interface StreakMilestone {
  days: number;
  name: string;
  emoji: string;
  color: string;
}

/**
 * Streak milestones for special recognition
 */
export const STREAK_MILESTONES: StreakMilestone[] = [
  { days: 7, name: "Week Warriors", emoji: "⭐", color: "#F1C40F" },
  { days: 30, name: "Monthly Masters", emoji: "🔥", color: "#E74C3C" },
  { days: 100, name: "Century Club", emoji: "💯", color: "#9B59B6" },
  { days: 365, name: "Year of Friendship", emoji: "🏆", color: "#F39C12" },
  { days: 1000, name: "Legendary Bond", emoji: "👑", color: "#E91E63" },
];

/**
 * Get the highest achieved streak milestone for a streak count
 */
export function getStreakMilestone(count: number): StreakMilestone | undefined {
  return [...STREAK_MILESTONES].reverse().find((m) => count >= m.days);
}

/**
 * Get the next streak milestone to achieve
 */
export function getNextStreakMilestone(
  count: number,
): StreakMilestone | undefined {
  return STREAK_MILESTONES.find((m) => m.days > count);
}

/**
 * Calculate days until next milestone
 */
export function getDaysUntilNextMilestone(count: number): number | null {
  const next = getNextStreakMilestone(count);
  return next ? next.days - count : null;
}

// =============================================================================
// PRIVACY HELPER FUNCTIONS
// =============================================================================

/**
 * Apply privacy settings to profile data for viewing
 * Filters out fields the viewer shouldn't see based on privacy settings
 */
export function applyPrivacyFilters(
  profile: UserProfileData,
  relationship: ProfileRelationship,
): Partial<UserProfileData> {
  const privacy = profile.privacy;

  // Self always sees everything
  if (relationship.type === "self") {
    return profile;
  }

  // Blocked users see minimal profile
  if (
    relationship.type === "blocked_by_you" ||
    relationship.type === "blocked_by_them"
  ) {
    return {
      uid: profile.uid,
      username: profile.username,
      usernameLower: profile.usernameLower,
      displayName: profile.displayName,
      avatarConfig: profile.avatarConfig,
      createdAt: profile.createdAt,
      lastActive: 0,
    } as Partial<UserProfileData>;
  }

  const canView = (setting: PrivacyVisibility) =>
    canViewWithPrivacy(setting, relationship);

  const filtered: Partial<UserProfileData> = {
    uid: profile.uid,
    username: profile.username,
    usernameLower: profile.usernameLower,
    displayName: profile.displayName,
    avatarConfig: profile.avatarConfig,
    createdAt: profile.createdAt,
  };

  // Profile picture
  if (canView(privacy.showProfilePicture)) {
    filtered.profilePicture = profile.profilePicture;
  }

  // Avatar decoration (follows profile picture visibility)
  if (canView(privacy.showProfilePicture)) {
    filtered.avatarDecoration = profile.avatarDecoration;
  }

  // Bio
  if (canView(privacy.showBio)) {
    filtered.bio = profile.bio;
  }

  // Status
  if (canView(privacy.showStatus)) {
    filtered.status = profile.status;
  }

  // Game scores
  if (canView(privacy.showGameScores)) {
    filtered.gameScores = profile.gameScores;
  }

  // Badges
  if (canView(privacy.showBadges)) {
    filtered.featuredBadges = profile.featuredBadges;
  }

  // Theme (always visible for proper rendering)
  filtered.theme = profile.theme;

  // Last active
  if (canView(privacy.showLastActive)) {
    filtered.lastActive = profile.lastActive;
  }

  // Profile views
  if (privacy.trackProfileViews) {
    filtered.profileViews = profile.profileViews;
  }

  return filtered;
}

/**
 * Check if current user can send friend request to target
 */
export function canSendFriendRequest(
  targetPrivacy: ProfilePrivacySettings,
  relationship: ProfileRelationship,
): boolean {
  if (relationship.type !== "stranger") return false;
  return targetPrivacy.allowFriendRequests === "everyone";
}

/**
 * Check if current user can message target
 */
export function canSendMessage(
  targetPrivacy: ProfilePrivacySettings,
  relationship: ProfileRelationship,
): boolean {
  if (relationship.type === "blocked_by_you") return false;
  if (relationship.type === "blocked_by_them") return false;

  if (targetPrivacy.allowMessages === "everyone") return true;
  if (
    targetPrivacy.allowMessages === "friends" &&
    relationship.type === "friend"
  )
    return true;
  return false;
}

/**
 * Check if current user can call target
 */
export function canCallUser(
  targetPrivacy: ProfilePrivacySettings,
  relationship: ProfileRelationship,
): boolean {
  if (relationship.type === "blocked_by_you") return false;
  if (relationship.type === "blocked_by_them") return false;

  if (targetPrivacy.allowCalls === "everyone") return true;
  if (targetPrivacy.allowCalls === "friends" && relationship.type === "friend")
    return true;
  return false;
}

/**
 * Check if current user can send game invite to target
 */
export function canSendGameInvite(
  targetPrivacy: ProfilePrivacySettings,
  relationship: ProfileRelationship,
): boolean {
  if (relationship.type === "blocked_by_you") return false;
  if (relationship.type === "blocked_by_them") return false;

  if (targetPrivacy.allowGameInvites === "everyone") return true;
  if (
    targetPrivacy.allowGameInvites === "friends" &&
    relationship.type === "friend"
  )
    return true;
  return false;
}

/**
 * Check if status is expired
 */
export function isStatusExpired(status: ProfileStatus | null): boolean {
  if (!status) return true;
  if (!status.expiresAt) return false;
  return Date.now() > status.expiresAt;
}

/**
 * Check if anniversary is today
 */
export function isAnniversaryToday(friendsSince: number): boolean {
  const today = new Date();
  const friendshipDate = new Date(friendsSince);

  return (
    today.getMonth() === friendshipDate.getMonth() &&
    today.getDate() === friendshipDate.getDate() &&
    today.getFullYear() > friendshipDate.getFullYear()
  );
}

/**
 * Get days until next anniversary
 */
export function getDaysUntilAnniversary(friendsSince: number): number {
  const today = new Date();
  const friendshipDate = new Date(friendsSince);

  // Get this year's anniversary
  const thisYearAnniversary = new Date(
    today.getFullYear(),
    friendshipDate.getMonth(),
    friendshipDate.getDate(),
  );

  // If anniversary has passed this year, get next year's
  if (thisYearAnniversary < today) {
    thisYearAnniversary.setFullYear(thisYearAnniversary.getFullYear() + 1);
  }

  const diffTime = thisYearAnniversary.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
