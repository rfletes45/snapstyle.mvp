import ErrorBoundary from "@/components/ErrorBoundary";
import InAppToast from "@/components/InAppToast";
import { useOutboxProcessor } from "@/hooks/useOutboxProcessor";
import RootNavigator from "@/navigation/RootNavigator";
import { initializeFirebase } from "@/services/firebase";
import { firebaseConfig } from "@/services/firebaseConfig.local";
import { AuthProvider } from "@/store/AuthContext";
import { InAppNotificationsProvider } from "@/store/InAppNotificationsContext";
import { SnackbarProvider } from "@/store/SnackbarContext";
import { ThemeProvider, useAppTheme } from "@/store/ThemeContext";
import { UserProvider } from "@/store/UserContext";
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

/**
 * Root error handler for ErrorBoundary
 * In production, this would send errors to a crash reporting service
 */
function handleError(error: Error, errorInfo: React.ErrorInfo): void {
  console.error("🚨 [App] Uncaught error:", error.message);
  console.error("🚨 [App] Component stack:", errorInfo.componentStack);
  // TODO: Send to crash reporting service (Sentry, etc.)
}

/**
 * Inner app component that consumes theme context
 */
function AppContent() {
  const { theme, isDark } = useAppTheme();
  const navigationRef = useRef<NavigationContainerRef<any>>(null);

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
            <InAppNotificationsProvider>
              <OutboxProcessorProvider />
              <View style={styles.container}>
                <RootNavigator navigationRef={navigationRef} />
                <InAppToast onNavigate={handleToastNavigate} />
              </View>
              <ExpoStatusBar style={isDark ? "light" : "dark"} />
            </InAppNotificationsProvider>
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

export default function App() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <KeyboardProvider>
        <ErrorBoundary onError={handleError}>
          <ThemeProvider initialMode="system">
            <AppContent />
          </ThemeProvider>
        </ErrorBoundary>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
