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

const APP_TAB_SCREEN_NAMES = new Set(["Messages", "Calls", "Profile"]);

const MAIN_STACK_SCREEN_NAMES = new Set([
  "Friends",
  "ChatDetail",
  "GroupChat",
  "ThreadView",
  "GroupChatInfo",
  "ChatSettings",
  "InboxSettings",
  "SnapViewer",
  "Camera",
  "DirectCall",
  "VoiceChannel",
  "CallInfo",
  "UserProfile",
  "SetStatus",
  "MutualFriendsList",
  "PremiumShop",
  "PurchaseHistory",
  "CosmeticsShop",
  "Customization",
  "ActivityFeed",
  "GameLobbyV4",
  "GamePlayV4",
  "GameOverV4",
  "GameDetailV4",
  "GameLeaderboardV4",
  "GameStatsV4",
  "ProfileAchievements",
  "LevelRewards",
  "Wallet",
  "GamesHub",
  "GroupPermissions",
  "BlockedUsers",
]);

function sanitizeNotificationRoute(
  route: CanonicalNotificationRoute | undefined,
): CanonicalNotificationRoute | undefined {
  if (!route) return undefined;

  if (route.screen === "MainTabs") {
    const tabParams = asRecord(route.params);
    const nestedScreen = asString(tabParams?.screen);
    if (!nestedScreen) return undefined;

    const nestedParams = asRecord(tabParams?.params) ?? undefined;
    if (APP_TAB_SCREEN_NAMES.has(nestedScreen)) {
      return {
        screen: "MainTabs",
        params: {
          screen: nestedScreen,
          ...(nestedParams ? { params: nestedParams } : {}),
        },
      };
    }

    // Older backend payloads incorrectly nested root-stack screens under
    // MainTabs. React Navigation treats those as invalid tab targets and falls
    // through to the Messages tab, so repair them before dispatching.
    if (MAIN_STACK_SCREEN_NAMES.has(nestedScreen)) {
      return {
        screen: nestedScreen,
        params: nestedParams,
      };
    }

    return undefined;
  }

  if (APP_TAB_SCREEN_NAMES.has(route.screen)) {
    return {
      screen: "MainTabs",
      params: {
        screen: route.screen,
        ...(route.params ? { params: route.params } : {}),
      },
    };
  }

  if (MAIN_STACK_SCREEN_NAMES.has(route.screen)) {
    return route;
  }

  return undefined;
}

function resolveNotificationRoute(
  routeFromPayload: CanonicalNotificationRoute | undefined,
  fallback: CanonicalNotificationRoute,
): CanonicalNotificationRoute {
  return sanitizeNotificationRoute(routeFromPayload) ?? fallback;
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
      route: resolveNotificationRoute(routeFromPayload, {
        screen: "ChatDetail",
        params: {
          friendUid: senderId,
          initialData: chatId ? { chatId } : undefined,
        },
      }),
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
      route: resolveNotificationRoute(routeFromPayload, {
        screen: "GroupChat",
        params: {
          groupId,
          groupName: asString(payload.groupName),
          ...(mentioned && messageId ? { highlightMessageId: messageId } : {}),
        },
      }),
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
      route: resolveNotificationRoute(routeFromPayload, {
        screen: "Friends",
        params: {
          tab: "requests",
        },
      }),
    };
  }

  if (rawType === "friend_request") {
    return {
      type: "friend_request",
      notificationId,
      dedupeKey: buildDedupeKey(payload, "friend_request"),
      route: resolveNotificationRoute(routeFromPayload, {
        screen: "Friends",
        params: {
          tab: "requests",
        },
      }),
    };
  }

  if (rawType === "friend_request_accepted") {
    return {
      type: "friend_request_accepted",
      notificationId,
      dedupeKey: buildDedupeKey(payload, "friend_request_accepted"),
      route: resolveNotificationRoute(routeFromPayload, {
        screen: "Friends",
        params: {
          tab: "all",
        },
      }),
    };
  }

  if (rawType === "game_invite" || rawType === "game_lobby_ready") {
    const inviteId = asString(payload.inviteId);
    if (!inviteId) return null;

    return {
      type: rawType,
      notificationId,
      dedupeKey: buildDedupeKey(payload, `${rawType}:${inviteId}`),
      route: resolveNotificationRoute(routeFromPayload, {
        screen: "GameLobbyV4",
        params: { inviteId },
      }),
    };
  }

  if (rawType === "game_turn") {
    const sessionId = asString(payload.sessionId);
    if (!sessionId) return null;

    return {
      type: "game_turn",
      notificationId,
      dedupeKey: buildDedupeKey(payload, `game_turn:${sessionId}`),
      route: resolveNotificationRoute(routeFromPayload, {
        screen: "GamePlayV4",
        params: {
          sessionId,
          gameId: asString(payload.gameId),
        },
      }),
    };
  }

  if (rawType === "game_resolved") {
    const sessionId = asString(payload.sessionId);
    if (!sessionId) return null;

    return {
      type: "game_resolved",
      notificationId,
      dedupeKey: buildDedupeKey(payload, `game_resolved:${sessionId}`),
      route: resolveNotificationRoute(routeFromPayload, {
        screen: "GameOverV4",
        params: { sessionId },
      }),
    };
  }

  if (rawType === "achievement_unlocked") {
    const gameId = asString(payload.gameId);
    return {
      type: "achievement_unlocked",
      notificationId,
      dedupeKey: buildDedupeKey(
        payload,
        `achievement_unlocked:${gameId ?? "games"}`,
      ),
      route: resolveNotificationRoute(
        routeFromPayload,
        gameId
          ? {
              screen: "GameDetailV4",
              params: { gameId },
            }
          : {
              screen: "GamesHub",
            },
      ),
    };
  }

  if (rawType === "gift_received" || rawType === "gift_opened") {
    const giftId = asString(payload.giftId);
    return {
      type: rawType,
      notificationId,
      dedupeKey: buildDedupeKey(payload, `${rawType}:${giftId ?? "history"}`),
      route: resolveNotificationRoute(routeFromPayload, {
        screen: "PurchaseHistory",
      }),
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
      route: resolveNotificationRoute(routeFromPayload, {
        screen: "Friends",
      }),
    };
  }

  if (rawType === "cosmetic_unlock") {
    return {
      type: "cosmetic_unlock",
      notificationId,
      dedupeKey: buildDedupeKey(payload, "cosmetic_unlock"),
      route: resolveNotificationRoute(routeFromPayload, {
        screen: "Friends",
      }),
    };
  }

  if (rawType === "story_view" || rawType === "story_viewed") {
    return {
      type: "story_viewed",
      notificationId,
      dedupeKey: buildDedupeKey(payload, "story_viewed"),
      route: resolveNotificationRoute(routeFromPayload, {
        screen: "MainTabs",
        params: {
          screen: "Profile",
        },
      }),
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
