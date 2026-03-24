/**
 * Direct Call Screen
 *
 * Unified screen for active 1:1 audio and video calls using Stream Video.
 * Replaces the legacy AudioCallScreen and VideoCallScreen.
 *
 * Handles:
 * - Outgoing ringing state
 * - Active audio call UI (avatar + controls)
 * - Active video call UI (remote video + local PiP)
 * - Call controls: mute, speaker, camera toggle, end call
 * - Call duration timer
 */

import { useStreamCall } from "@/contexts/StreamCallContext";
import { useAppTheme } from "@/store/ThemeContext";
import type { MainStackParamList } from "@/types/navigation/root";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  CallContent,
  CallingState,
  StreamCall,
  useCallStateHooks,
} from "@stream-io/video-react-native-sdk";
import React, { useCallback, useEffect, useState } from "react";
import {
  Dimensions,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type Props = NativeStackScreenProps<MainStackParamList, "DirectCall">;

export default function DirectCallScreen({ route, navigation }: Props) {
  const { callId, recipientName, mode, isOutgoing } = route.params as {
    callId: string;
    recipientName: string;
    mode: "audio" | "video";
    isOutgoing: boolean;
  };

  const { endCall, activeCall } = useStreamCall();
  const { colors } = useAppTheme();

  const handleEndCall = useCallback(async () => {
    try {
      await endCall();
    } catch (err) {
      console.error("[DirectCallScreen] endCall error:", err);
    } finally {
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    }
  }, [endCall, navigation]);

  // Auto-dismiss if no active call
  useEffect(() => {
    if (!activeCall) {
      const timer = setTimeout(() => {
        if (navigation.canGoBack()) navigation.goBack();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [activeCall, navigation]);

  if (!activeCall) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.centered}>
          <Text style={[styles.statusText, { color: colors.text }]}>
            Call ended
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <StreamCall call={activeCall}>
      <DirectCallContent
        recipientName={recipientName}
        mode={mode}
        isOutgoing={isOutgoing}
        onEndCall={handleEndCall}
      />
    </StreamCall>
  );
}

// ---------------------------------------------------------------------------
// Inner content (must be inside StreamCall provider)
// ---------------------------------------------------------------------------

function DirectCallContent({
  recipientName,
  mode,
  isOutgoing,
  onEndCall,
}: {
  recipientName: string;
  mode: "audio" | "video";
  isOutgoing: boolean;
  onEndCall: () => void;
}) {
  const { colors } = useAppTheme();
  const { useCallCallingState, useMicrophoneState, useCameraState } =
    useCallStateHooks();

  const callingState = useCallCallingState();
  const { isMute: isMuted, microphone } = useMicrophoneState();
  const { isMute: isCameraOff, camera } = useCameraState();
  const isVideo = mode === "video";

  // Duration timer
  const [duration, setDuration] = useState(0);
  const isJoined = callingState === CallingState.JOINED;

  useEffect(() => {
    if (!isJoined) return;
    const interval = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, [isJoined]);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Derive status text
  const getStatusText = () => {
    switch (callingState) {
      case CallingState.RINGING:
        return isOutgoing ? "Ringing..." : "Incoming call...";
      case CallingState.JOINING:
        return "Connecting...";
      case CallingState.JOINED:
        return formatDuration(duration);
      case CallingState.RECONNECTING:
        return "Reconnecting...";
      case CallingState.LEFT:
        return "Call ended";
      default:
        return "";
    }
  };

  // Notify parent when Stream reports call ended — parent handles navigation
  useEffect(() => {
    if (
      callingState === CallingState.LEFT ||
      callingState === CallingState.IDLE
    ) {
      onEndCall();
    }
  }, [callingState, onEndCall]);

  // For video calls, use Stream's built-in CallContent UI
  if (isVideo && isJoined) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: "#000" }]}>
        <CallContent onHangupCallHandler={onEndCall} />
      </SafeAreaView>
    );
  }

  // Audio call UI (or ringing/connecting state)
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={styles.topSection}>
        <Text
          style={[styles.recipientName, { color: colors.text }]}
          numberOfLines={1}
        >
          {recipientName}
        </Text>
        <Text style={[styles.statusText, { color: colors.textSecondary }]}>
          {getStatusText()}
        </Text>
      </View>

      {/* Avatar placeholder */}
      <View style={styles.avatarSection}>
        <View
          style={[styles.avatarCircle, { backgroundColor: colors.primary }]}
        >
          <MaterialCommunityIcons name="account" size={64} color="#fff" />
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlButton, isMuted && styles.controlButtonActive]}
          onPress={() => microphone.toggle()}
        >
          <MaterialCommunityIcons
            name={isMuted ? "microphone-off" : "microphone"}
            size={28}
            color={isMuted ? "#E53935" : colors.text}
          />
          <Text style={[styles.controlLabel, { color: colors.textSecondary }]}>
            {isMuted ? "Unmute" : "Mute"}
          </Text>
        </TouchableOpacity>

        {isVideo && (
          <TouchableOpacity
            style={[
              styles.controlButton,
              isCameraOff && styles.controlButtonActive,
            ]}
            onPress={() => camera.toggle()}
          >
            <MaterialCommunityIcons
              name={isCameraOff ? "camera-off" : "camera"}
              size={28}
              color={isCameraOff ? "#E53935" : colors.text}
            />
            <Text
              style={[styles.controlLabel, { color: colors.textSecondary }]}
            >
              Camera
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.controlButton, styles.endCallButton]}
          onPress={onEndCall}
        >
          <MaterialCommunityIcons name="phone-hangup" size={28} color="#fff" />
          <Text style={[styles.controlLabel, { color: "#fff" }]}>End</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  topSection: {
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 20 : 40,
    paddingBottom: 20,
  },
  recipientName: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 6,
  },
  statusText: {
    fontSize: 16,
    fontWeight: "500",
  },
  avatarSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: "center",
    alignItems: "center",
  },
  controls: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    paddingVertical: 30,
    paddingBottom: Platform.OS === "ios" ? 50 : 30,
  },
  controlButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(128,128,128,0.15)",
  },
  controlButtonActive: {
    backgroundColor: "rgba(229,57,53,0.15)",
  },
  endCallButton: {
    backgroundColor: "#E53935",
  },
  controlLabel: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: "500",
  },
});
