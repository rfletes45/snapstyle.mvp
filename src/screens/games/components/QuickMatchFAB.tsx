/**
 * QuickMatchFAB Component
 *
 * Floating action button for instant multiplayer matching.
 * Shows a modal to select game type and initiates matchmaking.
 *
 * Layout (per Phase 7 plan):
 *                                                     ┌───────┐
 *                                                     │  ⚡   │
 *                                                     │ QUICK │
 *                                                     │ MATCH │
 *                                                     └───────┘
 *
 * Visual Specs:
 * - Position: Bottom right, above tab bar
 * - Size: 60x60px circular
 * - Shows modal to select game type
 * - Initiates matchmaking
 *
 * @see docs/PLAY_SCREEN_OVERHAUL_PLAN.md - Phase 7
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "@/store/ThemeContext";
import { ExtendedGameType, GAME_METADATA } from "@/types/games";
import { TurnBasedGameType } from "@/types/turnBased";
import { PLAY_SCREEN_TOKENS } from "../../../../constants/gamesTheme";

// =============================================================================
// Types
// =============================================================================

export interface QuickMatchFABProps {
  /** Called when a game type is selected for quick match */
  onQuickMatch: (gameType: TurnBasedGameType) => void;
  /** Optional test ID for testing */
  testID?: string;
}

// =============================================================================
// Constants
// =============================================================================

/** Multiplayer games available for quick match */
const QUICK_MATCH_GAMES: TurnBasedGameType[] = [
  "tic_tac_toe",
  "checkers",
  "chess",
  "crazy_eights",
];

// =============================================================================
// GameOption Component
// =============================================================================

interface GameOptionProps {
  gameType: TurnBasedGameType;
  onPress: () => void;
  index: number;
}

function GameOption({ gameType, onPress, index }: GameOptionProps) {
  const { colors, isDark } = useAppTheme();
  const metadata = GAME_METADATA[gameType as ExtendedGameType];
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  }, [onPress]);

  if (!metadata) return null;

  return (
    <Animated.View
      entering={SlideInDown.delay(index * 50).springify()}
      style={animatedStyle}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.gameOption,
          {
            backgroundColor: colors.surface,
            borderColor: isDark ? colors.border : "transparent",
          },
        ]}
      >
        <Text style={styles.gameIcon}>{metadata.icon}</Text>
        <Text style={[styles.gameName, { color: colors.text }]}>
          {metadata.name}
        </Text>
        <MaterialCommunityIcons name="flash" size={20} color={colors.primary} />
      </Pressable>
    </Animated.View>
  );
}

// =============================================================================
// QuickMatchFAB Component
// =============================================================================

export function QuickMatchFAB({ onQuickMatch, testID }: QuickMatchFABProps) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [modalVisible, setModalVisible] = useState(false);
  const scale = useSharedValue(1);

  // Animation style for FAB
  const fabAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Press handlers
  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.9, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handleFABPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setModalVisible(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
  }, []);

  const handleSelectGame = useCallback(
    (gameType: TurnBasedGameType) => {
      setModalVisible(false);
      // Small delay for modal animation
      setTimeout(() => {
        onQuickMatch(gameType);
      }, 200);
    },
    [onQuickMatch],
  );

  return (
    <>
      {/* FAB Button */}
      <Animated.View
        style={[
          styles.fabContainer,
          fabAnimatedStyle,
          {
            // Position equidistant from tab bar and right edge (FAB_MARGIN = 20)
            bottom: insets.bottom + 60 + FAB_MARGIN, // 60 is tab bar height, FAB_MARGIN for spacing
          },
        ]}
        testID={testID}
      >
        <Pressable
          onPress={handleFABPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={[
            styles.fab,
            {
              backgroundColor: colors.primary,
              ...PLAY_SCREEN_TOKENS.shadows.floating,
            },
          ]}
        >
          <MaterialCommunityIcons name="flash" size={28} color="#FFFFFF" />
        </Pressable>
        <Text style={[styles.fabLabel, { color: colors.primary }]}>
          Quick Match
        </Text>
      </Animated.View>

      {/* Game Selection Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="none"
        onRequestClose={handleCloseModal}
      >
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.modalBackdrop} onPress={handleCloseModal} />

          <Animated.View
            entering={SlideInDown.springify().damping(18)}
            exiting={SlideOutDown.duration(200)}
            style={[
              styles.modalContent,
              {
                backgroundColor: colors.background,
                paddingBottom: insets.bottom + 16,
              },
            ]}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                ⚡ Quick Match
              </Text>
              <Text
                style={[styles.modalSubtitle, { color: colors.textSecondary }]}
              >
                Select a game to find an opponent
              </Text>
            </View>

            {/* Game Options */}
            <View style={styles.gameOptions}>
              {QUICK_MATCH_GAMES.map((gameType, index) => (
                <GameOption
                  key={gameType}
                  gameType={gameType}
                  onPress={() => handleSelectGame(gameType)}
                  index={index}
                />
              ))}
            </View>

            {/* Cancel Button */}
            <TouchableOpacity
              onPress={handleCloseModal}
              style={[
                styles.cancelButton,
                { backgroundColor: colors.surfaceVariant },
              ]}
            >
              <Text style={[styles.cancelText, { color: colors.text }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  );
}

// =============================================================================
// Styles
// =============================================================================

const FAB_MARGIN = 20; // Equidistant margin from edges

const styles = StyleSheet.create({
  fabContainer: {
    position: "absolute",
    right: FAB_MARGIN,
    alignItems: "center",
    zIndex: 100,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  fabLabel: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0E0E0",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  modalSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  gameOptions: {
    gap: 12,
    marginBottom: 16,
  },
  gameOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: PLAY_SCREEN_TOKENS.borderRadius.cardLarge,
    borderWidth: 1,
    ...PLAY_SCREEN_TOKENS.shadows.card,
  },
  gameIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  gameName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButton: {
    padding: 16,
    borderRadius: PLAY_SCREEN_TOKENS.borderRadius.cardLarge,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
