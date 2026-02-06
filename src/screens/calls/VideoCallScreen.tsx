/**
 * VideoCallScreen - Screen for video calls
 */

import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import React, { JSX, useEffect } from "react";
import {
  ActivityIndicator,
  Dimensions,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RTCView } from "react-native-webrtc";
import Avatar from "../../components/Avatar";
import { CallControls } from "../../components/calls/CallControls";
import {
  CallQualityIndicator,
  NetworkQuality,
} from "../../components/calls/CallQualityIndicator";
import { useCallContext } from "../../contexts/CallContext";
import {
  useCall,
  useLocalMedia,
  useRemoteParticipants,
} from "../../hooks/calls";
import { useColors } from "../../store/ThemeContext";
import { formatDurationSecondsPadded as formatDuration } from "../../utils/time";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type VideoCallRouteParams = {
  VideoCall: {
    callId: string;
    participantName?: string;
    isOutgoing?: boolean;
  };
};

export function VideoCallScreen(): JSX.Element {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<VideoCallRouteParams, "VideoCall">>();
  const { callId, participantName, isOutgoing } = route.params;
  const colors = useColors();

  const {
    currentCall,
    incomingCall,
    isReconnecting,
    reconnectionAttempts,
    networkQuality,
    heldCalls,
  } = useCallContext();
  const {
    isConnecting,
    isConnected,
    isMuted,
    isSpeakerOn,
    isVideoEnabled,
    callDuration,
    endCall,
    toggleMute,
    toggleSpeaker,
    toggleVideo,
    switchCamera,
  } = useCall();

  const { localStream } = useLocalMedia();
  const { participants } = useRemoteParticipants();

  const call = currentCall || incomingCall;

  // Map network quality to component type
  const mapQualityToIndicator = (quality: string): NetworkQuality => {
    switch (quality) {
      case "good":
        return "excellent";
      case "fair":
        return "fair";
      case "poor":
        return "poor";
      default:
        return "unknown";
    }
  };

  // Handle call ended
  useEffect(() => {
    if (!call && !isConnecting) {
      navigation.goBack();
    }
  }, [call, isConnecting, navigation]);

  // Get other participant
  const remoteParticipant = participants[0];
  const displayName =
    remoteParticipant?.displayName || participantName || "Unknown";

  // Get status text
  const getStatusText = (): string => {
    if (!call) return "Ending...";

    if (isReconnecting) {
      return `Reconnecting... (${reconnectionAttempts}/5)`;
    }

    switch (call.status) {
      case "ringing":
        return isOutgoing ? "Ringing..." : "Incoming call...";
      case "connecting":
        return "Connecting...";
      case "connected":
        return formatDuration(callDuration);
      default:
        return "";
    }
  };

  const handleEndCall = async () => {
    await endCall();
    navigation.goBack();
  };

  // Get local stream URL for RTCView
  const localStreamUrl = localStream?.toURL() || "";
  const remoteStreamUrl = remoteParticipant?.stream?.toURL() || "";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000" translucent />

      {/* Remote Video (Full Screen) */}
      {remoteStreamUrl && isConnected ? (
        <RTCView
          streamURL={remoteStreamUrl}
          style={styles.remoteVideo}
          objectFit="cover"
          zOrder={0}
        />
      ) : (
        <View
          style={[
            styles.remoteVideoPlaceholder,
            { backgroundColor: colors.background },
          ]}
        >
          {/* Show avatar when no video */}
          <View style={styles.avatarContainer}>
            {remoteParticipant?.avatarConfig ? (
              <Avatar config={remoteParticipant.avatarConfig} size={120} />
            ) : (
              <View
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 60,
                  backgroundColor: colors.primary,
                }}
              />
            )}
          </View>
          <Text style={[styles.participantName, { color: colors.text }]}>
            {displayName}
          </Text>
          <Text style={[styles.status, { color: colors.textSecondary }]}>
            {getStatusText()}
          </Text>
        </View>
      )}

      {/* Header Overlay */}
      <SafeAreaView style={styles.headerOverlay} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={[styles.headerName, { color: colors.text }]}>
              {displayName}
            </Text>
            <View style={styles.headerStatusRow}>
              {isReconnecting && (
                <ActivityIndicator
                  size="small"
                  color="#fff"
                  style={styles.reconnectingIndicator}
                />
              )}
              <Text
                style={[
                  styles.headerStatus,
                  { color: colors.textSecondary },
                  isReconnecting && { color: colors.warning },
                ]}
              >
                {getStatusText()}
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            {isConnected && !isReconnecting && (
              <CallQualityIndicator
                quality={mapQualityToIndicator(networkQuality)}
                size="small"
                showLabel={false}
              />
            )}
          </View>
        </View>

        {/* Held calls indicator */}
        {heldCalls.length > 0 && (
          <View style={styles.heldCallsBanner}>
            <Ionicons name="pause-circle" size={16} color={colors.warning} />
            <Text style={[styles.heldCallsText, { color: colors.warning }]}>
              {heldCalls.length} call{heldCalls.length > 1 ? "s" : ""} on hold
            </Text>
          </View>
        )}
      </SafeAreaView>

      {/* Local Video (Picture-in-Picture) */}
      {isVideoEnabled && localStreamUrl && (
        <View
          style={[
            styles.localVideoContainer,
            { backgroundColor: colors.surfaceVariant },
          ]}
        >
          <RTCView
            streamURL={localStreamUrl}
            style={styles.localVideo}
            objectFit="cover"
            mirror={true}
            zOrder={1}
          />
          <TouchableOpacity
            style={styles.switchCameraButton}
            onPress={switchCamera}
          >
            <Ionicons name="camera-reverse" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Controls Overlay */}
      <View style={styles.controlsOverlay}>
        <CallControls
          isMuted={isMuted}
          isSpeakerOn={isSpeakerOn}
          isVideoEnabled={isVideoEnabled}
          isVideoCall={true}
          onToggleMute={toggleMute}
          onToggleSpeaker={toggleSpeaker}
          onToggleVideo={toggleVideo}
          onEndCall={handleEndCall}
          onSwitchCamera={switchCamera}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Remote video
  remoteVideo: {
    flex: 1,
  },
  remoteVideoPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarContainer: {
    marginBottom: 24,
  },
  participantName: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 8,
  },
  status: {
    fontSize: 16,
  },

  // Header overlay
  headerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingTop: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerName: {
    fontSize: 16,
    fontWeight: "600",
  },
  headerStatus: {
    fontSize: 14,
    marginTop: 2,
  },
  headerStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  reconnectingIndicator: {
    marginRight: 6,
  },
  reconnectingText: {
    // Color set dynamically
  },
  headerRight: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  heldCallsBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  heldCallsText: {
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 8,
  },

  // Local video (PiP)
  localVideoContainer: {
    position: "absolute",
    top: 100,
    right: 16,
    width: 100,
    height: 150,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.3)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 20,
  },
  localVideo: {
    flex: 1,
  },
  switchCameraButton: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Controls overlay
  controlsOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
});
