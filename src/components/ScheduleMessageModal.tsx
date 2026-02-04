/**
 * ScheduleMessageModal
 *
 * Features:
 * - Quick presets (1 hour, tomorrow morning, tomorrow evening)
 * - Custom date/time selection
 * - Preview of when message will be sent
 */

import { formatScheduledTime } from "@/services/scheduledMessages";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Button,
  IconButton,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { useColors } from "../store/ThemeContext";

// =============================================================================
// Types
// =============================================================================

interface ScheduleMessageModalProps {
  visible: boolean;
  onClose: () => void;
  onSchedule: (scheduledFor: Date) => void;
  messagePreview: string;
}

interface QuickOption {
  label: string;
  icon: string;
  getDate: () => Date;
}

// =============================================================================
// Constants
// =============================================================================

const QUICK_OPTIONS: QuickOption[] = [
  {
    label: "In 1 hour",
    icon: "clock-fast",
    getDate: () => {
      const date = new Date();
      date.setHours(date.getHours() + 1);
      return date;
    },
  },
  {
    label: "In 3 hours",
    icon: "clock-outline",
    getDate: () => {
      const date = new Date();
      date.setHours(date.getHours() + 3);
      return date;
    },
  },
  {
    label: "Tomorrow 9 AM",
    icon: "weather-sunny",
    getDate: () => {
      const date = new Date();
      date.setDate(date.getDate() + 1);
      date.setHours(9, 0, 0, 0);
      return date;
    },
  },
  {
    label: "Tomorrow 6 PM",
    icon: "weather-sunset",
    getDate: () => {
      const date = new Date();
      date.setDate(date.getDate() + 1);
      date.setHours(18, 0, 0, 0);
      return date;
    },
  },
];

// =============================================================================
// Component
// =============================================================================

