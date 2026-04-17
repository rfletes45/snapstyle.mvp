import ErrorBoundary from "@/components/ErrorBoundary";
import InAppToast from "@/components/InAppToast";
import { FloatingVideoOverlay } from "@/components/stream/FloatingVideoOverlay";
import IncomingCallHandler from "@/components/stream/IncomingCallHandler";
import { NativePiPBridge } from "@/components/stream/NativePiPBridge";
import {
  StreamCallProvider,
  StreamVideoEffectsProvider,
} from "@/contexts/StreamCallContext";
import { loadCustomFonts } from "@/fonts/fontLoader";
import { useOutboxProcessor } from "@/hooks/useOutboxProcessor";
import { lockToPortrait } from "@/hooks/useScreenOrientation";
import RootNavigator from "@/navigation/RootNavigator";
import { initializeFirebase } from "@/services/firebase";
import { firebaseConfig } from "@/services/firebaseConfig";
import { navigate as globalNavigate } from "@/services/navigationRef";
import { AuthProvider } from "@/store/AuthContext";
import { CameraProvider } from "@/store/CameraContext";
import { ConversationDisplayModeProvider } from "@/store/ConversationDisplayModeContext";
import { InAppNotificationsProvider } from "@/store/InAppNotificationsContext";
import { SnackbarProvider } from "@/store/SnackbarContext";
import { ThemeProvider, useAppTheme } from "@/store/ThemeContext";
import { UserProvider } from "@/store/UserContext";
import { KeyboardProvider } from "@/utils/optionalKeyboardController";
import {
  logStartupError,
  logStartupEvent,
  logStartupMount,
  logStartupUnmount,
} from "@/utils/startupTrace";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PaperProvider } from "react-native-paper";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";

// Keep splash screen visible until we explicitly hide it
SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden or not available — safe to ignore
});

logStartupEvent("App module evaluated");

// Initialize Firebase synchronously before rendering
logStartupEvent("Firebase initialization starting");
try {
  initializeFirebase(firebaseConfig);
  logStartupEvent("Firebase initialization completed");
} catch (e) {
  logStartupError("Firebase initialization failed", e);
  console.error("[BOOT] Firebase init failed:", e);
}

/**
 * Root error handler for ErrorBoundary
 * In production, this would send errors to a crash reporting service
 */
function handleError(error: Error, errorInfo: React.ErrorInfo): void {
  logStartupError("ErrorBoundary captured uncaught error", error, {
    componentStack: errorInfo.componentStack,
  });
  console.error("🚨 [App] Uncaught error:", error.message);
  console.error("🚨 [App] Component stack:", errorInfo.componentStack);
  // NOTE: Send to crash reporting service (Sentry, etc.)
}

/**
 * Inner app component that consumes theme context
 */
