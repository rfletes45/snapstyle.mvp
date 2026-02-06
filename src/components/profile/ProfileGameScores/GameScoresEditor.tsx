/**
 * GameScoresEditor Component
 *
 * Allows users to configure which game scores to display on their profile.
 * Users can select up to 5 games and reorder them.
 *
 * @module components/profile/ProfileGameScores/GameScoresEditor
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import {
  Button,
  Divider,
  Modal,
  Portal,
  Surface,
  Switch,
  Text,
  useTheme,
} from "react-native-paper";
import Animated, { FadeIn, FadeInDown, Layout } from "react-native-reanimated";

import { BorderRadius, Spacing } from "@/constants/theme";
import { ExtendedGameType, GAME_METADATA } from "@/types/games";
import type {
  ProfileGameScore,
  ProfileGameScoresConfig,
} from "@/types/userProfile";

// =============================================================================
// Types
// =============================================================================

export interface GameScoresEditorProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Callback when modal is dismissed */
  onDismiss: () => void;
  /** Current game scores configuration */
  currentConfig: ProfileGameScoresConfig;
  /** All available high scores for the user */
  availableScores: ProfileGameScore[];
  /** Callback when configuration is saved */
  onSave: (config: ProfileGameScoresConfig) => Promise<void>;
  /** Maximum games that can be displayed */
  maxGames?: number;
  /** Test ID */
  testID?: string;
}

interface SelectableGame {
  gameId: string;
  gameName: string;
  gameIcon: string;
  score: number;
  achievedAt: number;
  isSelected: boolean;
  displayOrder: number;
}

// =============================================================================
// Constants
// =============================================================================

const MAX_DISPLAY_GAMES = 5;

// =============================================================================
// Helper Functions
// =============================================================================

function getGameIcon(gameId: string): string {
  const metadata = GAME_METADATA[gameId as ExtendedGameType];
  return metadata?.icon || "🎮";
}

function getGameName(gameId: string): string {
  const metadata = GAME_METADATA[gameId as ExtendedGameType];
  return metadata?.shortName || metadata?.name || gameId;
}

function formatScore(score: number): string {
  if (score >= 1000000) {
    return `${(score / 1000000).toFixed(1)}M`;
  }
  if (score >= 1000) {
    return `${(score / 1000).toFixed(1)}K`;
  }
  return score.toLocaleString();
}

// =============================================================================
// Game Item Component
// =============================================================================

interface GameItemProps {
  game: SelectableGame;
  onToggle: (gameId: string) => void;
  onMoveUp: (gameId: string) => void;
  onMoveDown: (gameId: string) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  selectionDisabled: boolean;
  index: number;
}

const GameItem = memo(function GameItem({
  game,
  onToggle,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  selectionDisabled,
  index,
}: GameItemProps) {
  const theme = useTheme();

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).springify()}
      layout={Layout.springify()}
    >
      <Surface
        style={[
          styles.gameItem,
          game.isSelected && styles.gameItemSelected,
          {
            backgroundColor: game.isSelected
              ? theme.colors.primaryContainer
              : theme.colors.surfaceVariant,
          },
        ]}
        elevation={game.isSelected ? 2 : 1}
      >
        {/* Selection Order Badge */}
        {game.isSelected && (
          <View
            style={[
              styles.orderBadge,
              { backgroundColor: theme.colors.primary },
            ]}
          >
            <Text style={[styles.orderText, { color: theme.colors.onPrimary }]}>
              {game.displayOrder}
            </Text>
          </View>
        )}

        {/* Game Icon */}
        <View style={styles.gameIconContainer}>
          <Text style={styles.gameIcon}>{game.gameIcon}</Text>
        </View>

        {/* Game Info */}
        <View style={styles.gameInfo}>
          <Text
            style={[styles.gameName, { color: theme.colors.onSurface }]}
            numberOfLines={1}
          >
            {game.gameName}
          </Text>
          <Text
            style={[styles.gameScore, { color: theme.colors.onSurfaceVariant }]}
          >
            High Score: {formatScore(game.score)}
          </Text>
        </View>

        {/* Reorder Buttons (when selected) */}
        {game.isSelected && (
          <View style={styles.reorderButtons}>
            <TouchableOpacity
              onPress={() => onMoveUp(game.gameId)}
              disabled={!canMoveUp}
              style={[
                styles.reorderButton,
                !canMoveUp && styles.reorderButtonDisabled,
              ]}
            >
              <MaterialCommunityIcons
                name="chevron-up"
                size={20}
                color={
                  canMoveUp
                    ? theme.colors.primary
                    : theme.colors.onSurfaceDisabled
                }
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onMoveDown(game.gameId)}
              disabled={!canMoveDown}
              style={[
                styles.reorderButton,
                !canMoveDown && styles.reorderButtonDisabled,
              ]}
            >
              <MaterialCommunityIcons
                name="chevron-down"
                size={20}
                color={
                  canMoveDown
                    ? theme.colors.primary
                    : theme.colors.onSurfaceDisabled
                }
              />
            </TouchableOpacity>
          </View>
        )}

        {/* Selection Toggle */}
        <Switch
          value={game.isSelected}
          onValueChange={() => onToggle(game.gameId)}
          disabled={!game.isSelected && selectionDisabled}
          color={theme.colors.primary}
        />
      </Surface>
    </Animated.View>
  );
});

