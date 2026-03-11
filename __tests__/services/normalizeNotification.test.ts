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
      sectionId: "champion",
    });

    expect(game?.route.screen).toBe("GamePlayV4");
    expect(game?.dedupeKey).toBe("game_turn:sess-1");
    expect(achievement?.route.screen).toBe("AchievementSection");
    expect(achievement?.dedupeKey).toBe("achievement_unlocked:champion");
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
          screen: "Inbox",
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
        screen: "Inbox",
        params: {
          screen: "ChatList",
          params: { initialFilter: "requests" },
        },
      },
    });
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
      shouldHandleNotificationByDedupeKey(
        dedupeMap,
        key,
        10_000,
        1_500,
      ),
    ).toBe(true);
    expect(
      shouldHandleNotificationByDedupeKey(
        dedupeMap,
        key,
        11_000,
        1_500,
      ),
    ).toBe(false);
    expect(
      shouldHandleNotificationByDedupeKey(
        dedupeMap,
        key,
        12_600,
        1_500,
      ),
    ).toBe(true);
  });
});
