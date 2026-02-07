# Game Picker & Queue Enhancement Plan

## Executive Summary

This document provides a **complete implementation blueprint** for adding a Game Picker Modal, enhanced queue visualization, and host controls. This plan **overhauls** the existing dual-invite system (legacy `GameInvite` + new `UniversalGameInvite`) into a single, unified system.

---

## 🚨 CRITICAL: Architecture Overhaul Required

### Current Problems Identified

| Problem                     | Location                                          | Impact                        |
| --------------------------- | ------------------------------------------------- | ----------------------------- |
| **Duplicate Invite Types**  | `GameInvite` vs `UniversalGameInvite`             | Confusion, maintenance burden |
| **Duplicate Components**    | `GameInviteCard.tsx` vs `UniversalInviteCard.tsx` | Code duplication              |
| **Duplicate Services**      | `sendGameInvite()` + `sendUniversalInvite()`      | Inconsistent behavior         |
| **Excessive Debug Logging** | `GameInviteCard.tsx` (20+ console.logs)           | Performance, noise            |
| **Hardcoded Categories**    | `GamesHubScreen.tsx` lines 570-590                | No single source of truth     |
| **No Match Creation**       | `startGameEarly()` missing                        | Games can't actually start    |

### Deprecation Plan

**DELETE these files/exports after migration:**

```
src/components/GameInviteCard.tsx          # ENTIRE FILE - replaced by UniversalInviteCard
src/services/gameInvites.ts:
  - sendGameInvite()                        # Use sendUniversalInvite() only
  - GameInvite interface                    # Use UniversalGameInvite only
  - cancelGameInvite() for legacy           # Update to cancelUniversalInvite()
src/services/turnBasedGames.ts:
  - getPendingInvites()                     # Duplicated in gameInvites.ts
  - subscribeToInvites()                    # Duplicated in gameInvites.ts
  - respondToInvite()                       # Will use claimInviteSlot instead
```

---

## 1. Shared Configuration (IMPLEMENT FIRST)

### 1.1 Create `src/config/gameCategories.ts`

This becomes the **single source of truth** for game categorization across the entire app.

**File**: `src/config/gameCategories.ts`

```typescript
/**
 * Game Categories Configuration
 *
 * SINGLE SOURCE OF TRUTH for game organization.
 * Used by: GamePickerModal, GamesHubScreen, analytics
 *
 * @file src/config/gameCategories.ts
 */

import { ExtendedGameType, GAME_METADATA, GameMetadata } from "@/types/games";

// =============================================================================
// Types
// =============================================================================

export type PickerCategory = "action" | "puzzle" | "multiplayer" | "daily";

export interface CategoryConfig {
  id: PickerCategory;
  label: string;
  icon: string;
  emoji: string;
  subtitle: string;
  /** Filter function to determine which games belong to this category */
  filter: (game: GameMetadata) => boolean;
  /** Sort priority (lower = first) */
  sortOrder: number;
}

// =============================================================================
// Category Definitions
// =============================================================================

export const CATEGORY_CONFIG: Record<PickerCategory, CategoryConfig> = {
  action: {
    id: "action",
    label: "Action",
    icon: "lightning-bolt",
    emoji: "⚡",
    subtitle: "Fast-paced games",
    filter: (game) => game.category === "quick_play" && !game.isMultiplayer,
    sortOrder: 1,
  },
  puzzle: {
    id: "puzzle",
    label: "Puzzle",
    icon: "puzzle",
    emoji: "🧩",
    subtitle: "Brain teasers",
    filter: (game) => game.category === "puzzle" && !game.isMultiplayer,
    sortOrder: 2,
  },
  multiplayer: {
    id: "multiplayer",
    label: "Multiplayer",
    icon: "account-group",
    emoji: "👥",
    subtitle: "Play with friends",
    filter: (game) => game.isMultiplayer,
    sortOrder: 3,
  },
  daily: {
    id: "daily",
    label: "Daily",
    icon: "calendar-today",
    emoji: "📅",
    subtitle: "New challenge daily",
    filter: (game) => game.category === "daily",
    sortOrder: 4,
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get all games for a specific category
 */
export function getGamesForCategory(
  categoryId: PickerCategory,
  availableOnly: boolean = false,
): GameMetadata[] {
  const config = CATEGORY_CONFIG[categoryId];
  if (!config) return [];

  return Object.values(GAME_METADATA)
    .filter(config.filter)
    .filter((game) => !availableOnly || game.isAvailable)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get all categories with their games
 */
export function getAllCategoriesWithGames(
  availableOnly: boolean = false,
): Array<CategoryConfig & { games: GameMetadata[] }> {
  return Object.values(CATEGORY_CONFIG)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((config) => ({
      ...config,
      games: getGamesForCategory(config.id, availableOnly),
    }))
    .filter((cat) => cat.games.length > 0);
}

/**
 * Get category for a specific game
 */
export function getCategoryForGame(
  gameType: ExtendedGameType,
): PickerCategory | null {
  const game = GAME_METADATA[gameType];
  if (!game) return null;

  for (const [categoryId, config] of Object.entries(CATEGORY_CONFIG)) {
    if (config.filter(game)) {
      return categoryId as PickerCategory;
    }
  }
  return null;
}

/**
 * Format player count for display
 */
export function formatPlayerCount(game: GameMetadata): string {
  if (!game.isMultiplayer) return "Solo";
  if (game.minPlayers === game.maxPlayers) {
    return `${game.minPlayers} players`;
  }
  return `${game.minPlayers}-${game.maxPlayers} players`;
}

// =============================================================================
// Navigation Map
// =============================================================================

export const GAME_SCREEN_MAP: Record<ExtendedGameType, string> = {
  // Action/Quick Play
  reaction_tap: "ReactionTapGame",
  timed_tap: "TimedTapGame",
  flappy_snap: "FlappySnapGame",
  bounce_blitz: "BounceBlitzGame",
  snap_snake: "SnapSnakeGame",
  // Puzzle
  snap_2048: "Snap2048Game",
  memory_snap: "MemorySnapGame",
  // Daily
  word_snap: "WordSnapGame",
  // Multiplayer
  tic_tac_toe: "TicTacToeGame",
  checkers: "CheckersGame",
  chess: "ChessGame",
  crazy_eights: "CrazyEightsGame",
  // Coming Soon
  "8ball_pool": "PoolGame",
  air_hockey: "AirHockeyGame",
};
```

