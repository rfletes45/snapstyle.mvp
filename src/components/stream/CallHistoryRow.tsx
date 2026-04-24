/**
 * CallHistoryRow
 *
 * Renders a single call history entry in the Calls screen list.
 * Shows real profile pictures for DM calls and group avatars for rooms.
 * Supports direct calls (audio/video) and voice room entries.
 */

import { ProfilePicture } from "@/components/profile/ProfilePicture/ProfilePicture";
import { useAppTheme } from "@/store/ThemeContext";
import type { StreamCallHistoryEntry } from "@/types/streamCallHistory";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface CallHistoryRowProps {
  entry: StreamCallHistoryEntry;
  onPress: (entry: StreamCallHistoryEntry) => void;
}

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

export default function CallHistoryRow({
  entry,
  onPress,
}: CallHistoryRowProps) {
  const { colors } = useAppTheme();
  const isMissed = entry.result === "missed";
  const isDeclined = entry.result === "declined";
  const isRoom = entry.entryType === "voice_room";

  const handlePress = useCallback(() => {
    onPress(entry);
  }, [entry, onPress]);

  // Icon + color for direction/type
  const { icon, iconColor } = useMemo((): {
    icon: IconName;
    iconColor: string;
  } => {
    if (isRoom) {
      return { icon: "account-group", iconColor: colors.primary };
    }
    if (isMissed) {
      return {
        icon: entry.direction === "incoming" ? "phone-missed" : "phone-missed",
        iconColor: colors.error,
      };
    }
    if (isDeclined) {
      return { icon: "phone-cancel-outline", iconColor: colors.error };
    }
    if (entry.entryType === "direct_video") {
      return {
        icon:
          entry.direction === "incoming"
            ? "video-input-antenna"
            : "video-outline",
        iconColor:
          entry.direction === "incoming" ? colors.success : colors.primary,
      };
    }
    return {
      icon:
        entry.direction === "incoming" ? "phone-incoming" : "phone-outgoing",
      iconColor:
        entry.direction === "incoming" ? colors.success : colors.primary,
    };
  }, [
    isRoom,
    isMissed,
    isDeclined,
    entry.direction,
    entry.entryType,
    colors.primary,
    colors.error,
    colors.success,
  ]);

  // Primary title
  const title = isRoom
    ? entry.groupName || "Voice Room"
    : entry.otherUserName || "Unknown";

  // Subtitle metadata
  const subtitle = useMemo(() => {
    const parts: string[] = [];

    // Direction/type label
    if (isRoom) {
      parts.push("Voice room");
      if (entry.participantCount) {
        parts.push(`${entry.participantCount} people`);
      }
    } else {
      if (isMissed) {
        parts.push("Missed");
      } else if (isDeclined) {
        parts.push("Declined");
      } else if (entry.result === "canceled") {
        parts.push("Canceled");
      } else {
        parts.push(entry.direction === "incoming" ? "Incoming" : "Outgoing");
      }

      parts.push(entry.entryType === "direct_video" ? "video" : "audio");
    }

    // Duration
    if (entry.durationSeconds && entry.durationSeconds > 0) {
      parts.push(formatDuration(entry.durationSeconds));
    }

    return parts.join(" · ");
  }, [isRoom, isMissed, isDeclined, entry]);

  // Timestamp — uses a per-component ticker so relative labels ("5m ago",
  // "1h ago", etc.) update live without requiring a full refresh of the
  // list or a cold app restart. The tick interval is adaptive: seconds
  // until we cross the next threshold, capped between 15s and 60s. Entries
  // older than 7 days render a static date, so they opt out of the ticker.
  const [, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const ageMs = Date.now() - entry.createdAt;
    // Older than 7 days → static date label, no ticker needed.
    if (ageMs > 7 * 24 * 60 * 60 * 1000) return;
    const id = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [entry.createdAt]);

  const timeLabel = formatRelativeTime(entry.createdAt);

  // Avatar content — use real profile pictures when available
  const avatarUrl = isRoom ? entry.groupAvatar : entry.otherUserAvatar;
  const avatarName = isRoom
    ? entry.groupName || "Voice Room"
    : entry.otherUserName || "Unknown";
  const avatarBorderColor = isMissed
    ? colors.error + "40"
    : colors.primary + "30";

  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={handlePress}
      activeOpacity={0.6}
    >
      {/* Left avatar — real profile picture or fallback */}
      {isRoom && !avatarUrl ? (
        <View
          style={[styles.avatar, { backgroundColor: colors.primary + "22" }]}
        >
          <MaterialCommunityIcons
            name="account-group"
            size={22}
            color={colors.primary}
          />
        </View>
      ) : (
        <View
          style={[styles.avatarWrapper, { borderColor: avatarBorderColor }]}
        >
          <ProfilePicture
            url={avatarUrl ?? null}
            name={avatarName}
            size={40}
            showLoading={false}
          />
        </View>
      )}

      {/* Center text */}
      <View style={styles.textBlock}>
        <View style={styles.titleRow}>
          <Text
            style={[
              styles.title,
              { color: isMissed || isDeclined ? colors.error : colors.text },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text style={[styles.time, { color: colors.textSecondary }]}>
            {timeLabel}
          </Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={18}
            color={colors.textMuted}
            style={styles.chevron}
          />
        </View>

        <View style={styles.subtitleRow}>
          <MaterialCommunityIcons
            name={icon}
            size={14}
            color={iconColor}
            style={styles.subtitleIcon}
          />
          <Text
            style={[styles.subtitle, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        </View>
      </View>

    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const date = new Date(ts);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  textBlock: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  time: {
    fontSize: 12,
    fontWeight: "400",
  },
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  subtitleIcon: {
    marginRight: 4,
  },
  subtitle: {
    fontSize: 13,
    flex: 1,
  },
  chevron: {
    marginLeft: 3,
  },
});
