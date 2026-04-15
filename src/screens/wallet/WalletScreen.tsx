/**
 * WalletScreen — Premium Token Wallet & Reward Command Center
 *
 * Redesign 2026-04-15:
 * - Calls-inspired ScreenHeader for consistent header language
 * - Clean surface-variant hero card (no purple primaryContainer)
 * - Theme-driven accent colors (no hardcoded orange/amber)
 * - FilterChips shared component for tab consistency
 *
 * Features:
 * - Premium hero balance display with lifetime stats
 * - Always-visible pending rewards section with source breakdown
 * - Quick action shortcuts to Achievements, Level Rewards, Shop
 * - Filterable transaction history / activity feed
 * - Real-time balance and transaction updates
 * - Polished skeleton loading and empty states
 *
 * @module screens/wallet/WalletScreen
 */

import { type FilterChipOption } from "@/components/shared/FilterChips";
import { ScreenHeader } from "@/components/shared/ScreenHeader";
import { EmptyState, ErrorState } from "@/components/ui";
import {
  BorderRadius,
  FontSizes,
  FontWeights,
  Spacing,
} from "@/constants/theme";
import { usePendingRewards } from "@/hooks/usePendingRewards";
import { useWallet } from "@/hooks/useWallet";
import {
  formatTokenAmount,
  formatTransactionAmount,
  getTransactionColor,
  getTransactionIcon,
  getTransactionReasonDisplay,
} from "@/services/economy";
import { useAppTheme } from "@/store/ThemeContext";
import type { Transaction } from "@/types/models";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Badge, Divider, Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

type FilterType = "all" | "earn" | "spend";

// ─── Design Tokens ─────────────────────────────────────────────────────────
const SUCCESS_GREEN = "#22C55E";
const SUCCESS_GREEN_BG = "rgba(34, 197, 94, 0.12)";

// ─── Filter Options (matching Calls screen pattern) ───────────────────────
const FILTER_OPTIONS: FilterChipOption<FilterType>[] = [
  { key: "all", label: "All" },
  { key: "earn", label: "Earned" },
  { key: "spend", label: "Spent" },
];

// ─── Skeleton Placeholder ──────────────────────────────────────────────────
function SkeletonBlock({
  width,
  height,
  borderRadius = BorderRadius.md,
  style,
  color,
}: {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: any;
  color: string;
}) {
  return (
    <View
      style={[
        {
          width: width as any,
          height,
          backgroundColor: color,
          borderRadius,
          opacity: 0.45,
        },
        style,
      ]}
    />
  );
}

function WalletSkeleton({ skeletonColor }: { skeletonColor: string }) {
  return (
    <View style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.md }}>
      {/* Hero skeleton */}
      <View
        style={{
          borderRadius: BorderRadius.xl,
          alignItems: "center" as const,
          paddingVertical: Spacing.xl,
          paddingHorizontal: Spacing.lg,
          marginBottom: Spacing.lg,
        }}
      >
        <SkeletonBlock
          width={110}
          height={12}
          color={skeletonColor}
          borderRadius={BorderRadius.sm}
        />
        <View
          style={{
            flexDirection: "row" as const,
            alignItems: "center" as const,
            marginTop: Spacing.lg,
            gap: Spacing.sm,
          }}
        >
          <SkeletonBlock
            width={32}
            height={32}
            color={skeletonColor}
            borderRadius={BorderRadius.full}
          />
          <SkeletonBlock width={120} height={40} color={skeletonColor} />
        </View>
        <SkeletonBlock
          width={60}
          height={12}
          color={skeletonColor}
          style={{ marginTop: Spacing.sm }}
        />
        <View
          style={{
            flexDirection: "row" as const,
            justifyContent: "space-between" as const,
            width: "100%",
            marginTop: Spacing.xl,
            gap: Spacing.sm,
          }}
        >
          <SkeletonBlock
            width="46%"
            height={52}
            color={skeletonColor}
            borderRadius={BorderRadius.lg}
          />
          <SkeletonBlock
            width="46%"
            height={52}
            color={skeletonColor}
            borderRadius={BorderRadius.lg}
          />
        </View>
      </View>

      {/* Pending skeleton */}
      <View
        style={{
          borderRadius: BorderRadius.lg,
          padding: Spacing.lg,
          marginBottom: Spacing.lg,
        }}
      >
        <SkeletonBlock width="55%" height={14} color={skeletonColor} />
        <SkeletonBlock
          width="35%"
          height={11}
          color={skeletonColor}
          style={{ marginTop: Spacing.sm }}
        />
      </View>

      {/* Quick action skeletons */}
      <View
        style={{
          flexDirection: "row" as const,
          justifyContent: "space-between" as const,
          marginBottom: Spacing.xl,
          gap: Spacing.sm,
        }}
      >
        {[1, 2, 3].map((i) => (
          <SkeletonBlock
            key={i}
            width="31%"
            height={94}
            color={skeletonColor}
            borderRadius={BorderRadius.lg}
          />
        ))}
      </View>

      {/* Activity row skeletons */}
      {[1, 2, 3, 4].map((i) => (
        <View
          key={i}
          style={{
            flexDirection: "row" as const,
            alignItems: "center" as const,
            paddingVertical: Spacing.md,
          }}
        >
          <SkeletonBlock
            width={38}
            height={38}
            color={skeletonColor}
            borderRadius={BorderRadius.full}
          />
          <View style={{ flex: 1, marginLeft: Spacing.md }}>
            <SkeletonBlock width="55%" height={13} color={skeletonColor} />
            <SkeletonBlock
              width="28%"
              height={10}
              color={skeletonColor}
              style={{ marginTop: Spacing.xs }}
            />
          </View>
          <SkeletonBlock width={48} height={15} color={skeletonColor} />
        </View>
      ))}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// WALLET SCREEN
