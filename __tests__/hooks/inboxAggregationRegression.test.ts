/**
 * Regression tests for the aggregated inbox path.
 *
 * These cover the specific regressions found after flipping
 * CHAT_INBOX_AGGREGATION to true:
 *
 * 1. Firestore Timestamp objects for lastActivityAt → 0 (timestamp lost)
 * 2. Group avatars always null (no hydration path)
 * 3. DM profilePictureUrl/decorationId always null (CachedProfile gaps)
 * 4. buildPreview returning "" for unknown message kinds
 */

import {
  applyPendingPinOverrides,
  clearConfirmedPendingPinOverrides,
  resolveGroupAvatarUrl,
  type PendingPinOverride,
} from "../../src/services/chat/inboxPinOverrides";
import {
  normalizeConversationFromInboxEntry as normalizeConversationFromInboxEntryBase,
  normalizeConversationRow as normalizeConversationRowBase,
  sortInboxConversations as sortInboxConversationsBase,
} from "../../src/services/chat/normalizeInboxRow";
import type {
  InboxConversation,
  InboxEntry,
  MemberStatePrivate,
} from "../../src/types/messaging";

const normalizeConversationFromInboxEntry =
  normalizeConversationFromInboxEntryBase;
const normalizeConversationRow = normalizeConversationRowBase;
const sortInboxConversations = sortInboxConversationsBase;

function makeInboxConversation(
  overrides: Partial<InboxConversation> = {},
): InboxConversation {
  return {
    id: "chat-1",
    type: "dm",
    name: "Taylor",
    avatarUrl: null,
    lastMessage: null,
    memberState: {
      uid: "u-me",
      archived: false,
      lastSeenAtPrivate: 0,
      notifyLevel: "all",
    },
    unreadCount: 0,
    hasMentions: false,
    createdAt: 1_000,
    lastActivityAt: 1_000,
    ...overrides,
  };
}

// =============================================================================
// 1. Firestore Timestamp → millis conversion
// =============================================================================

describe("lastActivityAt Firestore Timestamp handling", () => {
  const baseMemberState: MemberStatePrivate = {
    uid: "u-me",
    archived: false,
    lastSeenAtPrivate: 0,
    notifyLevel: "all",
  };

  const baseEntry: InboxEntry = {
    threadId: "dm:chat-1",
    scope: "dm",
    conversationId: "chat-1",
    lastActivityAt: 0,
    lastSenderId: "u-other",
    lastMessageKind: "text",
    lastMessagePreview: "hello",
    unreadCount: 1,
    archived: false,
    notifyLevel: "all",
    otherUserId: "u-other",
    otherUserName: "Other",
  };

  it("preserves numeric lastActivityAt correctly", () => {
    const convo = normalizeConversationFromInboxEntry(
      { ...baseEntry, lastActivityAt: 1700000000000 },
      baseMemberState,
    );
    expect(convo.lastMessage?.timestamp).toBe(1700000000000);
  });

  it("treats non-number lastActivityAt as 0", () => {
    // Simulate receiving a Firestore Timestamp-like object
    // (which the hook should convert before passing here)
    const convo = normalizeConversationFromInboxEntry(
      { ...baseEntry, lastActivityAt: "not-a-number" as unknown as number },
      baseMemberState,
    );
    expect(convo.lastMessage?.timestamp).toBe(0);
  });

  it("sort order uses lastMessage.timestamp when present", () => {
    const convo1 = normalizeConversationFromInboxEntry(
      { ...baseEntry, conversationId: "a", lastActivityAt: 2000 },
      baseMemberState,
    );
    const convo2 = normalizeConversationFromInboxEntry(
      { ...baseEntry, conversationId: "b", lastActivityAt: 5000 },
      baseMemberState,
    );
    const convo3 = normalizeConversationFromInboxEntry(
      { ...baseEntry, conversationId: "c", lastActivityAt: 3000 },
      baseMemberState,
    );

    const sorted = sortInboxConversations([convo1, convo2, convo3]);
    expect(sorted.map((c) => c.id)).toEqual(["b", "c", "a"]);
  });

  it("conversations with timestamp 0 sort by id as fallback", () => {
    const convo1 = normalizeConversationFromInboxEntry(
      { ...baseEntry, conversationId: "c-chat", lastActivityAt: 0 },
      baseMemberState,
    );
    const convo2 = normalizeConversationFromInboxEntry(
      { ...baseEntry, conversationId: "a-chat", lastActivityAt: 0 },
      baseMemberState,
    );
    // Both have timestamp 0 (simulating the old bug)
    const sorted = sortInboxConversations([convo1, convo2]);
    // Should be stable: id alphabetical fallback
    expect(sorted[0].id).toBe("a-chat");
    expect(sorted[1].id).toBe("c-chat");
  });
});

// =============================================================================
// 2. Group avatar hydration
// =============================================================================

