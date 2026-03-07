import {
  normalizeFanoutDMConversation,
  normalizeFanoutGroupConversation,
} from "../../src/services/chat/fanoutInboxNormalization";
import { normalizeConversationFromInboxEntry } from "../../src/services/chat/normalizeInboxRow";

function comparableConversationShape(
  input: ReturnType<typeof normalizeConversationFromInboxEntry>,
) {
  return {
    id: input.id,
    type: input.type,
    name: input.name,
    otherUserId: input.otherUserId,
    unreadCount: input.unreadCount,
    memberState: {
      archived: input.memberState.archived,
      notifyLevel: input.memberState.notifyLevel,
      lastSeenAtPrivate: input.memberState.lastSeenAtPrivate,
      lastMarkedUnreadAt: input.memberState.lastMarkedUnreadAt,
    },
    lastMessage: input.lastMessage
      ? {
          text: input.lastMessage.text,
          timestamp: input.lastMessage.timestamp,
          type: input.lastMessage.type,
        }
      : null,
    participantCount: input.participantCount,
  };
}

describe("Inbox path parity", () => {
  it("normalizes DM fan-out and aggregated rows to the same shape", () => {
    const memberState = {
      uid: "u-me",
      archived: false,
      mutedUntil: null,
      notifyLevel: "all" as const,
      lastSeenAtPrivate: 1000,
    };

    const fanout = normalizeFanoutDMConversation({
      chatId: "chat-1",
      profile: {
        displayName: "Taylor",
        avatarUrl: null,
        profilePictureUrl: null,
        decorationId: null,
      },
      otherUserId: "u-taylor",
      memberState,
      chatData: {
        lastMessageText: "hello",
        lastMessageType: "text",
        lastMessageAt: 4000,
        createdAt: 500,
      },
    });

    const aggregated = normalizeConversationFromInboxEntry(
      {
        threadId: "dm:chat-1",
        scope: "dm",
        conversationId: "chat-1",
        lastActivityAt: 4000,
        lastSenderId: "u-taylor",
        lastMessageKind: "text",
        lastMessagePreview: "hello",
        unreadCount: 1,
        archived: false,
        notifyLevel: "all",
        otherUserId: "u-taylor",
        otherUserName: "Taylor",
      },
      memberState,
    );

    expect(comparableConversationShape(aggregated)).toEqual(
      comparableConversationShape(fanout),
    );
  });

  it("normalizes group fan-out and aggregated rows to the same shape", () => {
    const memberState = {
      uid: "u-me",
      archived: false,
      mutedUntil: null,
      notifyLevel: "mentions" as const,
      lastSeenAtPrivate: 1000,
    };

    const fanout = normalizeFanoutGroupConversation({
      groupId: "group-1",
      groupData: {
        name: "Study Group",
        avatarUrl: null,
        memberIds: ["u-me", "u-a", "u-b"],
        lastMessageText: "next class at 8",
        lastMessageSenderName: "A",
        lastMessageType: "text",
        lastMessageAt: 7000,
        createdAt: 100,
        memberCount: 3,
      },
      memberState,
    });

    const aggregated = normalizeConversationFromInboxEntry(
      {
        threadId: "group:group-1",
        scope: "group",
        conversationId: "group-1",
        lastActivityAt: 7000,
        lastSenderId: "u-a",
        lastMessageKind: "text",
        lastMessagePreview: "next class at 8",
        unreadCount: 1,
        archived: false,
        notifyLevel: "mentions",
        groupName: "Study Group",
        memberCount: 3,
      },
      memberState,
    );

    expect(comparableConversationShape(aggregated)).toEqual(
      comparableConversationShape(fanout),
    );
  });
});
