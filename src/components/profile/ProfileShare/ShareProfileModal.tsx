/**
 * ShareProfileModal Component
 *
 * Modal for sharing a user's profile via various methods:
 * - Native share sheet
 * - Copy link to clipboard
 * - QR code display
 *
 * @module components/profile/ProfileShare/ShareProfileModal
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useCallback, useState } from "react";
import {
  Clipboard,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  ActivityIndicator,
  IconButton,
  Text,
  useTheme,
} from "react-native-paper";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BorderRadius, Spacing } from "@/constants/theme";
import { generateProfileShare } from "@/services/profileService";
import type { ProfileShareData } from "@/types/userProfile";
import * as haptics from "@/utils/haptics";


import { createLogger } from "@/utils/log";
const logger = createLogger("components/profile/ProfileShare/ShareProfileModal");
// =============================================================================
// Types
// =============================================================================

export interface ShareProfileModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** User ID to share */
  userId: string;
  /** Display name of the user (for share message) */
  displayName: string;
  /** Called when modal is closed */
  onClose: () => void;
  /** Called when QR code option is pressed */
  onShowQRCode?: () => void;
}

interface ShareOptionProps {
  icon: string;
  label: string;
  sublabel?: string;
  color?: string;
  onPress: () => void;
  loading?: boolean;
}

// =============================================================================
// Share Option Component
// =============================================================================

function ShareOption({
  icon,
  label,
  sublabel,
  color,
  onPress,
  loading,
}: ShareOptionProps) {
  const theme = useTheme();
  const colors = {
    text: theme.colors.onSurface,
    textSecondary: theme.colors.onSurfaceVariant,
    surfaceVariant: theme.colors.surfaceVariant,
  };

  return (
    <TouchableOpacity
      style={[styles.optionItem, { backgroundColor: colors.surfaceVariant }]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator size={24} color={color || colors.text} />
      ) : (
        <MaterialCommunityIcons
          name={icon as keyof typeof MaterialCommunityIcons.glyphMap}
          size={24}
          color={color || colors.text}
        />
      )}
      <View style={styles.optionTextContainer}>
        <Text style={[styles.optionLabel, { color: colors.text }]}>
          {label}
        </Text>
        {sublabel && (
          <Text
            style={[styles.optionSublabel, { color: colors.textSecondary }]}
          >
            {sublabel}
          </Text>
        )}
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={20}
        color={colors.textSecondary}
      />
    </TouchableOpacity>
  );
}

// =============================================================================
// Main Component
// =============================================================================

function ShareProfileModalBase({
  visible,
  userId,
  displayName,
  onClose,
  onShowQRCode,
}: ShareProfileModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const colors = {
    background: theme.colors.background,
    surface: theme.colors.surface,
    text: theme.colors.onSurface,
    textSecondary: theme.colors.onSurfaceVariant,
    primary: theme.colors.primary,
    surfaceVariant: theme.colors.surfaceVariant,
    success: "#22C55E",
  };

  // State
  const [shareData, setShareData] = useState<ProfileShareData | null>(null);
  const [loadingShare, setLoadingShare] = useState(false);
  const [loadingCopy, setLoadingCopy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load share data when visible
  const loadShareData = useCallback(async () => {
    if (shareData) return shareData;

    setLoadingShare(true);
    try {
      const data = await generateProfileShare(userId);
      setShareData(data);
      return data;
    } catch (error) {
      logger.error("Failed to generate share data:", error);
      return null;
    } finally {
      setLoadingShare(false);
    }
  }, [userId, shareData]);

  // Handle native share
  const handleNativeShare = useCallback(async () => {
    haptics.buttonPress();

    const data = await loadShareData();
    if (!data) return;

    try {
      await Share.share({
        message: `Check out ${data.displayName}'s profile on Vibe! ${data.shareUrl}`,
        url: data.shareUrl,
        title: `${data.displayName}'s Profile`,
      });
    } catch (error: any) {
      if (error.name !== "AbortError") {
        logger.error("Share error:", error);
      }
    }
  }, [loadShareData]);

  // Handle copy link
  const handleCopyLink = useCallback(async () => {
    haptics.buttonPress();
    setLoadingCopy(true);

    try {
      const data = await loadShareData();
      if (!data) return;

      Clipboard.setString(data.shareUrl);
      setCopied(true);
      haptics.success();

      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      logger.error("Copy error:", error);
    } finally {
      setLoadingCopy(false);
    }
  }, [loadShareData]);

  // Handle QR code
  const handleShowQRCode = useCallback(async () => {
    haptics.buttonPress();
    await loadShareData();
    onShowQRCode?.();
  }, [loadShareData, onShowQRCode]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <Animated.View
            entering={FadeInUp.duration(200)}
            style={[
              styles.container,
              {
                backgroundColor: colors.surface,
                paddingBottom: insets.bottom + 16,
              },
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text variant="titleMedium" style={{ color: colors.text }}>
                Share Profile
              </Text>
              <IconButton
                icon="close"
                size={22}
                onPress={onClose}
                iconColor={colors.textSecondary}
              />
            </View>

            {/* Profile Preview */}
            <Animated.View
              entering={FadeIn.delay(100)}
              style={[
                styles.profilePreview,
                { backgroundColor: colors.surfaceVariant },
              ]}
            >
              <MaterialCommunityIcons
                name="account-circle"
                size={48}
                color={colors.primary}
              />
              <View style={styles.previewTextContainer}>
                <Text style={[styles.previewName, { color: colors.text }]}>
                  {displayName}
                </Text>
                <Text
                  style={[styles.previewUrl, { color: colors.textSecondary }]}
                >
                  vibeapp.link/u/...
                </Text>
              </View>
            </Animated.View>

            {/* Share Options */}
            <View style={styles.optionsContainer}>
              <Animated.View entering={FadeInUp.delay(150)}>
                <ShareOption
                  icon="share-variant"
                  label="Share via..."
                  sublabel="Send with your favorite app"
                  onPress={handleNativeShare}
                  loading={loadingShare && !shareData}
                />
              </Animated.View>

              <Animated.View entering={FadeInUp.delay(200)}>
                <ShareOption
                  icon={copied ? "check" : "link"}
                  label={copied ? "Link Copied!" : "Copy Link"}
                  sublabel={
                    copied ? undefined : "Copy profile URL to clipboard"
                  }
                  color={copied ? colors.success : undefined}
                  onPress={handleCopyLink}
                  loading={loadingCopy}
                />
              </Animated.View>

              {onShowQRCode && (
                <Animated.View entering={FadeInUp.delay(250)}>
                  <ShareOption
                    icon="qrcode"
                    label="QR Code"
                    sublabel="Scan to view profile"
                    onPress={handleShowQRCode}
                  />
                </Animated.View>
              )}
            </View>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  container: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  profilePreview: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  previewTextContainer: {
    flex: 1,
  },
  previewName: {
    fontSize: 16,
    fontWeight: "600",
  },
  previewUrl: {
    fontSize: 13,
    marginTop: 2,
  },
  optionsContainer: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: "500",
  },
  optionSublabel: {
    fontSize: 12,
    marginTop: 2,
  },
});

export const ShareProfileModal = memo(ShareProfileModalBase);
export default ShareProfileModal;
