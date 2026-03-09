/**
 * Games V4 — UserAvatar
 *
 * Reusable avatar component for game screens.
 * Renders a user's profile picture with a styled initials fallback.
 *
 * Priority:
 * 1. profilePictureUrl → circular Image
 * 2. displayName → colored initials circle
 * 3. Generic fallback → MaterialCommunityIcons "account"
 *
 * @module gamesV4/components/UserAvatar
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

// Deterministic color from a string (uid or displayName).
const AVATAR_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#FFEAA7",
  "#DDA0DD",
  "#FF8C42",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#82E0AA",
  "#F1948A",
  "#85C1E9",
  "#F0B27A",
  "#A3E4D7",
  "#D7BDE2",
];

function hashStringToIndex(str: string, mod: number): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % mod;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────────

export interface UserAvatarProps {
  /** Profile picture URL (takes priority when available & loadable). */
  profilePictureUrl?: string | null;
  /** Display name — used for initials fallback + color seed. */
  displayName?: string;
  /** Unique user ID — used as color seed when displayName is absent. */
  uid?: string;
  /** Diameter in logical pixels. Default 32. */
  size?: number;
  /** Override fallback icon (MaterialCommunityIcons name). Default "account". */
  fallbackIcon?: string;
}

export default function UserAvatar({
  profilePictureUrl,
  displayName,
  uid,
  size = 32,
  fallbackIcon = "account",
}: UserAvatarProps): React.JSX.Element {
  const [imgFailed, setImgFailed] = useState(false);

  const hasUrl = !!profilePictureUrl && !imgFailed;

  // Color seed: prefer uid for determinism, fallback to displayName.
  const seed = uid ?? displayName ?? "?";
  const bgColor = AVATAR_COLORS[hashStringToIndex(seed, AVATAR_COLORS.length)];
  const initials = displayName ? getInitials(displayName) : null;

  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  if (hasUrl) {
    return (
      <Image
        source={{ uri: profilePictureUrl! }}
        style={[styles.image, containerStyle]}
        onError={() => setImgFailed(true)}
      />
    );
  }

  // Initials fallback
  if (initials) {
    return (
      <View
        style={[styles.fallback, containerStyle, { backgroundColor: bgColor }]}
      >
        <Text
          style={[
            styles.initialsText,
            { fontSize: size * 0.4, lineHeight: size * 0.48 },
          ]}
          numberOfLines={1}
        >
          {initials}
        </Text>
      </View>
    );
  }

  // Generic icon fallback
  return (
    <View
      style={[styles.fallback, containerStyle, { backgroundColor: bgColor }]}
    >
      <MaterialCommunityIcons
        name={fallbackIcon as keyof typeof MaterialCommunityIcons.glyphMap}
        size={size * 0.55}
        color="#FFF"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: "#DDD",
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  initialsText: {
    color: "#FFF",
    fontWeight: "700",
    textAlign: "center",
  },
});
