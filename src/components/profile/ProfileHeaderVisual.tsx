/**
 * ProfileHeaderVisual Component
 *
 * Shared visual profile header that renders the profile picture (with
 * decoration), display name, username, and level progress bar in front
 * of an optional background image.
 *
 * The background is cropped to the header region: top of the PFP area
 * down to the bottom of the level progress bar. Everything below uses
 * the page's theme background color via `overflow: "hidden"`.
 *
 * Accepts optional `previewOverrides` so the Customization Hub can
 * render a local "try-on" without affecting the real profile data.
 *
 * @module components/profile/ProfileHeaderVisual
 */

import React, { memo, useMemo } from "react";
import { StyleSheet, TouchableOpacity, View, ViewStyle } from "react-native";
import { Text } from "react-native-paper";

import { CosmeticImage } from "@/components/CosmeticImage";
import { LevelProgress } from "@/components/profile/LevelProgress";
import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import { getCosmeticAsset } from "@/cosmetics/assetRegistry";
import type { CosmeticImageSource } from "@/cosmetics/types";
import { useColors } from "@/store/ThemeContext";
import type { LevelInfo } from "@/types/profile";

// =============================================================================
// Types
// =============================================================================

/** Fields that the Customization Hub can override for live preview. */
export interface HeaderPreviewOverrides {
  /** Override decoration ring. `null` = remove, `undefined` = keep current. */
  decorationId?: string | null;
  /** Override background image. `null` = remove, `undefined` = keep current. */
  backgroundId?: string | null;
  /** Override featured badges. `undefined` = keep current. */
  featuredBadgeIds?: string[];
}

export interface ProfileHeaderVisualProps {
  /** User's display name */
  displayName: string;
  /** Username (without @ prefix) */
  username: string;
  /** Profile picture URL (null for default) */
  pictureUrl: string | null;
  /** Currently equipped decoration ID (null if none) */
  decorationId: string | null;
  /** Currently equipped background ID (null if none) */
  backgroundId: string | null;
  /** Level information */
  level: LevelInfo;
  /** Live preview overrides (from Customization Hub "try-on" mode) */
  previewOverrides?: HeaderPreviewOverrides;
  /** Whether to show edit indicators on the PFP */
  showEditIndicator?: boolean;
  /** Handler for picture press */
  onPicturePress?: () => void;
  /** Handler for level bar press (navigates to level rewards) */
  onLevelPress?: () => void;
  /** Custom container style */
  style?: ViewStyle;
}

// =============================================================================
// Component
// =============================================================================

function ProfileHeaderVisualBase({
  displayName,
  username,
  pictureUrl,
  decorationId,
  backgroundId,
  level,
  previewOverrides,
  showEditIndicator = false,
  onPicturePress,
  onLevelPress,
  style,
}: ProfileHeaderVisualProps) {
  const colors = useColors();

  // Resolve effective values (preview overrides take precedence)
  const effectiveDecorationId =
    previewOverrides?.decorationId !== undefined
      ? previewOverrides.decorationId
      : decorationId;

  const effectiveBackgroundId =
    previewOverrides?.backgroundId !== undefined
      ? previewOverrides.backgroundId
      : backgroundId;

  // Resolve the background image source from the asset registry
  const backgroundSource: CosmeticImageSource | null = useMemo(() => {
    if (!effectiveBackgroundId) return null;
    return getCosmeticAsset("background", effectiveBackgroundId);
  }, [effectiveBackgroundId]);

  return (
    <View
      style={[
        styles.outerWrapper,
        { backgroundColor: colors.background },
        style,
      ]}
    >
      {/* Header region with overflow hidden for background crop */}
      <View style={styles.headerRegion}>
        {/* Background Image (fills entire header region) */}
        {backgroundSource && (
          <CosmeticImage
            source={backgroundSource}
            style={styles.backgroundImage}
            debugLabel="visual-bg"
            transition={0}
          />
        )}

        {/* Scrim overlay for text readability when background is present */}
        {backgroundSource && <View style={styles.backgroundScrim} />}

        {/* Foreground content */}
        <View style={styles.foregroundContent}>
          {/* Profile Picture with Decoration */}
          <View style={styles.pictureSection}>
            <ProfilePictureWithDecoration
              pictureUrl={pictureUrl}
              name={displayName}
              decorationId={effectiveDecorationId}
              size={100}
              onPress={onPicturePress}
              showEditIndicator={showEditIndicator}
            />
          </View>

          {/* Name and Username */}
          <View style={styles.nameSection}>
            <Text
              style={[
                styles.displayName,
                {
                  color: backgroundSource ? "#FFFFFF" : colors.text,
                  textShadowColor: backgroundSource
                    ? "rgba(0,0,0,0.6)"
                    : "transparent",
                  textShadowOffset: backgroundSource
                    ? { width: 0, height: 1 }
                    : { width: 0, height: 0 },
                  textShadowRadius: backgroundSource ? 3 : 0,
                },
              ]}
            >
              {displayName}
            </Text>
            <Text
              style={[
                styles.username,
                {
                  color: backgroundSource
                    ? "rgba(255,255,255,0.85)"
                    : colors.textSecondary,
                  textShadowColor: backgroundSource
                    ? "rgba(0,0,0,0.5)"
                    : "transparent",
                  textShadowOffset: backgroundSource
                    ? { width: 0, height: 1 }
                    : { width: 0, height: 0 },
                  textShadowRadius: backgroundSource ? 2 : 0,
                },
              ]}
            >
              @{username}
            </Text>
          </View>

          {/* Level Progress */}
          <TouchableOpacity
            style={styles.levelContainer}
            onPress={onLevelPress}
            activeOpacity={0.7}
            disabled={!onLevelPress}
            accessibilityLabel="View level rewards"
            accessibilityRole="button"
          >
            <LevelProgress level={level} compact={!!backgroundSource} />
          </TouchableOpacity>
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
  headerRegion: {
    overflow: "hidden",
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    minHeight: 220,
    justifyContent: "flex-end",
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  backgroundScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  foregroundContent: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
  },
  pictureSection: {
    marginBottom: 12,
  },
  nameSection: {
    alignItems: "center",
    marginBottom: 10,
  },
  displayName: {
    fontSize: 22,
    fontWeight: "700",
  },
  username: {
    fontSize: 14,
    marginTop: 2,
  },
  levelContainer: {
    width: "100%",
    paddingHorizontal: 16,
  },
});

// =============================================================================
// Export
// =============================================================================

export const ProfileHeaderVisual = memo(ProfileHeaderVisualBase);
export default ProfileHeaderVisual;
