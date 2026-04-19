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

import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import { Spacing } from "@/constants/theme";
import { useAppTheme } from "@/store/ThemeContext";
import { useUser } from "@/store/UserContext";
import * as haptics from "@/utils/haptics";
import { createLogger, isDebugEnabled } from "@/utils/log";
import { CommonActions, useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useRef } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Appbar, IconButton } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// =============================================================================
// Types
// =============================================================================

export interface InboxHeaderProps {
  /** Callback when search button is pressed */
  onSearchPress: () => void;
}

const perfLog = createLogger("InboxHeaderPerf");

// =============================================================================
// Component
// =============================================================================

export const InboxHeader = React.memo(function InboxHeader({
  onSearchPress,
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

  const safeTop = Math.max(insets.top, 0);
  const headerContentHeight = 50;
  const iconBtnBg = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: colors.background,
          paddingTop: safeTop,
          height: headerContentHeight + safeTop,
          minHeight: headerContentHeight + safeTop,
        },
      ]}
    >
      {/* Absolutely centered title */}
      <View
        style={[styles.titleOverlay, { top: safeTop + 6, bottom: 0 }]}
        pointerEvents="none"
      >
        <Appbar.Content
          title="Messages"
          titleStyle={[styles.title, { color: colors.text }]}
          style={styles.titleContent}
        />
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
          size={24}
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
          size={24}
          onPress={handleGamesPress}
          accessibilityLabel="Games"
          style={styles.headerBtn}
        />
        <IconButton
          icon="account-group-outline"
          iconColor={colors.textSecondary}
          containerColor={iconBtnBg}
          size={24}
          onPress={handleFriendsPress}
          accessibilityLabel="Friends"
          style={styles.headerBtn}
        />
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
    gap: Spacing.sm,
  },
  rightContainer: {
    flexDirection: "row",
    alignItems: "center",
    zIndex: 1,
    gap: Spacing.sm,
    marginRight: Spacing.md,
  },
  spacer: {
    flex: 1,
  },
  avatarContainer: {
    marginLeft: Spacing.md,
  },
  iconButton: {
    margin: 0,
  },
  headerBtn: {
    margin: 0,
  },
  titleOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  titleContent: {
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
