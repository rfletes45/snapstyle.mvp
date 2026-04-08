/**
 * Battleship — Ship Carousel (Setup Phase)
 *
 * Modern horizontal carousel of ship cards for fleet placement:
 * - Each card shows: name, length pips, placed/unplaced state
 * - Selected state with highlighted border
 * - Placed state with checkmark overlay
 *
 * @module gamesV4/screens/battleship/ShipCarousel
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import type { ShipDef } from "../../adapters/battleship/battleshipTypes";
import type { BattleshipTokens } from "./battleshipTheme";
import { BS } from "./battleshipTheme";

// =============================================================================
// Types
// =============================================================================

interface ShipCarouselProps {
  fleet: ShipDef[];
  selectedShipId: string | null;
  placedShipIds: Set<string>;
  onSelectShip: (shipId: string) => void;
  tokens: BattleshipTokens;
  disabled?: boolean;
}

// =============================================================================
// Ship Card
// =============================================================================

interface ShipCardProps {
  ship: ShipDef;
  isSelected: boolean;
  isPlaced: boolean;
  onPress: () => void;
  tokens: BattleshipTokens;
  disabled?: boolean;
}

const ShipCard = React.memo(function ShipCard({
  ship,
  isSelected,
  isPlaced,
  onPress,
  tokens,
  disabled,
}: ShipCardProps) {
  const borderColor = isSelected
    ? tokens.setupCardSelectedBorder
    : tokens.setupCardBorder;
  const bg = isPlaced ? tokens.setupCardPlacedBg : tokens.setupCardBg;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      layout={LinearTransition}
    >
      <TouchableOpacity
        style={[
          styles.card,
          {
            borderColor,
            backgroundColor: bg,
            borderWidth: isSelected ? 2.5 : 1.5,
            opacity: isPlaced && !isSelected ? 0.65 : 1,
          },
        ]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${ship.name}, size ${ship.size}${isPlaced ? ", placed" : ""}`}
        accessibilityState={{ selected: isSelected }}
      >
        {/* Ship name */}
        <Text
          style={[
            styles.shipName,
            {
              color: isSelected ? tokens.tabActiveTint : tokens.textPrimary,
            },
          ]}
          numberOfLines={1}
        >
          {ship.name}
        </Text>

        {/* Size pips */}
        <View style={styles.pipRow}>
          {Array.from({ length: ship.size }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.pip,
                {
                  backgroundColor: isPlaced
                    ? tokens.statusSuccess
                    : isSelected
                      ? tokens.tabActiveTint
                      : tokens.cellShip,
                },
              ]}
            />
          ))}
        </View>

        {/* Placed checkmark */}
        {isPlaced && (
          <View style={styles.placedBadge}>
            <MaterialCommunityIcons
              name="check-circle"
              size={16}
              color={tokens.statusSuccess}
            />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
});

// =============================================================================
// ShipCarousel
// =============================================================================

export function ShipCarousel({
  fleet,
  selectedShipId,
  placedShipIds,
  onSelectShip,
  tokens,
  disabled,
}: ShipCarouselProps) {
  const renderItem = useCallback(
    ({ item }: { item: ShipDef }) => (
      <ShipCard
        ship={item}
        isSelected={selectedShipId === item.shipId}
        isPlaced={placedShipIds.has(item.shipId)}
        onPress={() => onSelectShip(item.shipId)}
        tokens={tokens}
        disabled={disabled}
      />
    ),
    [selectedShipId, placedShipIds, onSelectShip, tokens, disabled],
  );

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { color: tokens.textSecondary }]}>
        Ships
      </Text>
      <FlatList
        data={fleet}
        keyExtractor={(item) => item.shipId}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

// =============================================================================
// FleetStatus — Battle-phase ship health pips
// =============================================================================

interface FleetStatusProps {
  fleet: ShipDef[];
  /** Map of shipId → remaining health (hits left) */
  shipHealth: Record<string, number>;
  /** Set of shipIds that are sunk */
  sunkShips: Set<string>;
  tokens: BattleshipTokens;
}

