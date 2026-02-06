/**
 * useVoiceRecorder Hook
 *
 * Manages voice recording state using expo-audio.
 *
 * Features:
 * - Hold-to-record functionality
 * - Recording duration tracking
 * - Permission handling
 * - Audio mode configuration
 *
 * @module hooks/useVoiceRecorder
 */

import { createLogger } from "@/utils/log";
import { formatDurationMs as formatDuration } from "@/utils/time";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";

// Conditionally import expo-audio (may not be installed)
let AudioModule: any = null;
let useAudioRecorder: any = null;
let useAudioRecorderState: any = null;
let RecordingPresets: any = null;
let setAudioModeAsync: any = null;

try {
  const expoAudio = require("expo-audio");
  AudioModule = expoAudio.AudioModule;
  useAudioRecorder = expoAudio.useAudioRecorder;
  useAudioRecorderState = expoAudio.useAudioRecorderState;
  RecordingPresets = expoAudio.RecordingPresets;
  setAudioModeAsync = expoAudio.setAudioModeAsync;
} catch (e) {
  // expo-audio not installed
}

const log = createLogger("useVoiceRecorder");

// =============================================================================
// Types
// =============================================================================

export interface VoiceRecording {
  /** Local file URI */
  uri: string;
  /** Duration in milliseconds */
  durationMs: number;
  /** MIME type */
  mimeType: string;
  /** File extension */
  extension: string;
}

export interface UseVoiceRecorderOptions {
  /** Maximum recording duration in seconds (default: 60) */
  maxDuration?: number;
  /** Callback when recording completes */
  onRecordingComplete?: (recording: VoiceRecording) => void;
  /** Callback when recording is cancelled */
  onRecordingCancelled?: () => void;
}

