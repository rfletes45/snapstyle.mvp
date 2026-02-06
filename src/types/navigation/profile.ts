/**
 * Profile Navigation Types
 *
 * Type definitions for profile-related navigation screens and their parameters.
 *
 * @module types/navigation/profile
 */

import type { NativeStackScreenProps } from "@react-navigation/native-stack";

// =============================================================================
// Profile Stack Param List
// =============================================================================

/**
 * Profile stack navigator params
 */
export type ProfileStackParamList = {
  /** Current user's own profile (editable) */
  OwnProfile: undefined;
  /** View another user's profile */
  UserProfile: { userId: string };
  /** Badge collection screen */
  BadgeCollection: undefined;
  /** Decoration selector screen */
  DecorationSelector: undefined;
  /** Theme selector screen */
  ThemeSelector: undefined;
  /** Edit bio screen */
  EditBio: undefined;
  /** Set status screen */
  SetStatus: undefined;
  /** Edit game scores display */
  EditGameScores: undefined;
  /** Profile settings */
  ProfileSettings: undefined;
  /** Privacy settings */
  PrivacySettings: undefined;
  /** Mutual friends list */
  MutualFriendsList: { userId: string; targetUserId: string };
};

// =============================================================================
// Screen Props Types
// =============================================================================

export type OwnProfileScreenProps = NativeStackScreenProps<
  ProfileStackParamList,
  "OwnProfile"
>;

export type UserProfileScreenProps = NativeStackScreenProps<
  ProfileStackParamList,
  "UserProfile"
>;

export type BadgeCollectionScreenProps = NativeStackScreenProps<
  ProfileStackParamList,
  "BadgeCollection"
>;

export type DecorationSelectorScreenProps = NativeStackScreenProps<
  ProfileStackParamList,
  "DecorationSelector"
>;

export type ThemeSelectorScreenProps = NativeStackScreenProps<
  ProfileStackParamList,
  "ThemeSelector"
>;

export type EditBioScreenProps = NativeStackScreenProps<
  ProfileStackParamList,
  "EditBio"
>;

export type SetStatusScreenProps = NativeStackScreenProps<
  ProfileStackParamList,
  "SetStatus"
>;

export type EditGameScoresScreenProps = NativeStackScreenProps<
  ProfileStackParamList,
  "EditGameScores"
>;

export type ProfileSettingsScreenProps = NativeStackScreenProps<
  ProfileStackParamList,
  "ProfileSettings"
>;

export type PrivacySettingsScreenProps = NativeStackScreenProps<
  ProfileStackParamList,
  "PrivacySettings"
>;

export type MutualFriendsListScreenProps = NativeStackScreenProps<
  ProfileStackParamList,
  "MutualFriendsList"
>;

// =============================================================================
// Main Stack Additions
// =============================================================================

/**
 * Additional params for the main stack related to profiles
 */
export type MainStackProfileParams = {
  /** View another user's profile from anywhere in the app */
  UserProfile: { userId: string };
};
