/**
 * BadgeCard Component
 *
 * Displays a single badge with tier-based styling.
 * Used in badge grids, showcases, and detail views.
 */

import { getBadgeById } from "@/data/badges";
import { TIER_COLORS } from "@/types/achievements";
import type { Badge, BadgeDisplayMode, UserBadge } from "@/types/profile";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

export interface BadgeCardProps {
  /** Badge ID or full badge object */
  badge: string | Badge;
  /** User's badge data (if earned) */
  userBadge?: UserBadge;
  /** Display mode */
  mode?: BadgeDisplayMode;
  /** Size multiplier (default 1) */
  size?: number;
  /** Whether badge is locked/unearned */
  locked?: boolean;
  /** Show featured star */
  showFeatured?: boolean;
  /** Press handler */
  onPress?: () => void;
  /** Long press handler */
  onLongPress?: () => void;
}

function BadgeCardBase({
  badge,
  userBadge,
  mode = "standard",
  size = 1,
  locked = false,
  showFeatured = true,
  onPress,
  onLongPress,
}: BadgeCardProps) {
  const theme = useTheme();

  // Resolve badge definition
  const badgeData: Badge | undefined =
    typeof badge === "string" ? getBadgeById(badge) : badge;

  if (!badgeData) {
    return null;
  }

  const tierColor = TIER_COLORS[badgeData.tier];
  const isEarned = !!userBadge || !locked;
  const isFeatured = userBadge?.featured;

  // Size calculations
  const baseSize = 64 * size;
  const iconSize = 32 * size;
  const fontSize = 12 * size;

  const renderCompact = () => (
    <View
      style={[
        styles.compactContainer,
        {
          width: baseSize,
          height: baseSize,
          backgroundColor: isEarned
            ? tierColor + "20"
            : theme.colors.surfaceVariant,
          borderColor: isEarned ? tierColor : "transparent",
          opacity: isEarned ? 1 : 0.5,
        },
      ]}
    >
      <Text style={{ fontSize: iconSize * 0.8 }}>
        {isEarned ? badgeData.icon : "🔒"}
      </Text>
      {showFeatured && isFeatured && (
        <View
          style={[
            styles.featuredDot,
            { backgroundColor: theme.colors.primary },
          ]}
        />
      )}
    </View>
  );

  const renderStandard = () => (
    <View
      style={[
        styles.standardContainer,
        {
          backgroundColor: isEarned
            ? tierColor + "15"
            : theme.colors.surfaceVariant,
          borderColor: isEarned ? tierColor : "transparent",
          opacity: isEarned ? 1 : 0.6,
        },
      ]}
    >
      <View
        style={[
          styles.iconCircle,
          {
            backgroundColor: isEarned ? tierColor + "30" : "#00000010",
            width: baseSize * 0.7,
            height: baseSize * 0.7,
          },
        ]}
      >
        <Text style={{ fontSize: iconSize }}>
          {isEarned ? badgeData.icon : "🔒"}
        </Text>
      </View>
      <Text
        style={[styles.badgeName, { color: theme.colors.onSurface, fontSize }]}
        numberOfLines={1}
      >
        {isEarned ? badgeData.name : "???"}
      </Text>
      {showFeatured && isFeatured && (
        <MaterialCommunityIcons
          name="star"
          size={14 * size}
          color={theme.colors.primary}
          style={styles.featuredStar}
        />
      )}
    </View>
  );

  const renderDetailed = () => (
    <View
      style={[
        styles.detailedContainer,
        {
          backgroundColor: theme.colors.surface,
          borderColor: isEarned ? tierColor : theme.colors.outline,
        },
      ]}
    >
      <View
        style={[styles.detailedHeader, { backgroundColor: tierColor + "20" }]}
      >
        <Text style={{ fontSize: iconSize * 1.2 }}>
          {isEarned ? badgeData.icon : "🔒"}
        </Text>
        <View style={[styles.tierBadge, { backgroundColor: tierColor }]}>
          <Text style={styles.tierText}>
            {badgeData.tier.charAt(0).toUpperCase() + badgeData.tier.slice(1)}
          </Text>
        </View>
      </View>
      <View style={styles.detailedContent}>
        <Text
          style={[styles.detailedName, { color: theme.colors.onSurface }]}
          numberOfLines={1}
        >
          {isEarned ? badgeData.name : "???"}
        </Text>
        <Text
          style={[
            styles.detailedDesc,
            { color: theme.colors.onSurfaceVariant },
          ]}
          numberOfLines={2}
        >
          {isEarned ? badgeData.description : "Earn this badge to reveal"}
        </Text>
      </View>
      {showFeatured && isFeatured && (
        <View
          style={[
            styles.featuredBanner,
            { backgroundColor: theme.colors.primary },
          ]}
        >
          <Text style={styles.featuredText}>Featured</Text>
        </View>
      )}
    </View>
  );

  const renderShowcase = () => (
    <View
      style={[
        styles.showcaseContainer,
        {
          backgroundColor: tierColor + "20",
          borderColor: tierColor,
          shadowColor: tierColor,
        },
      ]}
    >
      <View style={styles.showcaseGlow}>
        <Text style={{ fontSize: iconSize * 1.5 }}>{badgeData.icon}</Text>
      </View>
      <Text
        style={[styles.showcaseName, { color: theme.colors.onSurface }]}
        numberOfLines={1}
      >
        {badgeData.name}
      </Text>
    </View>
  );

  const content = () => {
    switch (mode) {
      case "compact":
        return renderCompact();
      case "detailed":
        return renderDetailed();
      case "showcase":
        return renderShowcase();
      default:
        return renderStandard();
    }
  };

  if (onPress || onLongPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        onLongPress={onLongPress}
        activeOpacity={0.7}
      >
        {content()}
      </TouchableOpacity>
    );
  }

  return content();
}

const styles = StyleSheet.create({
  // Compact mode
  compactContainer: {
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  featuredDot: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Standard mode
  standardContainer: {
    width: 80,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
  },
  iconCircle: {
    borderRadius: 100,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  badgeName: {
    fontWeight: "600",
    textAlign: "center",
  },
  featuredStar: {
    position: "absolute",
    top: 4,
    right: 4,
  },

  // Detailed mode
  detailedContainer: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 2,
    overflow: "hidden",
  },
  detailedHeader: {
    paddingVertical: 16,
    alignItems: "center",
    position: "relative",
  },
  tierBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tierText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  detailedContent: {
    padding: 16,
  },
  detailedName: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  detailedDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  featuredBanner: {
    paddingVertical: 4,
    alignItems: "center",
  },
  featuredText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },

  // Showcase mode
  showcaseContainer: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  showcaseGlow: {
    marginBottom: 8,
  },
  showcaseName: {
    fontSize: 14,
    fontWeight: "700",
  },
});

export const BadgeCard = memo(BadgeCardBase);
export default BadgeCard;
