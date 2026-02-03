/**
 * Hooks Index
 *
 * Exports:
 * - useChat: Unified chat hook (ARCH-D02) - composes all chat functionality
 * - useUnifiedMessages: Unified message subscription (ARCH-D01)
 * - useLocalMessages: SQLite-based local message access (Phase 5)
 * - useChatComposer: Chat composer state management (ARCH-D03)
 * - useUnifiedChatScreen: Screen-ready hook that composes useChat + useChatComposer (UNI-04)
 * - useSnapCapture: Snap/photo capture and upload hook (UNI-05)
 * - useMessagesV2: @deprecated - Use useChat or useLocalMessages instead
 * - useUnreadCount: Unread count calculation
 * - useMentionAutocomplete: @mention autocomplete state management
 * - useAttachmentPicker: Multi-attachment selection and upload management
 * - useVoiceRecorder: Voice message recording with expo-audio
 * - useOutboxProcessor: Outbox message processing
 * - useInboxData: Combined inbox data hook for DMs and Groups
 * - useConversationActions: Action handlers for inbox items
 * - useFriendRequests: Friend requests subscription with actions
 */

// =============================================================================
// Local Storage Hooks (Phase 5 - SQLite-first)
// =============================================================================

export {
  useFailedMessages,
  useLocalMessages,
  usePendingMessages,
} from "./useLocalMessages";
export type {
  UseLocalMessagesOptions,
  UseLocalMessagesReturn,
} from "./useLocalMessages";

// =============================================================================
// Unified Chat Hooks (Phase D)
// =============================================================================

export { useChat, default as useChatDefault } from "./useChat";
export type {
  SendMessageOptions,
  UseChatConfig,
  UseChatReturn,
} from "./useChat";

export { useUnifiedMessages } from "./useUnifiedMessages";
export type {
  UseUnifiedMessagesOptions,
  UseUnifiedMessagesReturn,
} from "./useUnifiedMessages";

export { useChatComposer } from "./useChatComposer";
export type {
  ComposerSendOptions,
  UseChatComposerConfig,
  UseChatComposerReturn,
} from "./useChatComposer";

export { useUnifiedChatScreen } from "./useUnifiedChatScreen";
export type {
  UseUnifiedChatScreenConfig,
  UseUnifiedChatScreenReturn,
} from "./useUnifiedChatScreen";

export { useSnapCapture } from "./useSnapCapture";
export type {} from "./useSnapCapture";

export { useTypingStatus } from "./useTypingStatus";
export type {} from "./useTypingStatus";

export { usePresence } from "./usePresence";
export type {} from "./usePresence";

export { useReadReceipts } from "./useReadReceipts";
export type {} from "./useReadReceipts";

export { useHighlightedMessage } from "./useHighlightedMessage";

// =============================================================================
// Legacy Hooks (Deprecated)
// =============================================================================

/** @deprecated Use useChat or useLocalMessages instead */
export { useMessagesV2, useUnreadCount } from "./useMessagesV2";

// =============================================================================
// Feature-Specific Hooks
// =============================================================================

export { useMentionAutocomplete } from "./useMentionAutocomplete";
export type {
  UseMentionAutocompleteOptions,
  UseMentionAutocompleteReturn,
} from "./useMentionAutocomplete";

export { useAttachmentPicker } from "./useAttachmentPicker";
export type {
  UseAttachmentPickerOptions,
  UseAttachmentPickerReturn,
} from "./useAttachmentPicker";

export { useVoiceRecorder } from "./useVoiceRecorder";
export type {
  UseVoiceRecorderOptions,
  UseVoiceRecorderReturn,
  VoiceRecording,
} from "./useVoiceRecorder";

export { useOutboxProcessor } from "./useOutboxProcessor";

// Inbox Overhaul hooks
export { useInboxData, useInboxUnreadCount } from "./useInboxData";
export type {
  InboxFilter,
  InboxSort,
  UseInboxDataResult,
} from "./useInboxData";

export { useConversationActions } from "./useConversationActions";
export type {
  MuteDuration,
  UseConversationActionsOptions,
  UseConversationActionsResult,
} from "./useConversationActions";

