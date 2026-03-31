/**
 * Voice Channel Screen
 *
 * Discord-style shared voice room UI. Replaces the legacy GroupCallScreen.
 *
 * Features:
 * - Real-time participant list with proper display names and profile pictures
 * - Mute/unmute toggle with permission diagnostics
 * - Back navigation (minimize) while staying connected
 * - Leave button (does NOT end the room for others)
 * - Active speaker indicators
 * - No ringing, no incoming overlay needed
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
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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

  const { leaveChannel, joinChannel, activeCall, activeSession } =
    useStreamCall();
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

  // Auto-join the voice channel on mount if not already in it
  const isAlreadyInChannel =
    activeSession?.type === "voice_channel" &&
    activeSession.channelId === channelId;

  useEffect(() => {
    if (!groupId || isAlreadyInChannel || joinAttemptedRef.current) return;
    joinAttemptedRef.current = true;

    joinChannel(groupId, channelName).catch((err: any) => {
      console.error("[VoiceChannelScreen] joinChannel error:", err);
      if (mountedRef.current) {
        setJoinError(err?.message || "Failed to join voice channel");
      }
    });
  }, [groupId, channelName, isAlreadyInChannel, joinChannel]);

  // Leave = deliberate disconnect + navigate back
  const handleLeave = useCallback(async () => {
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
    useDominantSpeaker,
  } = useCallStateHooks();

  const callingState = useCallCallingState();
  const participants = useParticipants();
  const { isMute: isMuted, microphone } = useMicrophoneState();
  const dominantSpeaker = useDominantSpeaker();
  const isJoined = callingState === CallingState.JOINED;

  // Safe mic toggle — only allow when JOINED to prevent permanent track death
  const handleToggleMic = useCallback(async () => {
    if (callingState !== CallingState.JOINED) return;
    try {
      await microphone.toggle();
    } catch (err) {
      console.warn("[VoiceChannelScreen] mic toggle failed:", err);
    }
  }, [callingState, microphone]);

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

  const renderParticipant = useCallback(
    ({ item }: { item: (typeof participants)[0] }) => {
      const isSpeaking = dominantSpeaker?.userId === item.userId;
      const isParticipantMuted = !item.publishedTracks?.includes(1); // TrackType.AUDIO

      // Derive display name — never show raw userId unless no better data
      const displayName = item.name || "Participant";
      const avatarUrl = item.image;

      return (
        <View
          style={[
            styles.participantRow,
            {
              backgroundColor: isSpeaking
                ? "rgba(67, 160, 71, 0.10)"
                : "transparent",
            },
          ]}
        >
          {/* Profile picture from Stream user data */}
          <View
            style={[styles.avatarRing, isSpeaking && styles.avatarRingSpeaking]}
          >
            <ProfilePicture
              url={avatarUrl ?? null}
              name={displayName}
              size={40}
              showLoading={false}
            />
          </View>

          <View style={styles.participantInfo}>
            <Text
              style={[styles.participantName, { color: colors.text }]}
              numberOfLines={1}
            >
              {displayName}
            </Text>
            {isSpeaking && (
              <Text style={[styles.speakingLabel, { color: "#43A047" }]}>
                Speaking
              </Text>
            )}
          </View>

          <View style={styles.participantIcons}>
            {isSpeaking && (
              <MaterialCommunityIcons
                name="volume-high"
                size={18}
                color="#43A047"
                style={styles.iconSpacing}
              />
            )}
            {isParticipantMuted && (
              <MaterialCommunityIcons
                name="microphone-off"
                size={18}
                color="#E53935"
              />
            )}
          </View>
        </View>
      );
    },
    [dominantSpeaker, colors],
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      {/* Header with back arrow */}
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
          <View style={styles.headerTitleRow}>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
            </View>
            <Text
              style={[styles.channelName, { color: colors.text }]}
              numberOfLines={1}
            >
              {channelName}
            </Text>
          </View>
          <Text style={[styles.statusText, { color: colors.textSecondary }]}>
            {statusText}
          </Text>
        </View>

        {/* Spacer to center title */}
        <View style={styles.headerSpacer} />
      </View>

      {/* Participant List */}
      <FlatList
        data={participants}
        keyExtractor={(item) => item.sessionId}
        renderItem={renderParticipant}
        contentContainerStyle={styles.listContent}
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

      {/* Polished control bar */}
      <CallControlBar
        isMuted={isMuted}
        onToggleMic={handleToggleMic}
        micDisabled={!isJoined}
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

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
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
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(67, 160, 71, 0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#43A047",
  },
  channelName: {
    fontSize: 17,
    fontWeight: "700",
  },
  statusText: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 2,
  },
  headerSpacer: {
    width: 40,
  },

  // Participants
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  participantRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  avatarRing: {
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "transparent",
    marginRight: 12,
  },
  avatarRingSpeaking: {
    borderColor: "#43A047",
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 15,
    fontWeight: "600",
  },
  speakingLabel: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 1,
  },
  participantIcons: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconSpacing: {
    marginRight: 6,
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
