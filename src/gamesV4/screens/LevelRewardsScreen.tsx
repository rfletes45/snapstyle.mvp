/**
 * Games V4 � Level Rewards Screen (Battlepass Track)
 *
 * Full-screen view with:
 * - Level + XP header (Level N, XP/XPNeeded, XP remaining)
 * - Horizontal battlepass tier track (all 50 levels)
 * - Claim All banner when unclaimed rewards exist
 * - Tier details bottom sheet on tap
 *
 * Replaces the old vertical-list design.
 *
 * @module gamesV4/screens/LevelRewardsScreen
 */

import { LEVEL_REWARDS, MAX_REWARD_LEVEL } from "@/data/levelRewards";
import LevelRewardsTrack from "@/gamesV4/components/LevelRewardsTrack";
import type { LevelRewardDocV4 } from "@/gamesV4/services/gameServiceV4";
import {
  claimLevelReward,
  subscribeToLevelRewards,
} from "@/gamesV4/services/gameServiceV4";
import { useProfileData } from "@/hooks/useProfileData";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import type { MainStackParamList } from "@/types/navigation/root";
import type { LevelInfo } from "@/types/profile";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ProgressBar } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

type Nav = NativeStackNavigationProp<MainStackParamList>;

// =============================================================================
// Component
// =============================================================================

