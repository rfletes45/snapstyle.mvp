/**
 * Avatar - Simple avatar component
 * Displays a colored circle based on the user's avatar configuration
 */

import React, { JSX } from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { AvatarConfig } from "../types/models";

interface AvatarProps {
  /** Avatar configuration */
  config: AvatarConfig;
  /** Size of the avatar */
  size?: number;
  /** Additional styles */
  style?: ViewStyle;
}

export default function Avatar({
  config,
  size = 48,
  style,
}: AvatarProps): JSX.Element {
  const { baseColor } = config;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: baseColor || "#6B7280",
        },
        style,
      ]}
    >
      {/* Simple emoji placeholder */}
      <Text style={{ fontSize: size * 0.4 }}>😊</Text>
    </View>
  );
}

/**
 * AvatarMini - Mini version of Avatar for lists and compact displays
 * Same as Avatar but provided as a named export for compatibility
 */
export function AvatarMini({
  config,
  size = 32,
  style,
}: AvatarProps): JSX.Element {
  return <Avatar config={config} size={size} style={style} />;
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
});
