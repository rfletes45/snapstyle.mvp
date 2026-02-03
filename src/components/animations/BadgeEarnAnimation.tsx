/**
 * Badge Earn Animation Component
 *
 * Phase 7 of Profile Screen Overhaul
 *
 * Celebration animation when a user earns a new badge:
 * - Badge zoom-in with bounce
 * - Particle burst effect
 * - Glow/shine effect
 * - Optional confetti
 *
 * @see docs/PROFILE_SCREEN_OVERHAUL_PLAN.md Phase 7
 */

import type { AchievementTier } from "@/types/achievements";
import type { Badge } from "@/types/profile";
import React, { memo, useCallback, useEffect } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

// =============================================================================
// Types
// =============================================================================

export interface BadgeEarnAnimationProps {
  /** Badge that was earned */
  badge: Badge;
  /** Whether the animation is visible */
  visible: boolean;
  /** Callback when animation completes */
  onComplete?: () => void;
  /** Animation duration in ms */
  duration?: number;
  /** Show confetti effect */
  showConfetti?: boolean;
  /** Optional custom badge icon component */
  renderBadgeIcon?: (badge: Badge, size: number) => React.ReactNode;
}

interface ParticleProps {
  index: number;
  color: string;
  progress: SharedValue<number>;
}

// =============================================================================
// Constants
// =============================================================================

const PARTICLE_COUNT = 12;
const ANIMATION_DURATION = 2000;

/**
 * Colors per badge tier
 */
const TIER_COLORS: Record<AchievementTier, { primary: string; glow: string }> =
  {
    bronze: { primary: "#CD7F32", glow: "rgba(205, 127, 50, 0.4)" },
    silver: { primary: "#C0C0C0", glow: "rgba(192, 192, 192, 0.4)" },
    gold: { primary: "#F59E0B", glow: "rgba(245, 158, 11, 0.4)" },
    platinum: { primary: "#A855F7", glow: "rgba(168, 85, 247, 0.4)" },
    diamond: { primary: "#3B82F6", glow: "rgba(59, 130, 246, 0.4)" },
  };

// =============================================================================
// Particle Component
// =============================================================================

const Particle = memo<ParticleProps>(function Particle({
  index,
  color,
  progress,
}) {
  const angle = (index / PARTICLE_COUNT) * Math.PI * 2;
  const distance = 100 + Math.random() * 50;

  const animatedStyle = useAnimatedStyle(() => {
    const prog = progress.value;

    const x = Math.cos(angle) * distance * prog;
    const y = Math.sin(angle) * distance * prog - prog * prog * 100; // Gravity effect
    const scale = interpolate(
      prog,
      [0, 0.2, 1],
      [0, 1, 0],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      prog,
      [0, 0.1, 0.8, 1],
      [0, 1, 1, 0],
      Extrapolation.CLAMP,
    );

    return {
      transform: [{ translateX: x }, { translateY: y }, { scale }],
      opacity,
    };
  });

  return (
    <Animated.View
      style={[styles.particle, { backgroundColor: color }, animatedStyle]}
    />
  );
});

// =============================================================================
// Confetti Piece Component
// =============================================================================

const ConfettiPiece = memo<{
  index: number;
  screenWidth: number;
  progress: SharedValue<number>;
}>(function ConfettiPiece({ index, screenWidth, progress }) {
  const colors = [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#96CEB4",
    "#FFEAA7",
    "#DDA0DD",
  ];
  const color = colors[index % colors.length];
  const startX = Math.random() * screenWidth;
  const rotation = Math.random() * 360;
  const fallSpeed = 0.5 + Math.random() * 0.5;

  const animatedStyle = useAnimatedStyle(() => {
    const prog = progress.value;

    const y = prog * 600 * fallSpeed;
    const x = Math.sin(prog * Math.PI * 4 + index) * 30;
    const rotate = rotation + prog * 720;
    const opacity = interpolate(
      prog,
      [0, 0.1, 0.9, 1],
      [0, 1, 1, 0],
      Extrapolation.CLAMP,
    );

    return {
      transform: [
        { translateX: startX + x },
        { translateY: -50 + y },
        { rotate: `${rotate}deg` },
      ],
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        styles.confetti,
        {
          backgroundColor: color,
          width: 8 + Math.random() * 4,
          height: 8 + Math.random() * 4,
        },
        animatedStyle,
      ]}
    />
  );
});

// =============================================================================
// Main Badge Earn Animation Component
// =============================================================================

