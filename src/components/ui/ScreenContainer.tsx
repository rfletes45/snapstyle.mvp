/**
 * ScreenContainer
 * Consistent screen scaffolding with safe area and themed background
 */

import React, { ReactNode } from "react";
import {
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "react-native-paper";

interface ScreenContainerProps {
  children: ReactNode;
  /** Use ScrollView instead of View */
  scrollable?: boolean;
  /** Enable pull-to-refresh (only for scrollable) */
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Additional style for the container */
  style?: StyleProp<ViewStyle>;
  /** Content container style (for ScrollView) */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Respect safe areas (default: false, header usually handles top) */
  safeTop?: boolean;
  safeBottom?: boolean;
  /** Padding preset */
  padding?: "none" | "horizontal" | "all";
}

export default function ScreenContainer({
  children,
  scrollable = false,
  refreshing = false,
  onRefresh,
  style,
  contentContainerStyle,
  safeTop = false,
  safeBottom = false,
  padding = "none",
}: ScreenContainerProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: safeTop ? insets.top : 0,
    paddingBottom: safeBottom ? insets.bottom : 0,
    ...(padding === "horizontal" && styles.paddingHorizontal),
    ...(padding === "all" && styles.paddingAll),
  };

  if (scrollable) {
    return (
      <ScrollView
        style={[containerStyle, style]}
        contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          ) : undefined
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );
  }

  return <View style={[containerStyle, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  paddingHorizontal: {
    paddingHorizontal: 16,
  },
  paddingAll: {
    padding: 16,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
