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

const styles = StyleSheet.create({
  container: {
    height: 260,
    justifyContent: "center",
    alignItems: "center",
  },
});
