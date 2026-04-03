/**
 * Voice Channel Screen
 *
 * Discord-style shared voice room UI. Replaces the legacy GroupCallScreen.
 *
 * Features:
 * - Participant grid with avatar tiles (supports real video when published)
 * - Full control bar: mute, camera, speaker, disconnect
 * - Accurate speaking indicators (checks isSpeaking and published audio)
 * - Back navigation (minimize) while staying connected
 * - Leave button (does not end the room for others)
 * - No ringing, no incoming overlay needed
 * - Deliberate-leave flag auto-cleared on mount so user can rejoin
 */

import { ProfilePicture } from "@/components/profile/ProfilePicture/ProfilePicture";
import type { AudioRoute } from "@/components/stream/AudioRoutePicker";
import {
  AudioRoutePicker,
  applyAudioRoute,
  getAudioRouteFromStatus,
} from "@/components/stream/AudioRoutePicker";
import { CallControlBar } from "@/components/stream/CallControlBar";
import { useStreamCall } from "@/contexts/StreamCallContext";
import { useAppTheme } from "@/store/ThemeContext";
import type { MainStackParamList } from "@/types/navigation/root";
import { requestCameraPermission } from "@/utils/permissions";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { hasAudio, hasVideo } from "@stream-io/video-client";
import {
  CallingState,
  ParticipantView,
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

let ringtoneService: typeof import("@/services/calls/ringtoneService") | null =
  null;
try {
  ringtoneService = require("@/services/calls/ringtoneService");
} catch {
  // Not available
}

let callManager: any = null;
try {
  callManager = require("@stream-io/video-react-native-sdk").callManager;
} catch {
  // Not available in Expo Go
}

const SCREEN_WIDTH = Dimensions.get("window").width;

type Props = NativeStackScreenProps<MainStackParamList, "VoiceChannel">;

export default function VoiceChannelScreen({ route, navigation }: Props) {
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
    isBusy,
    wasChannelDeliberatelyLeft,
    clearDeliberateLeave,
  } = useStreamCall();
  const { colors } = useAppTheme();
  const [joinError, setJoinError] = useState<string | null>(null);
  const joinAttemptedRef = useRef(false);
  const mountedRef = useRef(true);
  const hasSeenActiveCallRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (activeCall) {
      hasSeenActiveCallRef.current = true;
      return;
    }

    if (!hasSeenActiveCallRef.current) return;

    const timeout = setTimeout(() => {
      if (navigation.canGoBack()) navigation.goBack();
    }, 250);

    return () => clearTimeout(timeout);
  }, [activeCall, navigation]);

  const isAlreadyInChannel =
    activeSession?.type === "voice_channel" &&
    activeSession.channelId === channelId;

  useEffect(() => {
    if (!groupId || isAlreadyInChannel || joinAttemptedRef.current) return;

    // Guard: don't attempt to join if user is already in another call.
    // The context's joinChannel() would throw, but checking here avoids
    // a subtle race where isBusy becomes true between render and effect.
    if (isBusy && !isAlreadyInChannel) {
      setJoinError(
        "You're already in a call. Leave it first to join this voice channel.",
      );
      return;
    }

    if (wasChannelDeliberatelyLeft(channelId)) {
      clearDeliberateLeave(channelId);
    }

    joinAttemptedRef.current = true;

    joinChannel(groupId, channelName).catch((err: any) => {
      console.error("[VoiceChannelScreen] joinChannel error:", err);
      if (mountedRef.current) {
        setJoinError(err?.message || "Failed to join voice channel");
      }
    });
  }, [
    channelId,
    channelName,
    clearDeliberateLeave,
    groupId,
    isBusy,
    isAlreadyInChannel,
    joinChannel,
    wasChannelDeliberatelyLeft,
  ]);

  const leavingRef = useRef(false);

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
            Could not join voice channel
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
      <VoiceChannelContent onLeave={handleLeave} onMinimize={handleMinimize} />
    </StreamCall>
  );
}

