/**
 * Game Error Boundary Component
 *
 * Catches errors in game components and provides graceful recovery.
 * Prevents game crashes from taking down the entire app.
 */

import { Ionicons } from "@expo/vector-icons";
import React, { Component, ReactNode } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";


import { createLogger } from "@/utils/log";
const logger = createLogger("components/games/GameErrorBoundary");
// ============================================================================
// Types
// ============================================================================

export interface GameErrorBoundaryProps {
  children: ReactNode;
  /** Game type for error reporting */
  gameType?: string;
  /** Called when an error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Custom fallback UI */
  fallback?: ReactNode;
  /** Whether to show technical details (default: __DEV__ only) */
  showDetails?: boolean;
  /** Called when user presses retry */
  onRetry?: () => void;
  /** Called when user presses go back */
  onGoBack?: () => void;
}

interface GameErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  showStack: boolean;
}

// ============================================================================
// Error Boundary Component
// ============================================================================

export class GameErrorBoundary extends Component<
  GameErrorBoundaryProps,
  GameErrorBoundaryState
> {
  constructor(props: GameErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showStack: false,
    };
  }

  static getDerivedStateFromError(
    error: Error,
  ): Partial<GameErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo });

    // Report error
    const { onError, gameType } = this.props;
    if (onError) {
      onError(error, errorInfo);
    }

    // Log for debugging
    logger.error(`[GameErrorBoundary] Error in ${gameType || "game"}:`, error);
    logger.error(
      "[GameErrorBoundary] Component stack:",
      errorInfo.componentStack,
    );

    // NOTE: Send to error reporting service (Sentry, Crashlytics, etc.)
    this.reportError(error, errorInfo);
  }

  private reportError(error: Error, errorInfo: React.ErrorInfo): void {
    const { gameType } = this.props;

    // Structured error report
    const report = {
      type: "game_crash",
      gameType: gameType || "unknown",
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      // Would include device info, user context, etc. in production
    };

    // In production, this would send to an error tracking service
    if (__DEV__) {
      logger.info(
        "[GameErrorBoundary] Error report:",
        JSON.stringify(report, null, 2),
      );
    }
  }

  handleRetry = (): void => {
    const { onRetry } = this.props;

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showStack: false,
    });

    if (onRetry) {
      onRetry();
    }
  };

  handleGoBack = (): void => {
    const { onGoBack } = this.props;
    if (onGoBack) {
      onGoBack();
    }
  };

  toggleStack = (): void => {
    this.setState((prev) => ({ showStack: !prev.showStack }));
  };

  render(): ReactNode {
    const { hasError, error, errorInfo, showStack } = this.state;
    const { children, fallback, showDetails, gameType } = this.props;

    if (!hasError) {
      return children;
    }

    // Use custom fallback if provided
    if (fallback) {
      return fallback;
    }

    const shouldShowDetails = showDetails ?? __DEV__;

    return (
      <View style={styles.container}>
        <View style={styles.content}>
          {/* Error Icon */}
          <View style={styles.iconContainer}>
            <Ionicons name="game-controller-outline" size={48} color="#999" />
            <View style={styles.errorBadge}>
              <Ionicons name="close" size={16} color="#fff" />
            </View>
          </View>

          {/* Error Message */}
          <Text style={styles.title}>Game Crashed</Text>
          <Text style={styles.subtitle}>
            Something went wrong in {gameType ? `${gameType}` : "the game"}.
          </Text>

          {/* Error Details (dev only or if explicitly enabled) */}
          {shouldShowDetails && error && (
            <View style={styles.errorDetails}>
              <Text style={styles.errorName}>{error.name}</Text>
              <Text style={styles.errorMessage}>{error.message}</Text>

              <TouchableOpacity
                onPress={this.toggleStack}
                style={styles.toggleButton}
              >
                <Text style={styles.toggleText}>
                  {showStack ? "Hide" : "Show"} Stack Trace
                </Text>
                <Ionicons
                  name={showStack ? "chevron-up" : "chevron-down"}
                  size={16}
                  color="#666"
                />
              </TouchableOpacity>

              {showStack && (
                <ScrollView
                  style={styles.stackContainer}
                  showsVerticalScrollIndicator={true}
                >
                  <Text style={styles.stackText}>
                    {error.stack || "No stack trace available"}
                  </Text>
                  {errorInfo?.componentStack && (
                    <>
                      <Text style={styles.stackLabel}>Component Stack:</Text>
                      <Text style={styles.stackText}>
                        {errorInfo.componentStack}
                      </Text>
                    </>
                  )}
                </ScrollView>
              )}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={this.handleRetry}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={this.handleGoBack}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={20} color="#666" />
              <Text style={styles.backButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>

          {/* Support Info */}
          <Text style={styles.supportText}>
            If this keeps happening, please contact support.
          </Text>
        </View>
      </View>
    );
  }
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  content: {
    alignItems: "center",
    maxWidth: 400,
    width: "100%",
  },
  iconContainer: {
    position: "relative",
    marginBottom: 24,
  },
  errorBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    backgroundColor: "#F44336",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#999",
    textAlign: "center",
    marginBottom: 24,
  },
  errorDetails: {
    backgroundColor: "#2a2a2a",
    borderRadius: 8,
    padding: 16,
    width: "100%",
    marginBottom: 24,
  },
  errorName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#F44336",
    marginBottom: 4,
  },
  errorMessage: {
    fontSize: 12,
    color: "#ccc",
    marginBottom: 12,
  },
  toggleButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  toggleText: {
    fontSize: 12,
    color: "#666",
    marginRight: 4,
  },
  stackContainer: {
    maxHeight: 200,
    marginTop: 8,
  },
  stackLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#888",
    marginTop: 12,
    marginBottom: 4,
  },
  stackText: {
    fontSize: 10,
    color: "#888",
    fontFamily: "monospace",
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4CAF50",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    gap: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#333",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    gap: 8,
  },
  backButtonText: {
    color: "#999",
    fontSize: 16,
    fontWeight: "600",
  },
  supportText: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
  },
});

// ============================================================================
// HOC for wrapping game components
// ============================================================================

export function withGameErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  gameType: string,
): React.FC<
  P & { onError?: (error: Error, errorInfo: React.ErrorInfo) => void }
> {
  const WithErrorBoundary: React.FC<
    P & { onError?: (error: Error, errorInfo: React.ErrorInfo) => void }
  > = (props) => {
    const { onError, ...rest } = props;

    return (
      <GameErrorBoundary gameType={gameType} onError={onError}>
        <WrappedComponent {...(rest as P)} />
      </GameErrorBoundary>
    );
  };

  WithErrorBoundary.displayName = `WithGameErrorBoundary(${
    WrappedComponent.displayName || WrappedComponent.name || "Component"
  })`;

  return WithErrorBoundary;
}

// ============================================================================
// Export
// ============================================================================

export default GameErrorBoundary;
