/**
 * ExpandedPanel — collapsible detail panel below the Games Profile Header
 *
 * Shows claimables summary, mini stats, equipped cosmetics row,
 * and active boosts.
 *
 * On mobile this renders inline (push-down); the parent header can wrap it
 * in a bottom-sheet if desired.
 *
 * @module components/games/ExpandedPanel
 */

import { BorderRadius, Spacing } from "@/constants/theme";
import type {
  ActiveBoost,
  EquippedDecor,
  MiniStats,
} from "@/types/playerSummary";
import { DEFAULT_MINI_STATS } from "@/types/playerSummary";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

// =============================================================================
// Props
// =============================================================================

export interface ExpandedPanelProps {
  /** Total claimable items (tasks + achievements, etc.) */
  claimableCount: number;
  /** Callback when "Claim All" is tapped */
  onClaimAll?: () => void;
  /** Mini game stats */
  miniStats?: MiniStats;
  /** Equipped cosmetics summary */
  equippedDecor?: EquippedDecor;
  /** Navigate to cosmetics editor */
  onEditCosmetics?: () => void;
  /** Active boost list */
  activeBoosts?: ActiveBoost[];
}

// =============================================================================
// Helpers
// =============================================================================

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

// Decoration slot labels for the cosmetics row
const DECOR_SLOTS: { key: keyof EquippedDecor; label: string; icon: string }[] =
  [
    { key: "frameId", label: "Frame", icon: "image-frame" },
    { key: "auraId", label: "Aura", icon: "blur-radial" },
    { key: "badgeId", label: "Badge", icon: "shield-star" },
    { key: "overlayId", label: "Overlay", icon: "sticker-emoji" },
    { key: "backplateId", label: "Plate", icon: "card" },
  ];

// =============================================================================
// Component
// =============================================================================

function ExpandedPanelBase({
  claimableCount,
  onClaimAll,
  miniStats = DEFAULT_MINI_STATS,
  equippedDecor,
  onEditCosmetics,
  activeBoosts = [],
}: ExpandedPanelProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: theme.colors.surfaceVariant,
          borderColor: theme.colors.outlineVariant,
        },
      ]}
    >
      {/* ---- Claimables ---- */}
      {claimableCount > 0 && (
        <View style={styles.row}>
          <MaterialCommunityIcons
            name="gift"
            size={16}
            color={theme.colors.primary}
          />
          <Text
            style={[styles.rowLabel, { color: theme.colors.onSurface }]}
            numberOfLines={1}
          >
            {claimableCount} reward{claimableCount > 1 ? "s" : ""} available
          </Text>
          <TouchableOpacity
            style={[styles.claimBtn, { backgroundColor: theme.colors.primary }]}
            onPress={onClaimAll}
            activeOpacity={0.7}
          >
            <Text
              style={[styles.claimBtnText, { color: theme.colors.onPrimary }]}
            >
              Claim All
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ---- Mini Stats ---- */}
      <View style={styles.statsRow}>
        <StatPill
          icon="sword-cross"
          value={`${miniStats.matchesToday}`}
          label="Today"
        />
        <StatPill
          icon="trophy"
          value={formatPercent(miniStats.winRate)}
          label="Win %"
        />
        <StatPill
          icon="timer-outline"
          value={formatTime(miniStats.totalTimePlayed)}
          label="Played"
        />
        <StatPill
          icon="fire"
          value={`${miniStats.currentStreak}`}
          label="Streak"
        />
      </View>

      {/* ---- Equipped Cosmetics ---- */}
      <View style={styles.cosmeticsSection}>
        <View style={styles.cosmeticsHeader}>
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            Equipped
          </Text>
          {onEditCosmetics && (
            <TouchableOpacity onPress={onEditCosmetics} activeOpacity={0.7}>
              <Text style={[styles.editLink, { color: theme.colors.primary }]}>
                Edit
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.cosmeticsRow}>
          {DECOR_SLOTS.map((slot) => {
            const equipped = equippedDecor?.[slot.key];
            return (
              <View key={slot.key} style={styles.cosmeticSlot}>
                <View
                  style={[
                    styles.cosmeticIcon,
                    {
                      backgroundColor: equipped
                        ? theme.colors.primaryContainer
                        : theme.colors.surface,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={
                      slot.icon as keyof typeof MaterialCommunityIcons.glyphMap
                    }
                    size={18}
                    color={
                      equipped
                        ? theme.colors.primary
                        : theme.colors.onSurfaceVariant
                    }
                  />
                </View>
                <Text
                  style={[
                    styles.cosmeticLabel,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                  numberOfLines={1}
                >
                  {slot.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* ---- Active Boosts ---- */}
      {activeBoosts.length > 0 && (
        <View style={styles.boostsSection}>
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            Active Boosts
          </Text>
          {activeBoosts.map((boost) => {
            const remaining = Math.max(0, boost.expiresAt - Date.now());
            const mins = Math.ceil(remaining / 60_000);
            return (
              <View key={boost.id} style={styles.boostRow}>
                <MaterialCommunityIcons
                  name={
                    (boost.icon as keyof typeof MaterialCommunityIcons.glyphMap) ??
                    "rocket-launch"
                  }
                  size={14}
                  color={theme.colors.primary}
                />
                <Text
                  style={[styles.boostLabel, { color: theme.colors.onSurface }]}
                  numberOfLines={1}
                >
                  {boost.multiplierLabel}
                </Text>
                <Text
                  style={[
                    styles.boostTimer,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {mins}m left
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

export const ExpandedPanel = memo(ExpandedPanelBase);
export default ExpandedPanel;

// =============================================================================
// StatPill sub-component
// =============================================================================

interface StatPillProps {
  icon: string;
  value: string;
  label: string;
}

function StatPill({ icon, value, label }: StatPillProps) {
  const theme = useTheme();
  return (
    <View style={statPillStyles.root}>
      <MaterialCommunityIcons
        name={icon as keyof typeof MaterialCommunityIcons.glyphMap}
        size={14}
        color={theme.colors.primary}
      />
      <Text
        style={[statPillStyles.value, { color: theme.colors.onSurface }]}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text
        style={[statPillStyles.label, { color: theme.colors.onSurfaceVariant }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const statPillStyles = StyleSheet.create({
  root: {
    alignItems: "center",
    gap: 2,
    flex: 1,
  },
  value: {
    fontSize: 14,
    fontWeight: "700",
  },
  label: {
    fontSize: 10,
    fontWeight: "500",
  },
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  root: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  rowLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  claimBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  claimBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  cosmeticsSection: {
    gap: Spacing.sm,
  },
  cosmeticsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  editLink: {
    fontSize: 12,
    fontWeight: "600",
  },
  cosmeticsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  cosmeticSlot: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  cosmeticIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  cosmeticLabel: {
    fontSize: 10,
    fontWeight: "500",
  },
  boostsSection: {
    gap: Spacing.xs,
  },
  boostRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  boostLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
  },
  boostTimer: {
    fontSize: 11,
    fontWeight: "500",
  },
});
