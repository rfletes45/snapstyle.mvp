/**
 * InviteListSheet — Overflow modal for v3 session pills
 *
 * Shows when there are more than 3 active sessions in a conversation.
 * Opened from the "+N more" chip in InvitePillRow.
 *
 * Uses RN Modal (same pattern as InvitePickerModal) since the project
 * does not use a dedicated bottom-sheet library.
 *
 * @module components/chat/InviteListSheet
 */

import { BorderRadius, Spacing } from "@/constants/theme";
import type { GameSessionV3 } from "@/types/gameSessionV3";
import { isLobbyFull, isParticipant } from "@/types/gameSessionV3";
import type { ExtendedGameType } from "@/types/games";
import { GAME_METADATA, isValidGameType } from "@/types/games";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text, useTheme } from "react-native-paper";

// =============================================================================
// Props
// =============================================================================

export interface InviteListSheetProps {
  visible: boolean;
  sessions: GameSessionV3[];
  currentUserId: string;
  onNavigateToLobby: (sessionId: string) => void;
  onClose: () => void;
}

// =============================================================================
// Component
// =============================================================================

export function InviteListSheet({
  visible,
  sessions,
  currentUserId,
  onNavigateToLobby,
  onClose,
}: InviteListSheetProps) {
  const theme = useTheme();

  const handlePress = useCallback(
    (sessionId: string) => {
      onClose();
      onNavigateToLobby(sessionId);
    },
    [onNavigateToLobby, onClose],
  );

  const renderItem = useCallback(
    ({ item }: { item: GameSessionV3 }) => {
      const gameType = item.gameType;
      const gameName = isValidGameType(gameType)
        ? (GAME_METADATA[gameType as ExtendedGameType]?.name ?? gameType)
        : gameType;

      const playerCount = item.participants.filter(
        (p) =>
          p.role !== "spectator" &&
          p.status !== "invited" &&
          p.status !== "left",
      ).length;
      const iAmIn = isParticipant(item, currentUserId);
      const full = isLobbyFull(item);
      const hostName =
        item.participants.find((p) => p.role === "host")?.displayName ??
        "Unknown";

      const ctaLabel = iAmIn
        ? item.phase === "active"
          ? "Resume"
          : "Open"
        : full
          ? "Watch"
          : "Join";

      return (
        <TouchableOpacity
          style={[
            styles.sessionRow,
            {
              backgroundColor: iAmIn
                ? theme.colors.primaryContainer
                : theme.colors.surface,
              borderColor: iAmIn ? theme.colors.primary : theme.colors.outline,
            },
          ]}
          onPress={() => handlePress(item.id)}
          activeOpacity={0.7}
        >
          <View style={styles.sessionInfo}>
            <Text
              style={[styles.gameName, { color: theme.colors.onSurface }]}
              numberOfLines={1}
            >
              {gameName}
            </Text>
            <Text
              style={[
                styles.hostText,
                { color: theme.colors.onSurfaceVariant },
              ]}
              numberOfLines={1}
            >
              Hosted by {hostName} · {playerCount}/{item.maxParticipants}
            </Text>
          </View>
          <View
            style={[styles.ctaBadge, { backgroundColor: theme.colors.primary }]}
          >
            <Text style={styles.ctaText}>{ctaLabel}</Text>
          </View>
        </TouchableOpacity>
      );
    },
    [currentUserId, handlePress, theme],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.colors.background }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View
              style={[
                styles.handle,
                { backgroundColor: theme.colors.outlineVariant },
              ]}
            />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text
              style={[styles.headerTitle, { color: theme.colors.onBackground }]}
              variant="titleMedium"
            >
              Active Games
            </Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={theme.colors.onBackground}
              />
            </TouchableOpacity>
          </View>

          {/* List */}
          <FlatList
            data={sessions}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        </Pressable>
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
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "60%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  handleContainer: {
    alignItems: "center",
    paddingVertical: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerTitle: {
    fontWeight: "700",
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  sessionInfo: {
    flex: 1,
  },
  gameName: {
    fontSize: 15,
    fontWeight: "600",
  },
  hostText: {
    fontSize: 12,
    marginTop: 2,
  },
  ctaBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ctaText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
});

export default InviteListSheet;
