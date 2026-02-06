/**
 * ShareProfileButton Component
 *
 * Button that triggers profile share options.
 * Supports multiple variants for different contexts.
 *
 * @module components/profile/ProfileShare/ShareProfileButton
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useCallback, useState } from "react";
import { StyleSheet, TouchableOpacity, View, ViewStyle } from "react-native";
import { IconButton, Text, useTheme } from "react-native-paper";

import { BorderRadius, Spacing } from "@/constants/theme";
import * as haptics from "@/utils/haptics";

import { QRCodeModal } from "./QRCodeModal";
import { ShareProfileModal } from "./ShareProfileModal";

// =============================================================================
// Types
// =============================================================================

export interface ShareProfileButtonProps {
  /** User ID to share */
  userId: string;
  /** Display name of the user */
  displayName: string;
  /** Username of the user */
  username: string;
  /** Button variant */
  variant?: "icon" | "text" | "full";
  /** Custom container style */
  style?: ViewStyle;
  /** Disabled state */
  disabled?: boolean;
}

// =============================================================================
// Component
// =============================================================================

function ShareProfileButtonBase({
  userId,
  displayName,
  username,
  variant = "icon",
  style,
  disabled = false,
}: ShareProfileButtonProps) {
  const theme = useTheme();

  const colors = {
    text: theme.colors.onSurface,
    textSecondary: theme.colors.onSurfaceVariant,
    primary: theme.colors.primary,
    surfaceVariant: theme.colors.surfaceVariant,
  };

  // State
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [qrModalVisible, setQRModalVisible] = useState(false);

  // Handlers
  const handlePress = useCallback(() => {
    if (disabled) return;
    haptics.buttonPress();
    setShareModalVisible(true);
  }, [disabled]);

  const handleShowQRCode = useCallback(() => {
    setShareModalVisible(false);
    setTimeout(() => setQRModalVisible(true), 200);
  }, []);

  // Render based on variant
  const renderButton = () => {
    switch (variant) {
      case "icon":
        return (
          <IconButton
            icon="share-variant"
            size={22}
            onPress={handlePress}
            disabled={disabled}
            iconColor={colors.text}
          />
        );

      case "text":
        return (
          <TouchableOpacity
            onPress={handlePress}
            disabled={disabled}
            activeOpacity={0.7}
            style={[styles.textButton, style]}
          >
            <MaterialCommunityIcons
              name="share-variant"
              size={18}
              color={colors.primary}
            />
            <Text style={[styles.textButtonLabel, { color: colors.primary }]}>
              Share
            </Text>
          </TouchableOpacity>
        );

      case "full":
        return (
          <TouchableOpacity
            onPress={handlePress}
            disabled={disabled}
            activeOpacity={0.7}
            style={[
              styles.fullButton,
              { backgroundColor: colors.surfaceVariant },
              disabled && styles.disabled,
              style,
            ]}
          >
            <MaterialCommunityIcons
              name="share-variant"
              size={20}
              color={disabled ? colors.textSecondary : colors.primary}
            />
            <Text
              style={[
                styles.fullButtonLabel,
                { color: disabled ? colors.textSecondary : colors.text },
              ]}
            >
              Share Profile
            </Text>
          </TouchableOpacity>
        );

      default:
        return null;
    }
  };

  return (
    <View>
      {renderButton()}

      {/* Share Modal */}
      <ShareProfileModal
        visible={shareModalVisible}
        userId={userId}
        displayName={displayName}
        onClose={() => setShareModalVisible(false)}
        onShowQRCode={handleShowQRCode}
      />

      {/* QR Code Modal */}
      <QRCodeModal
        visible={qrModalVisible}
        userId={userId}
        displayName={displayName}
        username={username}
        onClose={() => setQRModalVisible(false)}
      />
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  textButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  textButtonLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  fullButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  fullButtonLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  disabled: {
    opacity: 0.5,
  },
});

export const ShareProfileButton = memo(ShareProfileButtonBase);
export default ShareProfileButton;
