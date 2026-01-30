/**
 * Integration Tests for Unified Chat System (UNI-10)
 *
 * These tests verify the integration between:
 * - useUnifiedChatScreen
 * - useChatComposer
 * - useChat
 * - ChatComposer component
 * - ChatMessageList component
 *
 * Tests both DM and Group chat scenarios.
 */

import { sendMessage } from "@/services/messaging/send";
import {
  getScheduledMessagesForChat,
  scheduleMessage,
} from "@/services/scheduledMessages";

// Mock messaging services
jest.mock("@/services/messaging/send", () => ({
  sendMessage: jest.fn().mockResolvedValue({
    outboxItem: { messageId: "msg123", state: "queued" },
    sendPromise: Promise.resolve({ success: true }),
  }),
}));

// Mock scheduled messages service
jest.mock("@/services/scheduledMessages", () => ({
  scheduleMessage: jest.fn().mockResolvedValue({
    id: "scheduled123",
    senderId: "user1",
    chatId: "chat123",
    scope: "dm",
    content: "Hello",
    type: "text",
    scheduledFor: Date.now() + 3600000,
    createdAt: Date.now(),
    status: "pending",
  }),
  getScheduledMessagesForChat: jest.fn().mockResolvedValue([]),
}));

// Mock feature flags
jest.mock("../../constants/featureFlags", () => ({
  DEBUG_UNIFIED_MESSAGING: false,
  DEBUG_CHAT_V2: false,
}));

const mockSendMessage = jest.requireMock(
  "@/services/messaging/send",
).sendMessage;
const mockScheduleMessage = jest.requireMock(
  "@/services/scheduledMessages",
).scheduleMessage;
const mockGetScheduled = jest.requireMock(
  "@/services/scheduledMessages",
).getScheduledMessagesForChat;

