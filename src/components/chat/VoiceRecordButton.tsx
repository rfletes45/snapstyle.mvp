/**
 * VoiceRecordButton Component
 *
 * Hold-to-record button with visual feedback.
 *
 * Features:
 * - Press and hold to record
 * - Visual recording indicator
 * - Duration display
 * - Slide to cancel
 * - Haptic feedback
 *
 * @module components/chat/VoiceRecordButton
 */

import { useVoiceRecorder, VoiceRecording } from "@/hooks/useVoiceRecorder";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { memo, useCallback, useRef, useState } from "react";
import {
  Animated,
  GestureResponderEvent,
  PanResponder,
  PanResponderGestureState,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { useTheme } from "react-native-paper";

// =============================================================================
// Types
// =============================================================================

export interface VoiceRecordButtonProps {
  /** Called when recording completes successfully */
  onRecordingComplete: (recording: VoiceRecording) => void;
  /** Called when recording is cancelled */
  onRecordingCancelled?: () => void;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Size of the button */
  size?: number;
  /** Maximum recording duration in seconds */
  maxDuration?: number;
  /** Container style */
  style?: StyleProp<ViewStyle>;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_SIZE = 40;
const CANCEL_SLIDE_THRESHOLD = -80; // pixels to slide left to cancel
const RECORDING_SCALE = 1.3;

// =============================================================================
// Main Component
// =============================================================================

export const VoiceRecordButton = memo(function VoiceRecordButton({
  onRecordingComplete,
  onRecordingCancelled,
  disabled = false,
  size = DEFAULT_SIZE,
  maxDuration = 60,
  style,
}: VoiceRecordButtonProps) {
  const theme = useTheme();
  const [slideOffset, setSlideOffset] = useState(0);
  const [isCancelling, setIsCancelling] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const voiceRecorder = useVoiceRecorder({
    maxDuration,
    onRecordingComplete,
    onRecordingCancelled,
  });

  // Pulse animation for recording indicator
  const startPulseAnimation = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [pulseAnim]);

  const stopPulseAnimation = useCallback(() => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  }, [pulseAnim]);

  // Handle press in (start recording)
  const handlePressIn = useCallback(async () => {
    if (disabled || !voiceRecorder.isAvailable) {
      voiceRecorder.startRecording(); // Will show error alert if not available
      return;
    }

    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Scale up animation
    Animated.spring(scaleAnim, {
      toValue: RECORDING_SCALE,
      useNativeDriver: true,
    }).start();

    // Start recording
    await voiceRecorder.startRecording();

    // Start pulse animation
    if (voiceRecorder.isRecording) {
      startPulseAnimation();
    }
  }, [disabled, voiceRecorder, scaleAnim, startPulseAnimation]);

  // Handle press out (stop recording)
  const handlePressOut = useCallback(async () => {
    if (!voiceRecorder.isRecording) return;

    // Stop animations
    stopPulseAnimation();
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();

    // Check if cancelling
    if (isCancelling || slideOffset < CANCEL_SLIDE_THRESHOLD) {
      await voiceRecorder.cancelRecording();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      // Stop and save recording
      const recording = await voiceRecorder.stopRecording();
      if (recording && recording.durationMs > 500) {
        // Minimum 0.5 second recording
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (recording) {
        // Too short, cancel it
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    }

    // Reset state
    setSlideOffset(0);
    setIsCancelling(false);
  }, [voiceRecorder, isCancelling, slideOffset, scaleAnim, stopPulseAnimation]);

  // Use refs to store latest callback values to avoid stale closures in PanResponder
  const handlePressInRef = useRef(handlePressIn);
  const handlePressOutRef = useRef(handlePressOut);
  const isRecordingRef = useRef(voiceRecorder.isRecording);

  // Update refs when values change
  React.useEffect(() => {
    handlePressInRef.current = handlePressIn;
  }, [handlePressIn]);

  React.useEffect(() => {
    handlePressOutRef.current = handlePressOut;
  }, [handlePressOut]);

  React.useEffect(() => {
    isRecordingRef.current = voiceRecorder.isRecording;
  }, [voiceRecorder.isRecording]);

  // Pan responder for slide-to-cancel
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only become pan responder if there's meaningful horizontal movement
        return Math.abs(gestureState.dx) > 5;
      },
      onPanResponderGrant: () => {
        handlePressInRef.current();
      },
      onPanResponderMove: (
        _event: GestureResponderEvent,
        gestureState: PanResponderGestureState,
      ) => {
        if (isRecordingRef.current) {
          const offset = Math.min(0, gestureState.dx);
          setSlideOffset(offset);
          setIsCancelling(offset < CANCEL_SLIDE_THRESHOLD);
        }
      },
      onPanResponderRelease: () => {
        handlePressOutRef.current();
      },
      onPanResponderTerminate: () => {
        handlePressOutRef.current();
      },
    }),
  ).current;

  // Web: Click-to-toggle handler (instead of hold-to-record)
  const handleWebClick = useCallback(async () => {
    if (voiceRecorder.isRecording) {
      // Stop recording
      stopPulseAnimation();
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
      const recording = await voiceRecorder.stopRecording();
      if (recording && recording.durationMs > 500) {
        // Success
      }
    } else {
      // Start recording
      if (disabled || !voiceRecorder.isAvailable) {
        voiceRecorder.startRecording();
        return;
      }
      Animated.spring(scaleAnim, {
        toValue: RECORDING_SCALE,
        useNativeDriver: true,
      }).start();
      await voiceRecorder.startRecording();
      if (voiceRecorder.isRecording) {
        startPulseAnimation();
      }
    }
  }, [
    voiceRecorder,
    disabled,
    scaleAnim,
    startPulseAnimation,
    stopPulseAnimation,
  ]);

  // Web: Cancel handler
  const handleWebCancel = useCallback(async () => {
    if (voiceRecorder.isRecording) {
      stopPulseAnimation();
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
      await voiceRecorder.cancelRecording();
    }
  }, [voiceRecorder, scaleAnim, stopPulseAnimation]);

  // Render not available state
  if (!voiceRecorder.isAvailable) {
    return (
      <Pressable
        style={[styles.button, { width: size, height: size, opacity: 0.5 }]}
        onPress={() => voiceRecorder.startRecording()}
      >
        <MaterialCommunityIcons
          name="microphone-off"
          size={size * 0.6}
          color="#888"
        />
      </Pressable>
    );
  }

  // Web: Use click-to-toggle pattern (more reliable than PanResponder on web)
  if (Platform.OS === "web") {
    return (
      <View style={[styles.container, style]}>
        {/* Recording overlay with cancel button */}
        {voiceRecorder.isRecording && (
          <View style={styles.recordingOverlay}>
            {/* Cancel button */}
            <Pressable onPress={handleWebCancel} style={styles.webCancelButton}>
              <MaterialCommunityIcons
                name="close-circle"
                size={24}
                color="#FF4444"
              />
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>

            {/* Duration display */}
            <View style={styles.durationContainer}>
              <Animated.View
                style={[
                  styles.recordingDot,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              />
              <Text style={styles.durationText}>
                {voiceRecorder.durationFormatted}
              </Text>
            </View>
          </View>
        )}

        {/* Record/Stop button */}
        <Pressable onPress={handleWebClick}>
          <Animated.View
            style={[
              styles.buttonContainer,
              { transform: [{ scale: scaleAnim }] },
            ]}
          >
            <View
              style={[
                styles.button,
                {
                  width: size,
                  height: size,
                  backgroundColor: voiceRecorder.isRecording
                    ? "#FF4444"
                    : theme.colors.surfaceVariant,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={voiceRecorder.isRecording ? "stop" : "microphone-outline"}
                size={size * 0.6}
                color={voiceRecorder.isRecording ? "#FFF" : "#888"}
              />
            </View>
          </Animated.View>
        </Pressable>
      </View>
    );
  }

  // Native: Use PanResponder for hold-to-record

  return (
    <View style={[styles.container, style]}>
      {/* Recording overlay */}
      {voiceRecorder.isRecording && (
        <View style={styles.recordingOverlay}>
          {/* Slide to cancel indicator */}
          <View style={[styles.slideIndicator, { left: slideOffset }]}>
            <MaterialCommunityIcons
              name={isCancelling ? "close-circle" : "chevron-left"}
              size={20}
              color={isCancelling ? "#FF4444" : "#888"}
            />
            <Text style={[styles.slideText, isCancelling && styles.cancelText]}>
              {isCancelling ? "Release to cancel" : "‹ Slide to cancel"}
            </Text>
            {/* Animated chevron hint */}
            {!isCancelling && (
              <MaterialCommunityIcons
                name="chevron-left"
                size={14}
                color="rgba(136,136,136,0.5)"
                style={{ marginLeft: -4 }}
              />
            )}
          </View>

          {/* Duration display */}
          <View style={styles.durationContainer}>
            <Animated.View
              style={[
                styles.recordingDot,
                { transform: [{ scale: pulseAnim }] },
              ]}
            />
            <Text style={styles.durationText}>
              {voiceRecorder.durationFormatted}
            </Text>
          </View>
        </View>
      )}

      {/* Record button */}
      <Animated.View
        style={[styles.buttonContainer, { transform: [{ scale: scaleAnim }] }]}
        {...panResponder.panHandlers}
      >
        <View
          style={[
            styles.button,
            {
              width: size,
              height: size,
              backgroundColor: voiceRecorder.isRecording
                ? "#FF4444"
                : theme.colors.surfaceVariant,
            },
          ]}
        >
          <MaterialCommunityIcons
            name={
              voiceRecorder.isRecording ? "microphone" : "microphone-outline"
            }
            size={size * 0.6}
            color={voiceRecorder.isRecording ? "#FFF" : "#888"}
          />
        </View>
      </Animated.View>
    </View>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  buttonContainer: {
    zIndex: 10,
  },
  button: {
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
  },
  recordingOverlay: {
    position: "absolute",
    right: 50,
    top: 0,
    bottom: 0,
    left: -200,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0,0,0,0.8)",
    borderRadius: 20,
    paddingHorizontal: 12,
  },
  slideIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  slideText: {
    color: "#888",
    fontSize: 12,
  },
  cancelText: {
    color: "#FF4444",
  },
  durationContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF4444",
  },
  durationText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  webCancelButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 8,
  },
});

export default VoiceRecordButton;
