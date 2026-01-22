import React from "react";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { PaperProvider } from "react-native-paper";
import { AuthProvider } from "@/store/AuthContext";
import { UserProvider } from "@/store/UserContext";
import { SnackbarProvider } from "@/store/SnackbarContext";
import { ThemeProvider, useAppTheme } from "@/store/ThemeContext";
import RootNavigator from "@/navigation/RootNavigator";
import ErrorBoundary from "@/components/ErrorBoundary";
import { initializeFirebase } from "@/services/firebase";
import { firebaseConfig } from "@/services/firebaseConfig.local";

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

  return (
    <PaperProvider theme={theme.paper}>
      <SnackbarProvider>
        <AuthProvider>
          <UserProvider>
            <RootNavigator />
            <ExpoStatusBar style={isDark ? "light" : "dark"} />
          </UserProvider>
        </AuthProvider>
      </SnackbarProvider>
    </PaperProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary onError={handleError}>
      <ThemeProvider initialMode="system">
        <AppContent />
      </ThemeProvider>
    </ErrorBoundary>
  );
}