---

## 2. Phase 1: Game Picker Modal (Complete Implementation)

### 2.1 Create `src/components/games/GamePickerModal.tsx`

**Full implementation with all features:**

**File**: `src/components/games/GamePickerModal.tsx`

```typescript
/**
 * GamePickerModal
 *
 * Bottom sheet modal for selecting games from chat.
 * Displays games organized by category with proper handling for
 * single-player (direct navigation) and multiplayer (invite creation).
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
import { Button, Chip, Surface, Text, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { sendUniversalInvite } from "@/services/gameInvites";
import { useAuth } from "@/store/AuthContext";
import { ExtendedGameType, GAME_METADATA, GameMetadata } from "@/types/games";
import { UniversalGameInvite } from "@/types/turnBased";
import {
  CATEGORY_CONFIG,
  formatPlayerCount,
  getAllCategoriesWithGames,
  PickerCategory,
} from "@/config/gameCategories";
import { BorderRadius, Spacing } from "../../../constants/theme";

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
  onSinglePlayerGame: (gameType: ExtendedGameType) => void;
  /** Called when a multiplayer invite is created */
  onInviteCreated?: (invite: UniversalGameInvite) => void;
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
          style={[styles.gameDescription, { color: theme.colors.onSurfaceVariant }]}
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
              <Text style={[styles.playerCount, { color: theme.colors.primary }]}>
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
  onError,
}: GamePickerModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { currentFirebaseUser } = useAuth();

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  const [selectedCategory, setSelectedCategory] = useState<PickerCategory>("multiplayer");
  const [loadingGame, setLoadingGame] = useState<ExtendedGameType | null>(null);

  // -------------------------------------------------------------------------
  // Computed
  // -------------------------------------------------------------------------
  const categoriesWithGames = useMemo(() => getAllCategoriesWithGames(false), []);
  const categoryIds = useMemo(
    () => categoriesWithGames.map((c) => c.id),
    [categoriesWithGames]
  );
  const currentCategory = useMemo(
    () => categoriesWithGames.find((c) => c.id === selectedCategory),
    [categoriesWithGames, selectedCategory]
  );

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
        currentFirebaseUser.displayName || currentFirebaseUser.email || "Player";

      // Single-player: just navigate
      if (!game.isMultiplayer) {
        onSinglePlayerGame(game.id);
        onDismiss();
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
    ]
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
    [handleGamePress, loadingGame]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable
          style={[
            styles.modalContainer,
            {
              backgroundColor: theme.colors.background,
              paddingBottom: insets.bottom + Spacing.md,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
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
              style={[styles.categorySubtitle, { color: theme.colors.onSurfaceVariant }]}
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
        </Pressable>
      </Pressable>
    </Modal>
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
```

### 2.2 Wire Up ChatScreen.tsx

**File**: `src/screens/chat/ChatScreen.tsx`

**EXACT changes to make (with line references):**

```typescript
// =============================================================================
// STEP 1: Add imports at top of file (after existing imports)
// =============================================================================
import { GamePickerModal } from "@/components/games/GamePickerModal";
import { GAME_SCREEN_MAP } from "@/config/gameCategories";
import { ExtendedGameType } from "@/types/games";

// =============================================================================
// STEP 2: Add state (inside component, after existing state declarations)
// =============================================================================
const [gamePickerVisible, setGamePickerVisible] = useState(false);

// =============================================================================
// STEP 3: Replace handleGamePress (currently around line 327)
// =============================================================================
// DELETE THIS:
const handleGamePress = useCallback(() => {
  // TODO: Implement game picker modal
  console.log("[ChatScreen] Game button pressed");
}, []);

// REPLACE WITH THIS:
const handleGamePress = useCallback(() => {
  setGamePickerVisible(true);
}, []);

const handleSinglePlayerGame = useCallback(
  (gameType: ExtendedGameType) => {
    const screen = GAME_SCREEN_MAP[gameType];
    if (screen) {
      navigation.navigate(screen as any);
    }
  },
  [navigation]
);

const handleInviteCreated = useCallback(() => {
  // Invite will appear via ChatGameInvites subscription
  // Optionally show a toast or haptic feedback here
}, []);

// =============================================================================
// STEP 4: Add GamePickerModal to render (before closing </> fragment)
// Insert this JSX just before the final closing fragment tag
// =============================================================================
<GamePickerModal
  visible={gamePickerVisible}
  onDismiss={() => setGamePickerVisible(false)}
  context="dm"
  conversationId={chatId || ""}
  conversationName={friendProfile?.username}
  recipientId={friendUid}
  recipientName={friendProfile?.username}
  recipientAvatar={friendProfile?.avatar}
  onSinglePlayerGame={handleSinglePlayerGame}
  onInviteCreated={handleInviteCreated}
  onError={(error) => Alert.alert("Error", error)}
/>
```

### 2.3 Wire Up GroupChatScreen.tsx

**File**: `src/screens/groups/GroupChatScreen.tsx`

**EXACT changes to make (similar pattern):**

