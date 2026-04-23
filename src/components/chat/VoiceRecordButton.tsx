/**
 * VoiceRecordButton Component
 *
 * Hold-to-record mic button. The in-textbox recording overlay (X /
 * lock / duration / locked-mode controls) is rendered SEPARATELY by
 * `VoiceRecordingOverlay` inside the textInputContainer so its bounds
 * always match the composer.  This component only:
 *
 *   1. Renders the mic icon on the right side of the composer.
 *   2. Owns the PanResponder gesture (hold ? measure ? track hover ?
 *      release).
 *   3. Owns the expo-audio recording lifecycle (start / stop / cancel).
 *   4. Publishes UI state to `VoiceRecordingHost` so the overlay reacts.
 *   5. Registers locked-mode send/cancel actions so the overlay can
 *      invoke them.
 *
 * Gesture flow:
 *   - press-and-hold mic ? start recording
 *   - drag left over the X zone ? hoverTarget="cancel"
 *   - drag up over the center lock zone ? hoverTarget="lock"
 *   - release: cancel (target=cancel), lock (target=lock, keep
 *     recording), or stop+send (target=none).
 *
 * Instant-disable gate: the PanResponder's touch-down handler reads a
 * ref fed from the host context's `disabled` flag so gestures are
 * rejected synchronously when text becomes non-empty.
 *
 * @module components/chat/VoiceRecordButton
 */

