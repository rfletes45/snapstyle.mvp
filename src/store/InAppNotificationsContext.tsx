import { ACHIEVEMENT_BY_TYPE } from "@/gamesV4/data/achievementDefinitions";
import type { GameRuntimeType } from "@/gamesV4/types/common";
import {
  subscribeToInboxSettings,
  updateInboxSettings,
} from "@/services/inboxSettings";
import {
  clearNotificationSession,
  getNotificationDeviceId,
  setBadgeCount,
  syncNotificationSession,
} from "@/services/notifications";
import { normalizeNotificationPayload } from "@/services/notifications/normalizeNotification";
import {
  markUserNotificationPresented,
  markUserNotificationRead,
  subscribeToUnreadBadgeCount,
  subscribeToUserNotifications,
  UserNotificationRecord,
} from "@/services/userNotifications";
import { createLogger } from "@/utils/log";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, AppStateStatus, Platform } from "react-native";
import { useAuth } from "./AuthContext";

const log = createLogger("InAppNotifications");

const MAX_VISIBLE_NOTIFICATIONS = 2;
const AUTO_DISMISS_MS = 5000;
const DEBOUNCE_WINDOW_MS = 3000;
const INITIAL_STALE_NOTIFICATION_MS = 15_000;
const SESSION_HEARTBEAT_MS = 25_000;

export type NotificationType =
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

export interface InAppNotification {
  id: string;
  notificationId?: string;
  dedupeKey: string;
  type: NotificationType;
  title: string;
  body: string;
  entityId: string;
  conversationScope?: "dm" | "group" | null;
  fromUserId: string;
  fromDisplayName?: string;
  timestamp: number;
  navigateTo?: {
    screen: string;
    params?: Record<string, unknown>;
  };
}

interface InAppNotificationsContextType {
  notifications: InAppNotification[];
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
  markNotificationRead: (notificationId?: string) => void;
  setCurrentScreen: (screen: string | null) => void;
  setCurrentChatId: (
    chatId: string | null,
    scope?: "dm" | "group" | null,
  ) => void;
  setCurrentGameSessionId: (sessionId: string | null) => void;
  setCurrentGameInviteId: (inviteId: string | null) => void;
  setActiveGameRuntimeType: (type: GameRuntimeType | null) => void;
  lastViewedConversation: {
    conversationId: string;
    scope: "dm" | "group" | null;
  } | null;
  consumeLastViewedConversation: () => {
    conversationId: string;
    scope: "dm" | "group" | null;
  } | null;
  registerNotificationPressHandler: (
    handler: (conversationId: string, scope: "dm" | "group" | null) => void,
  ) => () => void;
  onMessageNotificationPressed: (
    conversationId: string,
    scope: "dm" | "group" | null,
  ) => void;
}

const InAppNotificationsContext =
  createContext<InAppNotificationsContextType | null>(null);

interface ProviderProps {
  children: ReactNode;
  navigationRef?: React.RefObject<any>;
}

