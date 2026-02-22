import type { AvatarConfig } from "@/types/models";
import {
  DEFAULT_PRIVACY_SETTINGS,
  MOOD_CONFIG,
  type MoodType,
  type ProfilePrivacySettings,
  type UserProfileData,
} from "@/types/userProfile";

const DEFAULT_AVATAR_CONFIG: AvatarConfig = { baseColor: "#6366F1" };
const DEFAULT_THEME_ID = "default";
const VALID_PRIVACY_VISIBILITY = ["everyone", "friends", "nobody"] as const;
const VALID_MOODS = Object.keys(MOOD_CONFIG) as MoodType[];

const VISIBILITY_FIELDS: (keyof Pick<
  ProfilePrivacySettings,
  | "profileVisibility"
  | "showProfilePicture"
  | "showBio"
  | "showStatus"
  | "showGameScores"
  | "showBadges"
  | "showLastActive"
  | "showOnlineStatus"
  | "showFriendshipInfo"
  | "showFriendsList"
  | "allowFriendRequests"
  | "allowMessages"
  | "allowCalls"
  | "allowGameInvites"
>)[] = [
  "profileVisibility",
  "showProfilePicture",
  "showBio",
  "showStatus",
  "showGameScores",
  "showBadges",
  "showLastActive",
  "showOnlineStatus",
  "showFriendshipInfo",
  "showFriendsList",
  "allowFriendRequests",
  "allowMessages",
  "allowCalls",
  "allowGameInvites",
];

const BOOLEAN_FIELDS: (keyof Pick<
  ProfilePrivacySettings,
  | "showMutualFriends"
  | "showFriendCount"
  | "appearInSearch"
  | "allowProfileSharing"
  | "allowSuggestions"
  | "trackProfileViews"
>)[] = [
  "showMutualFriends",
  "showFriendCount",
  "appearInSearch",
  "allowProfileSharing",
  "allowSuggestions",
  "trackProfileViews",
];

function isValidPrivacyVisibility(value: unknown): boolean {
  return (
    typeof value === "string" &&
    (VALID_PRIVACY_VISIBILITY as readonly string[]).includes(value)
  );
}

export function validateDisplayName(displayName: string): string {
  const trimmed = displayName.trim();
  if (trimmed.length < 1 || trimmed.length > 50) {
    throw new Error("Display name must be 1-50 characters");
  }
  return trimmed;
}

export function validateBioText(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length > 200) {
    throw new Error("Bio must be 200 characters or less");
  }
  return trimmed;
}

export function validateStatusInput(
  text: string,
  mood: MoodType,
): { text: string; mood: MoodType } {
  const trimmed = text.trim();
  if (trimmed.length > 50) {
    throw new Error("Status must be 50 characters or less");
  }
  if (!VALID_MOODS.includes(mood)) {
    throw new Error("Invalid mood value");
  }
  return { text: trimmed, mood };
}

export function validateAvatarConfig(config: AvatarConfig): AvatarConfig {
  if (!config || typeof config !== "object") {
    throw new Error("Avatar config is required");
  }
  if (typeof config.baseColor !== "string" || config.baseColor.length === 0) {
    throw new Error("Avatar base color is required");
  }
  if (config.hat !== undefined && typeof config.hat !== "string") {
    throw new Error("Avatar hat must be a string");
  }
  if (config.glasses !== undefined && typeof config.glasses !== "string") {
    throw new Error("Avatar glasses must be a string");
  }
  if (
    config.background !== undefined &&
    typeof config.background !== "string"
  ) {
    throw new Error("Avatar background must be a string");
  }
  return config;
}

export function validateFullPrivacySettings(
  settings: ProfilePrivacySettings,
): void {
  for (const field of VISIBILITY_FIELDS) {
    if (!isValidPrivacyVisibility(settings[field])) {
      throw new Error(`Invalid value for ${field}`);
    }
  }

  for (const field of BOOLEAN_FIELDS) {
    if (typeof settings[field] !== "boolean") {
      throw new Error(`Invalid value for ${field}`);
    }
  }
}

export function hydrateProfileData(
  userId: string,
  source: Partial<UserProfileData>,
  now = Date.now(),
): UserProfileData {
  const privacy = source.privacy
    ? { ...DEFAULT_PRIVACY_SETTINGS, ...source.privacy }
    : { ...DEFAULT_PRIVACY_SETTINGS };

  return {
    uid: userId,
    username: source.username || "",
    usernameLower: source.usernameLower || "",
    displayName: source.displayName || "",
    avatarConfig: source.avatarConfig || DEFAULT_AVATAR_CONFIG,
    profilePicture: source.profilePicture || {
      url: null,
      updatedAt: now,
    },
    avatarDecoration: source.avatarDecoration || { decorationId: null },
    bio: source.bio || { text: "", updatedAt: now },
    status: source.status,
    gameScores: source.gameScores || {
      enabled: false,
      displayedGames: [],
      updatedAt: now,
    },
    theme: source.theme || {
      equippedThemeId: DEFAULT_THEME_ID,
      updatedAt: now,
    },
    featuredBadges: source.featuredBadges || {
      badgeIds: [],
      updatedAt: now,
    },
    privacy,
    equippedBackgroundId: source.equippedBackgroundId ?? null,
    ownedDecorations: source.ownedDecorations || [],
    ownedThemes: source.ownedThemes || [DEFAULT_THEME_ID],
    createdAt: source.createdAt || now,
    lastActive: source.lastActive || now,
    lastProfileUpdate: source.lastProfileUpdate || now,
    profileViews: source.profileViews,
    expoPushToken: source.expoPushToken,
  };
}
