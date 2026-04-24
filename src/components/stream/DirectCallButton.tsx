/**
 * Direct Call Button
 *
 * Entry point for 1:1 calls from DM headers, profiles, etc.
 * Replaces the legacy CallButton / CallButtonGroup components.
 */

import { CALL_FEATURES } from "@/constants/featureFlags";
import { useStreamCall } from "@/contexts/StreamCallContext";
import { useAppTheme } from "@/store/ThemeContext";
import type { DirectCallMode } from "@/types/streamCall";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import { Alert, StyleSheet, TouchableOpacity, View } from "react-native";

interface DirectCallButtonProps {
  recipientId: string;
  recipientName: string;
  /** Callback after call is started — navigate to DirectCall screen */
  onCallStarted: (callId: string, mode: DirectCallMode) => void;
  /** Show only audio, only video, or both */
  modes?: DirectCallMode[];
  size?: number;
  disabled?: boolean;
}

export default function DirectCallButton({
  recipientId,
  recipientName,
  onCallStarted,
  modes = ["audio", "video"],
  size = 24,
  disabled = false,
}: DirectCallButtonProps) {
  const { startCall, isBusy, isReady } = useStreamCall();
  const { colors } = useAppTheme();
  const [starting, setStarting] = useState(false);

  const isDisabled = disabled || !isReady || isBusy || starting;

  const handleCall = useCallback(
    async (mode: DirectCallMode) => {
      if (isDisabled) return;

      if (isBusy) {
        Alert.alert(
          "Already in a call",
          "Please end your current call before starting a new one.",
        );
        return;
      }

      setStarting(true);
      try {
        const callId = await startCall(recipientId, mode, recipientName);
        onCallStarted(callId, mode);
      } catch (err: any) {
        Alert.alert(
          "Call Failed",
          err?.message || "Unable to start call. Please try again.",
        );
      } finally {
        setStarting(false);
      }
    },
    [isDisabled, isBusy, startCall, recipientId, recipientName, onCallStarted],
  );

  if (!CALL_FEATURES.CALLS_ENABLED) return null;

  return (
    <View style={styles.container}>
      {modes.includes("audio") && CALL_FEATURES.DIRECT_CALLS_ENABLED && (
        <TouchableOpacity
          style={[styles.button, isDisabled && styles.buttonDisabled]}
          onPress={() => handleCall("audio")}
          disabled={isDisabled}
          activeOpacity={0.7}
          hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
        >
          <MaterialCommunityIcons
            name="phone"
            size={size}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      )}

      {modes.includes("video") && CALL_FEATURES.DIRECT_CALLS_ENABLED && (
        <TouchableOpacity
          style={[styles.button, isDisabled && styles.buttonDisabled]}
          onPress={() => handleCall("video")}
          disabled={isDisabled}
          activeOpacity={0.7}
          hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
        >
          <MaterialCommunityIcons
            name="video"
            size={size}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  button: {
    padding: 8,
    borderRadius: 20,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
});
