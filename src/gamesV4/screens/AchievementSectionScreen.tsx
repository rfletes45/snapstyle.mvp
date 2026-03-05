/**
 * Games V4 — Achievement Section Detail Screen
 *
 * Lists all achievements in a single section. Each achievement row shows:
 * - Earned/locked state
 * - Name, description, difficulty badge
 * - Token reward amount
 * - Earned date if unlocked
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
import { subscribeToAchievements } from "@/gamesV4/services/gameServiceV4";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import type { MainStackParamList } from "@/types/navigation/root";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Nav = NativeStackNavigationProp<MainStackParamList>;

interface EarnedData {
  type: string;
  name: string;
  description: string;
  earnedAt: unknown;
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

  const [earned, setEarned] = useState<EarnedData[]>([]);
  const [loading, setLoading] = useState(true);

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
        setEarned(data as EarnedData[]);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [uid]);

  const earnedMap = useMemo(() => {
    const map = new Map<string, EarnedData>();
    for (const e of earned) {
      map.set(e.type, e);
    }
    return map;
  }, [earned]);

  const earnedInSection = useMemo(
    () => defs.filter((d) => earnedMap.has(d.type)).length,
    [defs, earnedMap],
  );

  const renderAchievement = ({ item: def }: { item: AchievementDef }) => {
    const isEarned = earnedMap.has(def.type);
    const diffMeta = DIFFICULTY_META[def.difficulty as AchievementDifficulty];

    return (
      <View
        style={[
          styles.achievementRow,
          {
            backgroundColor: isEarned
              ? theme.isDark
                ? "#1A2E1A"
                : "#E8F5E9"
              : theme.isDark
                ? "#1C1C1E"
                : "#FFF",
          },
        ]}
      >
        {/* Icon */}
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: isEarned
                ? "#34C759" + "30"
                : theme.isDark
                  ? "#333"
                  : "#E0E0E0",
            },
          ]}
        >
          <MaterialCommunityIcons
            name={isEarned ? "check-circle" : "lock-outline"}
            size={24}
            color={isEarned ? "#34C759" : theme.isDark ? "#666" : "#999"}
          />
        </View>

        {/* Content */}
        <View style={styles.achievementContent}>
          <View style={styles.achievementTitleRow}>
            <Text
              style={[
                styles.achievementName,
                {
                  color: isEarned
                    ? theme.isDark
                      ? "#FFF"
                      : "#000"
                    : theme.isDark
                      ? "#999"
                      : "#666",
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
                style={[styles.difficultyBadgeText, { color: diffMeta.color }]}
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
                { color: theme.isDark ? "#CCC" : "#444" },
              ]}
            >
              +{def.tokenReward} tokens
            </Text>
          </View>
        </View>
      </View>
    );
  };

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
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  progressTitle: { fontSize: 15, fontWeight: "700" },
  progressBarBg: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressBarFill: { height: "100%", borderRadius: 4 },
  sectionDescription: { fontSize: 12, marginTop: 2 },
  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 10 },
  achievementRow: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 14,
    gap: 12,
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
});
