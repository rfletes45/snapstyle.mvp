/**
 * Games V4 — Achievement Section Detail Screen (Redesigned)
 *
 * Per-section achievement browser with:
 * - Section info card with icon, progress counter, bar, difficulty distribution
 * - Smart sorting: unclaimed → claimed → locked
 * - State-specific card styling (borders, backgrounds, icons)
 * - Claim-all banner for multiple unclaimed rewards
 * - Fully theme-aware design
 *
 * @module gamesV4/screens/AchievementSectionScreen
 */

import {
  ACHIEVEMENT_SECTIONS,
  DIFFICULTY_META,
  getDefsForSection,
  type AchievementDef,
  type AchievementDifficulty,
} from "@/gamesV4/data/achievementDefinitions";
import {
  claimAchievementReward,
  subscribeToAchievements,
  type AchievementEntryV4,
} from "@/gamesV4/services/gameServiceV4";
import { markAchievementNotificationsRead } from "@/services/userNotifications";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import type { MainStackParamList } from "@/types/navigation/root";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
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
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Nav = NativeStackNavigationProp<MainStackParamList>;

function getAchievementState(
  entry: AchievementEntryV4 | undefined,
): "locked" | "unclaimed" | "claimed" {
  if (!entry) return "locked";
  if (entry.schemaVersion && entry.schemaVersion >= 2) {
    return entry.status === "earned_unclaimed" ? "unclaimed" : "claimed";
  }
  return "claimed";
}

const DIFFICULTY_ORDER: AchievementDifficulty[] = [
  "easy",
  "medium",
  "hard",
  "expert",
  "legendary",
];