```typescript
// =============================================================================
// STEP 1: Add imports at top of file (after existing imports)
// =============================================================================
import { GamePickerModal } from "@/components/games/GamePickerModal";
import { GAME_SCREEN_MAP } from "@/config/gameCategories";
import { ExtendedGameType } from "@/types/games";

// =============================================================================
// STEP 2: Add state (inside component, after existing state declarations)
// =============================================================================
const [gamePickerVisible, setGamePickerVisible] = useState(false);

// =============================================================================
// STEP 3: Replace handleGamePress (currently around line 450)
// =============================================================================
// DELETE THIS:
const handleGamePress = useCallback(() => {
  // TODO: Implement game picker modal
  console.log("[GroupChatScreen] Game button pressed");
}, []);

// REPLACE WITH THIS:
const handleGamePress = useCallback(() => {
  setGamePickerVisible(true);
}, []);

const handleSinglePlayerGame = useCallback(
  (gameType: ExtendedGameType) => {
    const screen = GAME_SCREEN_MAP[gameType];
    if (screen) {
      navigation.navigate(screen as any);
    }
  },
  [navigation]
);

// =============================================================================
// STEP 4: Compute eligible user IDs from group members
// Add this useMemo after members state is available
// =============================================================================
const groupMemberIds = useMemo(
  () => members.map((m) => m.id),
  [members]
);

// =============================================================================
// STEP 5: Add GamePickerModal to render (before closing </> fragment)
// =============================================================================
<GamePickerModal
  visible={gamePickerVisible}
  onDismiss={() => setGamePickerVisible(false)}
  context="group"
  conversationId={groupId}
  conversationName={groupData?.name}
  eligibleUserIds={groupMemberIds}
  onSinglePlayerGame={handleSinglePlayerGame}
  onInviteCreated={() => {}}
  onError={(error) => Alert.alert("Error", error)}
/>
```

---

## 3. Phase 2: Queue Display Overhaul

### 3.1 Create `src/components/games/QueueProgressBar.tsx`

**New component for visual queue progress:**

**File**: `src/components/games/QueueProgressBar.tsx`

```typescript
/**
 * QueueProgressBar
 *
 * Visual progress indicator for multiplayer game queue filling.
 * Shows current/required players with animated fill.
 *
 * @file src/components/games/QueueProgressBar.tsx
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import Animated, {
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

import { BorderRadius, Spacing } from "../../../constants/theme";

// =============================================================================
// Types
// =============================================================================

export interface QueueProgressBarProps {
  /** Number of players who have joined */
  current: number;
  /** Minimum players needed to start */
  required: number;
  /** Maximum players allowed (optional) */
  max?: number;
  /** Show text labels */
  showLabels?: boolean;
  /** Compact mode (smaller height) */
  compact?: boolean;
}

// =============================================================================
// Component
// =============================================================================

export function QueueProgressBar({
  current,
  required,
  max,
  showLabels = true,
  compact = false,
}: QueueProgressBarProps) {
  const theme = useTheme();

  // Calculate progress percentage (capped at 100%)
  const progress = Math.min(current / required, 1);
  const isFull = current >= required;
  const isOverflow = max && current > required;

  // Determine color based on state
  const progressColor = isFull
    ? theme.colors.primary // Green-ish when ready
    : "#FFA500"; // Orange when filling

  // Animated width
  const animatedStyle = useAnimatedStyle(() => ({
    width: withSpring(`${progress * 100}%`, {
      damping: 15,
      stiffness: 100,
    }),
  }));

  return (
    <View style={styles.container}>
      {showLabels && (
        <View style={styles.labelRow}>
          <Text
            style={[
              styles.queueText,
              { color: isFull ? theme.colors.primary : theme.colors.onSurface },
            ]}
          >
            {current}/{required} {isFull ? "ready" : "queued"}
          </Text>
          {isOverflow && (
            <Text style={[styles.maxText, { color: theme.colors.onSurfaceVariant }]}>
              (max {max})
            </Text>
          )}
        </View>
      )}

      <View
        style={[
          styles.progressTrack,
          compact && styles.progressTrackCompact,
          { backgroundColor: theme.colors.surfaceVariant },
        ]}
      >
        <Animated.View
          style={[
            styles.progressFill,
            compact && styles.progressFillCompact,
            { backgroundColor: progressColor },
            animatedStyle,
          ]}
        />
      </View>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  queueText: {
    fontSize: 14,
    fontWeight: "600",
  },
  maxText: {
    fontSize: 12,
  },
  progressTrack: {
    height: 8,
    borderRadius: BorderRadius.xs,
    overflow: "hidden",
  },
  progressTrackCompact: {
    height: 4,
  },
  progressFill: {
    height: "100%",
    borderRadius: BorderRadius.xs,
  },
  progressFillCompact: {
    borderRadius: BorderRadius.xs,
  },
});

export default QueueProgressBar;
```

### 3.2 Overhaul `src/components/games/PlayerSlots.tsx`

**COMPLETE REWRITE with animations and better UX:**

**File**: `src/components/games/PlayerSlots.tsx`

