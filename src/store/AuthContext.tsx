import { getAuthInstance } from "@/services/firebase";
import { consumeExplicitLogoutIntent } from "@/services/auth";
import { navigate as globalNavigate } from "@/services/navigationRef";
import {
  addNotificationReceivedListener,
  addNotificationResponseListener,
  clearLastNotificationResponse,
  getLastNotificationResponse,
  registerForPushNotifications,
  removePushToken,
  savePushToken,
} from "@/services/notifications";
import {
  normalizeNotificationPayload,
  shouldHandleNotificationByDedupeKey,
  type CanonicalNotification,
} from "@/services/notifications/normalizeNotification";
import {
  cleanupPresence,
  initializePresence,
  setPresenceOnline,
} from "@/services/presence";
import { markUserNotificationRead } from "@/services/userNotifications";
import { backfillUserEmailIfMissing } from "@/services/users";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { User as FirebaseUser } from "firebase/auth";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, AppStateStatus, Platform } from "react-native";

import { createLogger } from "@/utils/log";
import {
  getStartupSessionId,
  logStartupEvent,
  logStartupMount,
  logStartupUnmount,
} from "@/utils/startupTrace";
const logger = createLogger("store/AuthContext");

async function cleanupChatRuntimeForAuthTransition(
  reason: string,
): Promise<void> {
  try {
    const [
      { clearProfileCache },
      { clearAllPaginationCursors },
      { clearSignedMediaCache },
      { stopBackgroundSync, unsubscribeAll },
    ] = await Promise.all([
      import("@/services/cache/profileCache"),
      import("@/services/messageList"),
      import("@/services/messaging/signedMediaCache"),
      import("@/services/sync/syncEngine"),
    ]);

    unsubscribeAll();
    stopBackgroundSync();
    clearAllPaginationCursors();
    clearSignedMediaCache();
    clearProfileCache();
    logger.info("[AuthContext] Cleaned chat runtime state", {
      data: { reason },
    });
  } catch (error) {
    logger.warn("[AuthContext] Failed to clean chat runtime state:", error);
  }
}

const HANDLED_NOTIFICATION_RESPONSES_KEY =
  "@vibe/handled_notification_responses_v1";
const HANDLED_NOTIFICATION_RESPONSE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_HANDLED_NOTIFICATION_RESPONSES = 50;
const TRANSIENT_AUTH_NULL_GRACE_MS = 1_500;

type HandledNotificationResponseEntry = {
  key: string;
  handledAt: number;
};

function isHandledNotificationResponseEntry(
  value: unknown,
): value is HandledNotificationResponseEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<HandledNotificationResponseEntry>;
  return typeof entry.key === "string" && typeof entry.handledAt === "number";
}

