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
// Camera Backend
// =============================================================================

/**
 * Use VisionCamera (react-native-vision-camera) as the camera backend.
 *
 * When `true`  → VisionCamera + Skia frame processors (pixel-perfect live
 *                filter preview, full GPU pipeline).  Requires a custom dev
 *                client or production build — does NOT work inside Expo Go.
 *
 * When `false` → expo-camera CameraView fallback with the simpler
 *                CameraFilterOverlay tint.  Works inside Expo Go for
 *                development & testing.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * TODO(launch): flip to `true` and remove expo-camera from package.json
 *               once we ship via EAS builds only.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * @default false — safe for Expo Go during development
 */
export const USE_VISION_CAMERA = false;

// =============================================================================
// Daily Games
// =============================================================================

/**
 * List of game types that are considered "daily" challenges.
 *
 * Daily games:
 * - Save progress when the user leaves mid-game
 * - Prevent replay after a win or loss until the word/puzzle resets
 * - Skip the "leave game?" confirmation dialog
 */
export const DAILY_GAMES: string[] = ["word_master"];

// =============================================================================
// Debug Features
// =============================================================================

/**
 * Show Mini-Golf debug overlay with wall segment centers,
 * corner plugs, cup radius, tee marker, and bounds rectangle.
 * Dev-only — renders as a transparent overlay on top of the game canvas.
 */
export const DEBUG_MINIGOLF_OVERLAY = __DEV__;

/**
 * Log V2 message events to console
 */
export const DEBUG_CHAT_V2 = __DEV__;

/**
 * Debug logging for unified messaging
 *
 * Logs adapter conversions, subscription events, outbox operations.
 *
 * @default __DEV__
 */
export const DEBUG_UNIFIED_MESSAGING = __DEV__;

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

  // =========================================================================
  // Phase 5: Game Scores & Polish
  // =========================================================================

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

// =============================================================================
// Three.js 3D Visual Enhancement Features
// =============================================================================

/**
 * Three.js visual enhancement feature flags
 *
 * Controls progressive rollout of 3D visual effects across the play system.
 * All 3D components are overlaid behind existing 2D UI as position: absolute
 * layers. On web platform, all 3D components render null (expo-gl only).
 *
 * Packages: expo-gl, three, expo-three
 *
 * @see src/components/three/
 */
export const THREE_JS_FEATURES = {
  // =========================================================================
  // Master Switch
  // =========================================================================

  /** Global enable/disable for all Three.js visual effects. Disabled on web. */
  THREE_JS_ENABLED: !IS_WEB,

  // =========================================================================
  // Play Screen 3D Enhancements
  // =========================================================================

  /** 3D animated hero banner behind FeaturedGameBanner (floating game pieces) */
  HERO_BANNER_3D: true,

  /** 3D animated background for the GamesHubScreen (floating shapes, fog) */
  GAME_BACKGROUND_3D: true,

  /** Floating 3D game icons behind the Play header/categories */
  FLOATING_ICONS_3D: true,

  // =========================================================================
  // Game Invite 3D Enhancements
  // =========================================================================

  /** 3D animated overlay on CompactInviteCard (spinning gem, glow ring) */
  INVITE_CARD_3D: true,

  // =========================================================================
  // Victory / Game Over 3D Effects
  // =========================================================================

  /** 3D animated trophy on victory/game-over screens */
  VICTORY_TROPHY_3D: true,

  // =========================================================================
  // Debug Flags
  // =========================================================================

  /** Debug: Log Three.js lifecycle events */
  DEBUG_THREE_JS: __DEV__,
} as const;

// =============================================================================
// Colyseus Multiplayer Features
// =============================================================================

/**
 * Feature flags for Colyseus real-time multiplayer system.
 *
 * Controls progressive rollout of multiplayer across game tiers:
 *   Phase 1: Quick-Play (score-race pattern)
 *   Phase 2: Turn-Based (chess, checkers, connect-4)
 *   Phase 3: Complex Turn-Based (Battleship, etc.)
 *   Phase 4: Physics-Based (pong, cart course)
 *   Phase 5: Co-op (cooperative games)
 */
