/**
 * StatusPicker Component
 *
 * Modal for setting user's status/mood.
 * Features mood selection, custom text, and expiry time options.
 *
 * @module components/profile/Status/StatusPicker
 */

import React, { memo, useCallback, useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Button, Chip, IconButton, Text, useTheme } from "react-native-paper";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BorderRadius, Spacing } from "@/constants/theme";
import type { MoodType, ProfileStatus } from "@/types/userProfile";
import { MOOD_CONFIG } from "@/types/userProfile";

// =============================================================================
// Types
// =============================================================================

export interface StatusPickerProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Current status (if editing) */
  currentStatus?: ProfileStatus | null;
  /** Called when status is saved */
  onSave: (text: string, mood: MoodType, expiresIn?: number) => Promise<void>;
  /** Called when status is cleared */
  onClear: () => Promise<void>;
  /** Called when modal is closed */
  onClose: () => void;
  /** Whether save is in progress */
  saving?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const EXPIRY_OPTIONS = [
  { label: "Don't clear", value: undefined },
  { label: "30 min", value: 30 * 60 * 1000 },
  { label: "1 hour", value: 60 * 60 * 1000 },
  { label: "4 hours", value: 4 * 60 * 60 * 1000 },
  { label: "Today", value: 24 * 60 * 60 * 1000 },
  { label: "This week", value: 7 * 24 * 60 * 60 * 1000 },
] as const;

const MOOD_ORDER: MoodType[] = [
  "happy",
  "excited",
  "chill",
  "busy",
  "gaming",
  "studying",
  "away",
  "sleeping",
  "custom",
];

const MAX_STATUS_LENGTH = 50;

// =============================================================================
// Component
// =============================================================================

