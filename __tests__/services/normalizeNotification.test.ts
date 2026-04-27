import {
  normalizeNotificationPayload,
  shouldHandleNotificationByDedupeKey,
} from "../../src/services/notifications/normalizeNotification";

describe("normalizeNotificationPayload", () => {
  it("normalizes canonical DM message payload", () => {
    const normalized = normalizeNotificationPayload({
      type: "dm_message",
      actorUid: "user-b",
      conversationId: "chat-1",
      dedupeKey: "dm_message:chat-1:user-b",
    });

    expect(normalized).toEqual(
      expect.objectContaining({
        type: "dm_message",
        dedupeKey: "dm_message:chat-1:user-b",
        route: expect.objectContaining({
          screen: "ChatDetail",
          params: expect.objectContaining({ friendUid: "user-b" }),
        }),
      }),
    );
  });

  it("normalizes legacy group payload", () => {
    const normalized = normalizeNotificationPayload({
      type: "group_message",
      groupId: "group-1",
      groupName: "Study Group",
    });

    expect(normalized).toEqual(
      expect.objectContaining({
        type: "group_message",
        dedupeKey: "group_message:group-1",
      }),
    );
    expect(normalized?.route.screen).toBe("GroupChat");
  });

  it("normalizes game and achievement payloads from the shared center", () => {
    const game = normalizeNotificationPayload({
      type: "game_turn",
      sessionId: "sess-1",
      gameId: "tic_tac_toe",
    });
    const achievement = normalizeNotificationPayload({
      type: "achievement_unlocked",
      gameId: "tic_tac_toe",
    });

    expect(game?.route.screen).toBe("GamePlayV4");
    expect(game?.dedupeKey).toBe("game_turn:sess-1");
    expect(achievement?.route.screen).toBe("GameDetailV4");
    expect(achievement?.dedupeKey).toBe("achievement_unlocked:tic_tac_toe");
  });

  it("returns null for unknown or malformed payloads", () => {
    expect(normalizeNotificationPayload(null)).toBeNull();
    expect(normalizeNotificationPayload({})).toBeNull();
    expect(normalizeNotificationPayload({ type: "unknown" })).toBeNull();
    expect(
      normalizeNotificationPayload({ type: "dm_message", chatId: "chat-1" }),
    ).toBeNull();
  });

  it("produces stable dedupe keys across payload variants of the same DM event", () => {
    const legacy = normalizeNotificationPayload({
      type: "message",
      senderId: "user-b",
      chatId: "chat-1",
    });
    const variant = normalizeNotificationPayload({
      type: "dm_message",
      actorUid: "user-b",
      conversationId: "chat-1",
    });

    expect(legacy?.dedupeKey).toBe("dm_message:chat-1");
    expect(variant?.dedupeKey).toBe("dm_message:chat-1");
  });

  it("uses explicit nested routes from the payload when present", () => {
    const normalized = normalizeNotificationPayload({
      type: "message_request",
      dedupeKey: "message_request:chat-9",
      route: {
        screen: "MainTabs",
        params: {
          screen: "Messages",
          params: {
            screen: "ChatList",
            params: { initialFilter: "requests" },
          },
        },
      },
    });

    expect(normalized?.route).toEqual({
      screen: "MainTabs",
      params: {
        screen: "Messages",
        params: {
          screen: "ChatList",
          params: { initialFilter: "requests" },
        },
      },
    });
  });

  it("repairs legacy MainTabs routes that target root-stack screens", () => {
    const normalized = normalizeNotificationPayload({
      type: "message_request",
      dedupeKey: "message_request:chat-9",
      route: {
        screen: "MainTabs",
        params: {
          screen: "Friends",
          params: {
            tab: "requests",
          },
        },
      },
    });

    expect(normalized?.route).toEqual({
      screen: "Friends",
      params: {
        tab: "requests",
      },
    });
  });

  it("routes message request fallbacks directly to friend requests", () => {
    const normalized = normalizeNotificationPayload({
      type: "message_request",
      conversationId: "chat-9",
    });

    expect(normalized?.route).toEqual({
      screen: "Friends",
      params: {
        tab: "requests",
      },
    });
  });

  it("does not let story-view notifications fall through to bare MainTabs", () => {
    const normalized = normalizeNotificationPayload({
      type: "story_viewed",
    });

    expect(normalized?.route).toEqual({
      screen: "MainTabs",
      params: {
        screen: "Profile",
      },
    });
  });

  it("ignores bare MainTabs payload routes in favor of typed fallbacks", () => {
    const normalized = normalizeNotificationPayload({
      type: "dm_message",
      actorUid: "user-b",
      conversationId: "chat-1",
      route: {
        screen: "MainTabs",
      },
    });

    expect(normalized?.route.screen).toBe("ChatDetail");
    expect(normalized?.route.params).toEqual(
      expect.objectContaining({ friendUid: "user-b" }),
    );
  });

  it("routes gift notifications to purchase history", () => {
    const normalized = normalizeNotificationPayload({
      type: "gift_received",
      giftId: "gift-1",
    });

    expect(normalized?.route.screen).toBe("PurchaseHistory");
    expect(normalized?.dedupeKey).toBe("gift_received:gift-1");
  });

  it("dedupes repeated events within the window", () => {
    const dedupeMap = new Map<string, number>();
    const key = "dm_message:chat-1";

    expect(
      shouldHandleNotificationByDedupeKey(dedupeMap, key, 10_000, 1_500),
    ).toBe(true);
    expect(
      shouldHandleNotificationByDedupeKey(dedupeMap, key, 11_000, 1_500),
    ).toBe(false);
    expect(
      shouldHandleNotificationByDedupeKey(dedupeMap, key, 12_600, 1_500),
    ).toBe(true);
  });

  it("includes highlightMessageId for group mention notifications", () => {
    const normalized = normalizeNotificationPayload({
      type: "group_message",
      groupId: "group-1",
      groupName: "Study Group",
      mentioned: "true",
      messageId: "msg-42",
    });

    expect(normalized?.route.screen).toBe("GroupChat");
    expect(normalized?.route.params).toEqual(
      expect.objectContaining({
        highlightMessageId: "msg-42",
      }),
    );
  });

  it("omits highlightMessageId when not mentioned", () => {
    const normalized = normalizeNotificationPayload({
      type: "group_message",
      groupId: "group-1",
      groupName: "Study Group",
    });

    expect(normalized?.route.params).not.toHaveProperty("highlightMessageId");
  });
});
