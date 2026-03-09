/**
 * AudioCallScreen - Screen for audio-only calls
 */

import Avatar from "@/components/Avatar";
import { CallControls } from "@/components/calls/CallControls";
import { useCallContext } from "@/contexts/CallContext";
import { useCall } from "@/hooks/calls";
import { useColors } from "@/store/ThemeContext";
import { createLogger } from "@/utils/log";
import { formatDurationSecondsPadded as formatDuration } from "@/utils/time";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import React, { JSX, useEffect } from "react";
import { StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const logger = createLogger("screens/calls/AudioCallScreen");
const logInfo = (msg: string, data?: any) =>
  logger.info(`[AUDIO_CALL] ${msg}`, data ?? "");
const logDebug = (msg: string, data?: any) =>
  __DEV__ && logger.info(`[AUDIO_CALL] ${msg}`, data ?? "");

type AudioCallRouteParams = {
  AudioCall: {
    callId: string;
    participantName?: string;
    isOutgoing?: boolean;
  };
};

export function AudioCallScreen(): JSX.Element {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<AudioCallRouteParams, "AudioCall">>();
  const colors = useColors();
  const { callId, participantName, isOutgoing } = route.params;

  const { currentCall, incomingCall } = useCallContext();
  const {
    isConnecting,
    isConnected,
    isMuted,
    isSpeakerOn,
    callDuration,
    endCall,
    toggleMute,
    toggleSpeaker,
  } = useCall();

  const call = currentCall || incomingCall;

  // Log screen lifecycle
  useEffect(() => {
    logInfo("AudioCallScreen mounted", { callId, participantName, isOutgoing });
    return () => logInfo("AudioCallScreen unmounted", { callId });
  }, [callId]);

  // Handle call ended
  useEffect(() => {
    if (!call && !isConnecting) {
      logInfo("Call ended, navigating back", { callId });
      // Call ended, go back
      navigation.goBack();
    }
  }, [call, isConnecting, navigation]);

  // Get other participant info
  // For 1:1 DM calls: if we initiated (isOutgoing), the other person is NOT the callerId.
  // If we received the call, the other person IS the callerId.
  const otherParticipant = call
    ? (() => {
        const participants = Object.values(call.participants);
        if (isOutgoing) {
          // We are the caller — show the other person
          return participants.find((p) => p.odId !== call.callerId) || null;
        } else {
          // We received the call — show the caller
          return call.participants[call.callerId] || null;
        }
      })()
    : null;

  const displayName =
    otherParticipant?.displayName || participantName || "Unknown";

  // Get status text
  const getStatusText = (): string => {
    if (!call) return "Ending...";

    switch (call.status) {
      case "ringing":
        return isOutgoing ? "Ringing..." : "Incoming call...";
      case "connecting":
        return "Connecting...";
      case "connected":
        return formatDuration(callDuration);
      case "ended":
        return "Call ended";
      case "declined":
        return "Call declined";
      case "missed":
        return "Call missed";
      case "failed":
        return "Call failed";
      default:
        return "";
    }
  };

  const handleEndCall = async () => {
    await endCall();
    navigation.goBack();
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.callType}>Voice Call</Text>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          <View style={styles.avatarRing}>
            {otherParticipant?.avatarConfig ? (
              <Avatar config={otherParticipant.avatarConfig} size={150} />
            ) : (
              <View
                style={{
                  width: 150,
                  height: 150,
                  borderRadius: 75,
                  backgroundColor: colors.primary,
                }}
              />
            )}
          </View>
        </View>

        {/* Name */}
        <Text style={[styles.participantName, { color: colors.text }]}>
          {displayName}
        </Text>

        {/* Status */}
        <Text style={[styles.status, { color: colors.textSecondary }]}>
          {getStatusText()}
        </Text>

        {/* Audio Wave Animation (placeholder) */}
        {isConnected && (
          <View style={styles.audioWaveContainer}>
            <View
              style={[
                styles.audioWave,
                styles.audioWave1,
                { backgroundColor: colors.primary },
              ]}
            />
            <View
              style={[
                styles.audioWave,
                styles.audioWave2,
                { backgroundColor: colors.primary },
              ]}
            />
            <View
              style={[
                styles.audioWave,
                styles.audioWave3,
                { backgroundColor: colors.primary },
              ]}
            />
          </View>
        )}
      </View>

      {/* Controls */}
      <CallControls
        isMuted={isMuted}
        isSpeakerOn={isSpeakerOn}
        isVideoEnabled={false}
        isVideoCall={false}
        onToggleMute={toggleMute}
        onToggleSpeaker={toggleSpeaker}
        onToggleVideo={() => {}}
        onEndCall={handleEndCall}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    alignItems: "center",
  },
  callType: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.6)",
    fontWeight: "500",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  avatarContainer: {
    marginBottom: 32,
  },
  avatarRing: {
    padding: 12,
    borderRadius: 100,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  participantName: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  status: {
    fontSize: 18,
    textAlign: "center",
    marginBottom: 32,
  },
  audioWaveContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 40,
  },
  audioWave: {
    width: 4,
    borderRadius: 2,
  },
  audioWave1: {
    height: 20,
  },
  audioWave2: {
    height: 32,
  },
  audioWave3: {
    height: 24,
  },
});
