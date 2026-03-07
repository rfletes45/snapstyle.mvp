/**
 * Chess UI — Promotion Picker
 *
 * Modern slide-up selection for pawn promotion.
 * Shows 4 piece choices with icons + labels.
 * Haptic tick on selection. If "Confirm Each Move" is ON,
 * promotion selection acts as the confirmation (no double-confirm).
 *
 * @module gamesV4/screens/chess/ChessPromotion
 */

import type { PromotionPiece, Side } from "@/gamesV4/adapters/chess/chessTypes";
import { useAppTheme } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { PIECE_ICONS, PIECE_NAMES } from "./constants";

// =============================================================================
// Props
// =============================================================================

interface ChessPromotionProps {
  visible: boolean;
  side: Side;
  onChoose: (piece: PromotionPiece) => void;
  /** Called when user cancels/dismisses the picker without choosing */
  onCancel?: () => void;
}

// =============================================================================
// Component
// =============================================================================

const PROMOTION_PIECES: PromotionPiece[] = ["q", "r", "b", "n"];

export function ChessPromotion({
  visible,
  side,
  onChoose,
  onCancel,
}: ChessPromotionProps) {
  const { theme } = useAppTheme();
  const isDark = theme.isDark;

  if (!visible) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={onCancel ?? (() => {})}
    >
      <View style={styles.overlay}>
        <Animated.View
          entering={FadeIn.duration(150)}
          style={StyleSheet.absoluteFill}
        >
          <Pressable style={styles.dimBg} onPress={onCancel} />
        </Animated.View>

        <Animated.View
          entering={SlideInDown.duration(250).springify()}
          style={[
            styles.card,
            {
              backgroundColor: isDark ? "#2A2A2A" : "#FFFFFF",
            },
          ]}
        >
          <Text style={[styles.title, { color: isDark ? "#EEE" : "#222" }]}>
            Promote Pawn
          </Text>

          <View style={styles.optionsRow}>
            {PROMOTION_PIECES.map((p) => {
              const pieceKey = `${side}${p.toUpperCase()}`;
              const iconName = PIECE_ICONS[
                pieceKey
              ] as keyof typeof MaterialCommunityIcons.glyphMap;
              const label = PIECE_NAMES[p] ?? p;
              const iconColor =
                side === "w"
                  ? isDark
                    ? "#FFF"
                    : "#222"
                  : isDark
                    ? "#CCC"
                    : "#333";

              return (
                <Pressable
                  key={p}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      backgroundColor: pressed
                        ? isDark
                          ? "rgba(255,255,255,0.15)"
                          : "rgba(0,0,0,0.08)"
                        : isDark
                          ? "rgba(255,255,255,0.06)"
                          : "rgba(0,0,0,0.04)",
                    },
                  ]}
                  onPress={() => onChoose(p)}
                >
                  <MaterialCommunityIcons
                    name={iconName}
                    size={40}
                    color={iconColor}
                  />
                  <Text
                    style={[
                      styles.optionLabel,
                      {
                        color: isDark
                          ? "rgba(255,255,255,0.6)"
                          : "rgba(0,0,0,0.5)",
                      },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  dimBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  card: {
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
    width: 300,
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 18,
  },
  optionsRow: {
    flexDirection: "row",
    gap: 12,
  },
  option: {
    width: 60,
    height: 72,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  optionLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
});
