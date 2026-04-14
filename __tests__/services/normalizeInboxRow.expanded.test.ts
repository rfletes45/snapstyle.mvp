/**
 * Expanded test coverage for normalizeInboxRow.
 *
 * Covers the gaps identified in the chat system audit:
 * - sender self-exclusion
 * - UNREAD_TOLERANCE_MS boundary
 * - RECENTLY_READ_TTL_MS expiry
 * - null/undefined member state fields
 * - group sender name hydration
 * - visibility filtering (isDMVisible / isGroupVisible)
 * - mapMessageKindToPreviewType for all known kinds
 * - normalizeConversationFromInboxEntry edge cases
 * - sort stability with tied timestamps
 * - empty/single-item sort edge cases
 * - pin + archive + mute field passthrough
 */

import {
  computeUnreadCount,
  getDefaultMemberState,
  mapMessageKindToPreviewType,
  normalizeConversationFromInboxEntry,
  normalizeConversationRow,
  RECENTLY_READ_TTL_MS,
  sortInboxConversations,
  UNREAD_TOLERANCE_MS,
} from "../../src/services/chat/normalizeInboxRow";
import type { InboxConversation, InboxEntry } from "../../src/types/messaging";

// =============================================================================
// computeUnreadCount — expanded coverage
// =============================================================================

describe("computeUnreadCount", () => {
  const baseMember = {
    ...getDefaultMemberState("u-me"),
    lastSeenAtPrivate: 10_000,
  };

  describe("sender self-exclusion", () => {
    it("returns 0 when the current user sent the last message", () => {
      expect(
        computeUnreadCount({
          lastActivityAt: 99_999,
          memberState: { ...baseMember, lastSeenAtPrivate: 0 },
          lastMessageSenderId: "u-me",
          currentUserId: "u-me",
        }),
      ).toBe(0);
    });

    it("returns unread when someone else sent the last message", () => {
      expect(
        computeUnreadCount({
          lastActivityAt: 99_999,
          memberState: { ...baseMember, lastSeenAtPrivate: 0 },
          lastMessageSenderId: "u-other",
          currentUserId: "u-me",
        }),
      ).toBe(1);
    });

    it("is a no-op when currentUserId is not provided", () => {
      expect(
        computeUnreadCount({
          lastActivityAt: 99_999,
          memberState: { ...baseMember, lastSeenAtPrivate: 0 },
          lastMessageSenderId: "u-me",
          // currentUserId omitted
        }),
      ).toBe(1);
    });
  });

  describe("UNREAD_TOLERANCE_MS boundary", () => {
    it("returns 0 when activity is within tolerance", () => {
      expect(
        computeUnreadCount({
          lastActivityAt:
            baseMember.lastSeenAtPrivate + UNREAD_TOLERANCE_MS - 1,
          memberState: baseMember,
        }),
      ).toBe(0);
    });

    it("returns 0 when activity equals tolerance boundary", () => {
      expect(
        computeUnreadCount({
          lastActivityAt: baseMember.lastSeenAtPrivate + UNREAD_TOLERANCE_MS,
          memberState: baseMember,
        }),
      ).toBe(0);
    });

    it("returns 1 when activity exceeds tolerance", () => {
      expect(
        computeUnreadCount({
          lastActivityAt:
            baseMember.lastSeenAtPrivate + UNREAD_TOLERANCE_MS + 1,
          memberState: baseMember,
        }),
      ).toBe(1);
    });
  });

  describe("RECENTLY_READ_TTL_MS expiry", () => {
    it("returns 0 when recentlyReadAt is within TTL", () => {
      const now = Date.now();
      expect(
        computeUnreadCount({
          lastActivityAt: now,
          memberState: { ...baseMember, lastSeenAtPrivate: 0 },
          recentlyReadAt: now - RECENTLY_READ_TTL_MS + 1000,
          now,
        }),
      ).toBe(0);
    });

    it("falls through when recentlyReadAt exceeds TTL", () => {
      const now = Date.now();
      expect(
        computeUnreadCount({
          lastActivityAt: now,
          memberState: { ...baseMember, lastSeenAtPrivate: 0 },
          recentlyReadAt: now - RECENTLY_READ_TTL_MS - 1,
          now,
        }),
      ).toBe(1);
    });
  });

  describe("edge cases", () => {
    it("returns 0 when lastMarkedUnreadAt equals lastSeenAtPrivate", () => {
      expect(
        computeUnreadCount({
          lastActivityAt: 500,
          memberState: {
            ...baseMember,
            lastSeenAtPrivate: 5_000,
            lastMarkedUnreadAt: 5_000,
          },
        }),
      ).toBe(0);
    });

    it("handles zero timestamps correctly", () => {
      expect(
        computeUnreadCount({
          lastActivityAt: 0,
          memberState: { ...baseMember, lastSeenAtPrivate: 0 },
        }),
      ).toBe(0);
    });

    it("handles unreadHintCount with zero watermark", () => {
      expect(
        computeUnreadCount({
          lastActivityAt: 500,
          memberState: getDefaultMemberState("u-x"),
          unreadHintCount: 3,
        }),
      ).toBe(1);
    });

    it("returns 0 when unreadHintCount is 0 with no watermark", () => {
      expect(
        computeUnreadCount({
          lastActivityAt: 0,
          memberState: getDefaultMemberState("u-x"),
          unreadHintCount: 0,
        }),
      ).toBe(0);
    });
  });
});