function AppContent() {
  const { theme, isDark, colors } = useAppTheme();
  const [currentRouteName, setCurrentRouteName] = useState<
    string | undefined
  >();
  const currentRouteNameRef = useRef<string | undefined>();

  // ── Font loading gate ───────────────────────────────────────────────────
  const [fontsReady, setFontsReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    currentRouteNameRef.current = currentRouteName;
  }, [currentRouteName]);

  useEffect(() => {
    logStartupMount("AppContent");
    return () => {
      logStartupUnmount("AppContent", {
        lastKnownRouteName: currentRouteNameRef.current ?? null,
      });
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    logStartupEvent("Font loading started");

    // Race font loading against a 5-second timeout so a corrupt/missing
    // font asset can never hang the app indefinitely.
    const fontTimeout = new Promise<boolean>((resolve) =>
      setTimeout(() => {
        logStartupEvent("Font loading timeout reached", {
          timeoutMs: 5_000,
        });
        console.warn("[BOOT] Font loading timed out after 5s");
        resolve(false);
      }, 5_000),
    );

    Promise.race([loadCustomFonts(), fontTimeout])
      .then((ok) => {
        if (mounted) setFontsReady(true);
        logStartupEvent("Font loading resolved", { ok });
        if (!ok) {
          console.warn(
            "[App] Custom fonts failed to load — using system defaults",
          );
        }
      })
      .catch((err) => {
        logStartupError("Font loading failed", err);
        console.error("[BOOT] Font loading error:", err);
        if (mounted) {
          setFontsReady(true); // proceed anyway
          setBootError("Font loading failed");
        }
      })
      .finally(() => {
        // Hide the native splash screen once fonts are resolved
        logStartupEvent("Splash screen hide requested");
        SplashScreen.hideAsync().catch(() => {});
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Stream Video SDK handles its own initialization via StreamCallProvider.
  // No legacy call bootstrap needed.

  // Lock the app to portrait after the React tree mounts.
  useEffect(() => {
    void lockToPortrait();
  }, []);

  useEffect(() => {
    if (bootError) {
      logStartupEvent("Boot error fallback rendered", {
        bootError,
      });
    }
  }, [bootError]);

  // Sync Android system UI (navigation bar) background with theme
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);

  /**
   * Handle navigation from in-app toast notifications
   * Routes to the appropriate screen based on notification type
   */
  const handleToastNavigate = useCallback(
    (screen: string, params?: Record<string, unknown>) => {
      globalNavigate(screen as any, params as any);
    },
    [],
  );

  // Show a minimal loading view while fonts are loading
  if (!fontsReady) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Show error fallback if boot failed catastrophically
  if (bootError) {
    return (
      <View
        style={[
          styles.container,
          styles.errorContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <Text
          style={{
            color: colors.text,
            fontSize: 18,
            fontWeight: "bold",
            marginBottom: 8,
          }}
        >
          Something went wrong
        </Text>
        <Text
          style={{
            color: colors.text,
            fontSize: 14,
            textAlign: "center",
          }}
        >
          {bootError}
        </Text>
        <Text style={{ color: colors.text, fontSize: 12, marginTop: 16 }}>
          Please restart the app.
        </Text>
      </View>
    );
  }

  return (
    <PaperProvider theme={theme.paper}>
      <SnackbarProvider>
        <AuthProvider>
          <UserProvider>
            <ConversationDisplayModeProvider>
              <StreamCallProvider>
                <InAppNotificationsProvider>
                  <CameraProvider>
                    <OutboxProcessorProvider />
                    <View
                      style={[
                        styles.container,
                        { backgroundColor: colors.background },
                      ]}
                    >
                      <RootNavigator
                        onRouteChange={(routeName) =>
                          setCurrentRouteName(routeName)
                        }
                      />
                      <InAppToast onNavigate={handleToastNavigate} />
                      <StreamVideoEffectsProvider>
                        <IncomingCallHandler
                          onNavigateToCall={(callId, mode) => {
                            globalNavigate("DirectCall" as any, {
                              callId,
                              recipientName: "",
                              mode,
                              isOutgoing: false,
                            });
                          }}
                        />
                      </StreamVideoEffectsProvider>
                      <NativePiPBridge />
                      <FloatingVideoOverlay
                        isOnCallScreen={
                          currentRouteName === undefined ||
                          currentRouteName === "DirectCall" ||
                          currentRouteName === "VoiceChannel"
                        }
                      />
                    </View>
                    <ExpoStatusBar style={isDark ? "light" : "dark"} />
                  </CameraProvider>
                </InAppNotificationsProvider>
              </StreamCallProvider>
            </ConversationDisplayModeProvider>
          </UserProvider>
        </AuthProvider>
      </SnackbarProvider>
    </PaperProvider>
  );
}

/**
 * Provider component that runs the outbox processor hook.
 * Must be inside AuthProvider to access user state.
 * Processes pending messages on app start, foreground, and network restore.
 */
function OutboxProcessorProvider(): null {
  useOutboxProcessor();
  return null;
}

/**
 * Themed root wrapper that applies background color from theme context.
 * This ensures no white flashing during screen transitions.
 */
function ThemedRootWrapper({ children }: { children: React.ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <GestureHandlerRootView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        {children}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function App() {
  useEffect(() => {
    logStartupMount("AppRoot");
    return () => {
      logStartupUnmount("AppRoot");
    };
  }, []);

  return (
    <KeyboardProvider>
      <ErrorBoundary onError={handleError}>
        <ThemeProvider>
          <ThemedRootWrapper>
            <AppContent />
          </ThemedRootWrapper>
        </ThemeProvider>
      </ErrorBoundary>
    </KeyboardProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorContainer: {
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
});
