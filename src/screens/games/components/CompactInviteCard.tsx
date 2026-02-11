/**
 * CompactInviteCard
 *
 * A compact card component for displaying game invites in horizontal carousels.
 *
 * Phase 5: Game Invites Section
 *
 * Features:
 * - Compact 140x100px card design
 * - Game icon and name
 * - Host name display
 * - Join button with loading state
 * - Decline (X) button in corner
 * - Spring press animation
 * - Expiration countdown (optional)
 *
 * @see docs/PLAY_SCREEN_OVERHAUL_PLAN.md - Phase 5
 */

import { ThreeInviteCard } from "@/components/three";
import { useAppTheme } from "@/store/ThemeContext";
import { ExtendedGameType, GAME_METADATA } from "@/types/games";
import { getCategoryColor } from "@/types/playScreen";
import { UniversalGameInvite } from "@/types/turnBased";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { memo, useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import Animated, {
  SlideInRight,
  SlideOutRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { THREE_JS_FEATURES } from "@/constants/featureFlags";
import { PLAY_SCREEN_TOKENS } from "@/constants/gamesTheme";

const { spacing, borderRadius, shadows, animation } = PLAY_SCREEN_TOKENS;

// =============================================================================
// Types
// =============================================================================

export interface CompactInviteCardProps {
  /** The invite to display */
  invite: UniversalGameInvite;
  /** Current user's ID */
  currentUserId: string;
  /** Called when join button is pressed */
  onJoin: () => Promise<void>;
  /** Called when decline button is pressed */
  onDecline: () => Promise<void>;
  /** Additional container styles */
  style?: ViewStyle;
  /** Test ID for testing */
  testID?: string;
}

// Card dimensions per spec
const CARD_WIDTH = 140;
const CARD_HEIGHT = 100;

// =============================================================================
// Component
// =============================================================================

function CompactInviteCardComponent({
  invite,
  currentUserId,
  onJoin,
  onDecline,
  style,
  testID,
}: CompactInviteCardProps) {
  const { colors, isDark } = useAppTheme();
  const scale = useSharedValue(1);
  const [isJoining, setIsJoining] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);

  // Get game metadata
  const metadata = GAME_METADATA[invite.gameType as ExtendedGameType];
  const gameName = metadata?.name || invite.gameType;
  const gameIcon = metadata?.icon || "🎮";

  // Accent color for 3D overlay
  const accentColor = getCategoryColor(
    (metadata?.category ?? "quick_play") as Parameters<
      typeof getCategoryColor
    >[0],
    isDark,
  );

  // Get host info (first slot is always the sender)
  const hostName = invite.senderName || "Unknown";

  // Check if user can join
  const hasJoined = invite.claimedSlots.some(
    (s) => s.playerId === currentUserId,
  );
  const isFull = invite.claimedSlots.length >= invite.requiredPlayers;
  const isExpired = Date.now() > invite.expiresAt;
  const canJoin =
    !hasJoined &&
    !isFull &&
    !isExpired &&
    ["pending", "filling"].includes(invite.status);

  // Animated scale style
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.97, animation.pressSpring);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, animation.pressSpring);
  }, [scale]);

  const handleJoin = useCallback(async () => {
    if (isJoining || !canJoin) return;
    setIsJoining(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await onJoin();
    } finally {
      setIsJoining(false);
    }
  }, [isJoining, canJoin, onJoin]);

  const handleDecline = useCallback(async () => {
    if (isDeclining) return;
    setIsDeclining(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try {
      await onDecline();
    } finally {
      setIsDeclining(false);
    }
  }, [isDeclining, onDecline]);

  return (
    <Animated.View
      entering={SlideInRight.duration(300)}
      exiting={SlideOutRight.duration(200)}
      style={[styles.container, animatedStyle, style]}
      testID={testID}
    >
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: isDark
              ? "rgba(255, 255, 255, 0.1)"
              : "rgba(0, 0, 0, 0.08)",
          },
        ]}
      >
        {/* Three.js 3D animated overlay (behind 2D content) */}
        {THREE_JS_FEATURES.THREE_JS_ENABLED &&
          THREE_JS_FEATURES.INVITE_CARD_3D && (
            <ThreeInviteCard
              accentColor={accentColor}
              isActive={canJoin}
              testID={testID ? `${testID}-three` : undefined}
            />
          )}

        {/* Decline Button */}
        <Pressable
          onPress={handleDecline}
          style={styles.declineButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          disabled={isDeclining}
        >
          {isDeclining ? (
            <ActivityIndicator size={12} color={colors.textMuted} />
          ) : (
            <MaterialCommunityIcons
              name="close"
              size={14}
              color={colors.textMuted}
            />
          )}
        </Pressable>

        {/* Content */}
        <View style={styles.content}>
          {/* Game Icon */}
          <Text style={styles.gameIcon}>{gameIcon}</Text>

          {/* Game Name */}
          <Text
            style={[styles.gameName, { color: colors.text }]}
            numberOfLines={1}
          >
            {gameName}
          </Text>

          {/* Host Name */}
          <Text
            style={[styles.hostName, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            From: {hostName}
          </Text>
        </View>

        {/* Join Button */}
        <Pressable
          onPress={handleJoin}
          disabled={!canJoin || isJoining}
          style={[
            styles.joinButton,
            {
              backgroundColor: canJoin ? colors.primary : colors.surfaceVariant,
            },
          ]}
        >
          {isJoining ? (
            <ActivityIndicator size={14} color="#FFFFFF" />
          ) : (
            <Text
              style={[
                styles.joinButtonText,
                { color: canJoin ? "#FFFFFF" : colors.textMuted },
              ]}
            >
              {hasJoined ? "Joined" : isFull ? "Full" : "Join"}
            </Text>
          )}
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },

  card: {
    flex: 1,
    borderRadius: borderRadius.cardLarge,
    borderWidth: 1,
    padding: 10,
    position: "relative",
    ...shadows.card,
  },

  // Decline button
  declineButton: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0, 0, 0, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },

  // Content
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 4,
  },

  gameIcon: {
    fontSize: 24,
    marginBottom: 4,
  },

  gameName: {
    fontSize: 13,
    fontWeight: "600" as const,
    textAlign: "center",
    marginBottom: 2,
  },

  hostName: {
    fontSize: 11,
    textAlign: "center",
  },

  // Join button
  joinButton: {
    height: 28,
    borderRadius: borderRadius.button,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },

  joinButtonText: {
    fontSize: 12,
    fontWeight: "700" as const,
  },
});

// =============================================================================
// Export
// =============================================================================

export const CompactInviteCard = memo(CompactInviteCardComponent);
export default CompactInviteCard;
