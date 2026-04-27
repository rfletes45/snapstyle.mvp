/**
 * InboxHeader Component (Messages)
 *
 * Snapchat-inspired header for the Messages screen with:
 * - User avatar (tappable to Profile)
 * - Title ("Messages")
 * - Search button
 * - Games button
 * - Friends button
 *
 * @module components/chat/inbox/InboxHeader
 */

import {
  MAIN_HEADER_ACTION_GAP,
  MAIN_HEADER_ACTION_SIZE,
  MAIN_HEADER_BOTTOM_PADDING,
  MAIN_HEADER_HORIZONTAL_PADDING,
  MAIN_HEADER_TOP_PADDING,
} from "@/components/navigation/MainSettingsHeaderButton";
import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import { ButtonCornerBadge } from "@/components/ui/ButtonCornerBadge";
import { useAppTheme } from "@/store/ThemeContext";
import { useUser } from "@/store/UserContext";
import * as haptics from "@/utils/haptics";
import { createLogger, isDebugEnabled } from "@/utils/log";
import { CommonActions, useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useRef } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { IconButton } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// =============================================================================
// Types
// =============================================================================

export interface InboxHeaderProps {
  /** Callback when search button is pressed */
  onSearchPress: () => void;
  /** Number of pending incoming friend requests — drives the badge on the Friends button */
  pendingFriendRequestCount?: number;
}

const perfLog = createLogger("InboxHeaderPerf");

// =============================================================================
// Component
// =============================================================================

export const InboxHeader = React.memo(function InboxHeader({
  onSearchPress,
  pendingFriendRequestCount = 0,
}: InboxHeaderProps) {
  const { colors, isDark } = useAppTheme();
  const { profile } = useUser();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // Guarded diagnostics: trace avatar readiness changes without logging on
  // every render.
  const mountTimeRef = useRef(performance.now());
  useEffect(() => {
    if (!isDebugEnabled("PERF")) return;
    const url = profile?.profilePicture?.url;
    perfLog.debug("avatar readiness changed", {
      data: {
        ready: !!url,
        elapsedMs: Math.round(performance.now() - mountTimeRef.current),
      },
    });
  }, [profile?.profilePicture?.url]);

  const handleAvatarPress = useCallback(() => {
    haptics.buttonPress();
    navigation.dispatch(
      CommonActions.navigate({
        name: "Profile",
      }),
    );
  }, [navigation]);

  const handleSearchPress = useCallback(() => {
    haptics.buttonPress();
    onSearchPress();
  }, [onSearchPress]);

  const handleFriendsPress = useCallback(() => {
    haptics.buttonPress();
    navigation.dispatch(
      CommonActions.navigate({
        name: "Friends",
      }),
    );
  }, [navigation]);

  const handleGamesPress = useCallback(() => {
    haptics.buttonPress();
    navigation.dispatch(
      CommonActions.navigate({
        name: "GamesHub",
      }),
    );
  }, [navigation]);

  const topPadding =
    Math.max(insets.top, MAIN_HEADER_TOP_PADDING) + MAIN_HEADER_TOP_PADDING;
  const headerContentHeight = 40;
  const iconBtnBg = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: colors.background,
          paddingTop: topPadding,
          paddingBottom: MAIN_HEADER_BOTTOM_PADDING,
          paddingHorizontal: MAIN_HEADER_HORIZONTAL_PADDING,
          minHeight:
            topPadding + MAIN_HEADER_BOTTOM_PADDING + headerContentHeight,
        },
      ]}
    >
      {/* Absolutely centered title */}
      <View
        style={[
          styles.titleOverlay,
          {
            top: topPadding,
            bottom: MAIN_HEADER_BOTTOM_PADDING,
            left: MAIN_HEADER_HORIZONTAL_PADDING,
            right: MAIN_HEADER_HORIZONTAL_PADDING,
          },
        ]}
        pointerEvents="none"
      >
        <Text style={[styles.title, { color: colors.text }]}>Messages</Text>
      </View>

      {/* Left: User Avatar + Search Button */}
      <View style={styles.leftContainer}>
        <TouchableOpacity
          onPress={handleAvatarPress}
          style={styles.avatarContainer}
          accessibilityLabel="Go to profile"
          accessibilityRole="button"
        >
          <ProfilePictureWithDecoration
            pictureUrl={profile?.profilePicture?.url || null}
            name={profile?.displayName || ""}
            decorationId={profile?.avatarDecoration?.decorationId || null}
            size={38}
          />
        </TouchableOpacity>
        <IconButton
          icon="magnify"
          iconColor={colors.textSecondary}
          containerColor={iconBtnBg}
          size={22}
          onPress={handleSearchPress}
          accessibilityLabel="Search conversations"
          style={styles.iconButton}
        />
      </View>

      {/* Spacer */}
      <View style={styles.spacer} />

      {/* Right: Games, Friends */}
      <View style={styles.rightContainer}>
        <IconButton
          icon="gamepad-variant-outline"
          iconColor={colors.textSecondary}
          containerColor={iconBtnBg}
          size={22}
          onPress={handleGamesPress}
          accessibilityLabel="Games"
          style={styles.headerBtn}
        />
        <View style={styles.friendsBtnWrapper}>
          <IconButton
            icon="account-group-outline"
            iconColor={colors.textSecondary}
            containerColor={iconBtnBg}
            size={22}
            onPress={handleFriendsPress}
            accessibilityLabel={
              pendingFriendRequestCount > 0
                ? "Friends, pending friend requests"
                : "Friends"
            }
            style={styles.headerBtn}
          />
          <ButtonCornerBadge
            visible={pendingFriendRequestCount > 0}
            badgeColor={colors.error}
            borderColor={colors.background}
            accessibilityLabel="Pending friend requests"
          />
        </View>
      </View>
    </View>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    elevation: 0,
    shadowOpacity: 0,
    paddingBottom: 0,
  },
  leftContainer: {
    flexDirection: "row",
    alignItems: "center",
    zIndex: 1,
    gap: MAIN_HEADER_ACTION_GAP,
    minHeight: MAIN_HEADER_ACTION_SIZE,
  },
  rightContainer: {
    flexDirection: "row",
    alignItems: "center",
    zIndex: 1,
    gap: MAIN_HEADER_ACTION_GAP,
    minHeight: MAIN_HEADER_ACTION_SIZE,
  },
  spacer: {
    flex: 1,
  },
  avatarContainer: {},
  iconButton: {
    margin: 0,
    width: MAIN_HEADER_ACTION_SIZE,
    height: MAIN_HEADER_ACTION_SIZE,
  },
  headerBtn: {
    margin: 0,
    width: MAIN_HEADER_ACTION_SIZE,
    height: MAIN_HEADER_ACTION_SIZE,
  },
  friendsBtnWrapper: {
    position: "relative",
    overflow: "visible",
  },
  titleOverlay: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 21,
    fontWeight: "700",
    letterSpacing: 0.3,
    lineHeight: 25,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
});
