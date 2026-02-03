/**
 * ChatBubblePreview Component
 *
 * Displays a preview of a chat bubble style showing its colors,
 * gradients, and effects. Used in the customization modal.
 */

import { isBubbleGradient } from "@/data/chatBubbles";
import type { ChatBubbleStyle } from "@/types/profile";
import { RARITY_COLORS } from "@/types/profile";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { memo, useEffect, useRef } from "react";
import { Animated, StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

export interface ChatBubblePreviewProps {
  /** Bubble style to preview */
  style: ChatBubbleStyle;
  /** Whether this style is currently selected */
  selected?: boolean;
  /** Whether user owns this style */
  owned?: boolean;
  /** Whether this style is equipped */
  equipped?: boolean;
  /** Handler for press */
  onPress?: () => void;
  /** Show as a message preview */
  showMessage?: boolean;
  /** Sample message text */
  messageText?: string;
  /** Compact mode for grids */
  compact?: boolean;
}

function ChatBubblePreviewBase({
  style,
  selected = false,
  owned = true,
  equipped = false,
  onPress,
  showMessage = true,
  messageText = "Hello! 👋",
  compact = false,
}: ChatBubblePreviewProps) {
  const paperTheme = useTheme();
  const rarityColor = RARITY_COLORS[style.rarity];

  // Animation for effects
  const glowAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  // Start effect animations
  useEffect(() => {
    if (!style.effect || style.effect === "none") return;

    const speed = style.effectSpeed || 2;
    const duration = 1000 / speed;

    switch (style.effect) {
      case "glow":
        Animated.loop(
          Animated.sequence([
            Animated.timing(glowAnim, {
              toValue: 1,
              duration: duration,
              useNativeDriver: false,
            }),
            Animated.timing(glowAnim, {
              toValue: 0,
              duration: duration,
              useNativeDriver: false,
            }),
          ]),
        ).start();
        break;

      case "pulse":
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.05,
              duration: duration,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: duration,
              useNativeDriver: true,
            }),
          ]),
        ).start();
        break;

      case "shimmer":
        Animated.loop(
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: duration * 2,
            useNativeDriver: true,
          }),
        ).start();
        break;
    }

    return () => {
      glowAnim.stopAnimation();
      pulseAnim.stopAnimation();
      shimmerAnim.stopAnimation();
    };
  }, [style.effect, style.effectSpeed]);

  // Get background colors for gradient
  const getBackgroundColors = (): readonly [string, string, ...string[]] => {
    if (isBubbleGradient(style.background)) {
      const colors = style.background.colors;
      // Ensure at least 2 colors for LinearGradient
      if (colors.length >= 2) {
        return colors as unknown as readonly [string, string, ...string[]];
      }
      return [colors[0] || "#333333", "#333333"];
    }
    return [style.background, style.background];
  };

  // Get gradient start/end points based on angle
  const getGradientPoints = (): {
    start: { x: number; y: number };
    end: { x: number; y: number };
  } => {
    if (isBubbleGradient(style.background)) {
      const angle = style.background.angle || 90;
      const radians = (angle * Math.PI) / 180;
      return {
        start: {
          x: 0.5 - Math.cos(radians) * 0.5,
          y: 0.5 - Math.sin(radians) * 0.5,
        },
        end: {
          x: 0.5 + Math.cos(radians) * 0.5,
          y: 0.5 + Math.sin(radians) * 0.5,
        },
      };
    }
    return { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } };
  };

  const gradientPoints = getGradientPoints();

  // Glow effect interpolation
  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  const renderBubble = () => (
    <Animated.View
      style={[
        styles.bubbleWrapper,
        style.effect === "pulse" && { transform: [{ scale: pulseAnim }] },
      ]}
    >
      {/* Glow effect layer */}
      {style.effect === "glow" && style.effectColor && (
        <Animated.View
          style={[
            styles.glowLayer,
            {
              backgroundColor: style.effectColor,
              opacity: glowOpacity,
              borderRadius: style.borderRadius || 18,
            },
          ]}
        />
      )}

      {/* Main bubble */}
      <LinearGradient
        colors={getBackgroundColors()}
        start={gradientPoints.start}
        end={gradientPoints.end}
        style={[
          styles.bubble,
          {
            borderRadius: style.borderRadius || 18,
            borderWidth: style.borderWidth || 0,
            borderColor: style.borderColor || "transparent",
          },
        ]}
      >
        {showMessage && (
          <Text
            style={[
              styles.messageText,
              { color: style.textColor || "#FFFFFF" },
            ]}
          >
            {messageText}
          </Text>
        )}

        {/* Shimmer overlay */}
        {style.effect === "shimmer" && (
          <Animated.View
            style={[
              styles.shimmerOverlay,
              {
                transform: [
                  {
                    translateX: shimmerAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-100, 100],
                    }),
                  },
                ],
              },
            ]}
          />
        )}
      </LinearGradient>
    </Animated.View>
  );

  const renderCompact = () => (
    <TouchableOpacity
      style={[
        styles.compactContainer,
        {
          borderColor: selected ? paperTheme.colors.primary : "transparent",
          opacity: owned ? 1 : 0.5,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <LinearGradient
        colors={getBackgroundColors()}
        start={gradientPoints.start}
        end={gradientPoints.end}
        style={[
          styles.compactBubble,
          {
            borderRadius: (style.borderRadius || 18) / 2,
            borderWidth: style.borderWidth ? 1 : 0,
            borderColor: style.borderColor || "transparent",
          },
        ]}
      >
        {/* Effect indicator */}
        {style.effect && style.effect !== "none" && (
          <View style={styles.effectIndicator}>
            <MaterialCommunityIcons
              name={
                style.effect === "glow"
                  ? "brightness-7"
                  : style.effect === "shimmer"
                    ? "shimmer"
                    : style.effect === "pulse"
                      ? "heart-pulse"
                      : "gradient-horizontal"
              }
              size={12}
              color={style.textColor || "#FFFFFF"}
            />
          </View>
        )}
      </LinearGradient>

      {/* Rarity dot */}
      <View style={[styles.rarityDot, { backgroundColor: rarityColor }]} />

      {/* Lock overlay */}
      {!owned && (
        <View style={styles.compactLockOverlay}>
          <MaterialCommunityIcons name="lock" size={14} color="#FFFFFF" />
        </View>
      )}

      {/* Equipped indicator */}
      {equipped && (
        <View
          style={[
            styles.compactEquippedBadge,
            { backgroundColor: paperTheme.colors.primary },
          ]}
        >
          <MaterialCommunityIcons name="check" size={8} color="#FFFFFF" />
        </View>
      )}
    </TouchableOpacity>
  );

  const renderFull = () => (
    <TouchableOpacity
      style={[
        styles.container,
        {
          borderColor: selected
            ? paperTheme.colors.primary
            : paperTheme.colors.outline,
          opacity: owned ? 1 : 0.6,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      {/* Preview Area */}
      <View style={styles.previewArea}>
        {renderBubble()}

        {/* Rarity badge */}
        <View style={[styles.rarityBadge, { backgroundColor: rarityColor }]}>
          <Text style={styles.rarityText}>
            {style.rarity.charAt(0).toUpperCase()}
          </Text>
        </View>

        {/* Lock overlay */}
        {!owned && (
          <View style={styles.lockOverlay}>
            <MaterialCommunityIcons name="lock" size={20} color="#FFFFFF" />
            {style.unlock.priceTokens && (
              <Text style={styles.priceText}>
                {style.unlock.priceTokens} 🪙
              </Text>
            )}
          </View>
        )}

        {/* Equipped badge */}
        {equipped && (
          <View
            style={[
              styles.equippedBadge,
              { backgroundColor: paperTheme.colors.primary },
            ]}
          >
            <MaterialCommunityIcons name="check" size={12} color="#FFFFFF" />
          </View>
        )}

        {/* Effect indicator */}
        {style.effect && style.effect !== "none" && (
          <View
            style={[
              styles.effectBadge,
              { backgroundColor: paperTheme.colors.secondary },
            ]}
          >
            <MaterialCommunityIcons
              name={
                style.effect === "glow"
                  ? "brightness-7"
                  : style.effect === "shimmer"
                    ? "shimmer"
                    : style.effect === "pulse"
                      ? "heart-pulse"
                      : "gradient-horizontal"
              }
              size={10}
              color="#FFFFFF"
            />
          </View>
        )}
      </View>

      {/* Style Info */}
      <View style={styles.infoArea}>
        <Text
          style={[styles.styleName, { color: paperTheme.colors.onSurface }]}
          numberOfLines={1}
        >
          {style.name}
        </Text>
        {style.description && (
          <Text
            style={[
              styles.styleDesc,
              { color: paperTheme.colors.onSurfaceVariant },
            ]}
            numberOfLines={1}
          >
            {style.description}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return compact ? renderCompact() : renderFull();
}

const styles = StyleSheet.create({
  // Full preview styles
  container: {
    width: 140,
    borderRadius: 12,
    borderWidth: 2,
    overflow: "hidden",
    backgroundColor: "#F5F5F5",
  },
  previewArea: {
    height: 70,
    justifyContent: "center",
    alignItems: "center",
    padding: 8,
    position: "relative",
  },
  bubbleWrapper: {
    position: "relative",
  },
  glowLayer: {
    position: "absolute",
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 80,
    alignItems: "center",
    overflow: "hidden",
  },
  messageText: {
    fontSize: 13,
    fontWeight: "500",
  },
  shimmerOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 40,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    transform: [{ skewX: "-20deg" }],
  },
  rarityBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  rarityText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  priceText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  equippedBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  effectBadge: {
    position: "absolute",
    top: 4,
    left: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  infoArea: {
    padding: 8,
    backgroundColor: "#FFFFFF",
  },
  styleName: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 2,
  },
  styleDesc: {
    fontSize: 10,
  },

  // Compact preview styles
  compactContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    overflow: "hidden",
    position: "relative",
  },
  compactBubble: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  effectIndicator: {
    opacity: 0.8,
  },
  rarityDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  compactLockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  compactEquippedBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
  },
});

export const ChatBubblePreview = memo(ChatBubblePreviewBase);
export default ChatBubblePreview;
