/**
 * Feature Flags
 *
 * Toggle experimental features on/off.
 * Set to `false` for production, `true` for testing.
 *
 * @module constants/featureFlags
 */

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
 * @default true
 */
export const USE_LOCAL_STORAGE = true;

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
 * Enable these progressively as each phase completes
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
// Shop Overhaul Feature Flags
// =============================================================================

/**
 * Shop overhaul feature flags
 * Enable these progressively as each phase completes
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

  /** Phase 7: Enable quick match FAB button */
  QUICK_MATCH_FAB: true,

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
// Digital Avatar Feature Flags
// =============================================================================

/**
 * Digital Avatar System feature flags
 * Enable these progressively as the avatar system rolls out
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md
 */
export const AVATAR_FEATURES = {
  // =========================================================================
  // Phase 7: Core Integration
  // =========================================================================

  /**
   * Enable digital avatar system
   *
   * When enabled:
   * - Avatar component uses new DigitalAvatar rendering
   * - Digital avatar config is used from user profile
   * - Falls back to legacy avatar if digital config not present
   *
   * When disabled:
   * - Uses legacy emoji-based avatar system
   * - No digital avatar features visible
   *
   * @default true - Enable after Phase 7 testing complete
   */
  DIGITAL_AVATAR_ENABLED: true,

  /**
   * Enable avatar customization screen
   *
   * When enabled:
   * - Shows "Customize Avatar" option in profile
   * - Allows full body/face/hair/accessory customization
   *
   * Requires DIGITAL_AVATAR_ENABLED to be true
   *
   * @default true - Enable after Phase 6 testing complete
   */
  AVATAR_CUSTOMIZER: true,

  /**
   * Enable avatar migration prompt
   *
   * When enabled:
   * - Shows migration prompt for users with legacy avatars
   * - Offers one-click migration to digital avatar
   *
   * @default false - Enable during migration rollout
   */
  AVATAR_MIGRATION_PROMPT: false,

  /**
   * Enable avatar idle animations
   *
   * When enabled:
   * - Avatars have subtle idle animations (blinking, breathing)
   * - Uses Reanimated for smooth 60fps animations
   *
   * Disable for performance issues or accessibility
   *
   * @default true
   */
  AVATAR_ANIMATIONS: true,

  /**
   * Enable avatar caching
   *
   * When enabled:
   * - Rendered avatars are cached in memory
   * - LRU eviction with TTL
   * - Reduces re-renders for unchanged avatars
   *
   * @default true
   */
  AVATAR_CACHING: true,

  // =========================================================================
  // Phase 8: Advanced Features
  // =========================================================================

  /**
   * Enable avatar presets
   *
   * When enabled:
   * - Quick-start presets in customizer
   * - "Randomize" button
   *
   * @default true
   */
  AVATAR_PRESETS: true,

  /**
   * Enable premium avatar items
   *
   * When enabled:
   * - Premium/locked accessories visible
   * - Integration with shop for purchases
   *
   * @default false - Enable with shop integration
   */
  PREMIUM_AVATAR_ITEMS: false,

  /**
   * Enable avatar expressions
   *
   * When enabled:
   * - Avatar can show different expressions (happy, sad, etc.)
   * - Expressions can be triggered by chat context
   *
   * @default false - Future feature
   */
  AVATAR_EXPRESSIONS: false,

  /**
   * Enable full-body avatar view
   *
   * When enabled:
   * - Profile shows full-body avatar
   * - Chat shows head-only avatar
   *
   * @default true
   */
  FULL_BODY_AVATAR: true,

  // =========================================================================
  // Phase 8: Rollout Features
  // =========================================================================

  /**
   * Enable percentage-based rollout
   *
   * When enabled:
   * - Uses user ID hashing for consistent bucketing
   * - Respects rollout percentage configuration
   *
   * When disabled:
   * - Uses static feature flags only
   *
   * @default true
   */
  PERCENTAGE_ROLLOUT_ENABLED: true,

  /**
   * Enable beta user program
   *
   * When enabled:
   * - Beta users always get new features
   * - Can be managed via addBetaUser/removeBetaUser
   *
   * @default true
   */
  BETA_USER_PROGRAM: true,

  /**
   * Enable What's New modal for avatar
   *
   * When enabled:
   * - Shows new feature highlights on first visit
   * - Can be viewed again from settings
   *
   * @default true
   */
  AVATAR_WHATS_NEW: true,

  /**
   * Enable avatar analytics tracking
   *
   * When enabled:
   * - Tracks render events, customizer usage
   * - Monitors adoption rate
   *
   * @default true
   */
  AVATAR_ANALYTICS: true,

  /**
   * Current rollout percentage for digital avatars
   *
   * This is the percentage of users who will get the digital avatar
   * based on consistent hashing of their user ID.
   *
   * Values: 0-100
   * - 0: Only beta users (internal testing)
   * - 5: Beta + 5% (beta phase)
   * - 10: Canary release
   * - 50: Gradual rollout
   * - 90: General availability
   * - 100: Full rollout
   *
   * @default 0 - Start with internal testing only
   */
  ROLLOUT_PERCENTAGE: 0,

  // =========================================================================
  // Debug Flags
  // =========================================================================

  /** Debug: Log avatar render events */
  DEBUG_AVATAR_RENDERING: __DEV__,

  /** Debug: Show avatar bounding boxes */
  DEBUG_AVATAR_BOUNDS: false,

  /** Debug: Show cache statistics */
  DEBUG_AVATAR_CACHE: __DEV__,

  /** Debug: Force legacy avatar (for comparison testing) */
  DEBUG_FORCE_LEGACY: false,

  /** Debug: Log rollout decisions */
  DEBUG_ROLLOUT: __DEV__,

  /** Debug: Simulate beta user status */
  DEBUG_FORCE_BETA: false,
} as const;