```typescript
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
import Animated, {
  FadeIn,
  FadeOut,
  Layout,
} from "react-native-reanimated";

import Avatar from "@/components/Avatar";
import type { AvatarConfig } from "@/types/models";
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

function parseAvatarConfig(avatarString?: string): AvatarConfig {
  if (!avatarString) return { baseColor: "#ccd5ae" };
  try {
    return JSON.parse(avatarString) as AvatarConfig;
  } catch {
    return { baseColor: "#ccd5ae" };
  }
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

function FilledSlot({ slot, isCurrentUser, size, compact, position }: FilledSlotProps) {
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
        <View style={[styles.positionBadge, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Text style={[styles.positionText, { color: theme.colors.onSurfaceVariant }]}>
            {position}
          </Text>
        </View>
      )}

      {/* Avatar */}
      <Avatar config={parseAvatarConfig(slot.playerAvatar)} size={size} />

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
        <View style={[styles.hostBadge, { backgroundColor: theme.colors.primary }]}>
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
        <View style={[styles.positionBadge, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Text style={[styles.positionText, { color: theme.colors.onSurfaceVariant }]}>
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
        <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: size * 0.4 }}>
          ?
        </Text>
      </View>

      {!compact && (
        <Text style={[styles.waitingText, { color: theme.colors.onSurfaceVariant }]}>
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
    const items: Array<{ type: "filled"; slot: PlayerSlot } | { type: "empty" }> = [];

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
```

### 3.3 Overhaul `src/components/games/UniversalInviteCard.tsx`

**COMPLETE REWRITE - integrates QueueProgressBar, PlayerSlots, host controls:**

**File**: `src/components/games/UniversalInviteCard.tsx`

