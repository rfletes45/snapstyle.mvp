/**
 * OwnProfileHeader Component
 *
 * Editable profile header for the current user's profile.
 * Displays profile picture with decoration, name, username, bio, and status.
 * Allows editing of picture, decoration, and bio.
 *
 * @module components/profile/ProfileHeader/OwnProfileHeader
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { memo, useMemo } from "react";
import { StyleSheet, TouchableOpacity, View, ViewStyle } from "react-native";
import { Text } from "react-native-paper";

import { BorderRadius, FontSizes, Spacing } from "@/constants/theme";

import { CosmeticImage } from "@/components/CosmeticImage";
import { LevelProgress } from "@/components/profile/LevelProgress";
import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import { getCosmeticAsset } from "@/cosmetics/assetRegistry";
import type { CosmeticImageSource } from "@/cosmetics/types";
import { useColors } from "@/store/ThemeContext";
import type { LevelInfo } from "@/types/profile";
import type { ProfileBio, ProfileStatus } from "@/types/userProfile";
import { MOOD_CONFIG } from "@/types/userProfile";

// =============================================================================
// Types
// =============================================================================

export interface OwnProfileHeaderProps {
  /** User's display name */
  displayName: string;
  /** Username (without @ prefix) */
  username: string;
  /** Profile picture URL (null for default) */
  pictureUrl: string | null;
  /** Equipped decoration ID (null if none) */
  decorationId: string | null;
  /** Equipped background ID (null if none) */
  backgroundId?: string | null;
  /** User's bio */
  bio?: ProfileBio | null;
  /** User's current status */
  status?: ProfileStatus | null;
  /** Level information */
  level: LevelInfo;
  /** Top safe-area inset so the background image extends behind the status bar / dynamic island */
  topInset?: number;
  /** When true, strips own border/margin/radius so the parent card shell provides them. */
  embedded?: boolean;
  /** Handler for picture/decoration edit */
  onEditPicturePress: () => void;
  /** Handler for bio edit */
  onEditBioPress?: () => void;
  /** Handler for status edit */
  onEditStatusPress?: () => void;
  /** Handler for name edit (navigates to settings) */
  onEditNamePress?: () => void;
  /** Handler for level bar press (navigates to level rewards) */
  onLevelPress?: () => void;
  /** Handler for Customize button press */
  onCustomizePress?: () => void;
  /** Handler for Shop button press */
  onShopPress?: () => void;
  /** Custom container style */
  style?: ViewStyle;
}

// =============================================================================
// Component
// =============================================================================

