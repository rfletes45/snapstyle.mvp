/**
 * MuteOptionsSheet Component
 *
 * Bottom sheet for selecting mute duration options:
 * - 1 hour
 * - 8 hours
 * - 1 day
 * - 1 week
 * - Forever (until manually unmuted)
 *
 * @module components/chat/inbox/MuteOptionsSheet
 */

import type { MuteDuration } from "@/hooks/useConversationActions";
import { useAppTheme } from "@/store/ThemeContext";
import { light as hapticLight } from "@/utils/haptics";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useCallback } from "react";
import {
  Modal,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Button, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BorderRadius, Spacing } from "@/constants/theme";

// =============================================================================
// Types
// =============================================================================

export interface MuteOptionsSheetProps {
  /** Whether the sheet is visible */
  visible: boolean;
  /** Callback to close the sheet */
  onClose: () => void;
  /** Called when a duration is selected */
  onSelectDuration: (duration: MuteDuration) => void;
  /** Conversation name to display */
  conversationName: string;
}

// =============================================================================
// Constants
// =============================================================================

interface MuteOption {
  duration: MuteDuration;
  label: string;
  description: string;
  icon: string;
}

const MUTE_OPTIONS: MuteOption[] = [
  {
    duration: "1hour",
    label: "1 hour",
    description: "Mute until you have time",
    icon: "clock-outline",
  },
  {
    duration: "8hours",
    label: "8 hours",
    description: "Mute for the workday",
    icon: "clock-time-eight-outline",
  },
  {
    duration: "1day",
    label: "1 day",
    description: "Mute until tomorrow",
    icon: "calendar-today",
  },
  {
    duration: "1week",
    label: "1 week",
    description: "Mute for a while",
    icon: "calendar-week",
  },
  {
    duration: "forever",
    label: "Until I turn it back on",
    description: "Mute indefinitely",
    icon: "bell-off-outline",
  },
];

// =============================================================================
// Component
// =============================================================================

export const MuteOptionsSheet = memo(function MuteOptionsSheet({
  visible,
  onClose,
  onSelectDuration,
  conversationName,
}: MuteOptionsSheetProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  const handleSelect = useCallback(
    (duration: MuteDuration) => {
      hapticLight();
      onSelectDuration(duration);
      onClose();
    },
    [onSelectDuration, onClose],
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.sheet,
                {
                  backgroundColor: colors.surface,
                  paddingBottom: insets.bottom + Spacing.md,
                },
              ]}
            >
              {/* Handle indicator */}
              <View style={styles.handleContainer}>
                <View
                  style={[styles.handle, { backgroundColor: colors.textMuted }]}
                />
              </View>

              {/* Header */}
              <View style={styles.header}>
                <MaterialCommunityIcons
                  name="bell-off"
                  size={28}
                  color={colors.primary}
                />
                <View style={styles.headerText}>
                  <Text style={[styles.title, { color: colors.text }]}>
                    Mute notifications
                  </Text>
                  <Text
                    style={[styles.subtitle, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {conversationName}
                  </Text>
                </View>
              </View>

              {/* Options */}
              <View style={styles.options}>
                {MUTE_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.duration}
                    style={[styles.option, { borderColor: colors.border }]}
                    onPress={() => handleSelect(option.duration)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons
                      name={option.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                      size={24}
                      color={colors.primary}
                      style={styles.optionIcon}
                    />
                    <View style={styles.optionText}>
                      <Text
                        style={[styles.optionLabel, { color: colors.text }]}
                      >
                        {option.label}
                      </Text>
                      <Text
                        style={[
                          styles.optionDescription,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {option.description}
                      </Text>
                    </View>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={20}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Cancel button */}
              <Button
                mode="outlined"
                onPress={onClose}
                style={styles.cancelButton}
              >
                Cancel
              </Button>
            </View>
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
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.sm,
  },
  handleContainer: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  options: {
    paddingHorizontal: Spacing.md,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
  },
  optionIcon: {
    marginRight: Spacing.md,
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: "500",
  },
  optionDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  cancelButton: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
  },
});