```typescript
/**
 * UniversalInviteCard - OVERHAULED
 *
 * Unified game invite card with:
 * - Queue progress visualization
 * - Player slots display
 * - Host controls (start early, cancel)
 * - Join/Leave/Spectate actions
 *
 * REPLACES: Legacy GameInviteCard.tsx
 *
 * @file src/components/games/UniversalInviteCard.tsx
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Card, Chip, Divider, Text, useTheme } from "react-native-paper";

import { GAME_METADATA, type ExtendedGameType } from "@/types/games";
import type { UniversalGameInvite } from "@/types/turnBased";
import { BorderRadius, Spacing } from "../../../constants/theme";
import { PlayerSlots } from "./PlayerSlots";
import { QueueProgressBar } from "./QueueProgressBar";

// =============================================================================
// Types
// =============================================================================

export interface UniversalInviteCardProps {
  /** The invite to display */
  invite: UniversalGameInvite;
  /** Current user's ID */
  currentUserId: string;
  /** Join the game queue */
  onJoin: () => Promise<void>;
  /** Leave the game queue */
  onLeave: () => Promise<void>;
  /** Join as spectator */
  onSpectate: () => Promise<void>;
  /** Start game early (host only) */
  onStartEarly: () => Promise<void>;
  /** Cancel the invite (host only) */
  onCancel: () => Promise<void>;
  /** Navigate to active game */
  onPlay?: (gameId: string, gameType: string) => void;
  /** Compact mode */
  compact?: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getGameInfo(gameType: string): { name: string; icon: string } {
  const metadata = GAME_METADATA[gameType as ExtendedGameType];
  return metadata
    ? { name: metadata.name, icon: metadata.icon }
    : { name: gameType, icon: "🎮" };
}

function getStatusInfo(
  status: string,
  slotsRemaining: number
): { text: string; color: string } {
  switch (status) {
    case "pending":
      return {
        text: slotsRemaining === 1 ? "1 spot left" : `${slotsRemaining} spots left`,
        color: "#FFA500",
      };
    case "filling":
      return { text: `${slotsRemaining} more needed`, color: "#FFA500" };
    case "ready":
      return { text: "Ready to start!", color: "#4CAF50" };
    case "active":
      return { text: "In Progress", color: "#2196F3" };
    case "completed":
      return { text: "Finished", color: "#9E9E9E" };
    case "expired":
      return { text: "Expired", color: "#F44336" };
    case "cancelled":
      return { text: "Cancelled", color: "#F44336" };
    default:
      return { text: status, color: "#9E9E9E" };
  }
}

// =============================================================================
// Component
// =============================================================================

export function UniversalInviteCard({
  invite,
  currentUserId,
  onJoin,
  onLeave,
  onSpectate,
  onStartEarly,
  onCancel,
  onPlay,
  compact = false,
}: UniversalInviteCardProps) {
  const theme = useTheme();
  const [loading, setLoading] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Computed State
  // -------------------------------------------------------------------------
  const isHost = invite.claimedSlots[0]?.playerId === currentUserId;
  const hasJoined = invite.claimedSlots.some((s) => s.playerId === currentUserId);
  const isSpectating = invite.spectators?.some((s) => s.userId === currentUserId) ?? false;
  const isFull = invite.claimedSlots.length >= invite.requiredPlayers;
  const slotsRemaining = invite.requiredPlayers - invite.claimedSlots.length;
  const isExpired = Date.now() > invite.expiresAt;

  // Get game metadata for min players check
  const metadata = GAME_METADATA[invite.gameType as ExtendedGameType];
  const minPlayers = metadata?.minPlayers ?? 2;

  // Action availability
  const canJoin =
    !hasJoined &&
    !isFull &&
    !isExpired &&
    ["pending", "filling"].includes(invite.status);
  const canLeave =
    hasJoined && !isHost && ["pending", "filling"].includes(invite.status);
  const canSpectate =
    !hasJoined &&
    !isSpectating &&
    invite.spectatingEnabled &&
    ["ready", "active"].includes(invite.status);
  const canStartEarly =
    isHost &&
    ["pending", "filling"].includes(invite.status) &&
    invite.claimedSlots.length >= minPlayers;
  const canCancel =
    isHost && ["pending", "filling", "ready"].includes(invite.status);
  const canPlay = hasJoined && invite.gameId && invite.status === "active";

  // Game & status info
  const { name: gameName, icon: gameIcon } = getGameInfo(invite.gameType);
  const statusInfo = getStatusInfo(invite.status, slotsRemaining);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------
  const handleAction = useCallback(
    async (actionName: string, action: () => Promise<void>) => {
      setLoading(actionName);
      try {
        await action();
      } catch (error) {
        console.error(`[UniversalInviteCard] ${actionName} failed:`, error);
      } finally {
        setLoading(null);
      }
    },
    []
  );

  // -------------------------------------------------------------------------
  // Compact Render
  // -------------------------------------------------------------------------
  if (compact) {
    return (
      <Card style={[styles.cardCompact, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.compactContent}>
          <Text style={styles.gameIconCompact}>{gameIcon}</Text>

          <View style={styles.compactInfo}>
            <Text style={[styles.gameNameCompact, { color: theme.colors.onSurface }]}>
              {gameName}
            </Text>
            <Text style={[styles.statusCompact, { color: statusInfo.color }]}>
              {invite.claimedSlots.length}/{invite.requiredPlayers} • {statusInfo.text}
            </Text>
          </View>

          <PlayerSlots
            slots={invite.claimedSlots}
            requiredPlayers={invite.requiredPlayers}
            maxPlayers={invite.maxPlayers}
            currentUserId={currentUserId}
            compact
          />

          {canJoin && (
            <Button
              mode="contained"
              compact
              onPress={() => handleAction("join", onJoin)}
              loading={loading === "join"}
              disabled={loading !== null}
            >
              Join
            </Button>
          )}

          {canPlay && onPlay && (
            <Button
              mode="contained"
              compact
              onPress={() => onPlay(invite.gameId!, invite.gameType)}
            >
              Play
            </Button>
          )}
        </View>
      </Card>
    );
  }

  // -------------------------------------------------------------------------
  // Full Render
  // -------------------------------------------------------------------------
  return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      <Card.Content>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.gameInfo}>
            <Text style={styles.gameIcon}>{gameIcon}</Text>
            <View>
              <Text style={[styles.gameName, { color: theme.colors.onSurface }]}>
                {gameName}
              </Text>
              <Text style={[styles.hostText, { color: theme.colors.onSurfaceVariant }]}>
                {isHost ? "You're the host" : `Hosted by ${invite.senderName}`}
              </Text>
            </View>
          </View>

          <Chip
            compact
            mode="flat"
            style={{ backgroundColor: statusInfo.color + "20" }}
            textStyle={{ color: statusInfo.color, fontSize: 11 }}
          >
            {statusInfo.text}
          </Chip>
        </View>

        {/* Queue Progress */}
        <View style={styles.queueSection}>
          <QueueProgressBar
            current={invite.claimedSlots.length}
            required={invite.requiredPlayers}
            max={invite.maxPlayers}
          />
        </View>

        {/* Player Slots */}
        <View style={styles.slotsSection}>
          <PlayerSlots
            slots={invite.claimedSlots}
            requiredPlayers={invite.requiredPlayers}
            maxPlayers={invite.maxPlayers}
            currentUserId={currentUserId}
          />
        </View>

        {/* Spectators */}
        {invite.spectators && invite.spectators.length > 0 && (
          <View style={styles.spectatorsRow}>
            <MaterialCommunityIcons
              name="eye"
              size={16}
              color={theme.colors.onSurfaceVariant}
            />
            <Text style={[styles.spectatorsText, { color: theme.colors.onSurfaceVariant }]}>
              {invite.spectators.length} watching
            </Text>
          </View>
        )}

        <Divider style={styles.divider} />

        {/* Actions */}
        <View style={styles.actions}>
          {canJoin && (
            <Button
              mode="contained"
              onPress={() => handleAction("join", onJoin)}
              loading={loading === "join"}
              disabled={loading !== null}
              style={styles.actionButton}
            >
              Join Game
            </Button>
          )}

          {canLeave && (
            <Button
              mode="outlined"
              onPress={() => handleAction("leave", onLeave)}
              loading={loading === "leave"}
              disabled={loading !== null}
              style={styles.actionButton}
            >
              Leave
            </Button>
          )}

          {canSpectate && (
            <Button
              mode="outlined"
              icon="eye"
              onPress={() => handleAction("spectate", onSpectate)}
              loading={loading === "spectate"}
              disabled={loading !== null}
              style={styles.actionButton}
            >
              Spectate
            </Button>
          )}

          {canPlay && onPlay && (
            <Button
              mode="contained"
              icon="play"
              onPress={() => onPlay(invite.gameId!, invite.gameType)}
              style={styles.actionButton}
            >
              Play Now
            </Button>
          )}

          {hasJoined && !canLeave && !canPlay && (
            <Text style={[styles.waitingText, { color: theme.colors.onSurfaceVariant }]}>
              Waiting for other players...
            </Text>
          )}

          {isSpectating && (
            <Text style={[styles.spectatingText, { color: theme.colors.primary }]}>
              👁 You're spectating
            </Text>
          )}
        </View>

        {/* Host Controls */}
        {isHost && ["pending", "filling", "ready"].includes(invite.status) && (
          <>
            <Divider style={styles.divider} />
            <View style={styles.hostControls}>
              <Text style={[styles.hostControlsLabel, { color: theme.colors.onSurfaceVariant }]}>
                Host Controls
              </Text>

              <View style={styles.hostActions}>
                {canStartEarly && (
                  <Button
                    mode="contained"
                    onPress={() => handleAction("start", onStartEarly)}
                    loading={loading === "start"}
                    disabled={loading !== null}
                    style={styles.hostButton}
                  >
                    Start Now ({invite.claimedSlots.length}/{minPlayers} min)
                  </Button>
                )}

                {!canStartEarly && ["pending", "filling"].includes(invite.status) && (
                  <Text style={[styles.minPlayersHint, { color: theme.colors.onSurfaceVariant }]}>
                    Need {minPlayers - invite.claimedSlots.length} more to start early
                  </Text>
                )}

                {canCancel && (
                  <Button
                    mode="outlined"
                    textColor={theme.colors.error}
                    onPress={() => handleAction("cancel", onCancel)}
                    loading={loading === "cancel"}
                    disabled={loading !== null}
                  >
                    Cancel Game
                  </Button>
                )}
              </View>
            </View>
          </>
        )}
      </Card.Content>
    </Card>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  card: {
    marginVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  cardCompact: {
    marginVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  compactContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  compactInfo: {
    flex: 1,
  },
  gameIconCompact: {
    fontSize: 24,
  },
  gameNameCompact: {
    fontSize: 14,
    fontWeight: "600",
  },
  statusCompact: {
    fontSize: 11,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  gameInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  gameIcon: {
    fontSize: 36,
  },
  gameName: {
    fontSize: 18,
    fontWeight: "600",
  },
  hostText: {
    fontSize: 12,
  },
  queueSection: {
    marginBottom: Spacing.md,
  },
  slotsSection: {
    marginBottom: Spacing.sm,
  },
  spectatorsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  spectatorsText: {
    fontSize: 12,
  },
  divider: {
    marginVertical: Spacing.sm,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    alignItems: "center",
  },
  actionButton: {
    minWidth: 100,
  },
  waitingText: {
    fontSize: 13,
    fontStyle: "italic",
  },
  spectatingText: {
    fontSize: 13,
    fontWeight: "500",
  },
  hostControls: {
    marginTop: Spacing.xs,
  },
  hostControlsLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  hostActions: {
    gap: Spacing.sm,
  },
  hostButton: {
    marginBottom: Spacing.xs,
  },
  minPlayersHint: {
    fontSize: 12,
    fontStyle: "italic",
    marginBottom: Spacing.sm,
  },
});

export default UniversalInviteCard;
```

