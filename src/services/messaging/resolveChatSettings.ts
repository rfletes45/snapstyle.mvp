/**
 * Chat Settings Resolver (Settings V3)
 *
 * Single shared resolver used by UI, services, and Cloud Functions
 * to compute the **effective** settings for a given conversation.
 *
 * Resolution precedence:
 *   1. Per-conversation override (MembersPrivate.privacyOverrides)
 *   2. Global user setting (ChatSettingsV3 / InboxSettings)
 *   3. Default fallback (DEFAULT_EFFECTIVE_SETTINGS)
 *
 * When the CHAT_SETTINGS_V3 feature flag is OFF, the resolver maps
 * the existing InboxSettings fields to the effective shape so callers
 * can use one API regardless of flag state.
 *
 * @module services/messaging/resolveChatSettings
 */

import { CHAT_FEATURES } from "@/constants/featureFlags";
import {
  AutoDownloadMedia,
  ChatSettingsV3,
  DEFAULT_CHAT_SETTINGS_V3,
  DEFAULT_EFFECTIVE_SETTINGS,
  EffectiveChatSettings,
  GroupSettings,
  InboxSettings,
  NotificationPreview,
  PerChatPrivacyOverrides,
  TriState,
} from "@/types/messaging";

// =============================================================================
// Input type accepted by the resolver
// =============================================================================

/**
 * Input bundle for the resolver.
 *
 * All fields are optional — the resolver fills in defaults for anything
 * missing, making it safe to call with partial data during loading states.
 */
export interface ResolveChatSettingsInput {
  /** User's global inbox settings (existing shape) */
  inboxSettings?: InboxSettings | null;

  /** User's V3 chat settings (if CHAT_SETTINGS_V3 enabled) */
  chatSettingsV3?: ChatSettingsV3 | null;

  /** Per-conversation overrides from MembersPrivate */
  perChatOverrides?: PerChatPrivacyOverrides | null;

  /** Group-level settings (only relevant for group scope) */
  groupSettings?: GroupSettings | null;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Resolve a boolean TriState value.
 *
 * "inherit" → globalValue
 * "on"      → true
 * "off"     → false
 */
function resolveTriState(
  override: TriState | undefined,
  globalValue: boolean,
): boolean {
  if (override === "on") return true;
  if (override === "off") return false;
  return globalValue; // "inherit" or undefined
}

/**
 * Resolve a string-based override that can be "inherit" or a concrete value.
 */
function resolveStringOverride<T extends string>(
  override: "inherit" | T | undefined,
  globalValue: T,
): T {
  if (!override || override === "inherit") return globalValue;
  return override;
}

// =============================================================================
// Main Resolver
// =============================================================================

/**
 * Compute effective chat settings.
 *
 * This function is **pure** — no side effects, no async, no imports
 * beyond types. This makes it safe to use in Cloud Functions too
 * (mirror the logic server-side by copying this file or importing
 * from a shared package).
 *
 * @param input - Settings sources (all optional)
 * @returns Fully-resolved effective settings
 *
 * @example
 * ```ts
 * const effective = resolveEffectiveChatSettings({
 *   inboxSettings: myInboxSettings,
 *   perChatOverrides: memberPrivate.privacyOverrides,
 * });
 *
 * if (effective.publishReadReceipts) {
 *   updateReadWatermark(chatId, uid, timestamp);
 * }
 * ```
 */
export function resolveEffectiveChatSettings(
  input: ResolveChatSettingsInput = {},
): EffectiveChatSettings {
  const {
    inboxSettings,
    chatSettingsV3,
    perChatOverrides,
    // groupSettings is reserved for Segment 9 enforcement
  } = input;

  // -------------------------------------------------------------------------
  // Step 1: Determine the "global" values.
  //
  // If CHAT_SETTINGS_V3 is enabled AND chatSettingsV3 is provided, use it.
  // Otherwise, map the existing InboxSettings fields.
  // -------------------------------------------------------------------------

  let global: ChatSettingsV3;

  if (CHAT_FEATURES.CHAT_SETTINGS_V3 && chatSettingsV3) {
    global = { ...DEFAULT_CHAT_SETTINGS_V3, ...chatSettingsV3 };
  } else if (inboxSettings) {
    // Map legacy InboxSettings → ChatSettingsV3 shape
    global = {
      dmAcceptance:
        inboxSettings.dmAcceptance ?? DEFAULT_CHAT_SETTINGS_V3.dmAcceptance,
      notificationPreview:
        inboxSettings.notificationPreview ??
        DEFAULT_CHAT_SETTINGS_V3.notificationPreview,
      autoDownloadMedia:
        inboxSettings.autoDownloadMedia ??
        DEFAULT_CHAT_SETTINGS_V3.autoDownloadMedia,
      publishReadReceipts: inboxSettings.showReadReceipts,
      publishDeliveryReceipts:
        inboxSettings.publishDeliveryReceipts ??
        DEFAULT_CHAT_SETTINGS_V3.publishDeliveryReceipts,
      publishTyping: inboxSettings.showTypingIndicators,
      publishOnlineStatus: inboxSettings.showOnlineStatus,
      publishLastSeen: inboxSettings.showLastSeen,
    };
  } else {
    global = { ...DEFAULT_CHAT_SETTINGS_V3 };
  }

  // -------------------------------------------------------------------------
  // Step 2: Apply per-conversation overrides (if CHAT_SETTINGS_V3 enabled).
  //
  // When the flag is OFF, overrides are ignored so existing behavior is
  // preserved exactly.
  // -------------------------------------------------------------------------

  if (CHAT_FEATURES.CHAT_SETTINGS_V3 && perChatOverrides) {
    return {
      publishReadReceipts: resolveTriState(
        perChatOverrides.readReceipts,
        global.publishReadReceipts,
      ),
      publishDeliveryReceipts: resolveTriState(
        perChatOverrides.deliveryReceipts,
        global.publishDeliveryReceipts,
      ),
      publishTyping: resolveTriState(
        perChatOverrides.typingIndicators,
        global.publishTyping,
      ),
      publishOnlineStatus: global.publishOnlineStatus,
      publishLastSeen: global.publishLastSeen,
      notificationPreview: resolveStringOverride<NotificationPreview>(
        perChatOverrides.notificationPreview,
        global.notificationPreview,
      ),
      autoDownloadMedia: resolveStringOverride<AutoDownloadMedia>(
        perChatOverrides.autoDownloadMedia,
        global.autoDownloadMedia,
      ),
    };
  }

  // -------------------------------------------------------------------------
  // Step 3: No overrides — return global directly.
  // -------------------------------------------------------------------------

  return {
    publishReadReceipts: global.publishReadReceipts,
    publishDeliveryReceipts: global.publishDeliveryReceipts,
    publishTyping: global.publishTyping,
    publishOnlineStatus: global.publishOnlineStatus,
    publishLastSeen: global.publishLastSeen,
    notificationPreview: global.notificationPreview,
    autoDownloadMedia: global.autoDownloadMedia,
  };
}

/**
 * Convenience: resolve from just InboxSettings (most common client path).
 *
 * This avoids forcing every call-site to wrap in the full input object
 * when only the existing settings are available.
 */
export function resolveFromInboxSettings(
  settings: InboxSettings | null | undefined,
  perChatOverrides?: PerChatPrivacyOverrides | null,
): EffectiveChatSettings {
  if (!settings) return { ...DEFAULT_EFFECTIVE_SETTINGS };
  return resolveEffectiveChatSettings({
    inboxSettings: settings,
    perChatOverrides,
  });
}
