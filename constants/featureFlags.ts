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
 * When `true`  â†’ VisionCamera + Skia frame processors (pixel-perfect live
 *                filter preview, full GPU pipeline).  Requires a custom dev
 *                client or production build â€” does NOT work inside Expo Go.
 *
 * When `false` â†’ expo-camera CameraView fallback with the simpler
 *                CameraFilterOverlay tint.  Works inside Expo Go for
 *                development & testing.
 *
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * TODO(launch): flip to `true` and remove expo-camera from package.json
 *               once we ship via EAS builds only.
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 *
 * NOTE: Even when `true`, CameraScreen performs a runtime check:
 *       if VisionCamera fails to load (e.g. Expo Go) it gracefully falls
 *       back to expo-camera + CameraFilterOverlay.  So this is safe to
 *       leave `true` for EAS / dev-client / TestFlight / production builds.
 *
 * @default true â€" enables real-time GPU-filtered camera preview
 */
export const USE_VISION_CAMERA = true;

// =============================================================================
// Games V4 Feature Flag
// =============================================================================

/**
 * Master switch for the V4 game system (GamePigeon-style in-chat games).
 *
 * When enabled:
 * - Game picker button appears in chat composer toolbar
 * - Pinned game invite bar appears at the top of chat screens
 * - Game lobby, play, and game-over screens are reachable
 *
 * @default true
 */
export const GAMES_V4_ENABLED = true;

// =============================================================================
// Debug Features
// =============================================================================

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
   * @default true - Enabled
   */
  CALLS_ENABLED: true,

  /**
   * Enable audio-only calls
   * Requires CALLS_ENABLED to be true
   *
   * @default true
   */
  AUDIO_CALLS_ENABLED: true,

  // =========================================================================
  // Phase 2: Video & Native Integration
  // =========================================================================

  /**
   * Enable video calls
   * Requires CALLS_ENABLED to be true
   *
   * @default true - Enabled
   */
  VIDEO_CALLS_ENABLED: true,

  /**
   * Enable CallKeep integration for native call UI
   * iOS: CallKit integration
   * Android: ConnectionService integration
   *
   * @default true
   */
  NATIVE_CALL_UI_ENABLED: true,

  /**
   * Enable background audio during calls
   * Allows calls to continue when app is minimized
   *
   * @default true
   */
  BACKGROUND_CALLS_ENABLED: true,

  // =========================================================================
  // Phase 3: Group Calls
  // =========================================================================

  /**
   * Enable group audio/video calls
   * Requires CALLS_ENABLED to be true
   * Max 8 participants
   *
   * @default true - Enabled
   */
  GROUP_CALLS_ENABLED: true,

  /**
   * Enable host controls for group calls
   * Includes: mute all, remove participant, pin video
   *
   * @default true
   */
  HOST_CONTROLS_ENABLED: true,

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
   * @default true
   */
  CALL_HISTORY_ENABLED: true,

  /**
   * Enable call settings screen
   * Camera, audio, ringtone, DND, privacy settings
   *
   * @default true
   */
  CALL_SETTINGS_ENABLED: true,

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
   * @default true
   */
  MISSED_CALL_BADGE_ENABLED: true,

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
// Chat V3 Feature Flags
// =============================================================================

/**
 * Chat V3 feature flags
 *
 * Controls progressive rollout of chat improvements:
 * - Settings V3 (global + per-chat overrides + resolver)
 * - Signed media URLs (no long-lived tokens in Firestore)
 * - Staged uploads (client â†’ staging â†’ final)
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
  // Phase 1 â€” Settings V3 (global + per-chat overrides + resolver)
  // =========================================================================

  /** Enable Settings V3 resolver and tri-state per-chat overrides */
  CHAT_SETTINGS_V3: false,

  // =========================================================================
  // Phase 1 â€” Media Pipeline
  // =========================================================================

  /** Store only storage paths in message docs; mint short-lived signed URLs */
  CHAT_SIGNED_MEDIA_URLS: false,

  /** Upload attachments to staging path; server commits to final on send */
  CHAT_STAGED_UPLOADS: false,

  // =========================================================================
  // Phase 1 â€” Message Requests
  // =========================================================================

  /** Enforce dmAcceptance setting; unsolicited DMs go to requests queue */
  CHAT_MESSAGE_REQUESTS: false,

  // =========================================================================
  // Phase 1 â€” Rate Limiting
  // =========================================================================

  /** Enable global per-user bucketed rate limiter (replaces single-doc) */
  CHAT_GLOBAL_RATE_LIMIT: false,

  // =========================================================================
  // Phase 1 â€” Inbox Aggregation
  // =========================================================================

  /** Query Users/{uid}/Inbox instead of Chats + Groups collections */
  CHAT_INBOX_AGGREGATION: false,

  // =========================================================================
  // Phase 1 â€” Delivery Acks
  // =========================================================================

  /** Enable lastDeliveredAtPublic watermark on member docs */
  CHAT_DELIVERY_ACKS: false,

  // =========================================================================
  // Phase 1 â€” Privacy Server Enforcement
  // =========================================================================

  /** Route typing/read/delivery writes through Cloud Function callables */
  CHAT_PRIVACY_SERVER_ENFORCED: false,

  // =========================================================================
  // Debug
  // =========================================================================

  /** Show ChatDebugHUD overlay (dev-only, default true in __DEV__) */
  CHAT_DEBUG_HUD: __DEV__,
} as const;
