/**
 * Games V4 — Achievements Hub Screen
 *
 * Lists all achievement sections as cards with:
 * - Filter bar (All / Turn-Based / Solo / General / Realtime)
 * - Per-section unclaimed reward count badges
 * - Progress bar (earned / total achievements)
 * - "Claim Badge" button when section is complete
 * - Chevron affordance for tap navigation
 *
 * Navigates to AchievementSection on card tap.
 *
 * @module gamesV4/screens/AchievementsHubScreen
 */

import {
  ACHIEVEMENT_SECTIONS,
  DIFFICULTY_META,
  getDefsForSection,
  type AchievementRuntimeCategory,
  type AchievementSectionDef,
} from "@/gamesV4/data/achievementDefinitions";
import {
  claimAchievementSectionBadge,
  subscribeToAchievements,
  subscribeToAchievementSections,
  type AchievementEntryV4,
} from "@/gamesV4/services/gameServiceV4";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import type { MainStackParamList } from "@/types/navigation/root";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Nav = NativeStackNavigationProp<MainStackParamList>;

interface ClaimedSection {
  sectionId: string;
  claimed: boolean;
}

type FilterKey = "all" | AchievementRuntimeCategory;

const FILTER_CHIPS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "turn_based", label: "Turn-Based" },
  { key: "solo", label: "Solo" },
  { key: "realtime", label: "Realtime" },
  { key: "general", label: "General" },
];

/**
 * Determine if an achievement entry is "unclaimed" (earned but reward not yet collected).
 * Legacy docs (schemaVersion undefined / < 2) are treated as already claimed since tokens
 * were auto-credited before the manual-claim system was introduced.
 */
function isUnclaimed(entry: AchievementEntryV4): boolean {
  if (entry.schemaVersion && entry.schemaVersion >= 2) {
    return entry.status === "earned_unclaimed";
  }
  // Legacy: tokens were auto-awarded, treat as claimed
  return false;
}

