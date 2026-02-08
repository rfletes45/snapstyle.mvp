/**
 * Feature Flags
 *
 * Toggle experimental features on/off.
 * Set to `false` for production, `true` for testing.
 *
 * @module constants/featureFlags
 */

import { Platform } from "react-native";

// =============================================================================
// Platform Detection
// =============================================================================

/**
 * Check if running on web platform
 * Used to disable features that don't work on web (SQLite sync, native modules, etc.)
 */
const IS_WEB = Platform.OS === "web";

// =============================================================================
// Storage Features
// =============================================================================

/**
 * Enable SQLite-based local message storage
 *
 * When enabled:
 * - Messages are stored in SQLite first (instant)
 * - Background sync to Firestore
 * - Offline-first architecture
 *
 * When disabled:
 * - Uses legacy AsyncStorage outbox
 * - Falls back to original chatV2 implementation
 *
 * Set to `false` to rollback to old behavior if issues occur.
 *
 * NOTE: Disabled on web platform because expo-sqlite's synchronous operations
 * require SharedArrayBuffer, which needs COOP/COEP headers that are not
 * available in Expo's dev server or most hosting environments.
 *
 * @default true (native), false (web)
 */
export const USE_LOCAL_STORAGE = !IS_WEB;

// =============================================================================
// Debug Features
// =============================================================================

/**
 * Log V2 message events to console
 */
export const DEBUG_CHAT_V2 = __DEV__;

/**
 * Show V2 badge in chat header (for testing)
 */
export const SHOW_V2_BADGE = __DEV__;

/**
 * Log keyboard/composer/autoscroll events to console
 * Enables detailed logging for keyboard behavior debugging
 */
export const DEBUG_CHAT_KEYBOARD = __DEV__;

/**
 * Debug logging for unified messaging
 *
 * Logs adapter conversions, subscription events, outbox operations.
 *
 * @default __DEV__
 */
export const DEBUG_UNIFIED_MESSAGING = __DEV__;

// =============================================================================
// Profile Overhaul Feature Flags
// =============================================================================

/**
 * Profile overhaul feature flags
 *
 * @graduated All phases complete — every flag is permanently `true`.
 * Conditional checks can be safely inlined (remove the `if` and keep
 * the body). Left as flags only for quick rollback during hotfixes.
 *
 * @see docs/PROFILE_SCREEN_OVERHAUL_PLAN.md
 */
export const PROFILE_FEATURES = {
  /** Phase 1: Extended avatar config with new slots */
  EXTENDED_AVATAR_CONFIG: true,

  /** Phase 2: Badge system - display earned badges */
  BADGE_SYSTEM: true,

  /** Phase 2: Badge showcase on profile */
  BADGE_SHOWCASE: true,

  /** Phase 3: New profile layout with stats */
  NEW_PROFILE_LAYOUT: true,

  /** Phase 3: Profile statistics dashboard */
  PROFILE_STATS: true,

  /** Phase 3: XP-based level system */
  LEVEL_SYSTEM: true,

  /** Phase 4: Extended cosmetics (clothing, accessories) */
  EXTENDED_COSMETICS: true,

  /** Phase 4: Profile frames around avatars */
  PROFILE_FRAMES: true,

  /** Phase 5: Profile theme customization */
  PROFILE_THEMES: true,

  /** Phase 5: Custom chat bubble styles */
  CHAT_BUBBLES: true,

  /** Phase 5: Game scores display on profile */
  GAME_SCORES: true,

  /** Phase 5: Privacy settings */
  PRIVACY_SETTINGS: true,

  /** Phase 6: In-app purchases for cosmetics */
  COSMETIC_IAP: true,

  // =========================================================================
  // Phase 7: Polish & Performance
  // =========================================================================

  /** Phase 7: Profile data caching */
  PROFILE_CACHING: true,

  /** Phase 7: Loading skeleton animations */
  LOADING_SKELETONS: true,

  /** Phase 7: Badge earn celebration animation */
  BADGE_EARN_ANIMATION: true,

  /** Phase 7: Level up celebration animation */
  LEVEL_UP_ANIMATION: true,

  /** Phase 7: Optimized list rendering (FlashList) */
  OPTIMIZED_LISTS: true,

  /** Phase 7: Debug animation timing */
  DEBUG_ANIMATIONS: __DEV__,
} as const;

// =============================================================================
// New Profile System Feature Flags (Profile V2)
// =============================================================================

/**
 * New Profile System feature flags
 * Controls rollout of the comprehensive profile overhaul
 *
 * @see docs/NEW_PROFILE_SYSTEM_PLAN.md
 */
