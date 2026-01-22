/**
 * SnackbarContext - App-wide snackbar/toast notifications
 * Phase 15: Polish + Consistent Error Feedback
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { Snackbar } from "react-native-paper";
import { StyleSheet, Text } from "react-native";

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
  showSnackbar: (config: SnackbarConfig) => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showInfo: (message: string) => void;
  showWarning: (message: string) => void;
  hideSnackbar: () => void;
}

// =============================================================================
// Context
// =============================================================================

const SnackbarContext = createContext<SnackbarContextType | null>(null);

// =============================================================================
// Color Mappings
// =============================================================================

const SNACKBAR_COLORS: Record<
  SnackbarType,
  { background: string; text: string }
> = {
  info: { background: "#323232", text: "#fff" },
  success: { background: "#4CAF50", text: "#fff" },
  warning: { background: "#FF9800", text: "#000" },
  error: { background: "#d32f2f", text: "#fff" },
};

// =============================================================================
// Provider
// =============================================================================

interface SnackbarProviderProps {
  children: ReactNode;
}

export function SnackbarProvider({ children }: SnackbarProviderProps) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [type, setType] = useState<SnackbarType>("info");
  const [duration, setDuration] = useState(3000);
  const [action, setAction] = useState<SnackbarConfig["action"]>(undefined);

  const showSnackbar = useCallback((config: SnackbarConfig) => {
    setMessage(config.message);
    setType(config.type || "info");
    setDuration(config.duration || 3000);
    setAction(config.action);
    setVisible(true);
  }, []);

  const showSuccess = useCallback(
    (message: string) => {
      showSnackbar({ message, type: "success" });
    },
    [showSnackbar],
  );

  const showError = useCallback(
    (message: string) => {
      showSnackbar({ message, type: "error", duration: 4000 });
    },
    [showSnackbar],
  );

  const showInfo = useCallback(
    (message: string) => {
      showSnackbar({ message, type: "info" });
    },
    [showSnackbar],
  );

  const showWarning = useCallback(
    (message: string) => {
      showSnackbar({ message, type: "warning" });
    },
    [showSnackbar],
  );

  const hideSnackbar = useCallback(() => {
    setVisible(false);
  }, []);

  const colors = SNACKBAR_COLORS[type];

  return (
    <SnackbarContext.Provider
      value={{
        showSnackbar,
        showSuccess,
        showError,
        showInfo,
        showWarning,
        hideSnackbar,
      }}
    >
      {children}
      <Snackbar
        visible={visible}
        onDismiss={hideSnackbar}
        duration={duration}
        style={[styles.snackbar, { backgroundColor: colors.background }]}
        action={
          action
            ? {
                label: action.label,
                textColor: colors.text,
                onPress: action.onPress,
              }
            : undefined
        }
      >
        <Text style={[styles.messageText, { color: colors.text }]}>
          {message}
        </Text>
      </Snackbar>
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
    marginBottom: 20,
    marginHorizontal: 16,
  },
  messageText: {
    fontSize: 14,
  },
});
