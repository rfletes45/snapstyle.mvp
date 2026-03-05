/**
 * Games V4 — Tier Details Bottom Sheet
 *
 * Modal overlay showing reward details for a selected tier level.
 * Allows claiming unlocked rewards and provides equip shortcut for cosmetics.
 *
 * @module gamesV4/components/TierDetailsSheet
 */

import type { LevelReward } from "@/data/levelRewards";
import type { LevelRewardDocV4 } from "@/gamesV4/services/gameServiceV4";
import { useColors } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
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

  const statusLabel =
    state === "claimed"
      ? "Claimed"
      : state === "unlocked"
        ? "Ready to Claim"
        : "Locked";

  const statusColor =
    state === "claimed"
      ? "#34C759"
      : state === "unlocked"
        ? "#007AFF"
        : colors.textSecondary;

  const statusIcon: keyof typeof MaterialCommunityIcons.glyphMap =
    state === "claimed"
      ? "check-circle"
      : state === "unlocked"
        ? "gift-open"
        : "lock";

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

          {/* Header */}
          <View style={styles.sheetHeader}>
            <View
              style={[
                styles.tierBadge,
                {
                  backgroundColor: tier.isMilestone
                    ? "#FFD70020"
                    : colors.surfaceVariant,
                  borderColor: tier.isMilestone ? "#FFD700" : "transparent",
                  borderWidth: tier.isMilestone ? 2 : 0,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={
                  (tier.icon as keyof typeof MaterialCommunityIcons.glyphMap) ??
                  "star-four-points"
                }
                size={tier.isMilestone ? 32 : 24}
                color={tier.isMilestone ? "#FFD700" : colors.primary}
              />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.tierTitle, { color: colors.text }]}>
                Level {tier.level}
                {tier.isMilestone ? " ★" : ""}
                {isCurrent ? " (Current)" : ""}
              </Text>
              <View style={styles.statusRow}>
                <MaterialCommunityIcons
                  name={statusIcon}
                  size={14}
                  color={statusColor}
                />
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {statusLabel}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons
                name="close"
                size={22}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Rewards breakdown */}
          <View
            style={[
              styles.rewardsSection,
              { backgroundColor: colors.surfaceVariant + "80" },
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

            {/* Token reward (always present) */}
            <View style={styles.rewardLine}>
              <View
                style={[styles.rewardIcon, { backgroundColor: "#F5A62320" }]}
              >
                <MaterialCommunityIcons
                  name="star-four-points"
                  size={18}
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
            </View>

            {/* Cosmetic reward (milestone only) */}
            {tier.isMilestone && tier.cosmeticId && (
              <View style={styles.rewardLine}>
                <View
                  style={[styles.rewardIcon, { backgroundColor: "#9B59B620" }]}
                >
                  <MaterialCommunityIcons
                    name="image-area"
                    size={18}
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
              </View>
            )}
          </View>

          {/* Description */}
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {tier.description}
          </Text>

          {/* Action buttons */}
          <View style={styles.actions}>
            {state === "unlocked" && (
              <TouchableOpacity
                style={[
                  styles.claimButton,
                  isClaiming && styles.claimButtonDisabled,
                ]}
                onPress={handleClaim}
                disabled={isClaiming}
                activeOpacity={0.7}
              >
                {isClaiming ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name="gift"
                      size={18}
                      color="#FFF"
                    />
                    <Text style={styles.claimButtonText}>Claim Reward</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {state === "claimed" && (
              <View style={styles.claimedRow}>
                <MaterialCommunityIcons
                  name="check-circle"
                  size={20}
                  color="#34C759"
                />
                <Text style={[styles.claimedText, { color: "#34C759" }]}>
                  Reward Claimed!
                </Text>
              </View>
            )}

            {state === "locked" && (
              <View style={styles.lockedRow}>
                <MaterialCommunityIcons
                  name="lock"
                  size={20}
                  color={colors.textSecondary}
                />
                <Text
                  style={[styles.lockedText, { color: colors.textSecondary }]}
                >
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
    maxHeight: SCREEN_HEIGHT * 0.55,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 36,
  },
  dragHandle: {
    alignItems: "center",
    paddingVertical: 10,
  },
  dragBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  tierBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  headerText: {
    flex: 1,
  },
  tierTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
  },
  closeButton: {
    padding: 8,
  },
  rewardsSection: {
    marginHorizontal: 20,
    padding: 14,
    borderRadius: 12,
    gap: 10,
  },
  rewardsSectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  rewardLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rewardIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  rewardDetails: {
    flex: 1,
  },
  rewardName: {
    fontSize: 15,
    fontWeight: "600",
  },
  rewardAmount: {
    fontSize: 13,
  },
  cosmeticTag: {
    fontSize: 12,
    fontWeight: "600",
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  actions: {
    paddingHorizontal: 20,
  },
  claimButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#007AFF",
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  claimButtonDisabled: {
    opacity: 0.6,
  },
  claimButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  claimedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  claimedText: {
    fontSize: 15,
    fontWeight: "700",
  },
  lockedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  lockedText: {
    fontSize: 14,
    fontWeight: "600",
  },
});

export const TierDetailsSheet = memo(TierDetailsSheetBase);
export default TierDetailsSheet;
