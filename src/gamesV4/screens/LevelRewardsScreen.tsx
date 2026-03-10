/**
 * Games V4 — Level Rewards Screen (Redesigned Vertical Journey)
 *
 * Premium unified progression screen with:
 * - Hero section: level ring, XP progress bar, next reward, claim all
 * - Vertical reward journey: connected timeline with tier nodes
 * - Polished tier details bottom sheet on tap
 *
 * 50 total levels · milestone every 5 · claim flow via claimLevelRewardV4
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
import { useColors } from "@/store/ThemeContext";
import type { MainStackParamList } from "@/types/navigation/root";
import type { LevelInfo } from "@/types/profile";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

type Nav = NativeStackNavigationProp<MainStackParamList>;

// =============================================================================
// Progress Ring (SVG circular indicator for hero)
// =============================================================================

const RING_SIZE = 88;
const RING_STROKE = 6;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function ProgressRing({
  progress,
  color,
  trackColor,
}: {
  progress: number;
  color: string;
  trackColor: string;
}) {
  const offset = RING_CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, progress)));
  return (
    <Svg width={RING_SIZE} height={RING_SIZE}>
      <Circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        stroke={trackColor}
        strokeWidth={RING_STROKE}
        fill="transparent"
      />
      <Circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        stroke={color}
        strokeWidth={RING_STROKE}
        fill="transparent"
        strokeDasharray={`${RING_CIRCUMFERENCE}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        rotation="-90"
        origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
      />
    </Svg>
  );
}

// =============================================================================
// Component
// =============================================================================

export default function LevelRewardsScreen() {
  const colors = useColors();
  const { currentFirebaseUser } = useAuth();
  const navigation = useNavigation<Nav>();
  const uid = currentFirebaseUser?.uid;
  const { levelInfo: profileLevel } = useProfileData(uid);

  const [rewards, setRewards] = useState<LevelRewardDocV4[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingLevel, setClaimingLevel] = useState<number | null>(null);

  // Animated progress bar fill
  const progressAnim = useRef(new Animated.Value(0)).current;

  const currentLevel = profileLevel?.current ?? 1;
  const isMaxLevel = currentLevel >= MAX_REWARD_LEVEL;
  const levelInfo: LevelInfo = profileLevel ?? {
    current: 1,
    xp: 0,
    xpToNextLevel: 100,
    totalXp: 0,
  };

  const xpCurrent = levelInfo.xp;
  const xpNeeded = levelInfo.xpToNextLevel;
  const xpProgress = isMaxLevel
    ? 1
    : xpNeeded > 0
      ? Math.min(1, xpCurrent / xpNeeded)
      : 0;
  const xpPercent = Math.round(xpProgress * 100);

  // Animate progress bar on mount / level change
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: xpProgress,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [xpProgress, progressAnim]);

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

  // Compute next reward (first reward at a level > currentLevel)
  const nextReward = useMemo(() => {
    if (isMaxLevel) return null;
    return LEVEL_REWARDS.find((r) => r.level === currentLevel + 1) ?? null;
  }, [currentLevel, isMaxLevel]);

  // Next milestone reward
  const nextMilestone = useMemo(() => {
    const nextMs = Math.ceil((currentLevel + 1) / 5) * 5;
    if (nextMs > MAX_REWARD_LEVEL) return null;
    return LEVEL_REWARDS.find((r) => r.level === nextMs) ?? null;
  }, [currentLevel]);

  // Unclaimed count
  const unclaimedCount = useMemo(
    () => rewards.filter((r) => r.claimedAt === null).length,
    [rewards],
  );

  // Claimed count
  const claimedCount = useMemo(
    () =>
      rewards.filter((r) => r.claimedAt !== null && r.claimedAt !== undefined)
        .length,
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
    let claimed = 0;
    let totalTokens = 0;

    for (const r of unclaimed) {
      try {
        const result = await claimLevelReward({ level: r.level });
        if (result.success && !result.alreadyClaimed) {
          claimed++;
          totalTokens += result.tokensGranted ?? 0;
        }
      } catch {
        // Continue to next
      }
    }

    setClaimingLevel(null);
    if (claimed > 0) {
      Alert.alert(
        "Rewards Claimed!",
        `Claimed ${claimed} rewards (+${totalTokens} tokens)`,
      );
    }
  }, [rewards]);

  // ─── Loading state ──────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={{ flex: 1 }}
        />
      </SafeAreaView>
    );
  }

  // ─── Derived display helpers ────────────────────────────────────────
  const progressBarWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.backButton}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Level Rewards
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ══════════════════════════════════════════════════════════════
            HERO SECTION — unified progress module
           ══════════════════════════════════════════════════════════════ */}
        <View style={[styles.heroCard, { backgroundColor: colors.surface }]}>
          {/* Level Ring + Info Row */}
          <View style={styles.heroTopRow}>
            {/* Circular progress ring with level number */}
            <View style={styles.ringContainer}>
              <ProgressRing
                progress={xpProgress}
                color={colors.primary}
                trackColor={colors.surfaceVariant}
              />
              <View style={styles.ringCenter}>
                <Text style={[styles.ringLevel, { color: colors.text }]}>
                  {currentLevel}
                </Text>
                {isMaxLevel && (
                  <MaterialCommunityIcons
                    name="crown"
                    size={14}
                    color="#FFD700"
                  />
                )}
              </View>
            </View>

            {/* Level text + XP info */}
            <View style={styles.heroInfo}>
              <Text style={[styles.heroLevelText, { color: colors.text }]}>
                Level {currentLevel}
                {isMaxLevel ? " — MAX" : ""}
              </Text>
              <Text
                style={[styles.heroXpSubtext, { color: colors.textSecondary }]}
              >
                {isMaxLevel
                  ? "All levels complete!"
                  : `${(xpNeeded - xpCurrent).toLocaleString()} XP to Level ${currentLevel + 1}`}
              </Text>

              {/* Mini stats row */}
              <View style={styles.miniStatsRow}>
                <View
                  style={[
                    styles.miniStat,
                    { backgroundColor: colors.surfaceVariant },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={12}
                    color="#34C759"
                  />
                  <Text
                    style={[
                      styles.miniStatText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {claimedCount}
                  </Text>
                </View>
                {unclaimedCount > 0 && (
                  <View
                    style={[
                      styles.miniStat,
                      { backgroundColor: colors.primary + "18" },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="gift"
                      size={12}
                      color={colors.primary}
                    />
                    <Text
                      style={[styles.miniStatText, { color: colors.primary }]}
                    >
                      {unclaimedCount}
                    </Text>
                  </View>
                )}
                <View
                  style={[
                    styles.miniStat,
                    { backgroundColor: colors.surfaceVariant },
                  ]}
                >
                  <Text
                    style={[
                      styles.miniStatText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {currentLevel}/{MAX_REWARD_LEVEL}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* ── XP Progress Bar (thick, premium) ────────────────────── */}
          <View style={styles.progressSection}>
            <View
              style={[
                styles.progressTrack,
                { backgroundColor: colors.surfaceVariant },
              ]}
            >
              <Animated.View
                style={[styles.progressFillWrap, { width: progressBarWidth }]}
              >
                <LinearGradient
                  colors={[
                    colors.primary,
                    colors.secondary ?? colors.primary + "CC",
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.progressFill}
                />
              </Animated.View>
            </View>
            <View style={styles.xpRow}>
              <Text style={[styles.xpNumbers, { color: colors.textSecondary }]}>
                {isMaxLevel
                  ? `${xpNeeded.toLocaleString()} / ${xpNeeded.toLocaleString()} XP`
                  : `${xpCurrent.toLocaleString()} / ${xpNeeded.toLocaleString()} XP`}
              </Text>
              <Text style={[styles.xpPercent, { color: colors.primary }]}>
                {xpPercent}%
              </Text>
            </View>
          </View>

          {/* ── Next Reward + Claim All Row ──────────────────────────── */}
          <View style={styles.heroActions}>
            {/* Next reward preview */}
            {nextMilestone && !isMaxLevel ? (
              <View
                style={[
                  styles.nextRewardCard,
                  { backgroundColor: colors.surfaceVariant },
                ]}
              >
                <View
                  style={[
                    styles.nextRewardIcon,
                    { backgroundColor: "#FFD70018" },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={
                      (nextMilestone.icon as keyof typeof MaterialCommunityIcons.glyphMap) ??
                      "trophy-award"
                    }
                    size={18}
                    color="#FFD700"
                  />
                </View>
                <View style={styles.nextRewardText}>
                  <Text
                    style={[
                      styles.nextRewardLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Next Milestone
                  </Text>
                  <Text
                    style={[styles.nextRewardName, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    Lv {nextMilestone.level} · {nextMilestone.label}
                  </Text>
                </View>
              </View>
            ) : nextReward && !isMaxLevel ? (
              <View
                style={[
                  styles.nextRewardCard,
                  { backgroundColor: colors.surfaceVariant },
                ]}
              >
                <View
                  style={[
                    styles.nextRewardIcon,
                    { backgroundColor: colors.primary + "18" },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="star-four-points"
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.nextRewardText}>
                  <Text
                    style={[
                      styles.nextRewardLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Next Reward
                  </Text>
                  <Text
                    style={[styles.nextRewardName, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    Lv {nextReward.level} · {nextReward.label}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={{ flex: 1 }} />
            )}

            {/* Claim All Button */}
            {unclaimedCount > 0 && (
              <TouchableOpacity
                style={[
                  styles.claimAllBtn,
                  claimingLevel === -1 && { opacity: 0.6 },
                ]}
                onPress={handleClaimAll}
                disabled={claimingLevel !== null}
                activeOpacity={0.7}
              >
                {claimingLevel === -1 ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name="gift-open"
                      size={16}
                      color="#FFF"
                    />
                    <Text style={styles.claimAllText}>
                      Claim All ({unclaimedCount})
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ══════════════════════════════════════════════════════════════
            REWARD JOURNEY — vertical timeline
           ══════════════════════════════════════════════════════════════ */}
        <View style={styles.journeyHeader}>
          <Text style={[styles.journeyTitle, { color: colors.text }]}>
            Reward Journey
          </Text>
          <Text
            style={[styles.journeySubtitle, { color: colors.textSecondary }]}
          >
            {claimedCount} of {MAX_REWARD_LEVEL} claimed
          </Text>
        </View>

        <LevelRewardsTrack
          levelInfo={levelInfo}
          rewardDocs={rewards}
          onClaim={handleClaim}
          claimingLevel={claimingLevel}
        />

        <View style={{ height: 40 }} />
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
    paddingVertical: 10,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  headerSpacer: {
    width: 32,
  },
  scrollContent: {
    paddingBottom: 16,
  },

  // ── Hero Card ──────────────────────────────────────────────────────
  heroCard: {
    marginHorizontal: 16,
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  ringContainer: {
    width: RING_SIZE,
    height: RING_SIZE,
    marginRight: 16,
  },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  ringLevel: {
    fontSize: 28,
    fontWeight: "900",
  },
  heroInfo: {
    flex: 1,
  },
  heroLevelText: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 2,
  },
  heroXpSubtext: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  miniStatsRow: {
    flexDirection: "row",
    gap: 6,
  },
  miniStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  miniStatText: {
    fontSize: 11,
    fontWeight: "700",
  },

  // ── Progress Bar ───────────────────────────────────────────────────
  progressSection: {
    marginBottom: 16,
  },
  progressTrack: {
    height: 14,
    borderRadius: 7,
    overflow: "hidden",
  },
  progressFillWrap: {
    height: "100%",
    borderRadius: 7,
    overflow: "hidden",
  },
  progressFill: {
    flex: 1,
    borderRadius: 7,
  },
  xpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  xpNumbers: {
    fontSize: 12,
    fontWeight: "600",
  },
  xpPercent: {
    fontSize: 13,
    fontWeight: "800",
  },

  // ── Hero Actions (next reward + claim all) ────────────────────────
  heroActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  nextRewardCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 12,
    gap: 10,
  },
  nextRewardIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  nextRewardText: {
    flex: 1,
  },
  nextRewardLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  nextRewardName: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 1,
  },
  claimAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#34C759",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    gap: 6,
    minWidth: 100,
    shadowColor: "#34C759",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  claimAllText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 13,
  },

  // ── Journey Section Header ─────────────────────────────────────────
  journeyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  journeyTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  journeySubtitle: {
    fontSize: 12,
    fontWeight: "600",
  },
});
