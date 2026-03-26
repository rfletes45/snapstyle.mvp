/**
 * ChatHeader — Shared custom header for DM and Group chat screens.
 *
 * Replaces the React Navigation native header on the DM screen so that
 * both DM and group chats use the same custom Paper Appbar approach.
 * The group screen already used Appbar.Header; this component extracts
 * the common structure into a reusable layer.
 *
 * Features:
 * - Back button via Appbar.BackAction
 * - Touchable avatar + title area
 * - Optional presence indicator inline with title (DM)
 * - Optional subtitle (typing, online, member count)
 * - Right-side action buttons (calls, info/overflow)
 * - Consistent safe-area handling
 *
 * @module components/chat/ChatHeader
 */

import { AppImage } from "@/components/AppImage";
import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import { PresenceIndicator } from "@/components/ui";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, TouchableOpacity, View, ViewStyle } from "react-native";
import { Appbar, Text, useTheme } from "react-native-paper";

// =============================================================================
// Types
// =============================================================================

export interface ChatHeaderProps {
  /** Navigate back */
  onBack: () => void;

  /** Chat type — determines layout variations */
  chatType: "dm" | "group";

  /** Primary title (username or group name) */
  title: string;

  /** Subtitle text (e.g. "typing...", "Online", "5 members") */
  subtitle?: string;

  /** Subtitle color override (e.g. primary color for "typing...") */
  subtitleColor?: string;

  // --- Avatar ---

  /** URL for group/DM avatar image */
  avatarUrl?: string | null;

  /** Profile picture URL (for DM) */
  profilePictureUrl?: string | null;

  /** Decoration ID for DM profile picture */
  decorationId?: string | null;

  /** Display name fallback for avatar placeholder */
  avatarFallbackName?: string;

  /** Press handler for avatar/title area */
  onTitlePress?: () => void;

  // --- Presence ---

  /** Whether to show the online indicator */
  showOnlineIndicator?: boolean;

  /** Whether the other user is online (DM only) */
  isOnline?: boolean;

  // --- Right-side actions ---

  /** Render custom right-side content (call buttons, menu, etc.) */
  renderRight?: () => React.ReactNode;

  /** Extra style for the header container */
  style?: ViewStyle;
}

// =============================================================================
// Component
// =============================================================================

export function ChatHeader({
  onBack,
  chatType,
  title,
  subtitle,
  subtitleColor,
  avatarUrl,
  profilePictureUrl,
  decorationId,
  avatarFallbackName,
  onTitlePress,
  showOnlineIndicator = false,
  isOnline = false,
  renderRight,
  style,
}: ChatHeaderProps) {
  const theme = useTheme();
  const { colors } = theme;

  // Avatar rendering
  const renderAvatar = () => {
    if (chatType === "dm") {
      return (
        <ProfilePictureWithDecoration
          pictureUrl={profilePictureUrl}
          name={avatarFallbackName || title}
          decorationId={decorationId}
          size={36}
        />
      );
    }

    // Group avatar
    if (avatarUrl) {
      return (
        <AppImage
          source={{ uri: avatarUrl }}
          style={styles.groupAvatarImage}
          debugLabel="ChatHeaderGroupAvatar"
        />
      );
    }

    return (
      <View
        style={[
          styles.groupAvatarPlaceholder,
          { backgroundColor: colors.surfaceVariant },
        ]}
      >
        <MaterialCommunityIcons
          name="account-group"
          size={20}
          color={colors.primary}
        />
      </View>
    );
  };

  return (
    <Appbar.Header
      style={[styles.header, { backgroundColor: colors.background }, style]}
    >
      <Appbar.BackAction onPress={onBack} />

      <TouchableOpacity
        style={styles.titleTouchable}
        onPress={onTitlePress}
        disabled={!onTitlePress}
        activeOpacity={0.7}
      >
        {renderAvatar()}
        <View style={styles.titleTextContainer}>
          <View style={styles.titleRow}>
            {showOnlineIndicator && (
              <PresenceIndicator online={isOnline} size={8} position="inline" />
            )}
            <Text
              style={[styles.titleText, { color: colors.onSurface }]}
              numberOfLines={1}
            >
              {title}
            </Text>
          </View>
          {subtitle != null && subtitle.length > 0 && (
            <Text
              style={[
                styles.subtitleText,
                { color: subtitleColor || colors.onSurfaceVariant },
              ]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          )}
        </View>
      </TouchableOpacity>

      {renderRight?.()}
    </Appbar.Header>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  header: {
    elevation: 0,
    height: 52,
  },
  titleTouchable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 2,
    gap: 8,
  },
  titleTextContainer: {
    flex: 1,
    justifyContent: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  titleText: {
    fontSize: 17,
    fontWeight: "600",
  },
  subtitleText: {
    fontSize: 13,
    marginTop: 1,
  },
  groupAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  groupAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default ChatHeader;
