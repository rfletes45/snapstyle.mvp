/**
 * Games V4 — Tier Details Bottom Sheet (Redesigned)
 *
 * Premium modal overlay for reward details with polished:
 * - Reward badge + level header
 * - Status indicator with color coding
 * - Reward breakdown (tokens + cosmetic)
 * - Claim CTA with gradient feel
 * - Locked / claimed completion states
 *
 * @module gamesV4/components/TierDetailsSheet
 */

import type { LevelReward } from "@/data/levelRewards";
import type { LevelRewardDocV4 } from "@/gamesV4/services/gameServiceV4";
import { useColors } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { memo, useCallback } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// =============================================================================
// Types
// =============================================================================

type TierState = "locked" | "unlocked" | "claimed";

export interface TierDetailsSheetProps {
  visible: boolean;
  tier: LevelReward;
  state: TierState;
  doc: LevelRewardDocV4 | null;
  isCurrent: boolean;
  claimingLevel: number | null;
  onClaim: (level: number) => Promise<void>;
  onClose: () => void;
}

// =============================================================================
// Component
// =============================================================================

function TierDetailsSheetBase({
  visible,
  tier,
  state,
  doc,
  isCurrent,
  claimingLevel,
  onClaim,
  onClose,
}: TierDetailsSheetProps) {
  const colors = useColors();
  const isClaiming = claimingLevel === tier.level;

  const handleClaim = useCallback(async () => {
    await onClaim(tier.level);
  }, [onClaim, tier.level]);

  // Status display config
  const statusConfig = {
    claimed: {
      label: "Claimed",
      color: "#34C759",
      icon: "check-circle" as const,
      bg: "#34C75912",
    },
    unlocked: {
      label: "Ready to Claim",
      color: "#007AFF",
      icon: "gift-open" as const,
      bg: "#007AFF12",
    },
    locked: {
      label: "Locked",
      color: colors.textMuted,
      icon: "lock" as const,
      bg: colors.surfaceVariant,
    },
  };
  const status = statusConfig[state];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.surface }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Drag handle */}
          <View style={styles.dragHandle}>
            <View
              style={[
                styles.dragBar,
                { backgroundColor: colors.surfaceVariant },
              ]}
            />
          </View>

          {/* ── Header: Badge + Level + Status ───────────────────────── */}
          <View style={styles.sheetHeader}>
            <View
              style={[
                styles.tierBadge,
                {
                  backgroundColor: tier.isMilestone
                    ? "#FFD70015"
                    : colors.surfaceVariant,
                  borderColor: tier.isMilestone ? "#FFD700" : "transparent",
                  borderWidth: tier.isMilestone ? 2.5 : 0,
                },
                tier.isMilestone &&
                  state !== "locked" && {
                    shadowColor: "#FFD700",
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 0 },
                    elevation: 4,
                  },
              ]}
            >
              <MaterialCommunityIcons
                name={
                  (tier.icon as keyof typeof MaterialCommunityIcons.glyphMap) ??
                  "star-four-points"
                }
                size={tier.isMilestone ? 32 : 26}
                color={
                  tier.isMilestone
                    ? "#FFD700"
                    : state === "locked"
                      ? colors.textMuted
                      : colors.primary
                }
              />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.tierTitle, { color: colors.text }]}>
                Level {tier.level}
                {tier.isMilestone ? " ★" : ""}
              </Text>
              {isCurrent && (
                <Text style={[styles.currentLabel, { color: colors.primary }]}>
                  Current Level
                </Text>
              )}
              {/* Status pill */}
              <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
                <MaterialCommunityIcons
                  name={status.icon}
                  size={13}
                  color={status.color}
                />
                <Text style={[styles.statusText, { color: status.color }]}>
                  {status.label}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <MaterialCommunityIcons
                name="close"
                size={22}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* ── Rewards Breakdown ─────────────────────────────────────── */}
          <View
            style={[
              styles.rewardsSection,
              { backgroundColor: colors.surfaceVariant + "60" },
            ]}
          >
            <Text
              style={[
                styles.rewardsSectionTitle,
                { color: colors.textSecondary },
              ]}
            >
              REWARDS
            </Text>

            {/* Token reward */}
            <View style={styles.rewardLine}>
              <View
                style={[styles.rewardIcon, { backgroundColor: "#F5A62318" }]}
              >
                <MaterialCommunityIcons
                  name="star-four-points"
                  size={20}
                  color="#F5A623"
                />
              </View>
              <View style={styles.rewardDetails}>
                <Text style={[styles.rewardName, { color: colors.text }]}>
                  Tokens
                </Text>
                <Text
                  style={[styles.rewardAmount, { color: colors.textSecondary }]}
                >
                  +{tier.amount}
                </Text>
              </View>
              {state === "claimed" && (
                <MaterialCommunityIcons
                  name="check-circle"
                  size={18}
                  color="#34C759"
                />
              )}
            </View>

            {/* Cosmetic reward (milestone only) */}
            {tier.isMilestone && tier.cosmeticId && (
              <View style={styles.rewardLine}>
                <View
                  style={[styles.rewardIcon, { backgroundColor: "#9B59B618" }]}
                >
                  <MaterialCommunityIcons
                    name="image-area"
                    size={20}
                    color="#9B59B6"
                  />
                </View>
                <View style={styles.rewardDetails}>
                  <Text style={[styles.rewardName, { color: colors.text }]}>
                    {tier.label}
                  </Text>
                  <Text style={[styles.cosmeticTag, { color: "#9B59B6" }]}>
                    Exclusive Cosmetic
                  </Text>
                </View>
                {state === "claimed" && (
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={18}
                    color="#34C759"
                  />
                )}
              </View>
            )}
          </View>

          {/* ── Description ──────────────────────────────────────────── */}
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {tier.description}
          </Text>

          {/* ── Action Area ──────────────────────────────────────────── */}
          <View style={styles.actions}>
            {state === "unlocked" && (
              <TouchableOpacity
                onPress={handleClaim}
                disabled={isClaiming}
                activeOpacity={0.8}
                style={[
                  styles.claimButtonOuter,
                  isClaiming && { opacity: 0.6 },
                ]}
              >
                <LinearGradient
                  colors={["#007AFF", "#0056D6"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.claimButton}
                >
                  {isClaiming ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <MaterialCommunityIcons
                        name="gift"
                        size={20}
                        color="#FFF"
                      />
                      <Text style={styles.claimButtonText}>Claim Reward</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}

            {state === "claimed" && (
              <View
                style={[styles.claimedBanner, { backgroundColor: "#34C75912" }]}
              >
                <MaterialCommunityIcons
                  name="check-circle"
                  size={22}
                  color="#34C759"
                />
                <Text style={styles.claimedText}>Reward Claimed!</Text>
              </View>
            )}

            {state === "locked" && (
              <View
                style={[
                  styles.lockedBanner,
                  { backgroundColor: colors.surfaceVariant },
                ]}
              >
                <MaterialCommunityIcons
                  name="lock"
                  size={20}
                  color={colors.textMuted}
                />
                <Text style={[styles.lockedText, { color: colors.textMuted }]}>
                  Reach Level {tier.level} to unlock
                </Text>
              </View>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// =============================================================================
// Styles
// =============================================================================

const SCREEN_HEIGHT = Dimensions.get("window").height;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: SCREEN_HEIGHT * 0.58,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  dragHandle: {
    alignItems: "center",
    paddingVertical: 12,
  },
  dragBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },

  // ── Header ─────────────────────────────────────────────────────────
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 18,
    gap: 14,
  },
  tierBadge: {
    width: 60,
    height: 60,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  headerText: {
    flex: 1,
  },
  tierTitle: {
    fontSize: 22,
    fontWeight: "800",
  },
  currentLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 1,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  closeButton: {
    padding: 8,
    alignSelf: "flex-start",
  },

  // ── Rewards Section ────────────────────────────────────────────────
  rewardsSection: {
    marginHorizontal: 24,
    padding: 16,
    borderRadius: 14,
    gap: 12,
  },
  rewardsSectionTitle: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 2,
  },
  rewardLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rewardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  rewardDetails: {
    flex: 1,
  },
  rewardName: {
    fontSize: 15,
    fontWeight: "700",
  },
  rewardAmount: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 1,
  },
  cosmeticTag: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 1,
  },

  // ── Description ────────────────────────────────────────────────────
  description: {
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },

  // ── Actions ────────────────────────────────────────────────────────
  actions: {
    paddingHorizontal: 24,
  },
  claimButtonOuter: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#007AFF",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  claimButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  claimButtonText: {
    color: "#FFF",
    fontSize: 17,
    fontWeight: "800",
  },
  claimedBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  claimedText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#34C759",
  },
  lockedBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  lockedText: {
    fontSize: 14,
    fontWeight: "600",
  },
});

export const TierDetailsSheet = memo(TierDetailsSheetBase);
export default TierDetailsSheet;
