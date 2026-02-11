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
import { Spacing } from "@/constants/theme";

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

  return (
    <Appbar.Header
      style={[
        styles.header,
        {
          backgroundColor: colors.surface,
          paddingTop: insets.top,
          height: 48 + insets.top,
          minHeight: 48 + insets.top,
        },
      ]}
      statusBarHeight={0}
    >
      {/* Left: User Avatar + Search Button */}
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

      {/* Center: Title */}
      <View style={styles.titleContainer}>
        <Appbar.Content
          title={showArchived ? "Archive" : "Inbox"}
          titleStyle={[styles.title, { color: colors.text }]}
        />
      </View>

      {/* Right: Actions */}
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
    </Appbar.Header>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  header: {
    elevation: 0,
    shadowOpacity: 0,
    paddingBottom: 0,
  },
  avatarContainer: {
    marginLeft: Spacing.md,
    marginRight: Spacing.xs,
  },
  searchButton: {
    marginRight: 0,
  },
  titleContainer: {
    flex: 1,
    justifyContent: "center",
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
