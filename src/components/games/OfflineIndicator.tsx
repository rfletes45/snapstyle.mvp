/**
 * Offline Indicator Component
 *
 * Shows network status for games and handles offline mode gracefully.
 * Single-player games work offline; multiplayer shows connection status.
 */

import { Ionicons } from "@expo/vector-icons";
import * as Network from "expo-network";
import React, { memo, useCallback, useEffect, useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// ============================================================================
// Types
// ============================================================================

export type ConnectionStatus = "online" | "offline" | "reconnecting";

export interface OfflineIndicatorProps {
  /** Whether to show for multiplayer games (shows warning) */
  isMultiplayer?: boolean;
  /** Callback when connection status changes */
  onStatusChange?: (status: ConnectionStatus) => void;
  /** Custom message for offline state */
  offlineMessage?: string;
  /** Position on screen */
  position?: "top" | "bottom";
  /** Whether to auto-hide when online (default: true) */
  autoHide?: boolean;
}

export interface GameOfflineOverlayProps {
  /** Whether the overlay is visible */
  visible: boolean;
  /** Game type */
  gameType: string;
  /** Whether this is a multiplayer game */
  isMultiplayer: boolean;
  /** Callback to retry connection */
  onRetry?: () => void;
  /** Callback to continue offline (single-player only) */
  onContinueOffline?: () => void;
  /** Callback to go back */
  onGoBack?: () => void;
}

// ============================================================================
// Hook: useNetworkStatus
// ============================================================================

export interface NetworkDetails {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: Network.NetworkStateType | null;
}

export function useNetworkStatus() {
  const [status, setStatus] = useState<ConnectionStatus>("online");
  const [details, setDetails] = useState<NetworkDetails | null>(null);

  const checkNetworkStatus = useCallback(async () => {
    try {
      const networkState = await Network.getNetworkStateAsync();

      const newDetails: NetworkDetails = {
        isConnected: networkState.isConnected ?? false,
        isInternetReachable: networkState.isInternetReachable ?? null,
        type: networkState.type ?? null,
      };

      setDetails(newDetails);

      if (networkState.isConnected && networkState.isInternetReachable) {
        setStatus("online");
      } else if (
        networkState.isConnected &&
        networkState.isInternetReachable === null
      ) {
        setStatus("reconnecting");
      } else {
        setStatus("offline");
      }

      return (
        networkState.isConnected && networkState.isInternetReachable !== false
      );
    } catch {
      setStatus("offline");
      return false;
    }
  }, []);

  useEffect(() => {
    // Initial check
    checkNetworkStatus();

    // Poll for network status changes (expo-network doesn't have event listener)
    const interval = setInterval(checkNetworkStatus, 5000);

    return () => clearInterval(interval);
  }, [checkNetworkStatus]);

  const refresh = useCallback(async () => {
    return checkNetworkStatus();
  }, [checkNetworkStatus]);

  return { status, details, refresh };
}

// ============================================================================
// Offline Indicator Bar
// ============================================================================

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = memo(
  function OfflineIndicator({
    isMultiplayer = false,
    onStatusChange,
    offlineMessage,
    position = "top",
    autoHide = true,
  }) {
    const { status } = useNetworkStatus();
    const [visible, setVisible] = useState(false);
    const translateY = useState(new Animated.Value(-50))[0];

    // Notify parent of status changes
    useEffect(() => {
      if (onStatusChange) {
        onStatusChange(status);
      }
    }, [status, onStatusChange]);

    // Animate visibility
    useEffect(() => {
      const shouldShow = status !== "online" || !autoHide;
      setVisible(shouldShow);

      Animated.spring(translateY, {
        toValue: shouldShow ? 0 : position === "top" ? -50 : 50,
        useNativeDriver: true,
        tension: 100,
        friction: 12,
      }).start();
    }, [status, autoHide, position, translateY]);

    if (autoHide && status === "online") {
      return null;
    }

    const getMessage = () => {
      if (offlineMessage && status === "offline") {
        return offlineMessage;
      }

      switch (status) {
        case "offline":
          return isMultiplayer
            ? "You're offline. Multiplayer unavailable."
            : "You're offline. Playing locally.";
        case "reconnecting":
          return "Reconnecting...";
        case "online":
          return "Connected";
      }
    };

    const getIcon = () => {
      switch (status) {
        case "offline":
          return "cloud-offline";
        case "reconnecting":
          return "sync";
        case "online":
          return "cloud-done";
      }
    };

    const getColor = () => {
      switch (status) {
        case "offline":
          return isMultiplayer ? "#F44336" : "#FF9800";
        case "reconnecting":
          return "#FFC107";
        case "online":
          return "#4CAF50";
      }
    };

    return (
      <Animated.View
        style={[
          styles.indicator,
          position === "top" ? styles.indicatorTop : styles.indicatorBottom,
          { transform: [{ translateY }], backgroundColor: getColor() },
        ]}
      >
        <Ionicons name={getIcon()} size={16} color="#fff" />
        <Text style={styles.indicatorText}>{getMessage()}</Text>
      </Animated.View>
    );
  },
);

// ============================================================================
// Full-Screen Offline Overlay
// ============================================================================

export const GameOfflineOverlay: React.FC<GameOfflineOverlayProps> = memo(
  function GameOfflineOverlay({
    visible,
    gameType,
    isMultiplayer,
    onRetry,
    onContinueOffline,
    onGoBack,
  }) {
    const fadeAnim = useState(new Animated.Value(0))[0];

    useEffect(() => {
      Animated.timing(fadeAnim, {
        toValue: visible ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }, [visible, fadeAnim]);

    if (!visible) {
      return null;
    }

    return (
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <View style={styles.overlayContent}>
          {/* Icon */}
          <View style={styles.overlayIconContainer}>
            <Ionicons name="cloud-offline" size={64} color="#999" />
          </View>

          {/* Title */}
          <Text style={styles.overlayTitle}>Connection Lost</Text>

          {/* Message */}
          <Text style={styles.overlayMessage}>
            {isMultiplayer
              ? `Unable to connect to the game server. ${gameType} requires an internet connection to play with others.`
              : `You're currently offline. ${gameType} can continue in offline mode, but your progress won't be saved until you reconnect.`}
          </Text>

          {/* Buttons */}
          <View style={styles.overlayButtons}>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={onRetry}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.retryButtonText}>Retry Connection</Text>
            </TouchableOpacity>

            {!isMultiplayer && onContinueOffline && (
              <TouchableOpacity
                style={styles.continueButton}
                onPress={onContinueOffline}
                activeOpacity={0.8}
              >
                <Ionicons name="play" size={20} color="#fff" />
                <Text style={styles.continueButtonText}>Continue Offline</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.backButton}
              onPress={onGoBack}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={20} color="#999" />
              <Text style={styles.backButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>

          {/* Offline capabilities note */}
          {!isMultiplayer && (
            <View style={styles.offlineNote}>
              <Ionicons name="information-circle" size={16} color="#666" />
              <Text style={styles.offlineNoteText}>
                Scores will sync when you reconnect
              </Text>
            </View>
          )}
        </View>
      </Animated.View>
    );
  },
);

// ============================================================================
// Compact Connection Status Badge
// ============================================================================

export interface ConnectionBadgeProps {
  showWhenOnline?: boolean;
}

export const ConnectionBadge: React.FC<ConnectionBadgeProps> = memo(
  function ConnectionBadge({ showWhenOnline = false }) {
    const { status } = useNetworkStatus();

    if (status === "online" && !showWhenOnline) {
      return null;
    }

    const getColor = () => {
      switch (status) {
        case "online":
          return "#4CAF50";
        case "reconnecting":
          return "#FFC107";
        case "offline":
          return "#F44336";
      }
    };

    return (
      <View style={[styles.badge, { backgroundColor: getColor() }]}>
        <View style={styles.badgeDot} />
        <Text style={styles.badgeText}>
          {status === "online"
            ? "Online"
            : status === "reconnecting"
              ? "Connecting..."
              : "Offline"}
        </Text>
      </View>
    );
  },
);

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  // Indicator Bar
  indicator: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
    zIndex: 1000,
  },
  indicatorTop: {
    top: 0,
  },
  indicatorBottom: {
    bottom: 0,
  },
  indicatorText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },

  // Overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    zIndex: 9999,
  },
  overlayContent: {
    alignItems: "center",
    maxWidth: 320,
  },
  overlayIconContainer: {
    marginBottom: 24,
  },
  overlayTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 12,
    textAlign: "center",
  },
  overlayMessage: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  overlayButtons: {
    width: "100%",
    gap: 12,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1976D2",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    gap: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4CAF50",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    gap: 8,
  },
  continueButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#333",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    gap: 8,
  },
  backButtonText: {
    color: "#999",
    fontSize: 16,
    fontWeight: "600",
  },
  offlineNote: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 24,
    gap: 6,
  },
  offlineNoteText: {
    fontSize: 12,
    color: "#666",
  },

  // Badge
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 6,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#fff",
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
});

// ============================================================================
// Export
// ============================================================================

export default OfflineIndicator;
