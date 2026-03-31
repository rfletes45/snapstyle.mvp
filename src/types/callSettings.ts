/**
 * Call settings types shared by the Stream-based call flow.
 */

export type CallsAllowedFrom = "everyone" | "friends_only" | "nobody";
export type CameraPosition = "front" | "back";
export type AudioOutput = "earpiece" | "speaker" | "bluetooth" | "wired";
export type RingtoneOption = "default" | "vibrate_only" | "silent" | "custom";

export interface DNDSchedule {
  enabled: boolean;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  timezone: string;
  daysOfWeek: number[];
}

export interface CallSettings {
  defaultCamera: CameraPosition;
  mirrorFrontCamera: boolean;
  autoEnableVideo: boolean;
  defaultAudioOutput: AudioOutput;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
  ringtone: RingtoneOption;
  customRingtoneUri?: string;
  vibrationEnabled: boolean;
  ringtoneVolume: number;
  dndSchedule: DNDSchedule;
  allowCallsFrom: CallsAllowedFrom;
  showCallPreview: boolean;
  announceCallerName: boolean;
  preferredVideoQuality: "auto" | "high" | "medium" | "low";
  dataSaverMode: boolean;
  wifiOnlyVideo: boolean;
  flashOnRing: boolean;
  hapticFeedback: boolean;
  largeCallControls: boolean;
}

export const DEFAULT_CALL_SETTINGS: CallSettings = {
  defaultCamera: "front",
  mirrorFrontCamera: true,
  autoEnableVideo: false,
  defaultAudioOutput: "earpiece",
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
  ringtone: "default",
  vibrationEnabled: true,
  ringtoneVolume: 80,
  dndSchedule: {
    enabled: false,
    startHour: 22,
    startMinute: 0,
    endHour: 7,
    endMinute: 0,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  },
  allowCallsFrom: "everyone",
  showCallPreview: true,
  announceCallerName: false,
  preferredVideoQuality: "auto",
  dataSaverMode: false,
  wifiOnlyVideo: false,
  flashOnRing: false,
  hapticFeedback: true,
  largeCallControls: false,
};
