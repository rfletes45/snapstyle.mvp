/**
 * Voice Channel Card
 *
 * Entry point for Discord-style voice channels in the group chat UI.
 * Shows:
 * - Current occupancy (who's in the channel)
 * - A join button
 * - Active speaker indicators
 *
 * This component does NOT require the user to be in the channel.
 * It queries the channel state from Stream for occupancy info.
 */

import { ProfilePicture } from "@/components/profile/ProfilePicture/ProfilePicture";
import { useStreamCall } from "@/contexts/StreamCallContext";
import { getVoiceChannelId } from "@/services/stream/voiceChannelIds";
import { useAppTheme } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface VoiceChannelCardProps {
  groupId: string;
  groupName: string;
  /** Callback when user wants to join — parent should navigate to VoiceChannel screen */
  onJoin: (channelId: string, channelName: string, groupId: string) => void;
}

interface ChannelOccupant {
  userId: string;
  name: string;
  image?: string;
}

export default function VoiceChannelCard({
  groupId,
  groupName,
  onJoin,
}: VoiceChannelCardProps) {
  const { isBusy, activeSession } = useStreamCall();
  const { colors } = useAppTheme();
  const [occupants, setOccupants] = useState<ChannelOccupant[]>([]);

  const channelId = getVoiceChannelId(groupId);
  const channelName = `${groupName} Voice`;

  // Is the current user already in this channel?
  const isInThisChannel =
    activeSession?.type === "voice_channel" &&
    activeSession.channelId === channelId;

  // Poll occupancy (lightweight — uses queryCalls, no camera hardware)
  useEffect(() => {
    let cancelled = false;

    async function fetchOccupancy() {
      try {
        const { queryVoiceChannel } =
          require("@/services/stream/voiceChannelService") as typeof import("@/services/stream/voiceChannelService");
        const result = await queryVoiceChannel(groupId);
        if (cancelled) return;

        if (result) {
          const participants = result.state.participants ?? [];
          setOccupants(
            participants.map((p) => ({
              userId: p.userId,
              name: p.name || p.userId,
              image: p.image || undefined,
            })),
          );
        } else {
          setOccupants([]);
        }
      } catch {
        if (!cancelled) setOccupants([]);
      }
    }

    fetchOccupancy();
    const interval = setInterval(fetchOccupancy, 10_000); // refresh every 10s

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [groupId]);

  const handleJoin = useCallback(() => {
    onJoin(channelId, channelName, groupId);
  }, [channelId, channelName, groupId, onJoin]);

  const isActive = occupants.length > 0;

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

      {/* Occupancy */}
      {isActive && (
        <View style={styles.occupants}>
          {occupants.slice(0, 5).map((o) => (
            <View key={o.userId} style={styles.occupantRow}>
              <ProfilePicture
                url={o.image ?? null}
                name={o.name}
                size={20}
                showLoading={false}
              />
              <Text
                style={[styles.occupantName, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {o.name}
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

      {/* Join / In Channel Button */}
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
