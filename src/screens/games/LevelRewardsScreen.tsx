/**
 * LevelRewardsScreen
 *
 * Horizontal scrolling progress track from level 1 to 50.
 * Each level is a node showing its number.
 * - Claimed → checkmark badge
 * - Claimable (level reached, not yet claimed) → "Claim" button
 * - Locked (level not reached) → greyed out
 *
 * Milestones (every 5th level) are enlarged with a trophy icon.
 *
 * @see docs/features/games.md — Level Rewards
 */

import { BorderRadius, Spacing } from "@/constants/theme";
import type { LevelReward } from "@/data/levelRewards";
import {
  getRewardForLevel,
  LEVEL_REWARDS,
  MAX_REWARD_LEVEL,
} from "@/data/levelRewards";
import { usePlayerSummary } from "@/hooks/usePlayerSummary";
import {
  claimLevelReward,
  getClaimedLevels,
} from "@/services/levelRewardsService";
import { useAuth } from "@/store/AuthContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Dialog, Snackbar, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

// =============================================================================
// Node sizing
// =============================================================================

const NODE_SIZE = 64;
const MILESTONE_SIZE = 80;
const NODE_GAP = 12;
const CONNECTOR_HEIGHT = 3;

// =============================================================================
// Main Screen
// =============================================================================

