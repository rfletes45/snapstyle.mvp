/**
 * GamePickerModal
 *
 * Bottom sheet modal for selecting games from chat.
 * Displays games organized by category with proper handling for
 * single-player (with spectator invite option) and multiplayer (invite creation).
 *
 * @file src/components/games/GamePickerModal.tsx
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import {
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Chip, Text, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  CATEGORY_CONFIG,
  formatPlayerCount,
  getAllCategoriesWithGames,
  PickerCategory,
} from "@/config/gameCategories";
import {
  sendUniversalInvite,
  SpectatorInvite,
  startSpectatorInvite,
} from "@/services/gameInvites";
import {
  createLiveSession,
  startLiveSession,
} from "@/services/liveSpectatorSession";
import { useAuth } from "@/store/AuthContext";
import {
  ExtendedGameType,
  GameMetadata,
  SinglePlayerGameType,
} from "@/types/games";
import { UniversalGameInvite } from "@/types/turnBased";
import { BorderRadius, Spacing } from "../../../constants/theme";
import { SpectatorInviteModal } from "./SpectatorInviteModal";

// =============================================================================
// Types
// =============================================================================

export interface GamePickerModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when modal should close */
  onDismiss: () => void;
  /** Context: "dm" for 1:1 chat, "group" for group chat */
  context: "dm" | "group";
  /** The conversation ID (chatId or groupId) */
  conversationId: string;
  /** Display name of conversation (optional) */
  conversationName?: string;
  /** For DM: the recipient's user ID */
  recipientId?: string;
  /** For DM: the recipient's display name */
  recipientName?: string;
  /** For DM: the recipient's avatar config */
  recipientAvatar?: string;
  /** For Group: array of all member user IDs */
  eligibleUserIds?: string[];
  /** Called when a single-player game is selected (navigate to game) */
  onSinglePlayerGame: (
    gameType: ExtendedGameType,
    spectatorInviteId?: string,
    liveSessionId?: string,
  ) => void;
  /** Called when a multiplayer invite is created */
  onInviteCreated?: (invite: UniversalGameInvite) => void;
  /** Called when a spectator invite is created */
  onSpectatorInviteCreated?: (invite: SpectatorInvite) => void;
  /** Called on any error */
  onError?: (error: string) => void;
}

// =============================================================================
// Constants
// =============================================================================

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.7;

// =============================================================================
// Sub-Components
// =============================================================================

interface GameCardProps {
  game: GameMetadata;
  onPress: () => void;
  loading: boolean;
  disabled: boolean;
}

function GameCard({ game, onPress, loading, disabled }: GameCardProps) {
  const theme = useTheme();
  const isComingSoon = !game.isAvailable;
  const isDisabled = disabled || isComingSoon;

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.gameCard,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.outlineVariant,
          opacity: isDisabled ? 0.5 : pressed ? 0.8 : 1,
        },
      ]}
    >
      {/* Game Icon */}
      <View
        style={[
          styles.gameIconContainer,
          { backgroundColor: theme.colors.surfaceVariant },
        ]}
      >
        <Text style={styles.gameIcon}>{game.icon}</Text>
      </View>

      {/* Game Info */}
      <View style={styles.gameInfo}>
        <View style={styles.gameNameRow}>
          <Text
            style={[styles.gameName, { color: theme.colors.onSurface }]}
            numberOfLines={1}
          >
            {game.name}
          </Text>
          {isComingSoon && (
            <Chip
              compact
              mode="flat"
              style={styles.soonChip}
              textStyle={styles.soonChipText}
            >
              Soon
            </Chip>
          )}
        </View>
        <Text
          style={[
            styles.gameDescription,
            { color: theme.colors.onSurfaceVariant },
          ]}
          numberOfLines={1}
        >
          {game.description}
        </Text>
      </View>

      {/* Player Count / Loading */}
      <View style={styles.gameAction}>
        {loading ? (
          <MaterialCommunityIcons
            name="loading"
            size={20}
            color={theme.colors.primary}
          />
        ) : (
          <>
            {game.isMultiplayer && (
              <Text
                style={[styles.playerCount, { color: theme.colors.primary }]}
              >
                {formatPlayerCount(game)}
              </Text>
            )}
            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color={theme.colors.onSurfaceVariant}
            />
          </>
        )}
      </View>
    </Pressable>
  );
}

interface CategoryTabsProps {
  categories: PickerCategory[];
  selected: PickerCategory;
  onSelect: (category: PickerCategory) => void;
}

