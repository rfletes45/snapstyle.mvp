/**
 * GameFilterBar Component
 *
 * Horizontal filter bar with:
 * - Tab filters (All, Your Turn, Waiting, Invites)
 * - Game type chips for filtering by specific games
 * - Badge counts on each tab
 *
 * @see Phase 2 of GAME_SYSTEM_OVERHAUL_PLAN
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Chip, Text, useTheme } from "react-native-paper";

import {
  GameFilters,
  GameFilterTab,
  getFilterTabConfigs,
} from "@/types/gameFilters";
import { ExtendedGameType, GAME_METADATA } from "@/types/games";
import { TurnBasedGameType } from "@/types/turnBased";
import { BorderRadius, Spacing } from "../../../../constants/theme";

// =============================================================================
// Types
// =============================================================================

export interface GameFilterBarProps {
  /** Current filter configuration */
  filters: GameFilters;
  /** Called when filters change */
  onFiltersChange: (filters: GameFilters) => void;
  /** Count of games where it's your turn */
  yourTurnCount: number;
  /** Count of games where it's opponent's turn */
  theirTurnCount: number;
  /** Count of pending invites */
  invitesCount: number;
  /** Available game types to filter by */
  availableGameTypes?: TurnBasedGameType[];
}

// =============================================================================
// Constants
// =============================================================================

const MULTIPLAYER_GAMES: TurnBasedGameType[] = [
  "tic_tac_toe",
  "checkers",
  "chess",
  "crazy_eights",
];

// =============================================================================
// Component
// =============================================================================

