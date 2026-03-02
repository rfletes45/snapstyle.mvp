/**
 * Profile Components Index
 */

// Profile Picture System
export {
  DecorationOverlay,
  InitialsAvatar,
  ProfilePicture,
  ProfilePictureEditor,
  ProfilePictureWithDecoration,
} from "./ProfilePicture";

export type {
  DecorationOverlayProps,
  InitialsAvatarProps,
  ProfilePictureEditorProps,
  ProfilePictureProps,
  ProfilePictureWithDecorationProps,
} from "./ProfilePicture";

// =============================================================================
// Phase 3 - New Profile Header Components
// =============================================================================
export { OwnProfileHeader, UserProfileHeader } from "./ProfileHeader";
export type {
  OwnProfileHeaderProps,
  UserProfileHeaderProps,
} from "./ProfileHeader";

// =============================================================================
// Profile Header Visual (Shared visual w/ background & preview support)
// =============================================================================
export { ProfileHeaderVisual } from "./ProfileHeaderVisual";
export type {
  HeaderPreviewOverrides,
  ProfileHeaderVisualProps,
} from "./ProfileHeaderVisual";

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
// Own Profile Quick Actions
// =============================================================================
export { ProfileActions } from "./ProfileQuickActions";
export type { ProfileActionsProps } from "./ProfileQuickActions";

// =============================================================================
// Profile Overview Cards
// =============================================================================
export { BadgesCard, FriendsCard, OverviewCard } from "./OverviewCards";
export type {
  BadgesCardProps,
  FriendsCardProps,
  OverviewCardProps,
} from "./OverviewCards";

// =============================================================================
// Social Proof
// =============================================================================
export { SocialProofSection } from "./SocialProof";
export type { SocialProofSectionProps } from "./SocialProof";

// =============================================================================
// Profile Overflow Menu
// =============================================================================
export { ProfileOverflowMenu } from "./ProfileOverflowMenu";
export type { ProfileOverflowMenuProps } from "./ProfileOverflowMenu";
