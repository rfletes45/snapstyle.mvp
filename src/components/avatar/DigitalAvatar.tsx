/**
 * Digital Avatar Component
 *
 * Main public-facing component for rendering digital avatars.
 * Handles configuration normalization, legacy conversion, and provides
 * a clean API for avatar rendering.
 */

import type { DigitalAvatarConfig, LegacyAvatarConfig } from "@/types/avatar";
import {
  getDefaultAvatarConfig,
  normalizeAvatarConfig,
} from "@/utils/avatarHelpers";
import { isValidAvatarConfig } from "@/utils/avatarValidation";
import React, { memo, useCallback, useMemo } from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { AvatarSvgRenderer } from "./AvatarSvgRenderer";

interface DigitalAvatarProps {
  /** Avatar configuration (digital or legacy) */
  config?: DigitalAvatarConfig | LegacyAvatarConfig | null;
  /** Size in pixels */
  size?: number;
  /** Show full body or head only */
  showBody?: boolean;
  /** Enable animations (idle, blink, etc.) */
  animated?: boolean;
  /** Background color */
  backgroundColor?: string;
  /** Press handler */
  onPress?: () => void;
  /** Long press handler */
  onLongPress?: () => void;
  /** Custom container style */
  style?: StyleProp<ViewStyle>;
  /** Test ID for testing */
  testID?: string;
}

/**
 * Digital Avatar Component
 *
 * Renders a customizable digital avatar with support for:
 * - Legacy configuration conversion
 * - Head-only and full-body modes
 * - Interactive (pressable) mode
 * - Animations (Phase 2)
 *
 * @example
 * ```tsx
 * // Basic usage
 * <DigitalAvatar config={user.digitalAvatar} size={48} />
 *
 * // With interaction
 * <DigitalAvatar
 *   config={user.digitalAvatar}
 *   size={80}
 *   onPress={() => navigation.navigate("AvatarCustomizer")}
 * />
 *
 * // Full body
 * <DigitalAvatar config={user.digitalAvatar} size={200} showBody />
 * ```
 */
function DigitalAvatarBase({
  config,
  size = 48,
  showBody = false,
  animated = false,
  backgroundColor = "transparent",
  onPress,
  onLongPress,
  style,
  testID,
}: DigitalAvatarProps) {
  // Normalize config (handles legacy conversion and defaults)
  const normalizedConfig = useMemo(() => {
    if (!config) {
      return getDefaultAvatarConfig();
    }
    return normalizeAvatarConfig(config);
  }, [config]);

  // Validate config
  const isValid = useMemo(
    () => isValidAvatarConfig(normalizedConfig),
    [normalizedConfig],
  );

  // If config is invalid, use defaults
  const finalConfig = useMemo(() => {
    if (!isValid) {
      console.warn("DigitalAvatar: Invalid config, using defaults");
      return getDefaultAvatarConfig();
    }
    return normalizedConfig;
  }, [normalizedConfig, isValid]);

  // Render the avatar SVG
  const renderAvatar = useCallback(
    () => (
      <AvatarSvgRenderer
        config={finalConfig}
        size={size}
        showBody={showBody}
        animated={animated}
        backgroundColor={backgroundColor}
      />
    ),
    [finalConfig, size, showBody, animated, backgroundColor],
  );

  // Wrap in Pressable if interactive
  if (onPress || onLongPress) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        style={({ pressed }) => [
          styles.container,
          style,
          pressed && styles.pressed,
        ]}
        testID={testID}
        accessible
        accessibilityRole="button"
        accessibilityLabel="Avatar"
      >
        {renderAvatar()}
      </Pressable>
    );
  }

  return (
    <View style={[styles.container, style]} testID={testID}>
      {renderAvatar()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  circularContainer: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  previewContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
  },
});

export const DigitalAvatar = memo(DigitalAvatarBase);

/**
 * Avatar with circular background
 * Useful for profile pictures and list items
 */
interface CircularAvatarProps extends DigitalAvatarProps {
  /** Border width */
  borderWidth?: number;
  /** Border color */
  borderColor?: string;
}

function CircularAvatarBase({
  size = 48,
  borderWidth = 0,
  borderColor = "#E5E7EB",
  style,
  ...props
}: CircularAvatarProps) {
  const containerSize = size + borderWidth * 2;

  return (
    <View
      style={[
        styles.circularContainer,
        {
          width: containerSize,
          height: containerSize,
          borderRadius: containerSize / 2,
          borderWidth,
          borderColor,
        },
        style,
      ]}
    >
      <DigitalAvatar {...props} size={size} backgroundColor="transparent" />
    </View>
  );
}

export const CircularAvatar = memo(CircularAvatarBase);

/**
 * Compact avatar for small sizes (e.g., message reactions, mentions)
 * Uses head-only mode with optimized rendering
 */
interface CompactAvatarProps {
  config?: DigitalAvatarConfig | LegacyAvatarConfig | null;
  size?: number;
  onPress?: () => void;
  testID?: string;
}

function CompactAvatarBase({
  config,
  size = 24,
  onPress,
  testID,
}: CompactAvatarProps) {
  return (
    <DigitalAvatar
      config={config}
      size={size}
      showBody={false}
      animated={false}
      onPress={onPress}
      testID={testID}
    />
  );
}

export const CompactAvatar = memo(CompactAvatarBase);

/**
 * Avatar preview for customizer screens
 * Shows larger avatar with optional background
 */
interface AvatarPreviewProps {
  config?: DigitalAvatarConfig | LegacyAvatarConfig | null;
  size?: number;
  showBody?: boolean;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
}

function AvatarPreviewBase({
  config,
  size = 200,
  showBody = true,
  backgroundColor = "#F8FAFC",
  style,
}: AvatarPreviewProps) {
  return (
    <View style={[styles.previewContainer, style]}>
      <DigitalAvatar
        config={config}
        size={size}
        showBody={showBody}
        animated={true}
        backgroundColor={backgroundColor}
      />
    </View>
  );
}

export const AvatarPreview = memo(AvatarPreviewBase);