export function GameFilterBar({
  filters,
  onFiltersChange,
  yourTurnCount,
  theirTurnCount,
  invitesCount,
  availableGameTypes = MULTIPLAYER_GAMES,
}: GameFilterBarProps) {
  const theme = useTheme();
  const tabConfigs = getFilterTabConfigs(
    yourTurnCount,
    theirTurnCount,
    invitesCount,
  );

  const handleTabChange = useCallback(
    (tab: GameFilterTab) => {
      onFiltersChange({ ...filters, tab });
    },
    [filters, onFiltersChange],
  );

  const handleGameTypeToggle = useCallback(
    (gameType: TurnBasedGameType) => {
      const currentTypes = filters.gameTypes;
      const isSelected = currentTypes.includes(gameType);

      if (isSelected) {
        // Remove from filter
        onFiltersChange({
          ...filters,
          gameTypes: currentTypes.filter((t) => t !== gameType),
        });
      } else {
        // Add to filter
        onFiltersChange({
          ...filters,
          gameTypes: [...currentTypes, gameType],
        });
      }
    },
    [filters, onFiltersChange],
  );

  const handleClearGameTypes = useCallback(() => {
    onFiltersChange({ ...filters, gameTypes: [] });
  }, [filters, onFiltersChange]);

  return (
    <View style={styles.container}>
      {/* Tab Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
      >
        {tabConfigs.map((tab) => {
          const isSelected = filters.tab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tab,
                { backgroundColor: theme.colors.surfaceVariant },
                isSelected && { backgroundColor: theme.colors.primary },
              ]}
              onPress={() => handleTabChange(tab.id)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name={tab.icon as any}
                size={18}
                color={isSelected ? "#FFFFFF" : theme.colors.onSurfaceVariant}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: theme.colors.onSurfaceVariant },
                  isSelected && { color: "#FFFFFF" },
                ]}
              >
                {tab.label}
              </Text>
              {tab.count !== undefined && tab.count > 0 && (
                <View
                  style={[
                    styles.tabBadge,
                    {
                      backgroundColor: isSelected
                        ? "rgba(255,255,255,0.3)"
                        : theme.colors.primary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabBadgeText,
                      { color: isSelected ? "#FFFFFF" : "#FFFFFF" },
                    ]}
                  >
                    {tab.count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Game Type Chips */}
      {availableGameTypes.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsContainer}
          contentContainerStyle={styles.chipsContent}
        >
          {/* Clear All Button (when filters active) */}
          {filters.gameTypes.length > 0 && (
            <Chip
              mode="flat"
              icon="close"
              onPress={handleClearGameTypes}
              style={[
                styles.chip,
                { backgroundColor: theme.colors.errorContainer },
              ]}
              textStyle={{ color: theme.colors.onErrorContainer, fontSize: 12 }}
            >
              Clear
            </Chip>
          )}

          {/* Game Type Chips */}
          {availableGameTypes.map((gameType) => {
            const metadata = GAME_METADATA[gameType as ExtendedGameType];
            const isSelected = filters.gameTypes.includes(gameType);

            if (!metadata) return null;

            return (
              <Chip
                key={gameType}
                mode="outlined"
                selected={isSelected}
                onPress={() => handleGameTypeToggle(gameType)}
                style={[
                  styles.chip,
                  isSelected && {
                    backgroundColor: theme.colors.primaryContainer,
                  },
                ]}
                textStyle={{
                  color: isSelected
                    ? theme.colors.onPrimaryContainer
                    : theme.colors.onSurfaceVariant,
                  fontSize: 12,
                }}
                icon={() => (
                  <Text style={styles.chipIcon}>{metadata.icon}</Text>
                )}
              >
                {metadata.shortName}
              </Chip>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// =============================================================================
// Minimal Filter Bar (just tabs)
// =============================================================================

export interface MinimalFilterBarProps {
  /** Currently selected tab */
  selectedTab: GameFilterTab;
  /** Called when tab changes */
  onTabChange: (tab: GameFilterTab) => void;
  /** Count of games where it's your turn */
  yourTurnCount: number;
  /** Count of games where it's opponent's turn */
  theirTurnCount: number;
  /** Count of pending invites */
  invitesCount: number;
}

export function MinimalFilterBar({
  selectedTab,
  onTabChange,
  yourTurnCount,
  theirTurnCount,
  invitesCount,
}: MinimalFilterBarProps) {
  const theme = useTheme();
  const tabConfigs = getFilterTabConfigs(
    yourTurnCount,
    theirTurnCount,
    invitesCount,
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.minimalContainer}
      contentContainerStyle={styles.tabsContent}
    >
      {tabConfigs.map((tab) => {
        const isSelected = selectedTab === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.minimalTab,
              { borderBottomColor: "transparent" },
              isSelected && { borderBottomColor: theme.colors.primary },
            ]}
            onPress={() => onTabChange(tab.id)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.minimalTabLabel,
                { color: theme.colors.onSurfaceVariant },
                isSelected && {
                  color: theme.colors.primary,
                  fontWeight: "600",
                },
              ]}
            >
              {tab.label}
            </Text>
            {tab.count !== undefined && tab.count > 0 && (
              <View
                style={[
                  styles.minimalBadge,
                  {
                    backgroundColor: isSelected
                      ? theme.colors.primary
                      : theme.colors.surfaceVariant,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.minimalBadgeText,
                    {
                      color: isSelected
                        ? "#FFFFFF"
                        : theme.colors.onSurfaceVariant,
                    },
                  ]}
                >
                  {tab.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  // Tab styles
  tabsContainer: {
    flexGrow: 0,
  },
  tabsContent: {
    paddingHorizontal: Spacing.xs,
    gap: Spacing.sm,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  tabBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
    marginLeft: 4,
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: "bold",
  },
  // Chip styles
  chipsContainer: {
    flexGrow: 0,
    marginTop: Spacing.sm,
  },
  chipsContent: {
    paddingHorizontal: Spacing.xs,
    gap: Spacing.xs,
  },
  chip: {
    height: 32,
  },
  chipIcon: {
    fontSize: 14,
  },
  // Minimal tab styles
  minimalContainer: {
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  minimalTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 2,
    gap: Spacing.xs,
  },
  minimalTabLabel: {
    fontSize: 14,
  },
  minimalBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
  },
  minimalBadgeText: {
    fontSize: 10,
    fontWeight: "bold",
  },
});
