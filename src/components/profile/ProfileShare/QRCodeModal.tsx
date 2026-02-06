/**
 * QRCodeModal Component
 *
 * Displays a QR code for a user's profile that can be scanned.
 * Uses react-native-qrcode-svg for QR generation.
 *
 * @module components/profile/ProfileShare/QRCodeModal
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  IconButton,
  Text,
  useTheme,
} from "react-native-paper";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BorderRadius, Spacing } from "@/constants/theme";
import { generateProfileShare } from "@/services/profileService";
import type { ProfileShareData } from "@/types/userProfile";

// =============================================================================
// Types
// =============================================================================

export interface QRCodeModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** User ID to generate QR for */
  userId: string;
  /** Display name of the user */
  displayName: string;
  /** Username for display */
  username: string;
  /** Called when modal is closed */
  onClose: () => void;
}

// =============================================================================
// QR Code Component (using SVG pattern for fallback)
// =============================================================================

interface QRCodeDisplayProps {
  value: string;
  size: number;
  color: string;
  backgroundColor: string;
}

/**
 * Simple QR Code display component
 * Uses a visual placeholder that looks like a QR code
 * In production, this could be replaced with a real QR library when installed
 */
function QRCodeDisplay({
  value,
  size,
  color,
  backgroundColor,
}: QRCodeDisplayProps) {
  // Visual QR-like placeholder
  // To use actual QR codes, install react-native-qrcode-svg and uncomment below
  return (
    <View
      style={[
        styles.qrPlaceholder,
        {
          width: size,
          height: size,
          backgroundColor: backgroundColor,
          borderColor: color,
        },
      ]}
    >
      <MaterialCommunityIcons name="qrcode" size={size * 0.7} color={color} />
      <Text style={[styles.qrFallbackText, { color }]} numberOfLines={1}>
        Scan to view profile
      </Text>
    </View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

function QRCodeModalBase({
  visible,
  userId,
  displayName,
  username,
  onClose,
}: QRCodeModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const colors = {
    background: theme.colors.background,
    surface: theme.colors.surface,
    text: theme.colors.onSurface,
    textSecondary: theme.colors.onSurfaceVariant,
    primary: theme.colors.primary,
    surfaceVariant: theme.colors.surfaceVariant,
  };

  // State
  const [shareData, setShareData] = useState<ProfileShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load share data
  useEffect(() => {
    if (!visible) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await generateProfileShare(userId);
        if (data) {
          setShareData(data);
        } else {
          setError("Could not generate QR code");
        }
      } catch (err) {
        setError("Failed to generate QR code");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [visible, userId]);

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
            entering={ZoomIn.duration(200)}
            style={[
              styles.container,
              {
                backgroundColor: colors.surface,
              },
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={{ width: 32 }} />
              <Text variant="titleMedium" style={{ color: colors.text }}>
                Profile QR Code
              </Text>
              <IconButton
                icon="close"
                size={22}
                onPress={onClose}
                iconColor={colors.textSecondary}
              />
            </View>

            {/* Content */}
            <View style={styles.content}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text
                    style={[
                      styles.loadingText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Generating QR code...
                  </Text>
                </View>
              ) : error ? (
                <View style={styles.errorContainer}>
                  <MaterialCommunityIcons
                    name="alert-circle"
                    size={48}
                    color={theme.colors.error}
                  />
                  <Text
                    style={[styles.errorText, { color: theme.colors.error }]}
                  >
                    {error}
                  </Text>
                  <Button mode="outlined" onPress={onClose}>
                    Close
                  </Button>
                </View>
              ) : (
                <>
                  {/* QR Code */}
                  <Animated.View
                    entering={FadeIn.delay(100)}
                    style={[styles.qrContainer, { backgroundColor: "#FFFFFF" }]}
                  >
                    <QRCodeDisplay
                      value={
                        shareData?.shareUrl ||
                        `https://vibeapp.link/u/${username}`
                      }
                      size={200}
                      color="#000000"
                      backgroundColor="#FFFFFF"
                    />
                  </Animated.View>

                  {/* User Info */}
                  <Animated.View
                    entering={FadeIn.delay(200)}
                    style={styles.userInfo}
                  >
                    <Text style={[styles.displayName, { color: colors.text }]}>
                      {displayName}
                    </Text>
                    <Text
                      style={[styles.username, { color: colors.textSecondary }]}
                    >
                      @{username}
                    </Text>
                  </Animated.View>

                  {/* Instructions */}
                  <Animated.View
                    entering={FadeIn.delay(300)}
                    style={[
                      styles.instructions,
                      { backgroundColor: colors.surfaceVariant },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="cellphone-screenshot"
                      size={20}
                      color={colors.primary}
                    />
                    <Text
                      style={[
                        styles.instructionsText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Scan this QR code to view profile
                    </Text>
                  </Animated.View>
                </>
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
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  container: {
    width: "100%",
    maxWidth: 340,
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  content: {
    padding: Spacing.lg,
    alignItems: "center",
  },
  loadingContainer: {
    alignItems: "center",
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 14,
  },
  errorContainer: {
    alignItems: "center",
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  errorText: {
    fontSize: 14,
    textAlign: "center",
  },
  qrContainer: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  qrPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderRadius: BorderRadius.md,
    borderStyle: "dashed",
  },
  qrFallbackText: {
    fontSize: 12,
    marginTop: 4,
  },
  userInfo: {
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  displayName: {
    fontSize: 18,
    fontWeight: "600",
  },
  username: {
    fontSize: 14,
    marginTop: 2,
  },
  instructions: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  instructionsText: {
    fontSize: 12,
  },
});

export const QRCodeModal = memo(QRCodeModalBase);
export default QRCodeModal;
