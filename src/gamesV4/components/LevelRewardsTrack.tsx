/**
 * Games V4 — Vertical Level Rewards Journey
 *
 * Connected vertical timeline showing all 50 reward levels.
 * Replaces the old horizontal battlepass rail with a premium
 * roadmap-style vertical progression path.
 *
 * - Vertical connecting line fills to current progress
 * - Compact regular tier rows (~60px)
 * - Premium milestone tier cards (~96px) with gold accents
 * - Current level highlighted with glow
 * - Tappable items open TierDetailsSheet
 *
 * @module gamesV4/components/LevelRewardsTrack
 */

import type { LevelReward } from "@/data/levelRewards";
import { LEVEL_REWARDS, MAX_REWARD_LEVEL } from "@/data/levelRewards";
import type { LevelRewardDocV4 } from "@/gamesV4/services/gameServiceV4";
import { useColors } from "@/store/ThemeContext";
import type { LevelInfo } from "@/types/profile";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import TierDetailsSheet from "./TierDetailsSheet";

// =============================================================================
// Constants
// =============================================================================

/** Width of the vertical timeline line */
const LINE_WIDTH = 3;
/** Regular tier node diameter */
const NODE_SIZE = 34;
/** Milestone tier node diameter */
const MILESTONE_NODE_SIZE = 46;
/** Width of the timeline column */
const TIMELINE_COL_WIDTH = 56;

// =============================================================================
// Types
// =============================================================================

export interface LevelRewardsTrackProps {
  levelInfo: LevelInfo;
  rewardDocs: LevelRewardDocV4[];
  onClaim: (level: number) => Promise<void>;
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
// Tier Row Components
// =============================================================================

/** Regular (non-milestone) tier row */
const RegularTierRow = memo(function RegularTierRow({
  tier,
  lineTopColor,
  lineBottomColor,
  onPress,
}: {
  tier: TierData;
  lineTopColor: string;
  lineBottomColor: string;
  onPress: (t: TierData) => void;
}) {
  const colors = useColors();
  const { def, state, isCurrent } = tier;

  const nodeColor =
    state === "claimed"
      ? "#34C759"
      : state === "unlocked"
        ? colors.primary
        : colors.surfaceVariant;

  const nodeBorder = isCurrent
    ? { borderWidth: 2.5, borderColor: "#FFD700" }
    : {};

  return (
    <TouchableOpacity
      activeOpacity={0.65}
      onPress={() => onPress(tier)}
      style={styles.tierRow}
    >
      {/* Timeline column */}
      <View style={styles.timelineCol}>
        <View style={[styles.lineSegment, { backgroundColor: lineTopColor }]} />
        <View
          style={[
            styles.node,
            {
              width: NODE_SIZE,
              height: NODE_SIZE,
              borderRadius: NODE_SIZE / 2,
              backgroundColor: nodeColor,
            },
            nodeBorder,
            isCurrent && {
              shadowColor: "#FFD700",
              shadowOpacity: 0.5,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 0 },
              elevation: 4,
            },
          ]}
        >
          {state === "claimed" ? (
            <MaterialCommunityIcons name="check" size={16} color="#FFF" />
          ) : (
            <Text
              style={[
                styles.nodeText,
                {
                  color: state === "locked" ? colors.textSecondary : "#FFF",
                },
              ]}
            >
              {def.level}
            </Text>
          )}
        </View>
        <View
          style={[styles.lineSegment, { backgroundColor: lineBottomColor }]}
        />
      </View>

      {/* Content */}
      <View
        style={[
          styles.tierContent,
          isCurrent && {
            backgroundColor: colors.primary + "0D",
            borderColor: colors.primary + "30",
            borderWidth: 1,
          },
        ]}
      >
        <View style={styles.tierContentLeft}>
          <Text
            style={[
              styles.tierLevelText,
              {
                color: isCurrent
                  ? colors.primary
                  : state === "locked"
                    ? colors.textMuted
                    : colors.text,
              },
            ]}
          >
            Level {def.level}
            {isCurrent ? "  ← You" : ""}
          </Text>
          <View style={styles.rewardRow}>
            <MaterialCommunityIcons
              name="star-four-points"
              size={14}
              color={state === "locked" ? colors.textMuted : "#F5A623"}
            />
            <Text
              style={[
                styles.rewardText,
                {
                  color:
                    state === "locked"
                      ? colors.textMuted
                      : colors.textSecondary,
                },
              ]}
            >
              +{def.amount} Tokens
            </Text>
          </View>
        </View>

        {/* State badge */}
        {state === "claimed" && (
          <View style={styles.stateBadgeClaimed}>
            <MaterialCommunityIcons
              name="check-circle"
              size={16}
              color="#34C759"
            />
          </View>
        )}
        {state === "unlocked" && (
          <View
            style={[
              styles.stateBadgeClaim,
              { backgroundColor: colors.primary },
            ]}
          >
            <Text style={styles.stateBadgeClaimText}>Claim</Text>
          </View>
        )}
        {state === "locked" && (
          <MaterialCommunityIcons
            name="lock-outline"
            size={16}
            color={colors.textMuted}
          />
        )}
      </View>
    </TouchableOpacity>
  );
});

