/**
 * UI Components Index
 *
 * State Components:
 * - LoadingState: Full-screen loading indicator
 * - EmptyState: Empty list/content placeholder
 * - ErrorState: Error display with retry action
 *
 * Indicators:
 * - PresenceIndicator: Online/offline status dot
 *
 * Buttons:
 * - HeaderIconButton: Icon button for headers with badge support
 *
 * Skeletons (Phase 7):
 * - Skeleton: Base skeleton with shimmer animation
 * - SkeletonGroup: Multiple skeletons in a row/column
 * - AvatarSkeleton: Circular avatar placeholder
 * - TextSkeleton: Text line placeholder
 * - BadgeSkeleton: Badge placeholder
 * - CardSkeleton: Card with avatar/text placeholder
 * - StatSkeleton: Stat number + label placeholder
 * - ProfileSkeleton: Full profile screen skeleton
 * - CompactProfileSkeleton: Inline profile skeleton
 * - BadgeShowcaseSkeleton: Badge showcase skeleton
 * - ShopSkeleton: Cosmetic shop skeleton
 */

export { default as EmptyState } from "./EmptyState";
export { default as ErrorState } from "./ErrorState";
export { default as LoadingState } from "./LoadingState";
export { PresenceIndicator } from "./PresenceIndicator";

// Header Components
export { HeaderIconButton } from "./HeaderIconButton";

// Skeleton Components (Phase 7)
export {
  AvatarSkeleton,
  BadgeSkeleton,
  CardSkeleton,
  default as Skeleton,
  SkeletonGroup,
  StatSkeleton,
  TextSkeleton,
} from "./SkeletonLoader";

export {
  BadgeShowcaseSkeleton,
  CompactProfileSkeleton,
  default as ProfileSkeleton,
  ShopSkeleton,
} from "./ProfileSkeleton";