export default function ScheduleMessageModal({
  visible,
  onClose,
  onSchedule,
  messagePreview,
}: ScheduleMessageModalProps) {
  const theme = useTheme();
  const colors = useColors();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  // Custom time input state
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("");
  const [customError, setCustomError] = useState("");

  // Reset state when modal opens
  React.useEffect(() => {
    if (visible) {
      setSelectedDate(null);
      setShowCustomPicker(false);
      setCustomDate("");
      setCustomTime("");
      setCustomError("");
    }
  }, [visible]);

  // Format preview text
  const previewText = useMemo(() => {
    if (messagePreview.length > 50) {
      return messagePreview.substring(0, 50) + "...";
    }
    return messagePreview;
  }, [messagePreview]);

  // Handle quick option selection
  const handleQuickOption = (option: QuickOption) => {
    const date = option.getDate();
    setSelectedDate(date);
    setShowCustomPicker(false);
    setCustomError("");
  };

  // Parse custom date/time
  const parseCustomDateTime = (): Date | null => {
    // Expected format: MM/DD or MM/DD/YYYY for date, HH:MM for time
    const dateMatch = customDate
      .trim()
      .match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
    const timeMatch = customTime.trim().match(/^(\d{1,2}):(\d{2})$/);

    if (!dateMatch) {
      setCustomError("Date format: MM/DD or MM/DD/YYYY");
      return null;
    }

    if (!timeMatch) {
      setCustomError("Time format: HH:MM (24-hour)");
      return null;
    }

    const month = parseInt(dateMatch[1], 10) - 1; // 0-indexed
    const day = parseInt(dateMatch[2], 10);
    const year = dateMatch[3]
      ? parseInt(dateMatch[3], 10)
      : new Date().getFullYear();

    const hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);

    // Validate ranges
    if (month < 0 || month > 11) {
      setCustomError("Invalid month (1-12)");
      return null;
    }
    if (day < 1 || day > 31) {
      setCustomError("Invalid day (1-31)");
      return null;
    }
    if (hours < 0 || hours > 23) {
      setCustomError("Invalid hour (0-23)");
      return null;
    }
    if (minutes < 0 || minutes > 59) {
      setCustomError("Invalid minutes (0-59)");
      return null;
    }

    // Create the date in local timezone
    const date = new Date(year, month, day, hours, minutes, 0, 0);

    // Check if the date is valid (e.g., Feb 30 would be invalid)
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month ||
      date.getDate() !== day
    ) {
      setCustomError("Invalid date");
      return null;
    }

    // Get current time
    const now = new Date();
    const minTime = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes from now
    const maxTime = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

    // Check if date is in the future (at least 5 minutes)
    if (date.getTime() < minTime.getTime()) {
      setCustomError("Must be at least 5 minutes in the future");
      return null;
    }

    // Check max 30 days
    if (date.getTime() > maxTime.getTime()) {
      setCustomError("Cannot schedule more than 30 days ahead");
      return null;
    }

    setCustomError("");
    return date;
  };

  // Apply custom date/time
  const handleApplyCustom = () => {
    const date = parseCustomDateTime();
    if (date) {
      setSelectedDate(date);
    }
  };

  // Handle schedule confirmation
  const handleSchedule = () => {
    if (selectedDate) {
      onSchedule(selectedDate);
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Schedule Message</Text>
            <IconButton
              icon="close"
              iconColor="#888"
              size={24}
              onPress={onClose}
            />
          </View>

          {/* Message Preview */}
          <View style={styles.previewContainer}>
            <MaterialCommunityIcons
              name="message-text-outline"
              size={16}
              color="#888"
            />
            <Text style={styles.previewText} numberOfLines={1}>
              {previewText}
            </Text>
          </View>

          <ScrollView style={styles.content}>
            {/* Quick Options */}
            <Text style={styles.sectionTitle}>Quick Options</Text>
            <View style={styles.quickOptions}>
              {QUICK_OPTIONS.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.quickOption,
                    selectedDate &&
                      formatScheduledTime(selectedDate.getTime()) ===
                        formatScheduledTime(option.getDate().getTime()) && [
                        styles.quickOptionSelected,
                        { borderColor: colors.primary },
                      ],
                  ]}
                  onPress={() => handleQuickOption(option)}
                >
                  <MaterialCommunityIcons
                    name={option.icon as any}
                    size={24}
                    color={
                      selectedDate &&
                      formatScheduledTime(selectedDate.getTime()) ===
                        formatScheduledTime(option.getDate().getTime())
                        ? theme.colors.primary
                        : "#888"
                    }
                  />
                  <Text
                    style={[
                      styles.quickOptionText,
                      selectedDate &&
                        formatScheduledTime(selectedDate.getTime()) ===
                          formatScheduledTime(option.getDate().getTime()) && [
                          styles.quickOptionTextSelected,
                          { color: colors.primary },
                        ],
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom Date/Time */}
            <TouchableOpacity
              style={styles.customToggle}
              onPress={() => setShowCustomPicker(!showCustomPicker)}
            >
              <MaterialCommunityIcons
                name={showCustomPicker ? "chevron-up" : "chevron-down"}
                size={20}
                color="#888"
              />
              <Text style={styles.customToggleText}>
                {showCustomPicker ? "Hide custom time" : "Set custom time"}
              </Text>
            </TouchableOpacity>

            {showCustomPicker && (
              <View style={styles.customPicker}>
                <View style={styles.customInputRow}>
                  <View style={styles.customInputContainer}>
                    <Text style={styles.customInputLabel}>Date</Text>
                    <TextInput
                      mode="outlined"
                      placeholder="MM/DD"
                      value={customDate}
                      onChangeText={setCustomDate}
                      style={styles.customInput}
                      outlineColor="#333"
                      activeOutlineColor={theme.colors.primary}
                      textColor="#fff"
                      placeholderTextColor="#666"
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.customInputContainer}>
                    <Text style={styles.customInputLabel}>Time</Text>
                    <TextInput
                      mode="outlined"
                      placeholder="HH:MM"
                      value={customTime}
                      onChangeText={setCustomTime}
                      style={styles.customInput}
                      outlineColor="#333"
                      activeOutlineColor={theme.colors.primary}
                      textColor="#fff"
                      placeholderTextColor="#666"
                      keyboardType="numeric"
                    />
                  </View>
                  <Button
                    mode="contained"
                    onPress={handleApplyCustom}
                    style={styles.applyButton}
                    buttonColor="#333"
                    compact
                  >
                    Apply
                  </Button>
                </View>
                {customError ? (
                  <Text style={styles.errorText}>{customError}</Text>
                ) : null}
              </View>
            )}

            {/* Selected Time Preview */}
            {selectedDate && (
              <View
                style={[
                  styles.selectedPreview,
                  { borderColor: colors.primary },
                ]}
              >
                <MaterialCommunityIcons
                  name="clock-check-outline"
                  size={24}
                  color={theme.colors.primary}
                />
                <View style={styles.selectedPreviewText}>
                  <Text style={styles.selectedLabel}>Will be sent</Text>
                  <Text
                    style={[styles.selectedTime, { color: colors.primary }]}
                  >
                    {formatScheduledTime(selectedDate.getTime())}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              mode="outlined"
              onPress={onClose}
              style={styles.actionButton}
              textColor="#888"
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleSchedule}
              style={styles.actionButton}
              buttonColor={theme.colors.primary}
              textColor="#000"
              disabled={!selectedDate}
            >
              Schedule
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  previewContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#222",
    gap: 8,
  },
  previewText: {
    color: "#888",
    fontSize: 14,
    flex: 1,
  },
  content: {
    padding: 20,
  },
  sectionTitle: {
    color: "#888",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 12,
  },
  quickOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  quickOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#222",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: "#333",
  },
  quickOptionSelected: {
    backgroundColor: "rgba(180, 190, 254, 0.1)",
  },
  quickOptionText: {
    color: "#888",
    fontSize: 14,
  },
  quickOptionTextSelected: {},
  customToggle: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    paddingVertical: 8,
    gap: 4,
  },
  customToggleText: {
    color: "#888",
    fontSize: 14,
  },
  customPicker: {
    marginTop: 12,
  },
  customInputRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-end",
  },
  customInputContainer: {
    flex: 1,
  },
  customInputLabel: {
    color: "#888",
    fontSize: 12,
    marginBottom: 4,
  },
  customInput: {
    backgroundColor: "#222",
    height: 44,
  },
  applyButton: {
    marginBottom: Platform.OS === "ios" ? 0 : 2,
  },
  errorText: {
    color: "#ff4444",
    fontSize: 12,
    marginTop: 8,
  },
  selectedPreview: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(180, 190, 254, 0.1)",
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    gap: 12,
    borderWidth: 1,
  },
  selectedPreviewText: {
    flex: 1,
  },
  selectedLabel: {
    color: "#888",
    fontSize: 12,
  },
  selectedTime: {
    fontSize: 18,
    fontWeight: "bold",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    padding: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#333",
  },
  actionButton: {
    minWidth: 100,
  },
});
