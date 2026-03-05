/**
 * Games V4 — Battlepass-style Level Rewards Track
 *
 * Horizontal scrollable tier track with progress rail and tier nodes.
 * Displays all 50 levels with locked/unlocked/claimed states.
 * Tapping a tier node opens the TierDetailsSheet for claim/details.
 *
 * @module gamesV4/components/LevelRewardsTrack
 */

import type { LevelReward } from "@/data/levelRewards";
import { LEVEL_REWARDS, MAX_REWARD_LEVEL } from "@/data/levelRewards";
import type { LevelRewardDocV4 } from "@/gamesV4/services/gameServiceV4";
import { useColors } from "@/store/ThemeContext";
import type { LevelInfo } from "@/types/profile";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import TierDetailsSheet from "./TierDetailsSheet";

// =============================================================================
// Constants
// =============================================================================

const TIER_CELL_WIDTH = 72;
/** Height of the rail line */
const RAIL_HEIGHT = 4;
/** Fixed vertical position of the rail centerline in every cell */
const RAIL_CENTER_Y = 58;
/** Raise applied to milestone content (node + label + icons) */
const MILESTONE_RAISE = 10;

// =============================================================================
// Types
// =============================================================================

export interface LevelRewardsTrackProps {
  /** User's current level info */
  levelInfo: LevelInfo;
  /** User's unlocked/claimed reward docs from Firestore */
  rewardDocs: LevelRewardDocV4[];
  /** Called when user taps Claim in the tier details */
  onClaim: (level: number) => Promise<void>;
  /** Level currently being claimed (null if none) */
  claimingLevel: number | null;
}

type TierState = "locked" | "unlocked" | "claimed";

interface TierData {
  def: LevelReward;
  state: TierState;
  doc: LevelRewardDocV4 | null;
  isCurrent: boolean;
}

// =============================================================================
// Component
// =============================================================================