function StatusPickerBase({
  visible,
  currentStatus,
  onSave,
  onClear,
  onClose,
  saving = false,
}: StatusPickerProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const colors = {
    background: theme.colors.background,
    surface: theme.colors.surface,
    surfaceVariant: theme.colors.surfaceVariant,
    text: theme.colors.onSurface,
    textSecondary: theme.colors.onSurfaceVariant,
    primary: theme.colors.primary,
    outline: theme.colors.outline,
    error: theme.colors.error,
  };

  // State
  const [selectedMood, setSelectedMood] = useState<MoodType>(
    currentStatus?.mood || "happy",
  );
  const [statusText, setStatusText] = useState(currentStatus?.text || "");
  const [selectedExpiry, setSelectedExpiry] = useState<number | undefined>(
    undefined,
  );
  const [isClearing, setIsClearing] = useState(false);

  // Reset when opening
  useEffect(() => {
    if (visible) {
      setSelectedMood(currentStatus?.mood || "happy");
      setStatusText(currentStatus?.text || "");
      setSelectedExpiry(undefined);
    }
  }, [visible, currentStatus]);

  // Handlers
  const handleMoodSelect = useCallback((mood: MoodType) => {
    setSelectedMood(mood);
  }, []);

  const handleSave = useCallback(async () => {
    await onSave(statusText, selectedMood, selectedExpiry);
  }, [statusText, selectedMood, selectedExpiry, onSave]);

  const handleClear = useCallback(async () => {
    setIsClearing(true);
    try {
      await onClear();
    } finally {
      setIsClearing(false);
    }
  }, [onClear]);

  const moodConfig = MOOD_CONFIG[selectedMood];

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
                paddingBottom: insets.bottom + 16,
              },
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text variant="titleLarge" style={{ color: colors.text }}>
                Set Your Status
              </Text>
              <IconButton
                icon="close"
                size={24}
                onPress={onClose}
                iconColor={colors.textSecondary}
              />
            </View>

            <ScrollView
              style={styles.content}
              showsVerticalScrollIndicator={false}
            >
              {/* Selected Mood Preview */}
              <Animated.View
                entering={FadeIn.delay(100)}
                style={[
                  styles.previewCard,
                  { backgroundColor: colors.surfaceVariant },
                ]}
              >
                <Text style={[styles.previewEmoji]}>{moodConfig.emoji}</Text>
                <View style={styles.previewTextContainer}>
                  <Text
                    style={[styles.previewMood, { color: moodConfig.color }]}
                  >
                    {moodConfig.label}
                  </Text>
                  {statusText ? (
                    <Text
                      style={[styles.previewStatus, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {statusText}
                    </Text>
                  ) : (
                    <Text
                      style={[
                        styles.previewStatus,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Add a status message...
                    </Text>
                  )}
                </View>
              </Animated.View>

              {/* Mood Selection */}
              <Text
                style={[styles.sectionTitle, { color: colors.textSecondary }]}
              >
                How are you feeling?
              </Text>
              <View style={styles.moodGrid}>
                {MOOD_ORDER.map((mood, index) => {
                  const config = MOOD_CONFIG[mood];
                  const isSelected = mood === selectedMood;
                  return (
                    <Animated.View
                      key={mood}
                      entering={FadeIn.delay(index * 30)}
                    >
                      <Pressable
                        onPress={() => handleMoodSelect(mood)}
                        style={[
                          styles.moodItem,
                          {
                            backgroundColor: isSelected
                              ? config.color + "30"
                              : colors.surfaceVariant,
                            borderColor: isSelected
                              ? config.color
                              : "transparent",
                          },
                        ]}
                      >
                        <Text style={styles.moodEmoji}>{config.emoji}</Text>
                        <Text
                          style={[
                            styles.moodLabel,
                            {
                              color: isSelected ? config.color : colors.text,
                              fontWeight: isSelected ? "600" : "400",
                            },
                          ]}
                        >
                          {config.label}
                        </Text>
                      </Pressable>
                    </Animated.View>
                  );
                })}
              </View>

              {/* Status Text Input */}
              <Text
                style={[styles.sectionTitle, { color: colors.textSecondary }]}
              >
                What's on your mind? (optional)
              </Text>
              <View
                style={[styles.inputContainer, { borderColor: colors.outline }]}
              >
                <TextInput
                  style={[styles.textInput, { color: colors.text }]}
                  placeholder="Add a status message..."
                  placeholderTextColor={colors.textSecondary}
                  value={statusText}
                  onChangeText={setStatusText}
                  maxLength={MAX_STATUS_LENGTH}
                  multiline
                  numberOfLines={2}
                />
                <Text
                  style={[
                    styles.charCount,
                    {
                      color:
                        statusText.length > MAX_STATUS_LENGTH - 10
                          ? colors.error
                          : colors.textSecondary,
                    },
                  ]}
                >
                  {statusText.length}/{MAX_STATUS_LENGTH}
                </Text>
              </View>

              {/* Expiry Selection */}
              <Text
                style={[styles.sectionTitle, { color: colors.textSecondary }]}
              >
                Clear status after
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.expiryScroll}
              >
                {EXPIRY_OPTIONS.map((option) => {
                  const isSelected = option.value === selectedExpiry;
                  return (
                    <Chip
                      key={option.label}
                      mode={isSelected ? "flat" : "outlined"}
                      selected={isSelected}
                      onPress={() => setSelectedExpiry(option.value)}
                      style={[
                        styles.expiryChip,
                        isSelected && {
                          backgroundColor: colors.primary + "20",
                        },
                      ]}
                      textStyle={{
                        color: isSelected ? colors.primary : colors.text,
                      }}
                    >
                      {option.label}
                    </Chip>
                  );
                })}
              </ScrollView>
            </ScrollView>

            {/* Actions */}
            <View style={styles.actions}>
              {currentStatus && (
                <Button
                  mode="outlined"
                  onPress={handleClear}
                  loading={isClearing}
                  disabled={saving || isClearing}
                  style={styles.clearButton}
                  icon="close-circle"
                >
                  Clear Status
                </Button>
              )}
              <Button
                mode="contained"
                onPress={handleSave}
                loading={saving}
                disabled={saving || isClearing}
                style={styles.saveButton}
                icon="check"
              >
                Save Status
              </Button>
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
    maxWidth: 400,
    maxHeight: "90%",
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  previewCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  previewEmoji: {
    fontSize: 40,
  },
  previewTextContainer: {
    flex: 1,
  },
  previewMood: {
    fontSize: 16,
    fontWeight: "600",
  },
  previewStatus: {
    fontSize: 14,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  moodGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  moodItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    gap: 6,
  },
  moodEmoji: {
    fontSize: 18,
  },
  moodLabel: {
    fontSize: 13,
  },
  inputContainer: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
  },
  textInput: {
    fontSize: 15,
    minHeight: 48,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 11,
    textAlign: "right",
    marginTop: 4,
  },
  expiryScroll: {
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  expiryChip: {
    marginRight: Spacing.sm,
  },
  actions: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  clearButton: {
    flex: 1,
  },
  saveButton: {
    flex: 1,
  },
});

export const StatusPicker = memo(StatusPickerBase);
export default StatusPicker;