export default function LevelRewardsScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { currentFirebaseUser } = useAuth();
  const { summary } = usePlayerSummary();

  const currentLevel = summary.level.current;

  // State
  const [claimedLevels, setClaimedLevels] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<number | null>(null);
  const [snackMsg, setSnackMsg] = useState("");
  const [snackVisible, setSnackVisible] = useState(false);
  const [dialogReward, setDialogReward] = useState<LevelReward | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Fetch claimed levels on mount
  useEffect(() => {
    if (!currentFirebaseUser?.uid) return;
    let cancelled = false;
    (async () => {
      const levels = await getClaimedLevels(currentFirebaseUser.uid);
      if (!cancelled) {
        setClaimedLevels(new Set(levels));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentFirebaseUser?.uid]);

  // Scroll to first claimable node on load
  useEffect(() => {
    if (loading) return;
    const firstClaimable = LEVEL_REWARDS.findIndex(
      (r) => r.level <= currentLevel && !claimedLevels.has(r.level),
    );
    if (firstClaimable > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: firstClaimable,
          animated: true,
          viewPosition: 0.4,
        });
      }, 300);
    }
  }, [loading, currentLevel, claimedLevels]);

  // Claim handler
  const handleClaim = useCallback(async (level: number) => {
    setClaiming(level);
    try {
      const result = await claimLevelReward(level);
      if (result.success) {
        setClaimedLevels((prev) => new Set([...prev, level]));
        const reward = getRewardForLevel(level);
        if (reward?.isMilestone) {
          setDialogReward(reward);
        } else {
          setSnackMsg(`Claimed Level ${level}: +${result.amount} Tokens!`);
          setSnackVisible(true);
        }
      } else {
        setSnackMsg(result.message || "Could not claim reward");
        setSnackVisible(true);
      }
    } catch (err: any) {
      setSnackMsg(err?.message || "Failed to claim reward");
      setSnackVisible(true);
    } finally {
      setClaiming(null);
    }
  }, []);

  // Status for each node
  const getNodeStatus = useCallback(
    (level: number): "claimed" | "claimable" | "locked" => {
      if (claimedLevels.has(level)) return "claimed";
      if (level <= currentLevel) return "claimable";
      return "locked";
    },
    [claimedLevels, currentLevel],
  );

  // Claimable count for header badge
  const claimableCount = useMemo(
    () =>
      LEVEL_REWARDS.filter(
        (r) => r.level <= currentLevel && !claimedLevels.has(r.level),
      ).length,
    [currentLevel, claimedLevels],
  );

  // Render each node
  const renderNode = useCallback(
    ({ item, index }: { item: LevelReward; index: number }) => {
      const status = getNodeStatus(item.level);
      const size = item.isMilestone ? MILESTONE_SIZE : NODE_SIZE;
      const isClaimable = status === "claimable";
      const isClaimed = status === "claimed";
      const isLocked = status === "locked";

      const bgColor = isClaimed
        ? theme.colors.primaryContainer
        : isClaimable
          ? theme.colors.primary
          : (theme.colors.surfaceDisabled ?? theme.colors.surfaceVariant);

      const textColor = isClaimed
        ? theme.colors.onPrimaryContainer
        : isClaimable
          ? theme.colors.onPrimary
          : (theme.colors.onSurfaceDisabled ?? theme.colors.onSurfaceVariant);

      return (
        <View style={styles.nodeWrapper}>
          {/* Connector line to previous node */}
          {index > 0 && (
            <View
              style={[
                styles.connector,
                {
                  backgroundColor:
                    item.level <= currentLevel
                      ? theme.colors.primary
                      : theme.colors.surfaceVariant,
                },
              ]}
            />
          )}

          <TouchableOpacity
            style={[
              styles.node,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: bgColor,
                borderWidth: item.isMilestone ? 3 : 1,
                borderColor: item.isMilestone
                  ? theme.colors.primary
                  : theme.colors.outlineVariant,
              },
            ]}
            disabled={!isClaimable || claiming !== null}
            onPress={() => handleClaim(item.level)}
            activeOpacity={0.7}
            accessibilityLabel={`Level ${item.level} — ${status}`}
          >
            {/* Claimed check */}
            {isClaimed && (
              <MaterialCommunityIcons
                name="check-circle"
                size={item.isMilestone ? 28 : 22}
                color={theme.colors.primary}
              />
            )}

            {/* Claimable — show level number + claim indicator */}
            {isClaimable && (
              <>
                {claiming === item.level ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.onPrimary}
                  />
                ) : (
                  <>
                    {item.isMilestone && (
                      <MaterialCommunityIcons
                        name={
                          item.rewardType === "background_entitlement"
                            ? "image-area"
                            : "trophy-award"
                        }
                        size={18}
                        color={textColor}
                      />
                    )}
                    <Text
                      style={[
                        styles.nodeLevel,
                        {
                          color: textColor,
                          fontSize: item.isMilestone ? 14 : 12,
                        },
                      ]}
                    >
                      {item.level}
                    </Text>
                    <Text style={[styles.claimLabel, { color: textColor }]}>
                      Claim
                    </Text>
                  </>
                )}
              </>
            )}

            {/* Locked */}
            {isLocked && (
              <>
                {item.isMilestone && (
                  <MaterialCommunityIcons
                    name="lock"
                    size={16}
                    color={textColor}
                  />
                )}
                <Text
                  style={[
                    styles.nodeLevel,
                    { color: textColor, fontSize: item.isMilestone ? 14 : 12 },
                  ]}
                >
                  {item.level}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Reward label below */}
          <Text
            style={[
              styles.rewardLabel,
              {
                color: isLocked
                  ? theme.colors.onSurfaceVariant
                  : theme.colors.onSurface,
                fontWeight: item.isMilestone ? "700" : "400",
              },
            ]}
            numberOfLines={2}
          >
            {item.label}
          </Text>
        </View>
      );
    },
    [getNodeStatus, currentLevel, claiming, handleClaim, theme],
  );

  const keyExtractor = useCallback(
    (item: LevelReward) => String(item.level),
    [],
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityLabel="Go back"
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={theme.colors.onSurface}
          />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          Level Rewards
        </Text>
        {claimableCount > 0 && (
          <View style={[styles.badge, { backgroundColor: theme.colors.error }]}>
            <Text style={[styles.badgeText, { color: theme.colors.onError }]}>
              {claimableCount}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
      </View>

      {/* Level + XP summary */}
      <View
        style={[
          styles.summaryCard,
          { backgroundColor: theme.colors.surfaceVariant },
        ]}
      >
        <View style={styles.summaryRow}>
          <MaterialCommunityIcons
            name="star-four-points"
            size={20}
            color={theme.colors.primary}
          />
          <Text style={[styles.summaryText, { color: theme.colors.onSurface }]}>
            Level {currentLevel}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text
            style={[styles.summaryXp, { color: theme.colors.onSurfaceVariant }]}
          >
            {summary.level.xp.toLocaleString()} /{" "}
            {summary.level.xpToNextLevel.toLocaleString()} XP
          </Text>
        </View>
        {/* XP progress */}
        <View
          style={[styles.xpTrack, { backgroundColor: theme.colors.surface }]}
        >
          <View
            style={[
              styles.xpFill,
              {
                backgroundColor: theme.colors.primary,
                width: `${Math.round(
                  Math.min(
                    (summary.level.xp / summary.level.xpToNextLevel) * 100,
                    100,
                  ),
                )}%`,
              },
            ]}
          />
        </View>
        <Text
          style={[
            styles.summaryTotal,
            { color: theme.colors.onSurfaceVariant },
          ]}
        >
          Total XP: {summary.level.totalXp.toLocaleString()} • Cap: Level{" "}
          {MAX_REWARD_LEVEL}
        </Text>
      </View>

      {/* Horizontal reward track */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={LEVEL_REWARDS}
          renderItem={renderNode}
          keyExtractor={keyExtractor}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.trackContent}
          onScrollToIndexFailed={() => {}}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
        />
      )}

      {/* Milestone claim dialog */}
      <Dialog
        visible={dialogReward !== null}
        onDismiss={() => setDialogReward(null)}
      >
        <Dialog.Title>
          {dialogReward?.rewardType === "background_entitlement"
            ? "🎨 Background Unlocked!"
            : "🏆 Milestone Reward!"}
        </Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyLarge">
            Level {dialogReward?.level} — {dialogReward?.label}
          </Text>
          <Text
            variant="bodyMedium"
            style={{ marginTop: 8, color: theme.colors.onSurfaceVariant }}
          >
            {dialogReward?.rewardType === "background_entitlement"
              ? "New profile background added to your collection! Equip it from your profile."
              : `+${dialogReward?.amount} Tokens`}
          </Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => setDialogReward(null)}>Awesome!</Button>
        </Dialog.Actions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        visible={snackVisible}
        onDismiss={() => setSnackVisible(false)}
        duration={2500}
      >
        {snackMsg}
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },

  // Summary
  summaryCard: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: 6,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  summaryText: {
    fontSize: 16,
    fontWeight: "700",
  },
  summaryXp: {
    fontSize: 13,
  },
  summaryTotal: {
    fontSize: 11,
    textAlign: "center",
  },
  xpTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  xpFill: {
    height: "100%",
    borderRadius: 4,
  },

  // Track
  trackContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    alignItems: "flex-start",
    gap: NODE_GAP,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // Node
  nodeWrapper: {
    alignItems: "center",
    width: MILESTONE_SIZE + 16,
    gap: 6,
  },
  node: {
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  nodeLevel: {
    fontWeight: "700",
  },
  claimLabel: {
    fontSize: 9,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  rewardLabel: {
    fontSize: 10,
    textAlign: "center",
    lineHeight: 13,
  },

  // Connector
  connector: {
    position: "absolute",
    left: -NODE_GAP - 4,
    top: NODE_SIZE / 2,
    width: NODE_GAP + 8,
    height: CONNECTOR_HEIGHT,
    borderRadius: 1.5,
  },
});
