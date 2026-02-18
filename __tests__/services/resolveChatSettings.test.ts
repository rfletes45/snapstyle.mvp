/**
 * Tests for Chat Settings V3 Resolver (Segment 1)
 *
 * Validates the 3-level precedence resolution:
 *   per-chat override → global V3 setting → default fallback
 */

// Mock feature flags before importing the module
jest.mock("../../constants/featureFlags", () => ({
  CHAT_FEATURES: {
    CHAT_SETTINGS_V3: false,
    CHAT_SIGNED_MEDIA_URLS: false,
    CHAT_STAGED_UPLOADS: false,
    CHAT_MESSAGE_REQUESTS: false,
    CHAT_GLOBAL_RATE_LIMIT: false,
    CHAT_INBOX_AGGREGATION: false,
    CHAT_DELIVERY_ACKS: false,
    CHAT_PRIVACY_SERVER_ENFORCED: false,
    CHAT_DEBUG_HUD: false,
  },
}));

import {
  resolveEffectiveChatSettings,
  resolveFromInboxSettings,
} from "@/services/messaging/resolveChatSettings";
import {
  DEFAULT_INBOX_SETTINGS,
  DEFAULT_PER_CHAT_OVERRIDES,
  InboxSettings,
  PerChatPrivacyOverrides,
} from "@/types/messaging";

// Access the mock so we can toggle CHAT_SETTINGS_V3
const mockFlags = jest.requireMock("../../constants/featureFlags");

const makeInboxSettings = (
  overrides: Partial<InboxSettings> = {},
): InboxSettings => ({
  ...DEFAULT_INBOX_SETTINGS,
  ...overrides,
});

const makePerChatOverrides = (
  overrides: Partial<PerChatPrivacyOverrides> = {},
): PerChatPrivacyOverrides => ({
  ...DEFAULT_PER_CHAT_OVERRIDES,
  ...overrides,
});

