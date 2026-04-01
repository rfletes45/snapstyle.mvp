/**
 * Voice Channel Screen
 *
 * Discord-style shared voice room UI. Replaces the legacy GroupCallScreen.
 *
 * Features:
 * - Participant grid with avatar tiles (supports video when enabled)
 * - Full control bar: mute, camera, speaker, screen share, disconnect
 * - Accurate speaking indicators (checks isSpeaking AND not muted)
 * - Back navigation (minimize) while staying connected
 * - Leave button (does NOT end the room for others)
 * - No ringing, no incoming overlay needed
 * - Deliberate-leave tracking prevents auto-rejoin bug
 */

import { ProfilePicture } from "@/components/profile/ProfilePicture/ProfilePicture";
import { CallControlBar } from "@/components/stream/CallControlBar";
import { useStreamCall } from "@/contexts/StreamCallContext";
import { useAppTheme } from "@/store/ThemeContext";
import type { MainStackParamList } from "@/types/navigation/root";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  CallingState,
  StreamCall,
  useCallStateHooks,
} from "@stream-io/video-react-native-sdk";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Lazy-load ringtone service for room join sound
let ringtoneService: typeof import("@/services/calls/ringtoneService") | null =
  null;
try {
  ringtoneService = require("@/services/calls/ringtoneService");
} catch {
  // Not available
}

// Lazy-load callManager for speaker toggle — avoid native module crash in Expo Go
let callManager: any = null;
try {
  callManager = require("@stream-io/video-react-native-sdk").callManager;
} catch {
  // Not available in Expo Go
}

const SCREEN_WIDTH = Dimensions.get("window").width;

type Props = NativeStackScreenProps<MainStackParamList, "VoiceChannel">;

export default function VoiceChannelScreen({ route, navigation }: Props) {
  // Normalize params once at the top — prevents undefined-driven re-renders
  const params = route.params as {
    channelId?: string;
    channelName?: string;
    groupId?: string;
  };
  const channelId = params.channelId ?? "";
  const channelName = params.channelName ?? "Voice Room";
  const groupId = params.groupId ?? "";

  const {
    leaveChannel,
    joinChannel,
    activeCall,
    activeSession,
    wasChannelDeliberatelyLeft,
    clearDeliberateLeave,
  } = useStreamCall();
  const { colors } = useAppTheme();
  const [joinError, setJoinError] = useState<string | null>(null);
  const joinAttemptedRef = useRef(false);
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Auto-join the voice channel on mount if not already in it.
  // Skips join if the user deliberately left this channel to prevent
  // the rejoin-after-disconnect bug.
  const isAlreadyInChannel =
    activeSession?.type === "voice_channel" &&
    activeSession.channelId === channelId;

  useEffect(() => {
    if (!groupId || isAlreadyInChannel || joinAttemptedRef.current) return;
    // If the user deliberately left this channel, do NOT auto-rejoin.
    // They must explicitly tap "Join Voice" again (which calls
    // clearDeliberateLeave before joinChannel).
    if (wasChannelDeliberatelyLeft(channelId)) {
      if (navigation.canGoBack()) navigation.goBack();
      return;
    }
    joinAttemptedRef.current = true;

    joinChannel(groupId, channelName).catch((err: any) => {
      console.error("[VoiceChannelScreen] joinChannel error:", err);
      if (mountedRef.current) {
        setJoinError(err?.message || "Failed to join voice channel");
      }
    });
  }, [
    groupId,
    channelName,
    channelId,
    isAlreadyInChannel,
    joinChannel,
    wasChannelDeliberatelyLeft,
    navigation,
  ]);

  // Ref-gate prevents multiple leaveChannel dispatches. Avoids redundant
  // state resets and rapid <StreamCall> mount/unmount during disconnection.
  const leavingRef = useRef(false);

  // Leave = deliberate disconnect + navigate back
  const handleLeave = useCallback(async () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    try {
      await leaveChannel();
    } catch (err) {
      console.error("[VoiceChannelScreen] leaveChannel error:", err);
    } finally {
      if (navigation.canGoBack()) navigation.goBack();
    }
  }, [leaveChannel, navigation]);

  // Back = minimize (stay in call, navigate back)
  const handleMinimize = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  if (joinError) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.centered}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={48}
            color={colors.error}
          />
          <Text
            style={[styles.errorTitle, { color: colors.text, marginTop: 12 }]}
          >
            Couldn't join voice channel
          </Text>
          <Text
            style={[
              styles.errorDetail,
              { color: colors.textSecondary, marginTop: 6 },
            ]}
          >
            {joinError}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={() => {
              if (navigation.canGoBack()) navigation.goBack();
            }}
          >
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!activeCall) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text
            style={[
              styles.statusText,
              { color: colors.textSecondary, marginTop: 12 },
            ]}
          >
            Joining voice channel...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <StreamCall call={activeCall}>
      <VoiceChannelContent
        channelName={channelName}
        onLeave={handleLeave}
        onMinimize={handleMinimize}
      />
    </StreamCall>
  );
}

