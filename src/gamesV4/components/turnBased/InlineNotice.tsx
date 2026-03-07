/**
 * InlineNotice — Compact contextual notice/helper for board games
 *
 * Shows a small, non-disruptive message below or near the board.
 * Supports info, warning, and error severity levels without being loud.
 * Auto-dismisses if a timeout is provided.
 */

import { Spacing } from "@/constants/theme";
import { useAppTheme } from "@/store/ThemeContext";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, { FadeIn, FadeOut, Layout } from "react-native-reanimated";

export interface InlineNoticeProps {
  /** The message to display */
  message: string;
  /** Severity determines subtle color accent */
  severity?: "info" | "warning" | "error";
  /** Auto-dismiss after ms (0 = persistent) */
  dismissAfterMs?: number;
  /** Callback when dismissed */
  onDismiss?: () => void;
}

export function InlineNotice({
  message,
  severity = "info",
  dismissAfterMs = 0,
  onDismiss,
}: InlineNoticeProps) {
  const { theme } = useAppTheme();
  const isDark = theme.isDark;
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (dismissAfterMs > 0) {
      const timer = setTimeout(() => {
        setVisible(false);
        onDismiss?.();
      }, dismissAfterMs);
      return () => clearTimeout(timer);
    }
  }, [dismissAfterMs, onDismiss]);

  if (!visible) return null;

  const accentMap = {
    info: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.4)",
    warning: isDark ? "#FFB74D" : "#F57C00",
    error: isDark ? "#EF5350" : "#D32F2F",
  };

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      layout={Layout.springify()}
      style={styles.container}
    >
      <Text style={[styles.text, { color: accentMap[severity] }]}>
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    alignItems: "center",
  },
  text: {
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
  },
});
