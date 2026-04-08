/**
 * Tests for Unified Messaging Service - Send Module
 *
 * These tests verify the canonical send service that owns the compatibility
 * queue/runtime directly instead of delegating through legacy wrapper modules.
 */

import {
  getFailedMessages,
  getPendingForConversation,
  getPendingMessages,
  processPendingMessages,
  retryMessage,
  sendMessage,
} from "@/services/messaging/send";

jest.mock("firebase/functions", () => ({
  getFunctions: jest.fn(() => ({})),
  httpsCallable: jest.fn(() =>
    jest.fn().mockResolvedValue({
      data: {
        success: true,
        message: { id: "msg123" },
        isExisting: false,
      },
    }),
  ),
}));

jest.mock("@/services/firebase", () => ({
  getAppInstance: jest.fn(() => ({})),
}));

jest.mock("@/services/outbox", () => ({
  enqueueMessage: jest.fn().mockResolvedValue({
    messageId: "msg123",
    scope: "group",
    conversationId: "group123",
    kind: "text",
    text: "Hello world!",
    createdAt: 123,
    attemptCount: 0,
    nextRetryAt: 123,
    state: "queued",
  }),
  generateMessageId: jest.fn().mockReturnValue("generated-id-123"),
  getClientId: jest.fn().mockResolvedValue("client-id-456"),
  getPendingItems: jest.fn().mockResolvedValue([]),
  getFailedItems: jest.fn().mockResolvedValue([]),
  getOutboxForConversation: jest.fn().mockResolvedValue([]),
  processOutbox: jest.fn().mockResolvedValue({
    sent: 2,
    failed: 1,
    skipped: 0,
  }),
  removeFromOutbox: jest.fn().mockResolvedValue(undefined),
  retryItem: jest.fn().mockResolvedValue(true),
  updateOutboxItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../constants/featureFlags", () => ({
  DEBUG_UNIFIED_MESSAGING: false,
}));

const mockFirebaseFunctions = jest.requireMock("firebase/functions");
const mockOutbox = jest.requireMock("@/services/outbox");

describe("Unified Send Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("sendMessage", () => {
    it("queues the message with the correct params", async () => {
      const params = {
        scope: "group" as const,
        conversationId: "group123",
        kind: "text" as const,
        text: "Hello world!",
        mentionUids: ["user1", "user2"],
      };

      const result = await sendMessage(params);
      await result.sendPromise;

      expect(mockOutbox.enqueueMessage).toHaveBeenCalledWith({
        scope: "group",
        conversationId: "group123",
        kind: "text",
        text: "Hello world!",
        replyTo: undefined,
        mentionUids: ["user1", "user2"],
        mentionSpans: undefined,
      });
      expect(mockFirebaseFunctions.httpsCallable).toHaveBeenCalledWith(
        expect.anything(),
        "sendMessageV2",
      );
    });

    it("returns outboxItem and sendPromise", async () => {
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

    it("preserves reply metadata in the queued item", async () => {
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

      expect(mockOutbox.enqueueMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          replyTo,
        }),
      );
    });
  });

  describe("retryMessage", () => {
    it("delegates to retryItem", async () => {
      await retryMessage("msg123");

      expect(mockOutbox.retryItem).toHaveBeenCalledWith(
        "msg123",
        expect.any(Function),
      );
    });

    it("returns success status", async () => {
      mockOutbox.retryItem.mockResolvedValue(true);

      const result = await retryMessage("msg123");

      expect(result).toBe(true);
    });

    it("returns failure status when retry fails", async () => {
      mockOutbox.retryItem.mockResolvedValue(false);

      const result = await retryMessage("msg456");

      expect(result).toBe(false);
    });
  });

  describe("processPendingMessages", () => {
    it("delegates to processOutbox", async () => {
      const result = await processPendingMessages();

      expect(mockOutbox.processOutbox).toHaveBeenCalledWith(expect.any(Function));
      expect(result).toEqual({
        sent: 2,
        failed: 1,
        skipped: 0,
      });
    });
  });

  describe("getPendingForConversation", () => {
    it("filters pending items by scope and conversation", async () => {
      const mockItems = [
        {
          messageId: "msg1",
          state: "queued",
          scope: "group",
          conversationId: "group123",
        },
        {
          messageId: "msg2",
          state: "sending",
          scope: "dm",
          conversationId: "group123",
        },
        {
          messageId: "msg3",
          state: "queued",
          scope: "group",
          conversationId: "other-group",
        },
      ];
      mockOutbox.getPendingItems.mockResolvedValue(mockItems);

      const result = await getPendingForConversation("group", "group123");

      expect(mockOutbox.getPendingItems).toHaveBeenCalled();
      expect(result).toEqual([mockItems[0]]);
    });
  });

  describe("getPendingMessages", () => {
    it("delegates to getPendingItems", async () => {
      const mockItems = [{ messageId: "msg1", state: "queued" }];
      mockOutbox.getPendingItems.mockResolvedValue(mockItems);

      const result = await getPendingMessages();

      expect(mockOutbox.getPendingItems).toHaveBeenCalled();
      expect(result).toEqual(mockItems);
    });
  });

  describe("getFailedMessages", () => {
    it("delegates to getFailedItems", async () => {
      const mockItems = [{ messageId: "msg1", state: "failed" }];
      mockOutbox.getFailedItems.mockResolvedValue(mockItems);

      const result = await getFailedMessages();

      expect(mockOutbox.getFailedItems).toHaveBeenCalled();
      expect(result).toEqual(mockItems);
    });
  });
});
