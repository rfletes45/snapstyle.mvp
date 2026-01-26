/**
 * ErrorBoundary Component
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a branded fallback UI using
 * the Catppuccin theme.
 */

import { createLogger } from "@/utils/log";
import React, { Component, ErrorInfo, ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import {
  BorderRadius,
  DarkColors,
  FontSizes,
  FontWeights,
  Latte,
  LightColors,
  Mocha,
  Spacing,
} from "../../constants/theme";

const log = createLogger("ErrorBoundary");

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback UI */
  fallback?: ReactNode;
  /** Callback when error occurs */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component that catches render errors
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render shows the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error with our structured logger
    log.error("React render error caught", error, {
      operation: "componentDidCatch",
      data: {
        componentStack: errorInfo.componentStack?.slice(0, 500),
      },
    });

    // Update state with error info
    this.setState({ errorInfo });

    // Call optional error handler
    this.props.onError?.(error, errorInfo);

    // TODO: Send to crash reporting service (e.g., Sentry) when added
  }

  handleRetry = (): void => {
    log.info("User triggered error recovery", { operation: "handleRetry" });
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Default error fallback UI with Catppuccin theme
 */
interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onRetry: () => void;
}

function ErrorFallback({ error, errorInfo, onRetry }: ErrorFallbackProps) {
  const [showDetails, setShowDetails] = React.useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  // Use Catppuccin theme colors
  const colors = isDark ? DarkColors : LightColors;
  const palette = isDark ? Mocha : Latte;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Error icon with themed background */}
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: colors.errorContainer },
          ]}
        >
          <Text style={styles.icon}>😕</Text>
        </View>

        <Text style={[styles.title, { color: colors.text }]}>
          Oops! Something went wrong
        </Text>
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          We're sorry, but something unexpected happened. Please try again or
          restart the app if the issue persists.
        </Text>

        {/* Retry button */}
        <Pressable
          style={({ pressed }) => [
            styles.retryButton,
            { backgroundColor: colors.primary },
            pressed && styles.retryButtonPressed,
          ]}
          onPress={onRetry}
        >
          <Text style={[styles.retryButtonText, { color: colors.onPrimary }]}>
            Try Again
          </Text>
        </Pressable>

        {/* Show details toggle (dev only) */}
        {__DEV__ && (
          <Pressable
            style={styles.detailsToggle}
            onPress={() => setShowDetails(!showDetails)}
          >
            <Text style={[styles.detailsToggleText, { color: colors.primary }]}>
              {showDetails
                ? "Hide Technical Details"
                : "Show Technical Details"}
            </Text>
          </Pressable>
        )}

        {/* Error details (dev only) */}
        {__DEV__ && showDetails && (
          <ScrollView
            style={[
              styles.detailsContainer,
              { backgroundColor: colors.surfaceVariant },
            ]}
          >
            <Text
              style={[styles.detailsTitle, { color: colors.textSecondary }]}
            >
              Error:
            </Text>
            <Text style={[styles.detailsText, { color: colors.textMuted }]}>
              {error?.message || "Unknown error"}
            </Text>

            {error?.stack && (
              <>
                <Text
                  style={[styles.detailsTitle, { color: colors.textSecondary }]}
                >
                  Stack Trace:
                </Text>
                <Text style={[styles.detailsText, { color: colors.textMuted }]}>
                  {error.stack}
                </Text>
              </>
            )}

            {errorInfo?.componentStack && (
              <>
                <Text
                  style={[styles.detailsTitle, { color: colors.textSecondary }]}
                >
                  Component Stack:
                </Text>
                <Text style={[styles.detailsText, { color: colors.textMuted }]}>
                  {errorInfo.componentStack}
                </Text>
              </>
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  content: {
    alignItems: "center",
    maxWidth: 400,
    width: "100%",
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: BorderRadius.full,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  icon: {
    fontSize: 48,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  message: {
    fontSize: FontSizes.md,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  retryButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    minWidth: 160,
    alignItems: "center",
  },
  retryButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  retryButtonText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
  },
  detailsToggle: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  detailsToggleText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },
  detailsContainer: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    maxHeight: 300,
    width: "100%",
  },
  detailsTitle: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.bold,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailsText: {
    fontSize: 11,
    fontFamily: "monospace",
    lineHeight: 16,
  },
});

export default ErrorBoundary;
