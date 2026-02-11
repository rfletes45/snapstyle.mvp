/**
 * CallSettingsScreen - Settings and preferences for calls
 * Includes camera, audio, ringtone, DND, privacy, and accessibility options
 */

import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import { callSettingsService } from "@/services/calls";
import {
  AudioOutput,
  CallSettings,
  CallsAllowedFrom,
  CameraPosition,
  DEFAULT_CALL_SETTINGS,
  RingtoneOption,
} from "@/types/call";


import { createLogger } from "@/utils/log";
const logger = createLogger("screens/calls/CallSettingsScreen");
// Option picker types
type PickerOption<T> = { label: string; value: T; icon?: string };

const CAMERA_OPTIONS: PickerOption<CameraPosition>[] = [
  { label: "Front Camera", value: "front", icon: "camera-reverse" },
  { label: "Back Camera", value: "back", icon: "camera" },
];

const AUDIO_OUTPUT_OPTIONS: PickerOption<AudioOutput>[] = [
  { label: "Earpiece", value: "earpiece", icon: "ear" },
  { label: "Speaker", value: "speaker", icon: "volume-high" },
  { label: "Bluetooth", value: "bluetooth", icon: "bluetooth" },
  { label: "Wired Headset", value: "wired", icon: "headset" },
];

const RINGTONE_OPTIONS: PickerOption<RingtoneOption>[] = [
  { label: "Default", value: "default", icon: "musical-notes" },
  { label: "Vibrate Only", value: "vibrate_only", icon: "phone-portrait" },
  { label: "Silent", value: "silent", icon: "volume-mute" },
  { label: "Custom", value: "custom", icon: "musical-note" },
];

const ALLOW_CALLS_OPTIONS: PickerOption<CallsAllowedFrom>[] = [
  { label: "Everyone", value: "everyone", icon: "globe" },
  { label: "Friends Only", value: "friends_only", icon: "people" },
  { label: "Nobody", value: "nobody", icon: "close-circle" },
];

const VIDEO_QUALITY_OPTIONS: PickerOption<
  CallSettings["preferredVideoQuality"]
