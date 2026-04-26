/**
 * Direct Call Screen
 *
 * Unified screen for active 1:1 audio and video calls using Stream Video.
 * Replaces the legacy AudioCallScreen and VideoCallScreen.
 *
 * Handles:
 * - Outgoing ringing state
 * - Active audio call UI (avatar + controls)
 * - Active video call UI (remote video + local PiP + full controls)
 * - Video call controls: camera on/off, flip camera, mute, speaker, end call
 * - Audio-call controls: mute, speaker, end call
 * - Audio route picker for all call types
 * - Call duration timer
 * - Back navigation / minimize while staying in call
 */

import { ProfilePicture } from "@/components/profile/ProfilePicture/ProfilePicture";
import type { AudioRoute } from "@/components/stream/AudioRoutePicker";
import {
  AudioRoutePicker,
  applyAudioRoute,
  getAudioRouteFromStatus,
} from "@/components/stream/AudioRoutePicker";
import { CallConnectionBadge } from "@/components/stream/CallConnectionBadge";
import { CallControlBar } from "@/components/stream/CallControlBar";
import { useStreamCall } from "@/contexts/StreamCallContext";
import { callSettingsService } from "@/services/calls";
import {
  forceRefreshMicrophoneCapture,
  getMicrophonePublishSnapshot,
} from "@/services/stream/callMediaHealthCheck";
import { useAppTheme } from "@/store/ThemeContext";
import type { MainStackParamList } from "@/types/navigation/root";
import { requestCameraPermission } from "@/utils/permissions";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { hasVideo } from "@stream-io/video-client";
import {
  CallingState,
  ParticipantView,
  StreamCall,
  useCall,
  useCallStateHooks,
  useIsInPiPMode,
} from "@stream-io/video-react-native-sdk";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  NoiseCancellationWrapper,
  useNoiseCancellationStatus,
} from "@/components/stream/NoiseCancellationWrapper";
import { useStableCallInsets } from "@/components/stream/useStableCallInsets";
import { VideoRenderErrorBoundary } from "@/components/stream/VideoRenderErrorBoundary";
import {
  forceDisableTranscriptionOnCall,
  stopCallTranscription,
} from "@/services/calls/callTranscriptService";

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
  const { endCall, activeCall } = useStreamCall();
  const { colors } = useAppTheme();

  // Normalize params once at the top to prevent undefined-driven re-renders.
  const params = route.params as {
    callId?: string;
    recipientName?: string;
    mode?: "audio" | "video";
    isOutgoing?: boolean;
  };
  const recipientName = params.recipientName ?? "";
  const modeFromCall = activeCall?.state.custom?.mode;
  const mode =
    modeFromCall === "video" || modeFromCall === "audio"
      ? modeFromCall
      : (params.mode ?? "audio");
  const isOutgoing = params.isOutgoing ?? activeCall?.isCreatedByMe ?? false;

  const endedRef = useRef(false);
  const dismissedRef = useRef(false);

  const dismissScreen = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  const handleEndCall = useCallback(async () => {
    if (endedRef.current) return;
    endedRef.current = true;
    ringtoneService?.stopRingtone();
    try {
      await endCall();
    } catch (err) {
      console.error("[DirectCallScreen] endCall error:", err);
    } finally {
      dismissScreen();
    }
  }, [dismissScreen, endCall]);

  const handleMinimize = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  useEffect(() => {
    if (!activeCall && !endedRef.current) {
      const timer = setTimeout(() => {
        dismissScreen();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [activeCall, dismissScreen]);

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
    <VideoRenderErrorBoundary
      fallback={
        <VideoErrorFallbackScreen
          recipientName={recipientName}
          onEndCall={handleEndCall}
          onMinimize={handleMinimize}
          colors={colors}
        />
      }
    >
      <StreamCall call={activeCall}>
        <NoiseCancellationWrapper>
          <DirectCallContent
            recipientName={recipientName}
            mode={mode}
            isOutgoing={isOutgoing}
            onEndCall={handleEndCall}
            onMinimize={handleMinimize}
          />
        </NoiseCancellationWrapper>
      </StreamCall>
    </VideoRenderErrorBoundary>
  );
}

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
    useIsCallTranscribingInProgress,
    useParticipants,
    useMicrophoneState,
    useCameraState,
  } = useCallStateHooks();

  const callingState = useCallCallingState();
  const isTranscribing = useIsCallTranscribingInProgress();
  const participants = useParticipants();
  const { optimisticIsMute: isMuted, microphone } = useMicrophoneState();
  const {
    optimisticIsMute: isCameraOff,
    camera,
    direction: cameraDirection,
  } = useCameraState();
  const isVideo = mode === "video";
  const call = useCall();
  const isJoined = callingState === CallingState.JOINED;
  const isInPiPMode = useIsInPiPMode();
  const noiseCancellationStatus = useNoiseCancellationStatus();
  const noiseCancellationControl = useMemo(
    () => ({
      show: true,
      isEnabled: noiseCancellationStatus.isEnabled,
      isSupported: noiseCancellationStatus.isSupported === true,
      isLoading: noiseCancellationStatus.isLoading,
      error: noiseCancellationStatus.error,
      onToggle: () =>
        noiseCancellationStatus.setEnabled((enabled) => !enabled),
    }),
    [noiseCancellationStatus],
  );

  // PiP restore: When PiP exits (isInPiPMode: true → false), the native
  // RTCMTLVideoView (Metal) often fails to resume rendering because Metal
  // was suspended while the app was in background. Force the ParticipantView
  // to remount by changing its key, which triggers didMoveToWindow on the
  // native RTCVideoView and re-attaches the Metal renderer to the track.
  const [pipRestoreGeneration, setPipRestoreGeneration] = useState(0);
  const prevPiPModeRef = useRef(false);
  useEffect(() => {
    if (prevPiPModeRef.current && !isInPiPMode) {
      // PiP just exited — schedule a remount on next frame.
      // NOTE: we intentionally do NOT try to distinguish "user tapped
      // PiP" from "app foreground enforced stop" here — NativePiPBridge
      // owns the restore-navigation decision based on whether the user
      // was on this screen when PiP started.
      console.info(
        "[DirectCallScreen] PiP exited — forcing video renderer remount",
      );
      setPipRestoreGeneration((g) => g + 1);
    } else if (!prevPiPModeRef.current && isInPiPMode) {
      console.info("[DirectCallScreen] PiP entered");
    }
    prevPiPModeRef.current = isInPiPMode;
  }, [isInPiPMode]);

  const shouldMirrorLocalVideo =
    cameraDirection === "front"
      ? callSettingsService.getSettingsSync().mirrorFrontCamera
      : false;
  const callInsets = useStableCallInsets();

  // Post-join mic publish reconciliation.
  // The service layer already does a forceRefreshMicrophoneCapture right
  // after join, but screen remounts or reconnects can leave device state
  // stale. This safety-net check runs 4s after JOINED and forces a full
  // mic restart if audio is not flowing.
  const micReconciliationRef = useRef(false);
  useEffect(() => {
    if (!isJoined || !call || micReconciliationRef.current) return;
    micReconciliationRef.current = true;

    const timer = setTimeout(() => {
      const snapshot = getMicrophonePublishSnapshot(call);
      console.info("[DirectCallScreen] Mic reconciliation snapshot:", snapshot);
      if (!snapshot.healthy && snapshot.canSendAudio) {
        console.warn(
          "[DirectCallScreen] Mic unhealthy at reconciliation — force-refreshing",
        );
        forceRefreshMicrophoneCapture(
          call,
          "direct call UI reconciliation",
        ).catch((err) => {
          console.warn("[DirectCallScreen] UI-level mic recovery failed:", err);
        });
      }
    }, 4000);

    return () => {
      clearTimeout(timer);
      micReconciliationRef.current = false;
    };
  }, [isJoined, call]);

  // --------------------------------------------------------------------------
  // Transcription guardrails (1:1 direct AUDIO calls only).
  // Start is now owned by the backend on `call.session_started`, so the
  // screen only reflects Stream's real transcribing state and stops it if
  // the local user disables the feature mid-call.
  // --------------------------------------------------------------------------
  const videoForcedOffRef = useRef(false);

  useEffect(() => {
    if (!call) return;

    // Video calls — force-disable exactly once per call instance so an
    // accidental settings_override or dashboard default can't spin
    // transcription up mid-call.
    if (isVideo) {
      if (!videoForcedOffRef.current) {
        videoForcedOffRef.current = true;
        void forceDisableTranscriptionOnCall(call, "direct video call");
      }
      return;
    }
  }, [call, isVideo]);

  // React to the user disabling transcription mid-call.
  useEffect(() => {
    if (!call || isVideo) return;
    const unsub = callSettingsService.addListener((settings) => {
      if (isTranscribing && !settings.audioCallTranscriptionsEnabled) {
        void stopCallTranscription(call);
      }
    });
    return unsub;
  }, [call, isTranscribing, isVideo]);

  // Speaker toggle state — tracked locally (SDK doesn't provide useSpeakerState on RN)
  const [isSpeakerOn, setIsSpeakerOn] = useState(isVideo); // Default speaker ON for video
  const [wasAcceptedByRemote, setWasAcceptedByRemote] = useState(false);
  const [audioRoutePickerVisible, setAudioRoutePickerVisible] = useState(false);
  const [currentAudioRoute, setCurrentAudioRoute] = useState<AudioRoute>(
    isVideo ? "speaker" : "earpiece",
  );
  const pipEligibilityLogRef = useRef<string | null>(null);
  const pipModeLogRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (
      Platform.OS !== "android" ||
      !callManager?.android?.getAudioDeviceStatus ||
      !callManager?.android?.addAudioDeviceChangeListener
    ) {
      return;
    }

    let cancelled = false;
    const syncAudioRoute = async () => {
      try {
        const status = await callManager.android.getAudioDeviceStatus();
        if (cancelled) return;
        const route = getAudioRouteFromStatus(status);
        if (route !== "unknown") {
          setCurrentAudioRoute(route);
          setIsSpeakerOn(route === "speaker");
        }
      } catch (err) {
        if (!cancelled) {
          console.warn(
            "[DirectCallScreen] Failed to sync Android audio route:",
            err,
          );
        }
      }
    };

    syncAudioRoute();
    const unsubscribe = callManager.android.addAudioDeviceChangeListener(
      (status: any) => {
        if (cancelled) return;
        const route = getAudioRouteFromStatus(status);
        if (route !== "unknown") {
          setCurrentAudioRoute(route);
          setIsSpeakerOn(route === "speaker");
        }
      },
    );

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    return () => {
      ringtoneService?.stopRingtone();
    };
  }, []);

  // Initialize speaker state for video calls — only after fully joined
  useEffect(() => {
    if (isVideo && isJoined && callManager?.speaker?.setForceSpeakerphoneOn) {
      callManager.speaker.setForceSpeakerphoneOn(true);
      setIsSpeakerOn(true);
      setCurrentAudioRoute("speaker");
    }
  }, [isVideo, isJoined]);

  useEffect(() => {
    if (isInPiPMode && audioRoutePickerVisible) {
      setAudioRoutePickerVisible(false);
    }
  }, [audioRoutePickerVisible, isInPiPMode]);

  useEffect(() => {
    pipEligibilityLogRef.current = !isVideo
      ? "Native PiP skipped for audio-only direct call"
      : !isJoined
        ? `Native PiP waiting for joined state (current=${callingState})`
        : "Native PiP enabled for joined video call";
  }, [callingState, isJoined, isVideo]);

  useEffect(() => {
    if (pipModeLogRef.current === isInPiPMode) return;
    pipModeLogRef.current = isInPiPMode;
    console.info(
      `[DirectCallScreen] PiP mode: ${isInPiPMode}`,
      isInPiPMode
        ? "— hiding controls overlay"
        : `— restoring, generation=${pipRestoreGeneration}`,
    );
  }, [isInPiPMode, pipRestoreGeneration]);

  // Safe mic toggle — only allow when JOINED to prevent permanent track death
  const handleToggleMic = useCallback(async () => {
    if (callingState !== CallingState.JOINED) return;
    try {
      await microphone.toggle();
    } catch (err) {
      console.warn("[DirectCallScreen] mic toggle failed:", err);
    }
  }, [callingState, microphone]);

  // Camera toggle for video calls
  const handleToggleCamera = useCallback(async () => {
    if (callingState !== CallingState.JOINED) return;
    try {
      if (isCameraOff) {
        const granted = await requestCameraPermission();
        if (!granted) return;
      }
      await camera.toggle();
    } catch (err) {
      console.warn("[DirectCallScreen] camera toggle failed:", err);
    }
  }, [callingState, camera, isCameraOff]);

  // Camera flip
  const handleFlipCamera = useCallback(async () => {
    if (callingState !== CallingState.JOINED || isCameraOff) return;
    try {
      await camera.flip();
    } catch (err) {
      console.warn("[DirectCallScreen] camera flip failed:", err);
    }
  }, [callingState, camera, isCameraOff]);

  // Speaker toggle using callManager.speaker.setForceSpeakerphoneOn
  const handleToggleSpeaker = useCallback(async () => {
    if (!callManager?.speaker?.setForceSpeakerphoneOn) return;
    try {
      const newState = !isSpeakerOn;
      callManager.speaker.setForceSpeakerphoneOn(newState);
      setIsSpeakerOn(newState);
      setCurrentAudioRoute(newState ? "speaker" : "earpiece");
    } catch (err) {
      console.warn("[DirectCallScreen] speaker toggle failed:", err);
    }
  }, [isSpeakerOn]);

  // Audio route selection
  const handleAudioRouteSelect = useCallback((route: AudioRoute) => {
    applyAudioRoute(route);
    setCurrentAudioRoute(route);
    setIsSpeakerOn(route === "speaker");
  }, []);

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
      hasVideo: hasVideo(remote),
      participant: remote,
    };
  }, [participants, recipientName]);

  // Local participant for PiP
  const localParticipant = useMemo(
    () => participants.find((p) => p.isLocalParticipant),
    [participants],
  );

  const displayName = remoteParticipant?.name || recipientName || "Calling...";
  const avatarUrl = remoteParticipant?.image;
  const remoteConnectionQuality =
    remoteParticipant?.participant?.connectionQuality;

  // Duration timer
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!isJoined) return;
    const interval = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, [isJoined]);

  // Outgoing ring sound — play while waiting for callee to answer.
  // The ringtone uses expo-audio with mixWithOthers mode so it doesn't
  // fight the active call audio session from callManager.start().
  useEffect(() => {
    if (!ringtoneService) return;
    const isRinging =
      isOutgoing &&
      callingState === CallingState.RINGING &&
      !wasAcceptedByRemote;
    if (isRinging) {
      // Small delay to let callManager.start() audio session settle
      const timeout = setTimeout(() => {
        ringtoneService!.startRingtone("outgoing", false, true);
      }, 200);
      return () => {
        clearTimeout(timeout);
        ringtoneService?.stopRingtone();
      };
    }
    // Stop any playing ringtone when state changes away from ringing
    ringtoneService.stopRingtone();
    return undefined;
  }, [isOutgoing, callingState, wasAcceptedByRemote]);

  useEffect(() => {
    if (callingState === CallingState.RINGING) {
      setWasAcceptedByRemote(false);
    }
  }, [callingState]);

  // Client-side safety timeout for unanswered outgoing calls.
  // Stream's server has a default 30s ring timeout that transitions the
  // call to IDLE/LEFT, but if that event is lost (network glitch), the
  // caller would see "Ringing..." indefinitely. This 60s client-side
  // timeout acts as a safety net.
  useEffect(() => {
    if (!isOutgoing || callingState !== CallingState.RINGING) return;
    const timeout = setTimeout(() => {
      console.warn(
        "[DirectCallScreen] Client-side ringing timeout — ending call",
      );
      onEndCall();
    }, 60_000);
    return () => clearTimeout(timeout);
  }, [isOutgoing, callingState, onEndCall]);

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
        return wasAcceptedByRemote
          ? "Answered, connecting..."
          : "Connecting...";
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

  // Joined video calls — custom video rendering with full controls
  // Guard: only render video subtree when call object + joined state are valid
  if (isVideo && isJoined && call) {
    return (
      <View style={[styles.container, { backgroundColor: "#000" }]}>
        {/* Video layer — fills entire screen edge-to-edge */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {remoteParticipant?.hasVideo &&
          remoteParticipant.participant &&
          remoteParticipant.participant.sessionId ? (
            <ParticipantView
              key={`remote-pip-${pipRestoreGeneration}`}
              participant={remoteParticipant.participant}
              trackType="videoTrack"
              style={StyleSheet.absoluteFill}
              objectFit="cover"
              ParticipantLabel={null as any}
              ParticipantReaction={null as any}
              ParticipantVideoFallback={() => (
                <View style={styles.videoFallback}>
                  <ProfilePicture
                    url={avatarUrl ?? null}
                    name={displayName}
                    size={120}
                    showLoading={false}
                  />
                  <Text style={styles.videoFallbackName}>{displayName}</Text>
                </View>
              )}
            />
          ) : (
            <View style={styles.videoFallback}>
              <ProfilePicture
                url={avatarUrl ?? null}
                name={displayName}
                size={120}
                showLoading={false}
              />
              <Text style={styles.videoFallbackName}>{displayName}</Text>
            </View>
          )}
        </View>

        {/* UI overlay — safe-area-aware, layered above video */}
        {!isInPiPMode && (
          <View style={styles.videoUiOverlay} pointerEvents="box-none">
            {/* Header with explicit safe-area top padding */}
            <View
              style={[styles.videoHeader, { paddingTop: callInsets.top + 8 }]}
            >
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
              <View style={styles.videoHeaderCenter}>
                <Text style={styles.videoStatusText}>{statusText}</Text>
                <CallConnectionBadge
                  callingState={callingState}
                  connectionQuality={remoteConnectionQuality}
                />
              </View>
              <Pressable
                onPress={() => setAudioRoutePickerVisible(true)}
                style={styles.videoBackButton}
                accessibilityLabel="Audio output"
                hitSlop={12}
              >
                <MaterialCommunityIcons name="speaker" size={22} color="#fff" />
              </Pressable>
            </View>

            {/* Middle area — local PiP lives here; touches pass to video */}
            <View style={styles.videoMiddle} pointerEvents="box-none">
              {/* Local self-view PiP */}
              {localParticipant &&
                localParticipant.sessionId &&
                !isCameraOff &&
                hasVideo(localParticipant) && (
                  <View style={styles.localPip}>
                    <ParticipantView
                      participant={localParticipant}
                      trackType="videoTrack"
                      style={styles.localPipVideo}
                      objectFit="cover"
                      ParticipantLabel={null as any}
                      ParticipantReaction={null as any}
                      mirror={shouldMirrorLocalVideo}
                    />
                  </View>
                )}
            </View>

            {/* Full video call controls */}
            <CallControlBar
              isMuted={isMuted}
              onToggleMic={handleToggleMic}
              micDisabled={!isJoined}
              showCamera
              isCameraOff={isCameraOff}
              onToggleCamera={handleToggleCamera}
              showFlipCamera={!isCameraOff}
              onFlipCamera={handleFlipCamera}
              showSpeaker={!!callManager?.speaker?.setForceSpeakerphoneOn}
              isSpeakerOn={isSpeakerOn}
              onToggleSpeaker={handleToggleSpeaker}
              noiseCancellation={noiseCancellationControl}
              onLeave={onEndCall}
              leaveLabel="End"
            />

            <AudioRoutePicker
              visible={audioRoutePickerVisible}
              onClose={() => setAudioRoutePickerVisible(false)}
              currentRoute={currentAudioRoute}
              onRouteSelected={handleAudioRouteSelect}
            />
          </View>
        )}
      </View>
    );
  }

  // Audio call UI (or ringing/connecting state)
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: callInsets.top,
        },
      ]}
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

        <Pressable
          onPress={() => setAudioRoutePickerVisible(true)}
          style={styles.backButton}
          accessibilityLabel="Audio output"
          hitSlop={12}
        >
          <MaterialCommunityIcons
            name="speaker"
            size={22}
            color={colors.textSecondary}
          />
        </Pressable>
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
        <View style={styles.connectionBadgeRow}>
          <CallConnectionBadge
            callingState={callingState}
            connectionQuality={remoteConnectionQuality}
          />
        </View>
        {!isVideo && isTranscribing ? (
          <View
            style={[
              styles.transcribingPill,
              {
                backgroundColor: colors.primary + "22",
                borderColor: colors.primary + "55",
              },
            ]}
          >
            <MaterialCommunityIcons
              name="text-box-outline"
              size={12}
              color={colors.primary}
            />
            <Text
              style={[styles.transcribingPillText, { color: colors.primary }]}
            >
              Transcribing
            </Text>
          </View>
        ) : null}
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
        noiseCancellation={noiseCancellationControl}
        onLeave={onEndCall}
        leaveLabel="End"
      />

      <AudioRoutePicker
        visible={audioRoutePickerVisible}
        onClose={() => setAudioRoutePickerVisible(false)}
        currentRoute={currentAudioRoute}
        onRouteSelected={handleAudioRouteSelect}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Error fallback — keeps call alive in audio mode when video subtree crashes
