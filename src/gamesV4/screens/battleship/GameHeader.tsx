/**
 * Battleship — Game Header + Phase Chip
 *
 * Consistent top header for all Battleship screens:
 * - Respects safe area insets (Dynamic Island / Android cutout)
 * - Left: Back chevron
 * - Center: Title + phase chip ("Deploy" / "Battle" / "Spectate")
 * - Right: Options button
 *
 * If the game uses full-bleed background the header overlays transparently;
 * otherwise it uses a translucent backdrop.
 *
 * @module gamesV4/screens/battleship/GameHeader
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BattleshipTokens } from "./battleshipTheme";
import { BS } from "./battleshipTheme";

// =============================================================================
// Phase Chip
// =============================================================================

export type BattlePhaseId = "setup" | "battle" | "spectate" | "resolved";

const PHASE_META: Record<BattlePhaseId, { label: string; icon: string }> = {
  setup: { label: "Deploy", icon: "anchor" },
  battle: { label: "Battle", icon: "crosshairs-gps" },
  spectate: { label: "Spectate", icon: "eye-outline" },
  resolved: { label: "Game Over", icon: "flag-checkered" },
};

interface PhaseChipProps {
  phase: BattlePhaseId;
  tokens: BattleshipTokens;
}

export function PhaseChip({ phase, tokens }: PhaseChipProps) {
  const meta = PHASE_META[phase] ?? PHASE_META.battle;
  const chipBg =
    phase === "battle"
      ? tokens.markerHit + "25"
      : phase === "setup"
        ? tokens.statusInfo + "25"
        : phase === "resolved"
          ? tokens.statusWarning + "25"
          : tokens.textMuted + "20";

  const chipText =
    phase === "battle"
      ? tokens.markerHit
      : phase === "setup"
        ? tokens.statusInfo
        : phase === "resolved"
          ? tokens.statusWarning
          : tokens.textSecondary;

  return (
    <View style={[styles.chip, { backgroundColor: chipBg }]}>
      <MaterialCommunityIcons
        name={meta.icon as any}
        size={12}
        color={chipText}
      />
      <Text style={[styles.chipText, { color: chipText }]}>{meta.label}</Text>
    </View>
  );
}

// =============================================================================
// GameHeader
// =============================================================================

export interface GameHeaderProps {
  phase: BattlePhaseId;
  tokens: BattleshipTokens;
  title?: string;
  onBack?: () => void;
  onOptions?: () => void;
}

export function GameHeader({
  phase,
  tokens,
  title = "Battleship",
  onBack,
  onOptions,
}: GameHeaderProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top + BS.spacing.xs,
          backgroundColor: tokens.headerBg,
          borderBottomColor: tokens.divider,
        },
      ]}
    >
      {/* Left: Back */}
      <TouchableOpacity
        style={styles.headerBtn}
        onPress={handleBack}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityLabel="Go back"
        accessibilityRole="button"
      >
        <MaterialCommunityIcons
          name="chevron-left"
          size={28}
          color={tokens.headerText}
        />
      </TouchableOpacity>

      {/* Center: Title + Phase Chip */}
      <View style={styles.headerCenter}>
        <Text
          style={[styles.headerTitle, { color: tokens.headerText }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <PhaseChip phase={phase} tokens={tokens} />
      </View>

      {/* Right: Options */}
      <TouchableOpacity
        style={styles.headerBtn}
        onPress={onOptions}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityLabel="Game options"
        accessibilityRole="button"
      >
        <MaterialCommunityIcons
          name="dots-vertical"
          size={24}
          color={tokens.headerText}
        />
      </TouchableOpacity>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: BS.spacing.sm,
    paddingHorizontal: BS.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
  },
  headerBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    gap: BS.spacing.xs,
  },
  headerTitle: {
    fontSize: BS.fonts.lg,
    fontWeight: BS.fontWeights.bold,
    ...Platform.select({
      ios: { fontFamily: "System" },
      android: { fontFamily: "Roboto" },
    }),
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: BS.spacing.sm,
    paddingVertical: 3,
    borderRadius: BS.radius.full,
  },
  chipText: {
    fontSize: BS.fonts.xs,
    fontWeight: BS.fontWeights.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
