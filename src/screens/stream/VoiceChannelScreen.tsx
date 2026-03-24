/**
 * Voice Channel Screen
 *
 * Discord-style shared voice room UI. Replaces the legacy GroupCallScreen.
 *
 * Features:
 * - Real-time participant list
 * - Mute/unmute toggle
 * - Leave button (does NOT end the room for others)
 * - Active speaker indicators
 * - No ringing, no incoming overlay needed
 */

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
import React, { useCallback, useEffect } from "react";
import {
  FlatList,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Props = NativeStackScreenProps<MainStackParamList, "VoiceChannel">;

export default function VoiceChannelScreen({ route, navigation }: Props) {
  const { channelId, channelName, groupId } = route.params as {
    channelId: string;
    channelName: string;
    groupId: string;
  };

  const { leaveChannel, activeCall } = useStreamCall();
  const { colors } = useAppTheme();

  const handleLeave = useCallback(async () => {
    try {
      await leaveChannel();
    } catch (err) {
      console.error("[VoiceChannelScreen] leaveChannel error:", err);
    } finally {
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    }
  }, [leaveChannel, navigation]);

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
            Disconnected
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <StreamCall call={activeCall}>
      <VoiceChannelContent channelName={channelName} onLeave={handleLeave} />
    </StreamCall>
  );
}

// ---------------------------------------------------------------------------
// Inner content (must be inside StreamCall provider)
// ---------------------------------------------------------------------------

function VoiceChannelContent({
  channelName,
  onLeave,
}: {
  channelName: string;
  onLeave: () => void;
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

  // Get status text
  const getStatusText = () => {
    switch (callingState) {
      case CallingState.JOINING:
        return "Connecting...";
      case CallingState.JOINED:
        return `${participants.length} ${participants.length === 1 ? "person" : "people"} in channel`;
      case CallingState.RECONNECTING:
        return "Reconnecting...";
      default:
        return "";
    }
  };

  const renderParticipant = useCallback(
    ({ item }: { item: (typeof participants)[0] }) => {
      const isSpeaking = dominantSpeaker?.userId === item.userId;
      const isParticipantMuted = !item.publishedTracks?.includes(
        // SfuModels.TrackType.AUDIO
        1,
      );

      return (
        <View
          style={[
            styles.participantRow,
            {
              backgroundColor: isSpeaking
                ? "rgba(67, 160, 71, 0.12)"
                : "transparent",
              borderColor: colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.participantAvatar,
              {
                backgroundColor: isSpeaking ? "#43A047" : colors.primary,
              },
            ]}
          >
            <MaterialCommunityIcons name="account" size={24} color="#fff" />
          </View>
          <Text
            style={[styles.participantName, { color: colors.text }]}
            numberOfLines={1}
          >
            {item.name || item.userId}
          </Text>
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
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons
            name="volume-high"
            size={22}
            color="#43A047"
          />
          <Text
            style={[styles.channelName, { color: colors.text }]}
            numberOfLines={1}
          >
            {channelName}
          </Text>
        </View>
        <Text style={[styles.statusText, { color: colors.textSecondary }]}>
          {getStatusText()}
        </Text>
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
                ? "You're the only one here"
                : "Connecting to voice channel..."}
            </Text>
          </View>
        }
      />

      {/* Bottom Controls */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.controlButton, isMuted && styles.controlButtonMuted]}
          onPress={() => microphone.toggle()}
        >
          <MaterialCommunityIcons
            name={isMuted ? "microphone-off" : "microphone"}
            size={26}
            color={isMuted ? "#E53935" : colors.text}
          />
          <Text style={[styles.controlLabel, { color: colors.textSecondary }]}>
            {isMuted ? "Unmute" : "Mute"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.leaveButton]}
          onPress={onLeave}
        >
          <MaterialCommunityIcons name="phone-hangup" size={26} color="#fff" />
          <Text style={[styles.controlLabel, { color: "#fff" }]}>
            Disconnect
          </Text>
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
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  channelName: {
    fontSize: 20,
    fontWeight: "700",
    marginLeft: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "500",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  participantRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  participantName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
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
  },
  bottomBar: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    paddingVertical: 16,
    paddingBottom: Platform.OS === "ios" ? 36 : 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  controlButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(128,128,128,0.12)",
  },
  controlButtonMuted: {
    backgroundColor: "rgba(229,57,53,0.12)",
  },
  leaveButton: {
    backgroundColor: "#E53935",
  },
  controlLabel: {
    fontSize: 11,
    marginTop: 3,
    fontWeight: "500",
  },
});
