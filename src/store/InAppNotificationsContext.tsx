/**
 * InAppNotificationsContext
 * Phase G: In-App Notifications
 *
 * Provides real-time in-app notifications for:
 * - Incoming messages (when not already in that chat)
 * - Friend requests (when not on Connections screen)
 *
 * Features:
 * - Debounce/dedupe to prevent spam
 * - Queue management with max visible limit
 * - Auto-dismiss with configurable duration
 * - Navigation on tap
 * - User preference toggle (persisted via localStorage on web)
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { Platform } from "react-native";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  Unsubscribe,
} from "firebase/firestore";
import { getFirestoreInstance } from "@/services/firebase";
import { getUserProfileByUid } from "@/services/friends";
import { useAuth } from "./AuthContext";
import { createLogger } from "@/utils/log";

const log = createLogger("InAppNotifications");

// =============================================================================
// Storage Helper (cross-platform)
// =============================================================================

const STORAGE_KEY = "in_app_notifications_enabled";

/**
 * Simple storage abstraction for cross-platform compatibility
 */
const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === "web" && typeof localStorage !== "undefined") {
        return localStorage.getItem(key);
      }
      // On native, default to enabled (no persistence without AsyncStorage)
      return null;
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === "web" && typeof localStorage !== "undefined") {
        localStorage.setItem(key, value);
      }
      // On native, preference won't persist without AsyncStorage
    } catch {
      // Ignore storage errors
    }
  },
};

// =============================================================================
// Types
// =============================================================================

export type NotificationType = "message" | "friend_request";

export interface InAppNotification {
  /** Unique ID for this notification */
  id: string;
  /** Type of notification */
  type: NotificationType;
  /** Display title */
  title: string;
  /** Display subtitle/body */
  body: string;
  /** Entity ID (chatId for messages, requestId for friend requests) */
  entityId: string;
  /** Sender/requester user ID */
  fromUserId: string;
  /** Sender/requester display name */
  fromDisplayName?: string;
  /** Timestamp when notification was created */
  timestamp: number;
  /** Navigation target */
  navigateTo?: {
    screen: string;
    params?: Record<string, unknown>;
  };
}

interface InAppNotificationsContextType {
  /** Current visible notifications */
  notifications: InAppNotification[];
  /** Whether in-app notifications are enabled */
  enabled: boolean;
  /** Toggle notifications on/off */
  setEnabled: (enabled: boolean) => void;
  /** Manually push a notification (for testing or custom use) */
  pushNotification: (
    notification: Omit<InAppNotification, "id" | "timestamp">,
  ) => void;
  /** Dismiss a specific notification */
  dismiss: (id: string) => void;
  /** Clear all notifications */
  clearAll: () => void;
  /** Set the current screen for context-aware suppression */
  setCurrentScreen: (screen: string | null) => void;
  /** Set the current chat ID being viewed (to suppress its notifications) */
  setCurrentChatId: (chatId: string | null) => void;
}

// =============================================================================
// Constants
// =============================================================================

const MAX_VISIBLE_NOTIFICATIONS = 2;
const AUTO_DISMISS_MS = 5000;
const DEBOUNCE_WINDOW_MS = 3000;

// =============================================================================
// Context
// =============================================================================

const InAppNotificationsContext =
  createContext<InAppNotificationsContextType | null>(null);

// =============================================================================
// Provider
// =============================================================================

interface ProviderProps {
  children: ReactNode;
  /** Navigation ref for tap actions */
  navigationRef?: React.RefObject<any>;
}