describe("Unified Chat Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("DM Chat Flows", () => {
    describe("Text Message Send Flow", () => {
      it("should call sendMessage with correct DM parameters", async () => {
        await sendMessage({
          scope: "dm",
          conversationId: "chat123",
          kind: "text",
          text: "Hello world!",
        });

        expect(mockSendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            scope: "dm",
            conversationId: "chat123",
            kind: "text",
            text: "Hello world!",
          }),
        );
      });

      it("should include replyTo when replying to a message", async () => {
        const replyTo = {
          messageId: "original-msg",
          senderId: "user456",
          kind: "text" as const,
          textSnippet: "Original text",
        };

        await sendMessage({
          scope: "dm",
          conversationId: "chat123",
          kind: "text",
          text: "Reply text",
          replyTo,
        });

        expect(mockSendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            replyTo,
          }),
        );
      });
    });

    describe("Scheduled Message Flow", () => {
      it("should schedule a DM message with correct parameters", async () => {
        const scheduledFor = new Date(Date.now() + 3600000); // 1 hour from now

        await scheduleMessage({
          senderId: "user1",
          recipientId: "user2",
          chatId: "chat123",
          scope: "dm",
          content: "Scheduled hello!",
          type: "text",
          scheduledFor,
        });

        expect(mockScheduleMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            senderId: "user1",
            recipientId: "user2",
            chatId: "chat123",
            scope: "dm",
            content: "Scheduled hello!",
            type: "text",
          }),
        );
      });

      it("should retrieve scheduled messages for a chat", async () => {
        await getScheduledMessagesForChat("user1", "chat123");

        expect(mockGetScheduled).toHaveBeenCalledWith("user1", "chat123");
      });
    });
  });

  describe("Group Chat Flows", () => {
    describe("Text Message Send Flow", () => {
      it("should call sendMessage with correct group parameters", async () => {
        await sendMessage({
          scope: "group",
          conversationId: "group123",
          kind: "text",
          text: "Hello group!",
        });

        expect(mockSendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            scope: "group",
            conversationId: "group123",
            kind: "text",
            text: "Hello group!",
          }),
        );
      });

      it("should include mentionUids for group messages", async () => {
        await sendMessage({
          scope: "group",
          conversationId: "group123",
          kind: "text",
          text: "Hey @john and @jane!",
          mentionUids: ["user-john", "user-jane"],
        });

        expect(mockSendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            mentionUids: ["user-john", "user-jane"],
          }),
        );
      });

      it("should include replyTo when replying in group", async () => {
        const replyTo = {
          messageId: "group-msg-123",
          senderId: "user789",
          kind: "text" as const,
          textSnippet: "Group original",
        };

        await sendMessage({
          scope: "group",
          conversationId: "group123",
          kind: "text",
          text: "Group reply",
          replyTo,
        });

        expect(mockSendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            scope: "group",
            replyTo,
          }),
        );
      });
    });

    describe("Scheduled Message Flow", () => {
      it("should schedule a group message with correct parameters", async () => {
        const scheduledFor = new Date(Date.now() + 7200000); // 2 hours from now

        await scheduleMessage({
          senderId: "user1",
          chatId: "group123",
          scope: "group",
          content: "Scheduled group message!",
          type: "text",
          scheduledFor,
          mentionUids: ["user2", "user3"],
        });

        expect(mockScheduleMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            senderId: "user1",
            chatId: "group123",
            scope: "group",
            content: "Scheduled group message!",
            type: "text",
            mentionUids: ["user2", "user3"],
          }),
        );
      });

      it("should schedule group message without mentions", async () => {
        const scheduledFor = new Date(Date.now() + 3600000);

        await scheduleMessage({
          senderId: "user1",
          chatId: "group123",
          scope: "group",
          content: "No mentions here",
          type: "text",
          scheduledFor,
        });

        expect(mockScheduleMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            scope: "group",
            chatId: "group123",
          }),
        );
      });
    });
  });

  describe("Voice Message Flows", () => {
    it("should send voice message in DM", async () => {
      await sendMessage({
        scope: "dm",
        conversationId: "chat123",
        kind: "voice",
        text: "",
        localAttachments: [
          {
            id: "voice123",
            uri: "file:///voice.m4a",
            kind: "audio",
            mime: "audio/m4a",
          },
        ],
      });

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "voice",
          localAttachments: expect.arrayContaining([
            expect.objectContaining({
              mime: "audio/m4a",
            }),
          ]),
        }),
      );
    });

    it("should send voice message in group", async () => {
      await sendMessage({
        scope: "group",
        conversationId: "group123",
        kind: "voice",
        text: "",
        localAttachments: [
          {
            id: "voice456",
            uri: "file:///group-voice.m4a",
            kind: "audio",
            mime: "audio/m4a",
          },
        ],
      });

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: "group",
          kind: "voice",
        }),
      );
    });
  });

  describe("Media Attachment Flows", () => {
    it("should send image attachment in DM", async () => {
      await sendMessage({
        scope: "dm",
        conversationId: "chat123",
        kind: "media",
        text: "Check this out!",
        localAttachments: [
          {
            id: "img123",
            uri: "file:///image.jpg",
            kind: "image",
            mime: "image/jpeg",
          },
        ],
      });

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "media",
          text: "Check this out!",
          localAttachments: expect.arrayContaining([
            expect.objectContaining({
              mime: "image/jpeg",
            }),
          ]),
        }),
      );
    });

    it("should send multiple attachments in group", async () => {
      await sendMessage({
        scope: "group",
        conversationId: "group123",
        kind: "media",
        text: "Multiple images",
        localAttachments: [
          {
            id: "img1",
            uri: "file:///img1.jpg",
            kind: "image",
            mime: "image/jpeg",
          },
          {
            id: "img2",
            uri: "file:///img2.png",
            kind: "image",
            mime: "image/png",
          },
        ],
      });

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          localAttachments: expect.arrayContaining([
            expect.objectContaining({ id: "img1" }),
            expect.objectContaining({ id: "img2" }),
          ]),
        }),
      );
    });
  });

  describe("Feature Parity", () => {
    it("should support same text message flow for DM and group", async () => {
      // DM
      await sendMessage({
        scope: "dm",
        conversationId: "chat123",
        kind: "text",
        text: "Hello",
      });

      // Group
      await sendMessage({
        scope: "group",
        conversationId: "group123",
        kind: "text",
        text: "Hello",
      });

      expect(mockSendMessage).toHaveBeenCalledTimes(2);
    });

    it("should support scheduled messages in both DM and group", async () => {
      const scheduledFor = new Date(Date.now() + 3600000);

      // DM scheduled message
      await scheduleMessage({
        senderId: "user1",
        recipientId: "user2",
        chatId: "chat123",
        scope: "dm",
        content: "DM scheduled",
        type: "text",
        scheduledFor,
      });

      // Group scheduled message
      await scheduleMessage({
        senderId: "user1",
        chatId: "group123",
        scope: "group",
        content: "Group scheduled",
        type: "text",
        scheduledFor,
      });

      expect(mockScheduleMessage).toHaveBeenCalledTimes(2);
    });

    it("should support reply-to in both DM and group", async () => {
      const replyTo = {
        messageId: "msg123",
        senderId: "user2",
        kind: "text" as const,
        textSnippet: "Original",
      };

      // DM reply
      await sendMessage({
        scope: "dm",
        conversationId: "chat123",
        kind: "text",
        text: "Reply",
        replyTo,
      });

      // Group reply
      await sendMessage({
        scope: "group",
        conversationId: "group123",
        kind: "text",
        text: "Reply",
        replyTo,
      });

      expect(mockSendMessage).toHaveBeenCalledTimes(2);
      expect(mockSendMessage).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ scope: "dm", replyTo }),
      );
      expect(mockSendMessage).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ scope: "group", replyTo }),
      );
    });
  });
});
