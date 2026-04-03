/**
 * TasksScreen - Daily & Monthly Tasks
 *
 * Features:
 * - Segmented tab bar: Daily / Monthly
 * - Summary card per tab (progress, reset timer / days remaining)
 * - Task cards with progress bars, claim buttons, claimed state
 * - Reads route.params.tab to set initial tab
 * - Real-time Firestore subscriptions filtered by cadence
 * - Bonus rewards chip for unclaimed tokens
 *
 * @module screens/tasks/TasksScreen
 */

import { EmptyState, ErrorState, LoadingState } from "@/components/ui";
import { BorderRadius, Spacing } from "@/constants/theme";
import { formatTokenAmount, subscribeToWallet } from "@/services/economy";
import { getAppInstance } from "@/services/firebase";
import {
  claimTaskReward,
  getDaysUntilMonthReset,
  getProgressPercentage,
  getProgressText,
  getTimeUntilReset,
  subscribeToTasksWithProgress,
} from "@/services/tasks";
import { useAuth } from "@/store/AuthContext";
import type { TaskCadence, TaskWithProgress, Wallet } from "@/types/models";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { RouteProp } from "@react-navigation/native";
import { useRoute } from "@react-navigation/native";
import { getFunctions, httpsCallable } from "firebase/functions";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import {
  Appbar,
  Button,
  Card,
  ProgressBar,
  SegmentedButtons,
  Snackbar,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { createLogger } from "@/utils/log";
const logger = createLogger("screens/tasks/TasksScreen");

// =============================================================================
// Types
// =============================================================================

type TasksTab = "daily" | "monthly";

type TasksRouteParams = { tab?: TasksTab };

// =============================================================================
// Component
// =============================================================================

export default function TasksScreen({ navigation }: { navigation: any }) {
  const { currentFirebaseUser } = useAuth();
  const user = currentFirebaseUser;
  const theme = useTheme();

  // Read initial tab from navigation params
  const route = useRoute<RouteProp<{ Tasks: TasksRouteParams }, "Tasks">>();
  const initialTab: TasksTab = route.params?.tab ?? "daily";

  // --- state ---
  const [activeTab, setActiveTab] = useState<TasksTab>(initialTab);
  const [dailyTasks, setDailyTasks] = useState<TaskWithProgress[]>([]);
  const [monthlyTasks, setMonthlyTasks] = useState<TaskWithProgress[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });
  const [timeUntilReset, setTimeUntilReset] = useState(getTimeUntilReset());
  const [daysUntilMonthReset, setDaysUntilMonthReset] = useState(
    getDaysUntilMonthReset(),
  );

  // Derived tasks for the active tab
  const tasks = activeTab === "daily" ? dailyTasks : monthlyTasks;

  // --- subscriptions ---
  useEffect(() => {
    if (!user) return;

    setLoading(true);
    setError(null);

    // Two independent task subscriptions by cadence
    const unsubDaily = subscribeToTasksWithProgress(
      user.uid,
      (updated) => {
        setDailyTasks(updated);
        setLoading(false);
      },
      "daily",
    );

    const unsubMonthly = subscribeToTasksWithProgress(
      user.uid,
      (updated) => {
        setMonthlyTasks(updated);
        setLoading(false);
      },
      "monthly",
    );

    // Wallet for balance display
    const unsubWallet = subscribeToWallet(user.uid, (w) => setWallet(w));

    // Record daily login
    recordDailyLogin();

    return () => {
      unsubDaily();
      unsubMonthly();
      unsubWallet();
    };
  }, [user]);

  // Timer tick
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeUntilReset(getTimeUntilReset());
      setDaysUntilMonthReset(getDaysUntilMonthReset());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Record daily login
  const recordDailyLogin = async () => {
    try {
      const app = getAppInstance();
      const functions = getFunctions(app);
      const recordLogin = httpsCallable(functions, "recordDailyLogin");
      await recordLogin({});
    } catch (err) {
      logger.error("[TasksScreen] Error recording daily login:", err);
    }
  };

  // Refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeUntilReset(getTimeUntilReset());
    setDaysUntilMonthReset(getDaysUntilMonthReset());
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  // Claim
  const handleClaim = async (task: TaskWithProgress) => {
    if (claiming || !task.canClaim) return;
    setClaiming(task.id);

    try {
      const result = await claimTaskReward(
        task.id,
        undefined,
        task.cadence as TaskCadence,
      );
      if (result.success) {
        let msg = `+${result.tokensAwarded} tokens earned!`;
        if (result.itemAwarded) msg += " New item unlocked!";
        setSnackbar({ visible: true, message: msg });
      } else {
        setSnackbar({
          visible: true,
          message: result.error || "Failed to claim reward",
        });
      }
    } catch (err: any) {
      logger.error("[TasksScreen] Claim error:", err);
      setSnackbar({
        visible: true,
        message: err.message || "Failed to claim reward",
      });
    } finally {
      setClaiming(null);
    }
  };

  // --- computed ---
  const completedCount = tasks.filter((t) => t.isCompleted).length;
  const totalTasks = tasks.length;
  const overallProgress = totalTasks > 0 ? completedCount / totalTasks : 0;
  const potentialTokens = tasks.reduce(
    (sum, t) => (t.claimed ? sum : sum + t.rewardTokens),
    0,
  );

  // Sort: claimable then in-progress then claimed
  const sortedTasks = useMemo(
    () =>
      [...tasks].sort((a, b) => {
        if (a.canClaim && !b.canClaim) return -1;
        if (!a.canClaim && b.canClaim) return 1;
        if (!a.claimed && b.claimed) return -1;
        if (a.claimed && !b.claimed) return 1;
        return a.sortOrder - b.sortOrder;
      }),
    [tasks],
  );

  // --- render helpers ---

  const renderTask = (task: TaskWithProgress) => {
    const progressPercent = getProgressPercentage(task.progress, task.target);
    const progressText = getProgressText(task.progress, task.target);
    const isClaiming = claiming === task.id;

    return (
      <Card
        key={task.id}
        style={[
          styles.taskCard,
          { backgroundColor: theme.colors.surfaceVariant },
          task.claimed && [
            styles.taskCardClaimed,
            { backgroundColor: theme.colors.surfaceDisabled },
          ],
        ]}
        mode="elevated"
      >
        <Card.Content>
          {/* Header row: icon + title + reward */}
          <View style={styles.taskHeader}>
            <View
              style={[
                styles.taskIcon,
                { backgroundColor: `${theme.colors.primary}20` },
                task.claimed && {
                  backgroundColor: `${theme.colors.onSurface}10`,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={task.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                size={24}
                color={
                  task.claimed
                    ? theme.colors.onSurfaceDisabled
                    : theme.colors.primary
                }
              />
            </View>

            <View style={styles.taskInfo}>
              <Text
                style={[
                  styles.taskTitle,
                  { color: theme.colors.onSurface },
                  task.claimed && { color: theme.colors.onSurfaceDisabled },
                ]}
              >
                {task.title}
              </Text>
              <Text
                style={[
                  styles.taskDescription,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {task.description}
              </Text>
            </View>

            <View style={styles.taskReward}>
              <Text
                style={[
                  styles.rewardAmount,
                  { color: theme.colors.primary },
                  task.claimed && { color: theme.colors.onSurfaceDisabled },
                ]}
              >
                +{task.rewardTokens}
              </Text>
              <MaterialCommunityIcons
                name="currency-usd"
                size={16}
                color={
                  task.claimed
                    ? theme.colors.onSurfaceDisabled
                    : theme.colors.primary
                }
              />
            </View>
          </View>

          {/* Progress */}
          <View style={styles.progressContainer}>
            <ProgressBar
              progress={progressPercent / 100}
              color={
                task.claimed
                  ? theme.colors.onSurfaceDisabled
                  : task.isCompleted
                    ? theme.colors.tertiary
                    : theme.colors.primary
              }
              style={[
                styles.progressBar,
                { backgroundColor: `${theme.colors.onSurface}10` },
              ]}
            />
            <Text
              style={[
                styles.progressText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {progressText}
            </Text>
          </View>

          {/* Claim button */}
          {task.canClaim && (
            <Button
              mode="contained"
              onPress={() => handleClaim(task)}
              loading={isClaiming}
              disabled={isClaiming}
              buttonColor={theme.colors.primary}
              textColor={theme.colors.onPrimary}
              style={styles.claimButton}
            >
              {isClaiming ? "Claiming..." : "Claim Reward"}
            </Button>
          )}

          {/* Claimed badge */}
          {task.claimed && (
            <View
              style={[
                styles.claimedBadge,
                { borderTopColor: theme.colors.outlineVariant },
              ]}
            >
              <MaterialCommunityIcons
                name="check-circle"
                size={16}
                color={theme.colors.tertiary}
              />
              <Text
                style={[styles.claimedText, { color: theme.colors.tertiary }]}
              >
                Claimed
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>
    );
  };

  // --- chrome (appbar) ---
  const renderAppbar = () => (
    <Appbar.Header
      statusBarHeight={0}
      style={[styles.appbar, { backgroundColor: theme.colors.background }]}
    >
      <Appbar.BackAction onPress={() => navigation.goBack()} />
      {/* Absolutely centered title so it aligns with the dynamic island /
          visible top-center area regardless of left/right content widths */}
      <View style={styles.appbarTitleOverlay} pointerEvents="none">
        <Text
          style={[
            styles.appbarTitleCentered,
            { color: theme.colors.onBackground },
          ]}
        >
          Tasks
        </Text>
      </View>
      {/* Spacer so balance badge stays right-aligned */}
      <View style={{ flex: 1 }} />
      <View
        style={[
          styles.balanceBadge,
          { backgroundColor: theme.colors.surfaceVariant },
        ]}
      >
        <MaterialCommunityIcons
          name="currency-usd"
          size={16}
          color={theme.colors.primary}
        />
        <Text style={[styles.balanceText, { color: theme.colors.onSurface }]}>
          {wallet ? formatTokenAmount(wallet.tokensBalance) : "0"}
        </Text>
      </View>
    </Appbar.Header>
  );

  // --- loading / error states ---
  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={["top"]}
      >
        {renderAppbar()}
        <LoadingState message="Loading tasks..." />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={["top"]}
      >
        {renderAppbar()}
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

  // --- main render ---
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      {renderAppbar()}

      {/* Tab selector */}
      <View style={styles.tabContainer}>
        <SegmentedButtons
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as TasksTab)}
          buttons={[
            {
              value: "daily",
              label: "Daily",
              icon: "calendar-today",
            },
            {
              value: "monthly",
              label: "Monthly",
              icon: "calendar-month",
            },
          ]}
          style={styles.segmentedButtons}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      >
        {/* Summary Card */}
        <Card
          style={[
            styles.summaryCard,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
          mode="elevated"
        >
          <Card.Content>
            <View style={styles.summaryHeader}>
              <View style={styles.summaryLeft}>
                <Text
                  style={[
                    styles.summaryTitle,
                    { color: theme.colors.onSurface },
                  ]}
                >
                  {activeTab === "daily"
                    ? "Today's Progress"
                    : "This Month's Progress"}
                </Text>
                <Text
                  style={[
                    styles.summarySubtitle,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {completedCount} of {totalTasks} completed
                </Text>
              </View>

              <View style={styles.resetTimer}>
                <MaterialCommunityIcons
                  name={
                    activeTab === "daily" ? "timer-outline" : "calendar-clock"
                  }
                  size={16}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text
                  style={[
                    styles.resetText,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {activeTab === "daily"
                    ? `Resets in ${timeUntilReset}`
                    : `${daysUntilMonthReset}d remaining`}
                </Text>
              </View>
            </View>

            {/* Overall progress bar */}
            <ProgressBar
              progress={overallProgress}
              color={theme.colors.primary}
              style={[
                styles.overallProgress,
                { backgroundColor: `${theme.colors.onSurface}10` },
              ]}
            />

            {/* Unclaimed rewards */}
            {potentialTokens > 0 && (
              <View
                style={[
                  styles.potentialRow,
                  { borderTopColor: theme.colors.outlineVariant },
                ]}
              >
                <Text
                  style={[
                    styles.potentialLabel,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  Unclaimed rewards:
                </Text>
                <View style={styles.potentialAmount}>
                  <Text
                    style={[
                      styles.potentialValue,
                      { color: theme.colors.primary },
                    ]}
                  >
                    +{potentialTokens}
                  </Text>
                  <MaterialCommunityIcons
                    name="currency-usd"
                    size={14}
                    color={theme.colors.primary}
                  />
                </View>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Monthly bonus info */}
        {activeTab === "monthly" && (
          <Card
            style={[
              styles.monthlyInfoCard,
              { backgroundColor: `${theme.colors.primary}10` },
            ]}
            mode="contained"
          >
            <Card.Content style={styles.monthlyInfoContent}>
              <MaterialCommunityIcons
                name="information-outline"
                size={18}
                color={theme.colors.primary}
              />
              <Text
                style={[
                  styles.monthlyInfoText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Monthly tasks offer bigger rewards and reset on the 1st of each
                month. Progress accumulates across daily activity!
              </Text>
            </Card.Content>
          </Card>
        )}

        {/* Tasks list */}
        {sortedTasks.length === 0 ? (
          <EmptyState
            icon="checkbox-marked-circle-outline"
            title={
              activeTab === "daily"
                ? "No Daily Tasks Available"
                : "No Monthly Tasks Available"
            }
            subtitle={
              activeTab === "daily"
                ? "Check back later for new daily tasks!"
                : "No monthly challenges right now. Check back soon!"
            }
          />
        ) : (
          <View style={styles.tasksList}>{sortedTasks.map(renderTask)}</View>
        )}
      </ScrollView>

      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ ...snackbar, visible: false })}
        duration={3000}
        style={[
          styles.snackbar,
          { backgroundColor: theme.colors.inverseSurface },
        ]}
      >
        {snackbar.message}
      </Snackbar>
    </SafeAreaView>
  );
}

// =============================================================================
// Styles
// =============================================================================

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
  appbarTitleOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  appbarTitleCentered: {
    fontSize: 20,
    fontWeight: "bold",
  },
  balanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
  },
  balanceText: {
    fontWeight: "bold",
    marginLeft: Spacing.xs,
  },
  tabContainer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  segmentedButtons: {
    // Paper provides defaults
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
  },

  // --- Summary card ---
  summaryCard: {
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  summaryLeft: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  summarySubtitle: {
    fontSize: 14,
    marginTop: Spacing.xs,
  },
  resetTimer: {
    flexDirection: "row",
    alignItems: "center",
  },
  resetText: {
    fontSize: 12,
    marginLeft: Spacing.xs,
  },
  overallProgress: {
    height: 8,
    borderRadius: BorderRadius.xs,
  },
  potentialRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  potentialLabel: {
    fontSize: 14,
  },
  potentialAmount: {
    flexDirection: "row",
    alignItems: "center",
  },
  potentialValue: {
    fontSize: 16,
    fontWeight: "bold",
    marginRight: Spacing.xs,
  },

  // --- Monthly info card ---
  monthlyInfoCard: {
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  monthlyInfoContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  monthlyInfoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },

  // --- Task cards ---
  tasksList: {
    gap: Spacing.md,
  },
  taskCard: {
    borderRadius: BorderRadius.md,
  },
  taskCardClaimed: {
    opacity: 0.7,
  },
  taskHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  taskIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  taskDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  taskReward: {
    flexDirection: "row",
    alignItems: "center",
  },
  rewardAmount: {
    fontSize: 18,
    fontWeight: "bold",
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  progressBar: {
    flex: 1,
    height: 6,
    borderRadius: BorderRadius.xs,
  },
  progressText: {
    fontSize: 12,
    minWidth: 50,
    textAlign: "right",
  },
  claimButton: {
    marginTop: Spacing.md,
  },
  claimedBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  claimedText: {
    fontSize: 14,
    fontWeight: "500",
    marginLeft: Spacing.xs,
  },
  snackbar: {},
});
