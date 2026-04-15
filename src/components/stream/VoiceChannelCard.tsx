/**
 * Voice Channel Card
 *
 * Entry point for Discord-style voice channels in the group chat UI.
 * Shows:
 * - Current occupancy (who's in the channel)
 * - A join button
 * - Live status and refresh errors
 */

import { ProfilePicture } from "@/components/profile/ProfilePicture/ProfilePicture";
import { useStreamCall } from "@/contexts/StreamCallContext";
import { useVoiceRoomOccupancy } from "@/hooks/useVoiceRoomOccupancy";
import { getVoiceChannelId } from "@/services/stream/voiceChannelIds";
import { useAppTheme } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface VoiceChannelCardProps {
  groupId: string;
  groupName: string;
  onJoin: (channelId: string, channelName: string, groupId: string) => void;
}

export default function VoiceChannelCard({
  groupId,
  groupName,
  onJoin,
}: VoiceChannelCardProps) {
  const { isBusy, activeSession } = useStreamCall();
  const { colors } = useAppTheme();
  const {
    occupants,
    isActive,
    loading,
    error,
    errorMessage,
  } = useVoiceRoomOccupancy(groupId);

  const channelId = getVoiceChannelId(groupId);
  const channelName = `${groupName} Voice`;

  const isInThisChannel =
    activeSession?.type === "voice_channel" &&
    activeSession.channelId === channelId;

  const handleJoin = useCallback(() => {
    onJoin(channelId, channelName, groupId);
  }, [channelId, channelName, groupId, onJoin]);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: isActive ? "#43A047" : colors.border,
        },
      ]}
    >
      <View style={styles.header}>
        <MaterialCommunityIcons
          name="volume-high"
          size={20}
          color={isActive ? "#43A047" : colors.textSecondary}
        />
        <Text
          style={[
            styles.channelName,
            { color: isActive ? "#43A047" : colors.text },
          ]}
          numberOfLines={1}
        >
          Voice Channel
        </Text>
        {isActive && (
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
        )}
      </View>

      {isActive && (
        <View style={styles.occupants}>
          {occupants.slice(0, 5).map((occupant) => (
            <View key={occupant.userId} style={styles.occupantRow}>
              <ProfilePicture
                url={occupant.image ?? null}
                name={occupant.name}
                size={20}
                showLoading={false}
              />
              <Text
                style={[styles.occupantName, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {occupant.name}
              </Text>
            </View>
          ))}
          {occupants.length > 5 && (
            <Text style={[styles.moreText, { color: colors.textSecondary }]}>
              +{occupants.length - 5} more
            </Text>
          )}
        </View>
      )}

      {!isActive && loading && (
        <View style={styles.statusRow}>
          <MaterialCommunityIcons
            name="progress-clock"
            size={15}
            color={colors.textSecondary}
          />
          <Text style={[styles.statusText, { color: colors.textSecondary }]}>
            Checking live room status...
          </Text>
        </View>
      )}

      {!isActive && error && (
        <View style={styles.statusRow}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={15}
            color={colors.warning}
          />
          <Text style={[styles.statusText, { color: colors.textSecondary }]}>
            {errorMessage || "Live status unavailable right now"}
          </Text>
        </View>
      )}

      {isInThisChannel ? (
        <View style={[styles.joinButton, styles.inChannelButton]}>
          <MaterialCommunityIcons name="headphones" size={18} color="#43A047" />
          <Text style={[styles.joinButtonText, { color: "#43A047" }]}>
            Connected
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[
            styles.joinButton,
            {
              backgroundColor: isBusy ? colors.textMuted : "#43A047",
            },
          ]}
          onPress={handleJoin}
          disabled={isBusy}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="headphones" size={18} color="#fff" />
          <Text style={styles.joinButtonText}>
            {isBusy ? "In another call" : "Join Voice"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  channelName: {
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 6,
    flex: 1,
  },
  liveBadge: {
    backgroundColor: "#43A047",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  occupants: {
    marginBottom: 10,
  },
  occupantRow: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 26,
    marginBottom: 2,
  },
  occupantName: {
    fontSize: 13,
    marginLeft: 4,
  },
  moreText: {
    fontSize: 12,
    marginLeft: 40,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  statusText: {
    fontSize: 12,
    flex: 1,
  },
  joinButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  inChannelButton: {
    backgroundColor: "rgba(67,160,71,0.12)",
  },
  joinButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
