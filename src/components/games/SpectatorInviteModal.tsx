/**
 * SpectatorInviteModal
 *
 * Modal for inviting others to watch you play a single-player game.
 * Shows game info, allows customizing max spectators, and sends invites.
 *
 * @file src/components/games/SpectatorInviteModal.tsx
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import { Dimensions, Modal, Pressable, StyleSheet, View } from "react-native";
import { Button, Chip, Divider, Text, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { sendSpectatorInvite, SpectatorInvite } from "@/services/gameInvites";
import { useAuth } from "@/store/AuthContext";
import { GAME_METADATA, SinglePlayerGameType } from "@/types/games";
import { BorderRadius, Spacing } from "../../../constants/theme";

// =============================================================================
// Types
// =============================================================================

export interface SpectatorInviteModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when modal should close */
  onDismiss: () => void;
  /** The game type to invite for */
  gameType: SinglePlayerGameType;
  /** Context: "dm" for 1:1 chat, "group" for group chat */
  context: "dm" | "group";
  /** The conversation ID */
  conversationId: string;
  /** Display name of conversation */
  conversationName?: string;
  /** For DM: the recipient's user ID */
  recipientId?: string;
  /** For DM: the recipient's display name */
  recipientName?: string;
  /** For DM: the recipient's avatar */
  recipientAvatar?: string;
  /** For Group: array of all member user IDs */
  eligibleUserIds?: string[];
  /** Called when invite is created and player should navigate to game */
  onInviteCreated: (invite: SpectatorInvite) => void;
  /** Called when player wants to play without spectators */
  onPlayAlone: () => void;
  /** Called on error */
  onError?: (error: string) => void;
}

// =============================================================================
// Constants
// =============================================================================

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const MAX_SPECTATOR_OPTIONS = [5, 10, 20, 50];

// =============================================================================
// Component
// =============================================================================

