/**
 * Games V4 — Achievements Hub Screen (Redesigned v2)
 *
 * Two-column grid of compact game section cards with:
 * - Search bar (outside FlatList to prevent keyboard dismissal)
 * - Horizontal filter strip with gradient fade edges
 * - Hero progress card
 * - Purple unclaimed-count badge replacing chevron
 * - Progress count at bottom center of each card
 *
 * @module gamesV4/screens/AchievementsHubScreen
 */

import {
  ACHIEVEMENT_DEFS,
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
import { markAchievementNotificationsRead } from "@/services/userNotifications";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import type { MainStackParamList } from "@/types/navigation/root";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
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
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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

const FILTER_CHIPS: { key: FilterKey; label: string; icon: string }[] = [
  { key: "all", label: "All", icon: "trophy-outline" },
  { key: "turn_based", label: "Turn-Based", icon: "chess-pawn" },
  { key: "solo", label: "Solo", icon: "account" },
  { key: "realtime", label: "Realtime", icon: "lightning-bolt" },
  { key: "general", label: "General", icon: "star-four-points" },
];

const PURPLE = "#8B5CF6";

function isUnclaimed(entry: AchievementEntryV4): boolean {
  if (entry.schemaVersion && entry.schemaVersion >= 2) {
    return entry.status === "earned_unclaimed";
  }
  return false;
}

export default function AchievementsHubScreen() {
  const { theme } = useAppTheme();
  const { currentFirebaseUser } = useAuth();
  const navigation = useNavigation<Nav>();
  const uid = currentFirebaseUser?.uid;
  const colors = theme.colors;
  const isDark = theme.isDark;

  const [earned, setEarned] = useState<AchievementEntryV4[]>([]);
  const [claimedSections, setClaimedSections] = useState<ClaimedSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingSection, setClaimingSection] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!loading) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
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

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeToAchievementSections(uid, setClaimedSections);
    return unsub;
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      markAchievementNotificationsRead(uid).catch((error) => {
        console.warn(
          "[gamesV4] Failed to mark achievement notifications read:",
          error,
        );
      });
    }, [uid]),
  );

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

  const totalUnclaimed = useMemo(() => {
    let total = 0;
    for (const v of unclaimedBySection.values()) total += v;
    return total;
  }, [unclaimedBySection]);

  const totalUnclaimedTokens = useMemo(() => {
    let total = 0;
    for (const entry of earned) {
      if (isUnclaimed(entry)) total += entry.tokenReward || 0;
    }
    return total;
  }, [earned]);

  const totalAchievements = useMemo(
    () =>
      ACHIEVEMENT_SECTIONS.reduce(
        (sum, s) => sum + getDefsForSection(s.sectionId).length,
        0,
      ),
    [],
  );

  // Search + Filter + Sort (with claimable prioritization)
  const processedSections = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    let sections =
      activeFilter === "all"
        ? [...ACHIEVEMENT_SECTIONS]
        : ACHIEVEMENT_SECTIONS.filter(
            (s) => s.runtimeCategory === activeFilter,
          );

    if (query.length > 0) {
      sections = sections.filter((section) => {
        if (section.name.toLowerCase().includes(query)) return true;
        if (section.description.toLowerCase().includes(query)) return true;
        const defs = getDefsForSection(section.sectionId);
        return defs.some(
          (def) =>
            def.name.toLowerCase().includes(query) ||
            def.description.toLowerCase().includes(query) ||
            DIFFICULTY_META[def.difficulty].label.toLowerCase().includes(query),
        );
      });
    }

    // Sort: unclaimed first, then by progress descending
    sections.sort((a, b) => {
      const aUnclaimed = unclaimedBySection.get(a.sectionId) ?? 0;
      const bUnclaimed = unclaimedBySection.get(b.sectionId) ?? 0;
      if (aUnclaimed > 0 && bUnclaimed === 0) return -1;
      if (bUnclaimed > 0 && aUnclaimed === 0) return 1;
      if (aUnclaimed > 0 && bUnclaimed > 0) return bUnclaimed - aUnclaimed;
      const aDefs = getDefsForSection(a.sectionId);
      const bDefs = getDefsForSection(b.sectionId);
      const aP =
        aDefs.length > 0
          ? aDefs.filter((d) => earnedSet.has(d.type)).length / aDefs.length
          : 0;
      const bP =
        bDefs.length > 0
          ? bDefs.filter((d) => earnedSet.has(d.type)).length / bDefs.length
          : 0;
      return bP - aP;
    });

    return sections;
  }, [activeFilter, searchQuery, unclaimedBySection, earnedSet]);

  const searchMatchCount = useMemo(() => {
    if (searchQuery.trim().length === 0) return 0;
    const query = searchQuery.trim().toLowerCase();
    return ACHIEVEMENT_DEFS.filter(
      (def) =>
        def.name.toLowerCase().includes(query) ||
        def.description.toLowerCase().includes(query),
    ).length;
  }, [searchQuery]);

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

  const renderSectionCard = useCallback(
    ({
      item: section,
      index,
    }: {
      item: AchievementSectionDef;
      index: number;
    }) => {
      const defs = getDefsForSection(section.sectionId);
      const earnedCount = defs.filter((d) => earnedSet.has(d.type)).length;
      const total = defs.length;
      const isComplete = earnedCount === total;
      const isClaimed = claimedSet.has(section.sectionId);
      const sectionUnclaimed = unclaimedBySection.get(section.sectionId) ?? 0;

      const cardBg = isDark ? colors.surfaceVariant : colors.surface;
      const isLeft = index % 2 === 0;

      return (
        <TouchableOpacity
          style={[
            styles.sectionCard,
            {
              backgroundColor: cardBg,
              marginRight: isLeft ? 5 : 0,
              marginLeft: isLeft ? 0 : 5,
              borderWidth: sectionUnclaimed > 0 ? 1.5 : isComplete ? 1.5 : 0,
              borderColor:
                sectionUnclaimed > 0
                  ? PURPLE
                  : isComplete
                    ? "#FFD700"
                    : "transparent",
            },
          ]}
          onPress={() =>
            navigation.navigate("AchievementSection", {
              sectionId: section.sectionId,
            })
          }
          activeOpacity={0.65}
        >
          {/* Unclaimed icon top-right */}
          {sectionUnclaimed > 0 && (
            <View style={styles.unclaimedIconWrap}>
              <MaterialCommunityIcons name="gift" size={16} color={PURPLE} />
            </View>
          )}

          {/* Completed badge icon top-right */}
          {sectionUnclaimed === 0 && isClaimed && (
            <View style={styles.claimedIconWrap}>
              <MaterialCommunityIcons
                name="check-decagram"
                size={16}
                color={colors.success}
              />
            </View>
          )}

          {/* Section icon */}
          <View
            style={[
              styles.sectionIconWrap,
              {
                backgroundColor: isDark
                  ? colors.background + "80"
                  : "rgba(128,128,128,0.06)",
              },
            ]}
          >
            <Text style={styles.sectionIcon}>{section.icon}</Text>
          </View>

          {/* Name */}
          <Text
            style={[styles.cardName, { color: colors.text }]}
            numberOfLines={2}
          >
            {section.name}
          </Text>

          {/* Right indicator: purple count circle or chevron */}
          <View style={styles.cardTrailing}>
            {sectionUnclaimed > 0 ? (
              <View style={styles.unclaimedCircle}>
                <Text style={styles.unclaimedCircleText}>
                  {sectionUnclaimed}
                </Text>
              </View>
            ) : (
              <MaterialCommunityIcons
                name="chevron-right"
                size={18}
                color={colors.textMuted}
              />
            )}
          </View>

          {/* Claim badge CTA */}
          {isComplete && !isClaimed && (
            <TouchableOpacity
              style={styles.claimBadgeBtn}
              onPress={() => handleClaimBadge(section.sectionId)}
              disabled={claimingSection === section.sectionId}
              activeOpacity={0.7}
            >
              {claimingSection === section.sectionId ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name="shield-check"
                    size={12}
                    color="#FFF"
                  />
                  <Text style={styles.claimBadgeBtnText}>Claim</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Progress count at bottom center, overlapping border */}
          <View style={[styles.progressBadge, { backgroundColor: cardBg }]}>
            <Text
              style={[
                styles.progressBadgeText,
                { color: colors.textSecondary },
              ]}
            >
              {earnedCount}/{total}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [
      earnedSet,
      claimedSet,
      claimingSection,
      unclaimedBySection,
      isDark,
      colors,
      navigation,
      handleClaimBadge,
    ],
  );

  const bgColor = colors.background;
  const gradientTransparent = isDark ? "rgba(0,0,0,0)" : "rgba(255,255,255,0)";
  const gradientSolid = bgColor;

  const overallProgress =
    totalAchievements > 0 ? earnedSet.size / totalAchievements : 0;
  const progressPct = Math.round(overallProgress * 100);

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading achievements...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Achievements
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Search bar — OUTSIDE FlatList to prevent keyboard dismissal */}
      <View
        style={[
          styles.searchBar,
          {
            backgroundColor: isDark ? colors.surfaceVariant : colors.surface,
            borderColor: searchFocused ? colors.primary + "60" : "transparent",
            borderWidth: 1.5,
          },
        ]}
      >
        <MaterialCommunityIcons
          name="magnify"
          size={20}
          color={searchFocused ? colors.primary : colors.textMuted}
        />
        <TextInput
          ref={searchInputRef}
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search achievements..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setSearchQuery("");
              searchInputRef.current?.blur();
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons
              name="close-circle"
              size={18}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        )}
      </View>

      {searchQuery.trim().length > 0 && (
        <Text
          style={[styles.searchResultsText, { color: colors.textSecondary }]}
        >
          {processedSections.length === 0
            ? "No matching sections"
            : `${processedSections.length} section${processedSections.length !== 1 ? "s" : ""} (${searchMatchCount} achievement${searchMatchCount !== 1 ? "s" : ""} match)`}
        </Text>
      )}

      {/* Filter chips — horizontal scroll with gradient edges */}
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
          keyboardShouldPersistTaps="always"
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
                      : isDark
                        ? colors.surfaceVariant
                        : colors.surfaceVariant,
                    borderColor: isActive ? colors.primary : colors.border,
                    borderWidth: 1,
                  },
                ]}
                onPress={() => setActiveFilter(chip.key)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name={chip.icon as any}
                  size={14}
                  color={isActive ? "#FFF" : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    { color: isActive ? "#FFF" : colors.textSecondary },
                  ]}
                >
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {/* Left fade gradient */}
        <View style={styles.gradientLeft} pointerEvents="none">
          <LinearGradient
            colors={[gradientSolid, gradientTransparent]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
        {/* Right fade gradient */}
        <View style={styles.gradientRight} pointerEvents="none">
          <LinearGradient
            colors={[gradientTransparent, gradientSolid]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
      </View>

      {/* Main content */}
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <FlatList
          data={processedSections}
          keyExtractor={(item) => item.sectionId}
          renderItem={renderSectionCard}
          numColumns={2}
          ListHeaderComponent={
            <>
              {/* Hero progress card */}
              <View
                style={[
                  styles.heroCard,
                  {
                    backgroundColor: isDark
                      ? colors.surfaceVariant
                      : colors.surface,
                  },
                ]}
              >
                <View style={styles.heroTopRow}>
                  <View style={styles.heroIconWrap}>
                    <MaterialCommunityIcons
                      name="trophy"
                      size={32}
                      color="#FFD700"
                    />
                  </View>
                  <View style={styles.heroInfo}>
                    <Text style={[styles.heroTitle, { color: colors.text }]}>
                      {earnedSet.size} of {totalAchievements}
                    </Text>
                    <Text
                      style={[
                        styles.heroSubtitle,
                        { color: colors.textSecondary },
                      ]}
                    >
                      achievements earned
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.heroPctWrap,
                      { backgroundColor: colors.primary + "18" },
                    ]}
                  >
                    <Text
                      style={[styles.heroPctText, { color: colors.primary }]}
                    >
                      {progressPct}%
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.heroProgressTrack,
                    {
                      backgroundColor: isDark
                        ? colors.background
                        : colors.surfaceVariant,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.heroProgressFill,
                      {
                        width: `${overallProgress * 100}%`,
                        backgroundColor: colors.primary,
                      },
                    ]}
                  />
                </View>

                {totalUnclaimed > 0 && (
                  <View
                    style={[
                      styles.heroUnclaimedBar,
                      { backgroundColor: colors.warning + "12" },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="gift-outline"
                      size={16}
                      color={colors.warning}
                    />
                    <Text
                      style={[
                        styles.heroUnclaimedText,
                        { color: colors.warning },
                      ]}
                    >
                      {totalUnclaimed} unclaimed reward
                      {totalUnclaimed !== 1 ? "s" : ""} — +
                      {totalUnclaimedTokens} tokens waiting
                    </Text>
                  </View>
                )}
              </View>

              <Text
                style={[styles.sectionCountLabel, { color: colors.textMuted }]}
              >
                {processedSections.length} section
                {processedSections.length !== 1 ? "s" : ""}
              </Text>
            </>
          }
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="on-drag"
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons
                name={
                  searchQuery.length > 0 ? "magnify-close" : "trophy-broken"
                }
                size={48}
                color={colors.textMuted}
              />
              <Text
                style={[styles.emptyTitle, { color: colors.textSecondary }]}
              >
                {searchQuery.length > 0
                  ? "No results found"
                  : "No sections in this category"}
              </Text>
              <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
                {searchQuery.length > 0
                  ? "Try a different search term or filter"
                  : "Try selecting a different filter above"}
              </Text>
            </View>
          }
        />
      </Animated.View>
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
  backButton: { padding: 4 },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  headerSpacer: { width: 32 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 10 : 4,
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 1 },
    }),
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    paddingVertical: 0,
  },
  searchResultsText: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 4,
    paddingHorizontal: 20,
  },
  filterContainer: {
    position: "relative",
    marginBottom: 10,
  },
  filterScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  gradientLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 20,
  },
  gradientRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 20,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 5,
  },
  filterChipText: { fontSize: 12.5, fontWeight: "600" },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  heroCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    gap: 12,
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
  heroTopRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FFD70018",
    justifyContent: "center",
    alignItems: "center",
  },
  heroInfo: { flex: 1 },
  heroTitle: { fontSize: 22, fontWeight: "800", letterSpacing: -0.3 },
  heroSubtitle: { fontSize: 13, fontWeight: "500", marginTop: 1 },
  heroPctWrap: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  heroPctText: { fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },
  heroProgressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  heroProgressFill: { height: "100%", borderRadius: 3 },
  heroUnclaimedBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  heroUnclaimedText: { fontSize: 12.5, fontWeight: "600", flex: 1 },
  sectionCountLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionCard: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    paddingBottom: 18,
    marginBottom: 14,
    alignItems: "center",
    position: "relative",
    overflow: "visible",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 2 },
    }),
  },
  unclaimedIconWrap: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 1,
  },
  claimedIconWrap: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 1,
  },
  sectionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 8,
  },
  sectionIcon: { fontSize: 26 },
  cardName: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.1,
    textAlign: "center",
    lineHeight: 17,
  },
  cardTrailing: {
    position: "absolute",
    bottom: 6,
    right: 6,
  },
  unclaimedCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: PURPLE,
    justifyContent: "center",
    alignItems: "center",
  },
  unclaimedCircleText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "800",
  },
  claimBadgeBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#34C759",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
    marginTop: 6,
  },
  claimBadgeBtnText: { color: "#FFF", fontSize: 11, fontWeight: "700" },
  progressBadge: {
    position: "absolute",
    bottom: -8,
    alignSelf: "center",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  progressBadgeText: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  emptyContainer: { paddingVertical: 60, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "600", marginTop: 4 },
  emptyDesc: { fontSize: 13, textAlign: "center", maxWidth: 240 },
});