// ═══════════════════════════════════════════════════════════════════════════

export default function WalletScreen({ navigation }: any) {
  const { colors, isDark } = useAppTheme();
  const { wallet, transactions, loading, error } = useWallet(true);
  const pending = usePendingRewards();

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");

  // Pull-to-refresh (subscriptions are live; this is visual feedback)
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  // Filter transactions
  const filteredTransactions = useMemo(
    () =>
      transactions.filter((tx) => {
        if (filter === "all") return true;
        return tx.type === filter;
      }),
    [transactions, filter],
  );

  // Format timestamp with relative time for recent entries
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;

    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  // ─── Transaction Row ────────────────────────────────────────────────
  const renderTransaction = ({ item }: { item: Transaction }) => {
    const color = getTransactionColor(item.type);
    const icon = getTransactionIcon(item.reason);
    const reasonDisplay = getTransactionReasonDisplay(item.reason);
    const amountDisplay = formatTransactionAmount(item.type, item.amount);

    return (
      <View style={styles.txRow}>
        <View style={[styles.txIcon, { backgroundColor: color + "15" }]}>
          <MaterialCommunityIcons
            name={icon as keyof typeof MaterialCommunityIcons.glyphMap}
            size={20}
            color={color}
          />
        </View>

        <View style={styles.txContent}>
          <View style={styles.txTopRow}>
            <Text
              style={[styles.txReason, { color: colors.text }]}
              numberOfLines={1}
            >
              {reasonDisplay}
            </Text>
            <Text style={[styles.txAmount, { color }]}>{amountDisplay}</Text>
          </View>
          {item.description ? (
            <Text
              style={[styles.txDescription, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {item.description}
            </Text>
          ) : null}
          <Text style={[styles.txTime, { color: colors.outline }]}>
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  // ─── Pending Source Row ──────────────────────────────────────────────
  const renderPendingSourceRow = (
    icon: string,
    iconColor: string,
    label: string,
    count: number,
    tokens: number,
    onPress: () => void,
    isLast: boolean,
  ) => (
    <TouchableOpacity
      key={label}
      style={[
        styles.pendingSourceRow,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.divider,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.65}
    >
      <View
        style={[
          styles.pendingSourceIcon,
          { backgroundColor: iconColor + "18" },
        ]}
      >
        <MaterialCommunityIcons
          name={icon as keyof typeof MaterialCommunityIcons.glyphMap}
          size={18}
          color={iconColor}
        />
      </View>
      <View style={styles.pendingSourceInfo}>
        <Text style={[styles.pendingSourceLabel, { color: colors.text }]}>
          {label}
        </Text>
        <Text
          style={[styles.pendingSourceMeta, { color: colors.textSecondary }]}
        >
          {count} unclaimed · +{formatTokenAmount(tokens)} tokens
        </Text>
      </View>
      <View style={[styles.claimPill, { backgroundColor: colors.primary }]}>
        <Text style={[styles.claimPillText, { color: colors.textOnPrimary }]}>
          Claim
        </Text>
        <MaterialCommunityIcons
          name="chevron-right"
          size={14}
          color={colors.textOnPrimary}
        />
      </View>
    </TouchableOpacity>
  );

  // ─── Header ──────────────────────────────────────────────────────────
  const renderHeader = () => {
    const hasPending = pending.totalPendingCount > 0 && !pending.loading;

    return (
      <View style={styles.headerContainer}>
        {/* ═══ Hero Balance Card ═══════════════════════════════════════ */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: colors.surfaceVariant,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>
            AVAILABLE BALANCE
          </Text>

          <View style={styles.heroBalanceRow}>
            <MaterialCommunityIcons
              name="circle-multiple"
              size={30}
              color={colors.primary}
              style={{ marginRight: Spacing.sm }}
            />
            <Text style={[styles.heroAmount, { color: colors.text }]}>
              {wallet ? formatTokenAmount(wallet.tokensBalance) : "0"}
            </Text>
          </View>

          {/* Lifetime Stats */}
          {wallet && (
            <View style={styles.heroStatsRow}>
              <View
                style={[
                  styles.heroStatPill,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.heroStatLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  Total Earned
                </Text>
                <Text style={[styles.heroStatValue, { color: SUCCESS_GREEN }]}>
                  +{formatTokenAmount(wallet.totalEarned || 0)}
                </Text>
              </View>
              <View
                style={[
                  styles.heroStatPill,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.heroStatLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  Total Spent
                </Text>
                <Text style={[styles.heroStatValue, { color: colors.error }]}>
                  -{formatTokenAmount(wallet.totalSpent || 0)}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ═══ Pending Rewards Section ═════════════════════════════════ */}
        {hasPending ? (
          <View
            style={[
              styles.pendingCard,
              {
                backgroundColor: colors.surfaceVariant,
                borderColor: colors.primary + "35",
                borderLeftColor: colors.primary,
              },
            ]}
          >
            {/* Pending Header */}
            <View style={styles.pendingHeader}>
              <View
                style={[
                  styles.pendingHeaderIcon,
                  { backgroundColor: colors.primary + "18" },
                ]}
              >
                <MaterialCommunityIcons
                  name="gift-outline"
                  size={18}
                  color={colors.primary}
                />
              </View>
              <View style={styles.pendingHeaderText}>
                <Text style={[styles.pendingTitle, { color: colors.text }]}>
                  Rewards Ready to Claim
                </Text>
                <Text
                  style={[
                    styles.pendingSubtitle,
                    { color: colors.textSecondary },
                  ]}
                >
                  {pending.totalPendingCount} reward
                  {pending.totalPendingCount !== 1 ? "s" : ""} waiting
                </Text>
              </View>
              <View
                style={[
                  styles.pendingTokenBadge,
                  { backgroundColor: colors.primary + "18" },
                ]}
              >
                <MaterialCommunityIcons
                  name="circle-multiple"
                  size={12}
                  color={colors.primary}
                  style={{ marginRight: 3 }}
                />
                <Text
                  style={[
                    styles.pendingTokenBadgeText,
                    { color: colors.primary },
                  ]}
                >
                  +{formatTokenAmount(pending.totalPendingTokens)}
                </Text>
              </View>
            </View>

            {/* Pending Source Rows */}
            <View style={styles.pendingSourceList}>
              {pending.unclaimedAchievementCount > 0 &&
                renderPendingSourceRow(
                  "trophy",
                  colors.warning,
                  "Achievement Rewards",
                  pending.unclaimedAchievementCount,
                  pending.unclaimedAchievementTokens,
                  () => navigation.navigate("AchievementsHub"),
                  pending.unclaimedLevelRewardCount === 0,
                )}
              {pending.unclaimedLevelRewardCount > 0 &&
                renderPendingSourceRow(
                  "arrow-up-bold-circle",
                  SUCCESS_GREEN,
                  "Level Rewards",
                  pending.unclaimedLevelRewardCount,
                  pending.unclaimedLevelRewardTokens,
                  () => navigation.navigate("LevelRewards"),
                  true,
                )}
            </View>
          </View>
        ) : !pending.loading ? (
          <View
            style={[
              styles.pendingCardEmpty,
              {
                backgroundColor: colors.surfaceVariant,
                borderColor: SUCCESS_GREEN + "30",
              },
            ]}
          >
            <View
              style={[
                styles.pendingEmptyIcon,
                { backgroundColor: SUCCESS_GREEN_BG },
              ]}
            >
              <MaterialCommunityIcons
                name="check-circle"
                size={20}
                color={SUCCESS_GREEN}
              />
            </View>
            <View style={styles.pendingEmptyText}>
              <Text style={[styles.pendingEmptyTitle, { color: colors.text }]}>
                All Caught Up!
              </Text>
              <Text
                style={[
                  styles.pendingEmptySubtitle,
                  { color: colors.textSecondary },
                ]}
              >
                Play games to unlock new rewards
              </Text>
            </View>
          </View>
        ) : null}

        {/* ═══ Quick Actions ═══════════════════════════════════════════ */}
        <View style={styles.actionsRow}>
          {[
            {
              icon: "trophy" as const,
              iconColor: colors.warning,
              title: "Achievements",
              subtitle: "Claim earned rewards",
              badge: pending.unclaimedAchievementCount,
              onPress: () => navigation.navigate("AchievementsHub"),
            },
            {
              icon: "arrow-up-bold-circle" as const,
              iconColor: SUCCESS_GREEN,
              title: "Level Rewards",
              subtitle: "Claim milestones",
              badge: pending.unclaimedLevelRewardCount,
              onPress: () => navigation.navigate("LevelRewards"),
            },
            {
              icon: "shopping" as const,
              iconColor: colors.secondary,
              title: "Shop",
              subtitle: "Spend your tokens",
              badge: 0,
              onPress: () => navigation.navigate("Shop"),
            },
          ].map((action) => (
            <TouchableOpacity
              key={action.title}
              style={[
                styles.actionCard,
                {
                  backgroundColor: colors.surfaceVariant,
                  borderColor: colors.border,
                },
              ]}
              onPress={action.onPress}
              activeOpacity={0.7}
            >
              <View style={{ position: "relative", marginBottom: Spacing.xs }}>
                <View
                  style={[
                    styles.actionIconWrap,
                    { backgroundColor: action.iconColor + "15" },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={action.icon}
                    size={22}
                    color={action.iconColor}
                  />
                </View>
                {action.badge > 0 && (
                  <Badge
                    style={[
                      styles.actionBadge,
                      { backgroundColor: colors.error },
                    ]}
                    size={18}
                  >
                    {action.badge}
                  </Badge>
                )}
              </View>
              <Text
                style={[styles.actionTitle, { color: colors.text }]}
                numberOfLines={1}
              >
                {action.title}
              </Text>
              <Text
                style={[styles.actionSubtitle, { color: colors.textSecondary }]}
                numberOfLines={2}
              >
                {action.subtitle}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ═══ Activity Feed Section Title + Inline Filters ════════════ */}
        <View style={styles.activityHeader}>
          <MaterialCommunityIcons
            name="history"
            size={20}
            color={colors.text}
            style={{ marginRight: Spacing.xs }}
          />
          <Text style={[styles.activityTitle, { color: colors.text }]}>
            Recent Activity
          </Text>
          <View style={styles.activityFilters}>
            {FILTER_OPTIONS.map((opt) => {
              const isActive = filter === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => setFilter(opt.key)}
                  style={[
                    styles.inlineChip,
                    {
                      backgroundColor: isActive
                        ? colors.primary + "18"
                        : isDark
                          ? "rgba(255,255,255,0.08)"
                          : "rgba(0,0,0,0.05)",
                      borderColor: isActive
                        ? colors.primary + "40"
                        : "transparent",
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.inlineChipText,
                      {
                        color: isActive ? colors.primary : colors.textSecondary,
                        fontWeight: isActive ? "600" : "500",
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  // ─── Activity Empty State ────────────────────────────────────────────
  const renderEmpty = () => {
    const emptyConfig: Record<
      FilterType,
      { icon: string; title: string; subtitle: string }
    > = {
      all: {
        icon: "receipt",
        title: "No Activity Yet",
        subtitle:
          "Your transaction history will appear here as you earn and spend tokens.",
      },
      earn: {
        icon: "trending-up",
        title: "No Earnings Yet",
        subtitle: "Complete achievements and tasks to start earning tokens!",
      },
      spend: {
        icon: "shopping-outline",
        title: "Nothing Spent Yet",
        subtitle:
          "Visit the shop to find cosmetics and items to personalize your profile.",
      },
    };

    const config = emptyConfig[filter];
    return (
      <EmptyState
        icon={config.icon}
        title={config.title}
        subtitle={config.subtitle}
      />
    );
  };

  // ─── Loading State ───────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <ScreenHeader
          title="Wallet"
          onBack={() => navigation.goBack()}
          style={{ paddingTop: 4 }}
        />
        <WalletSkeleton skeletonColor={colors.surfaceVariant} />
      </SafeAreaView>
    );
  }

  // ─── Error State ─────────────────────────────────────────────────────
  if (error) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <ScreenHeader
          title="Wallet"
          onBack={() => navigation.goBack()}
          style={{ paddingTop: 4 }}
        />
        <ErrorState
          message="Unable to load your wallet. Please check your connection and try again."
          onRetry={() => {
            /* Firestore subscriptions auto-recover on reconnect */
          }}
        />
      </SafeAreaView>
    );
  }

  // ─── Main Render ─────────────────────────────────────────────────────
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <ScreenHeader
        title="Wallet"
        onBack={() => navigation.goBack()}
        style={{ paddingTop: 4 }}
        renderRight={() => (
          <MaterialCommunityIcons
            name="circle-multiple-outline"
            size={22}
            color={colors.textSecondary}
          />
        )}
      />

      <FlatList
        data={filteredTransactions}
        keyExtractor={(item) => item.id}
        renderItem={renderTransaction}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => (
          <View style={styles.txSeparator}>
            <Divider
              style={[styles.txDivider, { backgroundColor: colors.divider }]}
            />
          </View>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  listContent: {
    paddingBottom: Spacing.xxxl,
  },
  headerContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },

  // ─── Hero Balance Card ──────────────────────────────────────────────
  heroCard: {
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
    marginBottom: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  heroLabel: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.semibold,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: Spacing.md,
  },
  heroBalanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  heroAmount: {
    fontSize: 44,
    fontWeight: FontWeights.bold,
    lineHeight: 52,
  },

  heroStatsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    width: "100%",
  },
  heroStatPill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  heroStatLabel: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.medium,
    marginBottom: 3,
  },
  heroStatValue: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
  },

  // ─── Pending Rewards Card ──────────────────────────────────────────
  pendingCard: {
    borderRadius: BorderRadius.lg,
    borderLeftWidth: 4,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    overflow: "hidden",
  },
  pendingHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  pendingHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  pendingHeaderText: {
    flex: 1,
  },
  pendingTitle: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
  },
  pendingSubtitle: {
    fontSize: FontSizes.xs,
    marginTop: 1,
  },
  pendingTokenBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  pendingTokenBadgeText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.bold,
  },
  pendingSourceList: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  pendingSourceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  pendingSourceIcon: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  pendingSourceInfo: {
    flex: 1,
  },
  pendingSourceLabel: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
  },
  pendingSourceMeta: {
    fontSize: FontSizes.xs,
    marginTop: 1,
  },
  claimPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  claimPillText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.bold,
    marginRight: 2,
  },

  // ─── Pending Empty State ────────────────────────────────────────────
  pendingCardEmpty: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  pendingEmptyIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  pendingEmptyText: {
    flex: 1,
  },
  pendingEmptyTitle: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
  },
  pendingEmptySubtitle: {
    fontSize: FontSizes.xs,
    marginTop: 2,
  },

  // ─── Quick Actions ──────────────────────────────────────────────────
  actionsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  actionCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBadge: {
    position: "absolute",
    top: -2,
    right: -6,
    fontSize: 10,
  },
  actionTitle: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    textAlign: "center",
  },
  actionSubtitle: {
    fontSize: FontSizes.xs - 1,
    textAlign: "center",
    marginTop: 2,
    lineHeight: 14,
  },

  // ─── Activity Header ───────────────────────────────────────────────
  activityHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  activityFilters: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginLeft: "auto",
  },
  inlineChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  inlineChipText: {
    fontSize: FontSizes.xs,
    letterSpacing: 0.1,
  },
  activityTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
  },
  // ─── Transaction Rows ──────────────────────────────────────────────
  txRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  txIcon: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
    marginTop: 2,
  },
  txContent: {
    flex: 1,
  },
  txTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  txReason: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    flex: 1,
    marginRight: Spacing.sm,
  },
  txAmount: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
  },
  txDescription: {
    fontSize: FontSizes.xs,
    marginTop: 2,
  },
  txTime: {
    fontSize: FontSizes.xs - 1,
    marginTop: 3,
  },
  txSeparator: {
    paddingHorizontal: Spacing.lg,
  },
  txDivider: {
    marginLeft: 38 + Spacing.md,
  },
});