// ---------------------------------------------------------------------------

function VideoErrorFallbackScreen({
  recipientName,
  onEndCall,
  onMinimize,
  colors,
}: {
  recipientName: string;
  onEndCall: () => void;
  onMinimize: () => void;
  colors: { background: string; text: string; textSecondary: string };
}) {
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
          Audio Call
        </Text>
        <View style={styles.backButton} />
      </View>
      <View style={styles.centered}>
        <MaterialCommunityIcons
          name="video-off-outline"
          size={48}
          color={colors.textSecondary}
        />
        <Text
          style={[styles.recipientName, { color: colors.text, marginTop: 16 }]}
        >
          {recipientName || "Call"}
        </Text>
        <Text
          style={[
            styles.statusText,
            { color: colors.textSecondary, marginTop: 8 },
          ]}
        >
          Video unavailable — call continued in audio mode
        </Text>
      </View>
      <View style={{ flex: 1 }} />
      <CallControlBar
        isMuted={false}
        onToggleMic={() => {}}
        micDisabled
        onLeave={onEndCall}
        leaveLabel="End"
      />
    </View>
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
    zIndex: 10,
    elevation: 4,
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

  // Video call UI overlay (above video layer)
  videoUiOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  // Video call header (flow child inside overlay — safe-area paddingTop applied inline)
  videoHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  // Middle area between header and controls (holds local PiP)
  videoMiddle: {
    flex: 1,
  },
  videoBackButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  videoHeaderCenter: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  videoStatusText: {
    textAlign: "center",
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },

  videoFallback: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a2e",
  },
  videoFallbackName: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 12,
  },
  localPip: {
    position: "absolute",
    bottom: 100,
    right: 12,
    width: 110,
    height: 160,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  localPipVideo: {
    width: "100%" as any,
    height: "100%" as any,
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
  connectionBadgeRow: {
    minHeight: 28,
    justifyContent: "center",
    marginTop: 10,
  },
  transcribingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
  },
  transcribingPillText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
});
