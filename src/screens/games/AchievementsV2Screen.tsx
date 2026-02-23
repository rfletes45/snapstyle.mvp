/**
 * AchievementsV2Screen — V2 achievements UI with collapsible game sections,
 * section progress tracking, and themed badge rewards.
 *
 * Rendered by AchievementsScreen when ACHIEVEMENTS_V2_FEATURES.V2_UI is true.
 *
 * Features:
 *   - Tab-based filtering: Global, Solo, Turn, Live
 *   - Collapsible sections grouped by game/type
 *   - Section headers with progress bars and completion badges
 *   - Per-achievement progress bars and tier badges
 *   - Summary card with tier breakdown
 *   - Secret achievements (hidden until in-progress)
 */

import { LoadingState } from "@/components/ui";
import { getMasterBadgeForSection } from "@/config/masterBadges";
import { BorderRadius, Spacing } from "@/constants/theme";
import { useAchievementsV2 } from "@/hooks/useAchievementsV2";
import type { V2AchievementDisplayItem } from "@/services/achievementsV2";
import { buildSectionsWithProgress } from "@/services/achievementsV2";
import {
  batchGetMasterBadgeStatuses,
  claimMasterBadge,
  type MasterBadgeStatus,
} from "@/services/masterBadgeClaim";
import { useAuth } from "@/store/AuthContext";
import type {
  AchievementSectionWithProgress,
  AchievementV2Tier,
} from "@/types/achievementsV2";
import type { ExtendedGameType } from "@/types/games";
import { GAME_METADATA } from "@/types/games";
import type { PlayStackParamList } from "@/types/navigation/root";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  UIManager,
  View,
} from "react-native";
import {
  Appbar,
  Card,
  Chip,
  ProgressBar,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// =============================================================================
// Constants
// =============================================================================

type V2Tab = "global" | "single_player" | "turn_based" | "real_time";

const V2_TABS: { id: V2Tab; label: string; icon: string }[] = [
  { id: "global", label: "Global", icon: "star-circle" },
  { id: "single_player", label: "Solo", icon: "account" },
  { id: "turn_based", label: "Turn", icon: "account-group" },
  { id: "real_time", label: "Live", icon: "lightning-bolt" },
];

const TIER_COLORS: Record<AchievementV2Tier, string> = {
  bronze: "#CD7F32",
  silver: "#C0C0C0",
  gold: "#FFD700",
  platinum: "#E5E4E2",
  diamond: "#B9F2FF",
};

const TIER_ORDER: AchievementV2Tier[] = [
  "diamond",
  "platinum",
  "gold",
  "silver",
  "bronze",
];

// =============================================================================
// Types
// =============================================================================

type Props = NativeStackScreenProps<PlayStackParamList, "Achievements">;

// =============================================================================
// Sub-components
// =============================================================================

/** Individual achievement card */
function V2AchievementCard({
  item,
  onEquipPress,
}: {
  item: V2AchievementDisplayItem;
  onEquipPress?: () => void;
}) {
  const theme = useTheme();
  const tierColor = TIER_COLORS[item.tier];
  const isUnlocked = item.state === "unlocked";
  const hasProgress = item.state === "progress";
  const hasEntitlementRewards =
    isUnlocked &&
    item.rewards?.entitlements &&
    item.rewards.entitlements.length > 0;

  return (
    <Card
      style={[
        styles.achievementCard,
        { backgroundColor: theme.colors.surface },
        item.state === "locked" && {
          backgroundColor: theme.colors.surfaceVariant,
          opacity: 0.8,
        },
      ]}
      mode="outlined"
    >
      <Card.Content style={styles.achievementContent}>
        {/* Icon */}
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: isUnlocked
                ? tierColor + "30"
                : hasProgress
                  ? tierColor + "15"
                  : "#E0E0E0",
            },
          ]}
        >
          <Text style={{ fontSize: 24 }}>{item.icon}</Text>
        </View>

        {/* Details */}
        <View style={styles.detailsContainer}>
          <View style={styles.titleRow}>
            <View
              style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
            >
              <Text
                style={[
                  styles.achievementName,
                  item.state === "locked" && styles.lockedText,
                ]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              {item.secret && (
                <Text style={{ fontSize: 12, marginLeft: 4 }}>
                  {isUnlocked ? "🌟" : "🔒"}
                </Text>
              )}
            </View>
            <Chip
              style={[styles.rarityChip, { backgroundColor: tierColor + "20" }]}
              textStyle={{ color: tierColor, fontSize: 10 }}
            >
              {item.tier.toUpperCase()}
            </Chip>
          </View>

          <Text
            style={[
              styles.achievementDesc,
              item.state === "locked" && styles.lockedText,
            ]}
            numberOfLines={2}
          >
            {item.description}
          </Text>

          {/* Progress bar */}
          {(hasProgress || isUnlocked) && (
            <View style={styles.progressRow}>
              <ProgressBar
                progress={item.progressPct}
                color={isUnlocked ? tierColor : theme.colors.primary}
                style={styles.itemProgressBar}
              />
              <Text style={styles.progressText}>
                {item.progress}/{item.target}
              </Text>
            </View>
          )}

          {/* Rewards */}
          <View style={styles.rewardsRow}>
            <MaterialCommunityIcons
              name="star-circle"
              size={13}
              color="#FFD700"
            />
            <Text style={styles.rewardText}>
              {" "}
              {item.rewards?.tokens
                ? `${item.rewards.tokens} tokens`
                : `${item.coinReward}`}
              {"  • "}
            </Text>
            <Text style={{ fontSize: 12 }}>⭐</Text>
            <Text style={styles.rewardText}> {item.xpReward} XP</Text>
          </View>

          {/* Equip CTA for unlocked entitlement rewards */}
          {hasEntitlementRewards && (
            <Pressable
              onPress={onEquipPress}
              style={({ pressed }) => [
                styles.equipRow,
                { backgroundColor: tierColor + (pressed ? "25" : "15") },
              ]}
            >
              <MaterialCommunityIcons
                name="star-circle"
                size={14}
                color={tierColor}
              />
              <Text style={[styles.equipText, { color: tierColor }]}>
                Badge unlocked — Equip now!
              </Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={16}
                color={tierColor}
              />
            </Pressable>
          )}

          {isUnlocked && item.unlockedAt && (
            <Text style={styles.earnedDate}>
              Earned {formatDate(item.unlockedAt)}
            </Text>
          )}
        </View>

        {/* Status icon */}
        <View style={styles.statusContainer}>
          {isUnlocked ? (
            <MaterialCommunityIcons
              name="check-circle"
              size={24}
              color={tierColor}
            />
          ) : hasProgress ? (
            <MaterialCommunityIcons
              name="progress-clock"
              size={24}
              color={theme.colors.primary}
            />
          ) : (
            <MaterialCommunityIcons
              name="lock"
              size={24}
              color={theme.colors.onSurfaceVariant}
            />
          )}
        </View>
      </Card.Content>
    </Card>
  );
}

