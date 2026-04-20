import { mergeUnifiedInboxRequests } from "../../src/services/chat/unifiedInboxRequests";

describe("useUnifiedInboxRequests helpers", () => {
  it("merges/sorts/dedupes request items across all sources", () => {
    const merged = mergeUnifiedInboxRequests({
      friendRequests: [
        {
          id: "fr-1",
          fromUserId: "u1",
          fromUser: {
            displayName: "Friend",
            avatarUrl: null,
            avatarConfig: null,
            username: "friend",
          },
          sentAt: 1_000,
          status: "pending",
        } as any,
      ],
      groupInvites: [
        {
          id: "gi-1",
          groupId: "g1",
          groupName: "Group",
          fromUid: "u2",
          fromDisplayName: "Inviter",
          toUid: "u-me",
          status: "pending",
          createdAt: 3_000,
          expiresAt: 9_999,
        },
      ],
      messageRequests: [
        {
          chatId: "chat-1",
          requesterId: "u3",
          requesterName: "Requester",
          status: "pending",
          createdAt: 2_000,
          messagePreview: "hey",
          messageKind: "text",
        },
      ],
    });

    expect(merged.map((item) => item.kind)).toEqual([
      "group_invite",
      "message_request",
      "friend_request",
    ]);
    expect(new Set(merged.map((item) => `${item.kind}:${item.id}`)).size).toBe(
      3,
    );
  });
});