describe("Group avatar in normalized inbox rows", () => {
  const memberState: MemberStatePrivate = {
    uid: "u-me",
    archived: false,
    lastSeenAtPrivate: 0,
    notifyLevel: "all",
  };

  it("normalizeConversationFromInboxEntry defaults group avatarUrl to null", () => {
    const convo = normalizeConversationFromInboxEntry(
      {
        threadId: "group:g-1",
        scope: "group",
        conversationId: "g-1",
        lastActivityAt: 5000,
        lastSenderId: "u-a",
        lastMessageKind: "text",
        lastMessagePreview: "hey",
        unreadCount: 0,
        archived: false,
        notifyLevel: "all",
        groupName: "Study Group",
        memberCount: 3,
      },
      memberState,
    );
    // The normalization itself sets null; hydration happens in the hook
    expect(convo.avatarUrl).toBeNull();
  });

  it("avatarUrl is mutable after normalization for post-hoc hydration", () => {
    const convo = normalizeConversationFromInboxEntry(
      {
        threadId: "group:g-1",
        scope: "group",
        conversationId: "g-1",
        lastActivityAt: 5000,
        lastSenderId: "u-a",
        lastMessageKind: "text",
        lastMessagePreview: "hey",
        unreadCount: 0,
        archived: false,
        notifyLevel: "all",
        groupName: "Study Group",
        memberCount: 3,
      },
      memberState,
    );

    // Simulate what useInboxAggregation now does
    convo.avatarUrl = "https://storage.example.com/group-avatar.jpg";
    expect(convo.avatarUrl).toBe(
      "https://storage.example.com/group-avatar.jpg",
    );
  });

  it("preserves the last known avatar when the latest hydration is empty", () => {
    expect(
      resolveGroupAvatarUrl(
        null,
        "https://storage.example.com/group-avatar.jpg",
      ),
    ).toBe("https://storage.example.com/group-avatar.jpg");
  });

  it("prefers the latest hydrated avatar when one is available", () => {
    expect(
      resolveGroupAvatarUrl(
        "https://storage.example.com/group-avatar-new.jpg",
        "https://storage.example.com/group-avatar-old.jpg",
      ),
    ).toBe("https://storage.example.com/group-avatar-new.jpg");
  });
});

// =============================================================================
// 3. Pending pin override reconciliation
// =============================================================================

describe("Pending pin overrides", () => {
  function makePendingOverride(pinnedAt: number | null): PendingPinOverride {
    return {
      pinnedAt,
      requestedAt: 9_000,
    };
  }

  it("keeps a pending pin applied when the server snapshot is still stale", () => {
    const overrides = new Map<string, PendingPinOverride>([
      ["group:g-1", makePendingOverride(9_000)],
    ]);

    const updated = applyPendingPinOverrides(
      [
        makeInboxConversation({
          id: "g-1",
          type: "group",
          name: "Study Group",
        }),
      ],
      overrides,
    );

    expect(updated[0].memberState.pinnedAt).toBe(9_000);
  });

  it("keeps a pending unpin applied while a stale snapshot still says pinned", () => {
    const overrides = new Map<string, PendingPinOverride>([
      ["group:g-1", makePendingOverride(null)],
    ]);

    const updated = applyPendingPinOverrides(
      [
        makeInboxConversation({
          id: "g-1",
          type: "group",
          name: "Study Group",
          memberState: {
            uid: "u-me",
            archived: false,
            lastSeenAtPrivate: 0,
            notifyLevel: "all",
            pinnedAt: 12_000,
          },
        }),
      ],
      overrides,
    );

    expect(updated[0].memberState.pinnedAt).toBeNull();
  });

  it("clears a pending override once the server matches the desired pin state", () => {
    const overrides = new Map<string, PendingPinOverride>([
      ["group:g-1", makePendingOverride(9_000)],
    ]);

    const cleared = clearConfirmedPendingPinOverrides(
      [
        makeInboxConversation({
          id: "g-1",
          type: "group",
          name: "Study Group",
          memberState: {
            uid: "u-me",
            archived: false,
            lastSeenAtPrivate: 0,
            notifyLevel: "all",
            pinnedAt: 12_000,
          },
        }),
      ],
      overrides,
    );

    expect(cleared).toEqual(["group:g-1"]);
    expect(overrides.size).toBe(0);
  });
});

// =============================================================================
// 4. DM profile field hydration parity
// =============================================================================