---

## 4. Phase 3: Service Layer - Host Controls

### 4.1 Add to `src/services/gameInvites.ts`

**Add these TWO new functions. Location: after existing functions, before exports:**

```typescript
// =============================================================================
// HOST CONTROL FUNCTIONS (NEW)
// =============================================================================

import { createMatch } from "./turnBasedGames";
import type { TurnBasedGameType } from "@/types/games";

/**
 * Start a game early (host only)
 *
 * Allows the host to start the game when:
 * - Status is "pending" or "filling"
 * - At least minPlayers have joined (from GAME_METADATA)
 *
 * This function:
 * 1. Validates host permissions
 * 2. Checks minimum player count
 * 3. Creates the actual game match via turnBasedGames.createMatch()
 * 4. Updates invite status to "active" with gameId
 *
 * @param inviteId - The universal invite ID
 * @param hostId - The user ID of the host (must match first slot)
 * @returns Object with success status, gameId if successful, or error message
 */
export async function startGameEarly(
  inviteId: string,
  hostId: string,
): Promise<{ success: boolean; gameId?: string; error?: string }> {
  const inviteRef = doc(getDb(), COLLECTION_NAME, inviteId);

  try {
    const result = await runTransaction(getDb(), async (transaction) => {
      const inviteSnap = await transaction.get(inviteRef);

      if (!inviteSnap.exists()) {
        return { success: false, error: "Invite not found" };
      }

      const invite = inviteSnap.data() as UniversalGameInvite;

      // Validation: Must be host (first slot)
      if (invite.claimedSlots[0]?.playerId !== hostId) {
        return { success: false, error: "Only the host can start the game" };
      }

      // Validation: Must be in startable status
      if (!["pending", "filling"].includes(invite.status)) {
        return {
          success: false,
          error: `Cannot start - game is ${invite.status}`,
        };
      }

      // Validation: Check minimum players from GAME_METADATA
      const metadata = GAME_METADATA[invite.gameType as ExtendedGameType];
      if (!metadata) {
        return { success: false, error: "Unknown game type" };
      }

      if (invite.claimedSlots.length < metadata.minPlayers) {
        return {
          success: false,
          error: `Need at least ${metadata.minPlayers} players to start`,
        };
      }

      // Build player objects from claimed slots
      const player1 = {
        oderId: invite.claimedSlots[0].playerId,
        displayName: invite.claimedSlots[0].playerName,
        avatarUrl: invite.claimedSlots[0].playerAvatar,
        color: "white" as const,
      };
      const player2 = {
        userId: invite.claimedSlots[1].playerId,
        displayName: invite.claimedSlots[1].playerName,
        avatarUrl: invite.claimedSlots[1].playerAvatar,
        color: "black" as const,
      };

      // Create the actual game match
      const gameId = await createMatch(
        invite.gameType as TurnBasedGameType,
        player1,
        player2,
        {
          isRated: invite.settings?.isRated ?? false,
          chatEnabled: invite.settings?.chatEnabled ?? true,
          timeControl: invite.settings?.timeControl?.seconds,
          allowSpectators: invite.spectatingEnabled ?? false,
        },
      );

      // Update invite with game reference
      transaction.update(inviteRef, {
        status: "active" as UniversalInviteStatus,
        gameId,
        updatedAt: Date.now(),
        filledAt: Date.now(),
      });

      return { success: true, gameId };
    });

    console.log(`[GameInvites] Game started early: ${inviteId}`, result);
    return result;
  } catch (error) {
    console.error(`[GameInvites] Error starting game early:`, error);
    return { success: false, error: "Failed to start game" };
  }
}

/**
 * Cancel a universal game invite (host only)
 *
 * Sets invite status to "cancelled".
 * Can only be called by the host (first slot).
 * Can only cancel invites in pending/filling/ready status.
 *
 * @param inviteId - The universal invite ID
 * @param hostId - The user ID of the host (must match first slot)
 * @returns Object with success status or error message
 */
export async function cancelUniversalInvite(
  inviteId: string,
  hostId: string,
): Promise<{ success: boolean; error?: string }> {
  const inviteRef = doc(getDb(), COLLECTION_NAME, inviteId);

  try {
    const inviteSnap = await getDoc(inviteRef);

    if (!inviteSnap.exists()) {
      return { success: false, error: "Invite not found" };
    }

    const invite = inviteSnap.data() as UniversalGameInvite;

    // Validation: Must be host (first slot)
    if (invite.claimedSlots[0]?.playerId !== hostId) {
      return { success: false, error: "Only the host can cancel" };
    }

    // Validation: Must be in cancellable status
    if (!["pending", "filling", "ready"].includes(invite.status)) {
      return {
        success: false,
        error: `Cannot cancel - game is ${invite.status}`,
      };
    }

    // Update status to cancelled
    await updateDoc(inviteRef, {
      status: "cancelled" as UniversalInviteStatus,
      updatedAt: Date.now(),
    });

    console.log(`[GameInvites] Universal invite cancelled: ${inviteId}`);
    return { success: true };
  } catch (error) {
    console.error(`[GameInvites] Error cancelling invite:`, error);
    return { success: false, error: "Failed to cancel invite" };
  }
}
```

