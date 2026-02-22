/**
 * GameLongPressSheet
 *
 * A bottom-sheet modal shown when long-pressing on a game card.
 * Replaces the old GameQuickActionsModal. Shows game icon/name/tagline,
 * a peek preview (personal best + achievements completion), and
 * primary "View more" CTA and optional "Play" CTA.
 *
 * Polish notes:
 * - Light haptic on "View more", medium on "Play"
 * - Peek preview shows personal stats skeleton while loading
 * - Safe area insets for bottom padding
 *
 * @see GameDetailsScreen — navigated to from "View more"
 * @see ModernGameCard, CarouselGameTile, DailyChallengeCard — triggers
 */

import { Skeleton } from "@/components/ui/SkeletonLoader";
import { GAME_SCREEN_MAP } from "@/config/gameCategories";
import useAchievementsV2 from "@/hooks/useAchievementsV2";
import { formatScore, getPersonalBest } from "@/services/games";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import { ExtendedGameType, GAME_METADATA } from "@/types/games";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { memo, useCallback, useEffect, useState } from "react";
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ProgressBar } from "react-native-paper";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// =============================================================================
// Types
// =============================================================================

export interface GameLongPressSheetProps {
  /** Whether the sheet is visible */
  visible: boolean;
  /** The game type being acted upon */
  gameType: ExtendedGameType;
  /** Called when sheet is dismissed */
  onClose: () => void;
  /** Called when "View more" is pressed */
  onViewMore: (gameType: ExtendedGameType) => void;
  /** Called when "Play" is pressed */
  onPlay: (gameType: ExtendedGameType) => void;
}

// =============================================================================
// Peek Preview (memoized)
// =============================================================================

const PeekPreview = memo(function PeekPreview({
  gameType,
  colors,
}: {
  gameType: ExtendedGameType;
  colors: any;
}) {
  const { currentFirebaseUser } = useAuth();
  const userId = currentFirebaseUser?.uid;
  const [personalBest, setPersonalBest] = useState<number | null>(null);
  const [pbLoading, setPbLoading] = useState(true);

  const {
    isV2Active,
    isLoading: achLoading,
    summary,
  } = useAchievementsV2(userId, { gameType });

  useEffect(() => {
    if (!userId) {
      setPbLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const pb = await getPersonalBest(userId, gameType);
        if (!cancelled && pb) setPersonalBest(pb.bestScore);
      } catch {
        // silent
      } finally {
        if (!cancelled) setPbLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, gameType]);

  const hasAnyData =
    personalBest !== null || (isV2Active && summary.totalAvailable > 0);
  const isLoading = pbLoading || achLoading;

  if (isLoading) {
    return (
      <View style={peekStyles.container}>
        <View style={peekStyles.statItem}>
          <Skeleton width={16} height={16} variant="circular" />
          <Skeleton width={60} height={12} variant="text" />
        </View>
        <View style={peekStyles.divider} />
        <View style={peekStyles.statItem}>
          <Skeleton width={16} height={16} variant="circular" />
          <Skeleton width={80} height={12} variant="text" />
        </View>
      </View>
    );
  }

  if (!hasAnyData) return null;

  const completionPct =
    isV2Active && summary.totalAvailable > 0
      ? summary.totalUnlocked / summary.totalAvailable
      : 0;

  return (
    <View style={peekStyles.container}>
      {personalBest !== null && (
        <View style={peekStyles.statItem}>
          <MaterialCommunityIcons
            name="trophy"
            size={16}
            color={colors.primary}
          />
          <Text style={[peekStyles.statLabel, { color: colors.textSecondary }]}>
            Best:{" "}
          </Text>
          <Text style={[peekStyles.statValue, { color: colors.text }]}>
            {formatScore(gameType, personalBest)}
          </Text>
        </View>
      )}
      {personalBest !== null && isV2Active && summary.totalAvailable > 0 && (
        <View style={peekStyles.divider} />
      )}
      {isV2Active && summary.totalAvailable > 0 && (
        <View style={peekStyles.statItem}>
          <MaterialCommunityIcons
            name="medal"
            size={16}
            color={colors.primary}
          />
          <Text style={[peekStyles.statLabel, { color: colors.textSecondary }]}>
            {summary.totalUnlocked}/{summary.totalAvailable}
          </Text>
          <ProgressBar
            progress={completionPct}
            color={colors.primary}
            style={peekStyles.miniBar}
          />
        </View>
      )}
    </View>
  );
});

const peekStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 8,
    flexWrap: "wrap",
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  statValue: {
    fontSize: 12,
    fontWeight: "700",
  },
  divider: {
    width: 1,
    height: 14,
    backgroundColor: "rgba(128,128,128,0.25)",
  },
  miniBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
});

