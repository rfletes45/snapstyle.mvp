/**
 * MuteOptionsModal Component
 *
 * Modal for configuring mute settings for a user:
 * - Duration options (1 hour, 24 hours, 1 week, indefinite)
 * - What to mute (notifications, stories, messages in feeds)
 * - Confirmation with clear explanation
 *
 * @module components/profile/ProfileModeration/MuteOptionsModal
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useCallback, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import {
  Button,
  Checkbox,
  Divider,
  RadioButton,
  Text,
  useTheme,
} from "react-native-paper";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BorderRadius, Spacing } from "@/constants/theme";
import * as haptics from "@/utils/haptics";

// =============================================================================
// Types
// =============================================================================

export interface MuteSettings {
  /** Mute duration in milliseconds (null = indefinite) */
  duration: number | null;
  /** What aspects to mute */
  options: {
    notifications: boolean;
    stories: boolean;
    messages: boolean;
  };
}

export interface MuteOptionsModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Username of the user being muted */
  username: string;
  /** Display name of the user being muted */
  displayName: string;
  /** Whether the user is currently muted */
  isCurrentlyMuted: boolean;
  /** Called when mute is confirmed */
  onConfirm: (settings: MuteSettings) => void;
  /** Called when unmute is requested */
  onUnmute: () => void;
  /** Called when modal is closed */
  onClose: () => void;
  /** Whether the action is loading */
  loading?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const DURATION_OPTIONS = [
  { label: "1 hour", value: 60 * 60 * 1000 },
  { label: "8 hours", value: 8 * 60 * 60 * 1000 },
  { label: "24 hours", value: 24 * 60 * 60 * 1000 },
  { label: "1 week", value: 7 * 24 * 60 * 60 * 1000 },
  { label: "Until I unmute", value: null },
] as const;

// =============================================================================
// Component
// =============================================================================