### 4.2 Update exports in `src/services/gameInvites.ts`

**Add to the exports at the end of file:**

```typescript
// At the very end of the file, update the named exports:
export {
  // Existing exports...
  sendUniversalInvite,
  claimInviteSlot,
  unclaimInviteSlot,
  joinAsSpectator,

  // NEW Host Controls
  startGameEarly,
  cancelUniversalInvite,
};
```

---

## 5. Phase 4: Update ChatGameInvites Integration

### 5.1 Update `src/components/chat/ChatGameInvites.tsx`

**Add startGameEarly handler and update UniversalInviteCard usage:**

```typescript
// =============================================================================
// STEP 1: Add import at top of file
// =============================================================================
import { startGameEarly, cancelUniversalInvite } from "@/services/gameInvites";

// =============================================================================
// STEP 2: Add handlers inside component (after existing handlers)
// =============================================================================

const handleStartEarly = useCallback(
  async (invite: UniversalGameInvite) => {
    if (!currentUserId) return;

    const result = await startGameEarly(invite.id, currentUserId);

    if (result.success && result.gameId) {
      onNavigateToGame?.(result.gameId, invite.gameType);
    } else if (result.error) {
      console.error("[ChatGameInvites] Start early failed:", result.error);
      // Optionally show error toast
    }
  },
  [currentUserId, onNavigateToGame]
);

const handleCancelInvite = useCallback(
  async (invite: UniversalGameInvite) => {
    if (!currentUserId) return;

    const result = await cancelUniversalInvite(invite.id, currentUserId);

    if (!result.success) {
      console.error("[ChatGameInvites] Cancel failed:", result.error);
      // Optionally show error toast
    }
    // Invite will update via subscription
  },
  [currentUserId]
);

// =============================================================================
// STEP 3: Update UniversalInviteCard usage to include all props
// =============================================================================

// In the render/map section where UniversalInviteCard is rendered:
<UniversalInviteCard
  key={invite.id}
  invite={invite}
  currentUserId={currentUserId}
  onJoin={() => handleJoin(invite)}
  onLeave={() => handleLeave(invite)}
  onSpectate={() => handleSpectate(invite)}
  onStartEarly={() => handleStartEarly(invite)}   // ADD THIS
  onCancel={() => handleCancelInvite(invite)}     // ADD THIS
  onPlay={handlePlay}
  compact={compact}
/>
```

---

## 6. Files to Delete (Deprecation)

**After implementing and testing all phases, DELETE these files/exports:**

```
# DELETE ENTIRE FILE (legacy component, replaced by UniversalInviteCard)
src/components/GameInviteCard.tsx

# In src/services/gameInvites.ts, mark as @deprecated then later remove:
sendGameInvite()       // Use sendUniversalInvite instead

# In src/services/turnBasedGames.ts, DELETE these duplicated functions:
getPendingInvites()    // Use gameInvites.getPlayPageInvites
subscribeToInvites()   // Use gameInvites.subscribeToPlayPageInvites
respondToInvite()      // Use gameInvites.claimInviteSlot
```

---

## 7. Update Component Exports

### 7.1 Update `src/components/games/index.ts`

**Add new exports:**

```typescript
// =============================================================================
// Queue & Invite Components (NEW/UPDATED)
// =============================================================================

export {
  QueueProgressBar,
  type QueueProgressBarProps,
} from "./QueueProgressBar";
export { PlayerSlots, type PlayerSlotsProps } from "./PlayerSlots";
export {
  UniversalInviteCard,
  type UniversalInviteCardProps,
} from "./UniversalInviteCard";
export { GamePickerModal, type GamePickerModalProps } from "./GamePickerModal";
```

---

## 8. Implementation Checklist

Use this checklist during implementation:

### Pre-Implementation

- [ ] Read existing `src/types/games.ts` to verify GAME_METADATA structure
- [ ] Read existing `src/services/gameInvites.ts` to find exact location for new functions
- [ ] Read existing `src/components/games/UniversalInviteCard.tsx` to understand current structure

### Phase 1: Config & Game Picker

- [ ] Create `src/config/gameCategories.ts`
- [ ] Create `src/components/games/GamePickerModal.tsx`
- [ ] Update `src/screens/chat/ChatScreen.tsx` with picker
- [ ] Update `src/screens/groups/GroupChatScreen.tsx` with picker
- [ ] **TEST**: Open picker from chat, select games

### Phase 2: Queue Display

