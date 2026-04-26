/**
 * Shared game icon renderer.
 *
 * Uses the canonical thumbnail from GAME_METADATA when present, then falls
 * back to the metadata icon for games that do not have a designated image yet.
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo } from "react";
import {
  Image,
  StyleSheet,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { GAME_METADATA, type GameMetadata } from "@/gamesV4/constants";
import type { GameId } from "@/gamesV4/types";

interface GameIconProps {
  gameId?: GameId;
  metadata?: GameMetadata | null;
  size?: number;
  borderRadius?: number;
  backgroundColor?: string;
  fallbackColor?: string;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
}

function GameIconBase({
  gameId,
  metadata,
  size = 40,
  borderRadius = 10,
  backgroundColor = "transparent",
  fallbackColor = "#666",
  style,
  imageStyle,
}: GameIconProps) {
  const meta = metadata ?? (gameId ? GAME_METADATA[gameId] : null);
  const iconName = (meta?.icon ??
    "gamepad-variant") as keyof typeof MaterialCommunityIcons.glyphMap;

  return (
    <View
      style={[
        styles.root,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor,
        },
        style,
      ]}
    >
      {meta?.thumbnail ? (
        <Image
          source={meta.thumbnail}
          resizeMode="cover"
          style={[styles.image, imageStyle]}
        />
      ) : (
        <MaterialCommunityIcons
          name={iconName}
          size={Math.round(size * 0.6)}
          color={fallbackColor}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});

export const GameIcon = memo(GameIconBase);

