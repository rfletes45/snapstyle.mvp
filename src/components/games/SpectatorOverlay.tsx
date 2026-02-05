/**
 * SpectatorOverlay
 *
 * An overlay component that shows spectator information on game screens.
 * Displays the number of spectators watching and their names.
 *
 * @file src/components/games/SpectatorOverlay.tsx
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { Surface, Text, useTheme } from "react-native-paper";

import { LiveSpectator } from "@/services/liveSpectatorSession";
import { BorderRadius, Spacing } from "../../../constants/theme";

// =============================================================================
// Types
// =============================================================================

export interface SpectatorOverlayProps {
  /** List of spectators */
  spectators: LiveSpectator[];
  /** Whether the current user is the host (player) */
  isHost: boolean;
  /** Called when host wants to end spectating */
  onEndSession?: () => void;
}

// =============================================================================
// Component
// =============================================================================

export function SpectatorOverlay({
  spectators,
  isHost,
  onEndSession,
}: SpectatorOverlayProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  const spectatorCount = spectators.length;

  if (spectatorCount === 0 && isHost) {
    // Show waiting message for host
    return (
      <View style={styles.floatingContainer}>
        <Surface
          style={[
            styles.badge,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
          elevation={2}
        >
          <MaterialCommunityIcons
            name="eye-off"
            size={16}
            color={theme.colors.onSurfaceVariant}
          />
          <Text
            style={[styles.badgeText, { color: theme.colors.onSurfaceVariant }]}
          >
            No spectators yet
          </Text>
        </Surface>
      </View>
    );
  }

  if (spectatorCount === 0) {
    return null;
  }

  return (
    <View style={styles.floatingContainer}>
      <Pressable onPress={() => setExpanded(!expanded)}>
        <Surface
          style={[
            styles.badge,
            { backgroundColor: theme.colors.primaryContainer },
          ]}
          elevation={2}
        >
          <View
            style={[styles.liveDot, { backgroundColor: theme.colors.error }]}
          />
          <MaterialCommunityIcons
            name="eye"
            size={16}
            color={theme.colors.onPrimaryContainer}
          />
          <Text
            style={[
              styles.badgeText,
              { color: theme.colors.onPrimaryContainer },
            ]}
          >
            {spectatorCount} watching
          </Text>
          <MaterialCommunityIcons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={theme.colors.onPrimaryContainer}
          />
        </Surface>
      </Pressable>

      {/* Expanded spectator list */}
      {expanded && (
        <Surface
          style={[
            styles.expandedList,
            { backgroundColor: theme.colors.surface },
          ]}
          elevation={3}
        >
          <Text
            style={[styles.listTitle, { color: theme.colors.onSurfaceVariant }]}
          >
            Spectators
          </Text>
          <FlatList
            data={spectators}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.spectatorItem}>
                <MaterialCommunityIcons
                  name="account"
                  size={16}
                  color={theme.colors.onSurface}
                />
                <Text
                  style={[
                    styles.spectatorName,
                    { color: theme.colors.onSurface },
                  ]}
                  numberOfLines={1}
                >
                  {item.displayName}
                </Text>
              </View>
            )}
            style={styles.list}
            scrollEnabled={spectatorCount > 5}
          />
          {isHost && onEndSession && (
            <Pressable
              onPress={onEndSession}
              style={[
                styles.endButton,
                { backgroundColor: theme.colors.errorContainer },
              ]}
            >
              <Text
                style={[
                  styles.endButtonText,
                  { color: theme.colors.onErrorContainer },
                ]}
              >
                End spectating session
              </Text>
            </Pressable>
          )}
        </Surface>
      )}
    </View>
  );
}

// =============================================================================
// Spectator View Banner (for spectators watching)
// =============================================================================

export interface SpectatorViewBannerProps {
  /** The host name */
  hostName: string;
  /** Called when spectator wants to leave */
  onLeave: () => void;
}

export function SpectatorViewBanner({
  hostName,
  onLeave,
}: SpectatorViewBannerProps) {
  const theme = useTheme();

  return (
    <Surface
      style={[
        styles.banner,
        { backgroundColor: theme.colors.primaryContainer },
      ]}
      elevation={2}
    >
      <View style={styles.bannerContent}>
        <View
          style={[styles.liveDot, { backgroundColor: theme.colors.error }]}
        />
        <MaterialCommunityIcons
          name="eye"
          size={18}
          color={theme.colors.onPrimaryContainer}
        />
        <Text
          style={[
            styles.bannerText,
            { color: theme.colors.onPrimaryContainer },
          ]}
        >
          Watching {hostName} play
        </Text>
      </View>
      <Pressable
        onPress={onLeave}
        style={[styles.leaveButton, { backgroundColor: theme.colors.surface }]}
      >
        <Text style={[styles.leaveButtonText, { color: theme.colors.primary }]}>
          Leave
        </Text>
      </Pressable>
    </Surface>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  floatingContainer: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 100,
    alignItems: "flex-end",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  expandedList: {
    marginTop: Spacing.xs,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    minWidth: 150,
    maxHeight: 200,
  },
  listTitle: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: Spacing.xs,
  },
  list: {
    maxHeight: 120,
  },
  spectatorItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    gap: 6,
  },
  spectatorName: {
    fontSize: 13,
    flex: 1,
  },
  endButton: {
    marginTop: Spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
  },
  endButtonText: {
    fontSize: 12,
    fontWeight: "500",
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  bannerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  bannerText: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  leaveButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  leaveButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
});

export default SpectatorOverlay;
