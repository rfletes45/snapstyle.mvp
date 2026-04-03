/**
 * ActiveRoomCard
 *
 * Renders a single active voice room row in the Calls screen.
 * Shows group name, occupant avatars, participant count, and join CTA.
 */

import { useStreamCall } from "@/contexts/StreamCallContext";
import type { ActiveVoiceRoom } from "@/hooks/useActiveVoiceRooms";
import { getVoiceChannelId } from "@/services/stream/voiceChannelIds";
import { useAppTheme } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface ActiveRoomCardProps {
  room: ActiveVoiceRoom;
  onJoin: (room: ActiveVoiceRoom) => void;
}

const AVATAR_SIZE = 28;
const OVERLAP = 8;
const MAX_VISIBLE = 4;

export default function ActiveRoomCard({ room, onJoin }: ActiveRoomCardProps) {
  const { colors } = useAppTheme();
  const { isBusy, activeSession } = useStreamCall();

  // Pulse animation for live dot
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const channelId = getVoiceChannelId(room.groupId);
  const isInThisRoom =
    activeSession?.type === "voice_channel" &&
    activeSession.channelId === channelId;

  const handlePress = useCallback(() => {
    onJoin(room);
  }, [room, onJoin]);

  const occupantCount = room.occupantCount;
  const visibleOccupants = room.occupants.slice(0, MAX_VISIBLE);
  const overflow = occupantCount - MAX_VISIBLE;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        isBusy && !isInThisRoom && styles.disabledCard,
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
      disabled={isBusy && !isInThisRoom}
      accessibilityLabel={`${room.groupName} voice room, ${occupantCount} ${occupantCount === 1 ? "person" : "people"}`}
      accessibilityRole="button"
    >
      {/* Left: Group icon + info */}
      <View style={styles.info}>
        <View
          style={[styles.groupIcon, { backgroundColor: colors.primary + "22" }]}
        >
          <MaterialCommunityIcons
            name="account-group"
            size={20}
            color={colors.primary}
          />
        </View>

        <View style={styles.textContainer}>
          <Text
            style={[styles.groupName, { color: colors.text }]}
            numberOfLines={1}
          >
            {room.groupName}
          </Text>
          <View style={styles.metaRow}>
            <Animated.View
              style={[
                styles.liveDot,
                { backgroundColor: colors.success, opacity: pulseAnim },
              ]}
            />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              {occupantCount} {occupantCount === 1 ? "person" : "people"} in
              voice room
            </Text>
          </View>
        </View>
      </View>

      {/* Middle: Stacked avatars */}
      <View style={styles.avatarStack}>
        {visibleOccupants.map((o, i) => (
          <View
            key={o.userId}
            style={[
              styles.avatarCircle,
              {
                backgroundColor: colors.primary,
                marginLeft: i > 0 ? -OVERLAP : 0,
                zIndex: visibleOccupants.length - i,
                borderColor: colors.surface,
              },
            ]}
          >
            <Text style={styles.avatarInitial}>
              {(o.name[0] || "?").toUpperCase()}
            </Text>
          </View>
        ))}
        {overflow > 0 && (
          <View
            style={[
              styles.avatarCircle,
              {
                backgroundColor: colors.textMuted,
                marginLeft: -OVERLAP,
                zIndex: 0,
                borderColor: colors.surface,
              },
            ]}
          >
            <Text style={styles.avatarInitial}>+{overflow}</Text>
          </View>
        )}
      </View>

      {/* Right: CTA */}
      {isInThisRoom ? (
        <View
          style={[
            styles.ctaButton,
            styles.inRoomButton,
            { borderColor: colors.success },
          ]}
        >
          <Text style={[styles.ctaText, { color: colors.success }]}>
            Return
          </Text>
        </View>
      ) : (
        <View
          style={[
            styles.ctaButton,
            { backgroundColor: isBusy ? colors.textMuted : colors.success },
          ]}
        >
          <Text style={styles.ctaText}>{isBusy ? "In Call" : "Join"}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  info: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
  },
  groupIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  groupName: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  metaText: {
    fontSize: 12,
  },
  avatarStack: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 10,
  },
  avatarCircle: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  avatarInitial: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
  ctaButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    minWidth: 56,
    alignItems: "center",
  },
  inRoomButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  disabledCard: {
    opacity: 0.5,
  },
});
