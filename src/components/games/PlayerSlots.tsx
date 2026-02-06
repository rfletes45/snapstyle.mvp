/**
 * PlayerSlots - OVERHAULED
 *
 * Visual representation of players in a game queue.
 * Shows filled slots with avatars, empty slots as placeholders.
 * Includes "You" indicator and host badge.
 *
 * @file src/components/games/PlayerSlots.tsx
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import Animated, { FadeIn, Layout } from "react-native-reanimated";

import { ProfilePicture } from "@/components/profile/ProfilePicture";
import type { PlayerSlot } from "@/types/turnBased";
import { BorderRadius, Spacing } from "../../../constants/theme";

// =============================================================================
// Types
// =============================================================================

export interface PlayerSlotsProps {
  /** Players who have claimed slots */
  slots: PlayerSlot[];
  /** Minimum players needed (determines empty slot count) */
  requiredPlayers: number;
  /** Maximum players allowed */
  maxPlayers: number;
  /** Current user's ID (for "You" indicator) */
  currentUserId?: string;
  /** Compact layout mode */
  compact?: boolean;
  /** Show position numbers */
  showPositions?: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Determine if the playerAvatar string is a URL (profile picture)
 * or a JSON avatar config string.
 * Returns the URL if it's a valid picture URL, otherwise null.
 */
function getProfilePictureUrl(playerAvatar?: string): string | null {
  if (!playerAvatar) return null;
  // If it starts with http(s), it's a profile picture URL
  if (
    playerAvatar.startsWith("http://") ||
    playerAvatar.startsWith("https://")
  ) {
    return playerAvatar;
  }
  // Otherwise it's a JSON avatar config — no profile picture URL available
  return null;
}

// =============================================================================
// Sub-Components
// =============================================================================

interface FilledSlotProps {
  slot: PlayerSlot;
  isCurrentUser: boolean;
  size: number;
  compact: boolean;
  position?: number;
}

function FilledSlot({
  slot,
  isCurrentUser,
  size,
  compact,
  position,
}: FilledSlotProps) {
  const theme = useTheme();

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      layout={Layout.springify()}
      style={[
        styles.slot,
        compact && styles.slotCompact,
        isCurrentUser && {
          borderColor: theme.colors.primary,
          borderWidth: 2,
          borderRadius: BorderRadius.md,
        },
      ]}
    >
      {/* Position Number */}
      {position !== undefined && (
        <View
          style={[
            styles.positionBadge,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
        >
          <Text
            style={[
              styles.positionText,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            {position}
          </Text>
        </View>
      )}

      {/* Avatar */}
      <ProfilePicture
        url={getProfilePictureUrl(slot.playerAvatar)}
        name={slot.playerName}
        size={size}
      />

      {/* Name */}
      {!compact && (
        <Text
          style={[styles.playerName, { color: theme.colors.onSurface }]}
          numberOfLines={1}
        >
          {isCurrentUser ? "You" : slot.playerName}
        </Text>
      )}

      {/* Host Badge */}
      {slot.isHost && (
        <View
          style={[styles.hostBadge, { backgroundColor: theme.colors.primary }]}
        >
          <MaterialCommunityIcons name="crown" size={10} color="#fff" />
        </View>
      )}
    </Animated.View>
  );
}

interface EmptySlotProps {
  size: number;
  compact: boolean;
  position?: number;
}

function EmptySlot({ size, compact, position }: EmptySlotProps) {
  const theme = useTheme();

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      layout={Layout.springify()}
      style={[
        styles.slot,
        styles.emptySlot,
        compact && styles.slotCompact,
        { borderColor: theme.colors.outlineVariant },
      ]}
    >
      {position !== undefined && (
        <View
          style={[
            styles.positionBadge,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
        >
          <Text
            style={[
              styles.positionText,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            {position}
          </Text>
        </View>
      )}

      <View
        style={[
          styles.emptyAvatar,
          {
            width: size,
            height: size,
            backgroundColor: theme.colors.surfaceVariant,
          },
        ]}
      >
        <Text
          style={{ color: theme.colors.onSurfaceVariant, fontSize: size * 0.4 }}
        >
          ?
        </Text>
      </View>

      {!compact && (
        <Text
          style={[styles.waitingText, { color: theme.colors.onSurfaceVariant }]}
        >
          Waiting...
        </Text>
      )}
    </Animated.View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function PlayerSlots({
  slots,
  requiredPlayers,
  maxPlayers,
  currentUserId,
  compact = false,
  showPositions = false,
}: PlayerSlotsProps) {
  const size = compact ? 32 : 44;
  const emptySlotCount = Math.max(0, requiredPlayers - slots.length);

  // Create array of slot items (filled + empty)
  const slotItems = useMemo(() => {
    const items: Array<
      { type: "filled"; slot: PlayerSlot } | { type: "empty" }
    > = [];

    // Add filled slots
    slots.forEach((slot) => {
      items.push({ type: "filled", slot });
    });

    // Add empty slots
    for (let i = 0; i < emptySlotCount; i++) {
      items.push({ type: "empty" });
    }

    return items;
  }, [slots, emptySlotCount]);

  return (
    <View style={styles.container}>
      {slotItems.map((item, index) => {
        const position = showPositions ? index + 1 : undefined;

        if (item.type === "filled") {
          return (
            <FilledSlot
              key={item.slot.playerId}
              slot={item.slot}
              isCurrentUser={item.slot.playerId === currentUserId}
              size={size}
              compact={compact}
              position={position}
            />
          );
        }

        return (
          <EmptySlot
            key={`empty-${index}`}
            size={size}
            compact={compact}
            position={position}
          />
        );
      })}
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  slot: {
    alignItems: "center",
    padding: Spacing.xs,
    borderRadius: BorderRadius.md,
    minWidth: 60,
    position: "relative",
  },
  slotCompact: {
    minWidth: 40,
    padding: 2,
  },
  emptySlot: {
    borderStyle: "dashed",
    borderWidth: 1,
  },
  emptyAvatar: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  playerName: {
    fontSize: 11,
    marginTop: 4,
    maxWidth: 60,
    textAlign: "center",
  },
  waitingText: {
    fontSize: 10,
    marginTop: 4,
    fontStyle: "italic",
  },
  hostBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    borderRadius: 10,
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  positionBadge: {
    position: "absolute",
    top: -4,
    left: -4,
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  positionText: {
    fontSize: 9,
    fontWeight: "bold",
  },
});

export default PlayerSlots;
