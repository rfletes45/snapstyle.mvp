/**
 * Games V4 — Achievements Hub Screen
 *
 * Lists all achievement sections as cards. Each card shows:
 * - Section name, icon, description
 * - Progress bar (earned / total achievements)
 * - "Claim Badge" button when section is complete
 * - Difficulty range indicator
 *
 * Navigates to AchievementSection on card tap.
 *
 * @module gamesV4/screens/AchievementsHubScreen
 */

import {
  ACHIEVEMENT_SECTIONS,
  DIFFICULTY_META,
  getDefsForSection,
  type AchievementSectionDef,
} from "@/gamesV4/data/achievementDefinitions";
import {
  claimAchievementSectionBadge,
  subscribeToAchievements,
  subscribeToAchievementSections,
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
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Nav = NativeStackNavigationProp<MainStackParamList>;

interface EarnedAchievement {
  type: string;
  sectionId?: string;
}

interface ClaimedSection {
  sectionId: string;
  claimed: boolean;
}

export default function AchievementsHubScreen() {
  const { theme } = useAppTheme();
  const { currentFirebaseUser } = useAuth();
  const navigation = useNavigation<Nav>();
  const uid = currentFirebaseUser?.uid;

  const [earned, setEarned] = useState<EarnedAchievement[]>([]);
  const [claimedSections, setClaimedSections] = useState<ClaimedSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingSection, setClaimingSection] = useState<string | null>(null);

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
  const claimedSet = useMemo(
    () =>
      new Set(claimedSections.filter((s) => s.claimed).map((s) => s.sectionId)),
    [claimedSections],
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
            { backgroundColor: theme.isDark ? "#1C1C1E" : "#FFF" },
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
              <Text
                style={[
                  styles.sectionName,
                  { color: theme.isDark ? "#FFF" : "#000" },
                ]}
              >
                {section.name}
              </Text>
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

      {/* Overall progress */}
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
        </View>
      </View>

      {/* Section list */}
      <FlatList
        data={ACHIEVEMENT_SECTIONS}
        keyExtractor={(item) => item.sectionId}
        renderItem={renderSection}
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
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  headerSpacer: { width: 32 },
  overallCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  overallInfo: { flex: 1, gap: 6 },
  overallTitle: { fontSize: 16, fontWeight: "700" },
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
  sectionName: { fontSize: 16, fontWeight: "700" },
  sectionDesc: { fontSize: 12, marginTop: 2 },
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
});
