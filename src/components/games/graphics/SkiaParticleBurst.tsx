/**
 * SkiaParticleBurst — Skia particle explosion effect
 *
 * Renders a burst of particles emanating from a center point.
 * Used for capture effects, merge celebrations, mine explosions, etc.
 */

import {
  Canvas,
  Circle,
  Group,
  RadialGradient,
  vec,
} from "@shopify/react-native-skia";
import React, { useEffect, useMemo } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

interface SkiaParticleBurstProps {
  /** Center X position */
  x: number;
  /** Center Y position */
  y: number;
  /** Burst radius (how far particles travel) */
  radius?: number;
  /** Number of particles */
  count?: number;
  /** Particle colors */
  colors?: string[];
  /** Duration in ms */
  duration?: number;
  /** Size of the canvas */
  size?: number;
  /** Whether the burst is active */
  active: boolean;
}

interface Particle {
  angle: number;
  distance: number;
  size: number;
  color: string;
}

export function SkiaParticleBurst({
  x,
  y,
  radius = 40,
  count = 12,
  colors = ["#FFD700", "#FF6B6B", "#4ECDC4", "#A29BFE", "#FF8E8E"],
  duration = 600,
  size = 120,
  active,
}: SkiaParticleBurstProps) {
  const progress = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (active) {
      progress.value = 0;
      opacity.value = 1;
      progress.value = withTiming(1, {
        duration,
        easing: Easing.out(Easing.cubic),
      });
      opacity.value = withTiming(0, {
        duration: duration * 0.8,
        easing: Easing.in(Easing.cubic),
      });
    }
  }, [active]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: 0.5 + progress.value * 0.5 }],
  }));

  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: count }, (_, i) => ({
      angle: (i / count) * Math.PI * 2 + Math.random() * 0.4,
      distance: radius * (0.6 + Math.random() * 0.4),
      size: 2 + Math.random() * 4,
      color: colors[i % colors.length],
    }));
  }, [count, radius, colors]);

  if (!active) return null;

  const cx = size / 2;
  const cy = size / 2;

  return (
    <Animated.View
      style={[
        styles.container,
        { left: x - size / 2, top: y - size / 2, width: size, height: size },
        animStyle,
      ]}
      pointerEvents="none"
    >
      <Canvas style={StyleSheet.absoluteFill}>
        {particles.map((p, i) => {
          const px = cx + Math.cos(p.angle) * p.distance;
          const py = cy + Math.sin(p.angle) * p.distance;
          return (
            <Circle key={i} cx={px} cy={py} r={p.size}>
              <RadialGradient
                c={vec(px, py)}
                r={p.size}
                colors={[p.color, p.color + "00"]}
              />
            </Circle>
          );
        })}
      </Canvas>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
  },
});
