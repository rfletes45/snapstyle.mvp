export type CanonicalNotificationType =
  | "dm_message"
  | "group_message"
  | "message_request"
  | "friend_request"
  | "friend_request_accepted"
  | "game_invite"
  | "game_lobby_ready"
  | "game_turn"
  | "game_resolved"
  | "achievement_unlocked"
  | "gift_received"
  | "gift_opened"
  | "streak_milestone"
  | "streak_at_risk"
  | "cosmetic_unlock"
  | "story_viewed";

export interface CanonicalNotificationRoute {
  screen: string;
  params?: Record<string, unknown>;
}

export interface CanonicalNotification {
  type: CanonicalNotificationType;
  dedupeKey: string;
  notificationId?: string;
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

function asRoute(value: unknown): CanonicalNotificationRoute | undefined {
  const route = asRecord(value);
  if (!route) return undefined;
  const screen = asString(route.screen);
  if (!screen) return undefined;
  return {
    screen,
    params: asRecord(route.params) ?? undefined,
  };
}

function buildDedupeKey(
  payload: Record<string, unknown>,
  fallback: string,
): string {
  return asString(payload.dedupeKey) ?? fallback;
}

export function normalizeNotificationPayload(
  rawPayload: unknown,
): CanonicalNotification | null {
  const payload = asRecord(rawPayload);
  if (!payload) return null;

  const routeFromPayload = asRoute(payload.route);
  const notificationId = asString(payload.notificationId);
  const rawType = asString(payload.type);
  if (!rawType) return null;

  if (rawType === "message" || rawType === "dm_message") {
    const senderId =
      asString(payload.actorUid) ||
      asString(payload.senderId) ||
      asString(payload.friendUid);
    const chatId = asString(payload.conversationId) || asString(payload.chatId);
    if (!senderId) return null;

    return {
      type: "dm_message",
      notificationId,
      dedupeKey: buildDedupeKey(payload, `dm_message:${chatId ?? senderId}`),
      route:
        routeFromPayload ??
        ({
          screen: "ChatDetail",
          params: {
            friendUid: senderId,
            initialData: chatId ? { chatId } : undefined,
          },
        } satisfies CanonicalNotificationRoute),
    };
  }

  if (rawType === "group_message") {
    const groupId =
      asString(payload.conversationId) || asString(payload.groupId);
    if (!groupId) return null;

    const mentioned =
      payload.mentioned === true || payload.mentioned === "true";
    const messageId = asString(payload.messageId);

    return {
      type: "group_message",
      notificationId,
      dedupeKey: buildDedupeKey(payload, `group_message:${groupId}`),
      route:
        routeFromPayload ??
        ({
          screen: "GroupChat",
          params: {
            groupId,
            groupName: asString(payload.groupName),
            ...(mentioned && messageId
              ? { highlightMessageId: messageId }
              : {}),
          },
        } satisfies CanonicalNotificationRoute),
    };
  }

  if (rawType === "message_request") {
    const chatId = asString(payload.conversationId) || asString(payload.chatId);
    return {
      type: "message_request",
      notificationId,
      dedupeKey: buildDedupeKey(
        payload,
        `message_request:${chatId ?? "inbox"}`,
      ),
      route:
        routeFromPayload ??
        ({
          screen: "MainTabs",
          params: {
            screen: "Friends",
            params: {
              tab: "requests",
            },
          },
        } satisfies CanonicalNotificationRoute),
    };
  }

  if (rawType === "friend_request") {
    return {
      type: "friend_request",
      notificationId,
      dedupeKey: buildDedupeKey(payload, "friend_request"),
      route:
        routeFromPayload ??
        ({
          screen: "MainTabs",
          params: {
            screen: "Friends",
            params: {
              tab: "requests",
            },
          },
        } satisfies CanonicalNotificationRoute),
    };
  }

  if (rawType === "friend_request_accepted") {
    return {
      type: "friend_request_accepted",
      notificationId,
      dedupeKey: buildDedupeKey(payload, "friend_request_accepted"),
      route:
        routeFromPayload ??
        ({
          screen: "Friends",
          params: {
            tab: "all",
          },
        } satisfies CanonicalNotificationRoute),
    };
  }

  if (rawType === "game_invite" || rawType === "game_lobby_ready") {
    const inviteId = asString(payload.inviteId);
    if (!inviteId) return null;

    return {
      type: rawType,
      notificationId,
      dedupeKey: buildDedupeKey(payload, `${rawType}:${inviteId}`),
      route:
        routeFromPayload ??
        ({
          screen: "GameLobbyV4",
          params: { inviteId },
        } satisfies CanonicalNotificationRoute),
    };
  }

  if (rawType === "game_turn") {
    const sessionId = asString(payload.sessionId);
    if (!sessionId) return null;

    return {
      type: "game_turn",
      notificationId,
      dedupeKey: buildDedupeKey(payload, `game_turn:${sessionId}`),
      route:
        routeFromPayload ??
        ({
          screen: "GamePlayV4",
          params: {
            sessionId,
            gameId: asString(payload.gameId),
          },
        } satisfies CanonicalNotificationRoute),
    };
  }

  if (rawType === "game_resolved") {
    const sessionId = asString(payload.sessionId);
    if (!sessionId) return null;

    return {
      type: "game_resolved",
      notificationId,
      dedupeKey: buildDedupeKey(payload, `game_resolved:${sessionId}`),
      route:
        routeFromPayload ??
        ({
          screen: "GameOverV4",
          params: { sessionId },
        } satisfies CanonicalNotificationRoute),
    };
  }

  if (rawType === "achievement_unlocked") {
    const sectionId = asString(payload.sectionId);
    return {
      type: "achievement_unlocked",
      notificationId,
      dedupeKey: buildDedupeKey(
        payload,
        `achievement_unlocked:${sectionId ?? "hub"}`,
      ),
      route:
        routeFromPayload ??
        (sectionId
          ? {
              screen: "AchievementSection",
              params: { sectionId },
            }
          : {
              screen: "AchievementsHub",
            }),
    };
  }

  if (rawType === "gift_received" || rawType === "gift_opened") {
    const giftId = asString(payload.giftId);
    return {
      type: rawType,
      notificationId,
      dedupeKey: buildDedupeKey(payload, `${rawType}:${giftId ?? "history"}`),
      route:
        routeFromPayload ??
        ({
          screen: "PurchaseHistory",
        } satisfies CanonicalNotificationRoute),
    };
  }

  if (
    rawType === "streak_milestone" ||
    rawType === "streak_at_risk" ||
    rawType === "streak_reminder"
  ) {
    const friendshipId = asString(payload.friendshipId);
    return {
      type: rawType === "streak_reminder" ? "streak_at_risk" : rawType,
      notificationId,
      dedupeKey: buildDedupeKey(
        payload,
        `${rawType}:${friendshipId ?? "streak"}`,
      ),
      route:
        routeFromPayload ??
        ({
          screen: "Friends",
        } satisfies CanonicalNotificationRoute),
    };
  }

  if (rawType === "cosmetic_unlock") {
    return {
      type: "cosmetic_unlock",
      notificationId,
      dedupeKey: buildDedupeKey(payload, "cosmetic_unlock"),
      route:
        routeFromPayload ??
        ({
          screen: "Friends",
        } satisfies CanonicalNotificationRoute),
    };
  }

  if (rawType === "story_view" || rawType === "story_viewed") {
    return {
      type: "story_viewed",
      notificationId,
      dedupeKey: buildDedupeKey(payload, "story_viewed"),
      route:
        routeFromPayload ??
        ({
          screen: "MainTabs",
        } satisfies CanonicalNotificationRoute),
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