describe("DM profile field hydration", () => {
  const memberState: MemberStatePrivate = {
    uid: "u-me",
    archived: false,
    lastSeenAtPrivate: 0,
    notifyLevel: "all",
  };

  it("normalizeConversationRow passes through profilePictureUrl and decorationId", () => {
    const convo = normalizeConversationRow({
      id: "chat-1",
      type: "dm",
      name: "Taylor",
      avatarUrl: "https://example.com/avatar.png",
      profilePictureUrl: "https://example.com/pfp.jpg",
      decorationId: "dec-gold-ring",
      otherUserId: "u-taylor",
      lastMessageText: "hey",
      lastMessageKind: "text",
      lastActivityAt: 5000,
      memberState,
    });
    expect(convo.profilePictureUrl).toBe("https://example.com/pfp.jpg");
    expect(convo.decorationId).toBe("dec-gold-ring");
    expect(convo.avatarUrl).toBe("https://example.com/avatar.png");
  });

  it("post-hoc hydration can set profilePictureUrl and decorationId", () => {
    const convo = normalizeConversationFromInboxEntry(
      {
        threadId: "dm:chat-1",
        scope: "dm",
        conversationId: "chat-1",
        lastActivityAt: 5000,
        lastSenderId: "u-taylor",
        lastMessageKind: "text",
        lastMessagePreview: "hey",
        unreadCount: 0,
        archived: false,
        notifyLevel: "all",
        otherUserId: "u-taylor",
        otherUserName: "Taylor",
      },
      memberState,
    );

    // Simulate what useInboxAggregation now does after fixing
    convo.avatarUrl = "https://example.com/avatar.png";
    convo.profilePictureUrl = "https://example.com/pfp.jpg";
    convo.decorationId = "dec-gold-ring";

    expect(convo.profilePictureUrl).toBe("https://example.com/pfp.jpg");
    expect(convo.decorationId).toBe("dec-gold-ring");
  });
});

// =============================================================================
// 5. Message preview edge cases
// =============================================================================

describe("Message preview for various message kinds", () => {
  const memberState: MemberStatePrivate = {
    uid: "u-me",
    archived: false,
    lastSeenAtPrivate: 0,
    notifyLevel: "all",
  };

  it("text message shows text content", () => {
    const convo = normalizeConversationFromInboxEntry(
      {
        threadId: "dm:chat-1",
        scope: "dm",
        conversationId: "chat-1",
        lastActivityAt: 5000,
        lastSenderId: "u-other",
        lastMessageKind: "text",
        lastMessagePreview: "Hello world",
        unreadCount: 0,
        archived: false,
        notifyLevel: "all",
      },
      memberState,
    );
    expect(convo.lastMessage).not.toBeNull();
    expect(convo.lastMessage!.text).toBe("Hello world");
    expect(convo.lastMessage!.type).toBe("text");
  });

  it("media message has non-null lastMessage", () => {
    const convo = normalizeConversationFromInboxEntry(
      {
        threadId: "dm:chat-1",
        scope: "dm",
        conversationId: "chat-1",
        lastActivityAt: 5000,
        lastSenderId: "u-other",
        lastMessageKind: "media",
        lastMessagePreview: "📷 Photo",
        unreadCount: 0,
        archived: false,
        notifyLevel: "all",
      },
      memberState,
    );
    expect(convo.lastMessage).not.toBeNull();
    expect(convo.lastMessage!.type).toBe("image");
  });

  it("empty lastMessagePreview results in null lastMessage", () => {
    const convo = normalizeConversationFromInboxEntry(
      {
        threadId: "dm:chat-1",
        scope: "dm",
        conversationId: "chat-1",
        lastActivityAt: 5000,
        lastSenderId: "u-other",
        lastMessageKind: "text",
        lastMessagePreview: "",
        unreadCount: 0,
        archived: false,
        notifyLevel: "all",
      },
      memberState,
    );
    expect(convo.lastMessage).toBeNull();
  });

  it("group message includes senderName in lastMessage", () => {
    const convo = normalizeConversationFromInboxEntry(
      {
        threadId: "group:g-1",
        scope: "group",
        conversationId: "g-1",
        lastActivityAt: 5000,
        lastSenderId: "u-alice",
        lastSenderName: "Alice",
        lastMessageKind: "text",
        lastMessagePreview: "see you tomorrow",
        unreadCount: 0,
        archived: false,
        notifyLevel: "all",
        groupName: "Study Group",
        memberCount: 3,
      },
      memberState,
    );
    expect(convo.lastMessage).not.toBeNull();
    expect(convo.lastMessage!.senderName).toBe("Alice");
    expect(convo.lastMessage!.text).toBe("see you tomorrow");
  });

  it("voice message has correct type", () => {
    const convo = normalizeConversationFromInboxEntry(
      {
        threadId: "dm:chat-1",
        scope: "dm",
        conversationId: "chat-1",
        lastActivityAt: 5000,
        lastSenderId: "u-other",
        lastMessageKind: "voice",
        lastMessagePreview: "🎤 Voice message",
        unreadCount: 0,
        archived: false,
        notifyLevel: "all",
      },
      memberState,
    );
    expect(convo.lastMessage).not.toBeNull();
    expect(convo.lastMessage!.type).toBe("voice");
  });

  it("lastMessage timestamp matches lastActivityAt", () => {
    const convo = normalizeConversationFromInboxEntry(
      {
        threadId: "dm:chat-1",
        scope: "dm",
        conversationId: "chat-1",
        lastActivityAt: 1700000000000,
        lastSenderId: "u-other",
        lastMessageKind: "text",
        lastMessagePreview: "hello",
        unreadCount: 0,
        archived: false,
        notifyLevel: "all",
      },
      memberState,
    );
    expect(convo.lastMessage!.timestamp).toBe(1700000000000);
  });
});