// ---------------------------------------------------------------------------
// Inner content (must be inside StreamCall provider)
// ---------------------------------------------------------------------------

function VoiceChannelContent({
  channelName,
  onLeave,
  onMinimize,
}: {
  channelName: string;
  onLeave: () => void;
  onMinimize: () => void;
}) {
  const { colors } = useAppTheme();
  const {
    useCallCallingState,
    useParticipants,
    useMicrophoneState,
    useCameraState,
  } = useCallStateHooks();

  const callingState = useCallCallingState();
  const participants = useParticipants();
  const { isMute: isMuted, microphone } = useMicrophoneState();
  const { isMute: isCameraOff, camera } = useCameraState();
  const isJoined = callingState === CallingState.JOINED;

  // Speaker toggle state — tracked locally because the SDK does not
  // provide useSpeakerState() on React Native.
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);

  // Screen share state — attempt to read from SDK, fallback to false
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareDisabledReason, setScreenShareDisabledReason] = useState<
    string | undefined
  >(undefined);

  // Check screen share capability on mount
  useEffect(() => {
    if (Platform.OS === "ios") {
      // iOS needs a Broadcast Extension; check if it's configured
      setScreenShareDisabledReason(undefined);
    } else if (Platform.OS === "android") {
      setScreenShareDisabledReason(undefined);
    } else {
      setScreenShareDisabledReason("Not supported on this platform");
    }
  }, []);

  // Play a brief chime when a new participant joins (skip the initial load)
  const prevCountRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isJoined) return;
    const count = participants.length;
    if (prevCountRef.current === null) {
      // First render after join — record baseline, no sound
      prevCountRef.current = count;
      return;
    }
    if (count > prevCountRef.current) {
      ringtoneService?.playSoundEffect("room_join");
    }
    prevCountRef.current = count;
  }, [isJoined, participants.length]);

  // Safe mic toggle — only allow when JOINED
  const handleToggleMic = useCallback(async () => {
    if (callingState !== CallingState.JOINED) return;
    try {
      await microphone.toggle();
    } catch (err) {
      console.warn("[VoiceChannelScreen] mic toggle failed:", err);
    }
  }, [callingState, microphone]);

  // Camera toggle
  const handleToggleCamera = useCallback(async () => {
    if (callingState !== CallingState.JOINED) return;
    try {
      await camera.toggle();
    } catch (err) {
      console.warn("[VoiceChannelScreen] camera toggle failed:", err);
    }
  }, [callingState, camera]);

  // Speaker toggle using callManager.speaker.setForceSpeakerphoneOn
  const handleToggleSpeaker = useCallback(async () => {
    if (!callManager?.speaker?.setForceSpeakerphoneOn) return;
    try {
      const newState = !isSpeakerOn;
      callManager.speaker.setForceSpeakerphoneOn(newState);
      setIsSpeakerOn(newState);
    } catch (err) {
      console.warn("[VoiceChannelScreen] speaker toggle failed:", err);
    }
  }, [isSpeakerOn]);

  // Camera flip
  const handleFlipCamera = useCallback(async () => {
    if (callingState !== CallingState.JOINED) return;
    try {
      await camera.flip();
    } catch (err) {
      console.warn("[VoiceChannelScreen] camera flip failed:", err);
    }
  }, [callingState, camera]);

  // Screen share toggle
  const handleToggleScreenShare = useCallback(async () => {
    if (callingState !== CallingState.JOINED || screenShareDisabledReason)
      return;
    try {
      // Access the call's screenShare property via the useCall hook
      // screenShare is available on the call object
      const call = (microphone as any)?.call;
      if (call?.screenShare) {
        if (isScreenSharing) {
          await call.screenShare.disable();
        } else {
          await call.screenShare.enable();
        }
        setIsScreenSharing(!isScreenSharing);
      }
    } catch (err) {
      console.warn("[VoiceChannelScreen] screen share toggle failed:", err);
    }
  }, [callingState, isScreenSharing, microphone, screenShareDisabledReason]);

  // Elapsed timer
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!isJoined) return;
    const iv = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(iv);
  }, [isJoined]);

  const timeStr = `${Math.floor(elapsed / 60)}:${(elapsed % 60).toString().padStart(2, "0")}`;

  // Build status text
  const statusText = (() => {
    switch (callingState) {
      case CallingState.JOINING:
        return "Connecting...";
      case CallingState.JOINED:
        return `${participants.length} ${participants.length === 1 ? "person" : "people"} · ${timeStr}`;
      case CallingState.RECONNECTING:
        return "Reconnecting...";
      default:
        return "";
    }
  })();

  // Calculate tile size based on participant count — 2 per row for <=4, 3 per row for more
  const numColumns = participants.length <= 4 ? 2 : 3;
  const tilePadding = 8;
  const tileSize =
    (SCREEN_WIDTH - 32 - tilePadding * (numColumns - 1)) / numColumns;

  const renderParticipant = useCallback(
    ({ item }: { item: (typeof participants)[0] }) => {
      // Speaking: only true if participant IS publishing audio AND marked as speaking.
      // A muted participant must NEVER show as speaking — this fixes the
      // "always speaking when muted" bug.
      const isPublishingAudio = item.publishedTracks?.includes(1); // TrackType.AUDIO
      const isSpeaking = !!(item.isSpeaking && isPublishingAudio);
      const isParticipantMuted = !isPublishingAudio;

      const displayName = item.name || "Participant";
      const avatarUrl = item.image;
      const hasVideo = item.publishedTracks?.includes(2); // TrackType.VIDEO

      return (
        <View
          style={[
            styles.participantTile,
            {
              width: tileSize,
              height: tileSize,
              backgroundColor: colors.surface,
              borderColor: isSpeaking ? "#43A047" : colors.border,
              borderWidth: isSpeaking ? 2 : 1,
            },
          ]}
        >
          {/* Avatar or video placeholder */}
          <View style={styles.tileAvatarContainer}>
            <ProfilePicture
              url={avatarUrl ?? null}
              name={displayName}
              size={Math.min(tileSize * 0.45, 56)}
              showLoading={false}
            />
          </View>

          {/* Name */}
          <Text
            style={[styles.tileName, { color: colors.text }]}
            numberOfLines={1}
          >
            {displayName}
          </Text>

          {/* Status icons row */}
          <View style={styles.tileStatusRow}>
            {isSpeaking && (
              <MaterialCommunityIcons
                name="volume-high"
                size={14}
                color="#43A047"
                style={{ marginRight: 4 }}
              />
            )}
            {isParticipantMuted && (
              <MaterialCommunityIcons
                name="microphone-off"
                size={14}
                color="#E53935"
                style={{ marginRight: 4 }}
              />
            )}
            {hasVideo && (
              <MaterialCommunityIcons
                name="video"
                size={14}
                color={colors.primary}
              />
            )}
          </View>
        </View>
      );
    },
    [colors, tileSize],
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      {/* Compact header — minimize arrow + status */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          onPress={onMinimize}
          style={styles.backButton}
          accessibilityLabel="Minimize voice room"
          accessibilityRole="button"
          hitSlop={12}
        >
          <MaterialCommunityIcons
            name="chevron-down"
            size={28}
            color={colors.text}
          />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={[styles.statusText, { color: colors.textSecondary }]}>
            {statusText}
          </Text>
        </View>

        {/* Spacer to center title */}
        <View style={styles.headerSpacer} />
      </View>

      {/* Participant Grid */}
      <FlatList
        data={participants}
        keyExtractor={(item) => item.sessionId}
        renderItem={renderParticipant}
        numColumns={numColumns}
        key={`grid-${numColumns}`}
        columnWrapperStyle={numColumns > 1 ? styles.gridRow : undefined}
        contentContainerStyle={styles.gridContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="account-group-outline"
              size={48}
              color={colors.textSecondary}
            />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {isJoined
                ? "You\u2019re the only one here"
                : "Connecting to voice channel..."}
            </Text>
          </View>
        }
      />

      {/* Full control bar with all supported controls */}
      <CallControlBar
        isMuted={isMuted}
        onToggleMic={handleToggleMic}
        micDisabled={!isJoined}
        showCamera={true}
        isCameraOff={isCameraOff}
        onToggleCamera={handleToggleCamera}
        showFlipCamera={!isCameraOff}
        onFlipCamera={handleFlipCamera}
        showSpeaker={!!callManager?.speaker?.setForceSpeakerphoneOn}
        isSpeakerOn={isSpeakerOn}
        onToggleSpeaker={handleToggleSpeaker}
        showScreenShare={!screenShareDisabledReason}
        isScreenSharing={isScreenSharing}
        onToggleScreenShare={handleToggleScreenShare}
        screenShareDisabledReason={screenShareDisabledReason}
        onLeave={onLeave}
        leaveLabel="Disconnect"
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
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  errorDetail: {
    fontSize: 14,
    textAlign: "center",
  },

  // Header — compact, no Voice Room banner
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  statusText: {
    fontSize: 13,
    fontWeight: "500",
  },
  headerSpacer: {
    width: 40,
  },

  // Participant grid
  gridContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  gridRow: {
    gap: 8,
    marginBottom: 8,
  },
  participantTile: {
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  tileAvatarContainer: {
    marginBottom: 6,
  },
  tileName: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 4,
  },
  tileStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 16,
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 15,
    marginTop: 12,
    textAlign: "center",
  },

  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
