/* eslint-disable import/first */

jest.mock("@/services/database", () => ({
  getDatabaseUnavailableReason: jest.fn(() => "test"),
  isDatabaseRuntimeAvailable: jest.fn(() => false),
}));

jest.mock("@/services/database/messageRepository", () => ({
  getMessagesByStatus: jest.fn(() => []),
}));

import {
  applyOptimisticInboxUpdate,
  buildOptimisticPreviewText,
} from "../../src/services/chat/inboxOptimisticUpdates";
import { getDefaultMemberState } from "../../src/services/chat/normalizeInboxRow";
import type {
  InboxConversation,
  MessageKind,
} from "../../src/types/messaging";

function mkConvo(
  overrides: Partial<InboxConversation> = {},
): InboxConversation {
  return {
    id: "chat-1",
    type: "dm",
    name: "Test",
    avatarUrl: null,
    lastMessage: null,
    memberState: getDefaultMemberState("me"),
    unreadCount: 0,
    hasMentions: false,
    createdAt: 1_000,
    lastActivityAt: 1_000,
    ...overrides,
  };
}

function mkUpdate(overrides: {
  timestamp?: number;
  senderId?: string;
  messageKind?: MessageKind;
  previewText?: string;
} = {}) {
  return {
    scope: "dm" as const,
    conversationId: "chat-1",
    messageId: "message-1",
    messageKind: overrides.messageKind ?? ("text" as const),
    previewText: overrides.previewText ?? "hello",
    senderId: overrides.senderId ?? "me",
    timestamp: overrides.timestamp ?? 2_000,
  };
}

describe("inboxOptimisticUpdates", () => {
  it("builds stable preview text for local pending media", () => {
    expect(buildOptimisticPreviewText("media", null)).toBe("Photo");
    expect(buildOptimisticPreviewText("voice", null)).toBe("Voice message");
    expect(buildOptimisticPreviewText("file", null)).toBe("Attachment");
    expect(buildOptimisticPreviewText("text", "  hi  ")).toBe("hi");
  });

  it("applies a newer pending outgoing message using attempted send time", () => {
    const updated = applyOptimisticInboxUpdate(
      mkConvo(),
      mkUpdate({ timestamp: 3_000 }),
      "me",
    );

    expect(updated.lastActivityAt).toBe(3_000);
    expect(updated.lastMessage).toEqual({
      text: "hello",
      senderName: "",
      timestamp: 3_000,
      type: "text",
    });
    expect(updated.unreadCount).toBe(0);
    expect(updated.memberState.lastSeenAtPrivate).toBe(3_000);
  });

  it("does not let retry metadata re-bump an already newer conversation", () => {
    const conversation = mkConvo({
      id: "chat-1",
      lastActivityAt: 5_000,
      lastMessage: {
        text: "newer server message",
        senderName: "",
        timestamp: 5_000,
        type: "text",
      },
    }) as InboxConversation & { updatedAt: number };
    conversation.updatedAt = 9_000;

    const updated = applyOptimisticInboxUpdate(
      conversation,
      mkUpdate({ timestamp: 3_000 }),
      "me",
    );

    expect(updated).toBe(conversation);
    expect(updated.lastActivityAt).toBe(5_000);
  });

  it("keeps failed messages ordered by their original attempted timestamp", () => {
    const updated = applyOptimisticInboxUpdate(
      mkConvo({ lastActivityAt: 1_000 }),
      { ...mkUpdate({ timestamp: 2_500 }), persisted: true },
      "me",
    );

    expect(updated.lastActivityAt).toBe(2_500);
    expect(updated.lastMessage?.timestamp).toBe(2_500);
  });

  it("preserves unread count for optimistic incoming activity", () => {
    const updated = applyOptimisticInboxUpdate(
      mkConvo({ unreadCount: 2 }),
      mkUpdate({ senderId: "other", timestamp: 3_000 }),
      "me",
    );

    expect(updated.unreadCount).toBe(2);
    expect(updated.memberState.lastSeenAtPrivate).toBe(0);
  });
});
