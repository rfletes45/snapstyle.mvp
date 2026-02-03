/**
 * Avatar Component - Displays user avatar with equipped cosmetics
 *
 * Supports both legacy (circle + emoji) and digital (SVG-based) avatars.
 * Automatically detects config type and renders appropriately.
 *
 * For avatar with profile frames, use AvatarWithFrame component instead.
 *
 * @see src/components/AvatarWithFrame.tsx
 * @see src/components/avatar/DigitalAvatar.tsx
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md
 */

import { getItemById } from "@/data/cosmetics";
import type { DigitalAvatarConfig } from "@/types/avatar";
import { isDigitalAvatarConfig } from "@/types/avatar";
import type { AvatarConfig } from "@/types/models";
import type { ExtendedAvatarConfig } from "@/types/profile";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AVATAR_FEATURES } from "../../constants/featureFlags";

// Feature flag for digital avatar system
// Controlled via constants/featureFlags.ts
const DIGITAL_AVATAR_ENABLED = AVATAR_FEATURES.DIGITAL_AVATAR_ENABLED;

// Lazy import for DigitalAvatar to avoid loading until needed
let DigitalAvatarComponent: React.ComponentType<{
  config: DigitalAvatarConfig;
  size?: number;
  showBody?: boolean;
}> | null = null;

// Dynamic import wrapper
async function loadDigitalAvatar(): Promise<void> {
  if (!DigitalAvatarComponent) {
    try {
      const module = await import("./avatar/DigitalAvatar");
      DigitalAvatarComponent = module.DigitalAvatar;
    } catch (error) {
      console.warn("Failed to load DigitalAvatar component:", error);
    }
  }
}

// Preload digital avatar if enabled
if (DIGITAL_AVATAR_ENABLED) {
  loadDigitalAvatar();
}

interface AvatarProps {
  /** Avatar configuration (basic, extended, or digital) */
  config: AvatarConfig | ExtendedAvatarConfig | DigitalAvatarConfig;
  /** Avatar size in pixels */
  size?: number;
  /** Show border around avatar */
  showBorder?: boolean;
  /** Show full body (only for digital avatars) */
  showBody?: boolean;
}

// Background gradient colors for special backgrounds
const BACKGROUND_STYLES: Record<string, { colors: string[]; type: string }> = {
  gradient: {
    colors: ["#667eea", "#764ba2"],
    type: "gradient",
  },
  rainbow: {
    colors: ["#ff0000", "#ff7f00", "#ffff00", "#00ff00", "#0000ff", "#8b00ff"],
    type: "rainbow",
  },
};

// Main Avatar component
function AvatarBase({
  config,
  size = 80,
  showBorder = true,
  showBody = false,
}: AvatarProps) {
  // Check if this is a digital avatar config
  if (DIGITAL_AVATAR_ENABLED && isDigitalAvatarConfig(config)) {
    // If DigitalAvatar component is loaded, use it
    if (DigitalAvatarComponent) {
      return (
        <DigitalAvatarComponent
          config={config}
          size={size}
          showBody={showBody}
        />
      );
    }
    // Fall back to legacy rendering with converted display
    // (This shouldn't happen often as component loads quickly)
  }

  // Legacy avatar rendering
  const legacyConfig = config as AvatarConfig;
  const { baseColor, hat, glasses, background } = legacyConfig;

  // Get background style
  const bgItem = background ? getItemById(background) : null;
  const bgStyle = bgItem?.imagePath
    ? BACKGROUND_STYLES[bgItem.imagePath]
    : null;

  // Get hat and glasses emoji
  const hatItem = hat ? getItemById(hat) : null;
  const glassesItem = glasses ? getItemById(glasses) : null;

  const hatEmoji = hatItem?.imagePath || "";
  const glassesEmoji = glassesItem?.imagePath || "";

  // Calculate sizes based on avatar size
  const iconSize = size * 0.7;
  const hatSize = size * 0.4;
  const glassesSize = size * 0.35;
  const borderWidth = showBorder ? 3 : 0;

  // Determine background color/style
  const getBackgroundColor = () => {
    if (bgStyle?.type === "gradient") {
      // For gradient, we'll use a simple approximation with the first color
      // In a real app, you'd use LinearGradient from expo-linear-gradient
      return bgStyle.colors[0];
    }
    if (bgStyle?.type === "rainbow") {
      // Rainbow effect - use first color
      return bgStyle.colors[0];
    }
    return baseColor;
  };

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: getBackgroundColor(),
          borderWidth,
          borderColor: bgStyle ? "#fff" : "transparent",
        },
      ]}
    >
      {/* Rainbow ring effect for rainbow background */}
      {bgStyle?.type === "rainbow" && (
        <View
          style={[
            styles.rainbowRing,
            {
              width: size - 4,
              height: size - 4,
              borderRadius: (size - 4) / 2,
              borderWidth: 3,
              borderColor: "#ff7f00",
            },
          ]}
        />
      )}

      {/* Base avatar icon */}
      <MaterialCommunityIcons
        name="account-circle"
        size={iconSize}
        color="#fff"
        style={styles.baseIcon}
      />

      {/* Hat overlay (top) */}
      {hatEmoji ? (
        <View style={[styles.hatContainer, { top: -hatSize * 0.3 }]}>
          <Text style={[styles.emoji, { fontSize: hatSize }]}>{hatEmoji}</Text>
        </View>
      ) : null}

      {/* Glasses overlay (center) */}
      {glassesEmoji ? (
        <View style={styles.glassesContainer}>
          <Text style={[styles.emoji, { fontSize: glassesSize }]}>
            {glassesEmoji}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// Memoized Avatar export
const Avatar = memo(AvatarBase);
export default Avatar;

// Mini avatar for lists - Also memoized
export const AvatarMini = memo(function AvatarMini({
  config,
  size = 40,
}: {
  config: AvatarConfig | ExtendedAvatarConfig | DigitalAvatarConfig;
  size?: number;
}) {
  return <AvatarBase config={config} size={size} showBorder={false} />;
});

// Large avatar for profile - includes body if digital avatar
export const AvatarLarge = memo(function AvatarLarge({
  config,
  size = 120,
  showBody = false,
}: {
  config: AvatarConfig | ExtendedAvatarConfig | DigitalAvatarConfig;
  size?: number;
  showBody?: boolean;
}) {
  return (
    <AvatarBase
      config={config}
      size={size}
      showBorder={true}
      showBody={showBody}
    />
  );
});

// Export feature flag state for checking
export function isDigitalAvatarEnabled(): boolean {
  return DIGITAL_AVATAR_ENABLED;
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
    overflow: "visible",
    position: "relative",
  },
  baseIcon: {
    position: "absolute",
  },
  hatContainer: {
    position: "absolute",
    zIndex: 10,
  },
  glassesContainer: {
    position: "absolute",
    zIndex: 5,
    top: "25%",
  },
  emoji: {
    textAlign: "center",
  },
  rainbowRing: {
    position: "absolute",
  },
});