export const PROFILE_V2_FEATURES = {
  // =========================================================================
  // Phase 1: Foundation
  // =========================================================================

  /** Enable new profile picture system (custom upload) */
  PROFILE_PICTURE_UPLOAD: true,

  /** Enable avatar decorations (320x320 overlays) */
  AVATAR_DECORATIONS: true,

  /** Enable comprehensive privacy settings */
  PRIVACY_SETTINGS: true,

  /** Enable new profile types and data structure */
  NEW_PROFILE_DATA: true,

  // =========================================================================
  // Phase 2: Profile Picture & Decorations
  // =========================================================================

  /** Show decoration picker in profile edit */
  DECORATION_PICKER: true,

  /** Enable decoration animations (GIFs) */
  ANIMATED_DECORATIONS: true,

  /** Enable decoration preview before equipping */
  DECORATION_PREVIEW: true,

  // =========================================================================
  // Phase 3: Profile Screens
  // =========================================================================

  /** Enable new OwnProfileScreen (replaces current) */
  OWN_PROFILE_SCREEN: true,

  /** Enable new UserProfileScreen (view others) */
  USER_PROFILE_SCREEN: true,

  /** Enable profile navigation from all entry points */
  NEW_PROFILE_NAVIGATION: true,

  // =========================================================================
  // Phase 4: Themes & Backgrounds
  // =========================================================================

  /** Enable profile theme background customization */
  PROFILE_THEMES_V2: true,

  /** Enable theme inheritance (view in their theme) */
  THEME_INHERITANCE: true,

  /** Enable custom background upload (premium) */
  CUSTOM_BACKGROUNDS: false,

  // =========================================================================
  // Phase 5: Game Scores & Polish
  // =========================================================================

  /** Enable game scores display on profile */
  GAME_SCORES_DISPLAY: false,

  /** Enable score comparison with viewer */
  SCORE_COMPARISON: false,

  /** Enable profile animations and transitions */
  PROFILE_ANIMATIONS: false,

  // =========================================================================
  // Phase 6: Advanced Features
  // =========================================================================

  /** Enable status/mood indicator */
  PROFILE_STATUS: true,

  /** Enable mutual friends display */
  MUTUAL_FRIENDS: true,

  /** Enable profile sharing (link, QR) */
  PROFILE_SHARING: true,

  /** Enable friendship info (duration, streak) */
  FRIENDSHIP_INFO: true,

  // =========================================================================
  // Phase 7: Block/Report/Mute & DM Migration
  // =========================================================================

  /** Enable block/report/mute from profile */
  PROFILE_MODERATION: true,

  /** Navigate to UserProfileScreen from DM context menu */
  DM_PROFILE_NAVIGATION: true,

  /** Show profile view counter */
  PROFILE_VIEW_COUNTER: false,

  // =========================================================================
  // Debug Flags
  // =========================================================================

  /** Log profile system events */
  DEBUG_PROFILE: __DEV__,

  /** Show feature flag badges in UI */
  SHOW_FEATURE_BADGES: __DEV__,
} as const;

// =============================================================================
// Shop Overhaul Feature Flags
// =============================================================================

/**
 * Shop overhaul feature flags
 *
 * @graduated All phases complete — every flag is permanently `true`.
 * Conditional checks can be safely inlined. Left as flags only
 * for quick rollback during hotfixes.
 *
 * @see docs/SHOP_OVERHAUL_PLAN.md
 */
