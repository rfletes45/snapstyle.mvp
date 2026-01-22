/**
 * WalletScreen
 * Phase 18: Display user's token balance and transaction history
 *
 * Features:
 * - Current token balance display
 * - Transaction history with filtering
 * - Real-time balance updates
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Platform,
} from "react-native";
import {
  Text,
  Card,
  IconButton,
  Appbar,
  Chip,
  ActivityIndicator,
  Divider,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "@/store/AuthContext";
import {
  subscribeToWallet,
  subscribeToTransactions,
  formatTokenAmount,
  formatTransactionAmount,
  getTransactionReasonDisplay,
  getTransactionIcon,
  getTransactionColor,
} from "@/services/economy";
import { Wallet, Transaction, TransactionType } from "@/types/models";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui";
import { Spacing, BorderRadius } from "../../../constants/theme";

type FilterType = "all" | "earn" | "spend";

export default function WalletScreen({ navigation }: any) {
  const { currentFirebaseUser } = useAuth();
  const user = currentFirebaseUser;
  const theme = useTheme();

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");

  // Subscribe to wallet and transactions
  useEffect(() => {
    if (!user) return;

    setLoading(true);
    setError(null);

    // Subscribe to wallet
    const unsubWallet = subscribeToWallet(
      user.uid,
      (updatedWallet) => {
        setWallet(updatedWallet);
        setLoading(false);
      },
      (err) => {
        console.error("[WalletScreen] Wallet subscription error:", err);
        setError("Failed to load wallet");
        setLoading(false);
      },
    );

    // Subscribe to transactions
    const unsubTransactions = subscribeToTransactions(user.uid, (updatedTx) => {
      setTransactions(updatedTx);
    });

    return () => {
      unsubWallet();
      unsubTransactions();
    };
  }, [user]);

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // The subscriptions will automatically update, just wait a moment
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  // Filter transactions
  const filteredTransactions = transactions.filter((tx) => {
    if (filter === "all") return true;
    return tx.type === filter;
  });

  // Format timestamp
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isYesterday) {
      return "Yesterday";
    }

    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  // Render transaction item
  const renderTransaction = ({ item }: { item: Transaction }) => {
    const color = getTransactionColor(item.type);
    const icon = getTransactionIcon(item.reason);
    const reasonDisplay = getTransactionReasonDisplay(item.reason);
    const amountDisplay = formatTransactionAmount(item.type, item.amount);

    return (
      <View style={styles.transactionItem}>
        <View
          style={[styles.transactionIcon, { backgroundColor: color + "20" }]}
        >
          <MaterialCommunityIcons name={icon as any} size={20} color={color} />
        </View>

        <View style={styles.transactionInfo}>
          <Text
            style={[
              styles.transactionReason,
              { color: theme.colors.onSurface },
            ]}
          >
            {reasonDisplay}
          </Text>
          {item.description && (
            <Text
              style={[
                styles.transactionDescription,
                { color: theme.colors.onSurfaceVariant },
              ]}
              numberOfLines={1}
            >
              {item.description}
            </Text>
          )}
          <Text
            style={[
              styles.transactionTime,
              { color: theme.colors.onSurfaceDisabled },
            ]}
          >
            {formatTime(item.createdAt)}
          </Text>
        </View>

        <Text style={[styles.transactionAmount, { color }]}>
          {amountDisplay}
        </Text>
      </View>
    );
  };

  // Render header with wallet balance
  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Balance Card */}
      <Card
        style={[
          styles.balanceCard,
          { backgroundColor: theme.colors.surfaceVariant },
        ]}
        mode="elevated"
      >
        <Card.Content style={styles.balanceContent}>
          <Text
            style={[
              styles.balanceLabel,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            Your Balance
          </Text>
          <View style={styles.balanceRow}>
            <MaterialCommunityIcons
              name="currency-usd"
              size={40}
              color={theme.colors.primary}
            />
            <Text
              style={[styles.balanceAmount, { color: theme.colors.onSurface }]}
            >
              {wallet ? formatTokenAmount(wallet.tokensBalance) : "0"}
            </Text>
            <Text
              style={[
                styles.balanceUnit,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              tokens
            </Text>
          </View>

          {/* Stats */}
          {wallet && (
            <View
              style={[
                styles.statsRow,
                { borderTopColor: theme.colors.outlineVariant },
              ]}
            >
              <View style={styles.statItem}>
                <Text
                  style={[
                    styles.statLabel,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  Total Earned
                </Text>
                <Text
                  style={[styles.statValue, { color: theme.colors.tertiary }]}
                >
                  +{formatTokenAmount(wallet.totalEarned || 0)}
                </Text>
              </View>
              <View
                style={[
                  styles.statDivider,
                  { backgroundColor: theme.colors.outlineVariant },
                ]}
              />
              <View style={styles.statItem}>
                <Text
                  style={[
                    styles.statLabel,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  Total Spent
                </Text>
                <Text style={[styles.statValue, { color: theme.colors.error }]}>
                  -{formatTokenAmount(wallet.totalSpent || 0)}
                </Text>
              </View>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Quick Actions */}
      <View style={styles.actionsRow}>
        <Card
          style={[
            styles.actionCard,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
          mode="elevated"
          onPress={() => navigation.navigate("Tasks")}
        >
          <Card.Content style={styles.actionContent}>
            <MaterialCommunityIcons
              name="checkbox-marked-circle"
              size={28}
              color={theme.colors.tertiary}
            />
            <Text
              style={[styles.actionText, { color: theme.colors.onSurface }]}
            >
              Earn Tokens
            </Text>
          </Card.Content>
        </Card>

        <Card
          style={[
            styles.actionCard,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
          mode="elevated"
          onPress={() => navigation.navigate("Shop")}
        >
          <Card.Content style={styles.actionContent}>
            <MaterialCommunityIcons
              name="shopping"
              size={28}
              color={theme.colors.secondary}
            />
            <Text
              style={[styles.actionText, { color: theme.colors.onSurface }]}
            >
              Shop
            </Text>
          </Card.Content>
        </Card>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterContainer}>
        <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
          Transaction History
        </Text>
        <View style={styles.filterChips}>
          {(["all", "earn", "spend"] as FilterType[]).map((f) => (
            <Chip
              key={f}
              selected={filter === f}
              onPress={() => setFilter(f)}
              style={[
                styles.filterChip,
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
              textStyle={styles.filterChipText}
            >
              {f === "all" ? "All" : f === "earn" ? "Earned" : "Spent"}
            </Chip>
          ))}
        </View>
      </View>
    </View>
  );

  // Render empty state
  const renderEmpty = () => (
    <EmptyState
      icon="receipt"
      title="No Transactions Yet"
      subtitle={
        filter === "all"
          ? "Complete tasks to earn tokens!"
          : filter === "earn"
            ? "No earned tokens yet"
            : "No spent tokens yet"
      }
    />
  );

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={["top"]}
      >
        <Appbar.Header
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
        <LoadingState message="Loading wallet..." />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={["top"]}
      >
        <Appbar.Header
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
          message={error}
          onRetry={() => {
            setError(null);
            setLoading(true);
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      <Appbar.Header
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
          <Divider
            style={[
              styles.divider,
              { backgroundColor: theme.colors.outlineVariant },
            ]}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  appbar: {
    elevation: 0,
  },
  appbarTitle: {
    fontWeight: "bold",
  },
  listContent: {
    paddingBottom: Spacing.lg,
  },
  headerContainer: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  balanceCard: {
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  balanceContent: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  balanceLabel: {
    fontSize: 14,
    marginBottom: Spacing.sm,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: "bold",
    marginHorizontal: Spacing.sm,
  },
  balanceUnit: {
    fontSize: 16,
    marginTop: Spacing.sm,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    paddingTop: Spacing.md,
    width: "100%",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 12,
    marginBottom: Spacing.xs,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "bold",
  },
  statDivider: {
    width: 1,
    height: 30,
  },
  actionsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  actionCard: {
    flex: 1,
    borderRadius: BorderRadius.md,
  },
  actionContent: {
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  actionText: {
    fontSize: 14,
    marginTop: Spacing.sm,
  },
  filterContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  filterChips: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  filterChip: {
    // Color applied inline
  },
  filterChipText: {
    fontSize: 12,
  },
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionReason: {
    fontSize: 14,
    fontWeight: "500",
  },
  transactionDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  transactionTime: {
    fontSize: 11,
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: "bold",
  },
  divider: {
    marginLeft: 68,
  },
});
