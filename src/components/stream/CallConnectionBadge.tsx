import { useAppTheme } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SfuModels } from "@stream-io/video-client";
import { CallingState } from "@stream-io/video-react-native-sdk";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface CallConnectionBadgeProps {
  callingState: CallingState;
  connectionQuality?: number;
}

export function CallConnectionBadge({
  callingState,
  connectionQuality,
}: CallConnectionBadgeProps) {
  const { colors } = useAppTheme();

  const stateBadge = (() => {
    switch (callingState) {
      case CallingState.RECONNECTING:
      case CallingState.MIGRATING:
        return {
          icon: "wifi-refresh",
          label: "Reconnecting",
          color: colors.warning,
        };
      case CallingState.OFFLINE:
        return {
          icon: "wifi-strength-alert-outline",
          label: "Offline",
          color: colors.warning,
        };
      case CallingState.RECONNECTING_FAILED:
        return {
          icon: "wifi-remove",
          label: "Connection lost",
          color: colors.error,
        };
      default:
        return null;
    }
  })();

  const qualityBadge =
    connectionQuality === SfuModels.ConnectionQuality.POOR
      ? {
          icon: "signal-cellular-1",
          label: "Weak connection",
          color: colors.warning,
        }
      : null;

  const badge = stateBadge ?? qualityBadge;
  if (!badge) return null;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: `${badge.color}18`,
          borderColor: `${badge.color}40`,
        },
      ]}
    >
      <MaterialCommunityIcons name={badge.icon as any} size={14} color={badge.color} />
      <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    gap: 5,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