export default function AchievementsHubScreen() {
  const { theme } = useAppTheme();
  const { currentFirebaseUser } = useAuth();
  const navigation = useNavigation<Nav>();
  const uid = currentFirebaseUser?.uid;

  const [earned, setEarned] = useState<AchievementEntryV4[]>([]);
  const [claimedSections, setClaimedSections] = useState<ClaimedSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingSection, setClaimingSection] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

  // Subscribe to achievements
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

  // Subscribe to claimed sections
  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeToAchievementSections(uid, setClaimedSections);
    return unsub;
  }, [uid]);

  const earnedSet = useMemo(() => new Set(earned.map((e) => e.type)), [earned]);
  const earnedMap = useMemo(() => {
    const map = new Map<string, AchievementEntryV4>();
    for (const e of earned) map.set(e.type, e);
    return map;
  }, [earned]);
  const claimedSet = useMemo(
    () =>
      new Set(claimedSections.filter((s) => s.claimed).map((s) => s.sectionId)),
    [claimedSections],
  );

  // Per-section unclaimed counts
  const unclaimedBySection = useMemo(() => {
    const counts = new Map<string, number>();
    for (const section of ACHIEVEMENT_SECTIONS) {
      const defs = getDefsForSection(section.sectionId);
      let count = 0;
      for (const def of defs) {
        const entry = earnedMap.get(def.type);
        if (entry && isUnclaimed(entry)) count++;
      }
      if (count > 0) counts.set(section.sectionId, count);
    }
    return counts;
  }, [earnedMap]);

  // Total unclaimed
  const totalUnclaimed = useMemo(() => {
    let total = 0;
    for (const v of unclaimedBySection.values()) total += v;
    return total;
  }, [unclaimedBySection]);

  // Total unclaimed token value
  const totalUnclaimedTokens = useMemo(() => {
    let total = 0;
    for (const entry of earned) {
      if (isUnclaimed(entry)) {
        total += entry.tokenReward || 0;
      }
    }
    return total;
  }, [earned]);

  // Filtered sections
  const filteredSections = useMemo(
    () =>
      activeFilter === "all"
        ? ACHIEVEMENT_SECTIONS
        : ACHIEVEMENT_SECTIONS.filter(
            (s) => s.runtimeCategory === activeFilter,
          ),
    [activeFilter],
  );

  const handleClaimBadge = useCallback(async (sectionId: string) => {
    setClaimingSection(sectionId);
    try {
      await claimAchievementSectionBadge({ sectionId });
      Alert.alert("Badge Claimed!", "Check your badge collection.");
    } catch (err) {
      Alert.alert(
        "Claim Failed",
        err instanceof Error ? err.message : "Could not claim badge.",
      );
    } finally {
      setClaimingSection(null);
    }
  }, []);

  const colors = theme.colors;

  // Total progress
  const totalAchievements = useMemo(
    () =>
      ACHIEVEMENT_SECTIONS.reduce(
        (sum, s) => sum + getDefsForSection(s.sectionId).length,
        0,
      ),
    [],
  );

  const renderSection = useCallback(
    ({ item: section }: { item: AchievementSectionDef }) => {
      const defs = getDefsForSection(section.sectionId);
      const earnedCount = defs.filter((d) => earnedSet.has(d.type)).length;
      const total = defs.length;
      const isComplete = earnedCount === total;
      const isClaimed = claimedSet.has(section.sectionId);
      const progress = total > 0 ? earnedCount / total : 0;
      const sectionUnclaimed = unclaimedBySection.get(section.sectionId) ?? 0;

      // Difficulty range
      const difficulties = [...new Set(defs.map((d) => d.difficulty))];
      const maxDifficulty = difficulties.reduce((max, d) => {
        const order = ["easy", "medium", "hard", "expert", "legendary"];
        return order.indexOf(d) > order.indexOf(max) ? d : max;
      }, difficulties[0]);

      return (
        <TouchableOpacity
          style={[
            styles.sectionCard,
            {
              backgroundColor: theme.isDark ? "#1C1C1E" : "#FFF",
              borderLeftWidth: sectionUnclaimed > 0 ? 3 : 0,
              borderLeftColor: sectionUnclaimed > 0 ? "#FF9500" : "transparent",
            },
          ]}
          onPress={() =>
            navigation.navigate("AchievementSection", {
              sectionId: section.sectionId,
            })
          }
          activeOpacity={0.7}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>{section.icon}</Text>
            <View style={styles.sectionTitleArea}>
              <View style={styles.sectionNameRow}>
                <Text
                  style={[
                    styles.sectionName,
                    { color: theme.isDark ? "#FFF" : "#000" },
                  ]}
                >
                  {section.name}
                </Text>
                {sectionUnclaimed > 0 && (
                  <View style={styles.unclaimedBadge}>
                    <Text style={styles.unclaimedBadgeText}>
                      {sectionUnclaimed}
                    </Text>
                  </View>
                )}
              </View>
              <Text
                style={[
                  styles.sectionDesc,
                  { color: theme.isDark ? "#AAA" : "#666" },
                ]}
              >
                {section.description}
              </Text>
            </View>
            {isClaimed && (
              <MaterialCommunityIcons
                name="check-decagram"
                size={24}
                color="#34C759"
              />
            )}
            <MaterialCommunityIcons
              name="chevron-right"
              size={22}
              color={theme.isDark ? "#666" : "#999"}
            />
          </View>

          {/* Progress bar */}
          <View style={styles.progressRow}>
            <View
              style={[
                styles.progressBarBg,
                { backgroundColor: theme.isDark ? "#333" : "#E0E0E0" },
              ]}
            >
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${progress * 100}%`,
                    backgroundColor: isComplete ? "#34C759" : colors.primary,
                  },
                ]}
              />
            </View>
            <Text
              style={[
                styles.progressText,
                { color: theme.isDark ? "#AAA" : "#666" },
              ]}
            >
              {earnedCount}/{total}
            </Text>
          </View>

          {/* Difficulty + Claim */}
          <View style={styles.sectionFooter}>
            <View
              style={[
                styles.difficultyChip,
                {
                  backgroundColor: DIFFICULTY_META[maxDifficulty].color + "20",
                },
              ]}
            >
              <Text
                style={[
                  styles.difficultyText,
                  { color: DIFFICULTY_META[maxDifficulty].color },
                ]}
              >
                Up to {DIFFICULTY_META[maxDifficulty].label}
              </Text>
            </View>
            {isComplete && !isClaimed && (
              <TouchableOpacity
                style={[styles.claimButton, { backgroundColor: "#34C759" }]}
                onPress={() => handleClaimBadge(section.sectionId)}
                disabled={claimingSection === section.sectionId}
              >
                {claimingSection === section.sectionId ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.claimButtonText}>Claim Badge</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [
      earnedSet,
      claimedSet,
      claimingSection,
      unclaimedBySection,
      theme,
      colors,
      navigation,
      handleClaimBadge,
    ],
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
          Achievements
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Overall progress + unclaimed summary */}
      <View
        style={[
          styles.overallCard,
          { backgroundColor: theme.isDark ? "#1C1C1E" : "#F2F2F7" },
        ]}
      >
        <MaterialCommunityIcons name="trophy" size={28} color="#FFD700" />
        <View style={styles.overallInfo}>
          <Text
            style={[
              styles.overallTitle,
              { color: theme.isDark ? "#FFF" : "#000" },
            ]}
          >
            {earnedSet.size} / {totalAchievements} Achievements
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
                  width: `${totalAchievements > 0 ? (earnedSet.size / totalAchievements) * 100 : 0}%`,
                  backgroundColor: colors.primary,
                },
              ]}
            />
          </View>
          {totalUnclaimed > 0 && (
            <Text style={styles.unclaimedSummaryText}>
              {totalUnclaimed} unclaimed reward{totalUnclaimed !== 1 ? "s" : ""}{" "}
              (+{totalUnclaimedTokens} tokens)
            </Text>
          )}
        </View>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {FILTER_CHIPS.map((chip) => {
          const isActive = activeFilter === chip.key;
          return (
            <TouchableOpacity
              key={chip.key}
              style={[
                styles.filterChip,
                {
                  backgroundColor: isActive
                    ? colors.primary
                    : theme.isDark
                      ? "#2C2C2E"
                      : "#E8E8E8",
                },
              ]}
              onPress={() => setActiveFilter(chip.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterChipText,
                  {
                    color: isActive ? "#FFF" : theme.isDark ? "#CCC" : "#444",
                  },
                ]}
              >
                {chip.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Section list */}
      <FlatList
        data={filteredSections}
        keyExtractor={(item) => item.sectionId}
        renderItem={renderSection}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text
              style={[
                styles.emptyText,
                { color: theme.isDark ? "#666" : "#999" },
              ]}
            >
              No sections in this category
            </Text>
          </View>
        }
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
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  headerSpacer: { width: 32 },
  overallCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  overallInfo: { flex: 1, gap: 6 },
  overallTitle: { fontSize: 16, fontWeight: "700" },
  unclaimedSummaryText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FF9500",
  },
  filterRow: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  sectionCard: {
    borderRadius: 12,
    padding: 16,
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  sectionIcon: { fontSize: 28 },
  sectionTitleArea: { flex: 1 },
  sectionNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionName: { fontSize: 16, fontWeight: "700" },
  sectionDesc: { fontSize: 12, marginTop: 2 },
  unclaimedBadge: {
    backgroundColor: "#FF9500",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  unclaimedBadgeText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "700",
  },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  progressBarBg: { flex: 1, height: 8, borderRadius: 4, overflow: "hidden" },
  progressBarFill: { height: "100%", borderRadius: 4 },
  progressText: {
    fontSize: 12,
    fontWeight: "600",
    minWidth: 28,
    textAlign: "right",
  },
  sectionFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  difficultyChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  difficultyText: { fontSize: 11, fontWeight: "600" },
  claimButton: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  claimButtonText: { color: "#FFF", fontSize: 13, fontWeight: "700" },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
  },
});
