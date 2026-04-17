/**
 * VoiceRoomJoinStatusToast
 *
 * Bottom-anchored toast that communicates voice-room join progress.
 *
 * Phases:
 *   connecting — yellow banner while the SDK join is in flight
 *   connected  — green banner shown briefly after success, then auto-dismissed
 *   error      — red banner with Retry/Dismiss actions (same UX as old banner)
 *
 * The component derives its visual phase from the context-level
 * `voiceRoomJoinState`. A `sawJoiningRef` prevents false "Connected" toasts
 * on remounts or when the user was already connected before navigating here.
 *
 * @module components/stream/VoiceRoomJoinStatusToast
 */

import { useAppTheme } from "@/store/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ToastPhase = "hidden" | "connecting" | "connected" | "error";

interface VoiceRoomJoinStatusToastProps {
  voiceRoomJoinState: "idle" | "joining" | "joined" | "error";
  voiceRoomJoinGroupId: string | null;
  voiceRoomJoinError: string | null;
  groupId: string;
  groupName: string;
  onRetry: () => void;
  onDismiss: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How long the green "Connected" toast stays visible before auto-dismissing. */
const CONNECTED_DISPLAY_MS = 2500;

// ---------------------------------------------------------------------------
// Colors (used when theme doesn't supply semantic variants)
// ---------------------------------------------------------------------------

const FALLBACK_COLORS = {
  connectingBg: "#FFF3CD",
  connectingText: "#856404",
  connectedBg: "#D4EDDA",
  connectedText: "#155724",
  errorBg: "#F8D7DA",
  errorText: "#721C24",
} as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VoiceRoomJoinStatusToast({
  voiceRoomJoinState,
  voiceRoomJoinGroupId,
  voiceRoomJoinError,
  groupId,
  groupName,
  onRetry,
  onDismiss,
}: VoiceRoomJoinStatusToastProps) {
  const { colors } = useAppTheme();

  // ── Phase derivation ────────────────────────────────────────────────────
  const [phase, setPhase] = useState<ToastPhase>("hidden");

  // Tracks whether we witnessed the "joining" state for THIS group. Prevents
  // showing a "Connected" toast when the screen mounts while already joined.
  const sawJoiningRef = useRef(false);

  const isThisGroup = voiceRoomJoinGroupId === groupId;

  useEffect(() => {
    if (voiceRoomJoinState === "joining" && isThisGroup) {
      sawJoiningRef.current = true;
      setPhase("connecting");
    } else if (voiceRoomJoinState === "joined" && sawJoiningRef.current) {
      sawJoiningRef.current = false;
      setPhase("connected");
    } else if (voiceRoomJoinState === "error" && isThisGroup) {
      sawJoiningRef.current = false;
      setPhase("error");
    } else if (voiceRoomJoinState === "idle") {
      sawJoiningRef.current = false;
      setPhase("hidden");
    }
  }, [voiceRoomJoinState, isThisGroup]);

  // ── Animation ───────────────────────────────────────────────────────────
  const animValue = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (phase !== "hidden") {
      setMounted(true);
      Animated.spring(animValue, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();
    } else {
      Animated.timing(animValue, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [phase, animValue]);

  // ── Auto-dismiss connected phase ───────────────────────────────────────
  useEffect(() => {
    if (phase !== "connected") return;

    const timer = setTimeout(() => {
      setPhase("hidden");
    }, CONNECTED_DISPLAY_MS);

    return () => clearTimeout(timer);
  }, [phase]);

  // ── Render nothing when fully hidden ───────────────────────────────────
  if (!mounted) return null;

  // ── Phase-specific styling ─────────────────────────────────────────────
  let bgColor: string;
  let textColor: string;
  let icon: React.ReactNode;
  let messageText: string;

  switch (phase) {
    case "connecting":
      bgColor = FALLBACK_COLORS.connectingBg;
      textColor = FALLBACK_COLORS.connectingText;
      icon = (
        <ActivityIndicator
          size={16}
          color={FALLBACK_COLORS.connectingText}
          style={styles.icon}
        />
      );
      messageText = `Connecting to ${groupName} Voice Room\u2026`;
      break;

    case "connected":
      bgColor = FALLBACK_COLORS.connectedBg;
      textColor = FALLBACK_COLORS.connectedText;
      icon = (
        <Ionicons
          name="checkmark-circle"
          size={18}
          color={FALLBACK_COLORS.connectedText}
          style={styles.icon}
        />
      );
      messageText = `Connected to ${groupName} Voice Room`;
      break;

    case "error":
      bgColor =
        colors.errorContainer ??
        (colors as any).error ??
        FALLBACK_COLORS.errorBg;
      textColor = (colors as any).onErrorContainer ?? "#fff";
      icon = (
        <Ionicons
          name="alert-circle"
          size={18}
          color={textColor}
          style={styles.icon}
        />
      );
      messageText = voiceRoomJoinError || "Failed to join voice room";
      break;

    default:
      return null;
  }

  // ── Animated transform ─────────────────────────────────────────────────
  const translateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [60, 0],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: bgColor,
          opacity: animValue,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents="box-none"
    >
      {icon}

      <Text style={[styles.message, { color: textColor }]} numberOfLines={2}>
        {messageText}
      </Text>

      {/* Retry action — error phase only */}
      {phase === "error" && (
        <TouchableOpacity
          onPress={onRetry}
          style={[styles.action, { borderColor: textColor }]}
          accessibilityLabel="Retry joining voice room"
          accessibilityRole="button"
        >
          <Text style={[styles.actionText, { color: textColor }]}>Retry</Text>
        </TouchableOpacity>
      )}

      {/* Dismiss button — error phase only */}
      {phase === "error" && (
        <TouchableOpacity
          onPress={onDismiss}
          style={styles.dismiss}
          accessibilityLabel="Dismiss error"
          accessibilityRole="button"
        >
          <Ionicons name="close" size={18} color={textColor} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 8,
    marginBottom: 8,
    borderRadius: 10,
  },
  icon: {
    marginRight: 8,
  },
  message: {
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "500",
  },
  action: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 8,
  },
  actionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  dismiss: {
    marginLeft: 8,
    padding: 2,
  },
});