export interface UseVoiceRecorderReturn {
  /** Whether expo-audio is available */
  isAvailable: boolean;
  /** Whether currently recording */
  isRecording: boolean;
  /** Whether recorder is ready */
  canRecord: boolean;
  /** Current recording duration in milliseconds */
  durationMs: number;
  /** Current recording duration formatted as "M:SS" */
  durationFormatted: string;
  /** Start recording */
  startRecording: () => Promise<void>;
  /** Stop recording and return result */
  stopRecording: () => Promise<VoiceRecording | null>;
  /** Cancel recording without saving */
  cancelRecording: () => Promise<void>;
  /** Request microphone permission */
  requestPermission: () => Promise<boolean>;
  /** Check if permission is granted */
  hasPermission: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MAX_DURATION = 60; // 60 seconds
const RECORDING_UPDATE_INTERVAL = 100; // ms

// =============================================================================
// Fallback Hook (when expo-audio is not installed)
// =============================================================================

function useVoiceRecorderFallback(
  _options: UseVoiceRecorderOptions = {},
): UseVoiceRecorderReturn {
  return {
    isAvailable: false,
    isRecording: false,
    canRecord: false,
    durationMs: 0,
    durationFormatted: "0:00",
    startRecording: async () => {
      Alert.alert(
        "Not Available",
        "Voice messages require expo-audio to be installed.\n\nRun: npx expo install expo-audio",
      );
    },
    stopRecording: async () => null,
    cancelRecording: async () => {},
    requestPermission: async () => false,
    hasPermission: false,
  };
}

// =============================================================================
// Main Hook Implementation
// =============================================================================

function useVoiceRecorderImpl(
  options: UseVoiceRecorderOptions = {},
): UseVoiceRecorderReturn {
  const {
    maxDuration = DEFAULT_MAX_DURATION,
    onRecordingComplete,
    onRecordingCancelled,
  } = options;

  // ==========================================================================
  // State
  // ==========================================================================

  const [hasPermission, setHasPermission] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const recordingStartTime = useRef<number | null>(null);
  const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRecordingRef = useRef(false);

  // Use expo-audio hooks
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(
    audioRecorder,
    RECORDING_UPDATE_INTERVAL,
  );

  // ==========================================================================
  // Permission Handling
  // ==========================================================================

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      const granted = status.granted;
      setHasPermission(granted);

      if (!granted) {
        Alert.alert(
          "Permission Denied",
          "Microphone access is required to record voice messages.",
        );
      }

      return granted;
    } catch (error) {
      log.error("Failed to request recording permission", error);
      return false;
    }
  }, []);

  // Check permission on mount
  useEffect(() => {
    (async () => {
      try {
        const status = await AudioModule.getRecordingPermissionsAsync();
        setHasPermission(status.granted);
      } catch (error) {
        log.error("Failed to check recording permission", error);
      }
    })();
  }, []);

  // ==========================================================================
  // Recording Controls
  // ==========================================================================

  const startRecording = useCallback(async () => {
    try {
      // Check permission
      if (!hasPermission) {
        const granted = await requestPermission();
        if (!granted) return;
      }

      // Configure audio mode for recording
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      // Prepare and start recording
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();

      setIsRecording(true);
      isRecordingRef.current = true;
      recordingStartTime.current = Date.now();
      setDurationMs(0);

      // Start duration tracking
      durationInterval.current = setInterval(() => {
        if (recordingStartTime.current) {
          const elapsed = Date.now() - recordingStartTime.current;
          setDurationMs(elapsed);

          // Auto-stop at max duration
          if (elapsed >= maxDuration * 1000) {
            log.info("Max recording duration reached, auto-stopping");
            stopRecording();
          }
        }
      }, RECORDING_UPDATE_INTERVAL);

      log.info("Recording started");
    } catch (error) {
      log.error("Failed to start recording", error);
      Alert.alert("Error", "Failed to start recording. Please try again.");
      setIsRecording(false);
      isRecordingRef.current = false;
    }
  }, [hasPermission, requestPermission, audioRecorder, maxDuration]);

  const stopRecording =
    useCallback(async (): Promise<VoiceRecording | null> => {
      try {
        if (!isRecording) {
          return null;
        }

        // Stop duration tracking
        if (durationInterval.current) {
          clearInterval(durationInterval.current);
          durationInterval.current = null;
        }

        // Stop recording
        await audioRecorder.stop();

        const uri = audioRecorder.uri;
        const finalDuration = recordingStartTime.current
          ? Date.now() - recordingStartTime.current
          : durationMs;

        setIsRecording(false);
        isRecordingRef.current = false;
        recordingStartTime.current = null;

        // Reset audio mode
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
        });

        if (!uri) {
          log.warn("Recording completed but no URI available");
          return null;
        }

        // Determine file extension and mime type based on platform
        // Extension WITHOUT leading dot (uploadVoiceMessage adds the dot)
        const extension = Platform.OS === "ios" ? "m4a" : "m4a";
        const mimeType = "audio/mp4";

        const recording: VoiceRecording = {
          uri,
          durationMs: finalDuration,
          mimeType,
          extension,
        };

        log.info("Recording stopped");

        onRecordingComplete?.(recording);
        return recording;
      } catch (error) {
        log.error("Failed to stop recording", error);
        setIsRecording(false);
        isRecordingRef.current = false;
        return null;
      }
    }, [isRecording, audioRecorder, durationMs, onRecordingComplete]);

  const cancelRecording = useCallback(async () => {
    try {
      // Stop duration tracking
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }

      if (isRecording) {
        await audioRecorder.stop();
      }

      setIsRecording(false);
      isRecordingRef.current = false;
      setDurationMs(0);
      recordingStartTime.current = null;

      // Reset audio mode
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });

      log.info("Recording cancelled");
      onRecordingCancelled?.();
    } catch (error) {
      log.error("Failed to cancel recording", error);
      setIsRecording(false);
      isRecordingRef.current = false;
    }
  }, [isRecording, audioRecorder, onRecordingCancelled]);

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  useEffect(() => {
    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
      // Stop active recording on unmount to prevent orphaned recording
      if (isRecordingRef.current) {
        isRecordingRef.current = false;
        try {
          audioRecorder.stop();
          setAudioModeAsync?.({
            allowsRecording: false,
            playsInSilentMode: true,
          });
        } catch (e) {
          // Best-effort cleanup on unmount
          log.warn("Failed to stop recording on unmount", {
            data: { error: e },
          });
        }
      }
    };
  }, [audioRecorder]);

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    isAvailable: true,
    isRecording,
    canRecord: recorderState.canRecord,
    durationMs,
    durationFormatted: formatDuration(durationMs),
    startRecording,
    stopRecording,
    cancelRecording,
    requestPermission,
    hasPermission,
  };
}

// =============================================================================
// Export
// =============================================================================

/**
 * Hook for voice recording functionality.
 * Returns a fallback implementation if expo-audio is not installed.
 */
export function useVoiceRecorder(
  options: UseVoiceRecorderOptions = {},
): UseVoiceRecorderReturn {
  // Use fallback if expo-audio is not available
  if (!AudioModule || !useAudioRecorder) {
    return useVoiceRecorderFallback(options);
  }

  return useVoiceRecorderImpl(options);
}

export default useVoiceRecorder;