export function SpectatorInviteModal({
  visible,
  onDismiss,
  gameType,
  context,
  conversationId,
  conversationName,
  recipientId,
  recipientName,
  recipientAvatar,
  eligibleUserIds,
  onInviteCreated,
  onPlayAlone,
  onError,
}: SpectatorInviteModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { currentFirebaseUser } = useAuth();

  // State
  const [maxSpectators, setMaxSpectators] = useState(10);
  const [loading, setLoading] = useState(false);

  // Get game info
  const gameMetadata = GAME_METADATA[gameType];
  const gameName = gameMetadata?.name || gameType;
  const gameIcon = gameMetadata?.icon || "🎮";

  // Handle invite
  const handleSendInvite = useCallback(async () => {
    if (!currentFirebaseUser) {
      onError?.("Not authenticated");
      return;
    }

    const uid = currentFirebaseUser.uid;
    const userName =
      currentFirebaseUser.displayName || currentFirebaseUser.email || "Player";

    setLoading(true);

    try {
      const invite = await sendSpectatorInvite({
        hostId: uid,
        hostName: userName,
        hostAvatar: undefined, // TODO: Get from user profile
        gameType,
        context,
        conversationId,
        conversationName,
        recipientId: context === "dm" ? recipientId : undefined,
        recipientName: context === "dm" ? recipientName : undefined,
        recipientAvatar: context === "dm" ? recipientAvatar : undefined,
        eligibleUserIds: context === "group" ? eligibleUserIds : undefined,
        maxSpectators,
        expirationMinutes: 60,
      });

      onInviteCreated(invite);
    } catch (error: any) {
      console.error("[SpectatorInviteModal] Error creating invite:", error);
      onError?.(error.message || "Failed to create spectator invite");
    } finally {
      setLoading(false);
    }
  }, [
    currentFirebaseUser,
    gameType,
    context,
    conversationId,
    conversationName,
    recipientId,
    recipientName,
    recipientAvatar,
    eligibleUserIds,
    maxSpectators,
    onInviteCreated,
    onError,
  ]);

  const targetName =
    context === "dm"
      ? recipientName || "friend"
      : conversationName || "the group";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        {/* Backdrop - tap to dismiss */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        {/* Content container - Use View instead of Pressable to not capture touch events */}
        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor: theme.colors.background,
              paddingBottom: insets.bottom + Spacing.md,
            },
          ]}
        >
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View
              style={[styles.handle, { backgroundColor: theme.colors.outline }]}
            />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.onBackground }]}>
              Invite to Watch
            </Text>
            <Pressable onPress={onDismiss} style={styles.closeButton}>
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={theme.colors.onSurfaceVariant}
              />
            </Pressable>
          </View>

          {/* Game Info */}
          <View
            style={[
              styles.gameInfoCard,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
          >
            <Text style={styles.gameIcon}>{gameIcon}</Text>
            <View style={styles.gameTextContainer}>
              <Text
                style={[styles.gameName, { color: theme.colors.onSurface }]}
              >
                {gameName}
              </Text>
              <Text
                style={[
                  styles.gameDescription,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {gameMetadata?.description || "Single-player game"}
              </Text>
            </View>
          </View>

          {/* Explanation */}
          <View style={styles.explanationContainer}>
            <MaterialCommunityIcons
              name="eye"
              size={20}
              color={theme.colors.primary}
            />
            <Text
              style={[
                styles.explanationText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {context === "dm"
                ? `Invite ${recipientName || "your friend"} to watch you play in real-time!`
                : `Invite members of ${conversationName || "the group"} to watch you play in real-time!`}
            </Text>
          </View>

          <Divider style={styles.divider} />

          {/* Max Spectators */}
          <View style={styles.section}>
            <Text
              style={[
                styles.sectionTitle,
                { color: theme.colors.onBackground },
              ]}
            >
              Maximum Spectators
            </Text>
            <View style={styles.chipContainer}>
              {MAX_SPECTATOR_OPTIONS.map((count) => (
                <Chip
                  key={count}
                  mode={maxSpectators === count ? "flat" : "outlined"}
                  selected={maxSpectators === count}
                  onPress={() => setMaxSpectators(count)}
                  style={[
                    styles.chip,
                    maxSpectators === count && {
                      backgroundColor: theme.colors.primaryContainer,
                    },
                  ]}
                  textStyle={
                    maxSpectators === count
                      ? { color: theme.colors.onPrimaryContainer }
                      : {}
                  }
                >
                  {count}
                </Chip>
              ))}
            </View>
          </View>

          <Divider style={styles.divider} />

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              mode="outlined"
              onPress={onPlayAlone}
              style={styles.button}
              disabled={loading}
            >
              Play Alone
            </Button>
            <Button
              mode="contained"
              onPress={handleSendInvite}
              style={styles.button}
              loading={loading}
              disabled={loading}
              icon="send"
            >
              Send Invite & Play
            </Button>
          </View>

          {/* Info text */}
          <Text
            style={[styles.infoText, { color: theme.colors.onSurfaceVariant }]}
          >
            The invite will be sent to {targetName}. Once you start playing,
            they can join to watch your game live!
          </Text>
        </View>
      </View>
    </Modal>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContainer: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    maxHeight: SCREEN_HEIGHT * 0.7,
  },
  handleContainer: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
  },
  closeButton: {
    padding: Spacing.xs,
  },
  gameInfoCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  gameIcon: {
    fontSize: 40,
    marginRight: Spacing.md,
  },
  gameTextContainer: {
    flex: 1,
  },
  gameName: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  gameDescription: {
    fontSize: 14,
  },
  explanationContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  explanationText: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: 14,
    lineHeight: 20,
  },
  divider: {
    marginVertical: Spacing.md,
  },
  section: {
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: Spacing.sm,
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  chip: {
    marginRight: Spacing.xs,
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  button: {
    flex: 1,
  },
  infoText: {
    marginTop: Spacing.md,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
});

export default SpectatorInviteModal;
