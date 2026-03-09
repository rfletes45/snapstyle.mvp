/**
 * Games V4 — Achievement Section Detail Screen
 *
 * Lists all achievements in a single section. Each achievement row shows:
 * - Three states: locked, unclaimed (earned, reward not collected), claimed
 * - Name, description, difficulty badge
 * - Token reward amount
 * - Claim button for unclaimed achievements
 * - "Claim All" banner when multiple rewards are unclaimed
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
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import type { MainStackParamList } from "@/types/navigation/root";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Nav = NativeStackNavigationProp<MainStackParamList>;

/**
 * Determine the display state for an achievement entry.
 * Legacy docs (schemaVersion < 2) are treated as claimed since tokens were auto-credited.
 */
function getAchievementState(
  entry: AchievementEntryV4 | undefined,
): "locked" | "unclaimed" | "claimed" {
  if (!entry) return "locked";
  if (entry.schemaVersion && entry.schemaVersion >= 2) {
    return entry.status === "earned_unclaimed" ? "unclaimed" : "claimed";
  }
  // Legacy: auto-awarded tokens, treat as claimed
  return "claimed";
}

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

  const [earned, setEarned] = useState<AchievementEntryV4[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingType, setClaimingType] = useState<string | null>(null);
  const [claimingAll, setClaimingAll] = useState(false);

  const sectionDef = useMemo(
    () => ACHIEVEMENT_SECTIONS.find((s) => s.sectionId === sectionId),
    [sectionId],
  );
  const defs = useMemo(() => getDefsForSection(sectionId), [sectionId]);

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

  const earnedMap = useMemo(() => {
    const map = new Map<string, AchievementEntryV4>();
    for (const e of earned) map.set(e.type, e);
    return map;
  }, [earned]);

  const earnedInSection = useMemo(
    () => defs.filter((d) => earnedMap.has(d.type)).length,
    [defs, earnedMap],
  );

  // Unclaimed achievements in this section
  const unclaimedDefs = useMemo(
    () =>
      defs.filter(
        (d) => getAchievementState(earnedMap.get(d.type)) === "unclaimed",
      ),
    [defs, earnedMap],
  );

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

  const renderAchievement = useCallback(
    ({ item: def }: { item: AchievementDef }) => {
      const entry = earnedMap.get(def.type);
      const state = getAchievementState(entry);
      const diffMeta = DIFFICULTY_META[def.difficulty as AchievementDifficulty];
      const isCurrentlyClaiming = claimingType === def.type;

      // Row background by state
      const rowBg =
        state === "claimed"
          ? theme.isDark
            ? "#1A2E1A"
            : "#E8F5E9"
          : state === "unclaimed"
            ? theme.isDark
              ? "#2E2A1A"
              : "#FFF8E1"
            : theme.isDark
              ? "#1C1C1E"
              : "#FFF";

      // Icon by state
      const iconName =
        state === "claimed"
          ? "check-circle"
          : state === "unclaimed"
            ? "star-circle"
            : "lock-outline";
      const iconColor =
        state === "claimed"
          ? "#34C759"
          : state === "unclaimed"
            ? "#FF9500"
            : theme.isDark
              ? "#666"
              : "#999";

      return (
        <View style={[styles.achievementRow, { backgroundColor: rowBg }]}>
          {/* Icon */}
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor:
                  state === "claimed"
                    ? "#34C75930"
                    : state === "unclaimed"
                      ? "#FF950030"
                      : theme.isDark
                        ? "#333"
                        : "#E0E0E0",
              },
            ]}
          >
            <MaterialCommunityIcons
              name={iconName}
              size={24}
              color={iconColor}
            />
          </View>

          {/* Content */}
          <View style={styles.achievementContent}>
            <View style={styles.achievementTitleRow}>
              <Text
                style={[
                  styles.achievementName,
                  {
                    color:
                      state === "locked"
                        ? theme.isDark
                          ? "#999"
                          : "#666"
                        : theme.isDark
                          ? "#FFF"
                          : "#000",
                  },
                ]}
                numberOfLines={1}
              >
                {def.name}
              </Text>
              <View
                style={[
                  styles.difficultyBadge,
                  { backgroundColor: diffMeta.color + "20" },
                ]}
              >
                <Text
                  style={[
                    styles.difficultyBadgeText,
                    { color: diffMeta.color },
                  ]}
                >
                  {diffMeta.label}
                </Text>
              </View>
            </View>
            <Text
              style={[
                styles.achievementDesc,
                { color: theme.isDark ? "#AAA" : "#666" },
              ]}
              numberOfLines={2}
            >
              {def.description}
            </Text>
            <View style={styles.rewardRow}>
              <MaterialCommunityIcons
                name="star-circle"
                size={14}
                color="#FFD700"
              />
              <Text
                style={[
                  styles.rewardText,
                  {
                    color:
                      state === "claimed"
                        ? theme.isDark
                          ? "#888"
                          : "#999"
                        : theme.isDark
                          ? "#CCC"
                          : "#444",
                    textDecorationLine:
                      state === "claimed" ? "line-through" : "none",
                  },
                ]}
              >
                +{def.tokenReward} tokens
              </Text>
              {state === "claimed" && (
                <Text
                  style={[
                    styles.claimedLabel,
                    { color: theme.isDark ? "#4CAF50" : "#388E3C" },
                  ]}
                >
                  Claimed
                </Text>
              )}
            </View>
          </View>

          {/* Claim button (unclaimed only) */}
          {state === "unclaimed" && (
            <TouchableOpacity
              style={styles.claimRowButton}
              onPress={() => handleClaimOne(def.type)}
              disabled={isCurrentlyClaiming || claimingAll}
              activeOpacity={0.7}
            >
              {isCurrentlyClaiming ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.claimRowButtonText}>Claim</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      );
    },
    [earnedMap, claimingType, claimingAll, theme, handleClaimOne],
  );

  if (loading) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: theme.isDark ? "#000" : colors.background },
        ]}
      >
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: theme.isDark ? "#000" : colors.background },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={theme.isDark ? "#FFF" : "#000"}
          />
        </TouchableOpacity>
        <Text
          style={[
            styles.headerTitle,
            { color: theme.isDark ? "#FFF" : "#000" },
          ]}
        >
          {sectionDef?.icon} {sectionDef?.name ?? "Section"}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Section progress */}
      <View
        style={[
          styles.progressCard,
          { backgroundColor: theme.isDark ? "#1C1C1E" : "#F2F2F7" },
        ]}
      >
        <Text
          style={[
            styles.progressTitle,
            { color: theme.isDark ? "#FFF" : "#000" },
          ]}
        >
          {earnedInSection} / {defs.length} Completed
        </Text>
        <View
          style={[
            styles.progressBarBg,
            { backgroundColor: theme.isDark ? "#333" : "#DDD" },
          ]}
        >
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${defs.length > 0 ? (earnedInSection / defs.length) * 100 : 0}%`,
                backgroundColor:
                  earnedInSection === defs.length ? "#34C759" : colors.primary,
              },
            ]}
          />
        </View>
        {sectionDef?.description && (
          <Text
            style={[
              styles.sectionDescription,
              { color: theme.isDark ? "#AAA" : "#666" },
            ]}
          >
            {sectionDef.description}
          </Text>
        )}
      </View>

      {/* Claim All banner */}
      {unclaimedDefs.length > 1 && (
        <View
          style={[
            styles.claimAllBanner,
            { backgroundColor: theme.isDark ? "#2E2A1A" : "#FFF8E1" },
          ]}
        >
          <View style={styles.claimAllInfo}>
            <MaterialCommunityIcons
              name="gift-outline"
              size={20}
              color="#FF9500"
            />
            <View>
              <Text
                style={[
                  styles.claimAllText,
                  { color: theme.isDark ? "#FFD0A0" : "#E65100" },
                ]}
              >
                {unclaimedDefs.length} unclaimed reward
                {unclaimedDefs.length !== 1 ? "s" : ""}
              </Text>
              <Text
                style={[
                  styles.claimAllSubtext,
                  { color: theme.isDark ? "#CCA050" : "#BF360C" },
                ]}
              >
                +{unclaimedDefs.reduce((sum, d) => sum + d.tokenReward, 0)}{" "}
                tokens
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.claimAllButton}
            onPress={handleClaimAll}
            disabled={claimingAll}
            activeOpacity={0.7}
          >
            {claimingAll ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.claimAllButtonText}>Claim All</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Achievement list */}
      <FlatList
        data={defs}
        keyExtractor={(item) => item.type}
        renderItem={renderAchievement}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: { padding: 4 },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  headerSpacer: { width: 32 },
  progressCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  progressTitle: { fontSize: 15, fontWeight: "700" },
  progressBarBg: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressBarFill: { height: "100%", borderRadius: 4 },
  sectionDescription: { fontSize: 12, marginTop: 2 },
  claimAllBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  claimAllInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  claimAllText: {
    fontSize: 13,
    fontWeight: "600",
  },
  claimAllSubtext: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 1,
  },
  claimAllButton: {
    backgroundColor: "#FF9500",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  claimAllButtonText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "700",
  },
  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 10 },
  achievementRow: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 14,
    gap: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  achievementContent: { flex: 1, gap: 4 },
  achievementTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  achievementName: { fontSize: 15, fontWeight: "600", flex: 1 },
  difficultyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  difficultyBadgeText: { fontSize: 10, fontWeight: "700" },
  achievementDesc: { fontSize: 12, lineHeight: 16 },
  rewardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  rewardText: { fontSize: 11, fontWeight: "600" },
  claimedLabel: {
    fontSize: 10,
    fontWeight: "700",
    marginLeft: 4,
  },
  claimRowButton: {
    backgroundColor: "#FF9500",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 64,
    alignItems: "center",
  },
  claimRowButtonText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