function OwnProfileHeaderBase({
  displayName,
  username,
  pictureUrl,
  decorationId,
  backgroundId,
  bio,
  status,
  level,
  topInset = 0,
  onEditPicturePress,
  onEditBioPress,
  onEditStatusPress,
  onEditNamePress,
  onLevelPress,
  onCustomizePress,
  onShopPress,
  style,
  embedded = false,
}: OwnProfileHeaderProps) {
  const colors = useColors();

  // When embedded inside a widget card, use a smaller avatar and tighter spacing
  const avatarSize = embedded ? 80 : 120;

  // Resolve the background image source from the asset registry
  const backgroundSource: CosmeticImageSource | null = useMemo(() => {
    if (!backgroundId) return null;
    return getCosmeticAsset("background", backgroundId);
  }, [backgroundId]);

  // Check if status is expired
  const isStatusActive =
    status && (!status.expiresAt || status.expiresAt > Date.now());
  const moodConfig = status?.mood ? MOOD_CONFIG[status.mood] : null;

  // Text colors adapt when background is present
  const primaryTextColor = backgroundSource ? "#FFFFFF" : colors.text;
  const secondaryTextColor = backgroundSource
    ? "rgba(255,255,255,0.85)"
    : colors.textSecondary;
  const textShadow = backgroundSource
    ? {
        textShadowColor: "rgba(0,0,0,0.6)",
        textShadowOffset: { width: 0, height: 1 } as const,
        textShadowRadius: 3,
      }
    : {};

  return (
    <View
      style={[
        embedded ? styles.outerWrapperEmbedded : styles.outerWrapper,
        style,
      ]}
    >
      {" "}
      {/* Header region with overflow hidden for background crop.
       * Negative top margin + extra padding pull the bg behind the status bar
       * while keeping foreground content below the safe area. */}
      <View
        style={[
          embedded ? styles.headerRegionEmbedded : styles.headerRegion,
          {
            backgroundColor: colors.surface,
            borderColor: embedded ? "transparent" : colors.outline,
          },
        ]}
      >
        {/* Background Image (fills entire header region, cropped at level bar) */}
        {backgroundSource && (
          <CosmeticImage
            source={backgroundSource}
            style={styles.backgroundImage}
            debugLabel="profile-bg"
            transition={0}
          />
        )}

        {/* Gradient scrim — fades to dark only at the bottom portion */}
        {backgroundSource && (
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.55)"]}
            locations={[0, 1]}
            style={styles.bottomGradient}
          />
        )}

        {/* Foreground content — padded down by the safe-area inset */}
        <View
          style={[
            embedded
              ? styles.foregroundContentEmbedded
              : styles.foregroundContent,
          ]}
        >
          {/* Profile Picture with Decoration */}
          <View
            style={
              embedded ? styles.pictureSectionEmbedded : styles.pictureSection
            }
          >
            <ProfilePictureWithDecoration
              pictureUrl={pictureUrl}
              name={displayName}
              decorationId={decorationId}
              size={avatarSize}
              onPress={onEditPicturePress}
              showEditIndicator={!embedded}
            />
          </View>

          {/* Name and Username */}
          <View style={styles.nameSection}>
            <TouchableOpacity
              onPress={onEditNamePress}
              activeOpacity={0.7}
              style={styles.nameRow}
            >
              <Text
                style={[
                  styles.displayName,
                  { color: primaryTextColor },
                  textShadow,
                ]}
              >
                {displayName}
              </Text>
              {onEditNamePress && (
                <MaterialCommunityIcons
                  name="pencil-outline"
                  size={16}
                  color={secondaryTextColor}
                  style={styles.editIcon}
                />
              )}
            </TouchableOpacity>
            <Text
              style={[
                styles.username,
                { color: secondaryTextColor },
                textShadow,
              ]}
            >
              @{username}
            </Text>
          </View>

          {/* Status Indicator */}
          {isStatusActive && moodConfig && (
            <TouchableOpacity
              onPress={onEditStatusPress}
              activeOpacity={0.7}
              style={[
                styles.statusContainer,
                { backgroundColor: colors.surfaceVariant },
              ]}
            >
              <Text style={styles.statusEmoji}>{moodConfig.emoji}</Text>
              <Text style={[styles.statusText, { color: colors.text }]}>
                {status.text || moodConfig.label}
              </Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={16}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          )}

          {/* Add Status Button (if no active status) */}
          {!isStatusActive && onEditStatusPress && (
            <TouchableOpacity
              onPress={onEditStatusPress}
              activeOpacity={0.7}
              style={[styles.addStatusButton, { borderColor: colors.outline }]}
            >
              <MaterialCommunityIcons
                name="emoticon-outline"
                size={18}
                color={colors.primary}
              />
              <Text style={[styles.addStatusText, { color: colors.primary }]}>
                Set status
              </Text>
            </TouchableOpacity>
          )}

          {/* Bio Section */}
          <TouchableOpacity
            onPress={onEditBioPress}
            activeOpacity={0.7}
            style={[
              styles.bioContainer,
              { backgroundColor: colors.surfaceVariant },
            ]}
          >
            {bio?.text ? (
              <Text
                style={[styles.bioText, { color: colors.text }]}
                numberOfLines={3}
              >
                {bio.text}
              </Text>
            ) : (
              <Text
                style={[styles.bioPlaceholder, { color: colors.textSecondary }]}
              >
                Add a bio to tell people about yourself...
              </Text>
            )}
            <MaterialCommunityIcons
              name="pencil-outline"
              size={14}
              color={colors.textSecondary}
              style={styles.bioEditIcon}
            />
          </TouchableOpacity>

          {/* Level Progress */}
          <TouchableOpacity
            style={[
              styles.levelContainer,
              {
                backgroundColor: backgroundSource
                  ? "rgba(0,0,0,0.55)"
                  : `${colors.surfaceVariant}D9`,
                borderRadius: BorderRadius.md,
                paddingHorizontal: 14,
                paddingVertical: 10,
              },
            ]}
            onPress={onLevelPress}
            activeOpacity={0.7}
            disabled={!onLevelPress}
            accessibilityLabel="View level rewards"
            accessibilityRole="button"
          >
            <LevelProgress level={level} compact={!!backgroundSource} />
          </TouchableOpacity>

          {/* Primary Actions (Customize / Shop) — hidden when embedded in widget card */}
          {!embedded && (
            <View style={styles.primaryActions}>
              {onCustomizePress && (
                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    { backgroundColor: colors.primary },
                  ]}
                  onPress={onCustomizePress}
                  accessibilityLabel="Customize profile"
                >
                  <MaterialCommunityIcons
                    name="palette"
                    size={18}
                    color="#fff"
                  />
                  <Text style={styles.primaryBtnText}>Customize</Text>
                </TouchableOpacity>
              )}
              {onShopPress && (
                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    {
                      backgroundColor: backgroundSource
                        ? "rgba(255,255,255,0.2)"
                        : colors.surfaceVariant + "90",
                    },
                  ]}
                  onPress={onShopPress}
                  accessibilityLabel="Open shop"
                >
                  <MaterialCommunityIcons
                    name="shopping-outline"
                    size={18}
                    color={backgroundSource ? "#fff" : colors.text}
                  />
                  <Text
                    style={[
                      styles.primaryBtnText,
                      { color: backgroundSource ? "#fff" : colors.text },
                    ]}
                  >
                    Shop
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  outerWrapper: {
    width: "100%",
  },
  outerWrapperEmbedded: {
    flex: 1,
  },
  headerRegion: {
    overflow: "hidden",
    minHeight: 220,
    justifyContent: "flex-end",
    borderRadius: BorderRadius.lg,
    marginHorizontal: Spacing.lg,
    borderWidth: 1.5,
  },
  headerRegionEmbedded: {
    overflow: "hidden",
    flex: 1,
    justifyContent: "flex-end",
    borderRadius: 0,
    marginHorizontal: 0,
    borderWidth: 0,
  },
  backgroundImage: {
    position: "absolute",
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
  },
  backgroundScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  bottomGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "40%",
  },
  foregroundContent: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 24,
  },
  foregroundContentEmbedded: {
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 14,
  },
  pictureSection: {
    marginBottom: 16,
  },
  pictureSectionEmbedded: {
    marginBottom: 10,
  },
  nameSection: {
    alignItems: "center",
    marginBottom: 12,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  displayName: {
    fontSize: 24,
    fontWeight: "700",
  },
  editIcon: {
    marginTop: 2,
  },
  username: {
    fontSize: 15,
    marginTop: 2,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 12,
    gap: 6,
  },
  statusEmoji: {
    fontSize: 16,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "500",
  },
  addStatusButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: "dashed",
    marginBottom: 12,
    gap: 6,
  },
  addStatusText: {
    fontSize: 14,
    fontWeight: "500",
  },
  bioContainer: {
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  bioText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  bioPlaceholder: {
    flex: 1,
    fontSize: 14,
    fontStyle: "italic",
  },
  bioEditIcon: {
    marginLeft: 8,
    marginTop: 2,
  },
  levelContainer: {
    width: "100%",
  },
  primaryActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.md,
    marginTop: Spacing.md,
    width: "100%",
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
  },
  primaryBtnText: {
    fontSize: FontSizes.md,
    fontWeight: "600",
    color: "#fff",
  },
});

// =============================================================================
// Export
// =============================================================================

export const OwnProfileHeader = memo(OwnProfileHeaderBase);
