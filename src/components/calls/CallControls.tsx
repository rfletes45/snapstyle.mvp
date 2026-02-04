/**
 * CallControls - Control buttons for active calls
 * Mute, speaker, video toggle, end call, etc.
 */

import { Ionicons } from "@expo/vector-icons";
import React, { JSX } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "../../store/ThemeContext";

interface CallControlsProps {
  /** Is microphone muted */
  isMuted: boolean;
  /** Is speaker on */
  isSpeakerOn: boolean;
  /** Is video enabled */
  isVideoEnabled: boolean;
  /** Is this a video call */
  isVideoCall: boolean;
  /** Toggle mute callback */
  onToggleMute: () => void;
  /** Toggle speaker callback */
  onToggleSpeaker: () => void;
  /** Toggle video callback */
  onToggleVideo: () => void;
  /** End call callback */
  onEndCall: () => void;
  /** Switch camera callback (optional) */
  onSwitchCamera?: () => void;
  /** Additional style */
  style?: object;
}

export function CallControls({
  isMuted,
  isSpeakerOn,
  isVideoEnabled,
  isVideoCall,
  onToggleMute,
  onToggleSpeaker,
  onToggleVideo,
  onEndCall,
  onSwitchCamera,
  style,
}: CallControlsProps): JSX.Element {
  const insets = useSafeAreaInsets();
  const colors = useColors();

  return (
    <View
      style={[styles.container, { paddingBottom: insets.bottom + 20 }, style]}
    >
      <View style={styles.controlsRow}>
        {/* Mute Button */}
        <ControlButton
          icon={isMuted ? "mic-off" : "mic"}
          label={isMuted ? "Unmute" : "Mute"}
          onPress={onToggleMute}
          isActive={isMuted}
          activeColor={colors.error}
        />

        {/* Speaker Button */}
        <ControlButton
          icon={isSpeakerOn ? "volume-high" : "volume-medium"}
          label="Speaker"
          onPress={onToggleSpeaker}
          isActive={isSpeakerOn}
          activeColor={colors.primary}
        />

        {/* Video Toggle (only for video calls) */}
        {isVideoCall && (
          <ControlButton
            icon={isVideoEnabled ? "videocam" : "videocam-off"}
            label={isVideoEnabled ? "Video On" : "Video Off"}
            onPress={onToggleVideo}
            isActive={!isVideoEnabled}
            activeColor={colors.error}
          />
        )}

        {/* Switch Camera (only for video calls when video is enabled) */}
        {isVideoCall && isVideoEnabled && onSwitchCamera && (
          <ControlButton
            icon="camera-reverse"
            label="Flip"
            onPress={onSwitchCamera}
          />
        )}
      </View>

      {/* End Call Button */}
      <TouchableOpacity
        style={[styles.endCallButton, { backgroundColor: colors.error }]}
        onPress={onEndCall}
        activeOpacity={0.8}
        accessibilityLabel="End call"
        accessibilityRole="button"
      >
        <Ionicons
          name="call"
          size={32}
          color="#fff"
          style={styles.endCallIcon}
        />
      </TouchableOpacity>
    </View>
  );
}

// ============================================================================
// Control Button Component
// ============================================================================

interface ControlButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  isActive?: boolean;
  activeColor?: string;
  disabled?: boolean;
}

function ControlButton({
  icon,
  label,
  onPress,
  isActive = false,
  activeColor,
  disabled = false,
}: ControlButtonProps): JSX.Element {
  return (
    <TouchableOpacity
      style={[
        styles.controlButton,
        isActive && activeColor && { backgroundColor: activeColor },
        disabled && styles.controlButtonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
    >
      <Ionicons name={icon} size={24} color={isActive ? "#fff" : "#fff"} />
      <Text
        style={[styles.controlLabel, isActive && styles.controlLabelActive]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ============================================================================
// Minimal Controls (for floating/compact view)
// ============================================================================

interface MinimalCallControlsProps {
  isMuted: boolean;
  onToggleMute: () => void;
  onEndCall: () => void;
}

export function MinimalCallControls({
  isMuted,
  onToggleMute,
  onEndCall,
}: MinimalCallControlsProps): JSX.Element {
  const colors = useColors();

  return (
    <View style={styles.minimalContainer}>
      <TouchableOpacity
        style={[
          styles.minimalButton,
          isMuted && { backgroundColor: colors.error },
        ]}
        onPress={onToggleMute}
      >
        <Ionicons name={isMuted ? "mic-off" : "mic"} size={20} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.minimalButton, { backgroundColor: colors.error }]}
        onPress={onEndCall}
      >
        <Ionicons
          name="call"
          size={20}
          color="#fff"
          style={{ transform: [{ rotate: "135deg" }] }}
        />
      </TouchableOpacity>
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: 20,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
    marginBottom: 24,
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  controlButtonDisabled: {
    opacity: 0.5,
  },
  controlLabel: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 10,
    marginTop: 4,
    textAlign: "center",
  },
  controlLabelActive: {
    color: "#fff",
  },
  endCallButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    shadowColor: "#FF3B30",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  endCallIcon: {
    transform: [{ rotate: "135deg" }],
  },

  // Minimal controls
  minimalContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  minimalButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
});
