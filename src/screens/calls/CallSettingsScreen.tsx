/**
 * CallSettingsScreen - Settings and preferences for calls
 * Includes camera, audio, ringtone, DND, privacy, and accessibility options
 */

import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { ScreenHeader } from "@/components/shared/ScreenHeader";
import { callSettingsService } from "@/services/calls";
import { useAppTheme } from "@/store/ThemeContext";
import {
  AudioOutput,
  CallSettings,
  CallsAllowedFrom,
  CameraPosition,
  DEFAULT_CALL_SETTINGS,
  RingtoneOption,
} from "@/types/callSettings";

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

const RINGTONE_OPTIONS: PickerOption<Exclude<RingtoneOption, "custom">>[] = [
  { label: "Default", value: "default", icon: "musical-notes" },
  { label: "Vibrate Only", value: "vibrate_only", icon: "phone-portrait" },
  { label: "Silent", value: "silent", icon: "volume-mute" },
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
  const { colors } = useAppTheme();

  // State
  const [settings, setSettings] = useState<CallSettings>(DEFAULT_CALL_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoadError(false);
        const loaded = await callSettingsService.getSettings();
        setSettings(loaded);
      } catch (error) {
        logger.error("Error loading settings:", error);
        setLoadError(true);
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
      <Text style={[styles.sectionTitle, { color: colors.primary }]}>
        {title}
      </Text>
      {subtitle && (
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          {subtitle}
        </Text>
      )}
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
    <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
      {icon && (
        <View style={styles.settingIcon}>
          <Ionicons
            name={icon as keyof typeof Ionicons.glyphMap}
            size={22}
            color={colors.primary}
          />
        </View>
      )}
      <View style={styles.settingContent}>
        <Text style={[styles.settingLabel, { color: colors.text }]}>
          {label}
        </Text>
        {description && (
          <Text
            style={[styles.settingDescription, { color: colors.textSecondary }]}
          >
            {description}
          </Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{
          false: colors.border,
          true: colors.primaryContainer,
        }}
        thumbColor={value ? colors.primary : colors.surface}
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
        style={[styles.settingRow, { borderBottomColor: colors.border }]}
        onPress={() => {
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
              color={colors.primary}
            />
          </View>
        )}
        <View style={styles.settingContent}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>
            {label}
          </Text>
        </View>
        <View style={styles.pickerValue}>
          <Text
            style={[styles.pickerValueText, { color: colors.textSecondary }]}
          >
            {selectedOption?.label}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.textSecondary}
          />
        </View>
      </TouchableOpacity>
    );
  };

  const renderInfoRow = (label: string, description: string, icon?: string) => (
    <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
      {icon && (
        <View style={styles.settingIcon}>
          <Ionicons
            name={icon as keyof typeof Ionicons.glyphMap}
            size={22}
            color={colors.primary}
          />
        </View>
      )}
      <View style={styles.settingContent}>
        <Text style={[styles.settingLabel, { color: colors.text }]}>
          {label}
        </Text>
        <Text
          style={[styles.settingDescription, { color: colors.textSecondary }]}
        >
          {description}
        </Text>
      </View>
    </View>
  );

  // DND time picker state
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const handleStartTimeChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      setShowStartTimePicker(Platform.OS === "ios"); // iOS keeps picker open
      if (event.type === "dismissed" || !selectedDate) return;
      updateSetting("dndSchedule", {
        ...settings.dndSchedule,
        startHour: selectedDate.getHours(),
        startMinute: selectedDate.getMinutes(),
      });
    },
    [settings.dndSchedule, updateSetting],
  );

  const handleEndTimeChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      setShowEndTimePicker(Platform.OS === "ios");
      if (event.type === "dismissed" || !selectedDate) return;
      updateSetting("dndSchedule", {
        ...settings.dndSchedule,
        endHour: selectedDate.getHours(),
        endMinute: selectedDate.getMinutes(),
      });
    },
    [settings.dndSchedule, updateSetting],
  );

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
            <View
              style={[
                styles.timeRangeContainer,
                { borderBottomColor: colors.border },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.timeButton,
                  { backgroundColor: colors.background },
                ]}
                onPress={() => setShowStartTimePicker(true)}
              >
                <Text
                  style={[styles.timeLabel, { color: colors.textSecondary }]}
                >
                  From
                </Text>
                <Text style={[styles.timeValue, { color: colors.text }]}>
                  {formatTime(dndSchedule.startHour, dndSchedule.startMinute)}
                </Text>
              </TouchableOpacity>

              <Ionicons
                name="arrow-forward"
                size={20}
                color={colors.textSecondary}
              />

              <TouchableOpacity
                style={[
                  styles.timeButton,
                  { backgroundColor: colors.background },
                ]}
                onPress={() => setShowEndTimePicker(true)}
              >
                <Text
                  style={[styles.timeLabel, { color: colors.textSecondary }]}
                >
                  To
                </Text>
                <Text style={[styles.timeValue, { color: colors.text }]}>
                  {formatTime(dndSchedule.endHour, dndSchedule.endMinute)}
                </Text>
              </TouchableOpacity>
            </View>

            {showStartTimePicker && (
              <DateTimePicker
                value={(() => {
                  const d = new Date();
                  d.setHours(
                    dndSchedule.startHour,
                    dndSchedule.startMinute,
                    0,
                    0,
                  );
                  return d;
                })()}
                mode="time"
                is24Hour={false}
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={handleStartTimeChange}
              />
            )}

            {showEndTimePicker && (
              <DateTimePicker
                value={(() => {
                  const d = new Date();
                  d.setHours(dndSchedule.endHour, dndSchedule.endMinute, 0, 0);
                  return d;
                })()}
                mode="time"
                is24Hour={false}
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={handleEndTimeChange}
              />
            )}

            {/* Days of week */}
            <View style={styles.daysContainer}>
              <Text style={[styles.daysLabel, { color: colors.textSecondary }]}>
                Active Days
              </Text>
              <View style={styles.daysRow}>
                {DAYS_OF_WEEK.map((day, index) => {
                  const isActive = dndSchedule.daysOfWeek.includes(index);
                  return (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.dayButton,
                        { backgroundColor: colors.background },
                        isActive && [
                          styles.dayButtonActive,
                          { backgroundColor: colors.primary },
                        ],
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
                          { color: colors.textSecondary },
                          isActive && [
                            styles.dayTextActive,
                            { color: colors.onPrimary },
                          ],
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

  // Error state
  if (loadError && !isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Call Settings" />
        <View style={styles.loadingContainer}>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.text, marginBottom: 8 },
            ]}
          >
            Unable to load settings
          </Text>
          <Text
            style={[
              styles.sectionSubtitle,
              { color: colors.textSecondary, marginBottom: 16 },
            ]}
          >
            Using default values. Tap to retry.
          </Text>
          <TouchableOpacity
            onPress={() => {
              setIsLoading(true);
              setLoadError(false);
              callSettingsService
                .getSettings()
                .then(setSettings)
                .catch(() => setLoadError(true))
                .finally(() => setIsLoading(false));
            }}
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
          >
            <Text style={{ color: "#fff", fontWeight: "600" }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Call Settings" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <ScreenHeader
        title="Call Settings"
        renderRight={() =>
          isSaving ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : null
        }
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Camera Settings */}
        {renderSectionHeader("Camera", "Video call camera preferences")}
        <View
          style={[
            styles.section,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
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
        {renderSectionHeader(
          "Audio",
          "Sound routing with device-managed voice processing",
        )}
        <View
          style={[
            styles.section,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {renderPicker(
            "Default Audio Output",
            AUDIO_OUTPUT_OPTIONS,
            settings.defaultAudioOutput,
            (value) => updateSetting("defaultAudioOutput", value),
            "volume-medium",
          )}
          {renderToggle(
            "Noise Cancellation",
            "Use Stream / Krisp by default during eligible calls when this device, native build, and Stream dashboard call type support it.",
            settings.noiseSuppression,
            (value) => updateSetting("noiseSuppression", value),
            "mic-outline",
          )}
          {renderInfoRow(
            "Availability",
            "Requires a native/EAS build with Stream noise cancellation linked, a supported device, and dashboard noise cancellation enabled for the default Stream call type.",
            "shield-checkmark-outline",
          )}
          {false &&
            renderToggle(
              "Noise Suppression",
              "Legacy setting — Stream/Krisp noise cancellation is now used instead",
              settings.noiseSuppression,
              (value) => updateSetting("noiseSuppression", value),
            )}
          {false &&
            renderToggle(
              "Echo Cancellation",
              "Handled by device hardware — saved for future use",
              settings.echoCancellation,
              (value) => updateSetting("echoCancellation", value),
            )}
          {false &&
            renderToggle(
              "Auto Gain Control",
              "Handled by device hardware — saved for future use",
              settings.autoGainControl,
              (value) => updateSetting("autoGainControl", value),
            )}
        </View>

        {/* Ringtone Settings */}
        {renderSectionHeader("Notifications", "Incoming call alerts")}
        <View
          style={[
            styles.section,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {renderPicker(
            "Ringtone",
            RINGTONE_OPTIONS,
            settings.ringtone === "custom" ? "default" : settings.ringtone,
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
        <View
          style={[
            styles.section,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {renderDNDSchedule()}
        </View>

        {/* Privacy Settings */}
        {renderSectionHeader("Privacy", "Control who can call you")}
        <View
          style={[
            styles.section,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {renderPicker(
            "Allow Calls From",
            ALLOW_CALLS_OPTIONS,
            settings.allowCallsFrom,
            (value) => updateSetting("allowCallsFrom", value),
            "shield-checkmark",
          )}
          {renderInfoRow(
            "Caller Presentation",
            "Incoming caller preview and spoken-name announcements use the platform defaults in this build.",
            "information-circle-outline",
          )}
          {false &&
            renderToggle(
              "Show Caller Preview",
              "Saved for future use — not yet enforced",
              settings.showCallPreview,
              (value) => updateSetting("showCallPreview", value),
            )}
          {false &&
            renderToggle(
              "Announce Caller Name",
              "Saved for future use — not yet enforced",
              settings.announceCallerName,
              (value) => updateSetting("announceCallerName", value),
            )}
        </View>

        {/* Quality Settings */}
        {renderSectionHeader(
          "Quality & Data",
          "Incoming video preferences for future calls",
        )}
        <View
          style={[
            styles.section,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {renderPicker(
            "Preferred Video Quality",
            VIDEO_QUALITY_OPTIONS,
            settings.preferredVideoQuality,
            (value) => updateSetting("preferredVideoQuality", value),
            "speedometer",
          )}
          {renderToggle(
            "Data Saver Mode",
            "Reduce incoming video resolution on future calls",
            settings.dataSaverMode,
            (value) => updateSetting("dataSaverMode", value),
            "cellular",
          )}
          {renderInfoRow(
            "Wi-Fi Only Video",
            "Not available in this build.",
            "wifi",
          )}
          {false &&
            renderToggle(
              "Wi-Fi Only Video",
              "Saved for future use — not yet enforced",
              settings.wifiOnlyVideo,
              (value) => updateSetting("wifiOnlyVideo", value),
              "wifi",
            )}
        </View>

        {/* Accessibility */}
        {renderSectionHeader(
          "Accessibility",
          "System defaults for visual and haptic feedback",
        )}
        <View
          style={[
            styles.section,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {renderInfoRow(
            "Accessibility Controls",
            "Flash, haptics, and large in-call controls are not configurable in this build.",
            "information-circle-outline",
          )}
          {false &&
            renderToggle(
              "Flash on Ring",
              "Saved for future use — not yet enforced",
              settings.flashOnRing,
              (value) => updateSetting("flashOnRing", value),
              "flashlight",
            )}
          {false &&
            renderToggle(
              "Haptic Feedback",
              "Saved for future use — not yet enforced",
              settings.hapticFeedback,
              (value) => updateSetting("hapticFeedback", value),
              "hand-left",
            )}
          {false &&
            renderToggle(
              "Large Call Controls",
              "Saved for future use — not yet enforced",
              settings.largeCallControls,
              (value) => updateSetting("largeCallControls", value),
              "resize",
            )}
        </View>

        {/* Transcription (opt-in, direct audio only) */}
        {renderSectionHeader(
          "Transcription",
          "Opt-in transcripts for 1:1 audio calls",
        )}
        <View
          style={[
            styles.section,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {renderToggle(
            "Audio Call Transcriptions",
            "When both participants enable this, 1:1 audio calls can be transcribed and later saved on this device. Stream processes the transcript first; SnapStyle then imports it and deletes the original Stream transcript when possible. Transcripts are never created for video calls or voice rooms.",
            settings.audioCallTranscriptionsEnabled,
            (value) => updateSetting("audioCallTranscriptionsEnabled", value),
            "document-text-outline",
          )}
        </View>

        {/* Reset button */}
        <TouchableOpacity
          style={[
            styles.resetButton,
            { backgroundColor: colors.surface, borderColor: colors.error },
          ]}
          onPress={handleResetDefaults}
        >
          <Ionicons name="refresh" size={20} color={colors.error} />
          <Text style={[styles.resetButtonText, { color: colors.error }]}>
            Reset to Defaults
          </Text>
        </TouchableOpacity>

        {/* Bottom padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
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
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  section: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },

  // Setting row
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  },
  settingDescription: {
    fontSize: 13,
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
  },
  timeButton: {
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    minWidth: 100,
  },
  timeLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 18,
    fontWeight: "600",
  },
  daysContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  daysLabel: {
    fontSize: 13,
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
  },
  dayButtonActive: {},
  dayText: {
    fontSize: 12,
    fontWeight: "500",
  },
  dayTextActive: {},

  // Reset button
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 32,
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },

  bottomPadding: {
    height: 40,
  },
});

export default CallSettingsScreen;
