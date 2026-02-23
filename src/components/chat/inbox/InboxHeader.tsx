/**
 * InboxHeader Component
 *
 * Top app bar for the inbox screen with:
 * - User avatar (tappable → Profile)
 * - Title ("Inbox" or "Archive")
 * - Archive toggle button
 * - Search button
 * - Connections button (opens Connections screen)
 * - Settings button
 *
 * @module components/chat/inbox/InboxHeader
 */

import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import { Spacing } from "@/constants/theme";
import { useProfilePicture } from "@/hooks/useProfilePicture";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import { useUser } from "@/store/UserContext";
import * as haptics from "@/utils/haptics";
import { CommonActions, useNavigation } from "@react-navigation/native";
import React, { useCallback } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Appbar, IconButton } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// =============================================================================
// Types
// =============================================================================

export interface InboxHeaderProps {
  /** Callback when search button is pressed */
  onSearchPress: () => void;
  /** Callback when settings button is pressed */
  onSettingsPress: () => void;
  /** Whether we're showing archived conversations */
  showArchived: boolean;
  /** Callback to toggle archive view */
  onArchiveToggle: () => void;
}

// =============================================================================
// Component
// =============================================================================

export function InboxHeader({
  onSearchPress,
  onSettingsPress,
  showArchived,
  onArchiveToggle,
}: InboxHeaderProps) {
  const { colors } = useAppTheme();
  const { profile } = useUser();
  const { currentFirebaseUser } = useAuth();
  const { picture, decoration } = useProfilePicture({
    userId: currentFirebaseUser?.uid || "",
  });
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const handleAvatarPress = useCallback(() => {
    haptics.buttonPress();
    // Navigate to Profile tab using CommonActions to reach parent Tab Navigator
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

  const handleSettingsPress = useCallback(() => {
    haptics.buttonPress();
    onSettingsPress();
  }, [onSettingsPress]);

  const handleArchiveToggle = useCallback(() => {
    haptics.selection();
    onArchiveToggle();
  }, [onArchiveToggle]);

  const handleConnectionsPress = useCallback(() => {
    haptics.buttonPress();
    // Navigate to Connections screen at root stack level
    navigation.dispatch(
      CommonActions.navigate({
        name: "Connections",
      }),
    );
  }, [navigation]);

  // Ensure at least 59 px for Dynamic Island devices (iPhone 14 Pro+)
  const safeTop = Math.max(insets.top, 0);
  const headerContentHeight = 48;

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: colors.surface,
          paddingTop: safeTop,
          height: headerContentHeight + safeTop,
          minHeight: headerContentHeight + safeTop,
        },
      ]}
    >
      {/* Absolutely centered title — pinned to content area below safe-area inset */}
      <View
        style={[styles.titleOverlay, { top: safeTop + 8, bottom: 0 }]}
        pointerEvents="none"
      >
        <Appbar.Content
          title={showArchived ? "Archive" : "Inbox"}
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
            pictureUrl={picture?.url || null}
            name={profile?.displayName || ""}
            decorationId={decoration?.decorationId || null}
            size={32}
          />
        </TouchableOpacity>
        <IconButton
          icon="magnify"
          iconColor={colors.textSecondary}
          size={24}
          onPress={handleSearchPress}
          accessibilityLabel="Search conversations"
          style={styles.searchButton}
        />
      </View>

      {/* Spacer */}
      <View style={styles.spacer} />

      {/* Right: Actions */}
      <View style={styles.rightContainer}>
        <IconButton
          icon="account-group-outline"
          iconColor={colors.textSecondary}
          size={24}
          onPress={handleConnectionsPress}
          accessibilityLabel="Connections"
        />
        <IconButton
          icon="cog"
          iconColor={colors.textSecondary}
          size={24}
          onPress={handleSettingsPress}
          accessibilityLabel="Inbox settings"
        />
        <IconButton
          icon={showArchived ? "inbox" : "archive"}
          iconColor={colors.textSecondary}
          size={24}
          onPress={handleArchiveToggle}
          accessibilityLabel={showArchived ? "Show inbox" : "Show archive"}
        />
      </View>
    </View>
  );
}

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
  },
  rightContainer: {
    flexDirection: "row",
    alignItems: "center",
    zIndex: 1,
  },
  spacer: {
    flex: 1,
  },
  avatarContainer: {
    marginLeft: Spacing.md,
    marginRight: Spacing.xs,
  },
  searchButton: {
    marginRight: 0,
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
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
  },
});