export default function LevelRewardsScreen() {
  const { theme } = useAppTheme();
  const { currentFirebaseUser } = useAuth();
  const navigation = useNavigation<Nav>();
  const uid = currentFirebaseUser?.uid;
  const { levelInfo: profileLevel } = useProfileData(uid);

  const [rewards, setRewards] = useState<LevelRewardDocV4[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingLevel, setClaimingLevel] = useState<number | null>(null);

  const currentLevel = profileLevel?.current ?? 1;
  const isMaxLevel = currentLevel >= MAX_REWARD_LEVEL;
  const levelInfo: LevelInfo = profileLevel ?? {
    current: 0,
    xp: 0,
    xpToNextLevel: 100,
    totalXp: 0,
  };

  // XP display values
  const xpCurrent = levelInfo.xp;
  const xpNeeded = levelInfo.xpToNextLevel;

  // Subscribe to user's level rewards
  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeToLevelRewards(
      uid,
      (data) => {
        setRewards(data);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [uid]);

  // Count unclaimed rewards
  const unclaimedCount = useMemo(
    () => rewards.filter((r) => r.claimedAt === null).length,
    [rewards],
  );

  // Claim a single reward
  const handleClaim = useCallback(
    async (level: number) => {
      if (claimingLevel !== null) return;
      setClaimingLevel(level);
      try {
        const result = await claimLevelReward({ level });
        if (result.success && !result.alreadyClaimed) {
          const def = LEVEL_REWARDS.find((r) => r.level === level);
          const msg = result.cosmeticGranted
            ? `+${result.tokensGranted} tokens + ${def?.label ?? "cosmetic"}!`
            : `+${result.tokensGranted} tokens!`;
          Alert.alert("Reward Claimed!", msg);
        } else if (result.alreadyClaimed) {
          Alert.alert("Already Claimed", "This reward was already claimed.");
        } else {
          Alert.alert("Error", result.error ?? "Failed to claim reward.");
        }
      } catch {
        Alert.alert("Error", "Network error. Please try again.");
      } finally {
        setClaimingLevel(null);
      }
    },
    [claimingLevel],
  );

  // Claim all unclaimed rewards
  const handleClaimAll = useCallback(async () => {
    const unclaimed = rewards.filter((r) => r.claimedAt === null);
    if (unclaimed.length === 0) return;

    setClaimingLevel(-1);
    let claimedCount = 0;
    let totalTokens = 0;

    for (const r of unclaimed) {
      try {
        const result = await claimLevelReward({ level: r.level });
        if (result.success && !result.alreadyClaimed) {
          claimedCount++;
          totalTokens += result.tokensGranted ?? 0;
        }
      } catch {
        // Continue to next
      }
    }

    setClaimingLevel(null);
    if (claimedCount > 0) {
      Alert.alert(
        "Rewards Claimed!",
        `Claimed ${claimedCount} rewards (+${totalTokens} tokens)`,
      );
    }
  }, [rewards]);

  // Theme colors
  const bgColor = theme.isDark ? "#000" : "#FFF";
  const cardBg = theme.isDark ? "#1C1C1E" : "#F2F2F7";
  const textColor = theme.isDark ? "#FFF" : "#000";
  const subColor = theme.isDark ? "#AAA" : "#666";

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
        <ActivityIndicator size="large" color={textColor} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={textColor}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]}>
          Level Rewards
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Level + XP display card */}
        <View style={[styles.levelCard, { backgroundColor: cardBg }]}>
          <View style={styles.levelHeaderRow}>
            <View style={styles.levelBadgeLarge}>
              <MaterialCommunityIcons
                name="star-circle"
                size={24}
                color={theme.colors.primary}
              />
              <Text style={[styles.levelNumber, { color: textColor }]}>
                Level {currentLevel}
                {isMaxLevel ? " (MAX)" : ""}
              </Text>
            </View>
            {isMaxLevel && (
              <View style={styles.maxPill}>
                <MaterialCommunityIcons
                  name="crown"
                  size={14}
                  color="#FFD700"
                />
                <Text style={styles.maxPillText}>MAX</Text>
              </View>
            )}
          </View>

          {/* XP Progress bar */}
          <ProgressBar
            progress={
              isMaxLevel
                ? 1
                : xpNeeded > 0
                  ? Math.min(1, xpCurrent / xpNeeded)
                  : 0
            }
            color={theme.colors.primary}
            style={{
              height: 8,
              borderRadius: 4,
              backgroundColor: theme.isDark ? "#333" : "#E0E0E0",
            }}
          />

          {/* Explicit XP numbers */}
          <View style={styles.xpNumbersRow}>
            <Text style={[styles.xpNumbers, { color: subColor }]}>
              {isMaxLevel
                ? `${xpNeeded.toLocaleString()}/${xpNeeded.toLocaleString()} XP`
                : `${xpCurrent.toLocaleString()}/${xpNeeded.toLocaleString()} XP`}
            </Text>
            {!isMaxLevel && (
              <Text style={[styles.xpPercent, { color: theme.colors.primary }]}>
                {xpNeeded > 0
                  ? `${Math.round((xpCurrent / xpNeeded) * 100)}%`
                  : "0%"}
              </Text>
            )}
          </View>
        </View>

        {/* Unclaimed claim-all banner */}
        {unclaimedCount > 0 && (
          <View
            style={[
              styles.claimBanner,
              { backgroundColor: theme.isDark ? "#1A2A1A" : "#E8F5E9" },
            ]}
          >
            <View style={styles.claimBannerLeft}>
              <MaterialCommunityIcons name="gift" size={20} color="#34C759" />
              <Text
                style={[
                  styles.claimBannerText,
                  { color: theme.isDark ? "#7CFC00" : "#2E7D32" },
                ]}
              >
                {unclaimedCount} unclaimed reward
                {unclaimedCount !== 1 ? "s" : ""}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.claimAllButton,
                claimingLevel === -1 && { opacity: 0.6 },
              ]}
              onPress={handleClaimAll}
              disabled={claimingLevel !== null}
            >
              {claimingLevel === -1 ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.claimAllText}>Claim All</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Battlepass Tier Track */}
        <LevelRewardsTrack
          levelInfo={levelInfo}
          rewardDocs={rewards}
          onClaim={handleClaim}
          claimingLevel={claimingLevel}
        />

        {/* Legend */}
        <View style={[styles.legend, { borderTopColor: cardBg }]}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#34C759" }]} />
            <Text style={[styles.legendText, { color: subColor }]}>
              Claimed
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#007AFF" }]} />
            <Text style={[styles.legendText, { color: subColor }]}>
              Claimable
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View
              style={[
                styles.legendDot,
                { backgroundColor: theme.isDark ? "#555" : "#CCC" },
              ]}
            />
            <Text style={[styles.legendText, { color: subColor }]}>Locked</Text>
          </View>
          <View style={styles.legendItem}>
            <View
              style={[
                styles.legendDot,
                {
                  backgroundColor: "#FFD700",
                  borderWidth: 1,
                  borderColor: "#FFD700",
                },
              ]}
            />
            <Text style={[styles.legendText, { color: subColor }]}>
              Milestone
            </Text>
          </View>
        </View>

        {/* Stats summary */}
        <View style={[styles.statsCard, { backgroundColor: cardBg }]}>
          <Text style={[styles.statsSectionTitle, { color: subColor }]}>
            PROGRESS SUMMARY
          </Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: textColor }]}>
                {
                  rewards.filter(
                    (r) => r.claimedAt !== null && r.claimedAt !== undefined,
                  ).length
                }
              </Text>
              <Text style={[styles.statLabel, { color: subColor }]}>
                Claimed
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: "#007AFF" }]}>
                {unclaimedCount}
              </Text>
              <Text style={[styles.statLabel, { color: subColor }]}>
                Unclaimed
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: textColor }]}>
                {MAX_REWARD_LEVEL - currentLevel}
              </Text>
              <Text style={[styles.statLabel, { color: subColor }]}>
                Remaining
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: textColor }]}>
                {currentLevel}/{MAX_REWARD_LEVEL}
              </Text>
              <Text style={[styles.statLabel, { color: subColor }]}>Level</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
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
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  headerSpacer: {
    width: 32,
  },
  scrollContent: {
    paddingBottom: 16,
  },

  // Level card
  levelCard: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
  },
  levelHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  levelBadgeLarge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  levelNumber: {
    fontSize: 20,
    fontWeight: "800",
  },
  maxPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,215,0,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  maxPillText: {
    color: "#FFD700",
    fontWeight: "800",
    fontSize: 12,
  },
  xpNumbersRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  xpNumbers: {
    fontSize: 13,
    fontWeight: "600",
  },
  xpPercent: {
    fontSize: 13,
    fontWeight: "700",
  },

  // Claim banner
  claimBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  claimBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  claimBannerText: {
    fontSize: 14,
    fontWeight: "700",
  },
  claimAllButton: {
    backgroundColor: "#34C759",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 80,
    alignItems: "center",
  },
  claimAllText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 13,
  },

  // Legend
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11,
    fontWeight: "600",
  },

  // Stats card
  statsCard: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 14,
    marginTop: 8,
  },
  statsSectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
});