/** Milestone tier row — premium card treatment */
const MilestoneTierRow = memo(function MilestoneTierRow({
  tier,
  lineTopColor,
  lineBottomColor,
  onPress,
}: {
  tier: TierData;
  lineTopColor: string;
  lineBottomColor: string;
  onPress: (t: TierData) => void;
}) {
  const colors = useColors();
  const { def, state, isCurrent } = tier;

  const nodeColor =
    state === "claimed"
      ? "#34C759"
      : state === "unlocked"
        ? "#FFD700"
        : colors.surfaceVariant;

  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={() => onPress(tier)}
      style={styles.milestoneTierRow}
    >
      {/* Timeline column */}
      <View style={styles.timelineCol}>
        <View style={[styles.lineSegment, { backgroundColor: lineTopColor }]} />
        <View
          style={[
            styles.node,
            {
              width: MILESTONE_NODE_SIZE,
              height: MILESTONE_NODE_SIZE,
              borderRadius: MILESTONE_NODE_SIZE / 2,
              backgroundColor: nodeColor,
              borderWidth: 2.5,
              borderColor:
                state === "claimed"
                  ? "#34C759"
                  : isCurrent
                    ? "#FFD700"
                    : state === "unlocked"
                      ? "#FFD700"
                      : colors.surfaceVariant,
            },
            (state !== "locked" || isCurrent) && {
              shadowColor: "#FFD700",
              shadowOpacity: 0.45,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 0 },
              elevation: 5,
            },
          ]}
        >
          {state === "claimed" ? (
            <MaterialCommunityIcons name="check" size={22} color="#FFF" />
          ) : (
            <MaterialCommunityIcons
              name={
                (def.icon as keyof typeof MaterialCommunityIcons.glyphMap) ??
                "trophy-award"
              }
              size={22}
              color={state === "locked" ? colors.textSecondary : "#FFF"}
            />
          )}
        </View>
        <View
          style={[styles.lineSegment, { backgroundColor: lineBottomColor }]}
        />
      </View>

      {/* Milestone content card */}
      <View
        style={[
          styles.milestoneCard,
          {
            backgroundColor:
              state === "unlocked"
                ? "#FFD70010"
                : isCurrent
                  ? colors.primary + "0D"
                  : colors.surface,
            borderColor:
              state === "unlocked"
                ? "#FFD70040"
                : isCurrent
                  ? colors.primary + "30"
                  : colors.surfaceVariant,
          },
        ]}
      >
        {/* Milestone badge */}
        <View style={styles.milestoneTopRow}>
          <View style={styles.milestoneBadge}>
            <MaterialCommunityIcons name="star" size={12} color="#FFD700" />
            <Text style={styles.milestoneBadgeText}>MILESTONE</Text>
          </View>
          {isCurrent && (
            <Text style={[styles.currentTag, { color: colors.primary }]}>
              ← You
            </Text>
          )}
        </View>

        <Text
          style={[
            styles.milestoneLevelText,
            {
              color: state === "locked" ? colors.textMuted : colors.text,
            },
          ]}
        >
          Level {def.level}
        </Text>

        {/* Rewards breakdown */}
        <View style={styles.milestoneRewards}>
          <View style={styles.milestoneRewardItem}>
            <MaterialCommunityIcons
              name="star-four-points"
              size={14}
              color={state === "locked" ? colors.textMuted : "#F5A623"}
            />
            <Text
              style={[
                styles.milestoneRewardText,
                {
                  color:
                    state === "locked"
                      ? colors.textMuted
                      : colors.textSecondary,
                },
              ]}
            >
              +{def.amount} Tokens
            </Text>
          </View>
          {def.cosmeticId && (
            <View style={styles.milestoneRewardItem}>
              <MaterialCommunityIcons
                name="image-area"
                size={14}
                color={state === "locked" ? colors.textMuted : "#9B59B6"}
              />
              <Text
                style={[
                  styles.milestoneRewardText,
                  {
                    color:
                      state === "locked"
                        ? colors.textMuted
                        : colors.textSecondary,
                  },
                ]}
                numberOfLines={1}
              >
                {def.label}
              </Text>
            </View>
          )}
        </View>

        {/* State indicator */}
        <View style={styles.milestoneStateRow}>
          {state === "claimed" && (
            <View style={styles.milestoneClaimedBadge}>
              <MaterialCommunityIcons
                name="check-circle"
                size={14}
                color="#34C759"
              />
              <Text style={styles.milestoneClaimedText}>Claimed</Text>
            </View>
          )}
          {state === "unlocked" && (
            <View style={styles.milestoneClaimBtn}>
              <MaterialCommunityIcons name="gift-open" size={14} color="#FFF" />
              <Text style={styles.milestoneClaimBtnText}>Claim Reward</Text>
            </View>
          )}
          {state === "locked" && (
            <View style={styles.milestoneLockedBadge}>
              <MaterialCommunityIcons
                name="lock-outline"
                size={13}
                color={colors.textMuted}
              />
              <Text
                style={[
                  styles.milestoneLockedText,
                  { color: colors.textMuted },
                ]}
              >
                Reach Level {def.level}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

// =============================================================================
// Main Component
// =============================================================================

function LevelRewardsTrackBase({
  levelInfo,
  rewardDocs,
  onClaim,
  claimingLevel,
}: LevelRewardsTrackProps) {
  const colors = useColors();
  const [selectedTier, setSelectedTier] = useState<TierData | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  const currentLevel = levelInfo.current;

  // Build reward doc lookup
  const docMap = useMemo(() => {
    const map = new Map<number, LevelRewardDocV4>();
    for (const d of rewardDocs) map.set(d.level, d);
    return map;
  }, [rewardDocs]);

  // Build tier data for all 50 levels
  const tiers: TierData[] = useMemo(() => {
    return LEVEL_REWARDS.map((def) => {
      const doc = docMap.get(def.level) ?? null;
      const isClaimed =
        doc !== null && doc.claimedAt !== null && doc.claimedAt !== undefined;
      const isUnlocked = doc !== null;
      const reachedButNoDoc = doc === null && currentLevel >= def.level;
      const state: TierState = isClaimed
        ? "claimed"
        : isUnlocked || reachedButNoDoc
          ? "unlocked"
          : "locked";
      return { def, state, doc, isCurrent: def.level === currentLevel };
    });
  }, [docMap, currentLevel]);

  // Line color helpers
  const filledColor = colors.primary;
  const emptyColor = colors.surfaceVariant;

  const getLineTopColor = useCallback(
    (level: number) => {
      if (level === 1) return "transparent"; // first item, no line above
      return level <= currentLevel ? filledColor : emptyColor;
    },
    [currentLevel, filledColor, emptyColor],
  );

  const getLineBottomColor = useCallback(
    (level: number) => {
      if (level >= MAX_REWARD_LEVEL) return "transparent"; // last item
      return level < currentLevel ? filledColor : emptyColor;
    },
    [currentLevel, filledColor, emptyColor],
  );

  // Handle tier tap
  const handleTierPress = useCallback((tier: TierData) => {
    setSelectedTier(tier);
    setSheetVisible(true);
  }, []);

  const handleCloseSheet = useCallback(() => {
    setSheetVisible(false);
    setSelectedTier(null);
  }, []);

  return (
    <View style={styles.container}>
      {tiers.map((tier) => {
        const lineTopColor = getLineTopColor(tier.def.level);
        const lineBottomColor = getLineBottomColor(tier.def.level);

        if (tier.def.isMilestone) {
          return (
            <MilestoneTierRow
              key={tier.def.level}
              tier={tier}
              lineTopColor={lineTopColor}
              lineBottomColor={lineBottomColor}
              onPress={handleTierPress}
            />
          );
        }

        return (
          <RegularTierRow
            key={tier.def.level}
            tier={tier}
            lineTopColor={lineTopColor}
            lineBottomColor={lineBottomColor}
            onPress={handleTierPress}
          />
        );
      })}

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
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  // ── Timeline column ───────────────────────────────────────────────
  timelineCol: {
    width: TIMELINE_COL_WIDTH,
    alignItems: "center",
  },
  lineSegment: {
    width: LINE_WIDTH,
    flex: 1,
    borderRadius: LINE_WIDTH / 2,
  },
  node: {
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  nodeText: {
    fontSize: 12,
    fontWeight: "800",
  },

  // ── Regular tier row ──────────────────────────────────────────────
  tierRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 58,
  },
  tierContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginRight: 4,
  },
  tierContentLeft: {
    flex: 1,
  },
  tierLevelText: {
    fontSize: 14,
    fontWeight: "700",
  },
  rewardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  rewardText: {
    fontSize: 12,
    fontWeight: "600",
  },
  stateBadgeClaimed: {
    padding: 4,
  },
  stateBadgeClaim: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  stateBadgeClaimText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
  },

  // ── Milestone tier row ────────────────────────────────────────────
  milestoneTierRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 96,
    marginVertical: 4,
  },
  milestoneCard: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginRight: 4,
  },
  milestoneTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  milestoneBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFD70015",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  milestoneBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#FFD700",
    letterSpacing: 0.8,
  },
  currentTag: {
    fontSize: 12,
    fontWeight: "800",
  },
  milestoneLevelText: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
  },
  milestoneRewards: {
    gap: 4,
    marginBottom: 8,
  },
  milestoneRewardItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  milestoneRewardText: {
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
  milestoneStateRow: {
    alignItems: "flex-start",
  },
  milestoneClaimedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  milestoneClaimedText: {
    color: "#34C759",
    fontSize: 12,
    fontWeight: "700",
  },
  milestoneClaimBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#007AFF",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  milestoneClaimBtnText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
  },
  milestoneLockedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  milestoneLockedText: {
    fontSize: 12,
    fontWeight: "600",
  },
});

export const LevelRewardsTrack = memo(LevelRewardsTrackBase);
export default LevelRewardsTrack;