export const MuteOptionsModal = memo(function MuteOptionsModal({
  visible,
  username,
  displayName,
  isCurrentlyMuted,
  onConfirm,
  onUnmute,
  onClose,
  loading = false,
}: MuteOptionsModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const colors = {
    text: theme.colors.onSurface,
    textSecondary: theme.colors.onSurfaceVariant,
    surface: theme.colors.surface,
    surfaceVariant: theme.colors.surfaceVariant,
    primary: theme.colors.primary,
    warning: "#FFA000",
    error: theme.colors.error,
  };

  // State
  const [selectedDuration, setSelectedDuration] = useState<number | null>(
    DURATION_OPTIONS[2].value, // Default to 24 hours
  );
  const [muteOptions, setMuteOptions] = useState({
    notifications: true,
    stories: true,
    messages: false,
  });

  // Handlers
  const handleDurationSelect = useCallback((value: number | null) => {
    haptics.buttonPress();
    setSelectedDuration(value);
  }, []);

  const handleOptionToggle = useCallback((option: keyof typeof muteOptions) => {
    haptics.buttonPress();
    setMuteOptions((prev) => ({
      ...prev,
      [option]: !prev[option],
    }));
  }, []);

  const handleConfirm = useCallback(() => {
    haptics.success();
    onConfirm({
      duration: selectedDuration,
      options: muteOptions,
    });
  }, [selectedDuration, muteOptions, onConfirm]);

  const handleUnmute = useCallback(() => {
    haptics.buttonPress();
    onUnmute();
  }, [onUnmute]);

  const handleClose = useCallback(() => {
    haptics.buttonPress();
    onClose();
  }, [onClose]);

  // Check if at least one option is selected
  const hasSelectedOption =
    muteOptions.notifications || muteOptions.stories || muteOptions.messages;

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View
              entering={FadeInDown.duration(300)}
              style={[
                styles.modal,
                {
                  backgroundColor: colors.surface,
                  paddingBottom: insets.bottom + Spacing.lg,
                },
              ]}
            >
              {/* Header */}
              <View style={styles.header}>
                <MaterialCommunityIcons
                  name="bell-off"
                  size={32}
                  color={colors.warning}
                />
                <Text style={[styles.title, { color: colors.text }]}>
                  {isCurrentlyMuted ? "Mute Settings" : "Mute"} @{username}
                </Text>
                <Text
                  style={[styles.subtitle, { color: colors.textSecondary }]}
                >
                  {isCurrentlyMuted
                    ? `${displayName} is currently muted`
                    : "You'll still be friends, but you'll see less of them"}
                </Text>
              </View>

              <Divider style={styles.divider} />

              {isCurrentlyMuted ? (
                // Show unmute option for currently muted users
                <View style={styles.unmuteSection}>
                  <Text
                    style={[styles.infoText, { color: colors.textSecondary }]}
                  >
                    While muted, you won't receive notifications from{" "}
                    {displayName}. They won't know they're muted.
                  </Text>
                  <Button
                    mode="contained"
                    onPress={handleUnmute}
                    loading={loading}
                    disabled={loading}
                    style={styles.unmuteButton}
                    buttonColor={colors.primary}
                  >
                    Unmute {displayName}
                  </Button>
                </View>
              ) : (
                <ScrollView
                  style={styles.scrollView}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Duration Selection */}
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    How long?
                  </Text>
                  <RadioButton.Group
                    onValueChange={(value) =>
                      handleDurationSelect(
                        value === "null" ? null : parseInt(value),
                      )
                    }
                    value={selectedDuration?.toString() ?? "null"}
                  >
                    {DURATION_OPTIONS.map((option) => (
                      <Animated.View
                        key={option.label}
                        entering={FadeIn.delay(100)}
                      >
                        <TouchableOpacity
                          style={[
                            styles.optionRow,
                            {
                              backgroundColor:
                                selectedDuration === option.value
                                  ? colors.surfaceVariant
                                  : "transparent",
                            },
                          ]}
                          onPress={() => handleDurationSelect(option.value)}
                        >
                          <RadioButton.Android
                            value={option.value?.toString() ?? "null"}
                            color={colors.primary}
                          />
                          <Text
                            style={[styles.optionLabel, { color: colors.text }]}
                          >
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      </Animated.View>
                    ))}
                  </RadioButton.Group>

                  <Divider style={styles.divider} />

                  {/* What to Mute */}
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    What to mute?
                  </Text>

                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => handleOptionToggle("notifications")}
                  >
                    <Checkbox.Android
                      status={
                        muteOptions.notifications ? "checked" : "unchecked"
                      }
                      onPress={() => handleOptionToggle("notifications")}
                      color={colors.primary}
                    />
                    <View style={styles.checkboxContent}>
                      <Text
                        style={[styles.optionLabel, { color: colors.text }]}
                      >
                        Notifications
                      </Text>
                      <Text
                        style={[
                          styles.optionDescription,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Stop push notifications from this user
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => handleOptionToggle("stories")}
                  >
                    <Checkbox.Android
                      status={muteOptions.stories ? "checked" : "unchecked"}
                      onPress={() => handleOptionToggle("stories")}
                      color={colors.primary}
                    />
                    <View style={styles.checkboxContent}>
                      <Text
                        style={[styles.optionLabel, { color: colors.text }]}
                      >
                        Stories
                      </Text>
                      <Text
                        style={[
                          styles.optionDescription,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Hide their stories from your feed
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => handleOptionToggle("messages")}
                  >
                    <Checkbox.Android
                      status={muteOptions.messages ? "checked" : "unchecked"}
                      onPress={() => handleOptionToggle("messages")}
                      color={colors.primary}
                    />
                    <View style={styles.checkboxContent}>
                      <Text
                        style={[styles.optionLabel, { color: colors.text }]}
                      >
                        Message Previews
                      </Text>
                      <Text
                        style={[
                          styles.optionDescription,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Hide message previews in notifications
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Info note */}
                  <View
                    style={[
                      styles.infoBox,
                      { backgroundColor: colors.surfaceVariant },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="information-outline"
                      size={20}
                      color={colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.infoBoxText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {displayName} won't be notified that you've muted them.
                      You'll stay friends and can still message each other.
                    </Text>
                  </View>
                </ScrollView>
              )}

              {/* Actions */}
              {!isCurrentlyMuted && (
                <View style={styles.actions}>
                  <Button
                    mode="outlined"
                    onPress={handleClose}
                    style={styles.actionButton}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button
                    mode="contained"
                    onPress={handleConfirm}
                    style={styles.actionButton}
                    disabled={loading || !hasSelectedOption}
                    loading={loading}
                    buttonColor={colors.warning}
                    textColor="#000"
                  >
                    Mute
                  </Button>
                </View>
              )}
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modal: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: "80%",
  },
  header: {
    alignItems: "center",
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: Spacing.sm,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    marginTop: Spacing.xs,
    textAlign: "center",
  },
  divider: {
    marginVertical: Spacing.md,
  },
  scrollView: {
    paddingHorizontal: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: 2,
  },
  optionLabel: {
    fontSize: 16,
    marginLeft: Spacing.xs,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: Spacing.sm,
  },
  checkboxContent: {
    flex: 1,
    marginLeft: Spacing.xs,
  },
  optionDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  infoBox: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  unmuteSection: {
    padding: Spacing.lg,
    alignItems: "center",
  },
  infoText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  unmuteButton: {
    minWidth: 200,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  actionButton: {
    minWidth: 100,
  },
});

export default MuteOptionsModal;
