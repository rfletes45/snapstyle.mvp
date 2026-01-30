/**
 * Tests for Unified Messaging Service - Subscribe Module
 *
 * These tests verify the unified subscription service that wraps
 * messageList.ts functionality with a consistent API.
 */

import {
  clearAllPaginationCursors,
  countUnreadMentions,
  countUnreadSince,
  getMessage,
  loadNewerMessages,
  loadOlderMessages,
  resetPaginationCursor,
  subscribeToDMMessages,
  subscribeToGroupMessagesUnified,
  subscribeToMessages,
} from "@/services/messaging/subscribe";

// Mock the messageList module
jest.mock("@/services/messageList", () => ({
  subscribeToDMMessages: jest.fn(() => jest.fn()),
  subscribeToGroupMessages: jest.fn(() => jest.fn()),
  loadOlderMessages: jest
    .fn()
    .mockResolvedValue({ messages: [], hasMore: false }),
  loadNewerMessages: jest
    .fn()
    .mockResolvedValue({ messages: [], hasMore: false }),
  resetPaginationCursor: jest.fn(),
  clearAllPaginationCursors: jest.fn(),
  countUnreadSince: jest.fn().mockResolvedValue(0),
  countUnreadMentions: jest.fn().mockResolvedValue(0),
  getMessage: jest.fn().mockResolvedValue(null),
  hasUnreadMessages: jest.fn().mockReturnValue(false),
  getUnreadMentions: jest.fn().mockResolvedValue([]),
}));

// Mock feature flags (root level, not in src)
jest.mock("../../constants/featureFlags", () => ({
  DEBUG_UNIFIED_MESSAGING: false,
}));

const mockMessageList = jest.requireMock("@/services/messageList");

describe("Unified Subscription Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("subscribeToMessages", () => {
    it("should delegate DM subscriptions to subscribeToDMMessages", () => {
      const options = {
        onMessages: jest.fn(),
        currentUid: "user123",
      };

      subscribeToMessages("dm", "chat123", options);

      expect(mockMessageList.subscribeToDMMessages).toHaveBeenCalledWith(
        "chat123",
        options,
      );
    });

    it("should delegate group subscriptions to subscribeToGroupMessages", () => {
      const options = {
        onMessages: jest.fn(),
        currentUid: "user123",
      };

      subscribeToMessages("group", "group123", options);

      expect(mockMessageList.subscribeToGroupMessages).toHaveBeenCalledWith(
        "group123",
        options,
      );
    });

    it("should return an unsubscribe function", () => {
      const mockUnsubscribe = jest.fn();
      mockMessageList.subscribeToDMMessages.mockReturnValue(mockUnsubscribe);

      const unsubscribe = subscribeToMessages("dm", "chat123", {
        onMessages: jest.fn(),
      });

      expect(typeof unsubscribe).toBe("function");
      unsubscribe();
      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe("subscribeToDMMessages", () => {
    it("should be a convenience wrapper for DM scope", () => {
      const options = {
        onMessages: jest.fn(),
        initialLimit: 25,
      };

      subscribeToDMMessages("chat123", options);

      expect(mockMessageList.subscribeToDMMessages).toHaveBeenCalledWith(
        "chat123",
        options,
      );
    });
  });

  describe("subscribeToGroupMessagesUnified", () => {
    it("should be a convenience wrapper for group scope", () => {
      const options = {
        onMessages: jest.fn(),
        initialLimit: 50,
      };

      subscribeToGroupMessagesUnified("group123", options);

      expect(mockMessageList.subscribeToGroupMessages).toHaveBeenCalledWith(
        "group123",
        options,
      );
    });
  });

  describe("loadOlderMessages", () => {
    it("should delegate to messageList loadOlderMessages", async () => {
      const mockResult = {
        messages: [{ id: "msg1" }],
        hasMore: true,
      };
      mockMessageList.loadOlderMessages.mockResolvedValue(mockResult);

      const result = await loadOlderMessages("dm", "chat123", 1234567890, 25);

      expect(mockMessageList.loadOlderMessages).toHaveBeenCalledWith(
        "dm",
        "chat123",
        1234567890,
        25,
      );
      expect(result).toEqual(mockResult);
    });

    it("should use default limit of 25", async () => {
      await loadOlderMessages("group", "group123", 1234567890);

      expect(mockMessageList.loadOlderMessages).toHaveBeenCalledWith(
        "group",
        "group123",
        1234567890,
        25,
      );
    });
  });

  describe("loadNewerMessages", () => {
    it("should delegate to messageList loadNewerMessages", async () => {
      const mockResult = {
        messages: [{ id: "msg2" }],
        hasMore: false,
      };
      mockMessageList.loadNewerMessages.mockResolvedValue(mockResult);

      const result = await loadNewerMessages("dm", "chat123", 1234567890, 50);

      expect(mockMessageList.loadNewerMessages).toHaveBeenCalledWith(
        "dm",
        "chat123",
        1234567890,
        50,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe("resetPaginationCursor", () => {
    it("should delegate to messageList resetPaginationCursor", () => {
      resetPaginationCursor("group", "group123");

      expect(mockMessageList.resetPaginationCursor).toHaveBeenCalledWith(
        "group",
        "group123",
      );
    });
  });

  describe("clearAllPaginationCursors", () => {
    it("should delegate to messageList clearAllPaginationCursors", () => {
      clearAllPaginationCursors();

      expect(mockMessageList.clearAllPaginationCursors).toHaveBeenCalled();
    });
  });

  describe("countUnreadSince", () => {
    it("should delegate to messageList countUnreadSince", async () => {
      mockMessageList.countUnreadSince.mockResolvedValue(5);

      const result = await countUnreadSince(
        "dm",
        "chat123",
        1234567890,
        "user123",
      );

      expect(mockMessageList.countUnreadSince).toHaveBeenCalledWith(
        "dm",
        "chat123",
        1234567890,
        "user123",
      );
      expect(result).toBe(5);
    });
  });

  describe("countUnreadMentions", () => {
    it("should delegate to messageList countUnreadMentions", async () => {
      mockMessageList.countUnreadMentions.mockResolvedValue(2);

      const result = await countUnreadMentions(
        "group",
        "group123",
        "user123",
        1234567890,
      );

      expect(mockMessageList.countUnreadMentions).toHaveBeenCalledWith(
        "group",
        "group123",
        "user123",
        1234567890,
      );
      expect(result).toBe(2);
    });
  });

  describe("getMessage", () => {
    it("should delegate to messageList getMessage", async () => {
      const mockMessage = { id: "msg1", text: "Hello" };
      mockMessageList.getMessage.mockResolvedValue(mockMessage);

      const result = await getMessage("dm", "chat123", "msg1");

      expect(mockMessageList.getMessage).toHaveBeenCalledWith(
        "dm",
        "chat123",
        "msg1",
      );
      expect(result).toEqual(mockMessage);
    });

    it("should return null for non-existent message", async () => {
      mockMessageList.getMessage.mockResolvedValue(null);

      const result = await getMessage("group", "group123", "nonexistent");

      expect(result).toBeNull();
    });
  });
});