export const SHOP_FEATURES = {
  // =========================================================================
  // Phase 1: Foundation
  // =========================================================================

  /** Phase 1: Enable new shop hub navigation */
  SHOP_HUB: true,

  /** Phase 1: Points shop catalog (token-based purchases) */
  POINTS_SHOP: true,

  /** Phase 1: Premium shop catalog (IAP purchases) */
  PREMIUM_SHOP: true,

  // =========================================================================
  // Phase 2: Points Shop
  // =========================================================================

  /** Phase 2: Points shop item categories (hats, glasses, etc.) */
  POINTS_SHOP_CATEGORIES: true,

  /** Phase 2: Points shop search functionality */
  POINTS_SHOP_SEARCH: true,

  /** Phase 2: Points shop filtering */
  POINTS_SHOP_FILTERS: true,

  /** Phase 2: New item badges in shop */
  NEW_ITEM_BADGES: true,

  /** Phase 2: Featured items carousel */
  FEATURED_ITEMS: true,

  /** Phase 2: Purchase confirmation modal */
  PURCHASE_CONFIRMATION: true,

  // =========================================================================
  // Phase 3: Premium Shop
  // =========================================================================

  /** Phase 3: In-App Purchase integration (requires native setup) */
  IAP_ENABLED: true,

  /** Phase 3: Mock IAP for development testing */
  MOCK_IAP: __DEV__,

  /** Phase 3: Token pack purchases */
  TOKEN_PACKS: true,

  /** Phase 3: Premium bundles */
  PREMIUM_BUNDLES: true,

  /** Phase 3: Premium-exclusive items */
  PREMIUM_EXCLUSIVES: true,

  /** Phase 3: Gifting items to friends */
  GIFTING: true,

  /** Phase 3: Purchase receipt validation */
  RECEIPT_VALIDATION: true,

  // =========================================================================
  // Phase 4: Enhancement & Polish
  // =========================================================================

  /** Phase 4: Wishlist functionality */
  WISHLIST: true,

  /** Phase 4: Daily deals rotation */
  DAILY_DEALS: true,

  /** Phase 4: Limited-time promotions */
  PROMOTIONS: true,

  /** Phase 4: Purchase history screen */
  PURCHASE_HISTORY: true,

  /** Phase 4: Shop item preview/try-on */
  ITEM_PREVIEW: true,

  /** Phase 4: Shop analytics tracking */
  SHOP_ANALYTICS: true,

  /** Phase 4: Purchase celebration animations */
  PURCHASE_ANIMATIONS: true,

  /** Phase 4: Push notifications for deals */
  DEAL_NOTIFICATIONS: true,

  // =========================================================================
  // Debug Flags
  // =========================================================================

  /** Debug: Log shop events to console */
  DEBUG_SHOP: __DEV__,

  /** Debug: Show IAP test interface */
  DEBUG_IAP: __DEV__,
} as const;

// =============================================================================
// Play Screen Overhaul Feature Flags
// =============================================================================

/**
 * Play screen overhaul feature flags
 * Enable these progressively as each phase completes
 *
 * @see docs/PLAY_SCREEN_OVERHAUL_PLAN.md
 */
export const PLAY_SCREEN_FEATURES = {
  // =========================================================================
  // Phase 1: Header & Navigation Redesign
  // =========================================================================

  /** Phase 1: Enable new play screen header with icon buttons */
  NEW_HEADER: true,

  /** Phase 1: Enable search bar (UI only, no logic) */
  SEARCH_BAR: true,

  // =========================================================================
  // Phase 2: Search & Discovery
  // =========================================================================

  /** Phase 2: Enable search functionality */
  SEARCH_LOGIC: true,

  /** Phase 2: Enable filter chips */
  FILTER_CHIPS: true,

  /** Phase 2: Enable modern game cards */
  MODERN_CARDS: true,

  /** Phase 2: Enable carousel tiles */
  CAROUSEL_TILES: true,

  // =========================================================================
  // Phase 3: Game Card Redesign
  // =========================================================================

  /** Phase 3: Use ModernGameCard in CategorySection (replaces legacy GameCard) */
  CATEGORY_MODERN_CARDS: true,

  /** Phase 3: Show personal best on cards */
  CARD_PERSONAL_BEST: true,

  /** Phase 3: Enable play button on game cards */
  CARD_PLAY_BUTTON: true,

  /** Phase 3: Show compact variant in browse mode */
  COMPACT_BROWSE_CARDS: false,

  // =========================================================================
  // Phase 4: Category & Browse Experience
  // =========================================================================

  /** Phase 4: Enable category carousels */
  CATEGORY_CAROUSELS: true,

  /** Phase 4: Enable featured games banner */
  FEATURED_BANNER: true,

  // =========================================================================
  // Phase 5: Game Invites Section
  // =========================================================================

  /** Phase 5: Enable dedicated invites banner */
  INVITES_BANNER: true,

  // =========================================================================
  // Phase 6: Active Games Redesign
  // =========================================================================

  /** Phase 6: Enable compact active games mini section */
  ACTIVE_GAMES_MINI: true,

  /** Phase 6: Remove recent games section */
  REMOVE_RECENT_GAMES: true,

  // =========================================================================
  // Phase 7: Additional Features
  // =========================================================================

  /** Phase 7: Enable weekly game stats summary card */
  GAME_STATS_SUMMARY: true,

  /** Phase 7: Enable friends playing now section */
  FRIENDS_PLAYING_NOW: true,

  /** Phase 7: Enable game recommendations carousel */
  GAME_RECOMMENDATIONS: true,

  // =========================================================================
  // Debug Flags
  // =========================================================================

  /** Debug: Log play screen events to console */
  DEBUG_PLAY_SCREEN: __DEV__,
} as const;

// =============================================================================
// Video Calling Feature Flags
// =============================================================================

/**
 * Video calling feature flags
 * Enable these progressively as each phase completes
 *
 * @see docs/VIDEO_CALL_IMPLEMENTATION_PLAN.md
 */
