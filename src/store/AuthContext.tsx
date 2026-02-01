import { getAuthInstance } from "@/services/firebase";
import {
  addNotificationReceivedListener,
  addNotificationResponseListener,
  registerForPushNotifications,
  removePushToken,
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
        console.log("📱 Notification received:", notification.request.content);
      },
    );

    // Listener for notification taps
    responseListenerRef.current = addNotificationResponseListener(
      (response) => {
        console.log(
          "📱 Notification tapped:",
          response.notification.request.content,
        );
        // TODO: Handle navigation based on notification data
        const data = response.notification.request.content.data;
        if (data?.type === "message" && data?.chatId) {
          // Could navigate to chat here
          console.log("Would navigate to chat:", data.chatId);
        } else if (data?.type === "friend_request") {
          // Could navigate to friends screen
          console.log("Would navigate to friends");
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
          console.error("[AuthContext] Error registering push token:", error);
        }
      } else if (!currentFirebaseUser && previousUserIdRef.current) {
        // User logged out - remove push token
        try {
          await removePushToken(previousUserIdRef.current);
          previousUserIdRef.current = null;
        } catch (error) {
          console.error("[AuthContext] Error removing push token:", error);
        }
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
          console.log(
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
              console.log(
                "🔵 [AuthContext] Custom claims loaded:",
                idTokenResult.claims,
              );
              // Log admin status specifically for debugging
              console.log(
                "🔵 [AuthContext] Admin status:",
                idTokenResult.claims.admin,
              );

              // Initialize presence tracking
              initializePresence(user.uid);
            } catch (error) {
              console.error(
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
          console.warn(
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
      console.warn(
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
