/**
 * Widget Content Adapters
 *
 * Each adapter wraps an existing profile component to render inside
 * a WidgetWrapper. Adapters receive the common WidgetAdapterProps
 * plus any widget-specific data from the profile screen.
 *
 * The profile-header adapter uses a size-variant system:
 * different widget sizes render progressively richer profile content.
 *
 * @module components/profile/WidgetBoard/adapters
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { memo, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { ProgressBar, Text } from "react-native-paper";

import { CosmeticImage } from "@/components/CosmeticImage";
import {
  AchievementsTrophyCaseCard,
  BadgesCard,
  FriendsCard,
} from "@/components/profile/OverviewCards";
import { ProfileActionsBar } from "@/components/profile/ProfileActions/index";
import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import { BorderRadius, Spacing } from "@/constants/theme";

import { getCosmeticAsset } from "@/cosmetics/assetRegistry";
import { MAX_REWARD_LEVEL } from "@/data/levelRewards";
import type { StreakSummary } from "@/hooks/useTopStreaks";
import { useColors } from "@/store/ThemeContext";
import { MOOD_CONFIG, type MoodType } from "@/types/userProfile";
import type { WidgetSizeKey } from "./types";

// =============================================================================
// Shared Types
// =============================================================================

/**
 * Common props injected into every adapter by WidgetBoardContainer.
 * Widget-specific props are passed in `data`.
 */
export interface WidgetAdapterProps {
  size: WidgetSizeKey;
  data: Record<string, any>;
}

// =============================================================================
// Profile Header Adapter — Size-Variant System
// =============================================================================

/**
 * wide (4×1): Compact bar — PFP, name, level indicator
 * large (4×2): Medium card — PFP, name, username, level, status
 * hero (4×4): Full rich header — PFP, name, bio, status, level, background
 */
const PROFILE_WIDGET_IMAGE_STATUS_SURFACE = "rgba(0,0,0,0.62)";
const PROFILE_WIDGET_IMAGE_CARD_SURFACE = "rgba(0,0,0,0.58)";
const PROFILE_WIDGET_IMAGE_LEVEL_SURFACE = "rgba(0,0,0,0.64)";

function getProfileWidgetStatusSurface(colors: any, hasBackground: boolean) {
  return hasBackground
    ? PROFILE_WIDGET_IMAGE_STATUS_SURFACE
    : colors.surfaceElevated;
}

function getProfileWidgetCardSurface(colors: any, hasBackground: boolean) {
  return hasBackground
    ? PROFILE_WIDGET_IMAGE_CARD_SURFACE
    : colors.surfaceElevated;
}

function getProfileWidgetLevelSurface(colors: any, hasBackground: boolean) {
  return hasBackground
    ? PROFILE_WIDGET_IMAGE_LEVEL_SURFACE
    : colors.surfaceElevated;
}

export const ProfileHeaderAdapter = memo(function ProfileHeaderAdapter({
  size,
  data,
}: WidgetAdapterProps) {
  if (size === "wide") return <ProfileHeaderWide data={data} />;
  if (size === "large") return <ProfileHeaderLarge data={data} />;
  if (size === "mega") return <ProfileHeaderMega data={data} />;
  return <ProfileHeaderHero data={data} />;
});

// ── wide (4×1) — Compact bar ────────────────────────────────────────────