function buildToast(
  notification: UserNotificationRecord,
): InAppNotification | null {
  const normalized = normalizeNotificationPayload({
    notificationId: notification.id,
    dedupeKey: notification.dedupeKey,
    route: notification.route,
    type: notification.type,
    actorUid: notification.actorUid,
    actorName: notification.actorName,
    conversationId: notification.conversationId,
    conversationScope: notification.conversationScope,
    requestId: notification.requestId,
    sessionId: notification.sessionId,
    inviteId: notification.inviteId,
    gameId: notification.gameId,
    sectionId: notification.sectionId,
    giftId: notification.giftId,
    ...notification.data,
  });

  if (!normalized) {
    return null;
  }

  // Resolve raw achievement type keys to human-readable names in the body.
  // This guards against legacy notifications that were written with internal IDs.
  let body = notification.body;
  if (notification.type === "achievement_unlocked" && body) {
    const def = ACHIEVEMENT_BY_TYPE[body];
    if (def) {
      body = def.name;
    } else if (notification.data?.achievementTitles) {
      const titles = notification.data.achievementTitles as
        | string[]
        | undefined;
      const ids = notification.data.achievementIds as string[] | undefined;
      if (titles && Array.isArray(titles) && titles.length > 0) {
        const resolvedTitles = titles.map(
          (t: string) => ACHIEVEMENT_BY_TYPE[t]?.name ?? t,
        );
        const count = ids?.length ?? resolvedTitles.length;
        body =
          count === 1
            ? resolvedTitles[0]
            : `${resolvedTitles.slice(0, 2).join(", ")}${count > 2 ? " and more" : ""}`;
      }
    }
  }

  return {
    id: `toast_${notification.id}`,
    notificationId: notification.id,
    dedupeKey: normalized.dedupeKey,
    type: normalized.type,
    title: notification.title,
    body,
    entityId:
      notification.conversationId ||
      notification.sessionId ||
      notification.inviteId ||
      notification.giftId ||
      notification.sectionId ||
      notification.id,
    conversationScope: notification.conversationScope ?? null,
    fromUserId: notification.actorUid || "",
    fromDisplayName: notification.actorName || undefined,
    timestamp: notification.createdAtMs || Date.now(),
    navigateTo: normalized.route,
  };
}

