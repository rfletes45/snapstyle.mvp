/**
 * GameStatsScreen — Full game stats breakdown.
 *
 * Shows all game scores in a full-screen view with per-game details.
 * Wraps the existing GameScoresDisplay component in full-screen mode.
 *
 * @module screens/profile/GameStatsScreen
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { IconButton, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GameScoresDisplay } from "@/components/profile/ProfileGameScores";
import { FontSizes, Spacing } from "@/constants/theme";
import { useGameScores } from "@/hooks/useGameScores";
import { useAuth } from "@/store/AuthContext";
import { useColors } from "@/store/ThemeContext";

// =============================================================================
// Types
// =============================================================================

interface GameStatsScreenProps {
  route: any;
  navigation: any;
}

// =============================================================================
// Component
// =============================================================================

export default function GameStatsScreen({
  route,
  navigation,
}: GameStatsScreenProps) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { currentFirebaseUser } = useAuth();

  // Use the userId from route params if viewing another user, else own
  const userId = route.params?.userId || currentFirebaseUser?.uid || "";
  const isOwn = userId === currentFirebaseUser?.uid;

  const { displayScores, allScores, config } = useGameScores({
    userId,
    maxScores: 20,
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <IconButton
          icon="arrow-left"
          onPress={() => navigation.goBack()}
          iconColor={colors.text}
          size={24}
        />
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Game Stats
        </Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {allScores.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="gamepad-variant-outline"
              size={48}
              color={colors.textSecondary}
            />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No game scores yet
            </Text>
          </View>
        ) : (
          <GameScoresDisplay
            scores={allScores}
            enabled={true}
            isOwnProfile={isOwn}
            onGamePress={(gameId) => {
              navigation.navigate("GamesHub");
            }}
            compact={false}
            maxScores={20}
            testID="game-stats-full"
          />
        )}
      </ScrollView>
    </View>
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
    paddingHorizontal: Spacing.xs,
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: "600",
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: FontSizes.md,
  },
});
