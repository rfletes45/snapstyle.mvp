/**
 * AvatarWithFrame Component
 *
 * Wraps the base Avatar component with an optional profile frame.
 * Handles frame effects like glow, border, and particles.
 *
 * @see docs/PROFILE_SCREEN_OVERHAUL_PLAN.md
 * @see src/types/profile.ts for ProfileFrame type
 */

import Avatar from "@/components/Avatar";
import { getFrameById } from "@/data/extendedCosmetics";
import type { AvatarConfig } from "@/types/models";
import type {
  ExtendedAvatarConfig,
  GradientConfig,
  ProfileFrame,
} from "@/types/profile";
import React, { memo, useMemo } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";

export interface AvatarWithFrameProps {
  /** Avatar configuration (basic or extended) */
  config: AvatarConfig | ExtendedAvatarConfig;
  /** Avatar size in pixels */
  size?: number;
  /** Frame to display (optional - overrides config.profileFrame) */
  frame?: ProfileFrame | string | null;
  /** Whether to show frame effects (glow, particles) */
  showEffects?: boolean;
  /** Press handler */
  onPress?: () => void;
  /** Additional container style */
  style?: ViewStyle;
}

/**
 * Get gradient style from GradientConfig
 * Note: For true gradients, use expo-linear-gradient
 * This returns the first color as a fallback
 */
function getGradientColor(gradient: GradientConfig): string {
  return gradient.colors[0] || "#000";
}

/**
 * Parse border color which can be string or GradientConfig
 */
function getBorderColor(color: string | GradientConfig): string {
  if (typeof color === "string") {
    return color;
  }
  return getGradientColor(color);
}

function AvatarWithFrameBase({
  config,
  size = 80,
  frame,
  showEffects = true,
  onPress,
  style,
}: AvatarWithFrameProps) {
  // Resolve frame from prop or config
  const resolvedFrame = useMemo<ProfileFrame | null>(() => {
    if (frame === null) return null;

    if (typeof frame === "string") {
      return getFrameById(frame) || null;
    }

    if (frame) return frame;

    // Check if config has profileFrame
    if ("profileFrame" in config && config.profileFrame) {
      return getFrameById(config.profileFrame) || null;
    }

    return null;
  }, [frame, config]);

  // Calculate frame dimensions
  const frameSize = size + (resolvedFrame?.effects?.border?.width || 0) * 2 + 8;
  const glowSize = frameSize + 16;

  // Frame border styles
  const frameBorderStyle = useMemo<ViewStyle>(() => {
    if (!resolvedFrame?.effects?.border) return {};

    const { border } = resolvedFrame.effects;
    return {
      borderWidth: border.width,
      borderColor: getBorderColor(border.color),
      borderStyle:
        border.style === "dashed"
          ? "dashed"
          : border.style === "dotted"
            ? "dotted"
            : "solid",
    };
  }, [resolvedFrame]);

  // Glow styles
  const glowStyle = useMemo<ViewStyle>(() => {
    if (!resolvedFrame?.effects?.glow || !showEffects) return {};

    const { glow } = resolvedFrame.effects;
    return {
      shadowColor: glow.color,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: glow.intensity,
      shadowRadius: 12,
      elevation: 8,
    };
  }, [resolvedFrame, showEffects]);

  // No frame - render basic avatar
  if (!resolvedFrame || resolvedFrame.id === "frame_none") {
    return (
      <View style={[styles.container, style]}>
        <Avatar config={config as AvatarConfig} size={size} />
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {/* Glow layer */}
      {resolvedFrame.effects?.glow && showEffects && (
        <View
          style={[
            styles.glowLayer,
            {
              width: glowSize,
              height: glowSize,
              borderRadius: glowSize / 2,
              backgroundColor: resolvedFrame.effects.glow.color + "20",
            },
            glowStyle,
          ]}
        />
      )}

      {/* Frame border layer */}
      <View
        style={[
          styles.frameLayer,
          {
            width: frameSize,
            height: frameSize,
            borderRadius: frameSize / 2,
          },
          frameBorderStyle,
          glowStyle,
        ]}
      >
        {/* Inner avatar */}
        <Avatar
          config={config as AvatarConfig}
          size={size}
          showBorder={false}
        />
      </View>

      {/* Particle effects would go here (requires animation library) */}
      {/* For now, we just show static effects */}
      {resolvedFrame.effects?.particles && showEffects && (
        <View style={styles.particleContainer}>
          {/* Placeholder for particle effects */}
          {/* In production, use react-native-reanimated or similar */}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  glowLayer: {
    position: "absolute",
  },
  frameLayer: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  particleContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: "none",
  },
});

export const AvatarWithFrame = memo(AvatarWithFrameBase);
export default AvatarWithFrame;