function LevelRewardsTrackBase({
  levelInfo,
  rewardDocs,
  onClaim,
  claimingLevel,
}: LevelRewardsTrackProps) {
  const colors = useColors();
  const flatListRef = useRef<FlatList>(null);
  const [selectedTier, setSelectedTier] = useState<TierData | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  const currentLevel = levelInfo.current;
  const isMaxLevel = currentLevel >= MAX_REWARD_LEVEL;

  // Build reward doc lookup map
  const docMap = useMemo(() => {
    const map = new Map<number, LevelRewardDocV4>();
    for (const d of rewardDocs) map.set(d.level, d);
    return map;
  }, [rewardDocs]);

  // Build tier data array for all 50 levels
  const tiers: TierData[] = useMemo(() => {
    return LEVEL_REWARDS.map((def) => {
      const doc = docMap.get(def.level) ?? null;
      const isClaimed =
        doc !== null && doc.claimedAt !== null && doc.claimedAt !== undefined;
      const isUnlocked = doc !== null;
      // If user's level >= tier level but no doc exists yet, treat as
      // unlocked (claimable). This handles level 1 and any levels where
      // the unlock doc was never created (e.g. retroactive feature rollout).
      const reachedButNoDoc = doc === null && currentLevel >= def.level;
      const state: TierState = isClaimed
        ? "claimed"
        : isUnlocked || reachedButNoDoc
          ? "unlocked"
          : "locked";
      return {
        def,
        state,
        doc,
        isCurrent: def.level === currentLevel,
      };
    });
  }, [docMap, currentLevel]);

  // XP progress ratio between current level and next (for rail fill)
  const xpProgress = useMemo(() => {
    if (isMaxLevel) return 1;
    if (levelInfo.xpToNextLevel <= 0) return 1;
    return Math.min(1, Math.max(0, levelInfo.xp / levelInfo.xpToNextLevel));
  }, [levelInfo, isMaxLevel]);

  // Scroll to current level on mount
  useEffect(() => {
    const rawIdx = (currentLevel ?? 0) - 1;
    const idx = Number.isFinite(rawIdx) ? Math.max(0, rawIdx) : 0;
    const safeIdx = Math.min(idx, LEVEL_REWARDS.length - 1);
    const timer = setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index: safeIdx,
        viewPosition: 0.35,
        animated: true,
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [currentLevel]);

  // Handle tier tap
  const handleTierPress = useCallback((tier: TierData) => {
    setSelectedTier(tier);
    setSheetVisible(true);
  }, []);

  // Close sheet
  const handleCloseSheet = useCallback(() => {
    setSheetVisible(false);
    setSelectedTier(null);
  }, []);

  // Jump to current level
  const handleJumpToCurrent = useCallback(() => {
    const rawIdx = (currentLevel ?? 0) - 1;
    const idx = Number.isFinite(rawIdx) ? Math.max(0, rawIdx) : 0;
    const safeIdx = Math.min(idx, LEVEL_REWARDS.length - 1);
    flatListRef.current?.scrollToIndex({
      index: safeIdx,
      viewPosition: 0.35,
      animated: true,
    });
  }, [currentLevel]);

  // Render a single tier node
  const renderTier = useCallback(
    ({ item, index }: { item: TierData; index: number }) => {
      const { def, state, isCurrent } = item;
      const isMilestone = def.isMilestone;
      const cellWidth = TIER_CELL_WIDTH;

      // Node colors
      const nodeColor =
        state === "claimed"
          ? "#34C759"
          : state === "unlocked"
            ? "#007AFF"
            : colors.surfaceVariant;

      const nodeBorderColor = isCurrent
        ? "#FFD700"
        : state === "claimed"
          ? "#34C759"
          : state === "unlocked"
            ? "#007AFF"
            : "transparent";

      const nodeSize = isMilestone ? 48 : 36;

      // Rail segment: filled up to current level, partial on current
      const isBeforeCurrent = def.level < currentLevel;
      const isCurrentLevel = def.level === currentLevel;
      const railFill = isBeforeCurrent ? 1 : isCurrentLevel ? xpProgress : 0;

      return (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => handleTierPress(item)}
          style={[styles.tierCell, { width: cellWidth }]}
        >
          {/* Rail segment — fixed vertical position for all cells */}
          <View
            style={[
              styles.railSegment,
              {
                top: RAIL_CENTER_Y - RAIL_HEIGHT / 2,
                backgroundColor: colors.surfaceVariant,
              },
            ]}
          >
            <View
              style={[
                styles.railFill,
                {
                  width: `${railFill * 100}%`,
                  backgroundColor:
                    railFill > 0 ? colors.primary : "transparent",
                },
              ]}
            />
          </View>

          {/* Content wrapper — milestones raised significantly */}
          <View
            style={
              isMilestone
                ? {
                    alignItems: "center",
                    transform: [{ translateY: -MILESTONE_RAISE }],
                  }
                : { alignItems: "center" }
            }
          >
            {/* Node circle */}
            <View
              style={[
                styles.tierNode,
                {
                  width: nodeSize,
                  height: nodeSize,
                  borderRadius: nodeSize / 2,
                  backgroundColor: nodeColor,
                  borderWidth: isCurrent ? 3 : isMilestone ? 2 : 0,
                  borderColor: nodeBorderColor,
                },
                isMilestone &&
                  state !== "locked" && {
                    shadowColor: "#FFD700",
                    shadowOpacity: 0.4,
                    shadowRadius: 6,
                    shadowOffset: { width: 0, height: 0 },
                    elevation: 4,
                  },
              ]}
            >
              {state === "claimed" ? (
                <MaterialCommunityIcons
                  name="check"
                  size={isMilestone ? 22 : 16}
                  color="#FFF"
                />
              ) : isMilestone ? (
                <MaterialCommunityIcons
                  name={
                    (def.icon as keyof typeof MaterialCommunityIcons.glyphMap) ??
                    "trophy-award"
                  }
                  size={20}
                  color={state === "locked" ? colors.textSecondary : "#FFF"}
                />
              ) : (
                <Text
                  style={[
                    styles.tierNodeText,
                    {
                      color: state === "locked" ? colors.textSecondary : "#FFF",
                      fontSize: 11,
                    },
                  ]}
                >
                  {def.level}
                </Text>
              )}
            </View>

            {/* Level label */}
            <Text
              style={[
                styles.tierLabel,
                {
                  color: isCurrent
                    ? "#FFD700"
                    : state === "locked"
                      ? colors.textSecondary
                      : colors.text,
                  fontWeight: isCurrent || isMilestone ? "800" : "600",
                  fontSize: isMilestone ? 12 : 10,
                },
              ]}
              numberOfLines={1}
            >
              {isMilestone ? `Lv ${def.level}` : `${def.level}`}
            </Text>

            {/* Reward indicator icons */}
            <View style={styles.tierIcons}>
              <MaterialCommunityIcons
                name="star-four-points"
                size={14}
                color={state === "locked" ? colors.textSecondary : "#FFD700"}
              />
              {isMilestone && (
                <MaterialCommunityIcons
                  name="image-area"
                  size={12}
                  color={state === "locked" ? colors.textSecondary : "#9B59B6"}
                />
              )}
            </View>

            {/* Unclaimed dot indicator */}
            {state === "unlocked" && <View style={styles.unclaimedDot} />}
          </View>
        </TouchableOpacity>
      );
    },
    [colors, currentLevel, xpProgress, handleTierPress],
  );

  const getItemLayout = useCallback((_data: unknown, index: number) => {
    return {
      length: TIER_CELL_WIDTH,
      offset: TIER_CELL_WIDTH * index,
      index,
    };
  }, []);

  const unclaimedCount = useMemo(
    () => tiers.filter((t) => t.state === "unlocked").length,
    [tiers],
  );

  return (
    <View style={styles.container}>
      {/* Track header */}
      <View style={styles.trackHeader}>
        <Text style={[styles.trackTitle, { color: colors.text }]}>
          Reward Track
        </Text>
        {unclaimedCount > 0 && (
          <View style={[styles.unclaimedBadge, { backgroundColor: "#007AFF" }]}>
            <Text style={styles.unclaimedBadgeText}>{unclaimedCount}</Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={[
            styles.jumpButton,
            { backgroundColor: colors.surfaceVariant },
          ]}
          onPress={handleJumpToCurrent}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="crosshairs-gps"
            size={14}
            color={colors.primary}
          />
          <Text style={[styles.jumpButtonText, { color: colors.primary }]}>
            Lv {currentLevel}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Horizontal tier track */}
      <FlatList
        ref={flatListRef}
        data={tiers}
        keyExtractor={(item) => String(item.def.level)}
        renderItem={renderTier}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.trackContent}
        getItemLayout={getItemLayout}
        onScrollToIndexFailed={(info) => {
          // Fallback scroll
          flatListRef.current?.scrollToOffset({
            offset: info.averageItemLength * info.index,
            animated: true,
          });
        }}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={7}
      />

      {/* Tier Details Bottom Sheet */}
      {selectedTier && (
        <TierDetailsSheet
          visible={sheetVisible}
          tier={selectedTier.def}
          state={selectedTier.state}
          doc={selectedTier.doc}
          isCurrent={selectedTier.isCurrent}
          claimingLevel={claimingLevel}
          onClaim={onClaim}
          onClose={handleCloseSheet}
        />
      )}
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  trackHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 6,
  },
  trackTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  unclaimedBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  unclaimedBadgeText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "800",
  },
  jumpButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  jumpButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },
  trackContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tierCell: {
    alignItems: "center",
    paddingTop: 18,
    paddingBottom: 4,
    position: "relative",
  },
  railSegment: {
    position: "absolute",
    left: 0,
    right: 0,
    height: RAIL_HEIGHT,
    borderRadius: RAIL_HEIGHT / 2,
    overflow: "hidden",
  },
  railFill: {
    height: "100%",
    borderRadius: RAIL_HEIGHT / 2,
  },
  tierNode: {
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
    marginBottom: 4,
  },
  tierNodeText: {
    fontWeight: "700",
  },
  tierLabel: {
    marginTop: 2,
  },
  tierIcons: {
    flexDirection: "row",
    gap: 2,
    marginTop: 2,
    height: 14,
    alignItems: "center",
  },
  unclaimedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF3B30",
    marginTop: 2,
  },
});

export const LevelRewardsTrack = memo(LevelRewardsTrackBase);
export default LevelRewardsTrack;
