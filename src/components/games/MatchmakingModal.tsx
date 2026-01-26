/**
 * MatchmakingModal Component
 *
 * Animated modal for finding opponents in multiplayer games.
 * Shows searching animation, match found transition, and countdown.
 *
 * @see constants/gamesTheme.ts for color tokens
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect } from "react";
import { Modal, StyleSheet, View, useColorScheme } from "react-native";
import { Avatar, Button, Portal, Text, useTheme } from "react-native-paper";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { ExtendedGameType, GAME_METADATA } from "@/types/games";
import {
  GAME_ANIMATIONS,
  GAME_BORDER_RADIUS,
  GAME_SHADOWS,
  GAME_SPACING,
  GAME_TYPOGRAPHY,
  getCategoryColor,
} from "../../../constants/gamesTheme";

// =============================================================================
// Types
// =============================================================================

export type MatchmakingStatus =
  | "searching"
  | "found"
  | "countdown"
  | "starting"
  | "error";

export interface OpponentInfo {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  rating?: number;
}

export interface MatchmakingModalProps {
  /** Whether modal is visible */
  visible: boolean;
  /** Current matchmaking status */
  status: MatchmakingStatus;
  /** Game type being matched */
  gameType: ExtendedGameType;
  /** User's rating for display */
  userRating?: number;
  /** Estimated wait time in seconds */
  estimatedWait?: number;
  /** Opponent info (when found) */
  opponent?: OpponentInfo;
  /** Countdown seconds (when counting down) */
  countdown?: number;
  /** Error message */
  errorMessage?: string;
  /** Called when cancel is pressed */
  onCancel: () => void;
  /** Called when retry is pressed (after error) */
  onRetry?: () => void;
}

// =============================================================================
// Searching Animation
// =============================================================================

function SearchingAnimation() {
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === "dark";
  const accentColor = getCategoryColor("multiplayer", isDarkMode);

  // Rotating dots animation
  const rotation = useSharedValue(0);
  const scale1 = useSharedValue(1);
  const scale2 = useSharedValue(0.8);
  const scale3 = useSharedValue(0.6);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 3000, easing: Easing.linear }),
      -1,
      false,
    );

    scale1.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 500 }),
        withTiming(1, { duration: 500 }),
      ),
      -1,
      true,
    );

    scale2.value = withDelay(
      200,
      withRepeat(
        withSequence(
          withTiming(1.2, { duration: 500 }),
          withTiming(0.8, { duration: 500 }),
        ),
        -1,
        true,
      ),
    );

    scale3.value = withDelay(
      400,
      withRepeat(
        withSequence(
          withTiming(1.2, { duration: 500 }),
          withTiming(0.6, { duration: 500 }),
        ),
        -1,
        true,
      ),
    );
  }, [rotation, scale1, scale2, scale3]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const dot1Style = useAnimatedStyle(() => ({
    transform: [{ scale: scale1.value }],
  }));

  const dot2Style = useAnimatedStyle(() => ({
    transform: [{ scale: scale2.value }],
  }));

  const dot3Style = useAnimatedStyle(() => ({
    transform: [{ scale: scale3.value }],
  }));

  return (
    <View style={styles.searchingContainer}>
      <Animated.View style={[styles.dotsContainer, containerStyle]}>
        <Animated.View
          style={[
            styles.dot,
            { backgroundColor: accentColor, top: 0, left: "50%" },
            dot1Style,
          ]}
        />
        <Animated.View
          style={[
            styles.dot,
            {
              backgroundColor: accentColor,
              bottom: 15,
              left: 15,
              opacity: 0.7,
            },
            dot2Style,
          ]}
        />
        <Animated.View
          style={[
            styles.dot,
            {
              backgroundColor: accentColor,
              bottom: 15,
              right: 15,
              opacity: 0.5,
            },
            dot3Style,
          ]}
        />
      </Animated.View>

      <MaterialCommunityIcons
        name="magnify"
        size={40}
        color={theme.colors.onSurfaceVariant}
        style={styles.searchIcon}
      />
    </View>
  );
}

// =============================================================================
// Match Found Animation
// =============================================================================

