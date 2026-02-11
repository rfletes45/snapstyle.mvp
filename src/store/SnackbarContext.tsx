/**
 * SnackbarContext - App-wide snackbar/toast notifications
 *
 * Features:
 * - Theme-aware colors (Catppuccin palette)
 * - Typed snackbar variants (info, success, warning, error)
 * - Action buttons with retry support
 * - Enhanced error display with suggestions
 */

import { getErrorDisplayInfo } from "@/utils/errors";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";
import { StyleSheet, Text, View } from "react-native";
import { Portal, Snackbar } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BorderRadius, Latte, Mocha, Spacing } from "@/constants/theme";
import { useAppTheme } from "./ThemeContext";

// =============================================================================
// Types
// =============================================================================

type SnackbarType = "info" | "success" | "warning" | "error";

interface SnackbarConfig {
  message: string;
  type?: SnackbarType;
  duration?: number;
  action?: {
    label: string;
    onPress: () => void;
  };
}

interface SnackbarContextType {
  /** Show a snackbar with full configuration */
  showSnackbar: (config: SnackbarConfig) => void;
  /** Show success message */
  showSuccess: (message: string) => void;
  /** Show error message (basic) */
  showError: (message: string) => void;
  /** Show error with retry support */
  showErrorWithRetry: (message: string, onRetry: () => void) => void;
  /** Show error from AppError with appropriate action */
  showAppError: (error: unknown, onRetry?: () => void) => void;
  /** Show info message */
  showInfo: (message: string) => void;
  /** Show warning message */
  showWarning: (message: string) => void;
  /** Hide current snackbar */
  hideSnackbar: () => void;
}

// =============================================================================
// Context
// =============================================================================

const SnackbarContext = createContext<SnackbarContextType | null>(null);

// =============================================================================
// Color Mappings (Theme-aware)
// =============================================================================

interface SnackbarColors {
  background: string;
  text: string;
  actionText: string;
  icon: string;
}

const LIGHT_SNACKBAR_COLORS: Record<SnackbarType, SnackbarColors> = {
  info: {
    background: Latte.surface2,
    text: Latte.text,
    actionText: Latte.mauve,
    icon: "ℹ️",
  },
  success: {
    background: "#dcfce7", // Light green tint
    text: Latte.green,
    actionText: Latte.green,
    icon: "✓",
  },
  warning: {
    background: "#fef3c7", // Light amber tint
    text: "#92400e", // Dark amber
    actionText: "#b45309",
    icon: "⚠",
  },
  error: {
    background: "#fee2e2", // Light red tint
    text: Latte.red,
    actionText: Latte.red,
    icon: "✕",
  },
};

const DARK_SNACKBAR_COLORS: Record<SnackbarType, SnackbarColors> = {
  info: {
    background: Mocha.surface1,
    text: Mocha.text,
    actionText: Mocha.mauve,
    icon: "ℹ️",
  },
  success: {
    background: "#14532d", // Dark green
    text: Mocha.green,
    actionText: Mocha.green,
    icon: "✓",
  },
  warning: {
    background: "#78350f", // Dark amber
    text: Mocha.yellow,
    actionText: Mocha.yellow,
    icon: "⚠",
  },
  error: {
    background: "#7f1d1d", // Dark red
    text: Mocha.red,
    actionText: Mocha.red,
    icon: "✕",
  },
};

// =============================================================================
// Provider
// =============================================================================

interface SnackbarProviderProps {
  children: ReactNode;
}

export function SnackbarProvider({ children }: SnackbarProviderProps) {
  const { isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [type, setType] = useState<SnackbarType>("info");
  const [duration, setDuration] = useState(3000);
  const [action, setAction] = useState<SnackbarConfig["action"]>(undefined);

  const colorScheme = isDark ? DARK_SNACKBAR_COLORS : LIGHT_SNACKBAR_COLORS;

  const showSnackbar = useCallback((config: SnackbarConfig) => {
    // Dismiss any existing snackbar first
    setVisible(false);

    // Small delay to allow dismiss animation
    setTimeout(() => {
      setMessage(config.message);
      setType(config.type || "info");
      setDuration(config.duration || 3000);
      setAction(config.action);
      setVisible(true);
    }, 100);
  }, []);

  const showSuccess = useCallback(
    (msg: string) => {
      showSnackbar({ message: msg, type: "success", duration: 2500 });
    },
    [showSnackbar],
  );

  const showError = useCallback(
    (msg: string) => {
      showSnackbar({ message: msg, type: "error", duration: 4000 });
    },
    [showSnackbar],
  );

  const showErrorWithRetry = useCallback(
    (msg: string, onRetry: () => void) => {
      showSnackbar({
        message: msg,
        type: "error",
        duration: 6000,
        action: {
          label: "Retry",
          onPress: () => {
            setVisible(false);
            onRetry();
          },
        },
      });
    },
    [showSnackbar],
  );

  const showAppError = useCallback(
    (error: unknown, onRetry?: () => void) => {
      const displayInfo = getErrorDisplayInfo(error);

      // Build the message
      const fullMessage = displayInfo.message;

      // Determine action based on error type
      let actionConfig: SnackbarConfig["action"] | undefined;

      if (displayInfo.canRetry && onRetry) {
        actionConfig = {
          label: displayInfo.actionText,
          onPress: () => {
            setVisible(false);
            onRetry();
          },
        };
      }

      showSnackbar({
        message: fullMessage,
        type: "error",
        duration: actionConfig ? 6000 : 4000,
        action: actionConfig,
      });
    },
    [showSnackbar],
  );

  const showInfo = useCallback(
    (msg: string) => {
      showSnackbar({ message: msg, type: "info" });
    },
    [showSnackbar],
  );

  const showWarning = useCallback(
    (msg: string) => {
      showSnackbar({ message: msg, type: "warning", duration: 4000 });
    },
    [showSnackbar],
  );

  const hideSnackbar = useCallback(() => {
    setVisible(false);
  }, []);

  const colors = colorScheme[type];

  return (
    <SnackbarContext.Provider
      value={{
        showSnackbar,
        showSuccess,
        showError,
        showErrorWithRetry,
        showAppError,
        showInfo,
        showWarning,
        hideSnackbar,
      }}
    >
      {children}
      <Portal>
        <Snackbar
          visible={visible}
          onDismiss={hideSnackbar}
          duration={duration}
          style={[
            styles.snackbar,
            {
              backgroundColor: colors.background,
              marginBottom: Math.max(insets.bottom, 20),
            },
          ]}
          action={
            action
              ? {
                  label: action.label,
                  textColor: colors.actionText,
                  onPress: action.onPress,
                }
              : undefined
          }
        >
          <View style={styles.content}>
            <Text style={[styles.icon, { color: colors.text }]}>
              {colors.icon}
            </Text>
            <Text style={[styles.messageText, { color: colors.text }]}>
              {message}
            </Text>
          </View>
        </Snackbar>
      </Portal>
    </SnackbarContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

export function useSnackbar(): SnackbarContextType {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error("useSnackbar must be used within a SnackbarProvider");
  }
  return context;
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  snackbar: {
    marginHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
  },
  icon: {
    fontSize: 16,
    marginRight: Spacing.sm,
  },
  messageText: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
    lineHeight: 20,
  },
});
