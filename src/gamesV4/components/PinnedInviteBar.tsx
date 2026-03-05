/**
 * Games V4 — PinnedInviteBar
 *
 * Sticky bar that appears between the navigation header and the message list
 * in DM and group chat screens. Displays pinned game invites with:
 * - Game icon + name
 * - Status badge (Waiting, Your Turn, In Progress)
 * - Tap to navigate to lobby/game/result
 *
 * @module gamesV4/components/PinnedInviteBar
 */

import { GAME_METADATA } from "@/gamesV4/constants";
import { usePinnedInvites } from "@/gamesV4/hooks/usePinnedInvites";
import type { GameInviteV4 } from "@/gamesV4/types";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import type { MainStackParamList } from "@/types/navigation/root";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// =============================================================================
// Types
// =============================================================================

interface PinnedInviteBarProps {
  conversationId: string;
  scope: "dm" | "group";
}

type Nav = NativeStackNavigationProp<MainStackParamList>;

// =============================================================================
// Status helpers
// =============================================================================

type InviteDisplayStatus =
  | "waiting"
  | "your_turn"
  | "active"
  | "resolved"
  | "cancelled";

function getDisplayStatus(
  invite: GameInviteV4,
  uid: string | undefined,
): InviteDisplayStatus {
  if (invite.status === "resolved") {
    // Resolved without sessionId = cancelled by host
    return invite.sessionId ? "resolved" : "cancelled";
  }
  if (invite.status === "active") {
    if (invite.summary?.turnPlayerId && invite.summary.turnPlayerId === uid) {
      return "your_turn";
    }
    return "active";
  }
  return "waiting";
}

function getStatusLabel(status: InviteDisplayStatus): string {
  switch (status) {
    case "waiting":
      return "Waiting";
    case "your_turn":
      return "Your Turn!";
    case "active":
      return "In Progress";
    case "resolved":
      return "Finished";
    case "cancelled":
      return "Cancelled";
  }
}

function getStatusColor(
  status: InviteDisplayStatus,
  colors: { primary: string },
): string {
  switch (status) {
    case "waiting":
      return "#888";
    case "your_turn":
      return "#FF6B35";
    case "active":
      return colors.primary;
    case "resolved":
      return "#666";
    case "cancelled":
      return "#999";
  }
}

// =============================================================================
// Component
// =============================================================================

export function PinnedInviteBar({
  conversationId,
  scope,
}: PinnedInviteBarProps) {
  const { theme } = useAppTheme();
  const { currentFirebaseUser } = useAuth();
  const navigation = useNavigation<Nav>();
  const { invites, loading } = usePinnedInvites(conversationId, scope);

  const handlePress = useCallback(
    (invite: GameInviteV4) => {
      if (invite.status === "active" && invite.sessionId) {
        // Navigate directly to the game play screen
        navigation.navigate("GamePlayV4", {
          sessionId: invite.sessionId,
          gameId: invite.gameId,
        });
      } else if (invite.status === "sent" || invite.status === "lobby") {
        navigation.navigate("GameLobbyV4", { inviteId: invite.inviteId });
      } else if (invite.status === "resolved" && invite.sessionId) {
        navigation.navigate("GameOverV4", { sessionId: invite.sessionId });
      }
      // Resolved without sessionId = cancelled — no-op (chip is dimmed)
    },
    [navigation],
  );

  // Filter out cancelled invites (resolved without sessionId)
  const visibleInvites = invites.filter(
    (inv) => !(inv.status === "resolved" && !inv.sessionId),
  );

  // Don't render if no invites or loading
  if (loading || visibleInvites.length === 0) {
    return null;
  }

  const renderInviteChip = ({ item }: { item: GameInviteV4 }) => {
    const meta = GAME_METADATA[item.gameId];
    const status = getDisplayStatus(item, currentFirebaseUser?.uid);
    const statusColor = getStatusColor(status, theme.colors);
    const isYourTurn = status === "your_turn";

    return (
      <TouchableOpacity
        style={[
          styles.chip,
          {
            backgroundColor: theme.isDark ? "#1C1C1E" : "#F2F2F7",
            borderColor: isYourTurn ? "#FF6B35" : "transparent",
            borderWidth: isYourTurn ? 1.5 : 0,
          },
        ]}
        onPress={() => handlePress(item)}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons
          name={
            (meta?.icon ??
              "gamepad-variant") as keyof typeof MaterialCommunityIcons.glyphMap
          }
          size={16}
          color={statusColor}
        />
        <Text
          style={[styles.chipName, { color: theme.isDark ? "#FFF" : "#000" }]}
          numberOfLines={1}
        >
          {meta?.displayName ?? item.gameId}
        </Text>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={[styles.statusLabel, { color: statusColor }]}>
          {getStatusLabel(status)}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.isDark ? "#000" : theme.colors.background,
          borderBottomColor: theme.isDark ? "#333" : "#E0E0E0",
        },
      ]}
    >
      <FlatList
        data={visibleInvites}
        renderItem={renderInviteChip}
        keyExtractor={(item) => item.inviteId}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
  },
  listContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 5,
  },
  chipName: {
    fontSize: 13,
    fontWeight: "600",
    maxWidth: 80,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 2,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
});
