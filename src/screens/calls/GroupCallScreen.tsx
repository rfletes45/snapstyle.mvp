/**
 * GroupCallScreen - Screen for group video/audio calls
 * Supports grid layout, speaker view, participant management, and host controls
 */

import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import React, { JSX, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MediaStream } from "react-native-webrtc";
import { CallControls } from "../../components/calls/CallControls";
import {
  CallQualityIndicator,
  NetworkQuality,
} from "../../components/calls/CallQualityIndicator";
import { ParticipantListOverlay } from "../../components/calls/ParticipantListOverlay";
import { SpeakerView } from "../../components/calls/SpeakerView";
import { VideoGrid } from "../../components/calls/VideoGrid";
import { useCallContext } from "../../contexts/CallContext";
import { useGroupCallParticipants } from "../../hooks/useGroupCallParticipants";
import { groupCallService } from "../../services/calls/groupCallService";
import { webRTCService } from "../../services/calls/webRTCService";
import { getAuthInstance } from "../../services/firebase";
import { useColors } from "../../store/ThemeContext";
import { GroupCallLayout, GroupCallParticipant } from "../../types/call";

// Format duration helper
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const auth = getAuthInstance();

type GroupCallRouteParams = {
  GroupCall: {
    callId: string;
    groupName?: string;
    isOutgoing?: boolean;
  };
};

interface VideoParticipant {
  odId: string;
  displayName: string;
  avatarConfig?: any;
  stream: MediaStream | null;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isActiveSpeaker?: boolean;
  isPinned?: boolean;
  raisedHand?: boolean;
  connectionState?: string;
  audioLevel?: number;
}

