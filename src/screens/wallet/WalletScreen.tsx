/**
 * WalletScreen — Premium Token Wallet & Reward Command Center
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

import { EmptyState, ErrorState } from "@/components/ui";
import {
  BorderRadius,
  Elevation,
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
import type { Transaction } from "@/types/models";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Appbar,
  Badge,
  Chip,
  Divider,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

type FilterType = "all" | "earn" | "spend";

// ─── Design Tokens ─────────────────────────────────────────────────────────
const PENDING_AMBER = "#F59E0B";
const PENDING_AMBER_BG = "rgba(245, 158, 11, 0.12)";
const PENDING_AMBER_BORDER = "rgba(245, 158, 11, 0.35)";
const SUCCESS_GREEN = "#22C55E";
const SUCCESS_GREEN_BG = "rgba(34, 197, 94, 0.12)";

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

function WalletSkeleton({ theme }: { theme: any }) {
  const c = theme.colors.surfaceVariant;
  return (
    <View style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm }}>
      {/* Hero skeleton */}
      <View
        style={{
          borderRadius: BorderRadius.xl,
          alignItems: "center" as const,
          paddingVertical: Spacing.xl,
          paddingHorizontal: Spacing.lg,
          marginBottom: Spacing.lg,
          backgroundColor: theme.colors.primaryContainer,
        }}
      >
        <SkeletonBlock
          width={90}
          height={12}
          color={c}
          borderRadius={BorderRadius.sm}
        />
        <SkeletonBlock
          width={36}
          height={36}
          color={c}
          borderRadius={BorderRadius.full}
          style={{ marginTop: Spacing.md }}
        />
        <SkeletonBlock
          width={100}
          height={28}
          color={c}
          style={{ marginTop: Spacing.sm }}
        />
        <SkeletonBlock
          width={60}
          height={12}
          color={c}
          style={{ marginTop: Spacing.xs }}
        />
        <View
          style={{
            flexDirection: "row" as const,
            justifyContent: "space-between" as const,
            width: "100%",
            marginTop: Spacing.lg,
            gap: Spacing.sm,
          }}
        >
          <SkeletonBlock
            width="46%"
            height={48}
            color={c}
            borderRadius={BorderRadius.lg}
          />
          <SkeletonBlock
            width="46%"
            height={48}
            color={c}
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
          backgroundColor: theme.colors.surfaceVariant,
        }}
      >
        <SkeletonBlock width="55%" height={14} color={c} />
        <SkeletonBlock
          width="35%"
          height={11}
          color={c}
          style={{ marginTop: Spacing.sm }}
        />
      </View>

      {/* Quick action skeletons */}
      <View
        style={{
          flexDirection: "row" as const,
          justifyContent: "space-between" as const,
          marginBottom: Spacing.xl,
        }}
      >
        {[1, 2, 3].map((i) => (
          <SkeletonBlock
            key={i}
            width="31%"
            height={94}
            color={c}
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
            color={c}
            borderRadius={BorderRadius.full}
          />
          <View style={{ flex: 1, marginLeft: Spacing.md }}>
            <SkeletonBlock width="55%" height={13} color={c} />
            <SkeletonBlock
              width="28%"
              height={10}
              color={c}
              style={{ marginTop: Spacing.xs }}
            />
          </View>
          <SkeletonBlock width={48} height={15} color={c} />
        </View>
      ))}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// WALLET SCREEN
// ═══════════════════════════════════════════════════════════════════════════