function VoiceChannelContent({
  onLeave,
  onMinimize,
}: {
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
  const { optimisticIsMute: isMuted, microphone } = useMicrophoneState();
  const { optimisticIsMute: isCameraOff, camera } = useCameraState();
  const isJoined = callingState === CallingState.JOINED;
  const [isSpeakerOn, setIsSpeakerOn] = useState(true); // Voice rooms default to speaker
  const [audioRoutePickerVisible, setAudioRoutePickerVisible] = useState(false);
  const [currentAudioRoute, setCurrentAudioRoute] =
    useState<AudioRoute>("speaker");

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
            "[VoiceChannelScreen] Failed to sync Android audio route:",
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

  const prevCountRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isJoined) return;
    const count = participants.length;
    if (prevCountRef.current === null) {
      prevCountRef.current = count;
      return;
    }
    if (count > prevCountRef.current) {
      // Small delay lets the audio session from callManager.start() settle.
      // expo-audio playback can fail if fired immediately after the session
      // switches to .playAndRecord mode.
      setTimeout(() => {
        ringtoneService?.playSoundEffect("room_join");
      }, 300);
    }
    prevCountRef.current = count;
  }, [isJoined, participants.length]);

  const handleToggleMic = useCallback(async () => {
    if (callingState !== CallingState.JOINED) return;
    try {
      await microphone.toggle();
    } catch (err) {
      console.warn("[VoiceChannelScreen] mic toggle failed:", err);
    }
  }, [callingState, microphone]);

  const handleToggleCamera = useCallback(async () => {
    if (callingState !== CallingState.JOINED) return;
    try {
      if (isCameraOff) {
        const granted = await requestCameraPermission();
        if (!granted) return;
      }
      await camera.toggle();
    } catch (err) {
      console.warn("[VoiceChannelScreen] camera toggle failed:", err);
    }
  }, [callingState, camera, isCameraOff]);

  const handleToggleSpeaker = useCallback(async () => {
    if (!callManager?.speaker?.setForceSpeakerphoneOn) return;
    try {
      const newState = !isSpeakerOn;
      callManager.speaker.setForceSpeakerphoneOn(newState);
      setIsSpeakerOn(newState);
      setCurrentAudioRoute(newState ? "speaker" : "earpiece");
    } catch (err) {
      console.warn("[VoiceChannelScreen] speaker toggle failed:", err);
    }
  }, [isSpeakerOn]);

  const handleAudioRouteSelect = useCallback((route: AudioRoute) => {
    applyAudioRoute(route);
    setCurrentAudioRoute(route);
    setIsSpeakerOn(route === "speaker");
  }, []);

  const handleFlipCamera = useCallback(async () => {
    if (callingState !== CallingState.JOINED) return;
    try {
      await camera.flip();
    } catch (err) {
      console.warn("[VoiceChannelScreen] camera flip failed:", err);
    }
  }, [callingState, camera]);

  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!isJoined) return;
    const interval = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(interval);
  }, [isJoined]);

  const timeStr = `${Math.floor(elapsed / 60)}:${(elapsed % 60).toString().padStart(2, "0")}`;
  const statusText = (() => {
    switch (callingState) {
      case CallingState.JOINING:
        return "Connecting...";
      case CallingState.JOINED:
        return `${participants.length} ${participants.length === 1 ? "person" : "people"} - ${timeStr}`;
      case CallingState.RECONNECTING:
      case CallingState.MIGRATING:
        return "Reconnecting...";
      case CallingState.RECONNECTING_FAILED:
        return "Connection failed — leaving room...";
      case CallingState.OFFLINE:
        return "Offline, waiting to reconnect...";
      default:
        return "";
    }
  })();

  const numColumns = participants.length <= 4 ? 2 : 3;
  const tilePadding = 8;
  const tileSize =
    (SCREEN_WIDTH - 32 - tilePadding * (numColumns - 1)) / numColumns;

  const renderParticipant = useCallback(
    ({ item }: { item: (typeof participants)[0] }) => {
      const isPublishingAudio = hasAudio(item);
      const isSpeaking = !!(item.isSpeaking && isPublishingAudio);
      const isParticipantMuted = !isPublishingAudio;
      const participantHasVideo = hasVideo(item);
      const displayName = item.name || "Participant";
      const avatarUrl = item.image;

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
          {participantHasVideo ? (
            <ParticipantView
              participant={item}
              trackType="videoTrack"
              style={styles.participantVideo}
              objectFit="cover"
              ParticipantLabel={null as any}
              ParticipantReaction={null as any}
              ParticipantNetworkQualityIndicator={null as any}
              ParticipantVideoFallback={() => (
                <View style={styles.tileAvatarContainer}>
                  <ProfilePicture
                    url={avatarUrl ?? null}
                    name={displayName}
                    size={Math.min(tileSize * 0.45, 56)}
                    showLoading={false}
                  />
                </View>
              )}
            />
          ) : (
            <View style={styles.tileAvatarContainer}>
              <ProfilePicture
                url={avatarUrl ?? null}
                name={displayName}
                size={Math.min(tileSize * 0.45, 56)}
                showLoading={false}
              />
            </View>
          )}

          <View style={participantHasVideo ? styles.tileOverlay : undefined}>
            <Text
              style={[
                styles.tileName,
                { color: participantHasVideo ? "#fff" : colors.text },
              ]}
              numberOfLines={1}
            >
              {displayName}
            </Text>

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
            </View>
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

        <View style={styles.headerSpacer}>
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
      </View>

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
                ? "You're the only one here"
                : "Connecting to voice channel..."}
            </Text>
          </View>
        }
      />

      {/* Screen share is intentionally hidden here. This app build does not
          have Stream's native screenshare setup wired end-to-end, and the
          installed SDK version only exposes the older broadcast flow. */}
      <CallControlBar
        isMuted={isMuted}
        onToggleMic={handleToggleMic}
        micDisabled={!isJoined}
        showCamera={isJoined}
        isCameraOff={isCameraOff}
        onToggleCamera={handleToggleCamera}
        showFlipCamera={isJoined && !isCameraOff}
        onFlipCamera={handleFlipCamera}
        showSpeaker={!!callManager?.speaker?.setForceSpeakerphoneOn}
        isSpeakerOn={isSpeakerOn}
        onToggleSpeaker={handleToggleSpeaker}
        onLeave={onLeave}
        leaveLabel="Disconnect"
      />

      <AudioRoutePicker
        visible={audioRoutePickerVisible}
        onClose={() => setAudioRoutePickerVisible(false)}
        currentRoute={currentAudioRoute}
        onRouteSelected={handleAudioRouteSelect}
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
    overflow: "hidden",
  },
  participantVideo: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
  },
  tileOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    alignItems: "center",
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
