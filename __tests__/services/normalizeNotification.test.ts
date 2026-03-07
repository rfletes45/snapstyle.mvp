import {
  normalizeNotificationPayload,
  shouldHandleNotificationByDedupeKey,
} from "../../src/services/notifications/normalizeNotification";

describe("normalizeNotificationPayload", () => {
  it("normalizes legacy DM message payload", () => {
    const normalized = normalizeNotificationPayload({
      type: "message",
      senderId: "user-b",
      chatId: "chat-1",
    });

    expect(normalized).toEqual(
      expect.objectContaining({
        type: "message",
        dedupeKey: "message:chat-1",
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

  it("normalizes game and achievement payloads from v4 channels", () => {
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
    expect(achievement?.dedupeKey).toBe("achievement:champion");
  });

  it("returns null for unknown or malformed payloads", () => {
    expect(normalizeNotificationPayload(null)).toBeNull();
    expect(normalizeNotificationPayload({})).toBeNull();
    expect(normalizeNotificationPayload({ type: "unknown" })).toBeNull();
    expect(
      normalizeNotificationPayload({ type: "message", chatId: "chat-1" }),
    ).toBeNull();
  });

  it("produces stable dedupe keys across payload variants of same event", () => {
    const legacy = normalizeNotificationPayload({
      type: "message",
      senderId: "user-b",
      chatId: "chat-1",
    });
    const variant = normalizeNotificationPayload({
      type: "message",
      friendUid: "user-b",
      chatId: "chat-1",
    });

    expect(legacy?.dedupeKey).toBe("message:chat-1");
    expect(variant?.dedupeKey).toBe("message:chat-1");
  });

  it("dedupes repeated events within the window", () => {
    const dedupeMap = new Map<string, number>();
    const key = "message:chat-1";

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