function CategoryTabs({ categories, selected, onSelect }: CategoryTabsProps) {
  const theme = useTheme();

  return (
    <View style={styles.categoryTabs}>
      {categories.map((categoryId) => {
        const config = CATEGORY_CONFIG[categoryId];
        const isSelected = selected === categoryId;

        return (
          <Pressable
            key={categoryId}
            onPress={() => onSelect(categoryId)}
            style={[
              styles.categoryTab,
              {
                backgroundColor: isSelected
                  ? theme.colors.primaryContainer
                  : "transparent",
                borderColor: isSelected
                  ? theme.colors.primary
                  : theme.colors.outlineVariant,
              },
            ]}
          >
            <Text style={styles.categoryEmoji}>{config.emoji}</Text>
            <Text
              style={[
                styles.categoryLabel,
                {
                  color: isSelected
                    ? theme.colors.onPrimaryContainer
                    : theme.colors.onSurfaceVariant,
                },
              ]}
            >
              {config.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function GamePickerModal({
  visible,
  onDismiss,
  context,
  conversationId,
  conversationName,
  recipientId,
  recipientName,
  recipientAvatar,
  eligibleUserIds,
  onSinglePlayerGame,
  onInviteCreated,
  onSpectatorInviteCreated,
  onError,
}: GamePickerModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { currentFirebaseUser } = useAuth();

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  const [selectedCategory, setSelectedCategory] =
    useState<PickerCategory>("multiplayer");
  const [loadingGame, setLoadingGame] = useState<ExtendedGameType | null>(null);
  // Spectator invite modal state
  const [spectatorInviteGame, setSpectatorInviteGame] =
    useState<SinglePlayerGameType | null>(null);
  const [spectatorModalVisible, setSpectatorModalVisible] = useState(false);

  // -------------------------------------------------------------------------
  // Computed
  // -------------------------------------------------------------------------
  const categoriesWithGames = useMemo(
    () => getAllCategoriesWithGames(false),
    [],
  );
  const categoryIds = useMemo(
    () => categoriesWithGames.map((c) => c.id),
    [categoriesWithGames],
  );
  const currentCategory = useMemo(
    () => categoriesWithGames.find((c) => c.id === selectedCategory),
    [categoriesWithGames, selectedCategory],
  );

  // -------------------------------------------------------------------------
  // Spectator Invite Handlers
  // -------------------------------------------------------------------------
  const handleSpectatorInviteCreated = useCallback(
    async (invite: SpectatorInvite) => {
      // Immediately create a live session and start the invite
      let sessionId: string | undefined;
      try {
        const result = await createLiveSession({
          gameType: invite.gameType as SinglePlayerGameType,
          hostId: invite.hostId,
          hostName: invite.hostName,
          hostAvatar: invite.hostAvatar,
          invitedUserIds: invite.eligibleUserIds,
          conversationId: invite.conversationId,
          conversationType: invite.context === "group" ? "group" : "dm",
          maxSpectators: invite.maxSpectators,
        });

        if (result.success && result.sessionId) {
          sessionId = result.sessionId;
          // Mark the spectator invite as active with the live session ID
          await startSpectatorInvite(invite.id, result.sessionId);
          // Also start the live session immediately so spectators see "active" status
          await startLiveSession(result.sessionId);
        }
      } catch (error) {
        console.error(
          "[GamePickerModal] Failed to create live session:",
          error,
        );
        // Continue anyway - host can still play, spectators just won't work
      }

      // Notify parent
      onSpectatorInviteCreated?.(invite);
      // Close modals and navigate to game with invite ID AND live session ID
      setSpectatorModalVisible(false);
      if (spectatorInviteGame) {
        onSinglePlayerGame(spectatorInviteGame, invite.id, sessionId);
      }
      onDismiss();
    },
    [
      onSpectatorInviteCreated,
      onSinglePlayerGame,
      spectatorInviteGame,
      onDismiss,
    ],
  );

  const handlePlayAlone = useCallback(() => {
    setSpectatorModalVisible(false);
    if (spectatorInviteGame) {
      onSinglePlayerGame(spectatorInviteGame);
    }
    onDismiss();
  }, [spectatorInviteGame, onSinglePlayerGame, onDismiss]);

  const handleSpectatorModalDismiss = useCallback(() => {
    setSpectatorModalVisible(false);
    setSpectatorInviteGame(null);
  }, []);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------
  const handleGamePress = useCallback(
    async (game: GameMetadata) => {
      if (!currentFirebaseUser) {
        onError?.("Not authenticated");
        return;
      }

      const uid = currentFirebaseUser.uid;
      const userName =
        currentFirebaseUser.displayName ||
        currentFirebaseUser.email ||
        "Player";

      // Single-player: show spectator invite modal
      if (!game.isMultiplayer) {
        setSpectatorInviteGame(game.id as SinglePlayerGameType);
        setSpectatorModalVisible(true);
        return;
      }

      // Multiplayer: create invite
      setLoadingGame(game.id);

      try {
        // Build eligible user IDs
        let finalEligibleUserIds: string[];
        if (context === "dm" && recipientId) {
          finalEligibleUserIds = [uid, recipientId];
        } else if (context === "group" && eligibleUserIds) {
          finalEligibleUserIds = eligibleUserIds.includes(uid)
            ? eligibleUserIds
            : [uid, ...eligibleUserIds];
        } else {
          throw new Error("Invalid context configuration");
        }

        const invite = await sendUniversalInvite({
          senderId: uid,
          senderName: userName,
          senderAvatar: undefined, // TODO: Get from user profile
          gameType: game.id as any,
          context,
          conversationId,
          conversationName,
          recipientId: context === "dm" ? recipientId : undefined,
          recipientName: context === "dm" ? recipientName : undefined,
          recipientAvatar: context === "dm" ? recipientAvatar : undefined,
          eligibleUserIds: finalEligibleUserIds,
          requiredPlayers: game.minPlayers,
          settings: {
            isRated: false,
            chatEnabled: true,
          },
          expirationMinutes: 60,
        });

        onInviteCreated?.(invite);
        onDismiss();
      } catch (error: any) {
        console.error("[GamePickerModal] Error creating invite:", error);
        onError?.(error.message || "Failed to create game invite");
      } finally {
        setLoadingGame(null);
      }
    },
    [
      currentFirebaseUser,
      context,
      conversationId,
      conversationName,
      recipientId,
      recipientName,
      recipientAvatar,
      eligibleUserIds,
      onSinglePlayerGame,
      onInviteCreated,
      onDismiss,
      onError,
    ],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const renderGameItem = useCallback(
    ({ item }: { item: GameMetadata }) => (
      <GameCard
        game={item}
        onPress={() => handleGamePress(item)}
        loading={loadingGame === item.id}
        disabled={loadingGame !== null && loadingGame !== item.id}
      />
    ),
    [handleGamePress, loadingGame],
  );

  // Hide the game picker when spectator modal is visible (only one modal at a time on mobile)
  const gamePickerVisible = visible && !spectatorModalVisible;

  return (
    <>
      {/* Main Game Picker Modal */}
      <Modal
        visible={gamePickerVisible}
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
                style={[
                  styles.handle,
                  { backgroundColor: theme.colors.outline },
                ]}
              />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <Text
                style={[styles.title, { color: theme.colors.onBackground }]}
              >
                Pick a Game
              </Text>
              <Pressable onPress={onDismiss} style={styles.closeButton}>
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={theme.colors.onSurfaceVariant}
                />
              </Pressable>
            </View>

            {/* Category Tabs */}
            <CategoryTabs
              categories={categoryIds}
              selected={selectedCategory}
              onSelect={setSelectedCategory}
            />

            {/* Category Subtitle */}
            {currentCategory && (
              <Text
                style={[
                  styles.categorySubtitle,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {currentCategory.subtitle}
              </Text>
            )}

            {/* Games List */}
            <FlatList
              data={currentCategory?.games || []}
              renderItem={renderGameItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.gamesList}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>

      {/* Spectator Invite Modal - MUST be sibling to main Modal, not nested inside */}
      {spectatorInviteGame && (
        <SpectatorInviteModal
          visible={spectatorModalVisible}
          onDismiss={handleSpectatorModalDismiss}
          gameType={spectatorInviteGame}
          context={context}
          conversationId={conversationId}
          conversationName={conversationName}
          recipientId={recipientId}
          recipientName={recipientName}
          recipientAvatar={recipientAvatar}
          eligibleUserIds={eligibleUserIds}
          onInviteCreated={handleSpectatorInviteCreated}
          onPlayAlone={handlePlayAlone}
          onError={onError}
        />
      )}
    </>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    maxHeight: MODAL_HEIGHT,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
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
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  closeButton: {
    padding: Spacing.xs,
  },
  categoryTabs: {
    flexDirection: "row",
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  categoryTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: 4,
  },
  categoryEmoji: {
    fontSize: 16,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  categorySubtitle: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  gamesList: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  gameCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  gameIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  gameIcon: {
    fontSize: 24,
  },
  gameInfo: {
    flex: 1,
  },
  gameNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  gameName: {
    fontSize: 16,
    fontWeight: "600",
  },
  gameDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  soonChip: {
    height: 20,
    backgroundColor: "#FFA50030",
  },
  soonChipText: {
    fontSize: 10,
    color: "#FFA500",
  },
  gameAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  playerCount: {
    fontSize: 12,
    fontWeight: "500",
  },
});

export default GamePickerModal;