export function InAppNotificationsProvider({ children }: ProviderProps) {
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;

  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [enabled, setEnabledState] = useState(true);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [currentScreen, setCurrentScreen] = useState<string | null>(null);
  const [currentChatId, setCurrentChatIdState] = useState<string | null>(null);
  const [currentConversationScope, setCurrentConversationScope] = useState<
    "dm" | "group" | null
  >(null);
  const [currentGameSessionId, setCurrentGameSessionIdState] = useState<
    string | null
  >(null);
  const [currentGameInviteId, setCurrentGameInviteIdState] = useState<
    string | null
  >(null);
  const [activeGameRuntimeType, setActiveGameRuntimeType] =
    useState<GameRuntimeType | null>(null);
  const [lastViewedConversation, setLastViewedConversation] = useState<{
    conversationId: string;
    scope: "dm" | "group" | null;
  } | null>(null);
  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState,
  );

  const recentNotificationKeys = useRef<Map<string, number>>(new Map());
  const dismissTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const notificationPressHandlers = useRef<
    Set<(conversationId: string, scope: "dm" | "group" | null) => void>
  >(new Set());
  const seenNotificationIds = useRef<Set<string>>(new Set());
  const hasHydratedFeed = useRef(false);
  const syncSequence = useRef(0);

  useEffect(() => {
    getNotificationDeviceId()
      .then(setDeviceId)
      .catch((error) =>
        log.warn("Failed to resolve notification device id", error),
      );
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      setAppState(nextState);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!uid) {
      setEnabledState(true);
      return;
    }

    const unsubscribe = subscribeToInboxSettings(uid, (settings) => {
      setEnabledState(
        settings.notificationsEnabled !== false &&
          settings.inAppNotificationsEnabled !== false,
      );
    });

    return unsubscribe;
  }, [uid]);

  const setEnabled = useCallback(
    (value: boolean) => {
      setEnabledState(value);
      if (!uid) return;
      updateInboxSettings(uid, {
        inAppNotificationsEnabled: value,
      }).catch((error) => {
        log.error("Failed to persist in-app notification preference", error);
      });
    },
    [uid],
  );

  const shouldShowNotification = useCallback((dedupeKey: string): boolean => {
    const now = Date.now();
    const lastShown = recentNotificationKeys.current.get(dedupeKey);
    if (lastShown && now - lastShown < DEBOUNCE_WINDOW_MS) {
      return false;
    }

    recentNotificationKeys.current.set(dedupeKey, now);
    if (recentNotificationKeys.current.size > 100) {
      const staleBefore = now - DEBOUNCE_WINDOW_MS * 3;
      for (const [key, timestamp] of recentNotificationKeys.current) {
        if (timestamp < staleBefore) {
          recentNotificationKeys.current.delete(key);
        }
      }
    }

    return true;
  }, []);

  const scheduleAutoDismiss = useCallback((id: string) => {
    const timer = setTimeout(() => {
      setNotifications((prev) =>
        prev.filter((notification) => notification.id !== id),
      );
      dismissTimers.current.delete(id);
    }, AUTO_DISMISS_MS);

    dismissTimers.current.set(id, timer);
  }, []);

  const enqueueToast = useCallback(
    (toast: InAppNotification) => {
      if (!enabled) return;
      if (!shouldShowNotification(toast.dedupeKey)) return;

      setNotifications((prev) =>
        [toast, ...prev].slice(0, MAX_VISIBLE_NOTIFICATIONS),
      );
      scheduleAutoDismiss(toast.id);
    },
    [enabled, scheduleAutoDismiss, shouldShowNotification],
  );

  const dismiss = useCallback((id: string) => {
    const timer = dismissTimers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      dismissTimers.current.delete(id);
    }
    setNotifications((prev) =>
      prev.filter((notification) => notification.id !== id),
    );
  }, []);

  const clearAll = useCallback(() => {
    for (const timer of dismissTimers.current.values()) {
      clearTimeout(timer);
    }
    dismissTimers.current.clear();
    setNotifications([]);
  }, []);

  const markNotificationRead = useCallback(
    (notificationId?: string) => {
      if (!uid || !notificationId) return;
      markUserNotificationRead(uid, notificationId).catch((error) => {
        log.warn("Failed to mark notification read", error);
      });
    },
    [uid],
  );

  const setCurrentChatId = useCallback(
    (chatId: string | null, scope: "dm" | "group" | null = null) => {
      setCurrentChatIdState((previousChatId) => {
        if (chatId === null && previousChatId !== null) {
          setLastViewedConversation({
            conversationId: previousChatId,
            scope: currentConversationScope,
          });
        }
        return chatId;
      });
      setCurrentConversationScope(chatId ? scope : null);
    },
    [currentConversationScope],
  );

  const consumeLastViewedConversation = useCallback(() => {
    const conversation = lastViewedConversation;
    setLastViewedConversation(null);
    return conversation;
  }, [lastViewedConversation]);

  const registerNotificationPressHandler = useCallback(
    (
      handler: (conversationId: string, scope: "dm" | "group" | null) => void,
    ) => {
      notificationPressHandlers.current.add(handler);
      return () => {
        notificationPressHandlers.current.delete(handler);
      };
    },
    [],
  );

  const onMessageNotificationPressed = useCallback(
    (conversationId: string, scope: "dm" | "group" | null) => {
      notificationPressHandlers.current.forEach((handler) => {
        try {
          handler(conversationId, scope);
        } catch (error) {
          log.error("Notification press handler failed", error);
        }
      });
    },
    [],
  );

  const syncSession = useCallback(async () => {
    if (!uid || !deviceId) return;

    const nextSequence = ++syncSequence.current;
    try {
      await syncNotificationSession(uid, {
        appState,
        currentScreen,
        currentChatId,
        currentConversationScope,
        currentGameSessionId,
        currentGameInviteId,
        currentGameRuntimeType: activeGameRuntimeType,
        inAppEnabled: enabled,
        pushEnabled: true,
      });
    } catch (error) {
      if (nextSequence === syncSequence.current) {
        log.warn("Failed to sync notification session", error);
      }
    }
  }, [
    uid,
    deviceId,
    appState,
    currentScreen,
    currentChatId,
    currentConversationScope,
    currentGameSessionId,
    currentGameInviteId,
    activeGameRuntimeType,
    enabled,
  ]);

  useEffect(() => {
    syncSession().catch(() => {});
  }, [syncSession]);

  useEffect(() => {
    if (!uid || appState !== "active") return;

    const interval = setInterval(() => {
      syncSession().catch(() => {});
    }, SESSION_HEARTBEAT_MS);

    return () => clearInterval(interval);
  }, [uid, appState, syncSession]);

  useEffect(() => {
    if (!uid) {
      clearAll();
      if (Platform.OS !== "web") {
        setBadgeCount(0).catch(() => {});
      }
      return;
    }

    return () => {
      clearNotificationSession(uid).catch((error) => {
        log.warn("Failed to clear notification session", error);
      });
    };
  }, [uid, clearAll]);

  useEffect(() => {
    if (!uid || !deviceId) return;

    seenNotificationIds.current.clear();
    hasHydratedFeed.current = false;

    const unsubscribe = subscribeToUserNotifications(uid, (items) => {
      const now = Date.now();
      const firstSnapshot = !hasHydratedFeed.current;

      for (const item of items) {
        if (seenNotificationIds.current.has(item.id)) {
          continue;
        }
        seenNotificationIds.current.add(item.id);

        if (item.channel !== "in_app") {
          continue;
        }
        if (item.targetDeviceId && item.targetDeviceId !== deviceId) {
          continue;
        }
        if (item.presentedAtMs || item.archivedAtMs) {
          continue;
        }

        const shouldSilence =
          !enabled ||
          appState !== "active" ||
          (firstSnapshot &&
            item.createdAtMs > 0 &&
            now - item.createdAtMs > INITIAL_STALE_NOTIFICATION_MS);

        if (shouldSilence) {
          markUserNotificationPresented(uid, item.id).catch((error) => {
            log.warn("Failed to mark stale notification presented", error);
          });
          continue;
        }

        const toast = buildToast(item);
        markUserNotificationPresented(uid, item.id).catch((error) => {
          log.warn("Failed to mark notification presented", error);
        });
        if (toast) {
          enqueueToast(toast);
        }
      }

      hasHydratedFeed.current = true;
    });

    return unsubscribe;
  }, [uid, deviceId, enabled, appState, enqueueToast]);

  useEffect(() => {
    if (!uid) return;

    const unsubscribe = subscribeToUnreadBadgeCount(uid, (count) => {
      setBadgeCount(count).catch((error) => {
        log.warn("Failed to sync app badge count", error);
      });
    });

    return unsubscribe;
  }, [uid]);

  useEffect(() => {
    return () => {
      for (const timer of dismissTimers.current.values()) {
        clearTimeout(timer);
      }
      dismissTimers.current.clear();
    };
  }, []);

  const value = useMemo<InAppNotificationsContextType>(
    () => ({
      notifications,
      enabled,
      setEnabled,
      dismiss,
      clearAll,
      markNotificationRead,
      setCurrentScreen,
      setCurrentChatId,
      setCurrentGameSessionId: setCurrentGameSessionIdState,
      setCurrentGameInviteId: setCurrentGameInviteIdState,
      setActiveGameRuntimeType,
      lastViewedConversation,
      consumeLastViewedConversation,
      registerNotificationPressHandler,
      onMessageNotificationPressed,
    }),
    [
      notifications,
      enabled,
      setEnabled,
      dismiss,
      clearAll,
      markNotificationRead,
      lastViewedConversation,
      consumeLastViewedConversation,
      setCurrentChatId,
      registerNotificationPressHandler,
      onMessageNotificationPressed,
    ],
  );

  return (
    <InAppNotificationsContext.Provider value={value}>
      {children}
    </InAppNotificationsContext.Provider>
  );
}

export function useInAppNotifications(): InAppNotificationsContextType {
  const context = useContext(InAppNotificationsContext);
  if (!context) {
    throw new Error(
      "useInAppNotifications must be used within InAppNotificationsProvider",
    );
  }
  return context;
}

export default InAppNotificationsContext;
