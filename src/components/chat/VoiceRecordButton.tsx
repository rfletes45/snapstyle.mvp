/**
 * VoiceRecordButton Component
 *
 * Polished hold-to-record button with modern visual feedback.
 *
 * Native: Hold to record, slide left to cancel, release to send.
 * Web: Click to start/stop, separate cancel button.
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
const CANCEL_SLIDE_THRESHOLD = -80;

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
  const pulseAnim = useRef(new Animated.Value(0)).current;

  const voiceRecorder = useVoiceRecorder({
    maxDuration,
    onRecordingComplete,
    onRecordingCancelled,
  });

  // Gentle glow pulse for the recording dot
  const startPulse = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [pulseAnim]);

  const stopPulse = useCallback(() => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(0);
  }, [pulseAnim]);

  // Handle press in (start recording)
  const handlePressIn = useCallback(async () => {
    if (disabled || !voiceRecorder.isAvailable) {
      voiceRecorder.startRecording();
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Animated.spring(scaleAnim, {
      toValue: 1.15,
      friction: 6,
      useNativeDriver: true,
    }).start();

    await voiceRecorder.startRecording();

    if (voiceRecorder.isRecording) {
      startPulse();
    }
  }, [disabled, voiceRecorder, scaleAnim, startPulse]);

  // Handle press out (stop recording)
  const handlePressOut = useCallback(async () => {
    if (!voiceRecorder.isRecording) return;

    stopPulse();
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 6,
      useNativeDriver: true,
    }).start();

    if (isCancelling || slideOffset < CANCEL_SLIDE_THRESHOLD) {
      await voiceRecorder.cancelRecording();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      const recording = await voiceRecorder.stopRecording();
      if (recording && recording.durationMs > 500) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }

    setSlideOffset(0);
    setIsCancelling(false);
  }, [voiceRecorder, isCancelling, slideOffset, scaleAnim, stopPulse]);

  // Refs for stable PanResponder closures
  const handlePressInRef = useRef(handlePressIn);
  const handlePressOutRef = useRef(handlePressOut);
  const isRecordingRef = useRef(voiceRecorder.isRecording);

  React.useEffect(() => {
    handlePressInRef.current = handlePressIn;
  }, [handlePressIn]);
  React.useEffect(() => {
    handlePressOutRef.current = handlePressOut;
  }, [handlePressOut]);
  React.useEffect(() => {
    isRecordingRef.current = voiceRecorder.isRecording;
  }, [voiceRecorder.isRecording]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 5,
      onPanResponderGrant: () => {
        handlePressInRef.current();
      },
      onPanResponderMove: (
        _e: GestureResponderEvent,
        gs: PanResponderGestureState,
      ) => {
        if (isRecordingRef.current) {
          const offset = Math.min(0, gs.dx);
          setSlideOffset(offset);
          setIsCancelling(offset < CANCEL_SLIDE_THRESHOLD);
        }
      },
      onPanResponderRelease: () => handlePressOutRef.current(),
      onPanResponderTerminate: () => handlePressOutRef.current(),
    }),
  ).current;

  // Web toggle handler
  const handleWebClick = useCallback(async () => {
    if (voiceRecorder.isRecording) {
      stopPulse();
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }).start();
      await voiceRecorder.stopRecording();
    } else {
      if (disabled || !voiceRecorder.isAvailable) {
        voiceRecorder.startRecording();
        return;
      }
      Animated.spring(scaleAnim, {
        toValue: 1.15,
        friction: 6,
        useNativeDriver: true,
      }).start();
      await voiceRecorder.startRecording();
      if (voiceRecorder.isRecording) startPulse();
    }
  }, [voiceRecorder, disabled, scaleAnim, startPulse, stopPulse]);

  const handleWebCancel = useCallback(async () => {
    if (voiceRecorder.isRecording) {
      stopPulse();
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }).start();
      await voiceRecorder.cancelRecording();
    }
  }, [voiceRecorder, scaleAnim, stopPulse]);

  // ---- Unavailable state ----
  if (!voiceRecorder.isAvailable) {
    return (
      <Pressable
        style={[styles.micButton, { width: size, height: size, opacity: 0.4 }]}
        onPress={() => voiceRecorder.startRecording()}
      >
        <MaterialCommunityIcons
          name="microphone-off"
          size={size * 0.55}
          color={theme.colors.onSurfaceVariant}
        />
      </Pressable>
    );
  }

  // ---- Dot opacity driven by pulse animation ----
  const dotOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.3],
  });

  // ---- Slide cancel opacity ----
  const cancelOpacity = Math.min(
    1,
    Math.abs(slideOffset) / Math.abs(CANCEL_SLIDE_THRESHOLD),
  );

  // ---- Recording overlay (shared between web & native) ----
  const recordingOverlay = voiceRecorder.isRecording ? (
    <View
      style={[
        styles.overlay,
        {
          backgroundColor: theme.dark
            ? "rgba(30,30,30,0.95)"
            : "rgba(245,245,245,0.97)",
        },
      ]}
    >
      {/* Left: recording indicator + duration */}
      <View style={styles.overlayLeft}>
        <Animated.View style={[styles.recordDot, { opacity: dotOpacity }]} />
        <Text
          style={[
            styles.durationText,
            { color: theme.dark ? "#FFF" : "#1a1a1a" },
          ]}
        >
          {voiceRecorder.durationFormatted}
        </Text>
      </View>

      {/* Center: slide-to-cancel (native) or cancel button (web) */}
      {Platform.OS === "web" ? (
        <Pressable onPress={handleWebCancel} style={styles.webCancel}>
          <MaterialCommunityIcons
            name="close-circle"
            size={18}
            color={theme.colors.error}
          />
          <Text style={[styles.cancelLabel, { color: theme.colors.error }]}>
            Cancel
          </Text>
        </Pressable>
      ) : (
        <View style={styles.slideHint}>
          <MaterialCommunityIcons
            name={isCancelling ? "close-circle" : "chevron-left"}
            size={16}
            color={
              isCancelling
                ? theme.colors.error
                : theme.dark
                  ? "rgba(255,255,255,0.35)"
                  : "rgba(0,0,0,0.3)"
            }
          />
          <Text
            style={[
              styles.slideLabel,
              {
                color: isCancelling
                  ? theme.colors.error
                  : theme.dark
                    ? "rgba(255,255,255,0.35)"
                    : "rgba(0,0,0,0.3)",
                opacity: isCancelling ? 1 : 1 - cancelOpacity * 0.5,
              },
            ]}
          >
            {isCancelling ? "Release to cancel" : "Slide to cancel"}
          </Text>
        </View>
      )}
    </View>
  ) : null;

  // ---- Web render ----
  if (Platform.OS === "web") {
    return (
      <View style={[styles.container, style]}>
        {recordingOverlay}
        <Pressable onPress={handleWebClick}>
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <View
              style={[
                styles.micButton,
                {
                  width: size,
                  height: size,
                  backgroundColor: voiceRecorder.isRecording
                    ? theme.colors.error
                    : "transparent",
                },
              ]}
            >
              <MaterialCommunityIcons
                name={voiceRecorder.isRecording ? "stop" : "microphone-outline"}
                size={size * 0.55}
                color={
                  voiceRecorder.isRecording
                    ? "#FFF"
                    : theme.colors.onSurfaceVariant
                }
              />
            </View>
          </Animated.View>
        </Pressable>
      </View>
    );
  }

  // ---- Native render ----
  return (
    <View style={[styles.container, style]}>
      {recordingOverlay}
      <Animated.View
        style={{ transform: [{ scale: scaleAnim }] }}
        {...panResponder.panHandlers}
      >
        <View
          style={[
            styles.micButton,
            {
              width: size,
              height: size,
              backgroundColor: voiceRecorder.isRecording
                ? theme.colors.error
                : "transparent",
            },
          ]}
        >
          <MaterialCommunityIcons
            name={
              voiceRecorder.isRecording ? "microphone" : "microphone-outline"
            }
            size={size * 0.55}
            color={
              voiceRecorder.isRecording ? "#FFF" : theme.colors.onSurfaceVariant
            }
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
  micButton: {
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
  },
  overlay: {
    position: "absolute",
    right: 40,
    top: -6,
    bottom: -6,
    left: -220,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 20,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  overlayLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  recordDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF3B30",
  },
  durationText: {
    fontSize: 15,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  slideHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  slideLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  cancelLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  webCancel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 6,
  },
});

export default VoiceRecordButton;