/** Section completion badge display with master badge claim status */
function SectionBadgeIndicator({
  sectionData,
  masterBadgeStatus,
  onClaimPress,
  onEquipPress,
  isClaiming,
}: {
  sectionData: AchievementSectionWithProgress;
  masterBadgeStatus?: MasterBadgeStatus;
  onClaimPress?: () => void;
  onEquipPress?: () => void;
  isClaiming?: boolean;
}) {
  const theme = useTheme();
  const { section, isComplete, unlockedCount, totalCount } = sectionData;
  const badgeTierColor = TIER_COLORS[section.badge.tier];
  const masterBadge = getMasterBadgeForSection(section.id);

  // Show locked master badge info when section is NOT complete
  if (!isComplete && masterBadge) {
    return (
      <View
        style={[
          styles.sectionBadge,
          {
            backgroundColor: theme.colors.surfaceVariant,
            borderColor: theme.colors.outlineVariant,
          },
        ]}
      >
        <MaterialCommunityIcons
          name="lock"
          size={16}
          color={theme.colors.onSurfaceVariant}
        />
        <Text
          style={[
            styles.sectionBadgeText,
            { color: theme.colors.onSurfaceVariant },
          ]}
        >
          {masterBadge.displayName} — Complete all {totalCount} achievements to
          unlock
        </Text>
      </View>
    );
  }

  if (!isComplete) return null;

  // Section is complete — show status-dependent UI
  const status = masterBadgeStatus ?? "claimable";

  if (status === "claimed") {
    // Already claimed — show claimed + Equip button
    return (
      <View
        style={[
          styles.sectionBadge,
          {
            backgroundColor: badgeTierColor + "25",
            borderColor: badgeTierColor,
          },
        ]}
      >
        <Text style={{ fontSize: 16 }}>{section.badge.icon}</Text>
        <Text style={[styles.sectionBadgeText, { color: badgeTierColor }]}>
          {section.badge.name}
        </Text>
        <MaterialCommunityIcons
          name="check-decagram"
          size={16}
          color={badgeTierColor}
        />
        {onEquipPress && (
          <Pressable
            onPress={onEquipPress}
            style={({ pressed }) => [
              styles.masterBadgeButton,
              {
                backgroundColor: badgeTierColor + (pressed ? "40" : "20"),
                borderColor: badgeTierColor,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="star-circle"
              size={14}
              color={badgeTierColor}
            />
            <Text
              style={[styles.masterBadgeButtonText, { color: badgeTierColor }]}
            >
              Equip
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  // Claimable — show claim button
  return (
    <View
      style={[
        styles.sectionBadge,
        {
          backgroundColor: badgeTierColor + "15",
          borderColor: badgeTierColor,
        },
      ]}
    >
      <Text style={{ fontSize: 16 }}>{section.badge.icon}</Text>
      <Text style={[styles.sectionBadgeText, { color: badgeTierColor }]}>
        {section.badge.name}
      </Text>
      <Pressable
        onPress={onClaimPress}
        disabled={isClaiming}
        style={({ pressed }) => [
          styles.masterBadgeButton,
          {
            backgroundColor: isClaiming
              ? theme.colors.surfaceDisabled
              : badgeTierColor + (pressed ? "50" : "30"),
            borderColor: badgeTierColor,
          },
        ]}
      >
        <MaterialCommunityIcons
          name={isClaiming ? "loading" : "gift"}
          size={14}
          color={isClaiming ? theme.colors.onSurfaceDisabled : badgeTierColor}
        />
        <Text
          style={[
            styles.masterBadgeButtonText,
            {
              color: isClaiming
                ? theme.colors.onSurfaceDisabled
                : badgeTierColor,
            },
          ]}
        >
          {isClaiming ? "Claiming..." : "Claim Master Badge"}
        </Text>
      </Pressable>
    </View>
  );
}

/** Collapsible section header */
function CollapsibleSectionHeader({
  sectionData,
  isExpanded,
  onToggle,
}: {
  sectionData: AchievementSectionWithProgress;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const { section, unlockedCount, totalCount, completionPct, isComplete } =
    sectionData;

  const progressColor = isComplete
    ? TIER_COLORS[section.badge.tier]
    : theme.colors.primary;

  return (
    <Pressable onPress={onToggle} style={styles.sectionHeaderPressable}>
      <View
        style={[
          styles.sectionHeader,
          {
            backgroundColor: isComplete
              ? TIER_COLORS[section.badge.tier] + "10"
              : theme.colors.surfaceVariant,
            borderColor: isComplete
              ? TIER_COLORS[section.badge.tier] + "40"
              : theme.colors.outlineVariant,
          },
        ]}
      >
        {/* Icon + Name */}
        <View style={styles.sectionHeaderLeft}>
          <Text style={{ fontSize: 22 }}>{section.icon}</Text>
          <View style={styles.sectionHeaderInfo}>
            <View style={styles.sectionTitleRow}>
              <Text
                style={[
                  styles.sectionHeaderName,
                  { color: theme.colors.onSurface },
                ]}
                numberOfLines={1}
              >
                {section.name}
              </Text>
              {isComplete && (
                <MaterialCommunityIcons
                  name="check-decagram"
                  size={18}
                  color={TIER_COLORS[section.badge.tier]}
                />
              )}
            </View>

            {/* Progress bar */}
            <View style={styles.sectionProgressRow}>
              <ProgressBar
                progress={completionPct}
                color={progressColor}
                style={styles.sectionProgressBar}
              />
              <Text
                style={[
                  styles.sectionProgressText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {unlockedCount}/{totalCount}
              </Text>
            </View>
          </View>
        </View>

        {/* Chevron */}
        <MaterialCommunityIcons
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={24}
          color={theme.colors.onSurfaceVariant}
        />
      </View>
    </Pressable>
  );
}

/** Tier breakdown row */
function TierBreakdown({
  unlockedByTier,
}: {
  unlockedByTier: Record<AchievementV2Tier, number>;
}) {
  return (
    <View style={styles.tierRow}>
      {TIER_ORDER.map((tier) => {
        const count = unlockedByTier[tier];
        if (count === 0) return null;
        return (
          <View key={tier} style={styles.tierBadge}>
            <View
              style={[styles.tierDot, { backgroundColor: TIER_COLORS[tier] }]}
            />
            <Text style={styles.tierCount}>{count}</Text>
          </View>
        );
      })}
    </View>
  );
}

// =============================================================================
// Main Screen
// =============================================================================

export default function AchievementsV2Screen({ navigation, route }: Props) {
  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const userId = currentFirebaseUser?.uid;
  const filterGameId = route.params?.gameId;

  const [activeTab, setActiveTab] = useState<V2Tab>("global");
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(),
  );

  // Track whether sections have been initialized (default all collapsed)
  const sectionsInitializedRef = useRef(false);

  // Filter by category based on active tab (or game filter)
  const categoryFilter = filterGameId ? undefined : activeTab;

  const {
    isV2Active,
    isLoading,
    displayItems,
    summary,
    newUnlocks,
    clearNewUnlocks,
  } = useAchievementsV2(userId, {
    gameType: filterGameId as ExtendedGameType | undefined,
    category: categoryFilter,
  });

  // Determine the effective category for section building.
  // When filterGameId is set, derive category from the items themselves
  // (they all share the same category since they're filtered to one game).
  const effectiveCategory: V2Tab = useMemo(() => {
    if (filterGameId && displayItems.length > 0) {
      return displayItems[0].category as V2Tab;
    }
    return activeTab;
  }, [filterGameId, displayItems, activeTab]);

  // Build collapsible sections grouped by game
  const sections = useMemo(() => {
    if (!displayItems.length) return [];
    return buildSectionsWithProgress(displayItems, effectiveCategory);
  }, [displayItems, effectiveCategory]);

  // Default all sections collapsed on initial load
  useEffect(() => {
    if (!sectionsInitializedRef.current && sections.length > 0) {
      sectionsInitializedRef.current = true;
      setCollapsedSections(new Set(sections.map((s) => s.section.id)));
    }
  }, [sections]);

  // Count completed sections for the summary
  const completedSectionCount = useMemo(
    () => sections.filter((s) => s.isComplete).length,
    [sections],
  );

  // Toggle section collapse
  const toggleSection = useCallback((sectionId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  // Navigate to Customization Hub (badges tab) when user taps "Equip now!"
  const handleEquipBadgePress = useCallback(() => {
    (navigation as any).navigate("Customization", { initialTab: "badge" });
  }, [navigation]);

  // ── Master Badge State ──────────────────────────────────
  const [masterBadgeStatuses, setMasterBadgeStatuses] = useState<
    Record<string, MasterBadgeStatus>
  >({});
  const [claimingSectionId, setClaimingSectionId] = useState<string | null>(
    null,
  );

  // Load master badge statuses when sections change
  useEffect(() => {
    if (!userId || sections.length === 0) return;

    const sectionInfos = sections.map((s) => ({
      sectionId: s.section.id,
      isComplete: s.isComplete,
    }));

    batchGetMasterBadgeStatuses(userId, sectionInfos)
      .then(setMasterBadgeStatuses)
      .catch(() => {
        // On error, default all complete sections to claimable
        const fallback: Record<string, MasterBadgeStatus> = {};
        for (const s of sections) {
          fallback[s.section.id] = s.isComplete ? "claimable" : "locked";
        }
        setMasterBadgeStatuses(fallback);
      });
  }, [userId, sections]);

  // Handle master badge claim
  const handleClaimMasterBadge = useCallback(
    async (sectionId: string, isComplete: boolean) => {
      if (!userId || claimingSectionId) return;

      setClaimingSectionId(sectionId);
      try {
        const result = await claimMasterBadge(userId, sectionId, isComplete);
        if (result.success) {
          setMasterBadgeStatuses((prev) => ({
            ...prev,
            [sectionId]: "claimed",
          }));
        }
      } catch {
        // Silently fail — user can retry
      } finally {
        setClaimingSectionId(null);
      }
    },
    [userId, claimingSectionId],
  );
  // Expand/collapse all
  const toggleAll = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsedSections((prev) => {
      if (prev.size === sections.length) {
        // All collapsed → expand all
        return new Set();
      }
      // Some/none collapsed → collapse all
      return new Set(sections.map((s) => s.section.id));
    });
  }, [sections]);

  if (!userId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text>Please sign in to view achievements</Text>
        </View>
      </SafeAreaView>
    );
  }

  const completionPct =
    summary.totalAvailable > 0
      ? Math.round((summary.totalUnlocked / summary.totalAvailable) * 100)
      : 0;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["bottom"]}
    >
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content
          title={
            filterGameId && GAME_METADATA[filterGameId as ExtendedGameType]
              ? `${GAME_METADATA[filterGameId as ExtendedGameType].name} Achievements`
              : "Achievements"
          }
        />
        {/* Expand/Collapse All toggle */}
        {!filterGameId && sections.length > 1 && (
          <Appbar.Action
            icon={
              collapsedSections.size === sections.length
                ? "unfold-more-horizontal"
                : "unfold-less-horizontal"
            }
            onPress={toggleAll}
          />
        )}
      </Appbar.Header>

      {/* Tabs */}
      {!filterGameId && (
        <View
          style={[
            styles.tabBar,
            { borderBottomColor: theme.colors.outlineVariant },
          ]}
        >
          {V2_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                style={[
                  styles.tab,
                  isActive && [
                    styles.activeTab,
                    { borderBottomColor: theme.colors.primary },
                  ],
                ]}
                onPress={() => {
                  setActiveTab(tab.id);
                  // Default all collapsed on tab change (IDs update via effect)
                  sectionsInitializedRef.current = false;
                }}
              >
                <MaterialCommunityIcons
                  name={
                    tab.icon as keyof typeof MaterialCommunityIcons.glyphMap
                  }
                  size={18}
                  color={
                    isActive
                      ? theme.colors.primary
                      : theme.colors.onSurfaceVariant
                  }
                />
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color: isActive
                        ? theme.colors.primary
                        : theme.colors.onSurfaceVariant,
                    },
                    isActive && styles.tabLabelActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {isLoading ? (
        <LoadingState message="Loading achievements..." />
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={() => {
                /* v2 is realtime — no manual refresh needed */
              }}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
        >
          {/* Summary Card */}
          <Card
            style={[
              styles.summaryCard,
              { backgroundColor: theme.colors.surface },
            ]}
            mode="elevated"
          >
            <Card.Content>
              <View style={styles.summaryRow}>
                <MaterialCommunityIcons
                  name="trophy"
                  size={32}
                  color="#FFD700"
                />
                <View style={styles.summaryText}>
                  <Text
                    style={[
                      styles.summaryTitle,
                      { color: theme.colors.onSurface },
                    ]}
                  >
                    {summary.totalUnlocked} / {summary.totalAvailable}{" "}
                    Achievements
                  </Text>
                  <Text
                    style={[
                      styles.summarySubtitle,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    {completionPct}% Complete • {summary.totalXpEarned} XP
                    {completedSectionCount > 0 &&
                      ` • ${completedSectionCount} Badge${completedSectionCount > 1 ? "s" : ""}`}
                  </Text>
                </View>
              </View>
              <ProgressBar
                progress={completionPct / 100}
                color={theme.colors.primary}
                style={styles.progressBar}
              />
              <TierBreakdown unlockedByTier={summary.unlockedByTier} />
            </Card.Content>
          </Card>

          {/* Collapsible Sections */}
          {sections.map((sectionData) => {
            const isExpanded = !collapsedSections.has(sectionData.section.id);

            return (
              <View key={sectionData.section.id} style={styles.section}>
                <CollapsibleSectionHeader
                  sectionData={sectionData}
                  isExpanded={isExpanded}
                  onToggle={() => toggleSection(sectionData.section.id)}
                />

                {isExpanded && (
                  <View style={styles.sectionBody}>
                    {/* Master badge indicator — shows locked/claimable/claimed */}
                    <SectionBadgeIndicator
                      sectionData={sectionData}
                      masterBadgeStatus={
                        masterBadgeStatuses[sectionData.section.id]
                      }
                      onClaimPress={() =>
                        handleClaimMasterBadge(
                          sectionData.section.id,
                          sectionData.isComplete,
                        )
                      }
                      onEquipPress={handleEquipBadgePress}
                      isClaiming={claimingSectionId === sectionData.section.id}
                    />

                    {/* Achievement cards */}
                    {sectionData.items.map((item) => (
                      <V2AchievementCard
                        key={item.id}
                        item={item}
                        onEquipPress={handleEquipBadgePress}
                      />
                    ))}
                  </View>
                )}
              </View>
            );
          })}

          {displayItems.length === 0 && (
            <View style={styles.emptySections}>
              <MaterialCommunityIcons
                name="trophy-outline"
                size={48}
                color={theme.colors.onSurfaceVariant}
              />
              <Text
                style={[
                  styles.emptyText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                No achievements in this category
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },

  // Tab bar
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingHorizontal: Spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    paddingVertical: 10,
    gap: 2,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {},
  tabLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  tabLabelActive: {
    fontWeight: "700",
  },

  // List content
  listContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },

  // Summary
  summaryCard: {
    marginBottom: Spacing.lg,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
    marginBottom: Spacing.md,
  },
  summaryText: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  summarySubtitle: {
    fontSize: 14,
  },
  progressBar: {
    height: 8,
    borderRadius: BorderRadius.xs,
  },

  // Tier breakdown row
  tierRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  tierDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  tierCount: {
    fontSize: 12,
    fontWeight: "600",
  },

  // Section headers
  section: {
    marginBottom: Spacing.md,
  },
  sectionHeaderPressable: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    flex: 1,
  },
  sectionHeaderInfo: {
    flex: 1,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: 4,
  },
  sectionHeaderName: {
    fontSize: 16,
    fontWeight: "700",
  },
  sectionProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  sectionProgressBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  sectionProgressText: {
    fontSize: 12,
    fontWeight: "600",
    minWidth: 30,
    textAlign: "right",
  },

  // Section body (expanded content)
  sectionBody: {
    paddingTop: Spacing.sm,
    paddingLeft: Spacing.xs,
  },

  // Section badge
  sectionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  sectionBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },

  // Master badge claim/equip buttons
  masterBadgeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  masterBadgeButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },

  // Achievement cards
  achievementCard: {
    marginBottom: Spacing.sm,
  },
  achievementContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    justifyContent: "center",
    alignItems: "center",
  },
  detailsContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  achievementName: {
    fontSize: 16,
    fontWeight: "600",
    flexShrink: 1,
  },
  rarityChip: {
    height: 20,
  },
  achievementDesc: {
    fontSize: 13,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  itemProgressBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    fontWeight: "600",
    minWidth: 30,
    textAlign: "right",
  },
  rewardsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  rewardText: {
    fontSize: 11,
    color: "#888",
  },
  lockedText: {},
  earnedDate: {
    fontSize: 11,
    marginTop: Spacing.xs,
  },
  equipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: Spacing.xs,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.sm,
    alignSelf: "flex-start",
  },
  equipText: {
    fontSize: 11,
    fontWeight: "700",
  },
  statusContainer: {
    alignItems: "center",
    justifyContent: "center",
  },

  // Empty state
  emptySections: {
    alignItems: "center",
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
});