function getPayloadStringValue(
  payload: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = payload?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function buildNotificationResponseKey(
  response: Notifications.NotificationResponse,
  normalized: CanonicalNotification,
): string {
  const data = response.notification.request.content.data as
    | Record<string, unknown>
    | undefined;
  const notificationId =
    normalized.notificationId ?? getPayloadStringValue(data, "notificationId");

  return [
    response.notification.request.identifier,
    response.actionIdentifier,
    normalized.dedupeKey,
    notificationId ?? "",
  ].join("|");
}

async function readHandledNotificationResponses(
  now: number = Date.now(),
): Promise<Map<string, number>> {
  const raw = await AsyncStorage.getItem(HANDLED_NOTIFICATION_RESPONSES_KEY);
  if (!raw) return new Map();

  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return new Map();

  const entries = new Map<string, number>();
  for (const entry of parsed) {
    if (!isHandledNotificationResponseEntry(entry)) continue;
    if (now - entry.handledAt > HANDLED_NOTIFICATION_RESPONSE_TTL_MS) continue;
    entries.set(entry.key, entry.handledAt);
  }

  return entries;
}

async function hasHandledNotificationResponse(
  key: string,
): Promise<boolean> {
  try {
    const entries = await readHandledNotificationResponses();
    return entries.has(key);
  } catch (error) {
    logger.warn(
      "[AuthContext] Failed to read handled notification responses:",
      error,
    );
    return false;
  }
}

async function rememberHandledNotificationResponse(
  key: string,
): Promise<void> {
  try {
    const entries = await readHandledNotificationResponses();
    entries.set(key, Date.now());
    const serialized = Array.from(entries.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_HANDLED_NOTIFICATION_RESPONSES)
      .map(([entryKey, handledAt]) => ({ key: entryKey, handledAt }));

    await AsyncStorage.setItem(
      HANDLED_NOTIFICATION_RESPONSES_KEY,
      JSON.stringify(serialized),
    );
  } catch (error) {
    logger.warn(
      "[AuthContext] Failed to persist handled notification response:",
      error,
    );
  }
}

export interface AuthContextType {
  currentFirebaseUser: FirebaseUser | null;
  loading: boolean;
  /** True once auth state has been determined at least once */
  isHydrated: boolean;
  error: string | null;
  /** Custom claims from Firebase Auth (e.g., admin) */
  customClaims: Record<string, any> | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentFirebaseUser, setCurrentFirebaseUser] =
    useState<FirebaseUser | null>(null);
  const [customClaims, setCustomClaims] = useState<Record<string, any> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);
  const notificationListenerRef =
    useRef<Notifications.EventSubscription | null>(null);
  const responseListenerRef = useRef<Notifications.EventSubscription | null>(
    null,
  );
  const previousUserIdRef = useRef<string | null>(null);
  const recentTapKeysRef = useRef<Map<string, number>>(new Map());
  const currentUserIdRef = useRef<string | null>(null);
  const pendingAuthNullTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const currentUserId = currentFirebaseUser?.uid ?? null;

  useEffect(() => {
    logStartupMount("AuthProvider");
    return () => {
      if (pendingAuthNullTimerRef.current) {
        clearTimeout(pendingAuthNullTimerRef.current);
        pendingAuthNullTimerRef.current = null;
      }
      logStartupUnmount("AuthProvider");
    };
  }, []);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  // Set up notification listeners
  useEffect(() => {
    const handleNotificationResponse = async (
      response: Notifications.NotificationResponse | null,
      source: "initial" | "listener",
    ) => {
      if (!response) return;

      logStartupEvent("Notification response received", {
        source,
        actionIdentifier: response.actionIdentifier,
        notificationRequestId: response.notification.request.identifier,
        content: response.notification.request.content,
      });

      try {
        const data = response.notification.request.content.data;
        // Defense in depth: if a notification somehow arrives whose actorUid
        // matches the current user, refuse to act on it.  This can only
        // happen if the backend or an upstream trigger misrouted, but we
        // never want to navigate the sender back to their own message.
        const rawActorUid =
          data && typeof (data as any).actorUid === "string"
            ? (data as any).actorUid
            : null;
        const activeUidBeforeNormalize = currentUserIdRef.current;
        if (
          rawActorUid &&
          activeUidBeforeNormalize &&
          rawActorUid === activeUidBeforeNormalize
        ) {
          logStartupEvent("Notification response ignored", {
            source,
            reason: "self_actor",
            actorUid: rawActorUid,
          });
          logger.warn(
            "[AuthContext] Ignoring self-actor notification response",
            {
              data: {
                source,
                startupSessionId: getStartupSessionId(),
                actorUid: rawActorUid,
              },
            },
          );
          return;
        }

        const normalized = normalizeNotificationPayload(data);
        if (!normalized) {
          logStartupEvent("Notification response ignored", {
            source,
            reason: "unrecognized_payload",
            rawData: data,
          });
          logger.warn(
            "[AuthContext] Ignoring unrecognized notification response",
            {
              data: {
                source,
                startupSessionId: getStartupSessionId(),
                rawData: data,
              },
            },
          );
          return;
        }

        if (
          !shouldHandleNotificationByDedupeKey(
            recentTapKeysRef.current,
            normalized.dedupeKey,
          )
        ) {
          logStartupEvent("Notification response deduped", {
            source,
            dedupeKey: normalized.dedupeKey,
          });
          logger.info(
            "[AuthContext] Skipping duplicate notification response",
            {
              data: {
                source,
                startupSessionId: getStartupSessionId(),
                dedupeKey: normalized.dedupeKey,
              },
            },
          );
          return;
        }

        const responseKey = buildNotificationResponseKey(response, normalized);
        if (await hasHandledNotificationResponse(responseKey)) {
          logStartupEvent("Notification response replay ignored", {
            source,
            dedupeKey: normalized.dedupeKey,
            responseKey,
          });
          logger.info(
            "[AuthContext] Skipping previously handled notification response",
            {
              data: {
                source,
                startupSessionId: getStartupSessionId(),
                dedupeKey: normalized.dedupeKey,
                responseKey,
              },
            },
          );
          return;
        }

        await rememberHandledNotificationResponse(responseKey);

        const activeUserId = currentUserIdRef.current;
        if (activeUserId && normalized.notificationId) {
          markUserNotificationRead(
            activeUserId,
            normalized.notificationId,
          ).catch((error) => {
            logger.warn(
              "[AuthContext] Failed to mark notification read:",
              error,
            );
          });
        }

        logStartupEvent("Notification response navigating", {
          source,
          dedupeKey: normalized.dedupeKey,
          screen: normalized.route.screen,
          params: normalized.route.params,
          activeUserId,
        });
        logger.info("[AuthContext] Navigating from notification response", {
          data: {
            source,
            startupSessionId: getStartupSessionId(),
            dedupeKey: normalized.dedupeKey,
            screen: normalized.route.screen,
            params: normalized.route.params,
          },
        });

        globalNavigate(
          normalized.route.screen as any,
          normalized.route.params as any,
        );
      } finally {
        try {
          await clearLastNotificationResponse();
          logStartupEvent("Cleared cached last notification response", {
            source,
          });
          logger.info(
            "[AuthContext] Cleared cached last notification response",
            {
              data: {
                source,
                startupSessionId: getStartupSessionId(),
              },
            },
          );
        } catch (error) {
          logger.warn(
            "[AuthContext] Failed to clear cached last notification response:",
            error,
          );
        }
      }
    };

    logStartupEvent("AuthContext notification listeners registering");

    // Listener for notifications received while app is foregrounded
    notificationListenerRef.current = addNotificationReceivedListener(
      (notification) => {
        logger.info("📱 Notification received:", notification.request.content);
      },
    );

    // Listener for notification taps
    responseListenerRef.current = addNotificationResponseListener(
      (response) => void handleNotificationResponse(response, "listener"),
    );

    try {
      const initialResponse = getLastNotificationResponse();
      logStartupEvent("Checked cached last notification response", {
        hasResponse: !!initialResponse,
      });
      logger.info("[AuthContext] Checked cached last notification response", {
        data: {
          startupSessionId: getStartupSessionId(),
          hasResponse: !!initialResponse,
        },
      });
      void handleNotificationResponse(initialResponse, "initial");
    } catch (error) {
      logger.warn(
        "[AuthContext] Failed to read last notification response:",
        error,
      );
    }

    return () => {
      if (notificationListenerRef.current) {
        notificationListenerRef.current.remove();
      }
      if (responseListenerRef.current) {
        responseListenerRef.current.remove();
      }
      logStartupEvent("AuthContext notification listeners removed");
    };
  }, []);

  // Register for push notifications when user logs in
  useEffect(() => {
    const registerPushToken = async () => {
      if (currentUserId && currentUserId !== previousUserIdRef.current) {
        try {
          const token = await registerForPushNotifications();
          if (token) {
            await savePushToken(currentUserId, token);
          } else {
            await removePushToken(currentUserId);
          }
          previousUserIdRef.current = currentUserId;
        } catch (error) {
          logger.error("[AuthContext] Error registering push token:", error);
        }
      } else if (!currentUserId && previousUserIdRef.current) {
        // User logged out - token was already removed before signOut
        // (see logout() in auth.ts). Just clear the ref.
        previousUserIdRef.current = null;
      }
    };

    // Only register on native platforms (not web)
    if (Platform.OS !== "web") {
      void registerPushToken();
    }
  }, [currentUserId]);

  // ── Periodic push-token refresh ───────────────────────────────────────
  // Expo push tokens can expire / rotate.  Re-register every 7 days when
  // the app returns to the foreground to prevent stale tokens.
  const lastTokenRefreshRef = useRef<number>(Date.now());

  useEffect(() => {
    if (Platform.OS === "web") return;
    const TOKEN_REFRESH_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days

    const sub = AppState.addEventListener(
      "change",
      async (state: AppStateStatus) => {
        if (state !== "active") return;
        if (!currentUserId) return;
        const elapsed = Date.now() - lastTokenRefreshRef.current;
        if (elapsed < TOKEN_REFRESH_INTERVAL) return;

        try {
          const token = await registerForPushNotifications();
          if (token) {
            await savePushToken(currentUserId, token);
            lastTokenRefreshRef.current = Date.now();
            logger.info("[AuthContext] Push token refreshed");
          } else {
            await removePushToken(currentUserId);
          }
        } catch (err) {
          logger.warn("[AuthContext] Push token refresh failed:", err);
        }
      },
    );

    return () => sub.remove();
  }, [currentUserId]);

  // ── AppState-driven presence updates ────────────────────────────────
  // When the app goes to background, mark offline immediately.
  // When the app returns to foreground, mark online.
  // This supplements the RTDB onDisconnect handler for cases where the
  // RTDB connection stays alive but the user has backgrounded the app.
  useEffect(() => {
    if (!currentUserId) return;

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        setPresenceOnline(true);
      } else if (nextState === "background" || nextState === "inactive") {
        setPresenceOnline(false);
      }
    };

    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => sub.remove();
  }, [currentUserId]);

  useEffect(() => {
    try {
      const auth = getAuthInstance();
      if (typeof auth.onIdTokenChanged !== "function") {
        return () => {};
      }

      const unsubscribe = auth.onIdTokenChanged((user: any) => {
        logStartupEvent("Auth id-token changed", {
          uid: user?.uid ?? null,
          email: user?.email ?? null,
        });
        logger.info("🟣 [AuthContext] onIdTokenChanged →", {
          data: {
            startupSessionId: getStartupSessionId(),
            uid: user?.uid ?? null,
            email: user?.email ?? null,
          },
        });
      });

      return unsubscribe;
    } catch (error: any) {
      logger.warn(
        "[AuthContext] Failed to set up id-token listener:",
        error?.message ?? error,
      );
      return () => {};
    }
  }, []);

  useEffect(() => {
    try {
      const auth = getAuthInstance();
      logStartupEvent("AuthContext auth listener registering");

      // Log whether a persisted session exists at boot, BEFORE the
      // onAuthStateChanged listener fires.  This confirms AsyncStorage-
      // backed persistence is working.
      if (auth.currentUser) {
        logStartupEvent("Persisted auth session found at boot", {
          uid: auth.currentUser.uid,
          email: auth.currentUser.email ?? null,
        });
        logger.info(
          "🔵 [AuthContext] Persisted session found at boot:",
          auth.currentUser.email,
        );
      } else {
        logStartupEvent("No persisted auth session at boot");
        logger.info(
          "🔵 [AuthContext] No persisted session at boot — waiting for onAuthStateChanged",
        );
      }

      const unsubscribe = auth.onAuthStateChanged(
        async (user: any) => {
          const previousUid = currentUserIdRef.current;
          const nextUid = user?.uid ?? null;
          logStartupEvent("Auth state changed", {
            previousUid,
            nextUid,
            sameUid: previousUid === nextUid,
            email: user?.email ?? null,
          });
          logger.info(
            "🔵 [AuthContext] onAuthStateChanged →",
            user ? `restored ${user.email}` : "no user (logged out)",
            {
              data: {
                startupSessionId: getStartupSessionId(),
                previousUid,
                nextUid,
                sameUid: previousUid === nextUid,
              },
            },
          );
          if (user && pendingAuthNullTimerRef.current) {
            clearTimeout(pendingAuthNullTimerRef.current);
            pendingAuthNullTimerRef.current = null;
            logStartupEvent("Auth transient null recovered", {
              previousUid,
              recoveredUid: user.uid,
            });
          }

          if (!user && previousUid && !consumeExplicitLogoutIntent()) {
            if (pendingAuthNullTimerRef.current) {
              clearTimeout(pendingAuthNullTimerRef.current);
            }

            logStartupEvent("Auth null transition delayed", {
              previousUid,
              graceMs: TRANSIENT_AUTH_NULL_GRACE_MS,
            });

            // Keep the current user visible for a short grace period. In
            // standalone iOS builds Firebase can transiently report null
            // during restoration/refresh; committing that immediately causes
            // UserProvider/AppGate to tear down the navigation tree.
            pendingAuthNullTimerRef.current = setTimeout(() => {
              pendingAuthNullTimerRef.current = null;
              currentUserIdRef.current = null;
              void cleanupChatRuntimeForAuthTransition("auth_null_committed");
              logStartupEvent("Auth null transition committed", {
                previousUid,
                graceMs: TRANSIENT_AUTH_NULL_GRACE_MS,
              });
              setCurrentFirebaseUser(null);
              setCustomClaims(null);
              setLoading(false);
              setIsHydrated(true);
              cleanupPresence();
            }, TRANSIENT_AUTH_NULL_GRACE_MS);

            setLoading(false);
            setIsHydrated(true);
            return;
          }

          if (previousUid && previousUid !== nextUid) {
            void cleanupChatRuntimeForAuthTransition(
              nextUid ? "account_switch" : "logout",
            );
          }

          currentUserIdRef.current = nextUid;
          setCurrentFirebaseUser(user);

          // IMPORTANT: Mark auth as hydrated IMMEDIATELY so that AppGate
          // and UserContext can proceed without waiting for the network-
          // dependent token refresh below.  Custom claims are only used
          // for admin features — they are NOT needed for navigation gating.
          setLoading(false);
          setIsHydrated(true);

          // Fetch custom claims asynchronously (non-blocking)
          if (user) {
            // Initialize presence as soon as we know the UID
            try {
              initializePresence(user.uid);
            } catch {
              // non-critical
            }

            // Backfill `email` on the user's Firestore doc if it's missing.
            // Required for Add-Friends email lookup to work for accounts
            // that predate email-being-persisted-on-the-profile-doc. Safe
            // to call on every sign-in — becomes a no-op once written.
            try {
              void backfillUserEmailIfMissing(user.uid, user.email ?? null);
            } catch {
              // non-critical
            }

            // Refresh claims in the background — does NOT block hydration
            (async () => {
              try {
                const idTokenResult = await Promise.race([
                  user.getIdTokenResult(true),
                  new Promise<never>((_, reject) =>
                    setTimeout(
                      () => reject(new Error("getIdTokenResult timed out")),
                      10_000,
                    ),
                  ),
                ]);
                setCustomClaims(idTokenResult.claims);
                logger.info(
                  "🔵 [AuthContext] Custom claims loaded:",
                  idTokenResult.claims?.admin ? "admin" : "standard",
                );
              } catch (error) {
                logger.warn(
                  "⚠️ [AuthContext] Custom claims refresh failed (non-critical):",
                  error,
                );
                setCustomClaims(null);
              }
            })();
          } else {
            // Clean up presence when logging out
            cleanupPresence();
            setCustomClaims(null);
          }
        },
        (err: any) => {
          logger.warn(
            "Auth state change error (this is OK with placeholder config):",
            err.message,
          );
          setCurrentFirebaseUser(null);
          setCustomClaims(null);
          setLoading(false);
          setIsHydrated(true);
        },
      );

      return () => {
        logStartupEvent("AuthContext auth listener removed");
        unsubscribe();
      };
    } catch (error: any) {
      logger.warn(
        "Failed to set up auth listener (this is OK with placeholder config):",
        error.message,
      );
      setLoading(false);
      setIsHydrated(true);
      return () => {}; // Return no-op unsubscribe
    }
  }, []);

  const value = useMemo(
    () => ({
      currentFirebaseUser,
      loading,
      isHydrated,
      error: null as string | null,
      customClaims,
    }),
    [currentFirebaseUser, loading, isHydrated, customClaims],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
