/**
 * Profile Components Index
 */

// Profile Picture System
export {
  DecorationOverlay,
  DecorationPicker,
  DecorationPickerModal,
  InitialsAvatar,
  ProfilePicture,
  ProfilePictureEditor,
  ProfilePictureWithDecoration,
} from "./ProfilePicture";

export type {
  DecorationOverlayProps,
  DecorationPickerModalProps,
  DecorationPickerProps,
  InitialsAvatarProps,
  ProfilePictureEditorProps,
  ProfilePictureProps,
  ProfilePictureWithDecorationProps,
} from "./ProfilePicture";

// Friends Section
export { FriendsSection } from "./FriendsSection";
export type { FriendsSectionProps } from "./FriendsSection";

// =============================================================================
// Phase 3 - New Profile Header Components
// =============================================================================
export { OwnProfileHeader, UserProfileHeader } from "./ProfileHeader";
export type {
  OwnProfileHeaderProps,
  UserProfileHeaderProps,
} from "./ProfileHeader";

// =============================================================================
// Phase 3 - Profile Bio Components
// =============================================================================
export { ProfileBio, ProfileBioEditor, ProfileStatus } from "./ProfileBio";
export type {
  ProfileBioEditorProps,
  ProfileBioProps,
  ProfileStatusProps,
} from "./ProfileBio";

// =============================================================================
// Phase 3 - New Profile Actions Components
// =============================================================================
export { MoreOptionsMenu, ProfileActionsBar } from "./ProfileActions";
export type {
  MoreOptionsMenuProps,
  ProfileActionsBarProps,
} from "./ProfileActions";

// =============================================================================
// Shared Components
// =============================================================================
export { LevelProgress } from "./LevelProgress";
export type { LevelProgressProps } from "./LevelProgress";

export { ProfileStats } from "./ProfileStats";
export type { ProfileStatsProps } from "./ProfileStats";

// =============================================================================
// Phase 4 - Profile Theme Components
// =============================================================================
export {
  ProfileBackground,
  ProfileThemePicker,
  ThemePreview,
} from "./ProfileTheme";
export type {
  ProfileBackgroundProps,
  ProfileThemePickerProps,
  ThemePreviewProps,
} from "./ProfileTheme";

// =============================================================================
// Phase 5 - Game Scores Components
// =============================================================================
export {
  GameScoresDisplay,
  GameScoresEditor,
  ScoreComparisonView,
} from "./ProfileGameScores";
export type {
  GameScoresDisplayProps,
  GameScoresEditorProps,
  ScoreComparisonViewProps,
} from "./ProfileGameScores";

// =============================================================================
// Phase 5 - Skeletons & Loading States
// =============================================================================
export {
  BadgeDisplaySkeleton,
  FullProfileSkeleton,
  GameScoresSkeleton,
  PrivacySettingsSkeleton,
  ProfileBioSkeleton,
  ProfileHeaderSkeleton,
  SkeletonBox,
  ThemePreviewSkeleton,
} from "./ProfileSkeletons";

// =============================================================================
// Phase 5 - Animation Utilities
// =============================================================================
export {
  DURATIONS,
  PROFILE_ANIMATIONS,
  SPRING_CONFIGS,
  TIMING_CONFIGS,
  collapseHeight,
  enterFade,
  enterFadeDown,
  enterFadeLeft,
  enterFadeRight,
  enterFadeUp,
  enterSlideDown,
  enterSlideUp,
  enterZoom,
  exitFade,
  exitFadeDown,
  exitFadeLeft,
  exitFadeRight,
  exitFadeUp,
  exitSlideDown,
  exitZoom,
  layoutQuick,
  layoutSpring,
  pressedScale,
  springTo,
  staggeredFadeInRight,
  staggeredFadeInUp,
  staggeredZoomIn,
  timingTo,
  visibilityOpacity,
} from "./ProfileAnimations";

// =============================================================================
// Phase 6 - Status Picker
// =============================================================================
export { StatusPicker } from "./Status";
export type { StatusPickerProps } from "./Status";

// =============================================================================
// Phase 6 - Mutual Friends Components
// =============================================================================
export { MutualFriendsSection } from "./MutualFriends";
export type { MutualFriendsSectionProps } from "./MutualFriends";

// =============================================================================
// Phase 6 - Friendship Info Components
// =============================================================================
export { FriendshipInfoCard } from "./FriendshipInfo";
export type { FriendshipInfoCardProps } from "./FriendshipInfo";

// =============================================================================
// Phase 6 - Profile Sharing Components
// =============================================================================
export {
  QRCodeModal,
  ShareProfileButton,
  ShareProfileModal,
} from "./ProfileShare";
export type {
  QRCodeModalProps,
  ShareProfileButtonProps,
  ShareProfileModalProps,
} from "./ProfileShare";

// =============================================================================
// Phase 7 - Profile Moderation Components
// =============================================================================
export {
  MuteOptionsModal,
  MoreOptionsMenu as ProfileMoreOptionsMenu,
} from "./ProfileModeration";
export type {
  MuteOptionsModalProps,
  MuteSettings,
  MoreOptionsMenuProps as ProfileMoreOptionsMenuProps,
} from "./ProfileModeration";

// =============================================================================
// Legacy Components (Backward Compatibility)
// =============================================================================
export { ProfileHeader } from "./LegacyProfileHeader";
export type { ProfileHeaderProps } from "./LegacyProfileHeader";

export { ProfileActions } from "./LegacyProfileActions";
export type { ProfileActionsProps } from "./LegacyProfileActions";
