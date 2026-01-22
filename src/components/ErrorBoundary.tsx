/**
 * ErrorBoundary Component
 * Phase 10: Global error boundary for React render crashes
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI.
 */

import React, { Component, ErrorInfo, ReactNode } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { AppColors, Spacing, BorderRadius } from "../../constants/theme";

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
    // Log the error
    console.error("🚨 [ErrorBoundary] Caught error:", error);
    console.error(
      "🚨 [ErrorBoundary] Component stack:",
      errorInfo.componentStack,
    );

    // Update state with error info
    this.setState({ errorInfo });

    // Call optional error handler
    this.props.onError?.(error, errorInfo);

    // TODO: Send to crash reporting service (e.g., Sentry) when added
  }

  handleRetry = (): void => {
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
 * Default error fallback UI
 */
interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onRetry: () => void;
}

function ErrorFallback({ error, errorInfo, onRetry }: ErrorFallbackProps) {
  const [showDetails, setShowDetails] = React.useState(false);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Error icon */}
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>⚠️</Text>
        </View>

        <Text style={styles.title}>Oops! Something went wrong</Text>
        <Text style={styles.message}>
          We're sorry, but something unexpected happened. Please try again.
        </Text>

        {/* Retry button */}
        <Pressable style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </Pressable>

        {/* Show details toggle (dev only) */}
        {__DEV__ && (
          <Pressable
            style={styles.detailsToggle}
            onPress={() => setShowDetails(!showDetails)}
          >
            <Text style={styles.detailsToggleText}>
              {showDetails ? "Hide Details" : "Show Details"}
            </Text>
          </Pressable>
        )}

        {/* Error details (dev only) */}
        {__DEV__ && showDetails && (
          <ScrollView style={styles.detailsContainer}>
            <Text style={styles.detailsTitle}>Error:</Text>
            <Text style={styles.detailsText}>
              {error?.message || "Unknown error"}
            </Text>

            {error?.stack && (
              <>
                <Text style={styles.detailsTitle}>Stack:</Text>
                <Text style={styles.detailsText}>{error.stack}</Text>
              </>
            )}

            {errorInfo?.componentStack && (
              <>
                <Text style={styles.detailsTitle}>Component Stack:</Text>
                <Text style={styles.detailsText}>
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
    backgroundColor: AppColors.background,
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
    width: 80,
    height: 80,
    borderRadius: BorderRadius.xl,
    backgroundColor: AppColors.errorLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: AppColors.textPrimary,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  message: {
    fontSize: 16,
    color: AppColors.textSecondary,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: Spacing.xl,
  },
  retryButton: {
    backgroundColor: AppColors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  retryButtonText: {
    color: AppColors.textOnPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
  detailsToggle: {
    paddingVertical: Spacing.sm,
  },
  detailsToggleText: {
    color: AppColors.primary,
    fontSize: 14,
  },
  detailsContainer: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: AppColors.surfaceVariant,
    borderRadius: BorderRadius.md,
    maxHeight: 300,
    width: "100%",
  },
  detailsTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: AppColors.textSecondary,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  detailsText: {
    fontSize: 11,
    color: AppColors.textMuted,
    fontFamily: "monospace",
  },
});

export default ErrorBoundary;