export { useFriendRequests } from "./useFriendRequests";
export type {
  FriendRequestWithUser,
  UseFriendRequestsResult,
} from "./useFriendRequests";

export { useGameLoop, useGameTick, usePerformanceMonitor } from "./useGameLoop";
export type { GameFrameCallback, UseGameLoopReturn } from "./useGameLoop";

export {
  useGameAchievements,
  useGameOverAchievements,
  useMultiplayerAchievements,
} from "./useGameAchievements";

export { useGameHaptics } from "./useGameHaptics";
export type { HapticFeedbackType } from "./useGameHaptics";

export { useGameSounds } from "./useGameSounds";
export type { GameSoundType, GameSoundsConfig } from "./useGameSounds";

// =============================================================================
// Game Navigation Hook (Phase 6)
// =============================================================================

export { useGameNavigation } from "./useGameNavigation";
export type {
  UseGameNavigationOptions,
  UseGameNavigationReturn,
} from "./useGameNavigation";

// =============================================================================
// Game Completion Hook (Phase 6 & 7 Integration)
// =============================================================================

export { useGameCompletion } from "./useGameCompletion";
export type {
  GameCompletionResult,
  UseGameCompletionOptions,
  UseGameCompletionReturn,
} from "./useGameCompletion";

// =============================================================================
// Badge System Hook (Profile Overhaul Phase 2)
// =============================================================================

export { useBadges } from "./useBadges";

// =============================================================================
// Profile Data Hook (Profile Overhaul Phase 3)
// =============================================================================

export { useProfileData } from "./useProfileData";

// =============================================================================
// Customization Hook (Profile Overhaul Phase 4)
// =============================================================================

export { useCustomization } from "./useCustomization";
export type {
  UseCustomizationConfig,
  UseCustomizationReturn,
} from "./useCustomization";

// =============================================================================
// Animation Hooks (Profile Overhaul Phase 7)
// =============================================================================

export {
  useAnimatedValue,
  useAnimationQueue,
  useBadgeEarnAnimation,
  useLevelUpAnimation,
  useProfileAnimations,
} from "./useAnimations";
export type {
  AnimationQueueItem,
  BadgeEarnAnimationState,
  LevelUpAnimationState,
  ProfileAnimationsState,
} from "./useAnimations";

// =============================================================================
// Shop Hooks (Shop Overhaul Phase 2)
// =============================================================================

export { usePointsShop } from "./usePointsShop";
export type { UsePointsShopReturn } from "./usePointsShop";

// Premium Shop Hooks (Shop Overhaul Phase 3)
// =============================================================================

export { usePremiumShop } from "./usePremiumShop";
export type { UsePremiumShopReturn } from "./usePremiumShop";

// =============================================================================
// Phase 4: Additional Shop Features
// =============================================================================

export { useWishlist } from "./useWishlist";
export type { UseWishlistReturn } from "./useWishlist";

export {
  getPerspective,
  getPreviewImageUrl,
  getRotationTransform,
  useItemPreview,
} from "./useItemPreview";
export type {
  ItemPreviewState,
  ItemVariation,
  UseItemPreviewReturn,
} from "./useItemPreview";

// =============================================================================
// Avatar Customization Hook (Digital Avatar System Phase 6)
// =============================================================================

export { useAvatarCustomization } from "./useAvatarCustomization";
export type {
  UseAvatarCustomizationOptions,
  UseAvatarCustomizationReturn,
  ValidationResult,
} from "./useAvatarCustomization";

// =============================================================================
// Avatar Rollout Hooks (Digital Avatar System Phase 8)
// =============================================================================

export {
  AvatarRolloutProvider,
  useAvatarRollout,
  useAvatarRolloutContext,
  useIsCustomizerEnabled,
  useIsDigitalAvatarEnabled,
  useNeedsMigration,
} from "./useAvatarRollout";
export type {
  AvatarRolloutState,
  UseAvatarRolloutReturn,
} from "./useAvatarRollout";
