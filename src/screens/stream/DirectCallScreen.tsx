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
 * - Real joined-video controls via Stream's built-in CallContent
 * - Audio-call controls: mute, speaker, end call
 * - Call duration timer
 * - Back navigation / minimize while staying in call
 */

import { ProfilePicture } from "@/components/profile/ProfilePicture/ProfilePicture";
import { CallControlBar } from "@/components/stream/CallControlBar";
import { useStreamCall } from "@/contexts/StreamCallContext";
import { useAppTheme } from "@/store/ThemeContext";
import type { MainStackParamList } from "@/types/navigation/root";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  CallContent,
  CallingState,
  StreamCall,
  useCall,
  useCallStateHooks,
} from "@stream-io/video-react-native-sdk";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Lazy-load ringtone service for outgoing ring sound
let ringtoneService: typeof import("@/services/calls/ringtoneService") | null =
  null;
try {
  ringtoneService = require("@/services/calls/ringtoneService");
} catch {
  // Not available
}

// Lazy-load callManager for speaker toggle
let callManager: any = null;
try {
  callManager = require("@stream-io/video-react-native-sdk").callManager;
} catch {
  // Not available in Expo Go
}

type Props = NativeStackScreenProps<MainStackParamList, "DirectCall">;

export default function DirectCallScreen({ route, navigation }: Props) {
  // Normalize params once at the top — prevents undefined-driven re-renders
  const params = route.params as {
    callId?: string;
    recipientName?: string;
    mode?: "audio" | "video";
    isOutgoing?: boolean;
  };
  const recipientName = params.recipientName ?? "";
  const mode = params.mode ?? "audio";
  const isOutgoing = params.isOutgoing ?? false;

  const { endCall, activeCall } = useStreamCall();
  const { colors } = useAppTheme();

  // Ref-gate prevents multiple endCall dispatches. Once endCall is invoked
  // (by user tap, remote hangup, or callingState→LEFT), this ref ensures
  // we never fire it again — which would cause redundant state resets and
  // rapid <StreamCall> mount/unmount cycles that trigger hook ordering errors.
  const endedRef = useRef(false);

  const handleEndCall = useCallback(async () => {
    if (endedRef.current) return;
    endedRef.current = true;
    try {
      await endCall();
    } catch (err) {
      console.error("[DirectCallScreen] endCall error:", err);
    } finally {
      if (navigation.canGoBack()) navigation.goBack();
    }
  }, [endCall, navigation]);

  // Minimize — go back but stay in call
  const handleMinimize = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  // Auto-dismiss if no active call after a short delay
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
          <MaterialCommunityIcons
            name="phone-off"
            size={48}
            color={colors.textSecondary}
          />
          <Text
            style={[styles.statusText, { color: colors.text, marginTop: 12 }]}
          >
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
        onMinimize={handleMinimize}
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
  onMinimize,
}: {
  recipientName: string;
  mode: "audio" | "video";
  isOutgoing: boolean;
  onEndCall: () => void;
  onMinimize: () => void;
}) {
  const { colors } = useAppTheme();
  const {
    useCallCallingState,
    useParticipants,
    useMicrophoneState,
  } = useCallStateHooks();

  const callingState = useCallCallingState();
  const participants = useParticipants();
  const { isMute: isMuted, microphone } = useMicrophoneState();
  const isVideo = mode === "video";
  const call = useCall();

  // Speaker toggle state — tracked locally (SDK doesn't provide useSpeakerState on RN)
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [wasAcceptedByRemote, setWasAcceptedByRemote] = useState(false);

  // Safe mic toggle — only allow when JOINED to prevent permanent track death
  const handleToggleMic = useCallback(async () => {
    if (callingState !== CallingState.JOINED) return;
    try {
      await microphone.toggle();
    } catch (err) {
      console.warn("[DirectCallScreen] mic toggle failed:", err);
    }
  }, [callingState, microphone]);

  // Speaker toggle using callManager.speaker.setForceSpeakerphoneOn
  const handleToggleSpeaker = useCallback(async () => {
    if (!callManager?.speaker?.setForceSpeakerphoneOn) return;
    try {
      const newState = !isSpeakerOn;
      callManager.speaker.setForceSpeakerphoneOn(newState);
      setIsSpeakerOn(newState);
    } catch (err) {
      console.warn("[DirectCallScreen] speaker toggle failed:", err);
    }
  }, [isSpeakerOn]);

  useEffect(() => {
    if (!call || !isOutgoing) return;
    return call.on("call.accepted", (event) => {
      if (event.user.id !== call.currentUserId) {
        setWasAcceptedByRemote(true);
      }
    });
  }, [call, isOutgoing]);

  // Derive remote participant info from Stream state for enriched display
  const remoteParticipant = useMemo(() => {
    const remote = participants.find((p) => !p.isLocalParticipant);
    if (!remote) return null;
    return {
      name: remote.name || recipientName || "Participant",
      image: remote.image,
    };
  }, [participants, recipientName]);

  const displayName = remoteParticipant?.name || recipientName || "Calling...";
  const avatarUrl = remoteParticipant?.image;

  // Duration timer
  const [duration, setDuration] = useState(0);
  const isJoined = callingState === CallingState.JOINED;

  useEffect(() => {
    if (!isJoined) return;
    const interval = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, [isJoined]);

  // Outgoing ring sound — play while waiting for callee to answer
  useEffect(() => {
    if (!ringtoneService) return;
    const isRinging =
      isOutgoing &&
      callingState === CallingState.RINGING &&
      !wasAcceptedByRemote;
    if (isRinging) {
      ringtoneService.startRingtone("outgoing", false, true);
    }
    return () => {
      ringtoneService?.stopRingtone();
    };
  }, [isOutgoing, callingState, wasAcceptedByRemote]);

  useEffect(() => {
    if (callingState === CallingState.RINGING) {
      setWasAcceptedByRemote(false);
    }
  }, [callingState]);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const hasRemoteParticipant = !!remoteParticipant;

  // Derive status text
  const statusText = (() => {
    switch (callingState) {
      case CallingState.RINGING:
        return isOutgoing ? "Ringing..." : "Incoming call...";
      case CallingState.JOINING:
        return wasAcceptedByRemote ? "Answered, connecting..." : "Connecting...";
      case CallingState.JOINED:
        return hasRemoteParticipant
          ? `Live - ${formatDuration(duration)}`
          : "Connected, waiting for media...";
      case CallingState.RECONNECTING:
      case CallingState.MIGRATING:
        return "Reconnecting...";
      case CallingState.RECONNECTING_FAILED:
        return "Connection failed";
      case CallingState.OFFLINE:
        return "Offline, waiting to reconnect...";
      case CallingState.LEFT:
        return "Call ended";
      default:
        return "";
    }
  })();

  // Notify parent when Stream reports call ended. Only fire after the
  // call has been JOINED at least once — prevents false triggers from
  // the initial IDLE state before the call connects.
  const hasJoinedRef = useRef(false);
  useEffect(() => {
    if (callingState === CallingState.JOINED) {
      hasJoinedRef.current = true;
    }
    if (
      hasJoinedRef.current &&
      (callingState === CallingState.LEFT || callingState === CallingState.IDLE)
    ) {
      onEndCall();
    }
  }, [callingState, onEndCall]);

  // Joined video calls use Stream's built-in CallContent. This gives us
  // real media controls (mute video, flip camera, hang up) instead of
  // duplicating those controls in a custom surface.
  if (isVideo && isJoined) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: "#000" }]}
        edges={["top"]}
      >
        {/* Minimize header floating over video */}
        <View style={styles.videoHeader}>
          <Pressable
            onPress={onMinimize}
            style={styles.videoBackButton}
            accessibilityLabel="Minimize call"
            hitSlop={12}
          >
            <MaterialCommunityIcons
              name="chevron-down"
              size={28}
              color="#fff"
            />
          </Pressable>
          <Text style={styles.videoStatusText}>{statusText}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.videoContent}>
          <CallContent onHangupCallHandler={onEndCall} />
        </View>
      </SafeAreaView>
    );
  }

  // Audio call UI (or ringing/connecting state)
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      {/* Header with back arrow */}
      <View style={styles.audioHeader}>
        <Pressable
          onPress={onMinimize}
          style={styles.backButton}
          accessibilityLabel="Minimize call"
          hitSlop={12}
        >
          <MaterialCommunityIcons
            name="chevron-down"
            size={28}
            color={colors.text}
          />
        </Pressable>

        <Text style={[styles.headerCallType, { color: colors.textSecondary }]}>
          {isVideo ? "Video Call" : "Audio Call"}
        </Text>

        <View style={{ width: 40 }} />
      </View>

      {/* Caller info + avatar */}
      <View style={styles.callerSection}>
        <View
          style={[
            styles.avatarRing,
            callingState === CallingState.RINGING && styles.avatarPulse,
          ]}
        >
          <ProfilePicture
            url={avatarUrl ?? null}
            name={displayName}
            size={120}
            showLoading={false}
          />
        </View>

        <Text
          style={[styles.recipientName, { color: colors.text }]}
          numberOfLines={1}
        >
          {displayName}
        </Text>
        <Text style={[styles.statusText, { color: colors.textSecondary }]}>
          {statusText}
        </Text>
      </View>

      {/* Spacer */}
      <View style={{ flex: 1 }} />

      {/* Controls */}
      <CallControlBar
        isMuted={isMuted}
        onToggleMic={handleToggleMic}
        micDisabled={!isJoined}
        showSpeaker={!!callManager?.speaker?.setForceSpeakerphoneOn}
        isSpeakerOn={isSpeakerOn}
        onToggleSpeaker={handleToggleSpeaker}
        onLeave={onEndCall}
        leaveLabel="End"
      />
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

  // Audio call header
  audioHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCallType: {
    flex: 1,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  // Video call header (floating over video)
  videoHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  videoBackButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  videoStatusText: {
    flex: 1,
    textAlign: "center",
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  videoContent: {
    flex: 1,
  },

  // Caller info
  callerSection: {
    alignItems: "center",
    paddingTop: 40,
  },
  avatarRing: {
    borderRadius: 64,
    borderWidth: 3,
    borderColor: "transparent",
    padding: 2,
  },
  avatarPulse: {
    borderColor: "rgba(67, 160, 71, 0.4)",
  },
  recipientName: {
    fontSize: 24,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 15,
    fontWeight: "500",
  },
});