export default function AchievementSectionScreen() {
  const { theme } = useAppTheme();
  const { currentFirebaseUser } = useAuth();
  const navigation = useNavigation<Nav>();
  const route = useRoute<{
    key: string;
    name: "AchievementSection";
    params: { sectionId: string };
  }>();

  const { sectionId } = route.params;
  const uid = currentFirebaseUser?.uid;
  const colors = theme.colors;
  const isDark = theme.isDark;

  const [earned, setEarned] = useState<AchievementEntryV4[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingType, setClaimingType] = useState<string | null>(null);
  const [claimingAll, setClaimingAll] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const sectionDef = useMemo(
    () => ACHIEVEMENT_SECTIONS.find((s) => s.sectionId === sectionId),
    [sectionId],
  );
  const defs = useMemo(() => getDefsForSection(sectionId), [sectionId]);

  useEffect(() => {
    if (!loading) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start();
    }
  }, [loading, fadeAnim]);

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeToAchievements(
      uid,
      (data) => {
        setEarned(data);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      markAchievementNotificationsRead(uid, sectionId).catch((error) => {
        console.warn(
          "[gamesV4] Failed to mark section notifications read:",
          error,
        );
      });
    }, [uid, sectionId]),
  );

  const earnedMap = useMemo(() => {
    const map = new Map<string, AchievementEntryV4>();
    for (const e of earned) map.set(e.type, e);
    return map;
  }, [earned]);

  const earnedInSection = useMemo(
    () => defs.filter((d) => earnedMap.has(d.type)).length,
    [defs, earnedMap],
  );

  const unclaimedDefs = useMemo(
    () =>
      defs.filter(
        (d) => getAchievementState(earnedMap.get(d.type)) === "unclaimed",
      ),
    [defs, earnedMap],
  );

  const unclaimedTokenTotal = useMemo(
    () => unclaimedDefs.reduce((sum, d) => sum + d.tokenReward, 0),
    [unclaimedDefs],
  );

  // Smart sort: unclaimed → claimed → locked, within each group sort by difficulty
  const sortedDefs = useMemo(() => {
    const stateOrder = { unclaimed: 0, claimed: 1, locked: 2 };
    return [...defs].sort((a, b) => {
      const stateA = getAchievementState(earnedMap.get(a.type));
      const stateB = getAchievementState(earnedMap.get(b.type));
      const orderDiff = stateOrder[stateA] - stateOrder[stateB];
      if (orderDiff !== 0) return orderDiff;
      return (
        DIFFICULTY_ORDER.indexOf(a.difficulty) -
        DIFFICULTY_ORDER.indexOf(b.difficulty)
      );
    });
  }, [defs, earnedMap]);

  // Difficulty distribution
  const diffDistrib = useMemo(() => {
    const counts = new Map<AchievementDifficulty, number>();
    for (const def of defs) {
      counts.set(def.difficulty, (counts.get(def.difficulty) ?? 0) + 1);
    }
    return DIFFICULTY_ORDER.filter((d) => counts.has(d)).map((d) => ({
      difficulty: d,
      count: counts.get(d)!,
    }));
  }, [defs]);

  const handleClaimOne = useCallback(async (achievementType: string) => {
    setClaimingType(achievementType);
    try {
      const result = await claimAchievementReward({ achievementType });
      if (result.alreadyClaimed) {
        Alert.alert("Already Claimed", "This reward was already claimed.");
      } else if (result.tokenRewardClaimed > 0) {
        Alert.alert(
          "Reward Claimed!",
          `+${result.tokenRewardClaimed} tokens added to your wallet.`,
        );
      }
    } catch (err) {
      Alert.alert(
        "Claim Failed",
        err instanceof Error ? err.message : "Could not claim reward.",
      );
    } finally {
      setClaimingType(null);
    }
  }, []);

  const handleClaimAll = useCallback(async () => {
    if (unclaimedDefs.length === 0) return;
    setClaimingAll(true);
    let successCount = 0;
    let totalTokens = 0;
    let failCount = 0;
    for (const def of unclaimedDefs) {
      try {
        const result = await claimAchievementReward({
          achievementType: def.type,
        });
        if (!result.alreadyClaimed) {
          successCount++;
          totalTokens += result.tokenRewardClaimed || 0;
        }
      } catch {
        failCount++;
      }
    }
    setClaimingAll(false);
    if (failCount > 0) {
      Alert.alert(
        "Claim Results",
        `Claimed ${successCount} reward${successCount !== 1 ? "s" : ""} (+${totalTokens} tokens). ${failCount} failed — try again.`,
      );
    } else if (successCount > 0) {
      Alert.alert(
        "All Rewards Claimed!",
        `+${totalTokens} tokens added to your wallet.`,
      );
    }
  }, [unclaimedDefs]);

  const isComplete = earnedInSection === defs.length && defs.length > 0;
  const progress = defs.length > 0 ? earnedInSection / defs.length : 0;
  const progressPct = Math.round(progress * 100);

  const renderAchievement = useCallback(
    ({ item: def }: { item: AchievementDef }) => {
      const entry = earnedMap.get(def.type);
      const state = getAchievementState(entry);
      const diffMeta = DIFFICULTY_META[def.difficulty];
      const isCurrentlyClaiming = claimingType === def.type;

      const cardBg =
        state === "unclaimed"
          ? colors.warning + "0A"
          : isDark
            ? colors.surfaceVariant
            : colors.surface;

      const borderColor =
        state === "unclaimed"
          ? colors.warning + "40"
          : state === "claimed"
            ? colors.success + "30"
            : "transparent";

      const iconName =
        state === "claimed"
          ? "check-circle"
          : state === "unclaimed"
            ? "star-circle"
            : "lock-outline";
      const iconColor =
        state === "claimed"
          ? colors.success
          : state === "unclaimed"
            ? colors.warning
            : colors.textMuted;

      const iconBg =
        state === "claimed"
          ? colors.success + "18"
          : state === "unclaimed"
            ? colors.warning + "18"
            : isDark
              ? colors.background + "80"
              : colors.surfaceVariant;

      return (
        <View
          style={[
            styles.achievementCard,
            {
              backgroundColor: cardBg,
              borderColor,
              borderWidth: state !== "locked" ? 1 : 0,
            },
          ]}
        >
          <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
            <MaterialCommunityIcons
              name={iconName}
              size={22}
              color={iconColor}
            />
          </View>

          <View style={styles.cardContent}>
            <View style={styles.cardTitleRow}>
              <Text
                style={[
                  styles.achievementName,
                  {
                    color: state === "locked" ? colors.textMuted : colors.text,
                  },
                ]}
                numberOfLines={1}
              >
                {def.name}
              </Text>
              <View
                style={[
                  styles.diffBadge,
                  { backgroundColor: diffMeta.color + "18" },
                ]}
              >
                <MaterialCommunityIcons
                  name={diffMeta.icon as any}
                  size={10}
                  color={diffMeta.color}
                />
                <Text style={[styles.diffBadgeText, { color: diffMeta.color }]}>
                  {diffMeta.label}
                </Text>
              </View>
            </View>

            <Text
              style={[styles.achievementDesc, { color: colors.textSecondary }]}
              numberOfLines={2}
            >
              {def.description}
            </Text>

            <View style={styles.rewardRow}>
              <View style={[styles.coinChip, { backgroundColor: "#FFD70012" }]}>
                <MaterialCommunityIcons
                  name="circle-multiple"
                  size={12}
                  color="#FFD700"
                />
                <Text
                  style={[
                    styles.coinText,
                    {
                      color:
                        state === "claimed" ? colors.textMuted : colors.text,
                      textDecorationLine:
                        state === "claimed" ? "line-through" : "none",
                    },
                  ]}
                >
                  +{def.tokenReward}
                </Text>
              </View>
              {state === "claimed" && (
                <View
                  style={[
                    styles.claimedTag,
                    { backgroundColor: colors.success + "14" },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="check"
                    size={11}
                    color={colors.success}
                  />
                  <Text
                    style={[styles.claimedTagText, { color: colors.success }]}
                  >
                    Claimed
                  </Text>
                </View>
              )}
            </View>
          </View>

          {state === "unclaimed" && (
            <TouchableOpacity
              style={[styles.claimBtn, { backgroundColor: colors.warning }]}
              onPress={() => handleClaimOne(def.type)}
              disabled={isCurrentlyClaiming || claimingAll}
              activeOpacity={0.7}
            >
              {isCurrentlyClaiming ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.claimBtnText}>Claim</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      );
    },
    [earnedMap, claimingType, claimingAll, isDark, colors, handleClaimOne],
  );

  const renderHeader = useCallback(() => {
    return (
      <Animated.View style={{ opacity: fadeAnim }}>
        {/* Section info card */}
        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: isDark ? colors.surfaceVariant : colors.surface,
            },
          ]}
        >
          <View style={styles.infoTopRow}>
            <Text style={styles.sectionEmoji}>{sectionDef?.icon ?? "🏆"}</Text>
            <View style={styles.infoTextArea}>
              <Text style={[styles.infoName, { color: colors.text }]}>
                {sectionDef?.name ?? "Section"}
              </Text>
              {sectionDef?.description ? (
                <Text
                  style={[styles.infoDesc, { color: colors.textSecondary }]}
                  numberOfLines={2}
                >
                  {sectionDef.description}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Progress counter */}
          <View style={styles.progressCounterRow}>
            <View style={styles.progressNumbers}>
              <Text
                style={[
                  styles.progressBig,
                  { color: isComplete ? colors.success : colors.primary },
                ]}
              >
                {earnedInSection}
              </Text>
              <Text style={[styles.progressSlash, { color: colors.textMuted }]}>
                /
              </Text>
              <Text
                style={[styles.progressTotal, { color: colors.textSecondary }]}
              >
                {defs.length}
              </Text>
            </View>
            <View
              style={[
                styles.pctBadge,
                {
                  backgroundColor:
                    (isComplete ? colors.success : colors.primary) + "18",
                },
              ]}
            >
              <Text
                style={[
                  styles.pctText,
                  { color: isComplete ? colors.success : colors.primary },
                ]}
              >
                {progressPct}%
              </Text>
            </View>
          </View>

          {/* Progress bar */}
          <View
            style={[
              styles.progressTrack,
              {
                backgroundColor: isDark
                  ? colors.background
                  : colors.surfaceVariant,
              },
            ]}
          >
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progress * 100}%`,
                  backgroundColor: isComplete ? colors.success : colors.primary,
                },
              ]}
            />
          </View>

          {/* Difficulty distribution */}
          {diffDistrib.length > 0 && (
            <View style={styles.diffRow}>
              {diffDistrib.map((d) => (
                <View
                  key={d.difficulty}
                  style={[
                    styles.diffDistribChip,
                    {
                      backgroundColor:
                        DIFFICULTY_META[d.difficulty].color + "14",
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={DIFFICULTY_META[d.difficulty].icon as any}
                    size={11}
                    color={DIFFICULTY_META[d.difficulty].color}
                  />
                  <Text
                    style={[
                      styles.diffDistribText,
                      { color: DIFFICULTY_META[d.difficulty].color },
                    ]}
                  >
                    {d.count} {DIFFICULTY_META[d.difficulty].label}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Claim All banner */}
        {unclaimedDefs.length > 1 && (
          <View
            style={[
              styles.claimAllBanner,
              { backgroundColor: colors.warning + "0C" },
            ]}
          >
            <View style={styles.claimAllInfo}>
              <MaterialCommunityIcons
                name="gift-outline"
                size={20}
                color={colors.warning}
              />
              <View>
                <Text style={[styles.claimAllText, { color: colors.warning }]}>
                  {unclaimedDefs.length} unclaimed reward
                  {unclaimedDefs.length !== 1 ? "s" : ""}
                </Text>
                <Text
                  style={[
                    styles.claimAllSubtext,
                    { color: colors.textSecondary },
                  ]}
                >
                  +{unclaimedTokenTotal} tokens waiting
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.claimAllBtn, { backgroundColor: colors.warning }]}
              onPress={handleClaimAll}
              disabled={claimingAll}
              activeOpacity={0.7}
            >
              {claimingAll ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.claimAllBtnText}>Claim All</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <Text style={[styles.listLabel, { color: colors.textMuted }]}>
          {sortedDefs.length} achievement{sortedDefs.length !== 1 ? "s" : ""}
        </Text>
      </Animated.View>
    );
  }, [
    sectionDef,
    earnedInSection,
    defs.length,
    isComplete,
    progress,
    progressPct,
    diffDistrib,
    unclaimedDefs.length,
    unclaimedTokenTotal,
    claimingAll,
    sortedDefs.length,
    isDark,
    colors,
    fadeAnim,
    handleClaimAll,
  ]);

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>
        <Text
          style={[styles.headerTitle, { color: colors.text }]}
          numberOfLines={1}
        >
          {sectionDef?.icon} {sectionDef?.name ?? "Section"}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={sortedDefs}
        keyExtractor={(item) => item.type}
        renderItem={renderAchievement}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="trophy-broken"
              size={40}
              color={colors.textMuted}
            />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No achievements in this section
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { fontSize: 14, fontWeight: "500" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  headerSpacer: { width: 32 },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  infoCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    gap: 14,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
      },
      android: { elevation: 3 },
    }),
  },
  infoTopRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  sectionEmoji: { fontSize: 36 },
  infoTextArea: { flex: 1, gap: 3 },
  infoName: { fontSize: 20, fontWeight: "800", letterSpacing: -0.2 },
  infoDesc: { fontSize: 13, lineHeight: 18 },
  progressCounterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressNumbers: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  progressBig: { fontSize: 28, fontWeight: "900", letterSpacing: -0.5 },
  progressSlash: { fontSize: 18, fontWeight: "600" },
  progressTotal: { fontSize: 18, fontWeight: "600" },
  pctBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  pctText: { fontSize: 14, fontWeight: "800" },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  diffRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
  diffDistribChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  diffDistribText: { fontSize: 11, fontWeight: "600" },
  claimAllBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  claimAllInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  claimAllText: { fontSize: 13.5, fontWeight: "700" },
  claimAllSubtext: { fontSize: 11.5, fontWeight: "500", marginTop: 1 },
  claimAllBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  claimAllBtnText: { color: "#FFF", fontSize: 13, fontWeight: "700" },
  listLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  achievementCard: {
    flexDirection: "row",
    borderRadius: 14,
    padding: 14,
    gap: 12,
    alignItems: "center",
    marginBottom: 8,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.03,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
      },
      android: { elevation: 1 },
    }),
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  cardContent: { flex: 1, gap: 4 },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  achievementName: {
    fontSize: 14.5,
    fontWeight: "700",
    flex: 1,
    letterSpacing: -0.1,
  },
  diffBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
    gap: 3,
  },
  diffBadgeText: { fontSize: 10, fontWeight: "700" },
  achievementDesc: { fontSize: 12, lineHeight: 16 },
  rewardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  coinChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  coinText: { fontSize: 11, fontWeight: "700" },
  claimedTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  claimedTagText: { fontSize: 10, fontWeight: "700" },
  claimBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 64,
    alignItems: "center",
  },
  claimBtnText: { color: "#FFF", fontSize: 13, fontWeight: "700" },
  emptyContainer: { paddingVertical: 60, alignItems: "center", gap: 8 },
  emptyText: { fontSize: 14, fontWeight: "500" },
});