export function InAppNotificationsProvider({
  children,
  navigationRef,
}: ProviderProps) {
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;

  // State
  const [enabled, setEnabledState] = useState(true);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [currentScreen, setCurrentScreen] = useState<string | null>(null);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  // Refs for debouncing and tracking
  const recentNotificationKeys = useRef<Map<string, number>>(new Map());
  const unsubscribeRefs = useRef<Unsubscribe[]>([]);
  const dismissTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const lastMessageTimestamps = useRef<Map<string, number>>(new Map());

  // =============================================================================
  // Persistence
  // =============================================================================

  // Load preference from storage
  useEffect(() => {
    storage.getItem(STORAGE_KEY).then((value: string | null) => {
      if (value !== null) {
        setEnabledState(value === "true");
      }
    });
  }, []);

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    storage.setItem(STORAGE_KEY, value ? "true" : "false");
    log.info(`In-app notifications ${value ? "enabled" : "disabled"}`);
  }, []);

  // =============================================================================
  // Debounce / Dedupe
  // =============================================================================

  const shouldShowNotification = useCallback(
    (type: NotificationType, entityId: string): boolean => {
      const key = `${type}:${entityId}`;
      const now = Date.now();
      const lastShown = recentNotificationKeys.current.get(key);

      if (lastShown && now - lastShown < DEBOUNCE_WINDOW_MS) {
        log.debug(`Debounced notification: ${key}`);
        return false;
      }

      // Update timestamp
      recentNotificationKeys.current.set(key, now);

      // Cleanup old entries periodically
      if (recentNotificationKeys.current.size > 50) {
        const cutoff = now - DEBOUNCE_WINDOW_MS * 2;
        for (const [k, v] of recentNotificationKeys.current) {
          if (v < cutoff) {
            recentNotificationKeys.current.delete(k);
          }
        }
      }

      return true;
    },
    [],
  );

  // =============================================================================
  // Notification Management
  // =============================================================================

  const generateId = useCallback(() => {
    return `notif_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }, []);

  const scheduleAutoDismiss = useCallback((id: string) => {
    const timer = setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      dismissTimers.current.delete(id);
    }, AUTO_DISMISS_MS);

    dismissTimers.current.set(id, timer);
  }, []);

  const pushNotification = useCallback(
    (notification: Omit<InAppNotification, "id" | "timestamp">) => {
      if (!enabled) {
        log.debug("Notifications disabled, skipping");
        return;
      }

      // Check debounce
      if (!shouldShowNotification(notification.type, notification.entityId)) {
        return;
      }

      // Context-aware suppression
      if (
        notification.type === "message" &&
        notification.entityId === currentChatId
      ) {
        log.debug("User is viewing this chat, suppressing notification");
        return;
      }

      if (
        notification.type === "friend_request" &&
        currentScreen === "Connections"
      ) {
        log.debug("User is on Connections screen, suppressing notification");
        return;
      }

      const id = generateId();
      const newNotification: InAppNotification = {
        ...notification,
        id,
        timestamp: Date.now(),
      };

      log.info(
        `Pushing notification: ${notification.type} - ${notification.title}`,
      );

      setNotifications((prev) => {
        // Keep max visible, newest first
        const updated = [newNotification, ...prev].slice(
          0,
          MAX_VISIBLE_NOTIFICATIONS,
        );
        return updated;
      });

      // Schedule auto-dismiss
      scheduleAutoDismiss(id);
    },
    [
      enabled,
      currentChatId,
      currentScreen,
      shouldShowNotification,
      generateId,
      scheduleAutoDismiss,
    ],
  );

  const dismiss = useCallback((id: string) => {
    // Clear timer if exists
    const timer = dismissTimers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      dismissTimers.current.delete(id);
    }

    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    // Clear all timers
    for (const timer of dismissTimers.current.values()) {
      clearTimeout(timer);
    }
    dismissTimers.current.clear();

    setNotifications([]);
  }, []);

  // =============================================================================
  // Firestore Listeners
  // =============================================================================

  // Subscribe to incoming friend requests
  useEffect(() => {
    if (!uid || !enabled) return;

    const db = getFirestoreInstance();
    const requestsRef = collection(db, "FriendRequests");
    const q = query(
      requestsRef,
      where("to", "==", uid),
      where("status", "==", "pending"),
    );

    log.info("Setting up friend request listener");

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        // Process only newly added documents
        for (const change of snapshot.docChanges()) {
          if (change.type === "added") {
            const data = change.doc.data();
            const requestId = change.doc.id;
            const fromUid = data.from;
            const createdAt = data.createdAt || Date.now();

            // Skip old requests (only show recent ones)
            if (Date.now() - createdAt > 30000) {
              log.debug(`Skipping old friend request: ${requestId}`);
              continue;
            }

            try {
              // Fetch sender's profile
              const profile = await getUserProfileByUid(fromUid);
              const displayName =
                profile?.displayName || profile?.username || "Someone";

              pushNotification({
                type: "friend_request",
                title: "New Connection Request",
                body: `${displayName} wants to connect with you`,
                entityId: requestId,
                fromUserId: fromUid,
                fromDisplayName: displayName,
                navigateTo: {
                  screen: "Connections",
                  params: { tab: "requests" },
                },
              });
            } catch (err) {
              log.error("Failed to fetch profile for notification", err);
            }
          }
        }
      },
      (error) => {
        log.error("Friend request listener error", error);
      },
    );

    unsubscribeRefs.current.push(unsubscribe);

    return () => {
      unsubscribe();
      unsubscribeRefs.current = unsubscribeRefs.current.filter(
        (u) => u !== unsubscribe,
      );
    };
  }, [uid, enabled, pushNotification]);

  // Subscribe to chat list for new messages
  useEffect(() => {
    if (!uid || !enabled) return;

    const db = getFirestoreInstance();
    const chatsRef = collection(db, "Chats");
    const q = query(
      chatsRef,
      where("members", "array-contains", uid),
      orderBy("lastMessageAt", "desc"),
      limit(20), // Only track recent chats
    );

    log.info("Setting up chat listener for message notifications");

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        for (const change of snapshot.docChanges()) {
          if (change.type === "modified") {
            const data = change.doc.data();
            const chatId = change.doc.id;
            const lastMessageAt = data.lastMessageAt?.toMillis?.() || 0;
            const lastMessageText = data.lastMessageText || "";
            const members = data.members as string[];

            // Find the other user
            const otherUid = members.find((m) => m !== uid);
            if (!otherUid) continue;

            // Check if this is actually a new message (not just us sending)
            const previousTimestamp =
              lastMessageTimestamps.current.get(chatId) || 0;
            if (lastMessageAt <= previousTimestamp) {
              continue;
            }

            // Update tracking
            lastMessageTimestamps.current.set(chatId, lastMessageAt);

            // Skip if message is old (more than 30 seconds)
            if (Date.now() - lastMessageAt > 30000) {
              log.debug(`Skipping old message in chat: ${chatId}`);
              continue;
            }

            // Skip if we're currently viewing this chat
            if (chatId === currentChatId) {
              log.debug(
                `User is viewing chat ${chatId}, skipping notification`,
              );
              continue;
            }

            try {
              // Fetch sender's profile
              const profile = await getUserProfileByUid(otherUid);
              const displayName =
                profile?.displayName || profile?.username || "Someone";

              // Truncate message preview
              const preview =
                lastMessageText.length > 40
                  ? lastMessageText.slice(0, 40) + "..."
                  : lastMessageText || "New message";

              pushNotification({
                type: "message",
                title: displayName,
                body: preview,
                entityId: chatId,
                fromUserId: otherUid,
                fromDisplayName: displayName,
                navigateTo: {
                  screen: "ChatDetail",
                  params: { friendUid: otherUid },
                },
              });
            } catch (err) {
              log.error(
                "Failed to fetch profile for message notification",
                err,
              );
            }
          }
        }
      },
      (error) => {
        log.error("Chat listener error", error);
      },
    );

    unsubscribeRefs.current.push(unsubscribe);

    return () => {
      unsubscribe();
      unsubscribeRefs.current = unsubscribeRefs.current.filter(
        (u) => u !== unsubscribe,
      );
    };
  }, [uid, enabled, currentChatId, pushNotification]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const unsub of unsubscribeRefs.current) {
        unsub();
      }
      for (const timer of dismissTimers.current.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  // =============================================================================
  // Context Value
  // =============================================================================

  const value: InAppNotificationsContextType = {
    notifications,
    enabled,
    setEnabled,
    pushNotification,
    dismiss,
    clearAll,
    setCurrentScreen,
    setCurrentChatId,
  };

  return (
    <InAppNotificationsContext.Provider value={value}>
      {children}
    </InAppNotificationsContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

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
