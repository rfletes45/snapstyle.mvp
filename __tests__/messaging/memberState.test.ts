/**
 * Tests for Unified Messaging Service - Member State Module
 *
 * These tests verify the unified member state service that wraps
 * chatMembers.ts and groupMembers.ts functionality.
 */

import {
  clearTypingIndicator,
  setArchived,
  setMuted,
  setNotifyLevel,
  setReadReceipts,
  setTypingIndicator,
  updateLastSeenPrivate,
  updateReadWatermark,
} from "@/services/messaging/memberState";

// Mock the chatMembers module
jest.mock("@/services/chatMembers", () => ({
  updateReadWatermark: jest.fn().mockResolvedValue(undefined),
  updateTypingIndicator: jest.fn().mockResolvedValue(undefined),
  clearTypingIndicator: jest.fn().mockResolvedValue(undefined),
  setMuted: jest.fn().mockResolvedValue(undefined),
  setArchived: jest.fn().mockResolvedValue(undefined),
  setNotifyLevel: jest.fn().mockResolvedValue(undefined),
  setReadReceipts: jest.fn().mockResolvedValue(undefined),
}));

// Mock the groupMembers module
jest.mock("@/services/groupMembers", () => ({
  updateGroupReadWatermark: jest.fn().mockResolvedValue(undefined),
  updateGroupTypingIndicator: jest.fn().mockResolvedValue(undefined),
  setGroupMuted: jest.fn().mockResolvedValue(undefined),
  setGroupArchived: jest.fn().mockResolvedValue(undefined),
  setGroupNotifyLevel: jest.fn().mockResolvedValue(undefined),
  setGroupReadReceipts: jest.fn().mockResolvedValue(undefined),
}));

// Mock feature flags (root level, not in src)
jest.mock("../../constants/featureFlags", () => ({
  DEBUG_UNIFIED_MESSAGING: false,
}));

const mockChatMembers = jest.requireMock("@/services/chatMembers");
const mockGroupMembers = jest.requireMock("@/services/groupMembers");

