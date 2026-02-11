/**
 * CallButton - Button to initiate audio/video calls from chat screens
 */

import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import Constants from "expo-constants";
import React, { JSX, useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useCall } from "@/hooks/calls";
import { useColors } from "@/store/ThemeContext";
import { CALL_FEATURES } from "@/constants/featureFlags";


import { createLogger } from "@/utils/log";
const logger = createLogger("components/calls/CallButton");
// Platform detection for native calls
const isWeb = Platform.OS === "web";
const isExpoGo = Constants.appOwnership === "expo";
const areNativeCallsAvailable = !isWeb && !isExpoGo;

interface CallButtonProps {
  /** The conversation ID (chat or group) */
  conversationId: string;
  /** The participant's user ID (for DM calls) */
  participantId: string;
  /** The participant's display name */
  participantName: string;
  /** Whether this is a video call button */
  isVideo?: boolean;
  /** Icon size */
  size?: number;
  /** Custom color */
  color?: string;
  /** Disabled state */
  disabled?: boolean;
}

export function CallButton({
  conversationId,
  participantId,
  participantName,
  isVideo = false,
  size = 24,
  color,
  disabled = false,
}: CallButtonProps): JSX.Element {
  const navigation = useNavigation<any>();
  const { hasActiveCall, startAudioCall, startVideoCall } = useCall();
  const [isStarting, setIsStarting] = useState(false);
  const colors = useColors();

  // Use provided color or default to theme primary
  const buttonColor = color || colors.primary;

  const handlePress = useCallback(async () => {
    // Check if native calls are available (not in Expo Go or web)
    if (!areNativeCallsAvailable) {
      Alert.alert(
        "Calls Not Available",
        `Video and audio calls require a development build and are not available in ${isWeb ? "web browsers" : "Expo Go"}. Please use a development build to make calls.`,
        [{ text: "OK" }],
      );
      return;
    }

    if (hasActiveCall) {
      Alert.alert(
        "Call in Progress",
        "You already have an active call. Please end it before starting a new one.",
        [{ text: "OK" }],
      );
      return;
    }

    setIsStarting(true);

    try {
      const callId = isVideo
        ? await startVideoCall(conversationId, participantId)
        : await startAudioCall(conversationId, participantId);

      // Navigate directly to the call screen (screens are at root stack level)
      navigation.navigate(isVideo ? "VideoCall" : "AudioCall", {
        callId,
        participantName,
        isOutgoing: true,
      });
    } catch (error) {
      logger.error("Failed to start call:", error);
      Alert.alert(
        "Call Failed",
        "Unable to start the call. Please check your connection and try again.",
        [{ text: "OK" }],
      );
    } finally {
      setIsStarting(false);
    }
  }, [
    conversationId,
    participantId,
    participantName,
    isVideo,
    hasActiveCall,
    startAudioCall,
    startVideoCall,
    navigation,
  ]);

  if (isStarting) {
    return (
      <View style={styles.button}>
        <ActivityIndicator size="small" color={buttonColor} />
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={handlePress}
      disabled={disabled || isStarting}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityLabel={isVideo ? "Start video call" : "Start voice call"}
      accessibilityRole="button"
    >
      <Ionicons
        name={isVideo ? "videocam" : "call"}
        size={size}
        color={disabled ? colors.textSecondary : buttonColor}
      />
    </TouchableOpacity>
  );
}

/**
 * CallButtonGroup - Shows both audio and video call buttons
 */
interface CallButtonGroupProps {
  conversationId: string;
  participantId: string;
  participantName: string;
  size?: number;
  disabled?: boolean;
}

export function CallButtonGroup({
  conversationId,
  participantId,
  participantName,
  size = 22,
  disabled = false,
}: CallButtonGroupProps): JSX.Element | null {
  if (!CALL_FEATURES.CALLS_ENABLED) {
    return null;
  }

  return (
    <View style={styles.buttonGroup}>
      <CallButton
        conversationId={conversationId}
        participantId={participantId}
        participantName={participantName}
        isVideo={false}
        size={size}
        disabled={disabled}
      />
      <View style={styles.buttonSpacer} />
      <CallButton
        conversationId={conversationId}
        participantId={participantId}
        participantName={participantName}
        isVideo={true}
        size={size}
        disabled={disabled}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 40,
    minHeight: 40,
  },
  buttonGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  buttonSpacer: {
    width: 4,
  },
});