describe("resolveChatSettings (Segment 1)", () => {
  afterEach(() => {
    // Reset to default
    mockFlags.CHAT_FEATURES.CHAT_SETTINGS_V3 = false;
  });

  describe("Default fallback (no inputs)", () => {
    it("should return DEFAULT_EFFECTIVE_SETTINGS when no input provided", () => {
      const result = resolveEffectiveChatSettings();

      expect(result.publishReadReceipts).toBe(true);
      expect(result.publishDeliveryReceipts).toBe(true);
      expect(result.publishTyping).toBe(true);
      expect(result.publishOnlineStatus).toBe(true);
      expect(result.publishLastSeen).toBe(true);
      expect(result.notificationPreview).toBe("full");
      expect(result.autoDownloadMedia).toBe("wifi");
    });

    it("should return DEFAULT_EFFECTIVE_SETTINGS when empty input", () => {
      const result = resolveEffectiveChatSettings({});
      expect(result.publishReadReceipts).toBe(true);
    });
  });

  describe("Legacy InboxSettings fallback (flag OFF)", () => {
    it("should map InboxSettings fields to effective shape", () => {
      const result = resolveEffectiveChatSettings({
        inboxSettings: makeInboxSettings({
          showReadReceipts: false,
          showTypingIndicators: false,
          showOnlineStatus: false,
          showLastSeen: false,
          dmAcceptance: "friends_only",
          notificationPreview: "sender_only",
          autoDownloadMedia: "never",
        }),
      });

      expect(result.publishReadReceipts).toBe(false);
      expect(result.publishTyping).toBe(false);
      expect(result.publishOnlineStatus).toBe(false);
      expect(result.publishLastSeen).toBe(false);
      expect(result.notificationPreview).toBe("sender_only");
      expect(result.autoDownloadMedia).toBe("never");
    });

    it("should use defaults for missing InboxSettings fields", () => {
      const result = resolveEffectiveChatSettings({
        inboxSettings: makeInboxSettings({
          showReadReceipts: true,
          showTypingIndicators: true,
          showOnlineStatus: true,
          showLastSeen: true,
        }),
      });

      // Missing fields like dmAcceptance fall back to defaults
      expect(result.notificationPreview).toBe("full");
      expect(result.autoDownloadMedia).toBe("wifi");
    });
  });

  describe("ChatSettingsV3 (flag ON)", () => {
    beforeEach(() => {
      mockFlags.CHAT_FEATURES.CHAT_SETTINGS_V3 = true;
    });

    it("should use ChatSettingsV3 fields when flag is ON", () => {
      const result = resolveEffectiveChatSettings({
        chatSettingsV3: {
          dmAcceptance: "requests",
          notificationPreview: "generic",
          autoDownloadMedia: "always",
          publishReadReceipts: false,
          publishDeliveryReceipts: false,
          publishTyping: false,
          publishOnlineStatus: false,
          publishLastSeen: false,
        },
      });

      expect(result.publishReadReceipts).toBe(false);
      expect(result.publishDeliveryReceipts).toBe(false);
      expect(result.publishTyping).toBe(false);
      expect(result.notificationPreview).toBe("generic");
      expect(result.autoDownloadMedia).toBe("always");
    });

    it("should fall back to defaults for missing V3 fields", () => {
      const result = resolveEffectiveChatSettings({
        chatSettingsV3: {
          dmAcceptance: "everyone",
          notificationPreview: "full",
          autoDownloadMedia: "wifi",
          publishReadReceipts: true,
          publishDeliveryReceipts: true,
          publishTyping: true,
          publishOnlineStatus: true,
          publishLastSeen: true,
        },
      });

      expect(result.publishReadReceipts).toBe(true);
    });
  });

  describe("Per-Chat Overrides (flag ON)", () => {
    beforeEach(() => {
      mockFlags.CHAT_FEATURES.CHAT_SETTINGS_V3 = true;
    });

    it("should apply on override → true", () => {
      const result = resolveEffectiveChatSettings({
        chatSettingsV3: {
          dmAcceptance: "everyone",
          notificationPreview: "full",
          autoDownloadMedia: "wifi",
          publishReadReceipts: false,
          publishDeliveryReceipts: false,
          publishTyping: false,
          publishOnlineStatus: true,
          publishLastSeen: true,
        },
        perChatOverrides: {
          ...DEFAULT_PER_CHAT_OVERRIDES,
          readReceipts: "on",
          typingIndicators: "on",
        },
      });

      expect(result.publishReadReceipts).toBe(true);
      expect(result.publishTyping).toBe(true);
    });

    it("should apply off override → false", () => {
      const result = resolveEffectiveChatSettings({
        chatSettingsV3: {
          dmAcceptance: "everyone",
          notificationPreview: "full",
          autoDownloadMedia: "wifi",
          publishReadReceipts: true,
          publishDeliveryReceipts: true,
          publishTyping: true,
          publishOnlineStatus: true,
          publishLastSeen: true,
        },
        perChatOverrides: {
          ...DEFAULT_PER_CHAT_OVERRIDES,
          readReceipts: "off",
          deliveryReceipts: "off",
        },
      });

      expect(result.publishReadReceipts).toBe(false);
      expect(result.publishDeliveryReceipts).toBe(false);
    });

    it("should apply inherit override → global value", () => {
      const result = resolveEffectiveChatSettings({
        chatSettingsV3: {
          dmAcceptance: "everyone",
          notificationPreview: "full",
          autoDownloadMedia: "wifi",
          publishReadReceipts: true,
          publishDeliveryReceipts: false,
          publishTyping: true,
          publishOnlineStatus: true,
          publishLastSeen: true,
        },
        perChatOverrides: {
          ...DEFAULT_PER_CHAT_OVERRIDES,
          readReceipts: "inherit",
          deliveryReceipts: "inherit",
        },
      });

      expect(result.publishReadReceipts).toBe(true); // inherits global true
      expect(result.publishDeliveryReceipts).toBe(false); // inherits global false
    });

    it("should override notification preview string", () => {
      const result = resolveEffectiveChatSettings({
        chatSettingsV3: {
          dmAcceptance: "everyone",
          notificationPreview: "full",
          autoDownloadMedia: "wifi",
          publishReadReceipts: true,
          publishDeliveryReceipts: true,
          publishTyping: true,
          publishOnlineStatus: true,
          publishLastSeen: true,
        },
        perChatOverrides: makePerChatOverrides({
          notificationPreview: "generic",
        }),
      });

      expect(result.notificationPreview).toBe("generic");
    });

    it("should not override onlineStatus/lastSeen (global only)", () => {
      // onlineStatus and lastSeen are always from global settings
      const result = resolveEffectiveChatSettings({
        chatSettingsV3: {
          dmAcceptance: "everyone",
          notificationPreview: "full",
          autoDownloadMedia: "wifi",
          publishReadReceipts: true,
          publishDeliveryReceipts: true,
          publishTyping: true,
          publishOnlineStatus: false,
          publishLastSeen: false,
        },
        perChatOverrides: makePerChatOverrides(),
      });

      expect(result.publishOnlineStatus).toBe(false);
      expect(result.publishLastSeen).toBe(false);
    });
  });

  describe("Per-Chat Overrides ignored when flag OFF", () => {
    it("should ignore per-chat overrides when CHAT_SETTINGS_V3 is off", () => {
      mockFlags.CHAT_FEATURES.CHAT_SETTINGS_V3 = false;

      const result = resolveEffectiveChatSettings({
        inboxSettings: makeInboxSettings({
          showReadReceipts: true,
          showTypingIndicators: true,
          showOnlineStatus: true,
          showLastSeen: true,
        }),
        perChatOverrides: makePerChatOverrides({
          readReceipts: "off",
          typingIndicators: "off",
        }),
      });

      // Overrides are ignored when flag is off → uses global value
      expect(result.publishReadReceipts).toBe(true);
      expect(result.publishTyping).toBe(true);
    });
  });

  describe("resolveFromInboxSettings convenience wrapper", () => {
    it("should return defaults for null settings", () => {
      const result = resolveFromInboxSettings(null);
      expect(result.publishReadReceipts).toBe(true);
      expect(result.publishTyping).toBe(true);
    });

    it("should return defaults for undefined settings", () => {
      const result = resolveFromInboxSettings(undefined);
      expect(result.publishReadReceipts).toBe(true);
    });

    it("should pass through to resolveEffectiveChatSettings", () => {
      const result = resolveFromInboxSettings({
        ...DEFAULT_INBOX_SETTINGS,
        showReadReceipts: false,
        showTypingIndicators: false,
        showOnlineStatus: true,
        showLastSeen: true,
      });

      expect(result.publishReadReceipts).toBe(false);
      expect(result.publishTyping).toBe(false);
    });
  });
});
