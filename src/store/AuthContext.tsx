import { getAuthInstance } from "@/services/firebase";
import { navigate as globalNavigate } from "@/services/navigationRef";
import {
  addNotificationReceivedListener,
  addNotificationResponseListener,
  getLastNotificationResponse,
  registerForPushNotifications,
  removePushToken,
  savePushToken,
} from "@/services/notifications";
import {
  normalizeNotificationPayload,
  shouldHandleNotificationByDedupeKey,
} from "@/services/notifications/normalizeNotification";
import {
  cleanupPresence,
  initializePresence,
  setPresenceOnline,
} from "@/services/presence";
import { markUserNotificationRead } from "@/services/userNotifications";
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
const logger = createLogger("store/AuthContext");
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
  const notificationListenerRef = useRef<Notifications.Subscription | null>(
    null,
  );
  const responseListenerRef = useRef<Notifications.Subscription | null>(null);
  const previousUserIdRef = useRef<string | null>(null);
  const recentTapKeysRef = useRef<Map<string, number>>(new Map());

  // Set up notification listeners
  useEffect(() => {
    const handleNotificationResponse = async (
      response: Notifications.NotificationResponse | null,
    ) => {
      if (!response) return;

      logger.info(
        "📱 Notification tapped:",
        response.notification.request.content,
      );

      const data = response.notification.request.content.data;
      const normalized = normalizeNotificationPayload(data);
      if (!normalized) return;

      if (
        !shouldHandleNotificationByDedupeKey(
          recentTapKeysRef.current,
          normalized.dedupeKey,
        )
      ) {
        return;
      }

      if (currentFirebaseUser?.uid && normalized.notificationId) {
        markUserNotificationRead(
          currentFirebaseUser.uid,
          normalized.notificationId,
        ).catch((error) => {
          logger.warn("[AuthContext] Failed to mark notification read:", error);
        });
      }

      globalNavigate(
        normalized.route.screen as any,
        normalized.route.params as any,
      );
    };

    // Listener for notifications received while app is foregrounded
    notificationListenerRef.current = addNotificationReceivedListener(
      (notification) => {
        logger.info("📱 Notification received:", notification.request.content);
      },
    );

    // Listener for notification taps
    responseListenerRef.current = addNotificationResponseListener(
      (response) => void handleNotificationResponse(response),
    );

    getLastNotificationResponse()
      .then((response) => handleNotificationResponse(response))
      .catch((error) => {
        logger.warn(
          "[AuthContext] Failed to read last notification response:",
          error,
        );
      });

    return () => {
      if (notificationListenerRef.current) {
        notificationListenerRef.current.remove();
      }
      if (responseListenerRef.current) {
        responseListenerRef.current.remove();
      }
    };
  }, [currentFirebaseUser]);

  // Register for push notifications when user logs in
  useEffect(() => {
    const registerPushToken = async () => {
      if (
        currentFirebaseUser &&
        currentFirebaseUser.uid !== previousUserIdRef.current
      ) {
        try {
          const token = await registerForPushNotifications();
          if (token) {
            await savePushToken(currentFirebaseUser.uid, token);
          } else {
            await removePushToken(currentFirebaseUser.uid);
          }
          previousUserIdRef.current = currentFirebaseUser.uid;
        } catch (error) {
          logger.error("[AuthContext] Error registering push token:", error);
        }
      } else if (!currentFirebaseUser && previousUserIdRef.current) {
        // User logged out - token was already removed before signOut
        // (see logout() in auth.ts). Just clear the ref.
        previousUserIdRef.current = null;
      }
    };

    // Only register on native platforms (not web)
    if (Platform.OS !== "web") {
      registerPushToken();
    }
  }, [currentFirebaseUser]);

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
        if (!currentFirebaseUser) return;
        const elapsed = Date.now() - lastTokenRefreshRef.current;
        if (elapsed < TOKEN_REFRESH_INTERVAL) return;

        try {
          const token = await registerForPushNotifications();
          if (token) {
            await savePushToken(currentFirebaseUser.uid, token);
            lastTokenRefreshRef.current = Date.now();
            logger.info("[AuthContext] Push token refreshed");
          } else {
            await removePushToken(currentFirebaseUser.uid);
          }
        } catch (err) {
          logger.warn("[AuthContext] Push token refresh failed:", err);
        }
      },
    );

    return () => sub.remove();
  }, [currentFirebaseUser]);

  // ── AppState-driven presence updates ────────────────────────────────
  // When the app goes to background, mark offline immediately.
  // When the app returns to foreground, mark online.
  // This supplements the RTDB onDisconnect handler for cases where the
  // RTDB connection stays alive but the user has backgrounded the app.
  useEffect(() => {
    if (!currentFirebaseUser) return;

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        setPresenceOnline(true);
      } else if (nextState === "background" || nextState === "inactive") {
        setPresenceOnline(false);
      }
    };

    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => sub.remove();
  }, [currentFirebaseUser]);

  useEffect(() => {
    try {
      const auth = getAuthInstance();

      // Log whether a persisted session exists at boot, BEFORE the
      // onAuthStateChanged listener fires.  This confirms AsyncStorage-
      // backed persistence is working.
      if (auth.currentUser) {
        logger.info(
          "🔵 [AuthContext] Persisted session found at boot:",
          auth.currentUser.email,
        );
      } else {
        logger.info(
          "🔵 [AuthContext] No persisted session at boot — waiting for onAuthStateChanged",
        );
      }

      const unsubscribe = auth.onAuthStateChanged(
        async (user: any) => {
          logger.info(
            "🔵 [AuthContext] onAuthStateChanged →",
            user ? `restored ${user.email}` : "no user (logged out)",
          );
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

      return unsubscribe;
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
