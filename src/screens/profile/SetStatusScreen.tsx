/**
 * SetStatusScreen
 *
 * Full-screen version of the status picker for setting user status/mood.
 * Provides more space and features than the modal version.
 *
 * @module screens/profile/SetStatusScreen
 */

import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Button, Chip, IconButton, Text, useTheme } from "react-native-paper";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BorderRadius, Spacing } from "@/constants/theme";
import { useFullProfileData } from "@/hooks/useFullProfileData";
import { clearStatus, setStatus } from "@/services/profileService";
import { useAuth } from "@/store/AuthContext";
import type { MoodType } from "@/types/userProfile";
import { MOOD_CONFIG } from "@/types/userProfile";
import * as haptics from "@/utils/haptics";

// =============================================================================
// Types
// =============================================================================

type SetStatusScreenProps = NativeStackScreenProps<any, "SetStatus">;

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

export default function SetStatusScreen({ navigation }: SetStatusScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { currentFirebaseUser } = useAuth();
  const userId = currentFirebaseUser?.uid;

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

  // Get current status
  const { profile, refresh } = useFullProfileData({ userId: userId || "" });
  const currentStatus = profile?.status;

  // State
  const [selectedMood, setSelectedMood] = useState<MoodType>(
    currentStatus?.mood || "happy",
  );
  const [statusText, setStatusText] = useState(currentStatus?.text || "");
  const [selectedExpiry, setSelectedExpiry] = useState<number | undefined>(
    undefined,
  );
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Handlers
  const handleMoodSelect = useCallback((mood: MoodType) => {
    haptics.selection();
    setSelectedMood(mood);
  }, []);

  const handleSave = useCallback(async () => {
    if (!userId) return;

    setSaving(true);
    haptics.buttonPress();

    try {
      await setStatus(userId, statusText, selectedMood, selectedExpiry);
      await refresh();
      haptics.success();
      navigation.goBack();
    } catch (error) {
      console.error("Failed to save status:", error);
      haptics.error();
    } finally {
      setSaving(false);
    }
  }, [userId, statusText, selectedMood, selectedExpiry, refresh, navigation]);

  const handleClear = useCallback(async () => {
    if (!userId) return;

    setClearing(true);
    haptics.buttonPress();

    try {
      await clearStatus(userId);
      await refresh();
      haptics.success();
      navigation.goBack();
    } catch (error) {
      console.error("Failed to clear status:", error);
      haptics.error();
    } finally {
      setClearing(false);
    }
  }, [userId, refresh, navigation]);

  const moodConfig = MOOD_CONFIG[selectedMood];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <IconButton
          icon="close"
          onPress={() => navigation.goBack()}
          iconColor={colors.text}
        />
        <Text variant="titleMedium" style={{ color: colors.text }}>
          Set Status
        </Text>
        <Button
          mode="text"
          onPress={handleSave}
          loading={saving}
          disabled={saving || clearing}
        >
          Save
        </Button>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Preview */}
        <Animated.View
          entering={FadeIn.delay(100)}
          style={[
            styles.previewCard,
            { backgroundColor: colors.surfaceVariant },
          ]}
        >
          <Text style={styles.previewEmoji}>{moodConfig.emoji}</Text>
          <View style={styles.previewTextContainer}>
            <Text style={[styles.previewMood, { color: moodConfig.color }]}>
              {moodConfig.label}
            </Text>
            {statusText ? (
              <Text
                style={[styles.previewStatus, { color: colors.text }]}
                numberOfLines={2}
              >
                {statusText}
              </Text>
            ) : (
              <Text
                style={[styles.previewStatus, { color: colors.textSecondary }]}
              >
                Add a status message...
              </Text>
            )}
          </View>
        </Animated.View>

        {/* Mood Selection */}
        <Animated.View entering={FadeInUp.delay(150)}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            How are you feeling?
          </Text>
          <View style={styles.moodGrid}>
            {MOOD_ORDER.map((mood) => {
              const config = MOOD_CONFIG[mood];
              const isSelected = mood === selectedMood;
              return (
                <Chip
                  key={mood}
                  mode={isSelected ? "flat" : "outlined"}
                  selected={isSelected}
                  onPress={() => handleMoodSelect(mood)}
                  style={[
                    styles.moodChip,
                    isSelected && { backgroundColor: config.color + "20" },
                  ]}
                  textStyle={{
                    color: isSelected ? config.color : colors.text,
                    fontWeight: isSelected ? "600" : "400",
                  }}
                  icon={() => (
                    <Text style={styles.moodChipEmoji}>{config.emoji}</Text>
                  )}
                >
                  {config.label}
                </Chip>
              );
            })}
          </View>
        </Animated.View>

        {/* Status Text */}
        <Animated.View entering={FadeInUp.delay(200)}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            What's on your mind?
          </Text>
          <View
            style={[styles.inputContainer, { borderColor: colors.outline }]}
          >
            <TextInput
              style={[styles.textInput, { color: colors.text }]}
              placeholder="Add a status message (optional)"
              placeholderTextColor={colors.textSecondary}
              value={statusText}
              onChangeText={setStatusText}
              maxLength={MAX_STATUS_LENGTH}
              multiline
              numberOfLines={3}
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
        </Animated.View>

        {/* Expiry Selection */}
        <Animated.View entering={FadeInUp.delay(250)}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
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
                    isSelected && { backgroundColor: colors.primary + "20" },
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
        </Animated.View>

        {/* Clear Button */}
        {currentStatus && (
          <Animated.View
            entering={FadeInUp.delay(300)}
            style={styles.clearSection}
          >
            <Button
              mode="outlined"
              onPress={handleClear}
              loading={clearing}
              disabled={saving || clearing}
              icon="close-circle"
              textColor={colors.error}
              style={styles.clearButton}
            >
              Clear Current Status
            </Button>
          </Animated.View>
        )}
      </ScrollView>

      {/* Bottom Action */}
      <View
        style={[
          styles.bottomAction,
          {
            backgroundColor: colors.background,
            paddingBottom: insets.bottom + Spacing.md,
          },
        ]}
      >
        <Button
          mode="contained"
          onPress={handleSave}
          loading={saving}
          disabled={saving || clearing}
          style={styles.saveButton}
        >
          Save Status
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.xs,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 100,
  },
  previewCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
    gap: Spacing.md,
  },
  previewEmoji: {
    fontSize: 48,
  },
  previewTextContainer: {
    flex: 1,
  },
  previewMood: {
    fontSize: 18,
    fontWeight: "700",
  },
  previewStatus: {
    fontSize: 15,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  moodGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  moodChip: {
    marginBottom: 4,
  },
  moodChipEmoji: {
    fontSize: 16,
  },
  inputContainer: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  textInput: {
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 11,
    textAlign: "right",
    marginTop: Spacing.sm,
  },
  expiryScroll: {
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  expiryChip: {
    marginRight: Spacing.sm,
  },
  clearSection: {
    marginTop: Spacing.xl,
    alignItems: "center",
  },
  clearButton: {
    borderColor: "transparent",
  },
  bottomAction: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  saveButton: {
    borderRadius: BorderRadius.md,
  },
});