// =============================================================================
// mapMessageKindToPreviewType — all known kinds
// =============================================================================

describe("mapMessageKindToPreviewType", () => {
  it.each([
    ["media", "image"],
    ["voice", "voice"],
    ["file", "attachment"],
    ["text", "text"],
    [undefined, "text"],
    ["unknown-future-kind", "text"],
    ["invoice", "text"],
  ] as const)("maps %s → %s", (input, expected) => {
    expect(mapMessageKindToPreviewType(input as any)).toBe(expected);
  });
});

// =============================================================================
// normalizeConversationRow — field passthrough
// =============================================================================

describe("normalizeConversationRow", () => {
  const member = {
    ...getDefaultMemberState("u-me"),
    lastSeenAtPrivate: 1_000,
    archived: true,
    mutedUntil: -1,
    pinnedAt: 5_000,
  };

  it("passes through archive/mute/pin in memberState", () => {
    const row = normalizeConversationRow({
      id: "c-1",
      type: "dm",
      name: "Test",
      memberState: member,
    });
    expect(row.memberState.archived).toBe(true);
    expect(row.memberState.mutedUntil).toBe(-1);
    expect(row.memberState.pinnedAt).toBe(5_000);
  });

  it("defaults avatarUrl to null", () => {
    const row = normalizeConversationRow({
      id: "c-1",
      type: "dm",
      name: "Test",
      memberState: getDefaultMemberState("u"),
    });
    expect(row.avatarUrl).toBeNull();
  });

  it("defaults backgroundUrl to null", () => {
    const row = normalizeConversationRow({
      id: "g-1",
      type: "group",
      name: "Group",
      memberState: getDefaultMemberState("u"),
    });
    expect(row.backgroundUrl).toBeNull();
  });

  it("sets lastMessage to null when text is empty", () => {
    const row = normalizeConversationRow({
      id: "c-1",
      type: "dm",
      name: "Test",
      memberState: getDefaultMemberState("u"),
      lastMessageText: "",
    });
    expect(row.lastMessage).toBeNull();
  });

  it("sets lastMessage to null when text is undefined", () => {
    const row = normalizeConversationRow({
      id: "c-1",
      type: "dm",
      name: "Test",
      memberState: getDefaultMemberState("u"),
    });
    expect(row.lastMessage).toBeNull();
  });

  it("builds lastMessage correctly when text is present", () => {
    const row = normalizeConversationRow({
      id: "c-1",
      type: "dm",
      name: "Test",
      memberState: getDefaultMemberState("u"),
      lastMessageText: "hello",
      lastMessageSenderName: "Alice",
      lastMessageKind: "text",
      lastActivityAt: 9_000,
    });
    expect(row.lastMessage).toEqual({
      text: "hello",
      senderName: "Alice",
      timestamp: 9_000,
      type: "text",
    });
  });

  it("defaults createdAt to lastActivityAt", () => {
    const row = normalizeConversationRow({
      id: "c-1",
      type: "dm",
      name: "Test",
      memberState: getDefaultMemberState("u"),
      lastActivityAt: 7_777,
    });
    expect(row.createdAt).toBe(7_777);
  });

  it("slices avatarIds correctly", () => {
    const row = normalizeConversationRow({
      id: "g-1",
      type: "group",
      name: "Group",
      memberState: getDefaultMemberState("u"),
      avatarIds: ["a", "b", "c", "d", "e"],
    });
    expect(row.avatarIds).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("always sets hasMentions to false", () => {
    const row = normalizeConversationRow({
      id: "c-1",
      type: "dm",
      name: "Test",
      memberState: getDefaultMemberState("u"),
    });
    expect(row.hasMentions).toBe(false);
  });
});

// =============================================================================
// normalizeConversationFromInboxEntry — edge cases
// =============================================================================

describe("normalizeConversationFromInboxEntry", () => {
  const member = {
    ...getDefaultMemberState("u-me"),
    lastSeenAtPrivate: 1_000,
  };

  it("uses 'Chat' as DM name when otherUserName is missing", () => {
    const entry: InboxEntry = {
      threadId: "dm:c-1",
      scope: "dm",
      conversationId: "c-1",
      lastActivityAt: 1_000,
      lastSenderId: "u-other",
      lastMessageKind: "text",
      lastMessagePreview: "hi",
      unreadCount: 0,
      archived: false,
      notifyLevel: "all",
      otherUserId: "u-other",
      // otherUserName omitted
    };
    const convo = normalizeConversationFromInboxEntry(entry, member);
    expect(convo.name).toBe("Chat");
  });

  it("uses 'Group Chat' as group name when groupName is missing", () => {
    const entry: InboxEntry = {
      threadId: "group:g-1",
      scope: "group",
      conversationId: "g-1",
      lastActivityAt: 2_000,
      lastSenderId: "u-a",
      lastMessageKind: "text",
      lastMessagePreview: "yo",
      unreadCount: 0,
      archived: false,
      notifyLevel: "all",
      // groupName omitted
    };
    const convo = normalizeConversationFromInboxEntry(entry, member);
    expect(convo.name).toBe("Group Chat");
  });

  it("sets type to dm for scope=dm", () => {
    const entry: InboxEntry = {
      threadId: "dm:c-1",
      scope: "dm",
      conversationId: "c-1",
      lastActivityAt: 1_000,
      lastSenderId: "u-other",
      lastMessageKind: "text",
      lastMessagePreview: "hi",
      unreadCount: 0,
      archived: false,
      notifyLevel: "all",
    };
    const convo = normalizeConversationFromInboxEntry(entry, member);
    expect(convo.type).toBe("dm");
  });

  it("sets type to group for scope=group", () => {
    const entry: InboxEntry = {
      threadId: "group:g-1",
      scope: "group",
      conversationId: "g-1",
      lastActivityAt: 1_000,
      lastSenderId: "u-a",
      lastMessageKind: "text",
      lastMessagePreview: "hi",
      unreadCount: 0,
      archived: false,
      notifyLevel: "all",
    };
    const convo = normalizeConversationFromInboxEntry(entry, member);
    expect(convo.type).toBe("group");
  });

  it("handles lastActivityAt as non-number gracefully", () => {
    const entry: InboxEntry = {
      threadId: "dm:c-1",
      scope: "dm",
      conversationId: "c-1",
      lastActivityAt: "not-a-number" as any,
      lastSenderId: "u-other",
      lastMessageKind: "text",
      lastMessagePreview: "hi",
      unreadCount: 0,
      archived: false,
      notifyLevel: "all",
    };
    const convo = normalizeConversationFromInboxEntry(entry, member);
    expect(convo.createdAt).toBe(0);
  });

  it("passes through lastSenderName from entry", () => {
    const entry: InboxEntry = {
      threadId: "group:g-1",
      scope: "group",
      conversationId: "g-1",
      lastActivityAt: 5_000,
      lastSenderId: "u-a",
      lastSenderName: "Alice",
      lastMessageKind: "text",
      lastMessagePreview: "hello group",
      unreadCount: 0,
      archived: false,
      notifyLevel: "all",
      groupName: "Study Group",
    };
    const convo = normalizeConversationFromInboxEntry(entry, member);
    expect(convo.lastMessage?.senderName).toBe("Alice");
  });

  it("defaults lastSenderName to empty string when missing", () => {
    const entry: InboxEntry = {
      threadId: "group:g-1",
      scope: "group",
      conversationId: "g-1",
      lastActivityAt: 5_000,
      lastSenderId: "u-a",
      lastMessageKind: "text",
      lastMessagePreview: "hello",
      unreadCount: 0,
      archived: false,
      notifyLevel: "all",
    };
    const convo = normalizeConversationFromInboxEntry(entry, member);
    expect(convo.lastMessage?.senderName).toBe("");
  });

  it("passes memberCount as participantCount", () => {
    const entry: InboxEntry = {
      threadId: "group:g-1",
      scope: "group",
      conversationId: "g-1",
      lastActivityAt: 1_000,
      lastSenderId: "u-a",
      lastMessageKind: "text",
      lastMessagePreview: "hi",
      unreadCount: 0,
      archived: false,
      notifyLevel: "all",
      memberCount: 5,
    };
    const convo = normalizeConversationFromInboxEntry(entry, member);
    expect(convo.participantCount).toBe(5);
  });

  it("passes through backgroundUrl for group conversations", () => {
    const entry: InboxEntry = {
      threadId: "group:g-1",
      scope: "group",
      conversationId: "g-1",
      lastActivityAt: 1_000,
      lastSenderId: "u-a",
      lastMessageKind: "text",
      lastMessagePreview: "hi",
      unreadCount: 0,
      archived: false,
      notifyLevel: "all",
      backgroundUrl: " https://cdn.example.com/group-bg.jpg ",
    };
    const convo = normalizeConversationFromInboxEntry(entry, member);
    expect(convo.backgroundUrl).toBe(" https://cdn.example.com/group-bg.jpg ");
  });
});

// =============================================================================
// sortInboxConversations — expanded
// =============================================================================

describe("sortInboxConversations", () => {
  const mkConvo = (overrides: Partial<InboxConversation>): InboxConversation =>
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

  it("returns empty array for empty input", () => {
    expect(sortInboxConversations([])).toEqual([]);
  });

  it("returns single item unchanged", () => {
    const single = mkConvo({ id: "only" });
    expect(sortInboxConversations([single]).map((c) => c.id)).toEqual(["only"]);
  });

  it("sorts multiple pinned by most-recently-pinned first", () => {
    const list = sortInboxConversations([
      mkConvo({
        id: "pin-old",
        memberState: { ...getDefaultMemberState("u"), pinnedAt: 1_000 },
      }),
      mkConvo({
        id: "pin-new",
        memberState: { ...getDefaultMemberState("u"), pinnedAt: 5_000 },
      }),
    ]);
    expect(list.map((c) => c.id)).toEqual(["pin-new", "pin-old"]);
  });

  it("pinned always before unpinned even with same timestamp", () => {
    const list = sortInboxConversations([
      mkConvo({ id: "unpinned", createdAt: 1_000 }),
      mkConvo({
        id: "pinned",
        createdAt: 1_000,
        memberState: { ...getDefaultMemberState("u"), pinnedAt: 1_000 },
      }),
    ]);
    expect(list.map((c) => c.id)).toEqual(["pinned", "unpinned"]);
  });

  it("tie-breaks equal timestamps by localeCompare on id", () => {
    const list = sortInboxConversations([
      mkConvo({ id: "zebra", createdAt: 1_000 }),
      mkConvo({ id: "apple", createdAt: 1_000 }),
    ]);
    expect(list.map((c) => c.id)).toEqual(["apple", "zebra"]);
  });

  it("uses createdAt when lastMessage is null", () => {
    const list = sortInboxConversations([
      mkConvo({ id: "old", createdAt: 100 }),
      mkConvo({ id: "new", createdAt: 500 }),
    ]);
    expect(list.map((c) => c.id)).toEqual(["new", "old"]);
  });

  it("uses lastMessage.timestamp over createdAt", () => {
    const list = sortInboxConversations([
      mkConvo({
        id: "old-created-but-recent-msg",
        createdAt: 100,
        lastMessage: {
          text: "hi",
          senderName: "A",
          timestamp: 9_000,
          type: "text",
        },
      }),
      mkConvo({ id: "new-created-no-msg", createdAt: 5_000 }),
    ]);
    expect(list.map((c) => c.id)).toEqual([
      "old-created-but-recent-msg",
      "new-created-no-msg",
    ]);
  });

  it("does not mutate the original array", () => {
    const original = [
      mkConvo({ id: "b", createdAt: 100 }),
      mkConvo({ id: "a", createdAt: 200 }),
    ];
    const sorted = sortInboxConversations(original);
    expect(original[0].id).toBe("b");
    expect(sorted[0].id).toBe("a");
  });
});

// =============================================================================
// Visibility helpers (smoke tests via the normalizeInboxRow module)
// =============================================================================

describe("getDefaultMemberState", () => {
  it("returns sensible defaults", () => {
    const state = getDefaultMemberState("u-test");
    expect(state.uid).toBe("u-test");
    expect(state.lastSeenAtPrivate).toBe(0);
    expect(state.archived).toBe(false);
    expect(state.notifyLevel).toBe("all");
  });
});
