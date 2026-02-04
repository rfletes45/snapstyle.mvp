/**
 * Charge Indicator Component (Phase 4)
 * Shows launcher charge level with visual feedback
 */

import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

// ============================================
// Props Interface
// ============================================

interface ChargeIndicatorProps {
  chargeLevel: number; // 0-1
  isCharging: boolean;
  visible?: boolean;
  position?: { x: number; y: number }; // Screen position
  width?: number;
  height?: number;
  showPercentage?: boolean;
  colors?: {
    background?: string;
    fill?: string;
    fullCharge?: string;
    border?: string;
  };
}

// ============================================
// Default Colors
// ============================================

const DEFAULT_COLORS = {
  background: "rgba(0, 0, 0, 0.4)",
  fill: "rgba(255, 165, 0, 0.8)", // Orange
  fullCharge: "rgba(255, 50, 50, 0.9)", // Red when full
  border: "rgba(255, 255, 255, 0.4)",
};

// ============================================
// Component
// ============================================

export const ChargeIndicator: React.FC<ChargeIndicatorProps> = ({
  chargeLevel,
  isCharging,
  visible = true,
  position,
  width = 100,
  height = 12,
  showPercentage = true,
  colors = DEFAULT_COLORS,
}) => {
  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Pulse animation when fully charged
  useEffect(() => {
    if (chargeLevel >= 1) {
      // Full charge - pulse urgently
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 150,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 150,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();

      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [chargeLevel, pulseAnim]);

  // Glow animation when charging
  useEffect(() => {
    if (isCharging) {
      Animated.timing(glowAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(glowAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [isCharging, glowAnim]);

  if (!visible || !isCharging) {
    return null;
  }

  // Calculate fill color based on charge level
  const fillColor =
    chargeLevel >= 1
      ? colors.fullCharge || DEFAULT_COLORS.fullCharge
      : colors.fill || DEFAULT_COLORS.fill;

  // Glow effect
  const shadowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  const containerStyle = position
    ? {
        position: "absolute" as const,
        left: position.x - width / 2,
        top: position.y,
      }
    : {};

  return (
    <Animated.View
      style={[
        styles.container,
        containerStyle,
        {
          transform: [{ scale: pulseAnim }],
          shadowOpacity,
        },
      ]}
    >
      {/* Background track */}
      <View
        style={[
          styles.track,
          {
            width,
            height,
            backgroundColor: colors.background || DEFAULT_COLORS.background,
            borderColor: colors.border || DEFAULT_COLORS.border,
          },
        ]}
      >
        {/* Fill bar */}
        <Animated.View
          style={[
            styles.fill,
            {
              width: `${Math.min(chargeLevel * 100, 100)}%`,
              backgroundColor: fillColor,
            },
          ]}
        />

        {/* Charge segments */}
        <View style={styles.segmentsContainer}>
          {[0.25, 0.5, 0.75].map((segment) => (
            <View
              key={segment}
              style={[styles.segment, { left: `${segment * 100}%` }]}
            />
          ))}
        </View>
      </View>

      {/* Percentage label */}
      {showPercentage && (
        <Text style={styles.percentage}>{Math.round(chargeLevel * 100)}%</Text>
      )}

      {/* Ready indicator when full */}
      {chargeLevel >= 1 && <Text style={styles.readyText}>RELEASE!</Text>}
    </Animated.View>
  );
};

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    shadowColor: "#ff6600",
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
    elevation: 5,
  },
  track: {
    borderRadius: 6,
    borderWidth: 1,
    overflow: "hidden",
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 5,
  },
  segmentsContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  segment: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  percentage: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: "bold",
    color: "rgba(255, 255, 255, 0.8)",
  },
  readyText: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "bold",
    color: "#ff4444",
    textShadowColor: "rgba(255, 0, 0, 0.5)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
});

export default ChargeIndicator;
