/**
 * PlayerSlots Component
 *
 * Displays visual slots for a multi-player game invite.
 * Shows filled slots with avatars and empty slots with placeholder.
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import Avatar from "@/components/Avatar";
import type { AvatarConfig } from "@/types/models";
import type { PlayerSlot } from "@/types/turnBased";
import { BorderRadius, Spacing } from "../../../constants/theme";

// =============================================================================
// Types
// =============================================================================

export interface PlayerSlotsProps {
  /** Array of players who have claimed slots */
  slots: PlayerSlot[];
  /** Minimum players needed to start game */
  requiredPlayers: number;
  /** Maximum players allowed (for display purposes) */
  maxPlayers: number;
  /** Current user's ID to highlight their slot */
  currentUserId?: string;
  /** Use compact layout (smaller avatars, no names) */
  compact?: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parse avatar string to AvatarConfig
 * Returns default config if parsing fails
 */
function parseAvatarConfig(avatarString?: string): AvatarConfig {
  if (!avatarString) {
    return { baseColor: "#ccd5ae" };
  }
  try {
    return JSON.parse(avatarString) as AvatarConfig;
  } catch {
    return { baseColor: "#ccd5ae" };
  }
}

// =============================================================================
// Component
// =============================================================================

export function PlayerSlots({
  slots,
  requiredPlayers,
  maxPlayers,
  currentUserId,
  compact = false,
}: PlayerSlotsProps) {
  const theme = useTheme();
  const emptySlots = Math.max(0, requiredPlayers - slots.length);
  const size = compact ? 32 : 44;

  return (
    <View style={styles.container}>
      {/* Filled Slots */}
      {slots.map((slot) => (
        <View
          key={slot.playerId}
          style={[
            styles.slot,
            compact && styles.slotCompact,
            slot.playerId === currentUserId && {
              borderColor: theme.colors.primary,
              borderWidth: 2,
              borderRadius: BorderRadius.md,
            },
          ]}
        >
          <Avatar config={parseAvatarConfig(slot.playerAvatar)} size={size} />
          {!compact && (
            <Text
              style={[styles.playerName, { color: theme.colors.onSurface }]}
              numberOfLines={1}
            >
              {slot.playerName}
            </Text>
          )}
          {slot.isHost && (
            <View
              style={[
                styles.hostBadge,
                { backgroundColor: theme.colors.primary },
              ]}
            >
              <MaterialCommunityIcons name="crown" size={10} color="#fff" />
            </View>
          )}
        </View>
      ))}

      {/* Empty Slots */}
      {Array(emptySlots)
        .fill(null)
        .map((_, index) => (
          <View
            key={`empty-${index}`}
            style={[
              styles.slot,
              styles.emptySlot,
              compact && styles.slotCompact,
              { borderColor: theme.colors.outlineVariant },
            ]}
          >
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
              <Text style={{ color: theme.colors.onSurfaceVariant }}>?</Text>
            </View>
            {!compact && (
              <Text
                style={[
                  styles.waitingText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Waiting...
              </Text>
            )}
          </View>
        ))}
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
});

export default PlayerSlots;
