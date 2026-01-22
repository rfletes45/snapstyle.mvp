import React from "react";
import { View, StyleSheet } from "react-native";
import { useTheme } from "react-native-paper";
import { EmptyState } from "@/components/ui";

export default function GamesScreen() {
  const theme = useTheme();

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <EmptyState
        icon="gamepad-variant-outline"
        title="Play Coming Soon"
        subtitle="Fun mini-games to enjoy with your connections will be available here in a future update!"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
