/**
 * PickerLoadingFallback
 *
 * Lightweight fallback shown inside Suspense while a picker (GIF, Sticker,
 * Emoji, Game) lazily loads for the first time. Renders a small centered
 * spinner at keyboard height so the user sees immediate feedback inside
 * the DraggableBottomSheet rather than an empty surface.
 *
 * This component must remain tiny — it loads synchronously on the chat
 * entry path (as a Suspense fallback reference).
 *
 * @module components/chat/PickerLoadingFallback
 */

import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";

export function PickerLoadingFallback() {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <ActivityIndicator size="small" color={colors.primary} />
    </View>
  );
}

/**
 * Overlay spinner rendered on top of a toolbar button while its picker
 * lazily loads. Uses absolute positioning so it does NOT participate in
 * layout flow — the button slot size stays unchanged and the toolbar
 * does not reflow.
 */
export function ButtonLoadingOverlay() {
  const { colors } = useTheme();
  return (
    <View style={styles.overlay} pointerEvents="none">
      <ActivityIndicator size="small" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 260,
    justifyContent: "center",
    alignItems: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: 20,
  },
});
