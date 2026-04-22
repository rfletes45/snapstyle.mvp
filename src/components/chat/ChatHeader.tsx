/**
 * ChatHeader — Shared custom header for DM and Group chat screens.
 *
 * Shared Paper-based header used by both DM and group chat screens so the
 * platform has one consistent top-level scaffold for navigation, identity,
 * presence/member metadata, and right-side actions.
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
import { buildRemoteImageSource } from "@/utils/remoteImageSource";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import {
    Platform,
    StyleSheet,
    TouchableOpacity,
    View,
    ViewStyle,
} from "react-native";
import { Appbar, Text, useTheme } from "react-native-paper";

const HEADER_LAYOUT = {
  height: 46,
  backButtonSize: 34,
  backButtonRadius: 17,
  backButtonMarginLeft: 8,
  backIconSize: 33,
  avatarSize: 36,
  titleStartSpacing: 14,
  identityGap: 14,
  titleFontSize: 22,
  subtitleFontSize: 13,
} as const;

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
          size={HEADER_LAYOUT.avatarSize}
        />
      );
    }

    // Group avatar
    if (avatarUrl) {
      return (
        <AppImage
          source={buildRemoteImageSource(avatarUrl)}
          style={styles.groupAvatarImage}
          transition={0}
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
      {/* Custom back button with optical centering */}
      <TouchableOpacity
        onPress={onBack}
        style={[styles.backButton, { backgroundColor: colors.surfaceVariant }]}
        activeOpacity={0.6}
        accessibilityLabel="Back"
        accessibilityRole="button"
        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
      >
        <MaterialCommunityIcons
          name={Platform.OS === "ios" ? "chevron-left" : "arrow-left"}
          size={HEADER_LAYOUT.backIconSize}
          color={colors.onSurface}
          style={Platform.OS === "ios" ? styles.backIconiOS : undefined}
        />
      </TouchableOpacity>

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
          {chatType !== "group" && subtitle != null && subtitle.length > 0 && (
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
    height: HEADER_LAYOUT.height,
  },
  backButton: {
    width: HEADER_LAYOUT.backButtonSize,
    height: HEADER_LAYOUT.backButtonSize,
    borderRadius: HEADER_LAYOUT.backButtonRadius,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: HEADER_LAYOUT.backButtonMarginLeft,
  },
  backIconiOS: {
    // Optical centering: iOS chevron-left glyph is visually heavy on the left
    marginLeft: -1,
  },
  titleTouchable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginLeft: HEADER_LAYOUT.titleStartSpacing,
    gap: HEADER_LAYOUT.identityGap,
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
    fontSize: HEADER_LAYOUT.titleFontSize,
    fontWeight: "600",
  },
  subtitleText: {
    fontSize: HEADER_LAYOUT.subtitleFontSize,
    marginTop: 1,
  },
  groupAvatarImage: {
    width: HEADER_LAYOUT.avatarSize,
    height: HEADER_LAYOUT.avatarSize,
    borderRadius: HEADER_LAYOUT.avatarSize / 2,
  },
  groupAvatarPlaceholder: {
    width: HEADER_LAYOUT.avatarSize,
    height: HEADER_LAYOUT.avatarSize,
    borderRadius: HEADER_LAYOUT.avatarSize / 2,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default ChatHeader;
