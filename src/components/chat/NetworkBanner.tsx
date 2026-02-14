/**
 * NetworkBanner Component
 *
 * Displays a non-intrusive banner at the top of a chat screen
 * indicating offline/online status.
 *
 * - Offline: red/orange banner with "You're offline" message
 * - Back online: green banner that auto-dismisses
 *
 * @module components/chat/NetworkBanner
 */

import { Spacing } from "@/constants/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet } from "react-native";
import { Text, useTheme } from "react-native-paper";

// =============================================================================
// Types
// =============================================================================

export interface NetworkBannerProps {
  /** Whether to show the offline banner */
  showOffline: boolean;
  /** Whether to show the "back online" banner */
  showOnline: boolean;
  /** Text to display */
  statusText: string;
}

// =============================================================================
// Component
// =============================================================================

export const NetworkBanner: React.FC<NetworkBannerProps> = React.memo(
  ({ showOffline, showOnline, statusText }) => {
    const theme = useTheme();
    const slideAnim = useRef(new Animated.Value(-50)).current;
    const visible = showOffline || showOnline;

    useEffect(() => {
      Animated.timing(slideAnim, {
        toValue: visible ? 0 : -50,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }, [visible, slideAnim]);

    if (!visible && !statusText) return null;

    const backgroundColor = showOffline
      ? theme.dark
        ? "#7A2020"
        : "#FDECEA"
      : theme.dark
        ? "#1B5E20"
        : "#E8F5E9";

    const textColor = showOffline
      ? theme.dark
        ? "#FFCDD2"
        : "#C62828"
      : theme.dark
        ? "#A5D6A7"
        : "#2E7D32";

    const iconName = showOffline ? "wifi-off" : "wifi-check";

    return (
      <Animated.View
        style={[
          styles.container,
          { backgroundColor, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <MaterialCommunityIcons
          name={iconName}
          size={16}
          color={textColor}
          style={styles.icon}
        />
        <Text style={[styles.text, { color: textColor }]}>{statusText}</Text>
      </Animated.View>
    );
  },
);

NetworkBanner.displayName = "NetworkBanner";

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    zIndex: 50,
  },
  icon: {
    marginRight: Spacing.xs,
  },
  text: {
    fontSize: 13,
    fontWeight: "500",
  },
});