export function GroupCallScreen(): JSX.Element {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<GroupCallRouteParams, "GroupCall">>();
  const { callId, groupName, isOutgoing } = route.params;
  const colors = useColors();

  const currentUserId = auth.currentUser?.uid || "";

  // Call context
  const { currentCall, isReconnecting, reconnectionAttempts, networkQuality } =
    useCallContext();

  // Group call participants hook
  const {
    participants,
    activeParticipants,
    participantsWithRaisedHands,
    isHost,
    isCoHost,
    canManageParticipants,
    currentUserParticipant,
    activeSpeakerId,
    pinnedParticipantId,
    activeParticipantCount,
    raisedHandCount,
    muteParticipant,
    removeParticipant,
    promoteToCoHost,
    demoteFromCoHost,
    pinParticipant,
    muteAll,
    lowerAllHands,
    isLoading,
  } = useGroupCallParticipants({
    callId,
    currentUserId,
  });

  // Local state
  const [layout, setLayout] = useState<GroupCallLayout>("grid");
  const [isParticipantListVisible, setIsParticipantListVisible] =
    useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(
    new Map(),
  );
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isHandRaised, setIsHandRaised] = useState(false);

  // Duration timer
  useEffect(() => {
    if (!currentCall?.answeredAt) return;

    const interval = setInterval(() => {
      const duration = Math.floor(
        (Date.now() - currentCall.answeredAt!) / 1000,
      );
      setCallDuration(duration);
    }, 1000);

    return () => clearInterval(interval);
  }, [currentCall?.answeredAt]);

  // Get local and remote streams from WebRTC service
  useEffect(() => {
    const stream = webRTCService.getLocalStream();
    if (stream) {
      setLocalStream(stream);
    }

    // Subscribe to stream updates
    const handleStreamUpdate = () => {
      const localStr = webRTCService.getLocalStream();
      setLocalStream(localStr);

      const remoteStr = webRTCService.getRemoteStreams();
      setRemoteStreams(new Map(remoteStr));
    };

    // Poll for stream updates (ideally we'd use events)
    const interval = setInterval(handleStreamUpdate, 1000);

    return () => clearInterval(interval);
  }, []);

  // Handle call ended
  useEffect(() => {
    if (!currentCall && !isLoading) {
      navigation.goBack();
    }
  }, [currentCall, isLoading, navigation]);

  // Map network quality
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

  // Get status text
  const getStatusText = (): string => {
    if (!currentCall) return "Ending...";

    if (isReconnecting) {
      return `Reconnecting... (${reconnectionAttempts}/5)`;
    }

    switch (currentCall.status) {
      case "ringing":
        return isOutgoing ? "Calling..." : "Incoming call...";
      case "connecting":
        return "Connecting...";
      case "connected":
        return formatDuration(callDuration);
      default:
        return "";
    }
  };

  // Build video participants list
  const videoParticipants = useMemo<VideoParticipant[]>(() => {
    return activeParticipants
      .filter((p) => p.odId !== currentUserId)
      .map((p) => ({
        odId: p.odId,
        displayName: p.displayName,
        avatarConfig: p.avatarConfig,
        stream: remoteStreams.get(p.odId) || null,
        isMuted: p.isMuted,
        isVideoEnabled: p.isVideoEnabled,
        isActiveSpeaker: p.odId === activeSpeakerId,
        isPinned: p.odId === pinnedParticipantId,
        raisedHand: p.raisedHand,
        connectionState: p.connectionState,
        audioLevel: (p as GroupCallParticipant).audioLevel,
      }));
  }, [
    activeParticipants,
    currentUserId,
    remoteStreams,
    activeSpeakerId,
    pinnedParticipantId,
  ]);

  // Local participant for video components
  const localVideoParticipant = useMemo<VideoParticipant | null>(() => {
    if (!currentUserParticipant) return null;
    return {
      odId: currentUserId,
      displayName: currentUserParticipant.displayName,
      avatarConfig: currentUserParticipant.avatarConfig,
      stream: localStream,
      isMuted,
      isVideoEnabled,
      isActiveSpeaker: currentUserId === activeSpeakerId,
      isPinned: currentUserId === pinnedParticipantId,
      raisedHand: isHandRaised,
      connectionState: currentUserParticipant.connectionState,
    };
  }, [
    currentUserParticipant,
    currentUserId,
    localStream,
    isMuted,
    isVideoEnabled,
    activeSpeakerId,
    pinnedParticipantId,
    isHandRaised,
  ]);

  // Handlers
  const handleEndCall = useCallback(async () => {
    if (isHost) {
      Alert.alert(
        "End Call for Everyone?",
        "As the host, ending the call will end it for all participants.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Leave Only",
            onPress: async () => {
              await groupCallService.leaveGroupCall(callId);
              navigation.goBack();
            },
          },
          {
            text: "End for All",
            style: "destructive",
            onPress: async () => {
              await groupCallService.endGroupCall(callId);
              navigation.goBack();
            },
          },
        ],
      );
    } else {
      await groupCallService.leaveGroupCall(callId);
      navigation.goBack();
    }
  }, [callId, isHost, navigation]);

  const handleToggleMute = useCallback(() => {
    const newMuted = webRTCService.toggleMute();
    setIsMuted(newMuted);
  }, []);

  const handleToggleSpeaker = useCallback(() => {
    const newSpeaker = webRTCService.toggleSpeaker();
    setIsSpeakerOn(newSpeaker);
  }, []);

  const handleToggleVideo = useCallback(() => {
    const newVideoEnabled = webRTCService.toggleVideo();
    setIsVideoEnabled(newVideoEnabled);
  }, []);

  const handleSwitchCamera = useCallback(async () => {
    await webRTCService.switchCamera();
  }, []);

  const handleToggleLayout = useCallback(() => {
    const newLayout = layout === "grid" ? "speaker" : "grid";
    setLayout(newLayout);
    groupCallService.setLayout(newLayout);
  }, [layout]);

  const handleRaiseHand = useCallback(async () => {
    const newRaised = !isHandRaised;
    setIsHandRaised(newRaised);
    await groupCallService.raiseHand(callId, newRaised);
  }, [callId, isHandRaised]);

  const handleParticipantPress = useCallback(
    (participantId: string) => {
      // Toggle pin on tap
      const newPinnedId =
        pinnedParticipantId === participantId ? null : participantId;
      pinParticipant(newPinnedId);
    },
    [pinnedParticipantId, pinParticipant],
  );

  const handleParticipantLongPress = useCallback((participantId: string) => {
    // Show participant list with that participant selected
    setIsParticipantListVisible(true);
  }, []);

  const handleUnpin = useCallback(() => {
    pinParticipant(null);
  }, [pinParticipant]);

  const handleInviteMore = useCallback(() => {
    // TODO: Show invite dialog
    Alert.alert("Invite", "Invite functionality coming soon");
  }, []);

  // Determine if video call
  const isVideoCall = currentCall?.type === "video";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000" translucent />

      {/* Main Video Area */}
      <View style={styles.videoArea}>
        {currentCall?.status === "connected" ? (
          layout === "grid" ? (
            <VideoGrid
              participants={videoParticipants}
              localParticipant={localVideoParticipant}
              activeSpeakerId={activeSpeakerId}
              pinnedParticipantId={pinnedParticipantId}
              onParticipantPress={handleParticipantPress}
              onParticipantLongPress={handleParticipantLongPress}
            />
          ) : (
            <SpeakerView
              participants={videoParticipants}
              localParticipant={localVideoParticipant}
              activeSpeakerId={activeSpeakerId}
              pinnedParticipantId={pinnedParticipantId}
              onParticipantPress={handleParticipantPress}
              onParticipantLongPress={handleParticipantLongPress}
              onUnpin={handleUnpin}
            />
          )
        ) : (
          <View
            style={[
              styles.connectingContainer,
              { backgroundColor: colors.background },
            ]}
          >
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.connectingText, { color: colors.text }]}>
              {getStatusText()}
            </Text>
            <Text style={[styles.groupName, { color: colors.textSecondary }]}>
              {groupName}
            </Text>
          </View>
        )}
      </View>

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
            <Text
              style={[styles.headerName, { color: colors.text }]}
              numberOfLines={1}
            >
              {groupName || "Group Call"}
            </Text>
            <View style={styles.headerStatusRow}>
              {isReconnecting && (
                <ActivityIndicator
                  size="small"
                  color={colors.text}
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
                {getStatusText()} • {activeParticipantCount} participants
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            {currentCall?.status === "connected" && !isReconnecting && (
              <CallQualityIndicator
                quality={mapQualityToIndicator(networkQuality)}
                size="small"
                showLabel={false}
              />
            )}
          </View>
        </View>

        {/* Raised hands indicator */}
        {raisedHandCount > 0 && (
          <TouchableOpacity
            style={styles.raisedHandsBanner}
            onPress={() => setIsParticipantListVisible(true)}
          >
            <Text style={styles.handEmoji}>✋</Text>
            <Text style={styles.raisedHandsText}>
              {raisedHandCount} raised hand{raisedHandCount > 1 ? "s" : ""}
            </Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={styles.toolbarButton}
          onPress={handleToggleLayout}
        >
          <Ionicons
            name={layout === "grid" ? "person" : "grid"}
            size={22}
            color={colors.text}
          />
          <Text style={[styles.toolbarButtonText, { color: colors.text }]}>
            {layout === "grid" ? "Speaker" : "Grid"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toolbarButton}
          onPress={() => setIsParticipantListVisible(true)}
        >
          <Ionicons name="people" size={22} color={colors.text} />
          <Text style={[styles.toolbarButtonText, { color: colors.text }]}>
            {activeParticipantCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toolbarButton,
            isHandRaised && styles.activeToolbarButton,
          ]}
          onPress={handleRaiseHand}
        >
          <Text style={styles.handEmoji}>✋</Text>
          <Text style={[styles.toolbarButtonText, { color: colors.text }]}>
            {isHandRaised ? "Lower" : "Raise"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Controls Overlay */}
      <View style={styles.controlsOverlay}>
        <CallControls
          isMuted={isMuted}
          isSpeakerOn={isSpeakerOn}
          isVideoEnabled={isVideoEnabled}
          isVideoCall={isVideoCall}
          onToggleMute={handleToggleMute}
          onToggleSpeaker={handleToggleSpeaker}
          onToggleVideo={handleToggleVideo}
          onEndCall={handleEndCall}
          onSwitchCamera={isVideoCall ? handleSwitchCamera : undefined}
        />
      </View>

      {/* Participant List Overlay */}
      <ParticipantListOverlay
        visible={isParticipantListVisible}
        onClose={() => setIsParticipantListVisible(false)}
        participants={activeParticipants as GroupCallParticipant[]}
        currentUserId={currentUserId}
        isHost={isHost}
        isCoHost={isCoHost}
        activeSpeakerId={activeSpeakerId}
        pinnedParticipantId={pinnedParticipantId}
        onMuteParticipant={muteParticipant}
        onRemoveParticipant={removeParticipant}
        onPinParticipant={pinParticipant}
        onPromoteToCoHost={promoteToCoHost}
        onDemoteFromCoHost={demoteFromCoHost}
        onMuteAll={muteAll}
        onLowerAllHands={lowerAllHands}
        onInviteMore={handleInviteMore}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  videoArea: {
    flex: 1,
  },
  connectingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  connectingText: {
    fontSize: 16,
    marginTop: 16,
  },
  groupName: {
    fontSize: 14,
    marginTop: 8,
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
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerName: {
    fontSize: 16,
    fontWeight: "600",
  },
  headerStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  headerStatus: {
    fontSize: 12,
  },
  reconnectingIndicator: {
    marginRight: 4,
  },
  reconnectingText: {
    // Color set dynamically
  },
  headerRight: {
    padding: 8,
    minWidth: 44,
  },

  // Raised hands banner
  raisedHandsBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 193, 7, 0.9)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 20,
    gap: 8,
  },
  handEmoji: {
    fontSize: 16,
  },
  raisedHandsText: {
    color: "#000",
    fontSize: 13,
    fontWeight: "600",
  },

  // Toolbar
  toolbar: {
    position: "absolute",
    bottom: 150,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    zIndex: 5,
  },
  toolbarButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 6,
  },
  activeToolbarButton: {
    backgroundColor: "rgba(255, 193, 7, 0.8)",
  },
  toolbarButtonText: {
    fontSize: 13,
    fontWeight: "500",
  },

  // Controls overlay
  controlsOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 40,
    paddingTop: 16,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    zIndex: 10,
  },
});