export default function WalletScreen({ navigation }: any) {
  const theme = useTheme();
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
  const filteredTransactions = transactions.filter((tx) => {
    if (filter === "all") return true;
    return tx.type === filter;
  });

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
              style={[styles.txReason, { color: theme.colors.onSurface }]}
              numberOfLines={1}
            >
              {reasonDisplay}
            </Text>
            <Text style={[styles.txAmount, { color }]}>{amountDisplay}</Text>
          </View>
          {item.description ? (
            <Text
              style={[
                styles.txDescription,
                { color: theme.colors.onSurfaceVariant },
              ]}
              numberOfLines={1}
            >
              {item.description}
            </Text>
          ) : null}
          <Text style={[styles.txTime, { color: theme.colors.outline }]}>
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
          borderBottomColor: theme.colors.outlineVariant,
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
        <Text
          style={[styles.pendingSourceLabel, { color: theme.colors.onSurface }]}
        >
          {label}
        </Text>
        <Text
          style={[
            styles.pendingSourceMeta,
            { color: theme.colors.onSurfaceVariant },
          ]}
        >
          {count} unclaimed · +{formatTokenAmount(tokens)} tokens
        </Text>
      </View>
      <View style={[styles.claimPill, { backgroundColor: PENDING_AMBER }]}>
        <Text style={styles.claimPillText}>Claim</Text>
        <MaterialCommunityIcons name="chevron-right" size={14} color="#FFF" />
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
              backgroundColor: theme.colors.primaryContainer,
              ...Elevation.lg,
            },
          ]}
        >
          <Text
            style={[
              styles.heroLabel,
              { color: theme.colors.onPrimaryContainer, opacity: 0.65 },
            ]}
          >
            YOUR BALANCE
          </Text>

          <View style={styles.heroTokenIcon}>
            <MaterialCommunityIcons
              name="circle-multiple"
              size={32}
              color={theme.colors.primary}
            />
          </View>

          <Text
            style={[
              styles.heroAmount,
              { color: theme.colors.onPrimaryContainer },
            ]}
          >
            {wallet ? formatTokenAmount(wallet.tokensBalance) : "0"}
          </Text>

          <Text
            style={[
              styles.heroUnit,
              { color: theme.colors.onPrimaryContainer, opacity: 0.6 },
            ]}
          >
            tokens
          </Text>

          <Text
            style={[
              styles.heroSubtext,
              { color: theme.colors.onPrimaryContainer, opacity: 0.45 },
            ]}
          >
            Available to spend
          </Text>

          {/* Lifetime Stats */}
          {wallet && (
            <View style={styles.heroStatsRow}>
              <View
                style={[
                  styles.heroStatPill,
                  { backgroundColor: theme.colors.surface + "90" },
                ]}
              >
                <Text
                  style={[
                    styles.heroStatLabel,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  Lifetime Earned
                </Text>
                <Text style={[styles.heroStatValue, { color: SUCCESS_GREEN }]}>
                  +{formatTokenAmount(wallet.totalEarned || 0)}
                </Text>
              </View>
              <View
                style={[
                  styles.heroStatPill,
                  { backgroundColor: theme.colors.surface + "90" },
                ]}
              >
                <Text
                  style={[
                    styles.heroStatLabel,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  Lifetime Spent
                </Text>
                <Text
                  style={[styles.heroStatValue, { color: theme.colors.error }]}
                >
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
                backgroundColor: theme.colors.surfaceVariant,
                borderColor: PENDING_AMBER_BORDER,
                borderLeftColor: PENDING_AMBER,
              },
            ]}
          >
            {/* Pending Header */}
            <View style={styles.pendingHeader}>
              <View
                style={[
                  styles.pendingHeaderIcon,
                  { backgroundColor: PENDING_AMBER_BG },
                ]}
              >
                <MaterialCommunityIcons
                  name="gift-outline"
                  size={18}
                  color={PENDING_AMBER}
                />
              </View>
              <View style={styles.pendingHeaderText}>
                <Text
                  style={[
                    styles.pendingTitle,
                    { color: theme.colors.onSurface },
                  ]}
                >
                  Rewards Ready to Claim
                </Text>
                <Text
                  style={[
                    styles.pendingSubtitle,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {pending.totalPendingCount} reward
                  {pending.totalPendingCount !== 1 ? "s" : ""} waiting
                </Text>
              </View>
              <View
                style={[
                  styles.pendingTokenBadge,
                  { backgroundColor: PENDING_AMBER_BG },
                ]}
              >
                <MaterialCommunityIcons
                  name="circle-multiple"
                  size={12}
                  color={PENDING_AMBER}
                  style={{ marginRight: 3 }}
                />
                <Text
                  style={[
                    styles.pendingTokenBadgeText,
                    { color: PENDING_AMBER },
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
                  "#FF9500",
                  "Achievement Rewards",
                  pending.unclaimedAchievementCount,
                  pending.unclaimedAchievementTokens,
                  () => navigation.navigate("AchievementsHub"),
                  pending.unclaimedLevelRewardCount === 0,
                )}
              {pending.unclaimedLevelRewardCount > 0 &&
                renderPendingSourceRow(
                  "arrow-up-bold-circle",
                  "#34C759",
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
                backgroundColor: theme.colors.surfaceVariant,
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
              <Text
                style={[
                  styles.pendingEmptyTitle,
                  { color: theme.colors.onSurface },
                ]}
              >
                All Caught Up!
              </Text>
              <Text
                style={[
                  styles.pendingEmptySubtitle,
                  { color: theme.colors.onSurfaceVariant },
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
              iconColor: theme.colors.tertiary,
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
              iconColor: theme.colors.secondary,
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
                  backgroundColor: theme.colors.surfaceVariant,
                  ...Elevation.sm,
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
                  <Badge style={styles.actionBadge} size={18}>
                    {action.badge}
                  </Badge>
                )}
              </View>
              <Text
                style={[styles.actionTitle, { color: theme.colors.onSurface }]}
                numberOfLines={1}
              >
                {action.title}
              </Text>
              <Text
                style={[
                  styles.actionSubtitle,
                  { color: theme.colors.onSurfaceVariant },
                ]}
                numberOfLines={2}
              >
                {action.subtitle}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ═══ Activity Feed Header ════════════════════════════════════ */}
        <View style={styles.activityHeader}>
          <View style={styles.activityTitleRow}>
            <MaterialCommunityIcons
              name="history"
              size={20}
              color={theme.colors.onSurface}
              style={{ marginRight: Spacing.xs }}
            />
            <Text
              style={[styles.activityTitle, { color: theme.colors.onSurface }]}
            >
              Recent Activity
            </Text>
          </View>
          <View style={styles.filterChips}>
            {(["all", "earn", "spend"] as FilterType[]).map((f) => {
              const isSelected = filter === f;
              return (
                <Chip
                  key={f}
                  selected={isSelected}
                  showSelectedCheck={false}
                  onPress={() => setFilter(f)}
                  style={[
                    styles.filterChip,
                    isSelected
                      ? { backgroundColor: theme.colors.primary }
                      : { backgroundColor: theme.colors.surface },
                  ]}
                  textStyle={[
                    styles.filterChipText,
                    isSelected
                      ? { color: theme.colors.onPrimary }
                      : { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {f === "all" ? "All" : f === "earn" ? "Earned" : "Spent"}
                </Chip>
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
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={["top"]}
      >
        <Appbar.Header
          statusBarHeight={0}
          style={[styles.appbar, { backgroundColor: theme.colors.background }]}
        >
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content
            title="Wallet"
            titleStyle={[
              styles.appbarTitle,
              { color: theme.colors.onBackground },
            ]}
          />
        </Appbar.Header>
        <WalletSkeleton theme={theme} />
      </SafeAreaView>
    );
  }

  // ─── Error State ─────────────────────────────────────────────────────
  if (error) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={["top"]}
      >
        <Appbar.Header
          statusBarHeight={0}
          style={[styles.appbar, { backgroundColor: theme.colors.background }]}
        >
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content
            title="Wallet"
            titleStyle={[
              styles.appbarTitle,
              { color: theme.colors.onBackground },
            ]}
          />
        </Appbar.Header>
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
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      <Appbar.Header
        statusBarHeight={0}
        style={[styles.appbar, { backgroundColor: theme.colors.background }]}
      >
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content
          title="Wallet"
          titleStyle={[
            styles.appbarTitle,
            { color: theme.colors.onBackground },
          ]}
        />
      </Appbar.Header>

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
              style={[
                styles.txDivider,
                { backgroundColor: theme.colors.outlineVariant },
              ]}
            />
          </View>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
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
  appbar: {
    elevation: 0,
  },
  appbarTitle: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
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
  },
  heroLabel: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.semibold,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: Spacing.md,
  },
  heroTokenIcon: {
    marginBottom: Spacing.xs,
  },
  heroAmount: {
    fontSize: 44,
    fontWeight: FontWeights.bold,
    lineHeight: 52,
  },
  heroUnit: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.medium,
    marginTop: 2,
  },
  heroSubtext: {
    fontSize: FontSizes.sm,
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
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
    color: "#FFF",
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
    backgroundColor: PENDING_AMBER,
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
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  activityTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  activityTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
  },
  filterChips: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  filterChip: {
    height: 30,
    borderRadius: BorderRadius.full,
  },
  filterChipText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.medium,
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