describe("Unified Member State Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("updateReadWatermark", () => {
    it("should delegate DM watermark updates to chatMembers", async () => {
      await updateReadWatermark("dm", "chat123", "user456", 1234567890);

      expect(mockChatMembers.updateReadWatermark).toHaveBeenCalledWith(
        "chat123",
        "user456",
        1234567890,
      );
      expect(mockGroupMembers.updateGroupReadWatermark).not.toHaveBeenCalled();
    });

    it("should delegate group watermark updates to groupMembers", async () => {
      await updateReadWatermark("group", "group123", "user456", 1234567890);

      expect(mockGroupMembers.updateGroupReadWatermark).toHaveBeenCalledWith(
        "group123",
        "user456",
        1234567890,
      );
      expect(mockChatMembers.updateReadWatermark).not.toHaveBeenCalled();
    });
  });

  describe("updateLastSeenPrivate", () => {
    it("should use updateReadWatermark for DMs", async () => {
      await updateLastSeenPrivate("dm", "chat123", "user456", 1234567890);

      expect(mockChatMembers.updateReadWatermark).toHaveBeenCalledWith(
        "chat123",
        "user456",
        1234567890,
      );
    });

    it("should use updateGroupReadWatermark for groups", async () => {
      await updateLastSeenPrivate("group", "group123", "user456", 1234567890);

      expect(mockGroupMembers.updateGroupReadWatermark).toHaveBeenCalledWith(
        "group123",
        "user456",
        1234567890,
      );
    });
  });

  describe("setTypingIndicator", () => {
    it("should call updateTypingIndicator for DM when typing=true", async () => {
      await setTypingIndicator("dm", "chat123", "user456", true);

      expect(mockChatMembers.updateTypingIndicator).toHaveBeenCalledWith(
        "chat123",
        "user456",
      );
      expect(mockChatMembers.clearTypingIndicator).not.toHaveBeenCalled();
    });

    it("should call clearTypingIndicator for DM when typing=false", async () => {
      await setTypingIndicator("dm", "chat123", "user456", false);

      expect(mockChatMembers.clearTypingIndicator).toHaveBeenCalledWith(
        "chat123",
        "user456",
      );
      expect(mockChatMembers.updateTypingIndicator).not.toHaveBeenCalled();
    });

    it("should call updateGroupTypingIndicator for groups", async () => {
      await setTypingIndicator("group", "group123", "user456", true);

      expect(mockGroupMembers.updateGroupTypingIndicator).toHaveBeenCalledWith(
        "group123",
        "user456",
        true,
      );
    });
  });

  describe("clearTypingIndicator", () => {
    it("should call setTypingIndicator with false", async () => {
      await clearTypingIndicator("dm", "chat123", "user456");

      expect(mockChatMembers.clearTypingIndicator).toHaveBeenCalledWith(
        "chat123",
        "user456",
      );
    });
  });

  describe("setMuted", () => {
    it("should delegate DM mute to chatMembers", async () => {
      await setMuted("dm", "chat123", "user456", -1); // Mute forever

      expect(mockChatMembers.setMuted).toHaveBeenCalledWith(
        "chat123",
        "user456",
        -1,
      );
    });

    it("should delegate group mute to groupMembers with boolean", async () => {
      await setMuted("group", "group123", "user456", -1); // Mute forever

      expect(mockGroupMembers.setGroupMuted).toHaveBeenCalledWith(
        "group123",
        "user456",
        true,
        undefined, // -1 becomes undefined for "forever"
      );
    });

    it("should unmute when mutedUntil is null", async () => {
      await setMuted("group", "group123", "user456", null);

      expect(mockGroupMembers.setGroupMuted).toHaveBeenCalledWith(
        "group123",
        "user456",
        false,
        undefined,
      );
    });

    it("should pass timestamp for timed mute", async () => {
      const timestamp = Date.now() + 3600000; // 1 hour from now
      await setMuted("group", "group123", "user456", timestamp);

      expect(mockGroupMembers.setGroupMuted).toHaveBeenCalledWith(
        "group123",
        "user456",
        true,
        timestamp,
      );
    });
  });

  describe("setArchived", () => {
    it("should delegate DM archive to chatMembers", async () => {
      await setArchived("dm", "chat123", "user456", true);

      expect(mockChatMembers.setArchived).toHaveBeenCalledWith(
        "chat123",
        "user456",
        true,
      );
    });

    it("should delegate group archive to groupMembers", async () => {
      await setArchived("group", "group123", "user456", true);

      expect(mockGroupMembers.setGroupArchived).toHaveBeenCalledWith(
        "group123",
        "user456",
        true,
      );
    });
  });

  describe("setNotifyLevel", () => {
    it("should delegate DM notify level to chatMembers", async () => {
      await setNotifyLevel("dm", "chat123", "user456", "mentions");

      expect(mockChatMembers.setNotifyLevel).toHaveBeenCalledWith(
        "chat123",
        "user456",
        "mentions",
      );
    });

    it("should delegate group notify level to groupMembers", async () => {
      await setNotifyLevel("group", "group123", "user456", "none");

      expect(mockGroupMembers.setGroupNotifyLevel).toHaveBeenCalledWith(
        "group123",
        "user456",
        "none",
      );
    });
  });

  describe("setReadReceipts", () => {
    it("should delegate DM read receipts to chatMembers", async () => {
      await setReadReceipts("dm", "chat123", "user456", false);

      expect(mockChatMembers.setReadReceipts).toHaveBeenCalledWith(
        "chat123",
        "user456",
        false,
      );
    });

    it("should delegate group read receipts to groupMembers", async () => {
      await setReadReceipts("group", "group123", "user456", true);

      expect(mockGroupMembers.setGroupReadReceipts).toHaveBeenCalledWith(
        "group123",
        "user456",
        true,
      );
    });
  });
});