>[] = [
  { label: "Auto", value: "auto", icon: "flash" },
  { label: "High (720p)", value: "high", icon: "sparkles" },
  { label: "Medium (480p)", value: "medium", icon: "remove" },
  { label: "Low (240p)", value: "low", icon: "battery-half" },
];

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CallSettingsScreen() {
  const navigation = useNavigation<any>();

  // State
  const [settings, setSettings] = useState<CallSettings>(DEFAULT_CALL_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loaded = await callSettingsService.getSettings();
        setSettings(loaded);
      } catch (error) {
        logger.error("Error loading settings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();

    // Subscribe to changes
    const unsubscribe = callSettingsService.addListener(setSettings);
    return unsubscribe;
  }, []);

  // Update a setting
  const updateSetting = useCallback(
    async <K extends keyof CallSettings>(key: K, value: CallSettings[K]) => {
      try {
        setIsSaving(true);
        await callSettingsService.updateSettings({ [key]: value });
      } catch (error) {
        Alert.alert("Error", "Failed to save setting");
      } finally {
        setIsSaving(false);
      }
    },
    [],
  );

  // Reset to defaults
  const handleResetDefaults = useCallback(() => {
    Alert.alert(
      "Reset Settings",
      "Are you sure you want to reset all call settings to defaults?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            try {
              setIsSaving(true);
              await callSettingsService.resetToDefaults();
            } catch (error) {
              Alert.alert("Error", "Failed to reset settings");
            } finally {
              setIsSaving(false);
            }
          },
        },
      ],
    );
  }, []);

  // Render a section header
  const renderSectionHeader = (title: string, subtitle?: string) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
    </View>
  );

  // Render a toggle row
  const renderToggle = (
    label: string,
    description: string | undefined,
    value: boolean,
    onToggle: (value: boolean) => void,
    icon?: string,
  ) => (
    <View style={styles.settingRow}>
      {icon && (
        <View style={styles.settingIcon}>
          <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={22} color={theme.colors.primary} />
        </View>
      )}
      <View style={styles.settingContent}>
        <Text style={styles.settingLabel}>{label}</Text>
        {description && (
          <Text style={styles.settingDescription}>{description}</Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{
          false: theme.colors.border,
          true: theme.colors.primaryContainer,
        }}
        thumbColor={value ? theme.colors.primary : theme.colors.surface}
      />
    </View>
  );

  // Render a picker row
  const renderPicker = <T extends string>(
    label: string,
    options: PickerOption<T>[],
    value: T,
    onSelect: (value: T) => void,
    icon?: string,
  ) => {
    const selectedOption = options.find((o) => o.value === value);

    return (
      <TouchableOpacity
        style={styles.settingRow}
        onPress={() => {
          // Show picker (simplified - in production use a modal or action sheet)
          Alert.alert(
            label,
            undefined,
            options.map((option) => ({
              text: option.label,
              onPress: () => onSelect(option.value),
              style: option.value === value ? "default" : "default",
            })),
          );
        }}
      >
        {icon && (
          <View style={styles.settingIcon}>
            <Ionicons
              name={icon as keyof typeof Ionicons.glyphMap}
              size={22}
              color={theme.colors.primary}
            />
          </View>
        )}
        <View style={styles.settingContent}>
          <Text style={styles.settingLabel}>{label}</Text>
        </View>
        <View style={styles.pickerValue}>
          <Text style={styles.pickerValueText}>{selectedOption?.label}</Text>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={theme.colors.textSecondary}
          />
        </View>
      </TouchableOpacity>
    );
  };

  // Render DND schedule
  const renderDNDSchedule = () => {
    const { dndSchedule } = settings;

    const formatTime = (hour: number, minute: number) => {
      const h = hour % 12 || 12;
      const ampm = hour < 12 ? "AM" : "PM";
      return `${h}:${minute.toString().padStart(2, "0")} ${ampm}`;
    };

    return (
      <View style={styles.dndContainer}>
        {/* DND Enable toggle */}
        {renderToggle(
          "Do Not Disturb",
          "Silence incoming calls during scheduled times",
          dndSchedule.enabled,
          (enabled) =>
            updateSetting("dndSchedule", { ...dndSchedule, enabled }),
          "moon",
        )}

        {dndSchedule.enabled && (
          <>
            {/* Time range */}
            <View style={styles.timeRangeContainer}>
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => {
                  // In production, use a time picker
                  Alert.alert(
                    "Select Start Time",
                    "Time picker would appear here",
                  );
                }}
              >
                <Text style={styles.timeLabel}>From</Text>
                <Text style={styles.timeValue}>
                  {formatTime(dndSchedule.startHour, dndSchedule.startMinute)}
                </Text>
              </TouchableOpacity>

              <Ionicons
                name="arrow-forward"
                size={20}
                color={theme.colors.textSecondary}
              />

              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => {
                  Alert.alert(
                    "Select End Time",
                    "Time picker would appear here",
                  );
                }}
              >
                <Text style={styles.timeLabel}>To</Text>
                <Text style={styles.timeValue}>
                  {formatTime(dndSchedule.endHour, dndSchedule.endMinute)}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Days of week */}
            <View style={styles.daysContainer}>
              <Text style={styles.daysLabel}>Active Days</Text>
              <View style={styles.daysRow}>
                {DAYS_OF_WEEK.map((day, index) => {
                  const isActive = dndSchedule.daysOfWeek.includes(index);
                  return (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.dayButton,
                        isActive && styles.dayButtonActive,
                      ]}
                      onPress={() => {
                        const newDays = isActive
                          ? dndSchedule.daysOfWeek.filter((d) => d !== index)
                          : [...dndSchedule.daysOfWeek, index].sort();
                        updateSetting("dndSchedule", {
                          ...dndSchedule,
                          daysOfWeek: newDays,
                        });
                      }}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          isActive && styles.dayTextActive,
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </>
        )}
      </View>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Call Settings</Text>
        {isSaving ? (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Camera Settings */}
        {renderSectionHeader("Camera", "Video call camera preferences")}
        <View style={styles.section}>
          {renderPicker(
            "Default Camera",
            CAMERA_OPTIONS,
            settings.defaultCamera,
            (value) => updateSetting("defaultCamera", value),
            "camera",
          )}
          {renderToggle(
            "Mirror Front Camera",
            "Flip preview like a mirror",
            settings.mirrorFrontCamera,
            (value) => updateSetting("mirrorFrontCamera", value),
          )}
          {renderToggle(
            "Auto-enable Video",
            "Start calls with video on",
            settings.autoEnableVideo,
            (value) => updateSetting("autoEnableVideo", value),
          )}
        </View>

        {/* Audio Settings */}
        {renderSectionHeader("Audio", "Sound and microphone settings")}
        <View style={styles.section}>
          {renderPicker(
            "Default Audio Output",
            AUDIO_OUTPUT_OPTIONS,
            settings.defaultAudioOutput,
            (value) => updateSetting("defaultAudioOutput", value),
            "volume-medium",
          )}
          {renderToggle(
            "Noise Suppression",
            "Reduce background noise",
            settings.noiseSuppression,
            (value) => updateSetting("noiseSuppression", value),
          )}
          {renderToggle(
            "Echo Cancellation",
            "Prevent audio feedback",
            settings.echoCancellation,
            (value) => updateSetting("echoCancellation", value),
          )}
          {renderToggle(
            "Auto Gain Control",
            "Automatically adjust volume",
            settings.autoGainControl,
            (value) => updateSetting("autoGainControl", value),
          )}
        </View>

        {/* Ringtone Settings */}
        {renderSectionHeader("Notifications", "Incoming call alerts")}
        <View style={styles.section}>
          {renderPicker(
            "Ringtone",
            RINGTONE_OPTIONS,
            settings.ringtone,
            (value) => updateSetting("ringtone", value),
            "musical-notes",
          )}
          {renderToggle(
            "Vibration",
            "Vibrate on incoming calls",
            settings.vibrationEnabled,
            (value) => updateSetting("vibrationEnabled", value),
            "phone-portrait",
          )}
        </View>

        {/* Do Not Disturb */}
        {renderSectionHeader("Do Not Disturb", "Schedule quiet hours")}
        <View style={styles.section}>{renderDNDSchedule()}</View>

        {/* Privacy Settings */}
        {renderSectionHeader("Privacy", "Control who can call you")}
        <View style={styles.section}>
          {renderPicker(
            "Allow Calls From",
            ALLOW_CALLS_OPTIONS,
            settings.allowCallsFrom,
            (value) => updateSetting("allowCallsFrom", value),
            "shield-checkmark",
          )}
          {renderToggle(
            "Show Caller Preview",
            "Show caller info on lock screen",
            settings.showCallPreview,
            (value) => updateSetting("showCallPreview", value),
          )}
          {renderToggle(
            "Announce Caller Name",
            "Read caller name aloud",
            settings.announceCallerName,
            (value) => updateSetting("announceCallerName", value),
          )}
        </View>

        {/* Quality Settings */}
        {renderSectionHeader("Quality & Data", "Video quality and data usage")}
        <View style={styles.section}>
          {renderPicker(
            "Preferred Video Quality",
            VIDEO_QUALITY_OPTIONS,
            settings.preferredVideoQuality,
            (value) => updateSetting("preferredVideoQuality", value),
            "speedometer",
          )}
          {renderToggle(
            "Data Saver Mode",
            "Reduce bandwidth usage",
            settings.dataSaverMode,
            (value) => updateSetting("dataSaverMode", value),
            "cellular",
          )}
          {renderToggle(
            "Wi-Fi Only Video",
            "Disable video on cellular",
            settings.wifiOnlyVideo,
            (value) => updateSetting("wifiOnlyVideo", value),
            "wifi",
          )}
        </View>

        {/* Accessibility */}
        {renderSectionHeader("Accessibility", "Visual and haptic feedback")}
        <View style={styles.section}>
          {renderToggle(
            "Flash on Ring",
            "Flash screen for incoming calls",
            settings.flashOnRing,
            (value) => updateSetting("flashOnRing", value),
            "flashlight",
          )}
          {renderToggle(
            "Haptic Feedback",
            "Vibrate on button presses",
            settings.hapticFeedback,
            (value) => updateSetting("hapticFeedback", value),
            "hand-left",
          )}
          {renderToggle(
            "Large Call Controls",
            "Bigger buttons during calls",
            settings.largeCallControls,
            (value) => updateSetting("largeCallControls", value),
            "resize",
          )}
        </View>

        {/* Reset button */}
        <TouchableOpacity
          style={styles.resetButton}
          onPress={handleResetDefaults}
        >
          <Ionicons name="refresh" size={20} color={theme.colors.error} />
          <Text style={styles.resetButtonText}>Reset to Defaults</Text>
        </TouchableOpacity>

        {/* Bottom padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.text,
    marginLeft: 12,
  },
  headerSpacer: {
    width: 24,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },

  // Section
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  section: {
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
  },

  // Setting row
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  settingIcon: {
    width: 36,
    alignItems: "center",
    marginRight: 8,
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: theme.colors.text,
  },
  settingDescription: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },

  // Picker
  pickerValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  pickerValueText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
  },

  // DND
  dndContainer: {
    paddingTop: 0,
  },
  timeRangeContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  timeButton: {
    alignItems: "center",
    padding: 12,
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    minWidth: 100,
  },
  timeLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.text,
  },
  daysContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  daysLabel: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  daysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.background,
  },
  dayButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  dayText: {
    fontSize: 12,
    fontWeight: "500",
    color: theme.colors.textSecondary,
  },
  dayTextActive: {
    color: "#fff",
  },

  // Reset button
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 32,
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.error,
    gap: 8,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: theme.colors.error,
  },

  bottomPadding: {
    height: 40,
  },
});

export default CallSettingsScreen;