// =============================================================================
// Component
// =============================================================================

function GameLongPressSheetComponent({
  visible,
  gameType,
  onClose,
  onViewMore,
  onPlay,
}: GameLongPressSheetProps) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const metadata = GAME_METADATA[gameType];
  const screenName = GAME_SCREEN_MAP[gameType];

  const translateY = useSharedValue(300);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
      backdropOpacity.value = withTiming(1, { duration: 200 });
    } else {
      translateY.value = withTiming(300, { duration: 200 });
      backdropOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible, translateY, backdropOpacity]);

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const handleViewMore = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onViewMore(gameType);
    onClose();
  }, [gameType, onViewMore, onClose]);

  const handlePlay = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPlay(gameType);
    onClose();
  }, [gameType, onPlay, onClose]);

  const handleBackdropPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  }, [onClose]);

  if (!metadata) return null;

  const tagline = metadata.tagline ?? metadata.description;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.backdrop, animatedBackdropStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleBackdropPress}
          accessibilityLabel="Close sheet"
          accessibilityRole="button"
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheetContainer,
          animatedSheetStyle,
          {
            paddingBottom: Math.max(insets.bottom, 20),
            backgroundColor: colors.surface,
            borderColor: isDark ? colors.border : "transparent",
          },
        ]}
        accessibilityRole="none"
        accessibilityLabel={`${metadata.name} actions sheet`}
      >
        {/* Drag indicator */}
        <View style={styles.dragIndicatorWrapper}>
          <View
            style={[
              styles.dragIndicator,
              { backgroundColor: colors.border || "#ccc" },
            ]}
          />
        </View>

        {/* Game Info Header */}
        <View style={styles.header}>
          <Text style={styles.gameIcon}>{metadata.icon}</Text>
          <View style={styles.headerText}>
            <Text
              style={[styles.gameName, { color: colors.text }]}
              numberOfLines={1}
            >
              {metadata.name}
            </Text>
            <Text
              style={[styles.gameTagline, { color: colors.textSecondary }]}
              numberOfLines={2}
            >
              {tagline}
            </Text>
          </View>
        </View>

        {/* Peek Preview — personal best + achievements completion */}
        {visible && <PeekPreview gameType={gameType} colors={colors} />}

        {/* Actions */}
        <View style={styles.actions}>
          {/* Primary: View more */}
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={handleViewMore}
            activeOpacity={0.8}
            accessibilityLabel={`View more about ${metadata.name}`}
            accessibilityRole="button"
          >
            <MaterialCommunityIcons
              name="information-outline"
              size={20}
              color="#fff"
            />
            <Text style={styles.primaryButtonText}>View more</Text>
          </TouchableOpacity>

          {/* Secondary: Play (only if screen exists) */}
          {screenName && (
            <TouchableOpacity
              style={[
                styles.secondaryButton,
                {
                  backgroundColor:
                    colors.primaryContainer || colors.primary + "20",
                },
              ]}
              onPress={handlePlay}
              activeOpacity={0.8}
              accessibilityLabel={`Play ${metadata.name}`}
              accessibilityRole="button"
            >
              <MaterialCommunityIcons
                name="play"
                size={20}
                color={colors.primary}
              />
              <Text
                style={[styles.secondaryButtonText, { color: colors.primary }]}
              >
                Play
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  sheetContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  dragIndicatorWrapper: {
    alignItems: "center",
    paddingVertical: 8,
  },
  dragIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 14,
  },
  gameIcon: {
    fontSize: 44,
  },
  headerText: {
    flex: 1,
  },
  gameName: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 2,
  },
  gameTagline: {
    fontSize: 14,
    lineHeight: 19,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 8,
    paddingBottom: 8,
  },
  primaryButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    minHeight: 48,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 6,
    minHeight: 48,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
});

export const GameLongPressSheet = memo(GameLongPressSheetComponent);
export default GameLongPressSheet;
