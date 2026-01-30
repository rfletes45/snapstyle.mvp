/**
 * Tests for Unified Messaging Service - Send Module
 *
 * These tests verify the unified send service that wraps
 * chatV2.ts and outbox.ts functionality with a consistent API.
 */

import {
  getFailedMessages,
  getPendingForConversation,
  getPendingMessages,
  processPendingMessages,
  retryMessage,
  sendMessage,
} from "@/services/messaging/send";

// Mock the chatV2 module
jest.mock("@/services/chatV2", () => ({
  sendMessageWithOutbox: jest.fn().mockResolvedValue({
    outboxItem: { messageId: "msg123", state: "queued" },
    sendPromise: Promise.resolve({ success: true }),
  }),
  retryFailedMessage: jest.fn().mockResolvedValue(true),
  processPendingMessages: jest.fn().mockResolvedValue({
    sent: 2,
    failed: 1,
    skipped: 0,
  }),
}));

// Mock the outbox module
jest.mock("@/services/outbox", () => ({
  getOutboxForConversation: jest.fn().mockResolvedValue([]),
  generateMessageId: jest.fn().mockReturnValue("generated-id-123"),
  getClientId: jest.fn().mockResolvedValue("client-id-456"),
  getPendingItems: jest.fn().mockResolvedValue([]),
  getFailedItems: jest.fn().mockResolvedValue([]),
}));

// Mock feature flags (root level, not in src)
jest.mock("../../constants/featureFlags", () => ({
  DEBUG_UNIFIED_MESSAGING: false,
}));

const mockChatV2 = jest.requireMock("@/services/chatV2");
const mockOutbox = jest.requireMock("@/services/outbox");

describe("Unified Send Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("sendMessage", () => {
    it("should delegate to sendMessageWithOutbox with correct params", async () => {
      const params = {
        scope: "group" as const,
        conversationId: "group123",
        kind: "text" as const,
        text: "Hello world!",
        mentionUids: ["user1", "user2"],
      };

      await sendMessage(params);

      expect(mockChatV2.sendMessageWithOutbox).toHaveBeenCalledWith({
        conversationId: "group123",
        scope: "group",
        kind: "text",
        text: "Hello world!",
        replyTo: undefined,
        mentionUids: ["user1", "user2"],
      });
    });

    it("should return outboxItem and sendPromise", async () => {
      const result = await sendMessage({
        scope: "dm",
        conversationId: "chat123",
        kind: "text",
        text: "Test message",
      });

      expect(result).toHaveProperty("outboxItem");
      expect(result).toHaveProperty("sendPromise");
      expect(result.outboxItem.messageId).toBe("msg123");
    });

    it("should handle reply-to metadata", async () => {
      const replyTo = {
        messageId: "original-msg",
        senderId: "user456",
        kind: "text" as const,
        textSnippet: "Original text",
      };

      await sendMessage({
        scope: "group",
        conversationId: "group123",
        kind: "text",
        text: "Reply text",
        replyTo,
      });

      expect(mockChatV2.sendMessageWithOutbox).toHaveBeenCalledWith(
        expect.objectContaining({
          replyTo,
        }),
      );
    });
  });

  describe("retryMessage", () => {
    it("should delegate to retryFailedMessage", async () => {
      await retryMessage("msg123");

      expect(mockChatV2.retryFailedMessage).toHaveBeenCalledWith("msg123");
    });

    it("should return success status", async () => {
      mockChatV2.retryFailedMessage.mockResolvedValue(true);

      const result = await retryMessage("msg123");

      expect(result).toBe(true);
    });

    it("should return failure status when retry fails", async () => {
      mockChatV2.retryFailedMessage.mockResolvedValue(false);

      const result = await retryMessage("msg456");

      expect(result).toBe(false);
    });
  });

  describe("processPendingMessages", () => {
    it("should delegate to processPendingMessages", async () => {
      const result = await processPendingMessages();

      expect(mockChatV2.processPendingMessages).toHaveBeenCalled();
      expect(result).toEqual({
        sent: 2,
        failed: 1,
        skipped: 0,
      });
    });
  });

  describe("getPendingForConversation", () => {
    it("should delegate to getOutboxForConversation", async () => {
      const mockItems = [
        { messageId: "msg1", state: "queued" },
        { messageId: "msg2", state: "sending" },
      ];
      mockOutbox.getOutboxForConversation.mockResolvedValue(mockItems);

      const result = await getPendingForConversation("group", "group123");

      expect(mockOutbox.getOutboxForConversation).toHaveBeenCalledWith(
        "group123",
      );
      expect(result).toEqual(mockItems);
    });
  });

  describe("getPendingMessages", () => {
    it("should delegate to getPendingItems", async () => {
      const mockItems = [{ messageId: "msg1", state: "queued" }];
      mockOutbox.getPendingItems.mockResolvedValue(mockItems);

      const result = await getPendingMessages();

      expect(mockOutbox.getPendingItems).toHaveBeenCalled();
      expect(result).toEqual(mockItems);
    });
  });

  describe("getFailedMessages", () => {
    it("should delegate to getFailedItems", async () => {
      const mockItems = [{ messageId: "msg1", state: "failed" }];
      mockOutbox.getFailedItems.mockResolvedValue(mockItems);

      const result = await getFailedMessages();

      expect(mockOutbox.getFailedItems).toHaveBeenCalled();
      expect(result).toEqual(mockItems);
    });
  });
});
