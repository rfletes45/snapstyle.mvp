/**
 * GameQuickActionsModal
 *
 * A modal popup shown when long-pressing on a game card.
 * Shows quick actions: Leaderboard and Achievements for that game.
 *
 * @see ModernGameCard - triggers this modal via onLongPress
 */

import { useAppTheme } from "@/store/ThemeContext";
import { ExtendedGameType, GAME_METADATA } from "@/types/games";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { memo, useCallback, useEffect } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// =============================================================================
// Types
// =============================================================================

export interface GameQuickActionsModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** The game type being acted upon */
  gameType: ExtendedGameType;
  /** Called when modal is dismissed */
  onClose: () => void;
  /** Called when leaderboard is selected */
  onLeaderboard: (gameType: ExtendedGameType) => void;
  /** Called when achievements is selected */
  onAchievements: (gameType: ExtendedGameType) => void;
}

// =============================================================================
// Component
// =============================================================================

function GameQuickActionsModalComponent({
  visible,
  gameType,
  onClose,
  onLeaderboard,
  onAchievements,
}: GameQuickActionsModalProps) {
  const { colors, isDark } = useAppTheme();
  const metadata = GAME_METADATA[gameType];

  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 15, stiffness: 300 });
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      scale.value = withTiming(0.8, { duration: 150 });
      opacity.value = withTiming(0, { duration: 150 });
    }
  }, [visible, scale, opacity]);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handleLeaderboard = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLeaderboard(gameType);
    onClose();
  }, [gameType, onLeaderboard, onClose]);

  const handleAchievements = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAchievements(gameType);
    onClose();
  }, [gameType, onAchievements, onClose]);

  const handleBackdropPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  }, [onClose]);

  if (!metadata) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={handleBackdropPress}>
        <Animated.View
          style={[
            styles.container,
            animatedContainerStyle,
            {
              backgroundColor: colors.surface,
              borderColor: isDark ? colors.border : "transparent",
            },
          ]}
        >
          {/* Game Info Header */}
          <View style={styles.header}>
            <Text style={styles.gameIcon}>{metadata.icon}</Text>
            <Text style={[styles.gameName, { color: colors.text }]}>
              {metadata.name}
            </Text>
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                {
                  backgroundColor:
                    colors.primaryContainer || colors.primary + "20",
                },
              ]}
              onPress={handleLeaderboard}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="trophy"
                size={24}
                color={colors.primary}
              />
              <Text style={[styles.actionText, { color: colors.primary }]}>
                Leaderboard
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                {
                  backgroundColor:
                    colors.secondaryContainer || colors.secondary + "20",
                },
              ]}
              onPress={handleAchievements}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="medal"
                size={24}
                color={colors.secondary}
              />
              <Text style={[styles.actionText, { color: colors.secondary }]}>
                Achievements
              </Text>
            </TouchableOpacity>
          </View>

          {/* Cancel hint */}
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Tap outside to close
          </Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    width: Math.min(SCREEN_WIDTH - 48, 320),
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  header: {
    alignItems: "center",
    marginBottom: 16,
  },
  gameIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  gameName: {
    fontSize: 18,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    marginHorizontal: -20,
    marginBottom: 16,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 8,
  },
  actionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  hint: {
    fontSize: 12,
    textAlign: "center",
    fontStyle: "italic",
  },
});

export const GameQuickActionsModal = memo(GameQuickActionsModalComponent);
export default GameQuickActionsModal;
