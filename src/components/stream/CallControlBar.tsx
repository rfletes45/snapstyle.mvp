/**
 * CallControlBar
 *
 * Polished, reusable bottom control bar for active calls and voice rooms.
 * Provides consistent hierarchy:
 *   - Core media toggles: mic, camera (when applicable)
 *   - Secondary: speaker route, camera flip, screen share
 *   - Primary destructive: leave / end call
 *
 * All controls reflect real capability and current state.
 * Disabled states shown with explanatory opacity, not hidden.
 */

import type { ThemeColors } from "@/store/ThemeContext";
import { useAppTheme } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CallControlBarProps {
  /** Whether mic is currently muted */
  isMuted: boolean;
  /** Toggle mic on/off */
  onToggleMic: () => void;

  /** Whether camera is off */
  isCameraOff?: boolean;
  /** Toggle camera on/off — omit to hide camera control */
  onToggleCamera?: () => void;
  /** Whether camera control should be shown */
  showCamera?: boolean;

  /** Whether speaker is active (vs earpiece) */
  isSpeakerOn?: boolean;
  /** Toggle speaker route */
  onToggleSpeaker?: () => void;
  /** Whether speaker control should be shown */
  showSpeaker?: boolean;

  /** Flip between front/back camera */
  onFlipCamera?: () => void;
  /** Whether flip is available (camera must be on) */
  showFlipCamera?: boolean;

  /** Whether screen share is currently active */
  isScreenSharing?: boolean;
  /** Toggle screen share */
  onToggleScreenShare?: () => void;
  /** Whether screen share control should be shown */
  showScreenShare?: boolean;
  /** Reason screen share is unavailable */
  screenShareDisabledReason?: string;

  /** Disable mic control (e.g., before call is fully joined) */
  micDisabled?: boolean;

  /** Leave / end call action */
  onLeave: () => void;
  /** Label for leave button (default: "Leave") */
  leaveLabel?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CallControlBar({
  isMuted,
  onToggleMic,
  isCameraOff = true,
  onToggleCamera,
  showCamera = false,
  isSpeakerOn = false,
  onToggleSpeaker,
  showSpeaker = false,
  onFlipCamera,
  showFlipCamera = false,
  isScreenSharing = false,
  onToggleScreenShare,
  showScreenShare = false,
  screenShareDisabledReason,
  micDisabled = false,
  onLeave,
  leaveLabel = "Leave",
}: CallControlBarProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  const isScreenShareDisabled = showScreenShare && !!screenShareDisabledReason;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, 12) + 8,
        },
      ]}
    >
      <View style={styles.controlsRow}>
        {/* ── Mic Toggle ─────────────────────────────────── */}
        <ControlPill
          icon={isMuted ? "microphone-off" : "microphone"}
          label={isMuted ? "Unmute" : "Mute"}
          isActive={isMuted}
          activeColor="#E53935"
          onPress={onToggleMic}
          disabled={micDisabled}
          colors={colors}
        />

        {/* ── Camera Toggle ──────────────────────────────── */}
        {showCamera && onToggleCamera && (
          <ControlPill
            icon={isCameraOff ? "camera-off" : "camera"}
            label={isCameraOff ? "Start Video" : "Stop Video"}
            isActive={!isCameraOff}
            activeColor={colors.primary}
            onPress={onToggleCamera}
            colors={colors}
          />
        )}

        {/* ── Speaker Toggle ─────────────────────────────── */}
        {showSpeaker && onToggleSpeaker && (
          <ControlPill
            icon={isSpeakerOn ? "volume-high" : "volume-medium"}
            label="Speaker"
            isActive={isSpeakerOn}
            activeColor={colors.primary}
            onPress={onToggleSpeaker}
            colors={colors}
          />
        )}

        {/* ── Camera Flip ────────────────────────────────── */}
        {showFlipCamera && onFlipCamera && !isCameraOff && (
          <ControlPill
            icon="camera-flip"
            label="Flip"
            onPress={onFlipCamera}
            colors={colors}
          />
        )}

        {/* ── Screen Share ───────────────────────────────── */}
        {showScreenShare && onToggleScreenShare && (
          <ControlPill
            icon={isScreenSharing ? "monitor-off" : "monitor-share"}
            label={isScreenSharing ? "Stop Share" : "Share"}
            isActive={isScreenSharing}
            activeColor="#FF9800"
            disabled={isScreenShareDisabled}
            disabledReason={screenShareDisabledReason}
            onPress={onToggleScreenShare}
            colors={colors}
          />
        )}

        {/* ── Leave / End ────────────────────────────────── */}
        <Pressable
          onPress={onLeave}
          style={({ pressed }) => [
            styles.leaveButton,
            pressed && styles.leaveButtonPressed,
          ]}
          accessibilityLabel={leaveLabel}
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name="phone-hangup" size={24} color="#fff" />
          <Text style={styles.leaveLabel}>{leaveLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// ControlPill — individual toggle button
// ---------------------------------------------------------------------------

interface ControlPillProps {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress: () => void;
  isActive?: boolean;
  activeColor?: string;
  disabled?: boolean;
  disabledReason?: string;
  colors: ThemeColors;
}

function ControlPill({
  icon,
  label,
  onPress,
  isActive = false,
  activeColor,
  disabled = false,
  colors,
}: ControlPillProps) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: isActive
            ? activeColor
              ? `${activeColor}20`
              : `${colors.primary}20`
            : `${colors.text}10`,
        },
        pressed && !disabled && styles.pillPressed,
        disabled && styles.pillDisabled,
      ]}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive, disabled }}
    >
      <MaterialCommunityIcons
        name={icon}
        size={22}
        color={
          disabled
            ? `${colors.textSecondary}80`
            : isActive && activeColor
              ? activeColor
              : colors.text
        }
      />
      <Text
        style={[
          styles.pillLabel,
          {
            color: disabled
              ? `${colors.textSecondary}80`
              : isActive && activeColor
                ? activeColor
                : colors.textSecondary,
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingHorizontal: 12,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  pill: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    minWidth: 62,
  },
  pillPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.96 }],
  },
  pillDisabled: {
    opacity: 0.4,
  },
  pillLabel: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 3,
    textAlign: "center",
  },
  leaveButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E53935",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 16,
    minWidth: 62,
    ...Platform.select({
      ios: {
        shadowColor: "#E53935",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  leaveButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  leaveLabel: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 3,
  },
});
