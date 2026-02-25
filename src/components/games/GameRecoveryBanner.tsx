/**
 * GameRecoveryBanner — Compact banner shown when the user has an
 * interrupted multiplayer game that can be resumed.
 *
 * Renders as a Material surface card with game icon + "Resume your game"
 * text and a prominent Resume button plus a dismiss (×) button.
 *
 * Uses `useGameRecovery` internally so the parent only needs to render:
 *   <GameRecoveryBanner />
 *
 * When there is nothing to recover the component returns `null` (zero UI).
 *
 * @module components/games/GameRecoveryBanner
 */

import { useGameRecovery } from "@/hooks/useGameRecovery";
import { GAME_METADATA, type ExtendedGameType } from "@/types/games";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

export interface GameRecoveryBannerProps {
  /** Optional testID for E2E */
  testID?: string;
}

export function GameRecoveryBanner({ testID }: GameRecoveryBannerProps) {
  const theme = useTheme();
  const { recoverableSession, resumeGame, dismissRecovery, checking } =
    useGameRecovery();

  // Nothing to show — don't hide an existing session while re-checking
  // (avoids banner flicker on foreground transitions)
  if (!recoverableSession) return null;

  const { bookmark } = recoverableSession;
  const meta = GAME_METADATA[bookmark.gameType as ExtendedGameType];
  const gameName = meta?.name ?? bookmark.gameType;
  const gameIcon = meta?.icon ?? "🎮";

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.primaryContainer },
      ]}
      testID={testID}
    >
      <View style={styles.row}>
        <Text style={styles.icon}>{gameIcon}</Text>
        <View style={styles.textCol}>
          <Text
            style={[styles.title, { color: theme.colors.onPrimaryContainer }]}
            numberOfLines={1}
          >
            Resume your {gameName} match
          </Text>
          <Text
            style={[
              styles.subtitle,
              { color: theme.colors.onPrimaryContainer },
            ]}
            numberOfLines={1}
          >
            You have a game in progress
          </Text>
        </View>

        {/* Resume button */}
        <TouchableOpacity
          style={[styles.resumeBtn, { backgroundColor: theme.colors.primary }]}
          onPress={resumeGame}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="play"
            size={18}
            color={theme.colors.onPrimary}
          />
          <Text style={[styles.resumeText, { color: theme.colors.onPrimary }]}>
            Resume
          </Text>
        </TouchableOpacity>

        {/* Dismiss */}
        <TouchableOpacity
          style={styles.dismissBtn}
          onPress={dismissRecovery}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <MaterialCommunityIcons
            name="close"
            size={18}
            color={theme.colors.onPrimaryContainer}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  icon: {
    fontSize: 28,
    marginRight: 10,
  },
  textCol: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 12,
    opacity: 0.75,
    marginTop: 1,
  },
  resumeBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 6,
  },
  resumeText: {
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 4,
  },
  dismissBtn: {
    padding: 4,
  },
});
