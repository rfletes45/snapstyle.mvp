/**
 * GameScreenShell — Shared wrapper for all game screens.
 *
 * Provides:
 *   - SafeAreaView with consistent insets
 *   - Themed or custom background color
 *   - StatusBar management
 *   - Optional standardized header (back + title + actions)
 *   - Error boundary integration
 *
 * Usage:
 *   <GameScreenShell title="Chess" onBack={() => navigation.goBack()}>
 *     {/* game content *\/}
 *   </GameScreenShell>
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import {
  Platform,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

// =============================================================================
// Types
// =============================================================================

interface GameScreenShellProps {
  children: React.ReactNode;

  /** Override the background color (defaults to theme background) */
  backgroundColor?: string;

  /** Game title displayed in the header. Omit to hide the default header. */
  title?: string;

  /** Called when the back/close button is pressed */
  onBack?: () => void;

  /** Optional right-side action element in the header */
  headerRight?: React.ReactNode;

  /** Whether to hide the StatusBar entirely (default: false) */
  hideStatusBar?: boolean;

  /** StatusBar bar style override */
  statusBarStyle?: "light-content" | "dark-content";

  /** Disable SafeAreaView and use a plain View (for Skia/GL contexts) */
  noSafeArea?: boolean;

  /** Additional styles for the container */
  style?: object;

  /** Additional styles for the content area below the header */
  contentStyle?: object;

  /** Whether to pad the content area (default: false — game content is edge-to-edge) */
  padContent?: boolean;
}

// =============================================================================
// Component
// =============================================================================

export function GameScreenShell({
  children,
  backgroundColor,
  title,
  onBack,
  headerRight,
  hideStatusBar = false,
  statusBarStyle = "light-content",
  noSafeArea = false,
  style,
  contentStyle,
  padContent = false,
}: GameScreenShellProps) {
  const theme = useTheme();
  const bg = backgroundColor ?? theme.colors.background;

  const Wrapper = noSafeArea ? View : SafeAreaView;

  return (
    <Wrapper style={[styles.container, { backgroundColor: bg }, style]}>
      <StatusBar
        hidden={hideStatusBar}
        barStyle={statusBarStyle}
        backgroundColor="transparent"
        translucent={Platform.OS === "android"}
      />

      {/* Header */}
      {(title || onBack || headerRight) && (
        <View style={styles.header}>
          {onBack ? (
            <TouchableOpacity
              onPress={onBack}
              style={styles.backButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Go back"
              accessibilityRole="button"
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={24}
                color={theme.colors.onBackground}
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerSpacer} />
          )}

          {title ? (
            <Text
              style={[styles.title, { color: theme.colors.onBackground }]}
              numberOfLines={1}
            >
              {title}
            </Text>
          ) : (
            <View style={styles.headerSpacer} />
          )}

          {headerRight ? (
            <View style={styles.headerRightSlot}>{headerRight}</View>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>
      )}

      {/* Content */}
      <View
        style={[
          styles.content,
          padContent && styles.contentPadded,
          contentStyle,
        ]}
      >
        {children}
      </View>
    </Wrapper>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 48,
    paddingHorizontal: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
  },
  headerSpacer: {
    width: 40,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    flex: 1,
  },
  headerRightSlot: {
    width: 40,
    alignItems: "center",
  },
  content: {
    flex: 1,
  },
  contentPadded: {
    paddingHorizontal: 16,
  },
});

export default GameScreenShell;