const ProfileHeaderWide = memo(function ProfileHeaderWide({
  data,
}: {
  data: Record<string, any>;
}) {
  const colors = useColors();

  return (
    <View
      style={[headerStyles.wideRoot, { backgroundColor: colors.background }]}
    >
      <ProfilePictureWithDecoration
        pictureUrl={data.pictureUrl}
        name={data.displayName}
        decorationId={data.decorationId}
        size={56}
        onPress={data.onEditPicturePress}
      />
      <View style={headerStyles.wideInfo}>
        <Text
          style={[headerStyles.wideName, { color: colors.text }]}
          numberOfLines={1}
        >
          {data.displayName}
        </Text>
        <TouchableOpacity
          onPress={data.onLevelPress}
          activeOpacity={0.7}
          style={headerStyles.wideMetaRow}
          disabled={!data.onLevelPress}
        >
          <Text
            style={[headerStyles.wideLevel, { color: colors.textSecondary }]}
          >
            Lv. {data.level?.current ?? 1}
          </Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={14}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </View>
      <View style={headerStyles.wideActions}>
        {data.onShopPress && (
          <TouchableOpacity
            onPress={data.onShopPress}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons
              name="shopping-outline"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        )}
        {data.onCustomizePress && (
          <TouchableOpacity
            onPress={data.onCustomizePress}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons
              name="palette-outline"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        )}
        {data.onSettingsPress && (
          <TouchableOpacity
            onPress={data.onSettingsPress}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons
              name="cog-outline"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

// ── large (4×2) — Medium card ───────────────────────────────────────────

const ProfileHeaderLarge = memo(function ProfileHeaderLarge({
  data,
}: {
  data: Record<string, any>;
}) {
  const colors = useColors();
  const backgroundSource = useMemo(() => {
    if (!data.backgroundId) return null;
    return getCosmeticAsset("background", data.backgroundId);
  }, [data.backgroundId]);
  const status = data.status;
  const isStatusActive =
    status && (!status.expiresAt || status.expiresAt > Date.now());
  const moodConfig = status?.mood ? MOOD_CONFIG[status.mood as MoodType] : null;
  const textColor = backgroundSource ? "#FFFFFF" : colors.text;
  const subTextColor = backgroundSource
    ? "rgba(255,255,255,0.85)"
    : colors.textSecondary;
  const textShadow = backgroundSource
    ? {
        textShadowColor: "rgba(0,0,0,0.6)",
        textShadowOffset: { width: 0, height: 1 } as const,
        textShadowRadius: 3,
      }
    : {};
  const statusSurface = getProfileWidgetStatusSurface(
    colors,
    !!backgroundSource,
  );
  const levelSurface = getProfileWidgetLevelSurface(
    colors,
    !!backgroundSource,
  );

  return (
    <View
      style={[headerStyles.largeRoot, { backgroundColor: colors.background }]}
    >
      {backgroundSource && (
        <CosmeticImage
          source={backgroundSource}
          style={headerStyles.bgImage}
          debugLabel="profile-bg-large"
          transition={0}
        />
      )}
      {backgroundSource && (
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.55)"]}
          locations={[0.2, 1]}
          style={headerStyles.bgGradient}
        />
      )}
      <View style={headerStyles.largeForeground}>
        <ProfilePictureWithDecoration
          pictureUrl={data.pictureUrl}
          name={data.displayName}
          decorationId={data.decorationId}
          size={76}
          onPress={data.onEditPicturePress}
        />
        <View style={headerStyles.largeTextCol}>
          <View style={headerStyles.largeNameStatusRow}>
            <View style={headerStyles.largeNameBlock}>
              <Text
                style={[
                  headerStyles.largeName,
                  { color: textColor },
                  textShadow,
                ]}
                numberOfLines={1}
              >
                {data.displayName}
              </Text>
              <Text
                style={[
                  headerStyles.largeUsername,
                  { color: subTextColor },
                  textShadow,
                ]}
                numberOfLines={1}
              >
                @{data.username}
              </Text>
            </View>
            {/* Status chip — only show placeholder "Status" when owner can edit */}
            {(isStatusActive || data.onEditStatusPress) && (
              <TouchableOpacity
                onPress={data.onEditStatusPress}
                activeOpacity={data.onEditStatusPress ? 0.7 : 1}
                disabled={!data.onEditStatusPress}
                style={[
                  headerStyles.largeStatusChip,
                  {
                    backgroundColor: statusSurface,
                  },
                ]}
              >
                {isStatusActive && moodConfig ? (
                  <>
                    <Text style={headerStyles.largeStatusEmoji}>
                      {moodConfig.emoji}
                    </Text>
                    <Text
                      style={[
                        headerStyles.largeStatusText,
                        { color: subTextColor },
                        textShadow,
                      ]}
                      numberOfLines={1}
                    >
                      {status.text || moodConfig.label}
                    </Text>
                  </>
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name="emoticon-happy-outline"
                      size={13}
                      color={subTextColor}
                    />
                    <Text
                      style={[
                        headerStyles.largeStatusText,
                        { color: subTextColor, fontStyle: "italic" },
                        textShadow,
                      ]}
                      numberOfLines={1}
                    >
                      Status
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
        {data.onSettingsPress && (
          <TouchableOpacity
            onPress={data.onSettingsPress}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={headerStyles.largeSettingsBtn}
          >
            <MaterialCommunityIcons
              name="cog-outline"
              size={16}
              color={backgroundSource ? "#fff" : colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>
      {/* Bottom bar: Level + Action Buttons */}
      <View
        style={[
          headerStyles.largeBottomBar,
          {
            backgroundColor: levelSurface,
          },
        ]}
      >
        <TouchableOpacity
          style={headerStyles.largeBottomLevel}
          onPress={data.onLevelPress}
          activeOpacity={0.7}
          disabled={!data.onLevelPress}
        >
          <View style={headerStyles.largeLevelRow}>
            <View
              style={[
                headerStyles.largeLevelBadge,
                { backgroundColor: colors.primary },
              ]}
            >
              <Text style={headerStyles.largeLevelBadgeText}>
                {data.level?.current ?? 1}
              </Text>
            </View>
            <Text
              style={[
                headerStyles.largeLevelLabel,
                {
                  color: backgroundSource ? "#fff" : colors.text,
                  ...(backgroundSource
                    ? {
                        textShadowColor: "rgba(0,0,0,0.6)",
                        textShadowOffset: { width: 0, height: 1 },
                        textShadowRadius: 3,
                      }
                    : {}),
                },
              ]}
              numberOfLines={1}
            >
              Lv. {data.level?.current ?? 1}
            </Text>
            <View style={headerStyles.largeLevelProgressWrap}>
              <ProgressBar
                progress={
                  (data.level?.xpToNextLevel ?? 100) > 0
                    ? Math.min(
                        1,
                        (data.level?.xp ?? 0) /
                          (data.level?.xpToNextLevel ?? 100),
                      )
                    : 1
                }
                color={colors.primary}
                style={headerStyles.largeLevelProgress}
              />
            </View>
          </View>
        </TouchableOpacity>
        <View style={headerStyles.largeBottomActions}>
          {data.onShopPress && (
            <TouchableOpacity
              onPress={data.onShopPress}
              activeOpacity={0.7}
              style={[
                headerStyles.largeActionBtn,
                { backgroundColor: colors.primary },
              ]}
            >
              <MaterialCommunityIcons
                name="shopping-outline"
                size={14}
                color="#fff"
              />
              <Text style={headerStyles.largeActionBtnText}>Shop</Text>
            </TouchableOpacity>
          )}
          {data.onCustomizePress && (
            <TouchableOpacity
              onPress={data.onCustomizePress}
              activeOpacity={0.7}
              style={[
                headerStyles.largeActionBtn,
                { backgroundColor: colors.secondary ?? colors.primary + "CC" },
              ]}
            >
              <MaterialCommunityIcons
                name="palette-outline"
                size={14}
                color="#fff"
              />
              <Text style={headerStyles.largeActionBtnText}>Customize</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
});

// ── hero (4×4) — Full rich header ───────────────────────────────────────

const ProfileHeaderHero = memo(function ProfileHeaderHero({
  data,
}: {
  data: Record<string, any>;
}) {
  const colors = useColors();
  const backgroundSource = useMemo(() => {
    if (!data.backgroundId) return null;
    return getCosmeticAsset("background", data.backgroundId);
  }, [data.backgroundId]);
  const status = data.status;
  const isStatusActive =
    status && (!status.expiresAt || status.expiresAt > Date.now());
  const moodConfig = status?.mood ? MOOD_CONFIG[status.mood as MoodType] : null;
  const textColor = backgroundSource ? "#FFFFFF" : colors.text;
  const subTextColor = backgroundSource
    ? "rgba(255,255,255,0.85)"
    : colors.textSecondary;
  const textShadow = backgroundSource
    ? {
        textShadowColor: "rgba(0,0,0,0.6)",
        textShadowOffset: { width: 0, height: 1 } as const,
        textShadowRadius: 3,
      }
    : {};
  const statusSurface = getProfileWidgetStatusSurface(
    colors,
    !!backgroundSource,
  );
  const cardSurface = getProfileWidgetCardSurface(colors, !!backgroundSource);
  const levelSurface = getProfileWidgetLevelSurface(
    colors,
    !!backgroundSource,
  );

  return (
    <View
      style={[headerStyles.heroRoot, { backgroundColor: colors.background }]}
    >
      {backgroundSource && (
        <CosmeticImage
          source={backgroundSource}
          style={headerStyles.bgImage}
          debugLabel="profile-bg-hero"
          transition={0}
        />
      )}
      {backgroundSource && (
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.55)"]}
          locations={[0.3, 1]}
          style={headerStyles.bgGradient}
        />
      )}
      {/* Settings — top-right corner */}
      {data.onSettingsPress && (
        <TouchableOpacity
          onPress={data.onSettingsPress}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[
            headerStyles.heroSettingsBtn,
            {
              backgroundColor: backgroundSource
                ? "rgba(0,0,0,0.25)"
                : colors.surfaceVariant + "90",
            },
          ]}
        >
          <MaterialCommunityIcons
            name="cog-outline"
            size={18}
            color={backgroundSource ? "#fff" : colors.textSecondary}
          />
        </TouchableOpacity>
      )}
      <View style={headerStyles.heroForeground}>
        {/* Avatar */}
        <View style={headerStyles.heroPictureSection}>
          <ProfilePictureWithDecoration
            pictureUrl={data.pictureUrl}
            name={data.displayName}
            decorationId={data.decorationId}
            size={96}
            onPress={data.onEditPicturePress}
          />
        </View>

        {/* Name + Username */}
        <Text
          style={[headerStyles.heroName, { color: textColor }, textShadow]}
          numberOfLines={1}
        >
          {data.displayName}
        </Text>
        <Text
          style={[
            headerStyles.heroUsername,
            { color: subTextColor },
            textShadow,
          ]}
          numberOfLines={1}
        >
          @{data.username}
        </Text>

        {/* Status — show placeholder only when owner can edit; viewers only see an active status */}
        {(isStatusActive || data.onEditStatusPress) && (
          <TouchableOpacity
            onPress={data.onEditStatusPress}
            activeOpacity={data.onEditStatusPress ? 0.7 : 1}
            disabled={!data.onEditStatusPress}
            style={[
              headerStyles.heroStatusChip,
              {
                backgroundColor: statusSurface,
              },
            ]}
          >
            {isStatusActive && moodConfig ? (
              <>
                <Text style={{ fontSize: 14 }}>{moodConfig.emoji}</Text>
                <Text
                  style={[headerStyles.heroStatusText, { color: textColor }]}
                  numberOfLines={1}
                >
                  {status.text || moodConfig.label}
                </Text>
              </>
            ) : (
              <>
                <MaterialCommunityIcons
                  name="emoticon-happy-outline"
                  size={16}
                  color={subTextColor}
                />
                <Text
                  style={[
                    headerStyles.heroStatusText,
                    { color: subTextColor, fontStyle: "italic" },
                  ]}
                  numberOfLines={1}
                >
                  Set your status
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Bio */}
        {data.bio?.text ? (
          <TouchableOpacity
            onPress={data.onEditBioPress}
            activeOpacity={data.onEditBioPress ? 0.7 : 1}
            disabled={!data.onEditBioPress}
            style={[
              headerStyles.heroBio,
              {
                backgroundColor: cardSurface,
              },
            ]}
          >
            <Text
              style={[headerStyles.heroBioText, { color: textColor }]}
              numberOfLines={2}
            >
              {data.bio.text}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Action Row — Shop + Customize */}
        <View style={headerStyles.heroActionRow}>
          {data.onShopPress && (
            <TouchableOpacity
              onPress={data.onShopPress}
              activeOpacity={0.7}
              style={[
                headerStyles.heroActionButton,
                { backgroundColor: colors.primary },
              ]}
            >
              <MaterialCommunityIcons
                name="shopping-outline"
                size={16}
                color="#fff"
              />
              <Text style={[headerStyles.heroActionText, { color: "#fff" }]}>
                Shop
              </Text>
            </TouchableOpacity>
          )}
          {data.onCustomizePress && (
            <TouchableOpacity
              onPress={data.onCustomizePress}
              activeOpacity={0.7}
              style={[
                headerStyles.heroActionButton,
                { backgroundColor: colors.secondary ?? colors.primary + "CC" },
              ]}
            >
              <MaterialCommunityIcons
                name="palette-outline"
                size={16}
                color="#fff"
              />
              <Text style={[headerStyles.heroActionText, { color: "#fff" }]}>
                Customize
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Rich Level & Rewards Bar — matching Games hub design */}
      <TouchableOpacity
        onPress={data.onLevelPress}
        activeOpacity={0.7}
        disabled={!data.onLevelPress}
        style={[
          headerStyles.heroLevelBar,
          {
            backgroundColor: levelSurface,
          },
        ]}
      >
        {/* Top row: Level badge + XP info + unclaimed pill + chevron */}
        <View style={headerStyles.heroLevelTopRow}>
          <View
            style={[
              headerStyles.heroLevelBadge,
              { backgroundColor: colors.primary },
            ]}
          >
            <Text
              style={[
                headerStyles.heroLevelBadgeText,
                { color: colors.onPrimary },
              ]}
            >
              {data.level?.current ?? 1}
            </Text>
          </View>
          <View style={headerStyles.heroLevelXpInfo}>
            <Text
              style={[headerStyles.heroLevelLabel, { color: textColor }]}
              numberOfLines={1}
            >
              Level {data.level?.current ?? 1}
              {(data.level?.current ?? 1) >= MAX_REWARD_LEVEL ? " (MAX)" : ""}
            </Text>
            <Text
              style={[headerStyles.heroLevelXpText, { color: subTextColor }]}
            >
              {(data.level?.current ?? 1) >= MAX_REWARD_LEVEL
                ? "MAX LEVEL"
                : `${(data.level?.xp ?? 0).toLocaleString()}/${(data.level?.xpToNextLevel ?? 100).toLocaleString()} XP`}
            </Text>
          </View>
          {(data.unclaimedRewards ?? 0) > 0 && (
            <View style={headerStyles.heroUnclaimedPill}>
              <MaterialCommunityIcons name="gift" size={14} color="#FFF" />
              <Text style={headerStyles.heroUnclaimedText}>
                {data.unclaimedRewards}
              </Text>
            </View>
          )}
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color={subTextColor}
          />
        </View>
        {/* XP Progress bar */}
        <View style={headerStyles.heroLevelBarRow}>
          <ProgressBar
            progress={
              (data.level?.current ?? 1) >= MAX_REWARD_LEVEL
                ? 1
                : (data.level?.xpToNextLevel ?? 100) > 0
                  ? Math.min(
                      1,
                      (data.level?.xp ?? 0) /
                        (data.level?.xpToNextLevel ?? 100),
                    )
                  : 1
            }
            color={colors.primary}
            style={[
              headerStyles.heroProgressBar,
              {
                backgroundColor: backgroundSource
                  ? "rgba(255,255,255,0.15)"
                  : colors.surfaceVariant,
              },
            ]}
          />
        </View>
        {/* Bottom hint */}
        <Text
          style={[headerStyles.heroLevelHint, { color: subTextColor }]}
          numberOfLines={1}
        >
          {(data.unclaimedRewards ?? 0) > 0
            ? `${data.unclaimedRewards} reward${data.unclaimedRewards !== 1 ? "s" : ""} ready to claim!`
            : (data.level?.current ?? 1) >= MAX_REWARD_LEVEL
              ? "All tiers unlocked — claim your rewards!"
              : `${Math.max(0, (data.level?.xpToNextLevel ?? 100) - (data.level?.xp ?? 0)).toLocaleString()} XP to next level`}
        </Text>
      </TouchableOpacity>
    </View>
  );
});

// ── mega (4×6) — Expanded hero header ───────────────────────────────────

const ProfileHeaderMega = memo(function ProfileHeaderMega({
  data,
}: {
  data: Record<string, any>;
}) {
  const colors = useColors();
  const backgroundSource = useMemo(() => {
    if (!data.backgroundId) return null;
    return getCosmeticAsset("background", data.backgroundId);
  }, [data.backgroundId]);
  const status = data.status;
  const isStatusActive =
    status && (!status.expiresAt || status.expiresAt > Date.now());
  const moodConfig = status?.mood ? MOOD_CONFIG[status.mood as MoodType] : null;
  const textColor = backgroundSource ? "#FFFFFF" : colors.text;
  const subTextColor = backgroundSource
    ? "rgba(255,255,255,0.85)"
    : colors.textSecondary;
  const textShadow = backgroundSource
    ? {
        textShadowColor: "rgba(0,0,0,0.6)",
        textShadowOffset: { width: 0, height: 1 } as const,
        textShadowRadius: 3,
      }
    : {};
  const statusSurface = getProfileWidgetStatusSurface(
    colors,
    !!backgroundSource,
  );
  const cardSurface = getProfileWidgetCardSurface(colors, !!backgroundSource);
  const levelSurface = getProfileWidgetLevelSurface(
    colors,
    !!backgroundSource,
  );

  return (
    <View
      style={[headerStyles.megaRoot, { backgroundColor: colors.background }]}
    >
      {backgroundSource && (
        <CosmeticImage
          source={backgroundSource}
          style={headerStyles.bgImage}
          debugLabel="profile-bg-mega"
          transition={0}
        />
      )}
      {backgroundSource && (
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.6)"]}
          locations={[0.25, 1]}
          style={headerStyles.bgGradient}
        />
      )}
      {/* Settings — top-right corner */}
      {data.onSettingsPress && (
        <TouchableOpacity
          onPress={data.onSettingsPress}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[
            headerStyles.heroSettingsBtn,
            {
              backgroundColor: backgroundSource
                ? "rgba(0,0,0,0.25)"
                : colors.surfaceVariant + "90",
            },
          ]}
        >
          <MaterialCommunityIcons
            name="cog-outline"
            size={18}
            color={backgroundSource ? "#fff" : colors.textSecondary}
          />
        </TouchableOpacity>
      )}
      <View style={headerStyles.megaForeground}>
        {/* Avatar — extra large */}
        <View style={headerStyles.megaPictureSection}>
          <ProfilePictureWithDecoration
            pictureUrl={data.pictureUrl}
            name={data.displayName}
            decorationId={data.decorationId}
            size={128}
            onPress={data.onEditPicturePress}
          />
        </View>

        {/* Name + Username */}
        <Text
          style={[headerStyles.megaName, { color: textColor }, textShadow]}
          numberOfLines={1}
        >
          {data.displayName}
        </Text>
        <Text
          style={[
            headerStyles.megaUsername,
            { color: subTextColor },
            textShadow,
          ]}
          numberOfLines={1}
        >
          @{data.username}
        </Text>

        {/* Status */}
        {(isStatusActive || data.onEditStatusPress) && (
          <TouchableOpacity
            onPress={data.onEditStatusPress}
            activeOpacity={data.onEditStatusPress ? 0.7 : 1}
            disabled={!data.onEditStatusPress}
            style={[
              headerStyles.megaStatusChip,
              {
                backgroundColor: statusSurface,
              },
            ]}
          >
            {isStatusActive && moodConfig ? (
              <>
                <Text style={{ fontSize: 16 }}>{moodConfig.emoji}</Text>
                <Text
                  style={[headerStyles.megaStatusText, { color: textColor }]}
                  numberOfLines={1}
                >
                  {status.text || moodConfig.label}
                </Text>
              </>
            ) : (
              <>
                <MaterialCommunityIcons
                  name="emoticon-happy-outline"
                  size={18}
                  color={subTextColor}
                />
                <Text
                  style={[
                    headerStyles.megaStatusText,
                    { color: subTextColor, fontStyle: "italic" },
                  ]}
                  numberOfLines={1}
                >
                  Set your status
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Bio — larger region */}
        {data.bio?.text ? (
          <TouchableOpacity
            onPress={data.onEditBioPress}
            activeOpacity={data.onEditBioPress ? 0.7 : 1}
            disabled={!data.onEditBioPress}
            style={[
              headerStyles.megaBio,
              {
                backgroundColor: cardSurface,
              },
            ]}
          >
            <Text
              style={[headerStyles.megaBioText, { color: textColor }]}
              numberOfLines={5}
            >
              {data.bio.text}
            </Text>
          </TouchableOpacity>
        ) : data.onEditBioPress ? (
          <TouchableOpacity
            onPress={data.onEditBioPress}
            activeOpacity={0.7}
            style={[
              headerStyles.megaBio,
              {
                backgroundColor: cardSurface,
              },
            ]}
          >
            <Text
              style={[
                headerStyles.megaBioText,
                { color: subTextColor, fontStyle: "italic" },
              ]}
            >
              Tap to add a bio...
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Action Row — Shop + Customize */}
        <View style={headerStyles.megaActionRow}>
          {data.onShopPress && (
            <TouchableOpacity
              onPress={data.onShopPress}
              activeOpacity={0.7}
              style={[
                headerStyles.megaActionButton,
                { backgroundColor: colors.primary },
              ]}
            >
              <MaterialCommunityIcons
                name="shopping-outline"
                size={18}
                color="#fff"
              />
              <Text style={[headerStyles.megaActionText, { color: "#fff" }]}>
                Shop
              </Text>
            </TouchableOpacity>
          )}
          {data.onCustomizePress && (
            <TouchableOpacity
              onPress={data.onCustomizePress}
              activeOpacity={0.7}
              style={[
                headerStyles.megaActionButton,
                { backgroundColor: colors.secondary ?? colors.primary + "CC" },
              ]}
            >
              <MaterialCommunityIcons
                name="palette-outline"
                size={18}
                color="#fff"
              />
              <Text style={[headerStyles.megaActionText, { color: "#fff" }]}>
                Customize
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Rich Level & Rewards Bar — expanded */}
      <TouchableOpacity
        onPress={data.onLevelPress}
        activeOpacity={0.7}
        disabled={!data.onLevelPress}
        style={[
          headerStyles.megaLevelBar,
          {
            backgroundColor: levelSurface,
          },
        ]}
      >
        <View style={headerStyles.heroLevelTopRow}>
          <View
            style={[
              headerStyles.megaLevelBadge,
              { backgroundColor: colors.primary },
            ]}
          >
            <Text
              style={[
                headerStyles.megaLevelBadgeText,
                { color: colors.onPrimary },
              ]}
            >
              {data.level?.current ?? 1}
            </Text>
          </View>
          <View style={headerStyles.heroLevelXpInfo}>
            <Text
              style={[headerStyles.megaLevelLabel, { color: textColor }]}
              numberOfLines={1}
            >
              Level {data.level?.current ?? 1}
              {(data.level?.current ?? 1) >= MAX_REWARD_LEVEL ? " (MAX)" : ""}
            </Text>
            <Text
              style={[headerStyles.megaLevelXpText, { color: subTextColor }]}
            >
              {(data.level?.current ?? 1) >= MAX_REWARD_LEVEL
                ? "MAX LEVEL"
                : `${(data.level?.xp ?? 0).toLocaleString()}/${(data.level?.xpToNextLevel ?? 100).toLocaleString()} XP`}
            </Text>
          </View>
          {(data.unclaimedRewards ?? 0) > 0 && (
            <View style={headerStyles.heroUnclaimedPill}>
              <MaterialCommunityIcons name="gift" size={14} color="#FFF" />
              <Text style={headerStyles.heroUnclaimedText}>
                {data.unclaimedRewards}
              </Text>
            </View>
          )}
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color={subTextColor}
          />
        </View>
        <View style={headerStyles.megaLevelBarRow}>
          <ProgressBar
            progress={
              (data.level?.current ?? 1) >= MAX_REWARD_LEVEL
                ? 1
                : (data.level?.xpToNextLevel ?? 100) > 0
                  ? Math.min(
                      1,
                      (data.level?.xp ?? 0) /
                        (data.level?.xpToNextLevel ?? 100),
                    )
                  : 1
            }
            color={colors.primary}
            style={[
              headerStyles.megaProgressBar,
              {
                backgroundColor: backgroundSource
                  ? "rgba(255,255,255,0.15)"
                  : colors.surfaceVariant,
              },
            ]}
          />
        </View>
        <Text
          style={[headerStyles.megaLevelHint, { color: subTextColor }]}
          numberOfLines={1}
        >
          {(data.unclaimedRewards ?? 0) > 0
            ? `${data.unclaimedRewards} reward${data.unclaimedRewards !== 1 ? "s" : ""} ready to claim!`
            : (data.level?.current ?? 1) >= MAX_REWARD_LEVEL
              ? "All tiers unlocked — claim your rewards!"
              : `${Math.max(0, (data.level?.xpToNextLevel ?? 100) - (data.level?.xp ?? 0)).toLocaleString()} XP to next level`}
        </Text>
      </TouchableOpacity>
    </View>
  );
});

// =============================================================================
// Social Proof Adapter — Streak Widget (powered by canonical streak system)
// =============================================================================

/** Streak tier display tiers for milestone badges. */
const STREAK_TIERS = [
  { min: 365, label: "Legendary", emoji: "🏆", color: "#E91E63" },
  { min: 100, label: "Century", emoji: "💯", color: "#A855F7" },
  { min: 50, label: "Unstoppable", emoji: "⚡", color: "#EAB308" },
  { min: 30, label: "Blazing", emoji: "🔥", color: "#F97316" },
  { min: 14, label: "On Fire", emoji: "🔥", color: "#EF4444" },
  { min: 7, label: "Week Warriors", emoji: "⭐", color: "#F59E0B" },
  { min: 3, label: "Kindling", emoji: "✨", color: "#8B5CF6" },
] as const;

function getStreakTier(days: number) {
  return STREAK_TIERS.find((t) => days >= t.min) ?? null;
}

export const SocialProofAdapter = memo(function SocialProofAdapter({
  size,
  data,
}: WidgetAdapterProps) {
  const colors = useColors();
  const streaks: StreakSummary[] = data.streaks ?? [];
  const activeCount: number = data.activeStreakCount ?? 0;
  const topCount: number = data.topStreakCount ?? 0;
  const isLoading: boolean = data.loading ?? false;
  const hasError: boolean = !!data.error;
  const onPress = data.onPress;

  const topStreak = streaks[0] ?? null;
  const tier = topCount > 0 ? getStreakTier(topCount) : null;

  // ── Loading state ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[spStyles.root, { backgroundColor: colors.background }]}>
        <View style={spStyles.centered}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      </View>
    );
  }

  // ── Error state ───────────────────────────────────────────────────
  if (hasError) {
    return (
      <View style={[spStyles.root, { backgroundColor: colors.background }]}>
        <View style={spStyles.centered}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={20}
            color={colors.textSecondary}
          />
          <Text style={[spStyles.emptyText, { color: colors.textSecondary }]}>
            Could not load streaks
          </Text>
        </View>
      </View>
    );
  }

  // ── WIDE (4×1, 88px) ─────────────────────────────────────────────
  if (size === "wide") {
    if (!topStreak) {
      return (
        <TouchableOpacity
          style={[spStyles.root, { backgroundColor: colors.background }]}
          onPress={onPress}
          activeOpacity={0.7}
          disabled={!onPress}
        >
          <View style={spStyles.wideEmpty}>
            <MaterialCommunityIcons
              name="fire"
              size={22}
              color={colors.textSecondary + "80"}
            />
            <View style={spStyles.wideEmptyText}>
              <Text
                style={[spStyles.wideTitle, { color: colors.text }]}
                numberOfLines={1}
              >
                Friend Streaks
              </Text>
              <Text
                style={[spStyles.wideSubtitle, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                Message a friend daily to start!
              </Text>
            </View>
            {onPress && (
              <MaterialCommunityIcons
                name="chevron-right"
                size={16}
                color={colors.textSecondary}
              />
            )}
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={[spStyles.root, { backgroundColor: colors.background }]}
        onPress={onPress}
        activeOpacity={0.7}
        disabled={!onPress}
      >
        <View style={spStyles.wideHeader}>
          <MaterialCommunityIcons
            name="fire"
            size={12}
            color={colors.primary}
          />
          <Text
            style={[spStyles.wideHeaderLabel, { color: colors.textSecondary }]}
          >
            Top Streak
          </Text>
          {activeCount > 1 && (
            <View
              style={[
                spStyles.countBadge,
                { backgroundColor: colors.primary + "20" },
              ]}
            >
              <Text
                style={[spStyles.countBadgeText, { color: colors.primary }]}
              >
                {activeCount} active
              </Text>
            </View>
          )}
        </View>
        <View style={spStyles.wideContent}>
          <ProfilePictureWithDecoration
            pictureUrl={topStreak.partnerPictureUrl}
            name={topStreak.partnerName}
            decorationId={topStreak.partnerDecorationId}
            size={36}
          />
          <View style={spStyles.wideInfo}>
            <View style={spStyles.wideNameRow}>
              <Text
                style={[spStyles.wideStreakCount, { color: colors.text }]}
                numberOfLines={1}
              >
                {topCount}
              </Text>
              <Text style={spStyles.wideFlame}>🔥</Text>
              <Text
                style={[spStyles.wideFriendName, { color: colors.text }]}
                numberOfLines={1}
              >
                {topStreak.partnerName}
              </Text>
            </View>
            {tier && (
              <View
                style={[
                  spStyles.tierChip,
                  { backgroundColor: tier.color + "18" },
                ]}
              >
                <Text style={spStyles.tierChipEmoji}>{tier.emoji}</Text>
                <Text style={[spStyles.tierChipLabel, { color: tier.color }]}>
                  {tier.label}
                </Text>
              </View>
            )}
          </View>
          {topStreak.status === "at_risk" && (
            <View
              style={[
                spStyles.atRiskChip,
                { backgroundColor: "#FF3B30" + "18" },
              ]}
            >
              <Text style={spStyles.atRiskText}>⚠️</Text>
            </View>
          )}
          {onPress && (
            <MaterialCommunityIcons
              name="chevron-right"
              size={16}
              color={colors.textSecondary}
            />
          )}
        </View>
      </TouchableOpacity>
    );
  }

  // ── LARGE (4×2, 176px) ───────────────────────────────────────────
  if (size === "large") {
    if (!topStreak) {
      return (
        <TouchableOpacity
          style={[spStyles.root, { backgroundColor: colors.background }]}
          onPress={onPress}
          activeOpacity={0.7}
          disabled={!onPress}
        >
          <View style={spStyles.largeEmpty}>
            <MaterialCommunityIcons
              name="fire"
              size={32}
              color={colors.textSecondary + "60"}
            />
            <Text style={[spStyles.emptyTitle, { color: colors.text }]}>
              Friend Streaks
            </Text>
            <Text style={[spStyles.emptyText, { color: colors.textSecondary }]}>
              Message a friend daily to build a streak together!
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    const nextMs = topStreak.nextMilestone;
    const msProgress =
      nextMs && topCount > 0 ? Math.min(1, topCount / nextMs) : null;

    return (
      <TouchableOpacity
        style={[spStyles.root, { backgroundColor: colors.background }]}
        onPress={onPress}
        activeOpacity={0.7}
        disabled={!onPress}
      >
        <View style={spStyles.largeHeader}>
          <MaterialCommunityIcons
            name="fire"
            size={14}
            color={colors.primary}
          />
          <Text
            style={[spStyles.largeHeaderLabel, { color: colors.textSecondary }]}
          >
            Friend Streaks
          </Text>
          {activeCount > 1 && (
            <View
              style={[
                spStyles.countBadge,
                { backgroundColor: colors.primary + "20" },
              ]}
            >
              <Text
                style={[spStyles.countBadgeText, { color: colors.primary }]}
              >
                {activeCount} active
              </Text>
            </View>
          )}
          {onPress && (
            <MaterialCommunityIcons
              name="chevron-right"
              size={16}
              color={colors.textSecondary}
              style={spStyles.headerChevron}
            />
          )}
        </View>

        {/* Top streak highlight */}
        <View style={spStyles.largeHighlight}>
          <ProfilePictureWithDecoration
            pictureUrl={topStreak.partnerPictureUrl}
            name={topStreak.partnerName}
            decorationId={topStreak.partnerDecorationId}
            size={44}
          />
          <View style={spStyles.largeHighlightInfo}>
            <View style={spStyles.largeCountRow}>
              <Text style={[spStyles.largeCount, { color: colors.text }]}>
                {topCount}
              </Text>
              <Text style={spStyles.largeFlame}>🔥</Text>
              {topStreak.status === "at_risk" && (
                <View
                  style={[
                    spStyles.atRiskPill,
                    { backgroundColor: "#FF3B30" + "18" },
                  ]}
                >
                  <Text style={spStyles.atRiskPillText}>At Risk</Text>
                </View>
              )}
              {topStreak.graceUsed && topStreak.status !== "at_risk" && (
                <View
                  style={[
                    spStyles.savedPill,
                    { backgroundColor: "#34C759" + "18" },
                  ]}
                >
                  <Text style={spStyles.savedPillText}>Saved</Text>
                </View>
              )}
            </View>
            <Text
              style={[spStyles.largeName, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              with {topStreak.partnerName}
            </Text>
            {tier && (
              <View
                style={[
                  spStyles.tierChip,
                  { backgroundColor: tier.color + "18" },
                ]}
              >
                <Text style={spStyles.tierChipEmoji}>{tier.emoji}</Text>
                <Text style={[spStyles.tierChipLabel, { color: tier.color }]}>
                  {tier.label}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Milestone progress */}
        {msProgress != null && nextMs && (
          <View style={spStyles.milestoneRow}>
            <ProgressBar
              progress={msProgress}
              color={tier?.color ?? colors.primary}
              style={[
                spStyles.milestoneBar,
                { backgroundColor: colors.surfaceVariant + "60" },
              ]}
            />
            <Text
              style={[spStyles.milestoneLabel, { color: colors.textSecondary }]}
            >
              {nextMs - topCount} to {nextMs}-day milestone
            </Text>
          </View>
        )}

        {/* Additional streaks list */}
        {streaks.length > 1 && (
          <View style={spStyles.largeMoreRow}>
            {streaks.slice(1, 4).map((s) => (
              <View key={s.friendshipId} style={spStyles.miniStreak}>
                <ProfilePictureWithDecoration
                  pictureUrl={s.partnerPictureUrl}
                  name={s.partnerName}
                  decorationId={s.partnerDecorationId}
                  size={22}
                />
                <Text
                  style={[spStyles.miniCount, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {s.streakCount}🔥
                </Text>
                {s.status === "at_risk" && (
                  <Text style={spStyles.miniWarn}>⚠️</Text>
                )}
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  }

  // ── Default (any other size) — same as wide ───────────────────────
  return <SocialProofAdapter size="wide" data={data} />;
});

// =============================================================================
// Friends Card Adapter
// =============================================================================

export const FriendsCardAdapter = memo(function FriendsCardAdapter({
  size,
  data,
}: WidgetAdapterProps) {
  const compact = size === "small";
  return (
    <View style={styles.fill}>
      <FriendsCard
        userId={data.userId}
        isOwnProfile={data.isOwnProfile}
        hiddenFromOthers={data.hiddenFromOthers}
        maxAvatars={compact ? 2 : undefined}
        enterIndex={0}
        onPress={data.onPress}
        onFriendPress={data.onFriendPress}
        embedded
      />
    </View>
  );
});

// =============================================================================
// Badges Card Adapter
// =============================================================================

export const BadgesCardAdapter = memo(function BadgesCardAdapter({
  size,
  data,
}: WidgetAdapterProps) {
  const compact = size === "small";
  return (
    <View style={styles.fill}>
      <BadgesCard
        badges={data.badges}
        totalEarned={data.totalEarned}
        hiddenFromOthers={data.hiddenFromOthers}
        maxPreview={compact ? 3 : undefined}
        enterIndex={0}
        onPress={data.onPress}
        embedded
      />
    </View>
  );
});

// =============================================================================
// Achievements Card Adapter
// =============================================================================

export const AchievementsCardAdapter = memo(function AchievementsCardAdapter({
  size,
  data,
}: WidgetAdapterProps) {
  return (
    <View style={styles.fill}>
      <AchievementsTrophyCaseCard
        userId={data.userId}
        featuredAchievementIds={data.featuredAchievementIds}
        hiddenFromOthers={data.hiddenFromOthers}
        onPress={data.onPress}
        embedded
      />
    </View>
  );
});

// =============================================================================
// Mutual Friends Adapter
// =============================================================================

export const MutualFriendsAdapter = memo(function MutualFriendsAdapter({
  size,
  data,
}: WidgetAdapterProps) {
  const colors = useColors();
  const compact = size === "small";
  const mutuals: Array<{ id: string; name: string; pictureUrl?: string }> =
    data.mutualFriends ?? [];
  const count = data.mutualCount ?? mutuals.length;

  return (
    <View
      style={[adapterStyles.fillPad, { backgroundColor: colors.background }]}
    >
      <View style={adapterStyles.adapterHeader}>
        <MaterialCommunityIcons
          name="account-multiple-check"
          size={compact ? 16 : 18}
          color={colors.primary}
        />
        <Text
          style={[adapterStyles.adapterTitle, { color: colors.text }]}
          numberOfLines={1}
        >
          Mutual Friends
        </Text>
      </View>
      {!compact && mutuals.length > 0 && (
        <View style={adapterStyles.avatarRow}>
          {mutuals.slice(0, 5).map((f) => (
            <ProfilePictureWithDecoration
              key={f.id}
              pictureUrl={f.pictureUrl}
              name={f.name}
              size={32}
            />
          ))}
          {count > 5 && (
            <View
              style={[
                adapterStyles.avatarOverflow,
                { backgroundColor: colors.surfaceVariant },
              ]}
            >
              <Text
                style={[
                  adapterStyles.avatarOverflowText,
                  { color: colors.textSecondary },
                ]}
              >
                +{count - 5}
              </Text>
            </View>
          )}
        </View>
      )}
      <Text
        style={[adapterStyles.emptyHint, { color: colors.textSecondary }]}
        numberOfLines={compact ? 1 : 2}
      >
        {mutuals.length > 0 && !compact
          ? `${count} friend${count !== 1 ? "s" : ""} in common`
          : "Shows mutual friends to profile viewers"}
      </Text>
    </View>
  );
});

// =============================================================================
// Favorite Game Adapter
// =============================================================================

export const FavoriteGameAdapter = memo(function FavoriteGameAdapter({
  size,
  data,
}: WidgetAdapterProps) {
  const colors = useColors();
  const gameName: string = data.gameName ?? "Not set";
  const notSet = gameName === "Not set";
  const gamesPlayed: number = data.gamesPlayed ?? 0;
  const winRate: number = data.winRate ?? 0;

  // ── small (2×1, 88px): icon + name + mini stats row ──────────────
  if (size === "small") {
    return (
      <View style={[favStyles.root, { backgroundColor: colors.background }]}>
        <View style={favStyles.smallTop}>
          <MaterialCommunityIcons
            name="gamepad-variant"
            size={18}
            color={colors.primary}
          />
          <Text
            style={[favStyles.smallName, { color: colors.text }]}
            numberOfLines={1}
          >
            {notSet ? "Favorite Game" : gameName}
          </Text>
        </View>
        {notSet ? (
          <Text
            style={[favStyles.smallHint, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            Play a game to set this!
          </Text>
        ) : (
          <View style={favStyles.smallStats}>
            <View
              style={[
                favStyles.smallPill,
                { backgroundColor: colors.surfaceVariant + "60" },
              ]}
            >
              <Text style={[favStyles.pillValue, { color: colors.text }]}>
                {gamesPlayed}
              </Text>
              <Text
                style={[favStyles.pillLabel, { color: colors.textSecondary }]}
              >
                Played
              </Text>
            </View>
            <View
              style={[
                favStyles.smallPill,
                { backgroundColor: colors.surfaceVariant + "60" },
              ]}
            >
              <Text style={[favStyles.pillValue, { color: colors.text }]}>
                {winRate}%
              </Text>
              <Text
                style={[favStyles.pillLabel, { color: colors.textSecondary }]}
              >
                Win
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  }

  // ── wide (4×1, 88px): horizontal — icon, name, spacer, stat pills ─
  if (size === "wide") {
    return (
      <View style={[favStyles.root, { backgroundColor: colors.background }]}>
        <View style={favStyles.wideHeader}>
          <MaterialCommunityIcons
            name="gamepad-variant"
            size={14}
            color={colors.primary}
          />
          <Text style={[favStyles.wideTitle, { color: colors.textSecondary }]}>
            Favorite Game
          </Text>
        </View>
        <View style={favStyles.wideContent}>
          <View style={favStyles.wideNameCol}>
            <Text
              style={[favStyles.wideName, { color: colors.text }]}
              numberOfLines={1}
            >
              {gameName}
            </Text>
          </View>
          {!notSet && (
            <View style={favStyles.wideStats}>
              <View
                style={[
                  favStyles.widePill,
                  { backgroundColor: colors.surfaceVariant + "50" },
                ]}
              >
                <Text style={[favStyles.widePillValue, { color: colors.text }]}>
                  {gamesPlayed}
                </Text>
                <Text
                  style={[
                    favStyles.widePillLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  Played
                </Text>
              </View>
              <View
                style={[
                  favStyles.widePill,
                  { backgroundColor: colors.surfaceVariant + "50" },
                ]}
              >
                <Text style={[favStyles.widePillValue, { color: colors.text }]}>
                  {winRate}%
                </Text>
                <Text
                  style={[
                    favStyles.widePillLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  Win Rate
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>
    );
  }

  // ── medium (2×2, 176px): centered vertical card ──────────────────
  return (
    <View style={[favStyles.root, { backgroundColor: colors.background }]}>
      <View style={favStyles.medHeader}>
        <MaterialCommunityIcons
          name="gamepad-variant"
          size={16}
          color={colors.primary}
        />
        <Text style={[favStyles.medTitle, { color: colors.textSecondary }]}>
          Favorite Game
        </Text>
      </View>
      <View style={favStyles.medCenter}>
        <View
          style={[
            favStyles.medIconCircle,
            { backgroundColor: colors.primary + "18" },
          ]}
        >
          <MaterialCommunityIcons
            name="gamepad-variant"
            size={28}
            color={colors.primary}
          />
        </View>
        <Text
          style={[favStyles.medName, { color: colors.text }]}
          numberOfLines={2}
        >
          {gameName}
        </Text>
      </View>
      {!notSet && (
        <View style={favStyles.medStats}>
          <View
            style={[
              favStyles.medStatCell,
              { backgroundColor: colors.surfaceVariant + "50" },
            ]}
          >
            <Text style={[favStyles.medStatValue, { color: colors.text }]}>
              {gamesPlayed}
            </Text>
            <Text
              style={[favStyles.medStatLabel, { color: colors.textSecondary }]}
            >
              Played
            </Text>
          </View>
          <View
            style={[
              favStyles.medStatCell,
              { backgroundColor: colors.surfaceVariant + "50" },
            ]}
          >
            <Text style={[favStyles.medStatValue, { color: colors.text }]}>
              {winRate}%
            </Text>
            <Text
              style={[favStyles.medStatLabel, { color: colors.textSecondary }]}
            >
              Win Rate
            </Text>
          </View>
        </View>
      )}
    </View>
  );
});

// =============================================================================
// Profile Stats Adapter
// =============================================================================

export const ProfileStatsAdapter = memo(function ProfileStatsAdapter({
  size,
  data,
}: WidgetAdapterProps) {
  const colors = useColors();
  const isWide = size !== "medium";
  const stats = [
    {
      label: "Games",
      value: data.totalGames ?? 0,
      icon: "gamepad-variant" as const,
    },
    {
      label: "Wins",
      value: data.totalWins ?? 0,
      icon: "trophy-outline" as const,
    },
    {
      label: "Hours",
      value: data.totalHours ?? 0,
      icon: "clock-outline" as const,
    },
    {
      label: "Friends",
      value: data.friendCount ?? 0,
      icon: "account-group" as const,
    },
  ];
  const visibleStats = isWide ? stats : stats.slice(0, 2);

  if (isWide) {
    // Wide (4×1, 88px): compact horizontal cells
    return (
      <View style={[statsStyles.root, { backgroundColor: colors.background }]}>
        <View style={statsStyles.header}>
          <MaterialCommunityIcons
            name="chart-bar"
            size={14}
            color={colors.primary}
          />
          <Text style={[statsStyles.headerTitle, { color: colors.text }]}>
            Stats
          </Text>
        </View>
        <View style={statsStyles.wideGrid}>
          {visibleStats.map((s) => (
            <View
              key={s.label}
              style={[
                statsStyles.wideCell,
                { backgroundColor: colors.surfaceVariant + "50" },
              ]}
            >
              <View style={statsStyles.wideCellTop}>
                <MaterialCommunityIcons
                  name={s.icon}
                  size={14}
                  color={colors.primary}
                />
                <Text style={[statsStyles.wideValue, { color: colors.text }]}>
                  {s.value}
                </Text>
              </View>
              <Text
                style={[statsStyles.wideLabel, { color: colors.textSecondary }]}
              >
                {s.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  // Medium (2×2, 176px): generous vertical cells
  return (
    <View style={[statsStyles.root, { backgroundColor: colors.background }]}>
      <View style={statsStyles.header}>
        <MaterialCommunityIcons
          name="chart-bar"
          size={18}
          color={colors.primary}
        />
        <Text style={[statsStyles.headerTitle, { color: colors.text }]}>
          Stats
        </Text>
      </View>
      <View style={statsStyles.mediumGrid}>
        {visibleStats.map((s) => (
          <View
            key={s.label}
            style={[
              statsStyles.mediumCell,
              { backgroundColor: colors.surfaceVariant + "50" },
            ]}
          >
            <MaterialCommunityIcons
              name={s.icon}
              size={20}
              color={colors.primary}
            />
            <Text style={[statsStyles.mediumValue, { color: colors.text }]}>
              {s.value}
            </Text>
            <Text
              style={[statsStyles.mediumLabel, { color: colors.textSecondary }]}
            >
              {s.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
});

// =============================================================================
// Recent Activity Adapter
// =============================================================================

export const RecentActivityAdapter = memo(function RecentActivityAdapter({
  size,
  data,
}: WidgetAdapterProps) {
  const colors = useColors();
  const activities: Array<{
    id: string;
    text: string;
    time: string;
    icon?: string;
  }> = data.activities ?? [];
  const maxItems = size === "large" ? 4 : 2;

  return (
    <View
      style={[adapterStyles.fillPad, { backgroundColor: colors.background }]}
    >
      <View style={adapterStyles.adapterHeader}>
        <MaterialCommunityIcons
          name="history"
          size={18}
          color={colors.primary}
        />
        <Text style={[adapterStyles.adapterTitle, { color: colors.text }]}>
          Recent Activity
        </Text>
      </View>
      {activities.length > 0 ? (
        activities.slice(0, maxItems).map((a) => (
          <View key={a.id} style={adapterStyles.activityItem}>
            <MaterialCommunityIcons
              name={
                (a.icon as keyof typeof MaterialCommunityIcons.glyphMap) ??
                "circle-small"
              }
              size={16}
              color={colors.textSecondary}
            />
            <View style={adapterStyles.activityText}>
              <Text
                style={[adapterStyles.activityDesc, { color: colors.text }]}
                numberOfLines={1}
              >
                {a.text}
              </Text>
              <Text
                style={[
                  adapterStyles.activityTime,
                  { color: colors.textSecondary },
                ]}
              >
                {a.time}
              </Text>
            </View>
          </View>
        ))
      ) : (
        <Text
          style={[adapterStyles.emptyHint, { color: colors.textSecondary }]}
        >
          No recent activity
        </Text>
      )}
    </View>
  );
});

// =============================================================================
// Viewer Actions Adapter
// =============================================================================

/**
 * Displays viewer-specific info (muted badge, friendship info, last active)
 * and the ProfileActionsBar inside a non-removable widget.
 * Only injected into the board on the viewer profile screen.
 */
export const ViewerActionsAdapter = memo(function ViewerActionsAdapter({
  data,
}: WidgetAdapterProps) {
  const colors = useColors();

  return (
    <View
      style={[
        viewerActionsStyles.container,
        { backgroundColor: colors.background },
      ]}
    >
      {/* Muted badge */}
      {data.isMuted && (
        <View
          style={[
            viewerActionsStyles.mutedBadge,
            { backgroundColor: colors.surfaceVariant + "99" },
          ]}
        >
          <MaterialCommunityIcons
            name="bell-off"
            size={14}
            color={colors.textSecondary}
          />
          <Text
            style={[
              viewerActionsStyles.mutedText,
              { color: colors.textSecondary },
            ]}
          >
            Muted
          </Text>
        </View>
      )}

      {/* Friendship info */}
      {data.friendshipDuration && (
        <View
          style={[
            viewerActionsStyles.infoPill,
            { backgroundColor: colors.surfaceVariant + "60" },
          ]}
        >
          <MaterialCommunityIcons
            name="heart-outline"
            size={14}
            color={colors.textSecondary}
          />
          <Text
            style={[
              viewerActionsStyles.infoText,
              { color: colors.textSecondary },
            ]}
          >
            Friends for {data.friendshipDuration}
          </Text>
        </View>
      )}

      {/* Last active */}
      {data.lastActiveLabel && (
        <View style={viewerActionsStyles.lastActiveRow}>
          <MaterialCommunityIcons
            name="clock-outline"
            size={12}
            color={colors.textSecondary}
          />
          <Text
            style={[
              viewerActionsStyles.lastActiveText,
              { color: colors.textSecondary },
            ]}
          >
            Last active {data.lastActiveLabel}
          </Text>
        </View>
      )}

      {/* Action buttons */}
      {data.relationship && (
        <ProfileActionsBar
          relationship={data.relationship}
          isLoading={data.actionLoading}
          loadingAction={data.loadingAction}
          onAddFriend={data.onAddFriend}
          onCancelRequest={data.onCancelRequest}
          onAcceptRequest={data.onAcceptRequest}
          onDeclineRequest={data.onDeclineRequest}
          onMessage={data.onMessage}
          onCall={data.onCall}
          onRemoveFriend={data.onRemoveFriend}
          onUnblock={data.onUnblock}
          onMoreOptions={data.onMoreOptions}
        />
      )}
    </View>
  );
});

const viewerActionsStyles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    alignItems: "center",
    gap: Spacing.xs,
  },
  mutedBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  mutedText: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  infoPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  infoText: {
    fontSize: 12,
    fontWeight: "500",
  },
  lastActiveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  lastActiveText: {
    fontSize: 11,
  },
});

// =============================================================================
// Tasks Overview Adapter
// =============================================================================

/**
 * Tasks widget — shows Daily & Monthly task progress.
 *
 * data.dailyCompleted / data.dailyTotal — daily task counts
 * data.monthlyCompleted / data.monthlyTotal — monthly task counts
 * data.onPress — navigate to Tasks screen (owner only, non-customize)
 * data.isOwner — whether this is the profile owner
 * data.isCustomizing — whether in customize mode
 */
export const TasksOverviewAdapter = memo(function TasksOverviewAdapter({
  size,
  data,
}: WidgetAdapterProps) {
  const colors = useColors();
  const isInteractive = data.isOwner && !data.isCustomizing && !!data.onPress;

  const dailyDone = data.dailyCompleted ?? 0;
  const dailyTotal = data.dailyTotal ?? 0;
  const monthlyDone = data.monthlyCompleted ?? 0;
  const monthlyTotal = data.monthlyTotal ?? 0;
  const dailyProgress = dailyTotal > 0 ? dailyDone / dailyTotal : 0;
  const monthlyProgress = monthlyTotal > 0 ? monthlyDone / monthlyTotal : 0;

  const handlePress = useCallback(() => {
    if (isInteractive) data.onPress();
  }, [isInteractive, data.onPress]);

  if (size === "wide") {
    return (
      <TouchableOpacity
        style={[taskStyles.wideRoot, { backgroundColor: colors.background }]}
        onPress={handlePress}
        activeOpacity={isInteractive ? 0.7 : 1}
        disabled={!isInteractive}
      >
        <View style={taskStyles.wideHeader}>
          <MaterialCommunityIcons
            name="checkbox-marked-circle-outline"
            size={16}
            color={colors.primary}
          />
          <Text style={[taskStyles.title, { color: colors.text }]}>Tasks</Text>
          {isInteractive && (
            <MaterialCommunityIcons
              name="chevron-right"
              size={16}
              color={colors.textSecondary}
            />
          )}
        </View>
        <View style={taskStyles.wideChipRow}>
          <View
            style={[
              taskStyles.chip,
              { backgroundColor: colors.primary + "12" },
            ]}
          >
            <Text style={[taskStyles.chipLabel, { color: colors.primary }]}>
              Daily
            </Text>
            <Text style={[taskStyles.chipValue, { color: colors.text }]}>
              {dailyDone}/{dailyTotal}
            </Text>
          </View>
          <View
            style={[
              taskStyles.chip,
              { backgroundColor: colors.secondary + "12" },
            ]}
          >
            <Text style={[taskStyles.chipLabel, { color: colors.secondary }]}>
              Monthly
            </Text>
            <Text style={[taskStyles.chipValue, { color: colors.text }]}>
              {monthlyDone}/{monthlyTotal}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // large (4×2)
  return (
    <TouchableOpacity
      style={[taskStyles.largeRoot, { backgroundColor: colors.background }]}
      onPress={handlePress}
      activeOpacity={isInteractive ? 0.7 : 1}
      disabled={!isInteractive}
    >
      <View style={taskStyles.wideHeader}>
        <MaterialCommunityIcons
          name="checkbox-marked-circle-outline"
          size={16}
          color={colors.primary}
        />
        <Text style={[taskStyles.title, { color: colors.text }]}>Tasks</Text>
        {isInteractive && (
          <MaterialCommunityIcons
            name="chevron-right"
            size={16}
            color={colors.textSecondary}
          />
        )}
      </View>
      <View style={taskStyles.largeSection}>
        <View style={taskStyles.sectionRow}>
          <Text
            style={[taskStyles.sectionLabel, { color: colors.textSecondary }]}
          >
            Daily
          </Text>
          <Text style={[taskStyles.sectionCount, { color: colors.text }]}>
            {dailyDone}/{dailyTotal}
          </Text>
        </View>
        <ProgressBar
          progress={dailyProgress}
          color={colors.primary}
          style={taskStyles.progressBar}
        />
      </View>
      <View style={taskStyles.largeSection}>
        <View style={taskStyles.sectionRow}>
          <Text
            style={[taskStyles.sectionLabel, { color: colors.textSecondary }]}
          >
            Monthly
          </Text>
          <Text style={[taskStyles.sectionCount, { color: colors.text }]}>
            {monthlyDone}/{monthlyTotal}
          </Text>
        </View>
        <ProgressBar
          progress={monthlyProgress}
          color={colors.secondary}
          style={taskStyles.progressBar}
        />
      </View>
      {isInteractive && (
        <TouchableOpacity
          style={[taskStyles.cta, { backgroundColor: colors.primary + "15" }]}
          onPress={handlePress}
          activeOpacity={0.7}
        >
          <Text style={[taskStyles.ctaText, { color: colors.primary }]}>
            Open Tasks
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
});

const taskStyles = StyleSheet.create({
  wideRoot: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  wideHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  title: { fontSize: 14, fontWeight: "700" },
  wideChipRow: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  chipLabel: { fontSize: 11, fontWeight: "600" },
  chipValue: { fontSize: 13, fontWeight: "700" },
  largeRoot: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    gap: Spacing.sm,
  },
  largeSection: { gap: 4 },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionLabel: { fontSize: 12, fontWeight: "600" },
  sectionCount: { fontSize: 12, fontWeight: "700" },
  progressBar: { height: 6, borderRadius: 3 },
  cta: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    marginTop: 2,
  },
  ctaText: { fontSize: 12, fontWeight: "700" },
});

// =============================================================================
// Wallet Balance Adapter
// =============================================================================

/**
 * Wallet widget — shows token balance.
 *
 * data.balance — token amount
 * data.loading — whether wallet is loading
 * data.onPress — navigate to wallet (owner only, non-customize)
 * data.isOwner — whether this is the profile owner
 * data.isCustomizing — whether in customize mode
 */
export const WalletBalanceAdapter = memo(function WalletBalanceAdapter({
  size,
  data,
}: WidgetAdapterProps) {
  const colors = useColors();
  const isInteractive = data.isOwner && !data.isCustomizing && !!data.onPress;
  const balance = data.balance ?? 0;
  const loading = data.loading ?? false;

  const handlePress = useCallback(() => {
    if (isInteractive) data.onPress();
  }, [isInteractive, data.onPress]);

  if (size === "small") {
    return (
      <TouchableOpacity
        style={[walletStyles.smallRoot, { backgroundColor: colors.background }]}
        onPress={handlePress}
        activeOpacity={isInteractive ? 0.7 : 1}
        disabled={!isInteractive}
      >
        <MaterialCommunityIcons
          name="star-circle"
          size={22}
          color={colors.warning ?? colors.primary}
        />
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text
            style={[walletStyles.balanceLg, { color: colors.text }]}
            numberOfLines={1}
          >
            {balance.toLocaleString()}
          </Text>
        )}
      </TouchableOpacity>
    );
  }

  if (size === "medium") {
    return (
      <TouchableOpacity
        style={[walletStyles.medRoot, { backgroundColor: colors.background }]}
        onPress={handlePress}
        activeOpacity={isInteractive ? 0.7 : 1}
        disabled={!isInteractive}
      >
        <MaterialCommunityIcons
          name="star-circle"
          size={28}
          color={colors.warning ?? colors.primary}
        />
        <Text
          style={[walletStyles.walletLabel, { color: colors.textSecondary }]}
        >
          Tokens
        </Text>
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text style={[walletStyles.balanceXl, { color: colors.text }]}>
            {balance.toLocaleString()}
          </Text>
        )}
        {isInteractive && (
          <MaterialCommunityIcons
            name="chevron-right"
            size={16}
            color={colors.textSecondary}
            style={walletStyles.chevron}
          />
        )}
      </TouchableOpacity>
    );
  }

  // wide (4×1)
  return (
    <TouchableOpacity
      style={[walletStyles.wideRoot, { backgroundColor: colors.background }]}
      onPress={handlePress}
      activeOpacity={isInteractive ? 0.7 : 1}
      disabled={!isInteractive}
    >
      <MaterialCommunityIcons
        name="star-circle"
        size={24}
        color={colors.warning ?? colors.primary}
      />
      <Text style={[walletStyles.walletLabel, { color: colors.textSecondary }]}>
        Wallet
      </Text>
      <View style={walletStyles.wideBalanceArea}>
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text style={[walletStyles.balanceLg, { color: colors.text }]}>
            {balance.toLocaleString()}
          </Text>
        )}
        <Text
          style={[walletStyles.tokenSuffix, { color: colors.textSecondary }]}
        >
          tokens
        </Text>
      </View>
      {isInteractive && (
        <TouchableOpacity
          style={[walletStyles.cta, { backgroundColor: colors.primary + "15" }]}
          onPress={handlePress}
          activeOpacity={0.7}
        >
          <Text style={[walletStyles.ctaText, { color: colors.primary }]}>
            Open Wallet
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
});

const walletStyles = StyleSheet.create({
  smallRoot: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    paddingHorizontal: Spacing.sm,
  },
  medRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    padding: Spacing.md,
  },
  wideRoot: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  walletLabel: { fontSize: 12, fontWeight: "600" },
  balanceLg: { fontSize: 18, fontWeight: "800" },
  balanceXl: { fontSize: 24, fontWeight: "800" },
  tokenSuffix: { fontSize: 12, fontWeight: "500", marginLeft: 4 },
  wideBalanceArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "flex-end",
  },
  chevron: { position: "absolute", right: 8, bottom: 8 },
  cta: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  ctaText: { fontSize: 12, fontWeight: "700" },
});

// =============================================================================
// Theme Mode Adapter
// =============================================================================

/**
 * Theme widget — switch Light / Dark / Auto.
 *
 * data.themeMode — current mode ("light" | "dark" | "auto")
 * data.onChangeMode — setter (owner only, non-customize)
 * data.isOwner — whether this is the profile owner
 * data.isCustomizing — whether in customize mode
 */
const THEME_OPTIONS: { key: string; label: string; icon: string }[] = [
  { key: "light", label: "Light", icon: "white-balance-sunny" },
  { key: "dark", label: "Dark", icon: "moon-waning-crescent" },
  { key: "auto", label: "Auto", icon: "brightness-auto" },
];

export const ThemeModeAdapter = memo(function ThemeModeAdapter({
  size,
  data,
}: WidgetAdapterProps) {
  const colors = useColors();
  const active = data.themeMode ?? "auto";
  const canInteract =
    data.isOwner && !data.isCustomizing && !!data.onChangeMode;

  const handleSelect = useCallback(
    (key: string) => {
      if (canInteract) data.onChangeMode(key);
    },
    [canInteract, data.onChangeMode],
  );

  const isSmall = size === "small";

  return (
    <View
      style={[
        themeStyles.root,
        isSmall && themeStyles.rootCompact,
        { backgroundColor: colors.background },
      ]}
    >
      <View style={themeStyles.headerRow}>
        <MaterialCommunityIcons
          name="brightness-6"
          size={isSmall ? 12 : 14}
          color={colors.textSecondary}
        />
        <Text
          style={[
            themeStyles.headerLabel,
            isSmall && themeStyles.headerLabelCompact,
            { color: colors.textSecondary },
          ]}
        >
          Appearance
        </Text>
      </View>
      <View
        style={[themeStyles.segmented, isSmall && themeStyles.segmentedCompact]}
      >
        {THEME_OPTIONS.map((opt) => {
          const isActive = active === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[
                themeStyles.seg,
                isSmall && themeStyles.segCompact,
                isActive && {
                  backgroundColor: colors.primary + "20",
                  borderColor: colors.primary,
                  borderWidth: 1.5,
                },
              ]}
              onPress={() => handleSelect(opt.key)}
              activeOpacity={canInteract ? 0.7 : 1}
              disabled={!canInteract}
            >
              <MaterialCommunityIcons
                name={opt.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                size={isSmall ? 13 : 16}
                color={isActive ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  themeStyles.segLabel,
                  isSmall && themeStyles.segLabelCompact,
                  {
                    color: isActive ? colors.primary : colors.textSecondary,
                    fontWeight: isActive ? "700" : "500",
                  },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {size === "wide" && (
        <Text style={[themeStyles.desc, { color: colors.textSecondary }]}>
          {active === "auto"
            ? "Follows system"
            : active === "dark"
              ? "Dark mode active"
              : "Light mode active"}
        </Text>
      )}
    </View>
  );
});

const themeStyles = StyleSheet.create({
  root: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    justifyContent: "center",
    gap: 6,
  },
  rootCompact: {
    padding: Spacing.sm,
    gap: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  headerLabel: { fontSize: 11, fontWeight: "600" },
  headerLabelCompact: { fontSize: 10 },
  segmented: {
    flexDirection: "row",
    gap: 6,
  },
  segmentedCompact: { gap: 4 },
  seg: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  segCompact: {
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 8,
    flex: 1,
  },
  segLabel: { fontSize: 12 },
  segLabelCompact: { fontSize: 10 },
  desc: { fontSize: 11, marginTop: 2 },
});

// =============================================================================
// Chat Layout Mode Adapter
// =============================================================================

/**
 * Chat layout widget — switch Bubbles / Stacked.
 *
 * data.chatLayoutMode — current mode ("bubbles" | "stacked")
 * data.onChangeMode — setter (owner only, non-customize)
 * data.isOwner — whether this is the profile owner
 * data.isCustomizing — whether in customize mode
 */
const CHAT_LAYOUT_OPTIONS: { key: string; label: string; icon: string }[] = [
  { key: "bubbles", label: "Bubbles", icon: "message-outline" },
  { key: "stacked", label: "Stacked", icon: "format-list-text" },
];

export const ChatLayoutModeAdapter = memo(function ChatLayoutModeAdapter({
  size,
  data,
}: WidgetAdapterProps) {
  const colors = useColors();
  const active = data.chatLayoutMode ?? "bubbles";
  const canInteract =
    data.isOwner && !data.isCustomizing && !!data.onChangeMode;

  const handleSelect = useCallback(
    (key: string) => {
      if (canInteract) data.onChangeMode(key);
    },
    [canInteract, data.onChangeMode],
  );

  const isSmall = size === "small";

  return (
    <View
      style={[
        chatLayoutStyles.root,
        isSmall && chatLayoutStyles.rootCompact,
        { backgroundColor: colors.background },
      ]}
    >
      <View style={chatLayoutStyles.headerRow}>
        <MaterialCommunityIcons
          name="message-text-outline"
          size={isSmall ? 12 : 14}
          color={colors.textSecondary}
        />
        <Text
          style={[
            chatLayoutStyles.headerLabel,
            isSmall && chatLayoutStyles.headerLabelCompact,
            { color: colors.textSecondary },
          ]}
        >
          Chat Layout
        </Text>
      </View>
      <View
        style={[
          chatLayoutStyles.segmented,
          isSmall && chatLayoutStyles.segmentedCompact,
        ]}
      >
        {CHAT_LAYOUT_OPTIONS.map((opt) => {
          const isActive = active === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[
                chatLayoutStyles.seg,
                isSmall && chatLayoutStyles.segCompact,
                isActive && {
                  backgroundColor: colors.primary + "20",
                  borderColor: colors.primary,
                  borderWidth: 1.5,
                },
              ]}
              onPress={() => handleSelect(opt.key)}
              activeOpacity={canInteract ? 0.7 : 1}
              disabled={!canInteract}
            >
              <MaterialCommunityIcons
                name={opt.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                size={isSmall ? 14 : 17}
                color={isActive ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  chatLayoutStyles.segLabel,
                  isSmall && chatLayoutStyles.segLabelCompact,
                  {
                    color: isActive ? colors.primary : colors.textSecondary,
                    fontWeight: isActive ? "700" : "500",
                  },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {size === "wide" && (
        <Text style={[chatLayoutStyles.desc, { color: colors.textSecondary }]}>
          {active === "bubbles"
            ? "Classic chat bubbles"
            : "Discord-style stacked"}
        </Text>
      )}
    </View>
  );
});

const chatLayoutStyles = StyleSheet.create({
  root: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    justifyContent: "center",
    gap: 6,
  },
  rootCompact: {
    padding: Spacing.sm,
    gap: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  headerLabel: { fontSize: 11, fontWeight: "600" },
  headerLabelCompact: { fontSize: 10 },
  segmented: {
    flexDirection: "row",
    gap: 6,
  },
  segmentedCompact: { gap: 4 },
  seg: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  segCompact: {
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  segLabel: { fontSize: 12 },
  segLabelCompact: { fontSize: 10 },
  desc: { fontSize: 11, marginTop: 2 },
});

// =============================================================================
// Adapter Registry
// =============================================================================

/** Map from widgetType → adapter component. */
export const WIDGET_ADAPTERS: Record<
  string,
  React.ComponentType<WidgetAdapterProps>
> = {
  "profile-header": ProfileHeaderAdapter,
  "social-proof": SocialProofAdapter,
  friends: FriendsCardAdapter,
  badges: BadgesCardAdapter,
  achievements: AchievementsCardAdapter,
  "mutual-friends": MutualFriendsAdapter,
  "favorite-game": FavoriteGameAdapter,
  "profile-stats": ProfileStatsAdapter,
  "recent-activity": RecentActivityAdapter,
  "viewer-actions": ViewerActionsAdapter,
  "tasks-overview": TasksOverviewAdapter,
  "wallet-balance": WalletBalanceAdapter,
  "theme-mode": ThemeModeAdapter,
  "chat-layout-mode": ChatLayoutModeAdapter,
};

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    overflow: "hidden",
  },
});

// ── New Adapter Shared Styles ───────────────────────────────────────────

const adapterStyles = StyleSheet.create({
  fillPad: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  adapterHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: Spacing.sm,
  },
  adapterTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  avatarRow: {
    flexDirection: "row",
    gap: -8,
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  avatarOverflow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  avatarOverflowText: {
    fontSize: 11,
    fontWeight: "700",
  },
  emptyHint: {
    fontSize: 12,
    fontStyle: "italic",
  },
  featuredName: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  statRow: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginTop: Spacing.xs,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 11,
    marginTop: 1,
  },

  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  activityText: {
    flex: 1,
  },
  activityDesc: {
    fontSize: 13,
  },
  activityTime: {
    fontSize: 11,
    marginTop: 1,
  },
});

// ── Header Variant Styles ───────────────────────────────────────────────

const headerStyles = StyleSheet.create({
  // -- wide (4×1) --
  wideRoot: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  wideInfo: {
    flex: 1,
    justifyContent: "center",
  },
  wideName: {
    fontSize: 18,
    fontWeight: "700",
  },
  wideMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: 2,
  },
  wideLevel: {
    fontSize: 12,
    fontWeight: "600",
  },
  wideActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  wideStatusChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  wideStatus: {
    fontSize: 12,
  },

  // -- large (4×2) --
  largeRoot: {
    flex: 1,
    borderRadius: 0,
    overflow: "hidden",
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 0,
  },
  bgGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  largeForeground: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
  largeTextCol: {
    flex: 1,
    justifyContent: "center",
  },
  largeNameStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  largeNameBlock: {
    flexShrink: 1,
  },
  largeSettingsBtn: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    zIndex: 2,
  },
  largeName: {
    fontSize: 21,
    fontWeight: "700",
  },
  largeUsername: {
    fontSize: 14,
    marginTop: 1,
  },
  largeStatusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    maxWidth: 110,
  },
  largeStatusEmoji: {
    fontSize: 13,
  },
  largeStatusText: {
    fontSize: 12,
  },
  largeLevelBar: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    overflow: "hidden",
  },
  largeBottomBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.md,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    gap: Spacing.sm,
    overflow: "hidden",
  },
  largeBottomLevel: {
    flex: 1,
  },
  largeLevelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  largeLevelBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  largeLevelBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  largeLevelLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  largeLevelProgressWrap: {
    flex: 1,
  },
  largeLevelProgress: {
    height: 4,
    borderRadius: 2,
  },
  largeBottomActions: {
    flexDirection: "row",
    gap: 6,
  },
  largeActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  largeActionBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },

  // -- hero (4×4) --
  heroRoot: {
    flex: 1,
    borderRadius: 0,
    overflow: "hidden",
  },
  heroForeground: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  heroSettingsBtn: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    zIndex: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  heroPictureSection: {
    marginBottom: Spacing.xs,
  },
  heroName: {
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
  },
  heroUsername: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 2,
  },
  heroStatusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    marginTop: 6,
  },
  heroStatusText: {
    fontSize: 13,
    fontWeight: "500",
  },
  heroBio: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: BorderRadius.md,
    maxWidth: "90%",
  },
  heroBioText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  heroActionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: 6,
  },
  heroActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
  },
  heroActionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  heroLevelBar: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
    overflow: "hidden",
    gap: 4,
  },
  heroLevelTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  heroLevelBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  heroLevelBadgeText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "800",
  },
  heroLevelXpInfo: {
    flex: 1,
  },
  heroLevelLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  heroLevelXpText: {
    fontSize: 11,
    marginTop: 1,
  },
  heroUnclaimedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FF3B30",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  heroUnclaimedText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "700",
  },
  heroLevelBarRow: {
    paddingLeft: 42,
  },
  heroProgressBar: {
    height: 6,
    borderRadius: 3,
  },
  heroLevelHint: {
    fontSize: 11,
    paddingLeft: 42,
  },

  // -- mega (4×6) --
  megaRoot: {
    flex: 1,
    borderRadius: 0,
    overflow: "hidden",
  },
  megaForeground: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: 80,
  },
  megaPictureSection: {
    marginBottom: Spacing.md,
  },
  megaName: {
    fontSize: 30,
    fontWeight: "800",
    textAlign: "center",
  },
  megaUsername: {
    fontSize: 18,
    textAlign: "center",
    marginTop: 3,
  },
  megaStatusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginTop: Spacing.md,
  },
  megaStatusText: {
    fontSize: 15,
    fontWeight: "500",
  },
  megaBio: {
    marginTop: Spacing.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    maxWidth: "90%",
  },
  megaBioText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  megaActionRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  megaActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
  },
  megaActionText: {
    fontSize: 15,
    fontWeight: "600",
  },
  megaLevelBar: {
    position: "absolute",
    bottom: Spacing.md,
    left: Spacing.md,
    right: Spacing.md,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    overflow: "hidden",
    gap: 8,
  },
  megaLevelBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  megaLevelBadgeText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "800",
  },
  megaLevelLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  megaLevelXpText: {
    fontSize: 12,
    marginTop: 1,
  },
  megaLevelBarRow: {
    paddingLeft: 48,
  },
  megaProgressBar: {
    height: 7,
    borderRadius: 3.5,
  },
  megaLevelHint: {
    fontSize: 12,
    paddingLeft: 48,
  },
});

// ── Stats Widget Styles ─────────────────────────────────────────────────

const statsStyles = StyleSheet.create({
  root: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: Spacing.xs,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  // Wide (4×1): all 4 stats in one compact row
  wideGrid: {
    flex: 1,
    flexDirection: "row",
    gap: Spacing.xs,
  },
  wideCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.sm,
    paddingVertical: 3,
    paddingHorizontal: Spacing.xs,
    gap: 1,
  },
  wideCellTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  wideValue: {
    fontSize: 15,
    fontWeight: "800",
  },
  wideLabel: {
    fontSize: 10,
    fontWeight: "500",
  },
  // Medium (2×2): 2 stats, generous vertical layout
  mediumGrid: {
    flex: 1,
    flexDirection: "row",
    gap: Spacing.sm,
  },
  mediumCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    gap: 4,
  },
  mediumValue: {
    fontSize: 22,
    fontWeight: "800",
  },
  mediumLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
});

// ── Social Proof (Streak) Widget Styles ─────────────────────────────────

const spStyles = StyleSheet.create({
  root: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
  },

  // -- Wide (4×1) --
  wideEmpty: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  wideEmptyText: {
    flex: 1,
  },
  wideHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  wideHeaderLabel: {
    fontSize: 11,
    fontWeight: "600",
    flex: 1,
  },
  wideContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  wideInfo: {
    flex: 1,
    justifyContent: "center",
  },
  wideNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  wideStreakCount: {
    fontSize: 18,
    fontWeight: "800",
  },
  wideFlame: {
    fontSize: 14,
  },
  wideFriendName: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  wideTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  wideSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },

  // -- Large (4×2) --
  largeEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  emptyText: {
    fontSize: 12,
    textAlign: "center",
  },
  largeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: Spacing.xs,
  },
  largeHeaderLabel: {
    fontSize: 11,
    fontWeight: "600",
    flex: 1,
  },
  headerChevron: {
    marginLeft: "auto",
  },
  largeHighlight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  largeHighlightInfo: {
    flex: 1,
    gap: 2,
  },
  largeCountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  largeCount: {
    fontSize: 24,
    fontWeight: "800",
  },
  largeFlame: {
    fontSize: 18,
  },
  largeName: {
    fontSize: 12,
    fontWeight: "500",
  },
  milestoneRow: {
    gap: 3,
  },
  milestoneBar: {
    height: 5,
    borderRadius: 3,
  },
  milestoneLabel: {
    fontSize: 10,
    fontWeight: "500",
  },
  largeMoreRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(128,128,128,0.15)",
  },
  miniStreak: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  miniCount: {
    fontSize: 12,
    fontWeight: "700",
  },
  miniWarn: {
    fontSize: 10,
  },

  // -- Shared --
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BorderRadius.full,
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  tierChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    gap: 3,
  },
  tierChipEmoji: {
    fontSize: 10,
  },
  tierChipLabel: {
    fontSize: 10,
    fontWeight: "700",
  },
  atRiskChip: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  atRiskText: {
    fontSize: 12,
  },
  atRiskPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BorderRadius.full,
    marginLeft: 4,
  },
  atRiskPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FF3B30",
  },
  savedPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BorderRadius.full,
    marginLeft: 4,
  },
  savedPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#34C759",
  },
});

// ── Favorite Game Widget Styles ─────────────────────────────────────────

const favStyles = StyleSheet.create({
  root: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  // -- small (2×1, 88px) --
  smallTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  smallName: {
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  smallHint: {
    fontSize: 11,
    fontStyle: "italic",
    marginTop: 4,
  },
  smallStats: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginTop: 6,
    flex: 1,
  },
  smallPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: BorderRadius.sm,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  pillValue: {
    fontSize: 13,
    fontWeight: "800",
  },
  pillLabel: {
    fontSize: 10,
    fontWeight: "500",
  },
  // -- wide (4×1, 88px) --
  wideHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  wideTitle: {
    fontSize: 11,
    fontWeight: "600",
  },
  wideContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  wideNameCol: {
    flex: 1,
    justifyContent: "center",
  },
  wideName: {
    fontSize: 16,
    fontWeight: "800",
  },
  wideStats: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  widePill: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.sm,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  widePillValue: {
    fontSize: 14,
    fontWeight: "800",
  },
  widePillLabel: {
    fontSize: 10,
    fontWeight: "500",
    marginTop: 1,
  },
  // -- medium (2×2, 176px) --
  medHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  medTitle: {
    fontSize: 11,
    fontWeight: "600",
  },
  medCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  medIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  medName: {
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  medStats: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  medStatCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    gap: 2,
  },
  medStatValue: {
    fontSize: 18,
    fontWeight: "800",
  },
  medStatLabel: {
    fontSize: 10,
    fontWeight: "500",
  },
});
