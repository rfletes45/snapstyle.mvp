/**
 * EnhancedGamesProfileHeader
 *
 * Premium "Player Summary Header" shown at the top of the Games/Play hub.
 *
 * Three-zone layout (collapsed):
 *   Left   — AvatarStack (PFP + decoration layers)
 *   Middle — DisplayName, XP bar
 *   Right  — CurrencyChips + quick-action icons
 *
 * Below the header row:
 *   - Daily task rail
 *   - Monthly task rail
 *   - Expand/collapse chevron → ExpandedPanel
 *
 * Gated by PLAY_SCREEN_FEATURES.ENHANCED_PROFILE_HEADER.
 *
 * @module components/games/EnhancedGamesProfileHeader
 */

import { BorderRadius, Spacing } from "@/constants/theme";
import { usePlayerSummary } from "@/hooks/usePlayerSummary";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { CommonActions, useNavigation } from "@react-navigation/native";
import React, { memo, useCallback, useState } from "react";
import {
  LayoutAnimation,
  Platform,
  StyleSheet,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { Text, useTheme } from "react-native-paper";

import { AvatarStack } from "./AvatarStack";
import { CurrencyChip } from "./CurrencyChip";
import { ExpandedPanel } from "./ExpandedPanel";
import { TaskProgressRail } from "./TaskProgressRail";
import { XpBar } from "./XpBar";

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// =============================================================================
// Skeleton
// =============================================================================

function HeaderSkeleton() {
  const theme = useTheme();
  const bg = theme.colors.surfaceVariant;

  return (
    <View style={[styles.card, { backgroundColor: bg, borderColor: bg }]}>
      <View style={styles.topRow}>
        {/* avatar placeholder */}
        <View
          style={[styles.skelCircle, { backgroundColor: theme.colors.surface }]}
        />
        {/* text placeholders */}
        <View style={styles.middleZone}>
          <View
            style={[
              styles.skelBar,
              { width: 120, backgroundColor: theme.colors.surface },
            ]}
          />
          <View
            style={[
              styles.skelBar,
              { width: 180, backgroundColor: theme.colors.surface },
            ]}
          />
        </View>
      </View>
      {/* rail placeholders */}
      <View
        style={[styles.skelRail, { backgroundColor: theme.colors.surface }]}
      />
      <View
        style={[styles.skelRail, { backgroundColor: theme.colors.surface }]}
      />
    </View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

function EnhancedGamesProfileHeaderBase() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const { summary, loading, loadExpanded, expandedLoaded } = usePlayerSummary();

  const [expanded, setExpanded] = useState(false);

  // --- handlers ---
  const toggleExpanded = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = !expanded;
    setExpanded(next);
    if (next && !expandedLoaded) {
      loadExpanded();
    }
  }, [expanded, expandedLoaded, loadExpanded]);

  // --- cross-tab navigation helpers ---
  // Tasks, Wallet, Shop, and ProfileMain live in the Profile tab stack.
  // From the Play tab we use CommonActions.navigate to reach nested screens
  // in another tab without the try/catch anti-pattern.

  const navigateTasks = useCallback(
    (tab: "daily" | "monthly") => {
      navigation.dispatch(
        CommonActions.navigate({
          name: "Profile",
          params: {
            screen: "Tasks",
            params: { tab },
          },
        }),
      );
    },
    [navigation],
  );

  const navigateWallet = useCallback(() => {
    navigation.dispatch(
      CommonActions.navigate({
        name: "Profile",
        params: { screen: "Wallet" },
      }),
    );
  }, [navigation]);

  const navigateShop = useCallback(() => {
    // PointsShop is a root-level MainStack screen
    navigation.dispatch(CommonActions.navigate({ name: "PointsShop" }));
  }, [navigation]);

  const navigateCustomize = useCallback(() => {
    navigation.dispatch(
      CommonActions.navigate({
        name: "Profile",
        params: { screen: "ProfileMain" },
      }),
    );
  }, [navigation]);

  // --- loading ---
  if (loading && !summary.uid) {
    return <HeaderSkeleton />;
  }

  const { tasks, balances, equippedDecor } = summary;
  const totalClaimable =
    tasks.daily.claimableCount + tasks.monthly.claimableCount;

  // Determine if monthly tasks are locked
  const monthlyLocked =
    summary.tasks.monthly.unlockLevel > 0 &&
    summary.level.current < summary.tasks.monthly.unlockLevel;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surfaceVariant,
          borderColor: theme.colors.outlineVariant,
        },
      ]}
    >
      {/* ========== TOP ROW ========== */}
      <View style={styles.topRow}>
        {/* Left: Avatar */}
        <AvatarStack
          photoURL={summary.photoURL}
          name={summary.displayName}
          decorationId={summary.decorationId}
          equippedDecor={equippedDecor}
          size={56}
          presence={summary.presence}
        />

        {/* Middle: Name + XP */}
        <View style={styles.middleZone}>
          <Text
            style={[styles.displayName, { color: theme.colors.onSurface }]}
            numberOfLines={1}
          >
            {summary.displayName}
          </Text>
          {summary.playerTitle ? (
            <Text
              style={[
                styles.playerTitle,
                { color: theme.colors.onSurfaceVariant },
              ]}
              numberOfLines={1}
            >
              {summary.playerTitle}
            </Text>
          ) : null}
          <XpBar level={summary.level} compact={Platform.OS !== "web"} />
        </View>

        {/* Right: Economy + Quick Actions */}
        <View style={styles.rightZone}>
          <View style={styles.chipsCol}>
            <CurrencyChip
              icon="circle-multiple"
              amount={balances.coins}
              iconColor="#FFD700"
              claimable={totalClaimable > 0}
              onPress={navigateWallet}
            />
            {(balances.gems ?? 0) > 0 && (
              <CurrencyChip
                icon="diamond-stone"
                amount={balances.gems ?? 0}
                iconColor="#B39DDB"
                onPress={navigateShop}
              />
            )}
          </View>
          <View style={styles.quickActions}>
            <TouchableOpacity
              onPress={navigateWallet}
              hitSlop={8}
              accessibilityLabel="Wallet"
            >
              <MaterialCommunityIcons
                name="wallet"
                size={20}
                color={theme.colors.onSurfaceVariant}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={navigateCustomize}
              hitSlop={8}
              accessibilityLabel="Customize"
            >
              <MaterialCommunityIcons
                name="palette"
                size={20}
                color={theme.colors.onSurfaceVariant}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ========== TASK RAILS ========== */}
      <View style={styles.rails}>
        <TaskProgressRail
          label="Daily Tasks"
          completed={tasks.daily.completed}
          total={tasks.daily.total}
          claimableCount={tasks.daily.claimableCount}
          icon="calendar-check"
          onPress={() => navigateTasks("daily")}
        />
        <TaskProgressRail
          label="Monthly Tasks"
          completed={tasks.monthly.completed}
          total={tasks.monthly.total}
          claimableCount={tasks.monthly.claimableCount}
          icon="calendar-month"
          locked={monthlyLocked}
          lockMessage={`Unlock at Level ${tasks.monthly.unlockLevel}`}
          onPress={monthlyLocked ? undefined : () => navigateTasks("monthly")}
        />
      </View>

      {/* ========== EXPAND CHEVRON ========== */}
      <TouchableOpacity
        style={styles.chevronRow}
        onPress={toggleExpanded}
        activeOpacity={0.6}
        accessibilityLabel={expanded ? "Collapse details" : "Expand details"}
        accessibilityRole="button"
      >
        <MaterialCommunityIcons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={22}
          color={theme.colors.onSurfaceVariant}
        />
      </TouchableOpacity>

      {/* ========== EXPANDED PANEL ========== */}
      {expanded && (
        <ExpandedPanel
          claimableCount={totalClaimable}
          onClaimAll={() => navigateTasks("daily")}
          miniStats={summary.miniStats}
          equippedDecor={equippedDecor}
          onEditCosmetics={navigateCustomize}
          activeBoosts={summary.activeBoosts}
        />
      )}
    </View>
  );
}

export const EnhancedGamesProfileHeader = memo(EnhancedGamesProfileHeaderBase);
export default EnhancedGamesProfileHeader;

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  // ----- top row -----
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  middleZone: {
    flex: 1,
    gap: 4,
  },
  displayName: {
    fontSize: 16,
    fontWeight: "700",
  },
  playerTitle: {
    fontSize: 12,
    fontWeight: "500",
  },
  rightZone: {
    alignItems: "flex-end",
    gap: Spacing.sm,
  },
  chipsCol: {
    gap: 4,
  },
  quickActions: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  // ----- rails -----
  rails: {
    gap: 6,
  },
  // ----- chevron -----
  chevronRow: {
    alignItems: "center",
    paddingVertical: 2,
  },
  // ----- skeleton -----
  skelCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  skelBar: {
    height: 12,
    borderRadius: 6,
  },
  skelRail: {
    height: 32,
    borderRadius: BorderRadius.sm,
  },
});