function MatchFoundAnimation({
  userRating,
  opponent,
}: {
  userRating?: number;
  opponent: OpponentInfo;
}) {
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === "dark";
  const accentColor = getCategoryColor("multiplayer", isDarkMode);

  // Animation values
  const vsScale = useSharedValue(0);
  const leftSlide = useSharedValue(-100);
  const rightSlide = useSharedValue(100);

  useEffect(() => {
    leftSlide.value = withSpring(0, GAME_ANIMATIONS.spring.snappy);
    rightSlide.value = withDelay(
      100,
      withSpring(0, GAME_ANIMATIONS.spring.snappy),
    );
    vsScale.value = withDelay(
      200,
      withSpring(1, GAME_ANIMATIONS.spring.bouncy),
    );
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [leftSlide, rightSlide, vsScale]);

  const leftStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: leftSlide.value }],
  }));

  const rightStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: rightSlide.value }],
  }));

  const vsStyle = useAnimatedStyle(() => ({
    transform: [{ scale: vsScale.value }],
  }));

  return (
    <View style={styles.matchFoundContainer}>
      {/* You */}
      <Animated.View style={[styles.playerColumn, leftStyle]}>
        <Avatar.Icon size={64} icon="account" />
        <Text style={[styles.playerName, { color: theme.colors.onSurface }]}>
          You
        </Text>
        {userRating && (
          <Text
            style={[
              styles.playerRating,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            {userRating}
          </Text>
        )}
      </Animated.View>

      {/* VS Badge */}
      <Animated.View
        style={[styles.vsBadge, { backgroundColor: accentColor }, vsStyle]}
      >
        <Text style={styles.vsText}>VS</Text>
      </Animated.View>

      {/* Opponent */}
      <Animated.View style={[styles.playerColumn, rightStyle]}>
        {opponent.avatarUrl ? (
          <Avatar.Image size={64} source={{ uri: opponent.avatarUrl }} />
        ) : (
          <Avatar.Text
            size={64}
            label={opponent.displayName.slice(0, 2).toUpperCase()}
          />
        )}
        <Text
          style={[styles.playerName, { color: theme.colors.onSurface }]}
          numberOfLines={1}
        >
          {opponent.displayName}
        </Text>
        {opponent.rating && (
          <Text
            style={[
              styles.playerRating,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            {opponent.rating}
          </Text>
        )}
      </Animated.View>
    </View>
  );
}

// =============================================================================
// Countdown Animation
// =============================================================================

function CountdownAnimation({ count }: { count: number }) {
  const theme = useTheme();
  const scale = useSharedValue(1.5);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = 1.5;
    opacity.value = 0;
    scale.value = withSpring(1, GAME_ANIMATIONS.spring.snappy);
    opacity.value = withTiming(1, { duration: 200 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [count, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.countdownContainer, animatedStyle]}>
      <Text style={[styles.countdownNumber, { color: theme.colors.primary }]}>
        {count === 0 ? "GO!" : count}
      </Text>
    </Animated.View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function MatchmakingModal({
  visible,
  status,
  gameType,
  userRating,
  estimatedWait,
  opponent,
  countdown,
  errorMessage,
  onCancel,
  onRetry,
}: MatchmakingModalProps) {
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === "dark";

  const metadata = GAME_METADATA[gameType];
  const accentColor = getCategoryColor("multiplayer", isDarkMode);

  return (
    <Portal>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={status === "searching" ? onCancel : undefined}
      >
        <View style={styles.overlay}>
          <Animated.View
            entering={ZoomIn.springify().damping(15)}
            style={[
              styles.modal,
              { backgroundColor: theme.colors.surface },
              GAME_SHADOWS.lg,
            ]}
          >
            {/* Game Info Header */}
            <View
              style={[
                styles.header,
                { borderBottomColor: theme.colors.outlineVariant },
              ]}
            >
              <Text style={styles.gameIcon}>{metadata?.icon || "🎮"}</Text>
              <Text
                style={[styles.gameName, { color: theme.colors.onSurface }]}
              >
                {metadata?.name || gameType}
              </Text>
            </View>

            {/* Content */}
            <View style={styles.content}>
              {/* Searching State */}
              {status === "searching" && (
                <Animated.View entering={FadeIn} exiting={FadeOut}>
                  <SearchingAnimation />
                  <Text
                    style={[
                      styles.statusText,
                      { color: theme.colors.onSurface },
                    ]}
                  >
                    Finding opponent...
                  </Text>
                  {userRating && (
                    <Text
                      style={[
                        styles.ratingText,
                        { color: theme.colors.onSurfaceVariant },
                      ]}
                    >
                      Your rating: {userRating}
                    </Text>
                  )}
                  {estimatedWait && (
                    <Text
                      style={[
                        styles.waitText,
                        { color: theme.colors.onSurfaceVariant },
                      ]}
                    >
                      Estimated wait: ~{estimatedWait}s
                    </Text>
                  )}
                </Animated.View>
              )}

              {/* Match Found State */}
              {(status === "found" || status === "countdown") && opponent && (
                <Animated.View entering={FadeIn}>
                  <Text style={[styles.foundText, { color: accentColor }]}>
                    MATCH FOUND! 🎉
                  </Text>
                  <MatchFoundAnimation
                    userRating={userRating}
                    opponent={opponent}
                  />
                </Animated.View>
              )}

              {/* Countdown State */}
              {status === "countdown" && countdown !== undefined && (
                <CountdownAnimation count={countdown} />
              )}

              {/* Starting State */}
              {status === "starting" && (
                <Animated.View
                  entering={FadeIn}
                  style={styles.startingContainer}
                >
                  <MaterialCommunityIcons
                    name="loading"
                    size={48}
                    color={theme.colors.primary}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      { color: theme.colors.onSurface },
                    ]}
                  >
                    Starting game...
                  </Text>
                </Animated.View>
              )}

              {/* Error State */}
              {status === "error" && (
                <Animated.View entering={FadeIn} style={styles.errorContainer}>
                  <MaterialCommunityIcons
                    name="alert-circle"
                    size={48}
                    color={theme.colors.error}
                  />
                  <Text
                    style={[styles.errorText, { color: theme.colors.error }]}
                  >
                    {errorMessage || "Failed to find a match"}
                  </Text>
                </Animated.View>
              )}
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              {status === "searching" && (
                <Button
                  mode="outlined"
                  onPress={onCancel}
                  style={styles.cancelButton}
                >
                  Cancel
                </Button>
              )}

              {status === "error" && (
                <View style={styles.errorActions}>
                  {onRetry && (
                    <Button
                      mode="contained"
                      onPress={onRetry}
                      style={styles.retryButton}
                    >
                      Try Again
                    </Button>
                  )}
                  <Button
                    mode="outlined"
                    onPress={onCancel}
                    style={styles.cancelButton}
                  >
                    Cancel
                  </Button>
                </View>
              )}
            </View>
          </Animated.View>
        </View>
      </Modal>
    </Portal>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: GAME_SPACING.lg,
  },
  modal: {
    width: "100%",
    maxWidth: 340,
    borderRadius: GAME_BORDER_RADIUS.xl,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: GAME_SPACING.md,
    borderBottomWidth: 1,
    gap: GAME_SPACING.sm,
  },
  gameIcon: {
    fontSize: 24,
  },
  gameName: {
    fontSize: 18,
    fontWeight: "600",
  },
  content: {
    padding: GAME_SPACING.lg,
    alignItems: "center",
    minHeight: 200,
    justifyContent: "center",
  },
  statusText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: GAME_SPACING.lg,
    textAlign: "center",
  },
  ratingText: {
    fontSize: 14,
    marginTop: GAME_SPACING.sm,
  },
  waitText: {
    fontSize: 12,
    marginTop: GAME_SPACING.xs,
  },

  // Searching animation
  searchingContainer: {
    width: 100,
    height: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  dotsContainer: {
    width: 80,
    height: 80,
    position: "relative",
  },
  dot: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: -6,
  },
  searchIcon: {
    position: "absolute",
  },

  // Match found
  foundText: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: GAME_SPACING.lg,
  },
  matchFoundContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: GAME_SPACING.lg,
  },
  playerColumn: {
    alignItems: "center",
    width: 100,
  },
  playerName: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: GAME_SPACING.sm,
    textAlign: "center",
  },
  playerRating: {
    fontSize: 12,
    marginTop: 2,
  },
  vsBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  vsText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  // Countdown
  countdownContainer: {
    marginTop: GAME_SPACING.lg,
  },
  countdownNumber: {
    ...GAME_TYPOGRAPHY.countdown,
    textAlign: "center",
  },

  // Starting
  startingContainer: {
    alignItems: "center",
  },

  // Error
  errorContainer: {
    alignItems: "center",
  },
  errorText: {
    fontSize: 14,
    marginTop: GAME_SPACING.md,
    textAlign: "center",
  },

  // Actions
  actions: {
    padding: GAME_SPACING.lg,
    paddingTop: 0,
  },
  cancelButton: {
    marginTop: GAME_SPACING.sm,
  },
  errorActions: {
    gap: GAME_SPACING.sm,
  },
  retryButton: {},
});

export default MatchmakingModal;
