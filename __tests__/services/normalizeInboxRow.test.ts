import {
  computeUnreadCount,
  getDefaultMemberState,
  normalizeConversationFromInboxEntry,
  normalizeConversationRow,
  sortInboxConversations,
} from "../../src/services/chat/normalizeInboxRow";
import type { InboxConversation, InboxEntry } from "../../src/types/messaging";

describe("normalizeInboxRow", () => {
  const baseMember = {
    ...getDefaultMemberState("user-a"),
    lastSeenAtPrivate: 1_000,
  };

  it("computes unread by manual unread marker first", () => {
    expect(
      computeUnreadCount({
        lastActivityAt: 500,
        memberState: {
          ...baseMember,
          lastMarkedUnreadAt: 2_000,
        },
      }),
    ).toBe(1);
  });

  it("computes unread from activity watermark when newer than seen", () => {
    expect(
      computeUnreadCount({
        lastActivityAt: 7_000,
        memberState: {
          ...baseMember,
          lastSeenAtPrivate: 1_000,
        },
      }),
    ).toBe(1);
  });

  it("uses the server unread hint when watermark is missing", () => {
    expect(
      computeUnreadCount({
        lastActivityAt: 0,
        memberState: getDefaultMemberState("user-a"),
        unreadHintCount: 4,
      }),
    ).toBe(4);
  });

  it("uses optimistic read timestamp override", () => {
    const now = Date.now();
    expect(
      computeUnreadCount({
        lastActivityAt: now,
        memberState: {
          ...baseMember,
          lastSeenAtPrivate: 0,
        },
        recentlyReadAt: now,
        now,
      }),
    ).toBe(0);
  });

  it("normalizes fan-out and aggregated rows to the same conversation shape", () => {
    const memberState = {
      ...getDefaultMemberState("user-a"),
      lastSeenAtPrivate: 1_000,
      notifyLevel: "mentions" as const,
    };

    const fromFanout = normalizeConversationRow({
      id: "chat-1",
      type: "dm",
      name: "Taylor",
      otherUserId: "user-b",
      lastMessageText: "hello",
      lastMessageKind: "text",
      lastActivityAt: 4_000,
      createdAt: 4_000,
      memberState,
      unreadHintCount: 1,
    });

    const entry: InboxEntry = {
      threadId: "dm:chat-1",
      scope: "dm",
      conversationId: "chat-1",
      lastActivityAt: 4_000,
      lastSenderId: "user-b",
      lastMessageKind: "text",
      lastMessagePreview: "hello",
      unreadCount: 1,
      archived: false,
      notifyLevel: "mentions",
      otherUserId: "user-b",
      otherUserName: "Taylor",
    };

    const fromAggregated = normalizeConversationFromInboxEntry(
      entry,
      memberState,
    );

    expect(fromAggregated).toEqual(fromFanout);
  });

  it("sorts pinned conversations first then by activity timestamp", () => {
    const conv = (overrides: Partial<InboxConversation>): InboxConversation =>
      ({
        id: "id",
        type: "dm",
        name: "Name",
        avatarUrl: null,
        lastMessage: null,
        memberState: getDefaultMemberState("u"),
        unreadCount: 0,
        hasMentions: false,
        createdAt: 0,
        ...overrides,
      }) as InboxConversation;

    const list = sortInboxConversations([
      conv({
        id: "older",
        createdAt: 100,
      }),
      conv({
        id: "newer",
        createdAt: 300,
      }),
      conv({
        id: "pinned",
        memberState: {
          ...getDefaultMemberState("u"),
          pinnedAt: 9_000,
        },
      }),
    ]);

    expect(list.map((item) => item.id)).toEqual(["pinned", "newer", "older"]);
  });
});
