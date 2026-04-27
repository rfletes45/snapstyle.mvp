import { MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, View } from "react-native";
import { Divider, List, Switch, Text, useTheme } from "react-native-paper";

import { CALL_FEATURES } from "@/constants/featureFlags";
import { callSettingsService } from "@/services/calls/callSettingsService";
import { useSnackbar } from "@/store/SnackbarContext";
import {
  DEFAULT_CALL_SETTINGS,
  type AudioOutput,
  type CallSettings,
  type CallsAllowedFrom,
  type CameraPosition,
  type RingtoneOption,
} from "@/types/callSettings";
import { createLogger } from "@/utils/log";

const logger = createLogger("components/settings/CallSettingsSection");

const CAMERA_LABELS: Record<CameraPosition, string> = {
  front: "Front Camera",
  back: "Back Camera",
};

const AUDIO_OUTPUT_LABELS: Record<AudioOutput, string> = {
  earpiece: "Earpiece",
  speaker: "Speaker",
  bluetooth: "Bluetooth",
  wired: "Wired Headset",
};

const RINGTONE_LABELS: Record<RingtoneOption, string> = {
  default: "Default",
  vibrate_only: "Vibrate Only",
  silent: "Silent",
  custom: "Custom",
};

const CALLS_ALLOWED_LABELS: Record<CallsAllowedFrom, string> = {
  everyone: "Everyone",
  friends_only: "Friends only",
  nobody: "Nobody",
};

const VIDEO_QUALITY_LABELS: Record<
  CallSettings["preferredVideoQuality"],
  string
> = {
  auto: "Auto",
  high: "High (720p)",
  medium: "Medium (480p)",
  low: "Low (240p)",
};

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime(hour: number, minute: number) {
  const normalizedHour = hour % 12 || 12;
  const suffix = hour < 12 ? "AM" : "PM";
  return `${normalizedHour}:${minute.toString().padStart(2, "0")} ${suffix}`;
}