export const CALL_FEATURES = {
  // =========================================================================
  // Phase 1: Foundation (1:1 Audio Calls)
  // =========================================================================

  /**
   * Master switch for calling feature
   *
   * When enabled:
   * - Call buttons appear in DM chat headers
   * - Users can initiate and receive calls
   * - Call history is tracked
   *
   * @default false - Enable after Phase 1 testing
   */
  CALLS_ENABLED: false,

  /**
   * Enable audio-only calls
   * Requires CALLS_ENABLED to be true
   *
   * @default false
   */
  AUDIO_CALLS_ENABLED: false,

  // =========================================================================
  // Phase 2: Video & Native Integration
  // =========================================================================

  /**
   * Enable video calls
   * Requires CALLS_ENABLED to be true
   *
   * @default false - Enable after Phase 2 testing
   */
  VIDEO_CALLS_ENABLED: false,

  /**
   * Enable CallKeep integration for native call UI
   * iOS: CallKit integration
   * Android: ConnectionService integration
   *
   * @default false
   */
  NATIVE_CALL_UI_ENABLED: false,

  /**
   * Enable background audio during calls
   * Allows calls to continue when app is minimized
   *
   * @default false
   */
  BACKGROUND_CALLS_ENABLED: false,

  // =========================================================================
  // Phase 3: Group Calls
  // =========================================================================

  /**
   * Enable group audio/video calls
   * Requires CALLS_ENABLED to be true
   * Max 8 participants
   *
   * @default false - Enable after Phase 3 testing
   */
  GROUP_CALLS_ENABLED: false,

  /**
   * Enable host controls for group calls
   * Includes: mute all, remove participant, pin video
   *
   * @default false
   */
  HOST_CONTROLS_ENABLED: false,

  /**
   * Enable adaptive bitrate for video calls
   * Automatically adjusts quality based on network
   *
   * @default true
   */
  ADAPTIVE_BITRATE_ENABLED: true,

  // =========================================================================
  // Phase 4: Polish & Launch
  // =========================================================================

  /**
   * Enable call history screen
   * Shows recent calls with filtering and stats
   *
   * @default false
   */
  CALL_HISTORY_ENABLED: false,

  /**
   * Enable call settings screen
   * Camera, audio, ringtone, DND, privacy settings
   *
   * @default false
   */
  CALL_SETTINGS_ENABLED: false,

  /**
   * Enable call quality analytics
   * Tracks metrics, issues, and user feedback
   *
   * @default true
   */
  CALL_ANALYTICS_ENABLED: true,

  /**
   * Show missed calls badge in tab bar
   *
   * @default false
   */
  MISSED_CALL_BADGE_ENABLED: false,

  /**
   * Enable call quality indicator during calls
   *
   * @default true
   */
  QUALITY_INDICATOR_ENABLED: true,

  // =========================================================================
  // Future Features
  // =========================================================================

  /**
   * Enable screen sharing during calls
   * Future feature - not yet implemented
   *
   * @default false
   */
  SCREEN_SHARING_ENABLED: false,

  /**
   * Enable call recording
   * Future feature - requires additional permissions
   *
   * @default false
   */
  CALL_RECORDING_ENABLED: false,

  /**
   * Enable in-call games
   * Future feature - games during video calls
   *
   * @default false
   */
  IN_CALL_GAMES_ENABLED: false,

  // =========================================================================
  // Rollout Configuration
  // =========================================================================

  /**
   * Enable percentage-based rollout for calls
   *
   * When enabled:
   * - Uses user ID hashing for consistent bucketing
   * - Respects CALL_ROLLOUT_PERCENTAGE
   *
   * @default true
   */
  PERCENTAGE_ROLLOUT_ENABLED: true,

  /**
   * Rollout percentage for calling feature
   *
   * Values: 0-100
   * - 0: Only beta users (internal testing)
   * - 5: Beta + 5% (beta phase)
   * - 25: Canary release
   * - 50: Gradual rollout
   * - 100: Full rollout
   *
   * @default 0 - Start with internal testing only
   */
  ROLLOUT_PERCENTAGE: 0,

  // =========================================================================
  // Debug Flags
  // =========================================================================

  /** Debug: Log call events to console */
  DEBUG_CALLS: __DEV__,

  /** Debug: Log WebRTC events */
  DEBUG_WEBRTC: __DEV__,

  /** Debug: Log signaling messages */
  DEBUG_SIGNALING: __DEV__,

  /** Debug: Force call quality issues for testing */
  DEBUG_FORCE_POOR_QUALITY: false,

  /** Debug: Skip permission checks */
  DEBUG_SKIP_PERMISSIONS: false,

  /** Debug: Show call state overlay */
  DEBUG_CALL_STATE_OVERLAY: __DEV__,
} as const;
