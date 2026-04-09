/**
 * Inbox message status icon.
 *
 * This is intentionally tolerant of both the current inbox data shape and
 * older/stale call sites that may still import this module while Metro cache
 * catches up after refactors.
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo } from "react";
import type { StyleProp, TextStyle } from "react-native";

import type { MessageStatusV2 } from "@/types/messaging";

type ResolvedStatus = Exclude<MessageStatusV2, "">;

export interface MessageStatusIconProps {
  status?: MessageStatusV2 | "error" | "pending" | null;
  color?: string;
  readColor?: string;
  size?: number;
  style?: StyleProp<TextStyle>;
  serverReceivedAt?: number | null;
  messageServerReceivedAt?: number | null;
  readWatermark?: number | null;
  otherUserReadWatermark?: number | null;
  deliveredWatermark?: number | null;
  otherUserDeliveredWatermark?: number | null;
  accessibilityLabel?: string;
}

function normalizeStatus(rawStatus?: MessageStatusIconProps["status"]): ResolvedStatus | null {
  switch (rawStatus) {
    case "sending":
    case "sent":
    case "delivered":
    case "read":
    case "failed":
      return rawStatus;
    case "pending":
      return "sending";
    case "error":
      return "failed";
    default:
      return null;
  }
}

function resolveStatus(props: MessageStatusIconProps): ResolvedStatus | null {
  const explicit = normalizeStatus(props.status);
  if (explicit) return explicit;

  const timestamp =
    props.messageServerReceivedAt ?? props.serverReceivedAt ?? null;
  if (!timestamp) return null;

  const readWatermark =
    props.otherUserReadWatermark ?? props.readWatermark ?? null;
  if (readWatermark !== null && timestamp <= readWatermark) {
    return "read";
  }

  const deliveredWatermark =
    props.otherUserDeliveredWatermark ?? props.deliveredWatermark ?? null;
  if (deliveredWatermark !== null && timestamp <= deliveredWatermark) {
    return "delivered";
  }

  return "sent";
}

export const MessageStatusIcon = memo(function MessageStatusIcon({
  color = "#8E8E93",
  readColor,
  size = 14,
  style,
  accessibilityLabel,
  ...statusProps
}: MessageStatusIconProps) {
  const status = resolveStatus(statusProps);
  if (!status) return null;

  let name: keyof typeof MaterialCommunityIcons.glyphMap = "check";
  let iconColor = color;

  switch (status) {
    case "sending":
      name = "clock-time-three-outline";
      break;
    case "failed":
      name = "alert-circle-outline";
      break;
    case "delivered":
      name = "check-all";
      break;
    case "read":
      name = "check-all";
      iconColor = readColor ?? color;
      break;
    case "sent":
    default:
      name = "check";
      break;
  }

  return (
    <MaterialCommunityIcons
      name={name}
      size={size}
      color={iconColor}
      style={style}
      accessibilityLabel={
        accessibilityLabel ?? `Message status: ${status}`
      }
    />
  );
});

export default MessageStatusIcon;