export const COLYSEUS_FEATURES = {
  // =========================================================================
  // Master Switch
  // =========================================================================

  /** Global enable/disable for all Colyseus multiplayer features */
  COLYSEUS_ENABLED: true,

  // =========================================================================
  // Tier Rollout Flags
  // =========================================================================

  /** Quick-play games: DotMatch */
  QUICKPLAY_ENABLED: true,

  /** Turn-based games: TicTacToe, ConnectFour, Gomoku, Reversi (Phase 2 â€” LIVE) */
  TURNBASED_ENABLED: true,

  /** Complex turn-based games: Chess, Checkers, CrazyEights */
  COMPLEX_TURNBASED_ENABLED: true,

  /** Physics-based games: Pong, BounceBlitz, BrickBreaker */
  PHYSICS_ENABLED: true,

  /** Cooperative games: WordMaster, Crossword */
  COOP_ENABLED: true,

  /** Incremental games: Starforge */
  INCREMENTAL_ENABLED: true,

  /** Party games: Sketch Party */
  PARTY_ENABLED: true,

  // =========================================================================
  // Feature Sub-Flags
  // =========================================================================

  /** Enable matchmaking queue (vs direct invites only) â€” disabled: friends-only */
  MATCHMAKING_ENABLED: false,

  /** Enable ELO-based ranked matches â€” disabled: friends-only */
  RANKED_ENABLED: false,

  /** Enable rematch flow after game over */
  REMATCH_ENABLED: true,

  /** Enable reconnection handling on network drop */
  RECONNECTION_ENABLED: true,

  /** Show opponent score overlay during gameplay */
  OPPONENT_SCORE_OVERLAY: true,

  // =========================================================================
  // Server Configuration
  // =========================================================================

  /** Use production Colyseus server (vs local dev) */
  USE_PRODUCTION_SERVER: false,

  // =========================================================================
  // Debug Flags
  // =========================================================================

  /** Debug: Log Colyseus state changes to console */
  DEBUG_STATE_SYNC: __DEV__,

  /** Debug: Log Colyseus messages to console */
  DEBUG_MESSAGES: __DEV__,

  /** Debug: Show latency overlay */
  DEBUG_LATENCY_OVERLAY: false,

  /** Debug: Simulate network lag (ms) â€” 0 = disabled */
  DEBUG_SIMULATED_LAG: 0,
} as const;
// =============================================================================
// Chat V3 Feature Flags
// =============================================================================

/**
 * Chat V3 feature flags
 *
 * Controls progressive rollout of chat improvements:
 * - Settings V3 (global + per-chat overrides + resolver)
 * - Signed media URLs (no long-lived tokens in Firestore)
 * - Staged uploads (client → staging → final)
 * - Message requests (anti-spam for DMs)
 * - Global rate limiting (bucketed)
 * - Inbox aggregation (single collection)
 * - Delivery acknowledgements (watermarks)
 * - Server-enforced privacy (callables for typing/read/delivery)
 * - Debug HUD (dev-only)
 *
 * Phase plan:
 *   Phase 1: Add types/resolvers/collections; no behavior change by default.
 *   Phase 2: Enable in dev-only; validate end-to-end.
 *   Phase 3: Enable for internal cohort via flags.
 *   Phase 4: Expand; only then consider deprecations.
 *
 * @see docs/03_CHAT_V3.md
 */
export const CHAT_FEATURES = {
  // =========================================================================
  // Phase 1 — Settings V3 (global + per-chat overrides + resolver)
  // =========================================================================

  /** Enable Settings V3 resolver and tri-state per-chat overrides */
  CHAT_SETTINGS_V3: false,

  // =========================================================================
  // Phase 1 — Media Pipeline
  // =========================================================================

  /** Store only storage paths in message docs; mint short-lived signed URLs */
  CHAT_SIGNED_MEDIA_URLS: false,

  /** Upload attachments to staging path; server commits to final on send */
  CHAT_STAGED_UPLOADS: false,

  // =========================================================================
  // Phase 1 — Message Requests
  // =========================================================================

  /** Enforce dmAcceptance setting; unsolicited DMs go to requests queue */
  CHAT_MESSAGE_REQUESTS: false,

  // =========================================================================
  // Phase 1 — Rate Limiting
  // =========================================================================

  /** Enable global per-user bucketed rate limiter (replaces single-doc) */
  CHAT_GLOBAL_RATE_LIMIT: false,

  // =========================================================================
  // Phase 1 — Inbox Aggregation
  // =========================================================================

  /** Query Users/{uid}/Inbox instead of Chats + Groups collections */
  CHAT_INBOX_AGGREGATION: false,

  // =========================================================================
  // Phase 1 — Delivery Acks
  // =========================================================================

  /** Enable lastDeliveredAtPublic watermark on member docs */
  CHAT_DELIVERY_ACKS: false,

  // =========================================================================
  // Phase 1 — Privacy Server Enforcement
  // =========================================================================

  /** Route typing/read/delivery writes through Cloud Function callables */
  CHAT_PRIVACY_SERVER_ENFORCED: false,

  // =========================================================================
  // Debug
  // =========================================================================

  /** Show ChatDebugHUD overlay (dev-only, default true in __DEV__) */
  CHAT_DEBUG_HUD: __DEV__,
} as const;
