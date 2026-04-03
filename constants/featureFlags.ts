/**
 * Feature Flags
 *
 * Toggle experimental features on/off.
 * Set to `false` for production, `true` for testing.
 *
 * @module constants/featureFlags
 */

import Constants from "expo-constants";
import { NativeModules, Platform } from "react-native";

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

const IS_EXPO_GO =
  Constants.executionEnvironment === "storeClient" ||
  Constants.appOwnership === "expo" ||
  Constants.expoVersion != null;

function hasStreamNativeModules(): boolean {
  const nativeModules = NativeModules as Record<string, unknown>;
  return Boolean(
    nativeModules.WebRTCModule && nativeModules.StreamVideoReactNative,
  );
}

/**
 * Check whether Stream Video native modules are available at runtime.
 *
 * Stream's React Native SDK requires native WebRTC + Stream modules, so it
 * must be disabled in Expo Go and any runtime that doesn't expose both native
 * modules on the bridge.
 */
function isStreamNativeAvailable(): boolean {
  if (IS_WEB || IS_EXPO_GO) return false;
  return hasStreamNativeModules();
}

/**
 * Calling feature flags (Stream Video SDK)
 *
 * The call system is now powered by Stream Video.
 * Legacy WebRTC/Firestore signaling flags have been removed.
 * CALLS_ENABLED auto-disables when native modules are unavailable (Expo Go).
 */
export const CALL_FEATURES = {
  /** Master switch for all calling features */
  CALLS_ENABLED: isStreamNativeAvailable(),

  /** Enable 1:1 direct calls (audio + video, with ringing) */
  DIRECT_CALLS_ENABLED: true,
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
