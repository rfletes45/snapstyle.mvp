/**
 * Battleship — Event Ribbon + Battle Log Drawer
 *
 * EventRibbon: A compact, always-visible bar showing the last event.
 *              Tappable to expand the Battle Log Drawer.
 *
 * BattleLogDrawer: A modal with scrollable event history.
 *
 * @module gamesV4/screens/battleship/EventRibbon
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown, Layout } from "react-native-reanimated";
import type { BattleshipTokens } from "./battleshipTheme";
import { BS } from "./battleshipTheme";

// =============================================================================
// Types
// =============================================================================

export interface BattleLogEntry {
  id: string;
  text: string;
  type: "hit" | "miss" | "sunk" | "info" | "phase";
  turn?: number;
}

// =============================================================================
// EventRibbon
// =============================================================================

export interface EventRibbonProps {
  lastEvent: string | null;
  eventType?: "hit" | "miss" | "sunk" | "info" | "phase";
  tokens: BattleshipTokens;
  /** Full event log for the drawer */
  log?: BattleLogEntry[];
}

export function EventRibbon({
  lastEvent,
  eventType = "info",
  tokens,
  log,
}: EventRibbonProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const ribbonBg = useMemo(() => {
    switch (eventType) {
      case "hit":
        return tokens.ribbonHitBg;
      case "miss":
        return tokens.ribbonMissBg;
      case "sunk":
        return tokens.ribbonSunkBg;
      default:
        return tokens.ribbonBg;
    }
  }, [eventType, tokens]);

  const iconName = useMemo(() => {
    switch (eventType) {
      case "hit":
        return "explosion";
      case "miss":
        return "water";
      case "sunk":
        return "skull-crossbones-outline";
      case "phase":
        return "flag-checkered";
      default:
        return "information-outline";
    }
  }, [eventType]);

  const iconColor = useMemo(() => {
    switch (eventType) {
      case "hit":
        return tokens.markerHit;
      case "sunk":
        return tokens.markerSunk;
      case "miss":
        return tokens.markerMiss;
      default:
        return tokens.ribbonText;
    }
  }, [eventType, tokens]);

  if (!lastEvent) return null;

  return (
    <>
      <Animated.View entering={FadeIn.duration(200)} layout={Layout}>
        <TouchableOpacity
          style={[styles.ribbon, { backgroundColor: ribbonBg }]}
          onPress={() => log && log.length > 0 && setDrawerOpen(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Event: ${lastEvent}. Tap to view battle log.`}
        >
          <MaterialCommunityIcons
            name={iconName as any}
            size={16}
            color={iconColor}
          />
          <Text
            style={[styles.ribbonText, { color: tokens.ribbonText }]}
            numberOfLines={1}
          >
            {lastEvent}
          </Text>
          {log && log.length > 1 && (
            <MaterialCommunityIcons
              name="chevron-down"
              size={16}
              color={tokens.textMuted}
            />
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Battle Log Drawer */}
      {log && (
        <BattleLogDrawer
          visible={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          log={log}
          tokens={tokens}
        />
      )}
    </>
  );
}

// =============================================================================
// BattleLogDrawer — Modal with scrollable event history
// =============================================================================

interface BattleLogDrawerProps {
  visible: boolean;
  onClose: () => void;
  log: BattleLogEntry[];
  tokens: BattleshipTokens;
}

function BattleLogDrawer({
  visible,
  onClose,
  log,
  tokens,
}: BattleLogDrawerProps) {
  const renderItem = useCallback(
    ({ item, index }: { item: BattleLogEntry; index: number }) => {
      const entryBg =
        item.type === "hit"
          ? tokens.ribbonHitBg
          : item.type === "sunk"
            ? tokens.ribbonSunkBg
            : item.type === "miss"
              ? tokens.ribbonMissBg
              : "transparent";

      const iconName =
        item.type === "hit"
          ? "explosion"
          : item.type === "sunk"
            ? "skull-crossbones-outline"
            : item.type === "miss"
              ? "water"
              : item.type === "phase"
                ? "flag-checkered"
                : "circle-small";

      return (
        <Animated.View
          entering={FadeInDown.delay(index * 30).duration(200)}
          style={[styles.logEntry, { backgroundColor: entryBg }]}
        >
          <MaterialCommunityIcons
            name={iconName as any}
            size={14}
            color={tokens.ribbonText}
          />
          <Text
            style={[styles.logEntryText, { color: tokens.textPrimary }]}
            numberOfLines={2}
          >
            {item.text}
          </Text>
          {item.turn !== undefined && (
            <Text style={[styles.logTurnLabel, { color: tokens.textMuted }]}>
              T{item.turn}
            </Text>
          )}
        </Animated.View>
      );
    },
    [tokens],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.drawerOverlay} onPress={onClose}>
        <Pressable
          style={[
            styles.drawerContainer,
            { backgroundColor: tokens.surfacePrimary },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <View style={styles.drawerHandle}>
            <View
              style={[
                styles.drawerHandleBar,
                { backgroundColor: tokens.textMuted },
              ]}
            />
          </View>

          {/* Header */}
          <View style={styles.drawerHeader}>
            <Text style={[styles.drawerTitle, { color: tokens.textPrimary }]}>
              Battle Log
            </Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={tokens.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Event List */}
          <FlatList
            data={log}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.logList}
            showsVerticalScrollIndicator={false}
            inverted
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
  // Ribbon
  ribbon: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: BS.spacing.sm,
    paddingHorizontal: BS.spacing.md,
    marginHorizontal: BS.spacing.lg,
    marginVertical: BS.spacing.xs,
    borderRadius: BS.radius.sm,
    gap: BS.spacing.sm,
    minHeight: BS.ribbonHeight,
  },
  ribbonText: {
    flex: 1,
    fontSize: BS.fonts.sm,
    fontWeight: BS.fontWeights.semibold,
  },

  // Drawer
  drawerOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  drawerContainer: {
    maxHeight: "60%",
    borderTopLeftRadius: BS.radius.xl,
    borderTopRightRadius: BS.radius.xl,
    paddingBottom: BS.spacing.xl,
  },
  drawerHandle: {
    alignItems: "center",
    paddingVertical: BS.spacing.sm,
  },
  drawerHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.4,
  },
  drawerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: BS.spacing.lg,
    paddingBottom: BS.spacing.md,
  },
  drawerTitle: {
    fontSize: BS.fonts.lg,
    fontWeight: BS.fontWeights.bold,
  },
  logList: {
    paddingHorizontal: BS.spacing.lg,
    gap: BS.spacing.xs,
  },
  logEntry: {
    flexDirection: "row",
    alignItems: "center",
    gap: BS.spacing.sm,
    paddingVertical: BS.spacing.sm,
    paddingHorizontal: BS.spacing.md,
    borderRadius: BS.radius.sm,
  },
  logEntryText: {
    flex: 1,
    fontSize: BS.fonts.sm,
  },
  logTurnLabel: {
    fontSize: BS.fonts.xs,
    fontWeight: BS.fontWeights.medium,
  },
});