export function CallSettingsSection() {
  const theme = useTheme();
  const { showError, showSuccess } = useSnackbar();
  const callsRuntimeAvailable = CALL_FEATURES.CALLS_ENABLED;

  const [callSettings, setCallSettings] = useState<CallSettings>(
    DEFAULT_CALL_SETTINGS,
  );
  const [callSettingsLoading, setCallSettingsLoading] = useState(true);
  const [callSettingsSavingKey, setCallSettingsSavingKey] = useState<
    keyof CallSettings | null
  >(null);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  useEffect(() => {
    let mounted = true;

    callSettingsService
      .getSettings()
      .then((settings) => {
        if (mounted) setCallSettings(settings);
      })
      .catch((error) => {
        logger.error("Call settings load error:", error);
        showError("Failed to load call settings");
      })
      .finally(() => {
        if (mounted) setCallSettingsLoading(false);
      });

    const unsubscribe = callSettingsService.addListener((settings) => {
      if (mounted) setCallSettings(settings);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [showError]);

  const updateCallSetting = useCallback(
    async <K extends keyof CallSettings>(key: K, value: CallSettings[K]) => {
      const previous = callSettings;
      setCallSettings((current) => ({ ...current, [key]: value }));
      setCallSettingsSavingKey(key);

      try {
        await callSettingsService.updateSettings({
          [key]: value,
        } as Partial<CallSettings>);
      } catch (error: any) {
        logger.error("Call settings update error:", error);
        setCallSettings(previous);
        showError(error?.message || "Failed to update call setting");
      } finally {
        setCallSettingsSavingKey(null);
      }
    },
    [callSettings, showError],
  );

  const showAllowCallsPicker = useCallback(() => {
    Alert.alert("Allow Calls From", "Choose who can start calls with you.", [
      {
        text: "Everyone",
        onPress: () => updateCallSetting("allowCallsFrom", "everyone"),
      },
      {
        text: "Friends Only",
        onPress: () => updateCallSetting("allowCallsFrom", "friends_only"),
      },
      {
        text: "Nobody",
        style: "destructive",
        onPress: () => updateCallSetting("allowCallsFrom", "nobody"),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [updateCallSetting]);

  const showDefaultCameraPicker = useCallback(() => {
    Alert.alert("Default Camera", undefined, [
      {
        text: "Front Camera",
        onPress: () => updateCallSetting("defaultCamera", "front"),
      },
      {
        text: "Back Camera",
        onPress: () => updateCallSetting("defaultCamera", "back"),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [updateCallSetting]);

  const showDefaultAudioOutputPicker = useCallback(() => {
    Alert.alert("Default Audio Output", undefined, [
      {
        text: "Earpiece",
        onPress: () => updateCallSetting("defaultAudioOutput", "earpiece"),
      },
      {
        text: "Speaker",
        onPress: () => updateCallSetting("defaultAudioOutput", "speaker"),
      },
      {
        text: "Bluetooth",
        onPress: () => updateCallSetting("defaultAudioOutput", "bluetooth"),
      },
      {
        text: "Wired Headset",
        onPress: () => updateCallSetting("defaultAudioOutput", "wired"),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [updateCallSetting]);

  const showRingtonePicker = useCallback(() => {
    Alert.alert("Ringtone", undefined, [
      {
        text: "Default",
        onPress: () => updateCallSetting("ringtone", "default"),
      },
      {
        text: "Vibrate Only",
        onPress: () => updateCallSetting("ringtone", "vibrate_only"),
      },
      {
        text: "Silent",
        onPress: () => updateCallSetting("ringtone", "silent"),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [updateCallSetting]);

  const showVideoQualityPicker = useCallback(() => {
    Alert.alert("Preferred Video Quality", undefined, [
      {
        text: "Auto",
        onPress: () => updateCallSetting("preferredVideoQuality", "auto"),
      },
      {
        text: "High (720p)",
        onPress: () => updateCallSetting("preferredVideoQuality", "high"),
      },
      {
        text: "Medium (480p)",
        onPress: () => updateCallSetting("preferredVideoQuality", "medium"),
      },
      {
        text: "Low (240p)",
        onPress: () => updateCallSetting("preferredVideoQuality", "low"),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [updateCallSetting]);

  const handleResetDefaults = useCallback(() => {
    const previous = callSettings;

    Alert.alert(
      "Reset Call Settings",
      "Reset all call preferences to their defaults?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            setCallSettings(DEFAULT_CALL_SETTINGS);

            try {
              await callSettingsService.resetToDefaults();
              showSuccess("Call settings reset");
            } catch (error: any) {
              logger.error("Call settings reset error:", error);
              setCallSettings(previous);
              showError(error?.message || "Failed to reset call settings");
            }
          },
        },
      ],
    );
  }, [callSettings, showError, showSuccess]);

  const handleCallDndToggle = useCallback(
    (enabled: boolean) => {
      updateCallSetting("dndSchedule", {
        ...callSettings.dndSchedule,
        enabled,
      });
    },
    [callSettings.dndSchedule, updateCallSetting],
  );

  const handleStartTimeChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      setShowStartTimePicker(Platform.OS === "ios");
      if (event.type === "dismissed" || !selectedDate) return;

      updateCallSetting("dndSchedule", {
        ...callSettings.dndSchedule,
        startHour: selectedDate.getHours(),
        startMinute: selectedDate.getMinutes(),
      });
    },
    [callSettings.dndSchedule, updateCallSetting],
  );

  const handleEndTimeChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      setShowEndTimePicker(Platform.OS === "ios");
      if (event.type === "dismissed" || !selectedDate) return;

      updateCallSetting("dndSchedule", {
        ...callSettings.dndSchedule,
        endHour: selectedDate.getHours(),
        endMinute: selectedDate.getMinutes(),
      });
    },
    [callSettings.dndSchedule, updateCallSetting],
  );

  const toggleDndDay = useCallback(
    (dayIndex: number) => {
      const isActive = callSettings.dndSchedule.daysOfWeek.includes(dayIndex);
      const nextDays = isActive
        ? callSettings.dndSchedule.daysOfWeek.filter((day) => day !== dayIndex)
        : [...callSettings.dndSchedule.daysOfWeek, dayIndex].sort();

      updateCallSetting("dndSchedule", {
        ...callSettings.dndSchedule,
        daysOfWeek: nextDays,
      });
    },
    [callSettings.dndSchedule, updateCallSetting],
  );

  return (
    <>
      <List.Section>
        <List.Subheader style={styles.sectionHeader}>Calls</List.Subheader>

        {!callsRuntimeAvailable && (
          <>
            <List.Item
              title="Calling unavailable in this build"
              description="This Expo build can still save your call preferences, but placing or receiving calls requires a native dev build or production app."
              descriptionNumberOfLines={4}
              left={(props) => (
                <List.Icon {...props} icon="phone-off-outline" />
              )}
            />

            <Divider />
          </>
        )}

        {callSettingsLoading ? (
          <List.Item
            title="Loading call settings"
            description="Syncing your call preferences"
            left={(props) => <List.Icon {...props} icon="phone-sync-outline" />}
          />
        ) : (
          <>
            <List.Subheader style={styles.groupHeader}>Privacy</List.Subheader>
            <List.Item
              title="Allow Calls From"
              description={CALLS_ALLOWED_LABELS[callSettings.allowCallsFrom]}
              left={(props) => <List.Icon {...props} icon="account-voice" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={showAllowCallsPicker}
            />
            <List.Item
              title="Caller Presentation"
              description="Incoming caller preview and spoken-name announcements use the platform defaults in this build."
              descriptionNumberOfLines={3}
              left={(props) => (
                <List.Icon {...props} icon="information-outline" />
              )}
            />

            <Divider />

            <List.Subheader style={styles.groupHeader}>
              Video & Quality
            </List.Subheader>
            <List.Item
              title="Default Camera"
              description={CAMERA_LABELS[callSettings.defaultCamera]}
              left={(props) => <List.Icon {...props} icon="camera-outline" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={showDefaultCameraPicker}
            />
            <List.Item
              title="Mirror Front Camera"
              description="Flip your front-camera preview like a mirror"
              left={(props) => <List.Icon {...props} icon="camera-flip" />}
              right={() => (
                <Switch
                  value={callSettings.mirrorFrontCamera}
                  disabled={callSettingsSavingKey === "mirrorFrontCamera"}
                  onValueChange={(enabled) =>
                    updateCallSetting("mirrorFrontCamera", enabled)
                  }
                />
              )}
            />
            <List.Item
              title="Auto-enable Video"
              description="Start direct video calls with camera enabled"
              left={(props) => <List.Icon {...props} icon="video-outline" />}
              right={() => (
                <Switch
                  value={callSettings.autoEnableVideo}
                  disabled={callSettingsSavingKey === "autoEnableVideo"}
                  onValueChange={(enabled) =>
                    updateCallSetting("autoEnableVideo", enabled)
                  }
                />
              )}
            />
            <List.Item
              title="Preferred Video Quality"
              description={
                VIDEO_QUALITY_LABELS[callSettings.preferredVideoQuality]
              }
              left={(props) => <List.Icon {...props} icon="speedometer" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={showVideoQualityPicker}
            />
            <List.Item
              title="Data Saver Mode"
              description="Reduce incoming video quality on future calls"
              left={(props) => (
                <List.Icon {...props} icon="signal-cellular-2" />
              )}
              right={() => (
                <Switch
                  value={callSettings.dataSaverMode}
                  disabled={callSettingsSavingKey === "dataSaverMode"}
                  onValueChange={(enabled) =>
                    updateCallSetting("dataSaverMode", enabled)
                  }
                />
              )}
            />
            <List.Item
              title="Wi-Fi Only Video"
              description="Not available in this build."
              left={(props) => <List.Icon {...props} icon="wifi" />}
            />

            <Divider />

            <List.Subheader style={styles.groupHeader}>
              Audio & Alerts
            </List.Subheader>
            <List.Item
              title="Default Audio Output"
              description={AUDIO_OUTPUT_LABELS[callSettings.defaultAudioOutput]}
              left={(props) => <List.Icon {...props} icon="volume-high" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={showDefaultAudioOutputPicker}
            />
            <List.Item
              title="Noise Cancellation"
              description="Use Stream/Krisp by default during eligible calls when the device, native build, and Stream dashboard support it."
              descriptionNumberOfLines={3}
              left={(props) => <List.Icon {...props} icon="microphone" />}
              right={() => (
                <Switch
                  value={callSettings.noiseSuppression}
                  disabled={callSettingsSavingKey === "noiseSuppression"}
                  onValueChange={(enabled) =>
                    updateCallSetting("noiseSuppression", enabled)
                  }
                />
              )}
            />
            <List.Item
              title="Noise Cancellation Availability"
              description="Requires a native build with Stream noise cancellation linked, a supported device, and dashboard support on the default call type."
              descriptionNumberOfLines={4}
              left={(props) => (
                <List.Icon {...props} icon="shield-check-outline" />
              )}
            />
            <List.Item
              title="Ringtone"
              description={RINGTONE_LABELS[callSettings.ringtone]}
              left={(props) => (
                <List.Icon {...props} icon="music-note-outline" />
              )}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={showRingtonePicker}
            />
            <List.Item
              title="Vibration"
              description="Vibrate for incoming calls"
              left={(props) => <List.Icon {...props} icon="vibrate" />}
              right={() => (
                <Switch
                  value={callSettings.vibrationEnabled}
                  disabled={callSettingsSavingKey === "vibrationEnabled"}
                  onValueChange={(enabled) =>
                    updateCallSetting("vibrationEnabled", enabled)
                  }
                />
              )}
            />

            <Divider />

            <List.Subheader style={styles.groupHeader}>
              Do Not Disturb
            </List.Subheader>
            <List.Item
              title="Do Not Disturb"
              description="Silence incoming calls during scheduled quiet hours"
              left={(props) => (
                <List.Icon {...props} icon="moon-waning-crescent" />
              )}
              right={() => (
                <Switch
                  value={callSettings.dndSchedule.enabled}
                  disabled={callSettingsSavingKey === "dndSchedule"}
                  onValueChange={handleCallDndToggle}
                />
              )}
            />

            {callSettings.dndSchedule.enabled && (
              <>
                <List.Item
                  title="Quiet Hours Start"
                  description={formatTime(
                    callSettings.dndSchedule.startHour,
                    callSettings.dndSchedule.startMinute,
                  )}
                  left={(props) => <List.Icon {...props} icon="clock-start" />}
                  right={(props) => (
                    <List.Icon {...props} icon="chevron-right" />
                  )}
                  onPress={() => setShowStartTimePicker(true)}
                />
                <List.Item
                  title="Quiet Hours End"
                  description={formatTime(
                    callSettings.dndSchedule.endHour,
                    callSettings.dndSchedule.endMinute,
                  )}
                  left={(props) => <List.Icon {...props} icon="clock-end" />}
                  right={(props) => (
                    <List.Icon {...props} icon="chevron-right" />
                  )}
                  onPress={() => setShowEndTimePicker(true)}
                />
                <View style={styles.daysContainer}>
                  <Text
                    variant="labelSmall"
                    style={[
                      styles.daysLabel,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    Active Days
                  </Text>
                  <View style={styles.daysRow}>
                    {DAYS_OF_WEEK.map((day, dayIndex) => {
                      const isActive =
                        callSettings.dndSchedule.daysOfWeek.includes(dayIndex);

                      return (
                        <Pressable
                          key={day}
                          onPress={() => toggleDndDay(dayIndex)}
                          style={({ pressed }) => [
                            styles.dayButton,
                            {
                              backgroundColor: isActive
                                ? theme.colors.primary
                                : theme.colors.surfaceVariant,
                              opacity: pressed ? 0.78 : 1,
                            },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={`${day} quiet-hours toggle`}
                          accessibilityState={{ selected: isActive }}
                        >
                          <Text
                            variant="labelMedium"
                            style={{
                              color: isActive
                                ? theme.colors.onPrimary
                                : theme.colors.onSurfaceVariant,
                              fontWeight: "600",
                            }}
                          >
                            {day}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </>
            )}

            <Divider />

            <List.Subheader style={styles.groupHeader}>
              Transcription
            </List.Subheader>
            <List.Item
              title="Audio Call Transcriptions"
              description="When both participants enable this, direct 1:1 audio calls can be transcribed and later saved on this device. Video calls and voice rooms are excluded."
              descriptionNumberOfLines={4}
              left={(props) => <List.Icon {...props} icon="text-recognition" />}
              right={() => (
                <Switch
                  value={callSettings.audioCallTranscriptionsEnabled}
                  disabled={
                    callSettingsSavingKey === "audioCallTranscriptionsEnabled"
                  }
                  onValueChange={(enabled) =>
                    updateCallSetting("audioCallTranscriptionsEnabled", enabled)
                  }
                />
              )}
            />

            <Divider />

            <List.Subheader style={styles.groupHeader}>
              Accessibility & Maintenance
            </List.Subheader>
            <List.Item
              title="Accessibility Controls"
              description="Flash, haptics, and large in-call controls are not configurable in this build."
              descriptionNumberOfLines={3}
              left={(props) => <List.Icon {...props} icon="access-point" />}
            />
            <List.Item
              title="Reset Call Settings"
              description="Restore the default call preferences"
              titleStyle={{ color: theme.colors.error }}
              descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
              left={() => (
                <MaterialCommunityIcons
                  name="refresh"
                  size={24}
                  color={theme.colors.error}
                  style={styles.resetIcon}
                />
              )}
              onPress={handleResetDefaults}
            />
          </>
        )}
      </List.Section>

      {showStartTimePicker && (
        <DateTimePicker
          value={(() => {
            const date = new Date();
            date.setHours(
              callSettings.dndSchedule.startHour,
              callSettings.dndSchedule.startMinute,
              0,
              0,
            );
            return date;
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
            const date = new Date();
            date.setHours(
              callSettings.dndSchedule.endHour,
              callSettings.dndSchedule.endMinute,
              0,
              0,
            );
            return date;
          })()}
          mode="time"
          is24Hour={false}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleEndTimeChange}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    fontSize: 14,
    fontWeight: "600",
  },
  groupHeader: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  daysContainer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 16,
  },
  daysLabel: {
    marginBottom: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  daysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  dayButton: {
    minWidth: 40,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  resetIcon: {
    marginLeft: 18,
  },
});

export default CallSettingsSection;