import { useVoiceRecorder, VoiceRecording } from "@/hooks/useVoiceRecorder";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { memo, useCallback, useEffect, useRef } from "react";
import {
  Animated,
  GestureResponderEvent,
  LayoutRectangle,
  PanResponder,
  PanResponderGestureState,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { useTheme } from "react-native-paper";

import { HoverTarget, useVoiceRecordingHost } from "./VoiceRecordingHost";

// -- Types ---------------------------------------------------------------
export interface VoiceRecordButtonProps {
  onRecordingComplete: (recording: VoiceRecording) => void;
  onRecordingCancelled?: () => void;
  disabled?: boolean;
  size?: number;
  maxDuration?: number;
  style?: StyleProp<ViewStyle>;
}

// -- Constants -----------------------------------------------------------
const DEFAULT_SIZE = 40;
const CANCEL_ZONE_WIDTH = 64;
const LOCK_ZONE_HALF_WIDTH = 32;
const VERTICAL_HOVER_SLACK = 40;

// -- Component -----------------------------------------------------------
export const VoiceRecordButton = memo(function VoiceRecordButton({
  onRecordingComplete,
  onRecordingCancelled,
  disabled = false,
  size = DEFAULT_SIZE,
  maxDuration = 60,
  style,
}: VoiceRecordButtonProps) {
  const theme = useTheme();
  const host = useVoiceRecordingHost();

  const scaleAnim = useRef(new Animated.Value(1)).current;

  const voiceRecorder = useVoiceRecorder({
    maxDuration,
    onRecordingComplete,
    onRecordingCancelled,
  });

  // Host layout, captured at recording-start via measureInWindow.
  const hostLayoutRef = useRef<LayoutRectangle | null>(null);

  // Disabled gate — snapshotted into a ref for synchronous PanResponder
  // rejection.
  const effectiveDisabled = disabled || (host?.disabled ?? false);
  const disabledRef = useRef(effectiveDisabled);
  useEffect(() => {
    disabledRef.current = effectiveDisabled;
  }, [effectiveDisabled]);

  // -- Publish duration updates to the host ------------------------------
  useEffect(() => {
    if (!host) return;
    host.setRecordingState({
      durationFormatted: voiceRecorder.durationFormatted,
    });
  }, [voiceRecorder.durationFormatted, host]);

  // -- Publish recording flag (independent from gesture state) -----------
  useEffect(() => {
    if (!host) return;
    host.setRecordingState({ isRecording: voiceRecorder.isRecording });
    if (!voiceRecorder.isRecording) {
      // Reset ancillary UI when recording stops (either by cancel, send,
      // or natural timeout).
      host.setRecordingState({ hoverTarget: "none", isLocked: false });
    }
  }, [voiceRecorder.isRecording, host]);

  // -- Gesture refs (stable across renders for PanResponder closures) ----
  const hoverTargetRef = useRef<HoverTarget>("none");
  const isLockedRef = useRef(false);
  const isRecordingRef = useRef(voiceRecorder.isRecording);
  useEffect(() => {
    isRecordingRef.current = voiceRecorder.isRecording;
  }, [voiceRecorder.isRecording]);
  // Keep local refs in sync with host-driven state (so PanResponder
  // closures see fresh values without depending on React renders).
  useEffect(() => {
    hoverTargetRef.current = host?.recordingState.hoverTarget ?? "none";
  }, [host?.recordingState.hoverTarget]);
  useEffect(() => {
    isLockedRef.current = host?.recordingState.isLocked ?? false;
  }, [host?.recordingState.isLocked]);

  // -- Measure host bounds (page coords) on recording start --------------
  const measureHost = useCallback(() => {
    const hostView = host?.hostRef?.current;
    if (!hostView) {
      hostLayoutRef.current = null;
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (hostView as any).measureInWindow?.(
      (x: number, y: number, width: number, height: number) => {
        hostLayoutRef.current = { x, y, width, height };
      },
    );
  }, [host]);

  // -- Hover target resolution using captured bounds ---------------------
  const resolveHoverTarget = useCallback(
    (pageX: number, pageY: number): HoverTarget => {
      const bounds = hostLayoutRef.current;
      if (!bounds) return "none";
      const { x, y, width, height } = bounds;

      if (pageY < y - VERTICAL_HOVER_SLACK) return "none";
      if (pageY > y + height + VERTICAL_HOVER_SLACK) return "none";

      const localX = pageX - x;
      if (localX <= CANCEL_ZONE_WIDTH) return "cancel";

      const centerX = width / 2;
      if (
        localX >= centerX - LOCK_ZONE_HALF_WIDTH &&
        localX <= centerX + LOCK_ZONE_HALF_WIDTH
      ) {
        return "lock";
      }
      return "none";
    },
    [],
  );

  // -- Recording lifecycle -----------------------------------------------
  const handlePressIn = useCallback(async () => {
    if (disabledRef.current) return;
    if (!voiceRecorder.isAvailable) {
      voiceRecorder.startRecording();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    measureHost();
    host?.setRecordingState({ hoverTarget: "none", isLocked: false });

    Animated.spring(scaleAnim, {
      toValue: 1.15,
      friction: 6,
      useNativeDriver: true,
    }).start();

    await voiceRecorder.startRecording();
  }, [voiceRecorder, scaleAnim, measureHost, host]);

  const handleRelease = useCallback(
    async (target: HoverTarget) => {
      if (!voiceRecorder.isRecording) return;

      if (target === "lock") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          useNativeDriver: true,
        }).start();
        host?.setRecordingState({ isLocked: true, hoverTarget: "none" });
        return;
      }

      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }).start();

      if (target === "cancel") {
        await voiceRecorder.cancelRecording();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        const recording = await voiceRecorder.stopRecording();
        if (recording && recording.durationMs > 500) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
      host?.setRecordingState({
        hoverTarget: "none",
        isLocked: false,
      });
    },
    [voiceRecorder, scaleAnim, host],
  );

  // -- Locked-mode actions (registered with the host) --------------------
  const handleLockedSend = useCallback(async () => {
    if (!voiceRecorder.isRecording) return;
    const recording = await voiceRecorder.stopRecording();
    if (recording && recording.durationMs > 500) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    host?.setRecordingState({ isLocked: false, hoverTarget: "none" });
  }, [voiceRecorder, host]);

  const handleLockedCancel = useCallback(async () => {
    if (!voiceRecorder.isRecording) return;
    await voiceRecorder.cancelRecording();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    host?.setRecordingState({ isLocked: false, hoverTarget: "none" });
  }, [voiceRecorder, host]);

  // Register actions on the host ref so the overlay's Pressables can
  // invoke them.  Refreshed whenever the handlers change (effectively
  // never — they are stable per voiceRecorder/host identity).
  useEffect(() => {
    if (!host) return;
    host.lockedActionsRef.current = {
      send: handleLockedSend,
      cancel: handleLockedCancel,
    };
    return () => {
      if (host.lockedActionsRef.current.send === handleLockedSend) {
        host.lockedActionsRef.current = {};
      }
    };
  }, [host, handleLockedSend, handleLockedCancel]);

  // -- Gesture handler refs (stable) -------------------------------------
  const handlePressInRef = useRef(handlePressIn);
  const handleReleaseRef = useRef(handleRelease);
  useEffect(() => {
    handlePressInRef.current = handlePressIn;
  }, [handlePressIn]);
  useEffect(() => {
    handleReleaseRef.current = handleRelease;
  }, [handleRelease]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        if (disabledRef.current) return false;
        if (isLockedRef.current) return false;
        return true;
      },
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        if (disabledRef.current) return false;
        if (isLockedRef.current) return false;
        return Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5;
      },
      onPanResponderGrant: () => {
        handlePressInRef.current();
      },
      onPanResponderMove: (
        _e: GestureResponderEvent,
        gs: PanResponderGestureState,
      ) => {
        if (!isRecordingRef.current) return;
        const target = resolveHoverTarget(gs.moveX, gs.moveY);
        if (target !== hoverTargetRef.current) {
          if (target !== "none") Haptics.selectionAsync();
          hoverTargetRef.current = target;
          host?.setRecordingState({ hoverTarget: target });
        }
      },
      onPanResponderRelease: () => {
        handleReleaseRef.current(hoverTargetRef.current);
      },
      onPanResponderTerminate: () => {
        handleReleaseRef.current(hoverTargetRef.current);
      },
    }),
  ).current;

  // -- Web variant (click to toggle) -------------------------------------
  const handleWebClick = useCallback(async () => {
    if (disabledRef.current && !voiceRecorder.isRecording) return;
    if (voiceRecorder.isRecording) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }).start();
      await voiceRecorder.stopRecording();
      host?.setRecordingState({ isLocked: false, hoverTarget: "none" });
    } else {
      if (!voiceRecorder.isAvailable) {
        voiceRecorder.startRecording();
        return;
      }
      measureHost();
      Animated.spring(scaleAnim, {
        toValue: 1.15,
        friction: 6,
        useNativeDriver: true,
      }).start();
      await voiceRecorder.startRecording();
    }
  }, [voiceRecorder, scaleAnim, measureHost, host]);

  // -- Render ------------------------------------------------------------
  if (!voiceRecorder.isAvailable) {
    return (
      <Pressable
        style={[
          styles.micButton,
          { width: size, height: size, opacity: 0.4 },
          style,
        ]}
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

  const isLocked = host?.recordingState.isLocked ?? false;

  if (Platform.OS === "web") {
    return (
      <Pressable
        onPress={handleWebClick}
        disabled={effectiveDisabled}
        style={style}
      >
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
                opacity: effectiveDisabled ? 0.4 : 1,
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
    );
  }

  // Native: hide the mic while locked (the overlay's right-side send/
  // cancel controls take over the visual slot).
  if (isLocked) {
    return <View style={style} />;
  }

  return (
    <Animated.View
      style={[{ transform: [{ scale: scaleAnim }] }, style]}
      {...panResponder.panHandlers}
      pointerEvents={effectiveDisabled ? "none" : "auto"}
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
            opacity: effectiveDisabled ? 0.4 : 1,
          },
        ]}
      >
        <MaterialCommunityIcons
          name={voiceRecorder.isRecording ? "microphone" : "microphone-outline"}
          size={size * 0.55}
          color={
            voiceRecorder.isRecording ? "#FFF" : theme.colors.onSurfaceVariant
          }
        />
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  micButton: {
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default VoiceRecordButton;
