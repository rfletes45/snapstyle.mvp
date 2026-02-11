import { getAuthInstance } from "@/services/firebase";
import { navigate as globalNavigate } from "@/services/navigationRef";
import {
  addNotificationReceivedListener,
  addNotificationResponseListener,
  registerForPushNotifications,
  savePushToken,
} from "@/services/notifications";
import { cleanupPresence, initializePresence } from "@/services/presence";
import * as Notifications from "expo-notifications";
import { User as FirebaseUser } from "firebase/auth";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";


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

  // Set up notification listeners
  useEffect(() => {
    // Listener for notifications received while app is foregrounded
    notificationListenerRef.current = addNotificationReceivedListener(
      (notification) => {
        logger.info("📱 Notification received:", notification.request.content);
      },
    );

    // Listener for notification taps
    responseListenerRef.current = addNotificationResponseListener(
      (response) => {
        logger.info(
          "📱 Notification tapped:",
          response.notification.request.content,
        );
        const data = response.notification.request.content.data;
        if (data?.type === "message" && typeof data.friendUid === "string") {
          // Navigate to the DM chat with this friend
          globalNavigate("ChatDetail", {
            friendUid: data.friendUid,
            initialData: {
              chatId: data.chatId,
              friendName:
                typeof data.friendName === "string"
                  ? data.friendName
                  : undefined,
            },
          });
        } else if (
          data?.type === "group_message" &&
          typeof data.groupId === "string"
        ) {
          // Navigate to the group chat
          globalNavigate("GroupChat", {
            groupId: data.groupId,
            groupName:
              typeof data.groupName === "string" ? data.groupName : undefined,
          });
        } else if (data?.type === "friend_request") {
          // Navigate to connections/friends screen
          globalNavigate("Connections");
        } else if (data?.type === "game_invite" && data?.gameType) {
          // Navigate to the game
          globalNavigate("MainTabs", {
            screen: "Play",
            params: {
              screen: "GamesHub",
            },
          });
        }
      },
    );

    return () => {
      if (notificationListenerRef.current) {
        notificationListenerRef.current.remove();
      }
      if (responseListenerRef.current) {
        responseListenerRef.current.remove();
      }
    };
  }, []);

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

  useEffect(() => {
    try {
      const auth = getAuthInstance();
      const unsubscribe = auth.onAuthStateChanged(
        async (user: any) => {
          logger.info(
            "🔵 [AuthContext] User state changed:",
            user?.email || "logged out",
          );
          setCurrentFirebaseUser(user);

          // Fetch custom claims when user logs in
          if (user) {
            try {
              // Force refresh to get the latest custom claims
              const idTokenResult = await user.getIdTokenResult(true);
              setCustomClaims(idTokenResult.claims);
              logger.info(
                "🔵 [AuthContext] Custom claims loaded:",
                idTokenResult.claims,
              );
              // Log admin status specifically for debugging
              logger.info(
                "🔵 [AuthContext] Admin status:",
                idTokenResult.claims.admin,
              );

              // Initialize presence tracking
              initializePresence(user.uid);
            } catch (error) {
              logger.error(
                "❌ [AuthContext] Error fetching custom claims:",
                error,
              );
              setCustomClaims(null);
            }
          } else {
            // Clean up presence when logging out
            cleanupPresence();
            setCustomClaims(null);
          }

          setLoading(false);
          setIsHydrated(true);
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

  return (
    <AuthContext.Provider
      value={{
        currentFirebaseUser,
        loading,
        isHydrated,
        error: null,
        customClaims,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
