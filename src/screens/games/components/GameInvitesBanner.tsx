/**
 * GameInvitesBanner
 *
 * A horizontal scrollable banner displaying game invites.
 *
 * Phase 5: Game Invites Section
 *
 * Features:
 * - Prominent but not intrusive positioning
 * - Horizontal scroll with snap behavior
 * - Badge showing invite count
 * - Collapses gracefully when empty (doesn't render)
 * - Slide-in animations for new invites
 * - Container with subtle background
 *
 * @see docs/PLAY_SCREEN_OVERHAUL_PLAN.md - Phase 5
 */

import { useAppTheme } from "@/store/ThemeContext";
import { UniversalGameInvite } from "@/types/turnBased";
import React, { memo, useCallback } from "react";
import {
  FlatList,
  ListRenderItemInfo,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { PLAY_SCREEN_TOKENS } from "../../../../constants/gamesTheme";
import { CompactInviteCard } from "./CompactInviteCard";

const { spacing, borderRadius, shadows } = PLAY_SCREEN_TOKENS;

// =============================================================================
// Types
// =============================================================================

export interface GameInvitesBannerProps {
  /** List of invites to display */
  invites: UniversalGameInvite[];
  /** Current user's ID */
  currentUserId: string;
  /** Called when join button is pressed on an invite */
  onJoinInvite: (invite: UniversalGameInvite) => Promise<void>;
  /** Called when decline button is pressed on an invite */
  onDeclineInvite: (invite: UniversalGameInvite) => Promise<void>;
  /** Additional container styles */
  style?: ViewStyle;
  /** Test ID for testing */
  testID?: string;
}

// Layout constants
const CARD_WIDTH = 140;
const CARD_GAP = 10;

// =============================================================================
// Component
// =============================================================================

function GameInvitesBannerComponent({
  invites,
  currentUserId,
  onJoinInvite,
  onDeclineInvite,
  style,
  testID,
}: GameInvitesBannerProps) {
  const { colors, isDark } = useAppTheme();

  // Don't render if no invites
  if (!invites || invites.length === 0) {
    return null;
  }

  // Render individual invite card
  const renderInviteCard = useCallback(
    ({ item: invite }: ListRenderItemInfo<UniversalGameInvite>) => {
      return (
        <CompactInviteCard
          invite={invite}
          currentUserId={currentUserId}
          onJoin={() => onJoinInvite(invite)}
          onDecline={() => onDeclineInvite(invite)}
          testID={testID ? `${testID}-card-${invite.id}` : undefined}
        />
      );
    },
    [currentUserId, onJoinInvite, onDeclineInvite, testID],
  );

  // Key extractor
  const keyExtractor = useCallback((item: UniversalGameInvite) => item.id, []);

  // Item separator
  const ItemSeparator = useCallback(
    () => <View style={{ width: CARD_GAP }} />,
    [],
  );

  // Snap offsets for smooth scrolling
  const snapToOffsets = invites.map(
    (_, index) => index * (CARD_WIDTH + CARD_GAP),
  );

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      style={[
        styles.container,
        {
          backgroundColor: isDark
            ? "rgba(255, 255, 255, 0.05)"
            : "rgba(0, 0, 0, 0.03)",
        },
        style,
      ]}
      testID={testID}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.titleEmoji}>📬</Text>
          <Text style={[styles.title, { color: colors.text }]}>
            Game Invites
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: colors.primary }]}>
          <Text style={styles.badgeText}>{invites.length}</Text>
        </View>
      </View>

      {/* Horizontal Carousel */}
      <FlatList
        horizontal
        data={invites}
        renderItem={renderInviteCard}
        keyExtractor={keyExtractor}
        ItemSeparatorComponent={ItemSeparator}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carouselContent}
        snapToOffsets={snapToOffsets}
        snapToAlignment="start"
        decelerationRate="fast"
        testID={testID ? `${testID}-list` : undefined}
      />
    </Animated.View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.horizontalPadding,
    marginBottom: spacing.sectionGap,
    borderRadius: borderRadius.container,
    padding: 12,
    overflow: "hidden",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    height: 32,
  },

  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  titleEmoji: {
    fontSize: 16,
  },

  title: {
    fontSize: 15,
    fontWeight: "600" as const,
  },

  // Badge
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  badgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700" as const,
  },

  // Carousel
  carouselContent: {
    // No horizontal padding - container handles it
  },
});

// =============================================================================
// Export
// =============================================================================

export const GameInvitesBanner = memo(GameInvitesBannerComponent);
export default GameInvitesBanner;
