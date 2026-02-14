import { IncomingCallOverlay } from "@/components/calls";
import ErrorBoundary from "@/components/ErrorBoundary";
import InAppToast from "@/components/InAppToast";
import { CallProvider } from "@/contexts/CallContext";
import { useOutboxProcessor } from "@/hooks/useOutboxProcessor";
import { lockToPortrait } from "@/hooks/useScreenOrientation";
import RootNavigator from "@/navigation/RootNavigator";
import {
  createCallNotificationChannel,
  initializeAppStateListener,
  initializeBackgroundCallHandler,
} from "@/services/calls";
import { initializeFirebase } from "@/services/firebase";
import { firebaseConfig } from "@/services/firebaseConfig.local";
import { AuthProvider } from "@/store/AuthContext";
import { CameraProvider } from "@/store/CameraContext";
import { InAppNotificationsProvider } from "@/store/InAppNotificationsContext";
import { SnackbarProvider } from "@/store/SnackbarContext";
import { ThemeProvider, useAppTheme } from "@/store/ThemeContext";
import { UserProvider } from "@/store/UserContext";
import type { RootStackParamList } from "@/types/navigation/root";
import {
  CommonActions,
  NavigationContainerRef,
} from "@react-navigation/native";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import React, { useCallback, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { PaperProvider } from "react-native-paper";

// Initialize Firebase synchronously before rendering
initializeFirebase(firebaseConfig);

// Lock the app to portrait at startup. Individual screens (e.g. Tropical
// Fishing) can temporarily switch to landscape via useScreenOrientation().
lockToPortrait();

// Initialize background call handler for incoming calls when app is in background
initializeBackgroundCallHandler();
initializeAppStateListener();
createCallNotificationChannel();

/**
 * Root error handler for ErrorBoundary
 * In production, this would send errors to a crash reporting service
 */
function handleError(error: Error, errorInfo: React.ErrorInfo): void {
  console.error("🚨 [App] Uncaught error:", error.message);
  console.error("🚨 [App] Component stack:", errorInfo.componentStack);
  // NOTE: Send to crash reporting service (Sentry, etc.)
}

/**
 * Inner app component that consumes theme context
 */
function AppContent() {
  const { theme, isDark, colors } = useAppTheme();
  const navigationRef =
    useRef<NavigationContainerRef<RootStackParamList>>(null);

  /**
   * Handle navigation from in-app toast notifications
   * Routes to the appropriate screen based on notification type
   */
  const handleToastNavigate = useCallback(
    (screen: string, params?: Record<string, unknown>) => {
      if (!navigationRef.current) return;

      // Use CommonActions for robust navigation across stacks
      navigationRef.current.dispatch(
        CommonActions.navigate({
          name: screen,
          params,
        }),
      );
    },
    [],
  );

  return (
    <PaperProvider theme={theme.paper}>
      <SnackbarProvider>
        <AuthProvider>
          <UserProvider>
            <CallProvider>
              <InAppNotificationsProvider>
                <CameraProvider>
                  <OutboxProcessorProvider />
                  <View
                    style={[
                      styles.container,
                      { backgroundColor: colors.background },
                    ]}
                  >
                    <RootNavigator navigationRef={navigationRef} />
                    <InAppToast onNavigate={handleToastNavigate} />
                    <IncomingCallOverlay />
                  </View>
                  <ExpoStatusBar style={isDark ? "light" : "dark"} />
                </CameraProvider>
              </InAppNotificationsProvider>
            </CallProvider>
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
      {children}
    </GestureHandlerRootView>
  );
}

export default function App() {
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
});