export function FleetStatus({
  fleet,
  shipHealth,
  sunkShips,
  tokens,
}: FleetStatusProps) {
  return (
    <View style={styles.fleetStatusContainer}>
      <Text style={[styles.sectionTitle, { color: tokens.textSecondary }]}>
        Fleet Status
      </Text>
      {fleet.map((ship) => {
        const isSunk = sunkShips.has(ship.shipId);
        const hp = shipHealth[ship.shipId] ?? ship.size;
        return (
          <View
            key={ship.shipId}
            style={[styles.fleetRow, isSunk && { opacity: 0.45 }]}
          >
            <Text
              style={[
                styles.fleetShipName,
                {
                  color: isSunk ? tokens.markerSunk : tokens.textPrimary,
                  textDecorationLine: isSunk ? "line-through" : "none",
                },
              ]}
              numberOfLines={1}
            >
              {ship.name}
            </Text>
            <View style={styles.healthPips}>
              {Array.from({ length: ship.size }).map((_, i) => {
                const alive = i < hp;
                return (
                  <View
                    key={i}
                    style={[
                      styles.healthPip,
                      {
                        backgroundColor: isSunk
                          ? tokens.markerSunk
                          : alive
                            ? tokens.statusSuccess
                            : tokens.markerHit,
                      },
                    ]}
                  />
                );
              })}
            </View>
            <Text
              style={[
                styles.healthLabel,
                {
                  color: isSunk ? tokens.markerSunk : tokens.textMuted,
                },
              ]}
            >
              {isSunk ? "SUNK" : `${hp}/${ship.size}`}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// =============================================================================
// StatBadge — Small stat display
// =============================================================================

interface StatBadgeProps {
  label: string;
  value: string | number;
  color: string;
  tokens: BattleshipTokens;
}

export function StatBadge({ label, value, color, tokens }: StatBadgeProps) {
  return (
    <View style={styles.statBadge}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: tokens.textMuted }]}>
        {label}
      </Text>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  // Carousel
  container: {
    marginTop: BS.spacing.md,
    paddingHorizontal: BS.spacing.lg,
  },
  sectionTitle: {
    fontSize: BS.fonts.sm,
    fontWeight: BS.fontWeights.semibold,
    marginBottom: BS.spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  listContent: {
    gap: BS.spacing.sm,
    paddingRight: BS.spacing.lg,
  },
  card: {
    borderRadius: BS.radius.md,
    padding: BS.spacing.md,
    alignItems: "center",
    minWidth: 76,
    position: "relative",
  },
  shipName: {
    fontSize: BS.fonts.xs,
    fontWeight: BS.fontWeights.semibold,
    marginBottom: BS.spacing.xs,
  },
  pipRow: {
    flexDirection: "row",
    gap: 3,
  },
  pip: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
  placedBadge: {
    position: "absolute",
    top: -4,
    right: -4,
  },

  // Fleet Status
  fleetStatusContainer: {
    paddingHorizontal: BS.spacing.lg,
    paddingVertical: BS.spacing.md,
  },
  fleetRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: BS.spacing.xs,
    gap: BS.spacing.sm,
  },
  fleetShipName: {
    width: 80,
    fontSize: BS.fonts.sm,
    fontWeight: BS.fontWeights.medium,
  },
  healthPips: {
    flex: 1,
    flexDirection: "row",
    gap: 3,
  },
  healthPip: {
    width: 16,
    height: 8,
    borderRadius: 2,
  },
  healthLabel: {
    fontSize: BS.fonts.xs,
    fontWeight: BS.fontWeights.bold,
    width: 40,
    textAlign: "right",
  },

  // StatBadge
  statBadge: {
    alignItems: "center",
    minWidth: 48,
  },
  statValue: {
    fontSize: BS.fonts.xl,
    fontWeight: BS.fontWeights.bold,
  },
  statLabel: {
    fontSize: BS.fonts.xs,
    marginTop: 2,
  },
});