// =============================================================================
// Main Component
// =============================================================================

export const GameScoresEditor = memo(function GameScoresEditor({
  visible,
  onDismiss,
  currentConfig,
  availableScores,
  onSave,
  maxGames = MAX_DISPLAY_GAMES,
  testID,
}: GameScoresEditorProps) {
  const theme = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [enabled, setEnabled] = useState(currentConfig.enabled);
  const [selectedGames, setSelectedGames] = useState<ProfileGameScore[]>(
    currentConfig.displayedGames || [],
  );

  // Build the list of selectable games
  const selectableGames = useMemo((): SelectableGame[] => {
    const selectedIds = new Set(selectedGames.map((g) => g.gameId));
    const selectedOrderMap = new Map(
      selectedGames.map((g, i) => [g.gameId, i + 1]),
    );

    return availableScores.map((score) => ({
      gameId: score.gameId,
      gameName: score.gameName || getGameName(score.gameId),
      gameIcon: score.gameIcon || getGameIcon(score.gameId),
      score: score.score,
      achievedAt: score.achievedAt,
      isSelected: selectedIds.has(score.gameId),
      displayOrder: selectedOrderMap.get(score.gameId) || 0,
    }));
  }, [availableScores, selectedGames]);

  // Sort: selected first (by order), then unselected (by score)
  const sortedGames = useMemo(() => {
    return [...selectableGames].sort((a, b) => {
      if (a.isSelected && b.isSelected) {
        return a.displayOrder - b.displayOrder;
      }
      if (a.isSelected) return -1;
      if (b.isSelected) return 1;
      return b.score - a.score;
    });
  }, [selectableGames]);

  const selectedCount = selectedGames.length;
  const canSelectMore = selectedCount < maxGames;

  // Toggle game selection
  const handleToggle = useCallback(
    (gameId: string) => {
      setSelectedGames((prev) => {
        const isSelected = prev.some((g) => g.gameId === gameId);
        if (isSelected) {
          // Remove game
          return prev.filter((g) => g.gameId !== gameId);
        } else {
          // Add game
          const scoreData = availableScores.find((s) => s.gameId === gameId);
          if (!scoreData || prev.length >= maxGames) return prev;
          return [
            ...prev,
            {
              ...scoreData,
              displayOrder: prev.length + 1,
            },
          ];
        }
      });
    },
    [availableScores, maxGames],
  );

  // Move game up in order
  const handleMoveUp = useCallback((gameId: string) => {
    setSelectedGames((prev) => {
      const index = prev.findIndex((g) => g.gameId === gameId);
      if (index <= 0) return prev;
      const newList = [...prev];
      [newList[index - 1], newList[index]] = [
        newList[index],
        newList[index - 1],
      ];
      return newList.map((g, i) => ({ ...g, displayOrder: i + 1 }));
    });
  }, []);

  // Move game down in order
  const handleMoveDown = useCallback((gameId: string) => {
    setSelectedGames((prev) => {
      const index = prev.findIndex((g) => g.gameId === gameId);
      if (index < 0 || index >= prev.length - 1) return prev;
      const newList = [...prev];
      [newList[index], newList[index + 1]] = [
        newList[index + 1],
        newList[index],
      ];
      return newList.map((g, i) => ({ ...g, displayOrder: i + 1 }));
    });
  }, []);

  // Save configuration
  const handleSave = useCallback(async () => {
    setIsLoading(true);
    try {
      const newConfig: ProfileGameScoresConfig = {
        enabled,
        displayedGames: selectedGames.map((g, i) => ({
          ...g,
          displayOrder: i + 1,
        })),
        updatedAt: Date.now(),
      };
      await onSave(newConfig);
      onDismiss();
    } catch (error) {
      console.error("Failed to save game scores config:", error);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, selectedGames, onSave, onDismiss]);

  // Check if there are changes
  const hasChanges = useMemo(() => {
    if (enabled !== currentConfig.enabled) return true;
    const currentIds = (currentConfig.displayedGames || []).map(
      (g) => g.gameId,
    );
    const newIds = selectedGames.map((g) => g.gameId);
    if (currentIds.length !== newIds.length) return true;
    return currentIds.some((id, i) => id !== newIds[i]);
  }, [enabled, selectedGames, currentConfig]);

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.modalContent,
          { backgroundColor: theme.colors.surface },
        ]}
        testID={testID}
      >
        <Animated.View entering={FadeIn} style={styles.modalInner}>
          {/* Header */}
          <View style={styles.header}>
            <Text
              style={[styles.headerTitle, { color: theme.colors.onSurface }]}
            >
              Game Scores Display
            </Text>
            <TouchableOpacity onPress={onDismiss}>
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={theme.colors.onSurface}
              />
            </TouchableOpacity>
          </View>

          {/* Enable Toggle */}
          <Surface
            style={[
              styles.enableToggle,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
            elevation={1}
          >
            <View style={styles.enableInfo}>
              <MaterialCommunityIcons
                name="trophy"
                size={24}
                color={theme.colors.primary}
              />
              <View style={styles.enableText}>
                <Text
                  style={[
                    styles.enableLabel,
                    { color: theme.colors.onSurface },
                  ]}
                >
                  Show Game Scores
                </Text>
                <Text
                  style={[
                    styles.enableDescription,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  Display your top scores on your profile
                </Text>
              </View>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              color={theme.colors.primary}
            />
          </Surface>

          {/* Selection Counter */}
          <View style={styles.counter}>
            <Text
              style={[
                styles.counterText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {selectedCount} of {maxGames} games selected
            </Text>
          </View>

          <Divider />

          {/* Games List */}
          <ScrollView
            style={styles.gamesList}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.gamesListContent}
          >
            {sortedGames.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons
                  name="gamepad-variant-outline"
                  size={48}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text
                  style={[
                    styles.emptyText,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  No game scores available yet.
                </Text>
                <Text
                  style={[
                    styles.emptySubtext,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  Play some games to add scores here!
                </Text>
              </View>
            ) : (
              sortedGames.map((game, index) => (
                <GameItem
                  key={game.gameId}
                  game={game}
                  onToggle={handleToggle}
                  onMoveUp={handleMoveUp}
                  onMoveDown={handleMoveDown}
                  canMoveUp={game.isSelected && game.displayOrder > 1}
                  canMoveDown={
                    game.isSelected && game.displayOrder < selectedCount
                  }
                  selectionDisabled={!canSelectMore}
                  index={index}
                />
              ))
            )}
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              mode="outlined"
              onPress={onDismiss}
              style={styles.actionButton}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleSave}
              loading={isLoading}
              disabled={isLoading || !hasChanges}
              style={styles.actionButton}
            >
              Save
            </Button>
          </View>
        </Animated.View>
      </Modal>
    </Portal>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  modalContent: {
    margin: Spacing.lg,
    borderRadius: BorderRadius.lg,
    maxHeight: "80%",
    overflow: "hidden",
  },
  modalInner: {
    padding: Spacing.md,
    maxHeight: "100%",
    flexShrink: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  enableToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  enableInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: Spacing.sm,
  },
  enableText: {
    flex: 1,
  },
  enableLabel: {
    fontSize: 16,
    fontWeight: "500",
  },
  enableDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  counter: {
    paddingVertical: Spacing.sm,
  },
  counterText: {
    fontSize: 14,
    textAlign: "center",
  },
  gamesList: {
    flexShrink: 1,
    marginTop: Spacing.sm,
  },
  gamesListContent: {
    gap: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  gameItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    paddingLeft: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    overflow: "visible",
  },
  gameItemSelected: {
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.1)",
  },
  orderBadge: {
    position: "absolute",
    top: -6,
    left: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  orderText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  gameIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  gameIcon: {
    fontSize: 20,
  },
  gameInfo: {
    flex: 1,
  },
  gameName: {
    fontSize: 14,
    fontWeight: "500",
  },
  gameScore: {
    fontSize: 12,
    marginTop: 2,
  },
  reorderButtons: {
    flexDirection: "column",
  },
  reorderButton: {
    padding: 2,
  },
  reorderButtonDisabled: {
    opacity: 0.4,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "500",
    marginTop: Spacing.sm,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  actionButton: {
    minWidth: 100,
  },
});

export default GameScoresEditor;