- [ ] Create `src/components/games/QueueProgressBar.tsx`
- [ ] Overhaul `src/components/games/PlayerSlots.tsx`
- [ ] Overhaul `src/components/games/UniversalInviteCard.tsx`
- [ ] Update `src/components/games/index.ts` exports
- [ ] **TEST**: Queue progress displays correctly, animations work

### Phase 3: Host Controls

- [ ] Add `startGameEarly()` to `src/services/gameInvites.ts`
- [ ] Add `cancelUniversalInvite()` to `src/services/gameInvites.ts`
- [ ] Update exports in gameInvites.ts
- [ ] **TEST**: Host can start early and cancel

### Phase 4: Integration

- [ ] Update `src/components/chat/ChatGameInvites.tsx` with startEarly
- [ ] **TEST**: Full flow from picker to game start

### Phase 5: Cleanup (AFTER all testing passes)

- [ ] Delete `src/components/GameInviteCard.tsx`
- [ ] Mark legacy functions as @deprecated
- [ ] Update GamesHubScreen to use CATEGORY_CONFIG
- [ ] Remove debug console.logs from removed code

---

## 9. Error Handling Strategy

All service functions return typed result objects:

```typescript
type ServiceResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };
```

**UI components should:**

1. Show loading states during async operations
2. Display errors via Alert or Toast (not console.log only)
3. Log errors to console with `[ComponentName]` prefix for debugging

---

## 10. Testing Notes

### Manual Test Cases

| Test              | Steps                       | Expected                      |
| ----------------- | --------------------------- | ----------------------------- |
| Picker opens      | Tap game button in chat     | Modal appears with categories |
| Category switch   | Tap different category tabs | Games list updates            |
| Single-player     | Select Flappy Snap          | Navigates to game screen      |
| Multiplayer DM    | Select Chess                | Invite appears in chat        |
| Multiplayer Group | Select Crazy Eights         | Invite visible to all members |
| Join queue        | Tap Join on invite          | Player added to slots         |
| Leave queue       | Tap Leave on invite         | Player removed from slots     |
| Queue progress    | Multiple players join       | Progress bar animates         |
| Host start early  | As host, tap Start Now      | Game starts, navigates        |
| Host cancel       | As host, tap Cancel         | Invite status = cancelled     |

### Edge Cases to Test

- [ ] Try to join full queue (should be disabled)
- [ ] Try to leave as host (button should not appear, only cancel)
- [ ] Try to start with insufficient players (button should be disabled)
- [ ] Expired invite handling
- [ ] Network failure during join/leave

---

## Appendix A: Visual Mockups

### A.1 Game Picker Modal

```
┌──────────────────────────────────┐
│  Pick a Game                   ✕ │
├──────────────────────────────────┤
│ ⚡Action │ 🧩Puzzle │ 👥Multi │ 📅Daily│
├──────────────────────────────────┤
│         Play with friends        │
├──────────────────────────────────┤
│ ┌────────────────────────────┐   │
│ │ ♟️ Chess                    >  │
│ │ Classic strategy game         │
│ │                   2 players   │
│ └────────────────────────────┘   │
│ ┌────────────────────────────┐   │
│ │ 🎴 Crazy Eights            >  │
│ │ Match cards by suit!          │
│ │                 2-4 players   │
│ └────────────────────────────┘   │
│ ┌────────────────────────────┐   │
│ │ 🎱 8-Ball Pool    [SOON]   >  │
│ │ Sink your balls!              │
│ └────────────────────────────┘   │
└──────────────────────────────────┘
```

### A.2 Queue Display in Invite Card

```
┌──────────────────────────────────┐
│ 🎴 Crazy Eights       [ 2 left ] │
│ Hosted by Alice                  │
├──────────────────────────────────┤
│ 2/4 queued                       │
│ ██████████░░░░░░░░░░             │
│                                  │
│ [👤Alice] [👤Bob] [??] [??]     │
│   👑                             │
├──────────────────────────────────┤
│ [ Join Game ]    [ Spectate ]    │
└──────────────────────────────────┘
```

### A.3 Host Controls

```
┌──────────────────────────────────┐
│ 🎴 Crazy Eights       [ Ready! ] │
│ You're the host                  │
├──────────────────────────────────┤
│ 3/4 queued                       │
│ ██████████████████░░░░░          │
│                                  │
│ [👤You ] [👤Bob] [👤Carol] [??] │
│   👑                             │
├──────────────────────────────────┤
│ ─── Host Controls ───            │
│ [ ▶ Start Now (3/2 min) ]        │
│ [ ✕ Cancel Game ]                │
└──────────────────────────────────┘
```

---

## Appendix B: Type Reference

### B.1 UniversalGameInvite (from turnBased.ts)

```typescript
interface UniversalGameInvite {
  id: string;
  gameType: TurnBasedGameType | RealTimeGameType;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  context: "dm" | "group";
  conversationId: string;
  conversationName?: string;
  targetType: "universal" | "specific";
  recipientId?: string;
  recipientName?: string;
  eligibleUserIds: string[];
  requiredPlayers: number;
  maxPlayers: number;
  claimedSlots: PlayerSlot[];
  spectators: Spectator[];
  spectatingEnabled: boolean;
  status: UniversalInviteStatus;
  gameId?: string;
  settings: InviteSettings;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  filledAt?: number;
}

interface PlayerSlot {
  playerId: string;
  playerName: string;
  playerAvatar?: string;
  claimedAt: number;
  isHost: boolean;
}

type UniversalInviteStatus =
  | "pending" // Created, waiting for first joiner
  | "filling" // At least one player joined, waiting for more
  | "ready" // All required slots filled, can start
  | "active" // Game in progress
  | "completed" // Game finished
  | "declined" // Recipient declined (DM only)
  | "expired" // Time ran out
  | "cancelled"; // Host cancelled
```

---

**END OF IMPLEMENTATION PLAN**