export const BadgeEarnAnimation = memo<BadgeEarnAnimationProps>(
  function BadgeEarnAnimation({
    badge,
    visible,
    onComplete,
    duration = ANIMATION_DURATION,
    showConfetti = true,
    renderBadgeIcon,
  }) {
    const theme = useTheme();
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();

    // Animation values
    const overlayOpacity = useSharedValue(0);
    const badgeScale = useSharedValue(0);
    const badgeRotation = useSharedValue(0);
    const glowScale = useSharedValue(0);
    const glowOpacity = useSharedValue(0);
    const particleProgress = useSharedValue(0);
    const confettiProgress = useSharedValue(0);
    const textOpacity = useSharedValue(0);
    const textTranslateY = useSharedValue(30);

    const tierColors = TIER_COLORS[badge.tier];

    // Handle animation completion
    const handleComplete = useCallback(() => {
      onComplete?.();
    }, [onComplete]);

    // Start animation when visible changes
    useEffect(() => {
      if (visible) {
        // Reset values
        overlayOpacity.value = 0;
        badgeScale.value = 0;
        badgeRotation.value = -15;
        glowScale.value = 0;
        glowOpacity.value = 0;
        particleProgress.value = 0;
        confettiProgress.value = 0;
        textOpacity.value = 0;
        textTranslateY.value = 30;

        // Animate overlay
        overlayOpacity.value = withTiming(1, { duration: 200 });

        // Badge entrance with bounce
        badgeScale.value = withSequence(
          withDelay(100, withSpring(1.2, { damping: 8, stiffness: 150 })),
          withSpring(1, { damping: 12, stiffness: 200 }),
        );

        badgeRotation.value = withSequence(
          withDelay(100, withSpring(5, { damping: 8 })),
          withSpring(0, { damping: 10 }),
        );

        // Glow effect
        glowScale.value = withDelay(200, withSpring(1.5, { damping: 15 }));
        glowOpacity.value = withSequence(
          withDelay(200, withTiming(0.8, { duration: 300 })),
          withDelay(500, withTiming(0, { duration: 500 })),
        );

        // Particles
        particleProgress.value = withDelay(
          150,
          withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) }),
        );

        // Confetti
        if (showConfetti) {
          confettiProgress.value = withDelay(
            200,
            withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }),
          );
        }

        // Text
        textOpacity.value = withDelay(400, withTiming(1, { duration: 300 }));
        textTranslateY.value = withDelay(400, withSpring(0, { damping: 15 }));

        // Complete and dismiss
        const timeout = setTimeout(() => {
          overlayOpacity.value = withTiming(
            0,
            { duration: 300 },
            (finished) => {
              if (finished) {
                runOnJS(handleComplete)();
              }
            },
          );
        }, duration - 300);

        return () => clearTimeout(timeout);
      }
    }, [visible, duration, showConfetti, handleComplete]);

    // Animated styles
    const overlayStyle = useAnimatedStyle(() => ({
      opacity: overlayOpacity.value,
    }));

    const badgeContainerStyle = useAnimatedStyle(() => ({
      transform: [
        { scale: badgeScale.value },
        { rotate: `${badgeRotation.value}deg` },
      ],
    }));

    const glowStyle = useAnimatedStyle(() => ({
      transform: [{ scale: glowScale.value }],
      opacity: glowOpacity.value,
    }));

    const textStyle = useAnimatedStyle(() => ({
      opacity: textOpacity.value,
      transform: [{ translateY: textTranslateY.value }],
    }));

    if (!visible) return null;

    // Get tier display name
    const tierDisplayName =
      badge.tier.charAt(0).toUpperCase() + badge.tier.slice(1);

    return (
      <Animated.View style={[styles.overlay, overlayStyle]}>
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(0,0,0,0.5)" },
          ]}
        />

        {/* Confetti */}
        {showConfetti && (
          <View style={[styles.confettiContainer, { width: screenWidth }]}>
            {Array.from({ length: 30 }).map((_, index) => (
              <ConfettiPiece
                key={index}
                index={index}
                screenWidth={screenWidth}
                progress={confettiProgress}
              />
            ))}
          </View>
        )}

        {/* Main content */}
        <View style={styles.content}>
          {/* Glow effect */}
          <Animated.View
            style={[
              styles.glow,
              { backgroundColor: tierColors.glow },
              glowStyle,
            ]}
          />

          {/* Particles */}
          <View style={styles.particlesContainer}>
            {Array.from({ length: PARTICLE_COUNT }).map((_, index) => (
              <Particle
                key={index}
                index={index}
                color={tierColors.primary}
                progress={particleProgress}
              />
            ))}
          </View>

          {/* Badge */}
          <Animated.View style={[styles.badgeContainer, badgeContainerStyle]}>
            {renderBadgeIcon ? (
              renderBadgeIcon(badge, 120)
            ) : (
              <View
                style={[
                  styles.badgePlaceholder,
                  { borderColor: tierColors.primary },
                ]}
              >
                <Text style={[styles.badgeEmoji, { fontSize: 64 }]}>
                  {badge.icon}
                </Text>
              </View>
            )}
          </Animated.View>

          {/* Text */}
          <Animated.View style={[styles.textContainer, textStyle]}>
            <Text style={styles.earnedText}>Badge Earned!</Text>
            <Text style={[styles.badgeName, { color: tierColors.primary }]}>
              {badge.name}
            </Text>
            <Text style={styles.badgeDescription}>{badge.description}</Text>
            <View
              style={[
                styles.tierBadge,
                { backgroundColor: tierColors.primary },
              ]}
            >
              <Text style={styles.tierText}>{tierDisplayName}</Text>
            </View>
          </Animated.View>
        </View>
      </Animated.View>
    );
  },
);

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  particlesContainer: {
    position: "absolute",
    width: 1,
    height: 1,
  },
  particle: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  badgeContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  badgePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeEmoji: {
    textAlign: "center",
  },
  textContainer: {
    alignItems: "center",
    marginTop: 32,
    paddingHorizontal: 24,
  },
  earnedText: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.7)",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 8,
  },
  badgeName: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  badgeDescription: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.8)",
    textAlign: "center",
    maxWidth: 280,
    marginBottom: 16,
  },
  tierBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  tierText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  confettiContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    height: "100%",
    overflow: "hidden",
  },
  confetti: {
    position: "absolute",
    borderRadius: 2,
  },
});

export default BadgeEarnAnimation;
