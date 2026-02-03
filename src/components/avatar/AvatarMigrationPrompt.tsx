/**
 * Avatar Migration Prompt Modal
 *
 * Modal component that prompts users to migrate from legacy avatars
 * to the new digital avatar system.
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md - Phase 8
 */

import { LightColors } from "@/constants/theme";
import { trackAvatarMigration } from "@/services/avatarAnalytics";
import {
  dismissMigrationPrompt,
  getMigrationPromptConfig,
  markWarningShown,
  shouldShowMigrationPrompt,
  type MigrationPromptConfig,
} from "@/services/avatarDeprecation";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

// Use a simple theme reference for styles (components using this should use hooks for dynamic theming)
const theme = {
  colors: {
    primary: LightColors.primary,
    background: LightColors.background,
    surface: LightColors.surface,
    text: LightColors.text,
  },
};

// =============================================================================
// TYPES
// =============================================================================

interface AvatarMigrationPromptProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Callback when user chooses to migrate */
  onMigrate: () => void;
  /** Callback when user dismisses the prompt */
  onDismiss: () => void;
  /** Callback when migration is complete */
  onComplete?: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function AvatarMigrationPrompt({
  visible,
  onMigrate,
  onDismiss,
  onComplete,
}: AvatarMigrationPromptProps): React.ReactElement | null {
  const [config, setConfig] = useState<MigrationPromptConfig | null>(null);
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load configuration
  useEffect(() => {
    if (visible) {
      getMigrationPromptConfig().then(setConfig);
      markWarningShown();
    }
  }, [visible]);

  const handleMigrate = async () => {
    setIsLoading(true);
    trackAvatarMigration("started", {
      urgency: config?.urgency,
    });
    onMigrate();
  };

  const handleDismiss = async () => {
    await dismissMigrationPrompt(dontAskAgain);
    onDismiss();
  };

  if (!config) return null;

  const urgencyColors = {
    low: theme.colors.primary,
    medium: "#F59E0B", // Amber
    high: "#EF4444", // Red
  };

  const urgencyIcons: Record<
    string,
    "alert" | "alert-circle-outline" | "star-face"
  > = {
    low: "star-face",
    medium: "alert-circle-outline",
    high: "alert",
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header Icon */}
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: urgencyColors[config.urgency] + "20" },
            ]}
          >
            <MaterialCommunityIcons
              name={urgencyIcons[config.urgency]}
              size={40}
              color={urgencyColors[config.urgency]}
            />
          </View>

          {/* Title */}
          <Text style={styles.title}>{config.title}</Text>

          {/* Message */}
          <Text style={styles.message}>{config.message}</Text>

          {/* Avatar Preview (placeholder) */}
          <View style={styles.previewContainer}>
            <View style={styles.oldAvatar}>
              <MaterialCommunityIcons
                name="account-circle"
                size={60}
                color={theme.colors.text + "60"}
              />
              <Text style={styles.previewLabel}>Current</Text>
            </View>
            <MaterialCommunityIcons
              name="arrow-right"
              size={24}
              color={theme.colors.text + "40"}
            />
            <View style={styles.newAvatar}>
              <MaterialCommunityIcons
                name="account-star"
                size={60}
                color={theme.colors.primary}
              />
              <Text style={styles.previewLabel}>New</Text>
            </View>
          </View>

          {/* Don't Ask Again Checkbox */}
          {config.showDontAskAgain && (
            <Pressable
              style={styles.checkboxRow}
              onPress={() => setDontAskAgain(!dontAskAgain)}
            >
              <View
                style={[
                  styles.checkbox,
                  dontAskAgain && styles.checkboxChecked,
                ]}
              >
                {dontAskAgain && (
                  <MaterialCommunityIcons name="check" size={14} color="#fff" />
                )}
              </View>
              <Text style={styles.checkboxLabel}>Don't ask me again</Text>
            </Pressable>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              style={[
                styles.button,
                styles.primaryButton,
                { backgroundColor: urgencyColors[config.urgency] },
              ]}
              onPress={handleMigrate}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {config.primaryAction}
                </Text>
              )}
            </Pressable>

            <Pressable
              style={[styles.button, styles.secondaryButton]}
              onPress={handleDismiss}
              disabled={isLoading}
            >
              <Text style={styles.secondaryButtonText}>
                {config.secondaryAction}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// =============================================================================
// HOOK FOR SHOWING MIGRATION PROMPT
// =============================================================================

export interface UseMigrationPromptReturn {
  /** Whether to show the prompt */
  shouldShow: boolean;
  /** Show the prompt */
  show: () => void;
  /** Hide the prompt */
  hide: () => void;
  /** Whether prompt is currently visible */
  isVisible: boolean;
}

export function useMigrationPrompt(): UseMigrationPromptReturn {
  const [shouldShow, setShouldShow] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    shouldShowMigrationPrompt().then(setShouldShow);
  }, []);

  return {
    shouldShow,
    show: () => setIsVisible(true),
    hide: () => setIsVisible(false),
    isVisible,
  };
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  container: {
    backgroundColor: theme.colors.background,
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.text,
    textAlign: "center",
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    color: theme.colors.text + "CC",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  previewContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginBottom: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    width: "100%",
  },
  oldAvatar: {
    alignItems: "center",
    opacity: 0.6,
  },
  newAvatar: {
    alignItems: "center",
  },
  previewLabel: {
    fontSize: 12,
    color: theme.colors.text + "80",
    marginTop: 4,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    alignSelf: "flex-start",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: theme.colors.text + "40",
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  checkboxLabel: {
    fontSize: 14,
    color: theme.colors.text + "80",
  },
  actions: {
    width: "100%",
    gap: 12,
  },
  button: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: "transparent",
  },
  secondaryButtonText: {
    color: theme.colors.text + "80",
    fontSize: 15,
  },
});

export default AvatarMigrationPrompt;
