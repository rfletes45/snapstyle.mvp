/**
 * TasksScreen
 *
 * Features:
 * - Daily task list with progress tracking
 * - Claim rewards for completed tasks
 * - Time until daily reset
 * - Real-time progress updates
 */

import { EmptyState, ErrorState, LoadingState } from "@/components/ui";
import { formatTokenAmount, subscribeToWallet } from "@/services/economy";
import { getAppInstance } from "@/services/firebase";
import {
  claimTaskReward,
  getProgressPercentage,
  getProgressText,
  getTimeUntilReset,
  subscribeToTasksWithProgress,
} from "@/services/tasks";
import { useAuth } from "@/store/AuthContext";
import { TaskWithProgress, Wallet } from "@/types/models";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { getFunctions, httpsCallable } from "firebase/functions";
import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import {
  Appbar,
  Button,
  Card,
  ProgressBar,
  Snackbar,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { BorderRadius, Spacing } from "../../../constants/theme";

export default function TasksScreen({ navigation }: any) {
  const { currentFirebaseUser } = useAuth();
  const user = currentFirebaseUser;
  const theme = useTheme();

  const [tasks, setTasks] = useState<TaskWithProgress[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{
    visible: boolean;
    message: string;
  }>({
    visible: false,
    message: "",
  });
  const [timeUntilReset, setTimeUntilReset] = useState(getTimeUntilReset());

  // Subscribe to tasks and wallet
  useEffect(() => {
    if (!user) return;

    setLoading(true);
    setError(null);

    // Subscribe to tasks with progress
    const unsubTasks = subscribeToTasksWithProgress(
      user.uid,
      (updatedTasks) => {
        setTasks(updatedTasks);
        setLoading(false);
      },
    );

    // Subscribe to wallet for balance display
    const unsubWallet = subscribeToWallet(user.uid, (updatedWallet) => {
      setWallet(updatedWallet);
    });

    // Record daily login
    recordDailyLogin();

    return () => {
      unsubTasks();
      unsubWallet();
    };
  }, [user]);

  // Update reset timer every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeUntilReset(getTimeUntilReset());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Record daily login for task progress
  const recordDailyLogin = async () => {
    try {
      const app = getAppInstance();
      const functions = getFunctions(app);
      const recordLogin = httpsCallable(functions, "recordDailyLogin");
      await recordLogin({});
      console.log("[TasksScreen] Daily login recorded");
    } catch (error) {
      console.error("[TasksScreen] Error recording daily login:", error);
    }
  };

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeUntilReset(getTimeUntilReset());
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  // Handle claim reward
  const handleClaim = async (task: TaskWithProgress) => {
    if (claiming || !task.canClaim) return;

    setClaiming(task.id);

    try {
      const result = await claimTaskReward(task.id);

      if (result.success) {
        let message = `+${result.tokensAwarded} tokens earned!`;
        if (result.itemAwarded) {
          message += " 🎁 New item unlocked!";
        }
        setSnackbar({ visible: true, message });
      } else {
        setSnackbar({
          visible: true,
          message: result.error || "Failed to claim reward",
        });
      }
    } catch (error: any) {
      console.error("[TasksScreen] Claim error:", error);
      setSnackbar({
        visible: true,
        message: error.message || "Failed to claim reward",
      });
    } finally {
      setClaiming(null);
    }
  };

  // Calculate overall progress
  const completedCount = tasks.filter((t) => t.isCompleted).length;
  const totalTasks = tasks.length;
  const overallProgress = totalTasks > 0 ? completedCount / totalTasks : 0;

  // Calculate potential tokens
  const potentialTokens = tasks.reduce((sum, t) => {
    if (!t.claimed) return sum + t.rewardTokens;
    return sum;
  }, 0);

  // Render task item
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
                name={task.icon as any}
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

          {/* Progress Bar */}
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

          {/* Claim Button */}
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
            title="Daily Tasks"
            titleStyle={[
              styles.appbarTitle,
              { color: theme.colors.onBackground },
            ]}
          />
        </Appbar.Header>
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
        <Appbar.Header
          style={[styles.appbar, { backgroundColor: theme.colors.background }]}
        >
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content
            title="Daily Tasks"
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
          title="Daily Tasks"
          titleStyle={[
            styles.appbarTitle,
            { color: theme.colors.onBackground },
          ]}
        />
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
              <View>
                <Text
                  style={[
                    styles.summaryTitle,
                    { color: theme.colors.onSurface },
                  ]}
                >
                  Today's Progress
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
                  name="timer-outline"
                  size={16}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text
                  style={[
                    styles.resetText,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  Resets in {timeUntilReset}
                </Text>
              </View>
            </View>

            <ProgressBar
              progress={overallProgress}
              color={theme.colors.primary}
              style={[
                styles.overallProgress,
                { backgroundColor: `${theme.colors.onSurface}10` },
              ]}
            />

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

        {/* Tasks List */}
        {tasks.length === 0 ? (
          <EmptyState
            icon="checkbox-marked-circle-outline"
            title="No Tasks Available"
            subtitle="Check back later for new daily tasks!"
          />
        ) : (
          <View style={styles.tasksList}>
            {/* Unclaimed tasks first, then claimed */}
            {tasks
              .sort((a, b) => {
                // Sort: can claim > not completed > claimed
                if (a.canClaim && !b.canClaim) return -1;
                if (!a.canClaim && b.canClaim) return 1;
                if (!a.claimed && b.claimed) return -1;
                if (a.claimed && !b.claimed) return 1;
                return a.sortOrder - b.sortOrder;
              })
              .map(renderTask)}
          </View>
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
  },
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
  snackbar: {
    // Color applied inline
  },
});
