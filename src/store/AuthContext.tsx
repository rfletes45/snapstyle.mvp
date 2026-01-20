import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { User as FirebaseUser } from "firebase/auth";
import { Platform } from "react-native";
import { getAuthInstance } from "@/services/firebase";
import {
  registerForPushNotifications,
  savePushToken,
  removePushToken,
  addNotificationReceivedListener,
  addNotificationResponseListener,
} from "@/services/notifications";
import * as Notifications from "expo-notifications";

export interface AuthContextType {
  currentFirebaseUser: FirebaseUser | null;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentFirebaseUser, setCurrentFirebaseUser] =
    useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const notificationListenerRef = useRef<Notifications.Subscription | null>(null);
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
    responseListenerRef.current = addNotificationResponseListener((response) => {
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
    });

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
      if (currentFirebaseUser && currentFirebaseUser.uid !== previousUserIdRef.current) {
        try {
          console.log("🔵 [AuthContext] Registering for push notifications");
          const token = await registerForPushNotifications();
          if (token) {
            await savePushToken(currentFirebaseUser.uid, token);
            console.log("✅ [AuthContext] Push token saved");
          }
          previousUserIdRef.current = currentFirebaseUser.uid;
        } catch (error) {
          console.error("❌ [AuthContext] Error registering push token:", error);
        }
      } else if (!currentFirebaseUser && previousUserIdRef.current) {
        // User logged out - remove push token
        try {
          console.log("🔵 [AuthContext] Removing push token on logout");
          await removePushToken(previousUserIdRef.current);
          previousUserIdRef.current = null;
        } catch (error) {
          console.error("❌ [AuthContext] Error removing push token:", error);
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
        (user: any) => {
          console.log(
            "AuthContext: User state changed",
            user?.email || "logged out",
          );
          setCurrentFirebaseUser(user);
          setLoading(false);
        },
        (err: any) => {
          console.warn(
            "Auth state change error (this is OK with placeholder config):",
            err.message,
          );
          setCurrentFirebaseUser(null);
          setLoading(false);
        },
      );

      return unsubscribe;
    } catch (error: any) {
      console.warn(
        "Failed to set up auth listener (this is OK with placeholder config):",
        error.message,
      );
      setLoading(false);
      return () => {}; // Return no-op unsubscribe
    }
  }, []);

  return (
    <AuthContext.Provider value={{ currentFirebaseUser, loading, error: null }}>
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
