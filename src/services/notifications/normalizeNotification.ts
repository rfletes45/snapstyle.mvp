export type CanonicalNotificationType =
  | "message"
  | "group_message"
  | "friend_request"
  | "game_turn"
  | "achievement_unlocked";

export interface CanonicalNotificationRoute {
  screen:
    | "ChatDetail"
    | "GroupChat"
    | "Connections"
    | "GamePlayV4"
    | "AchievementSection"
    | "AchievementsHub";
  params?: Record<string, unknown>;
}

export interface CanonicalNotification {
  type: CanonicalNotificationType;
  dedupeKey: string;
  route: CanonicalNotificationRoute;
}

export const NOTIFICATION_DEDUPE_WINDOW_MS = 1500;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function normalizeNotificationPayload(
  rawPayload: unknown,
): CanonicalNotification | null {
  const payload = asRecord(rawPayload);
  if (!payload) return null;

  const type = asString(payload.type);
  if (!type) return null;

  if (type === "message") {
    const senderId = asString(payload.senderId) || asString(payload.friendUid);
    if (!senderId) return null;
    const chatId = asString(payload.chatId);
    return {
      type: "message",
      dedupeKey: `message:${chatId ?? senderId}`,
      route: {
        screen: "ChatDetail",
        params: {
          friendUid: senderId,
          initialData: chatId ? { chatId } : undefined,
        },
      },
    };
  }

  if (type === "group_message") {
    const groupId = asString(payload.groupId);
    if (!groupId) return null;
    const groupName = asString(payload.groupName);
    return {
      type: "group_message",
      dedupeKey: `group_message:${groupId}`,
      route: {
        screen: "GroupChat",
        params: {
          groupId,
          groupName,
        },
      },
    };
  }

  if (type === "friend_request") {
    return {
      type: "friend_request",
      dedupeKey: "friend_request",
      route: {
        screen: "Connections",
      },
    };
  }

  if (type === "game_turn") {
    const sessionId = asString(payload.sessionId);
    const gameId = asString(payload.gameId);
    if (!sessionId) return null;
    return {
      type: "game_turn",
      dedupeKey: `game_turn:${sessionId}`,
      route: {
        screen: "GamePlayV4",
        params: {
          sessionId,
          gameId,
        },
      },
    };
  }

  if (type === "achievement_unlocked") {
    const sectionId = asString(payload.sectionId);
    return {
      type: "achievement_unlocked",
      dedupeKey: `achievement:${sectionId ?? "hub"}`,
      route: sectionId
        ? {
            screen: "AchievementSection",
            params: { sectionId },
          }
        : {
            screen: "AchievementsHub",
          },
    };
  }

  return null;
}

export function shouldHandleNotificationByDedupeKey(
  dedupeMap: Map<string, number>,
  dedupeKey: string,
  now: number = Date.now(),
  dedupeWindowMs: number = NOTIFICATION_DEDUPE_WINDOW_MS,
): boolean {
  const lastHandledAt = dedupeMap.get(dedupeKey);
  if (lastHandledAt && now - lastHandledAt < dedupeWindowMs) {
    return false;
  }

  dedupeMap.set(dedupeKey, now);

  if (dedupeMap.size > 200) {
    const staleBefore = now - dedupeWindowMs * 4;
    for (const [key, timestamp] of dedupeMap) {
      if (timestamp < staleBefore) dedupeMap.delete(key);
    }
  }

  return true;
}
