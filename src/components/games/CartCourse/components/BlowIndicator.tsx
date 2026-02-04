/**
 * Blow Indicator Component (Phase 4)
 * Shows microphone feedback and alternative tap button
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BUTTON_CONFIG } from "../data/constants";

// ============================================
// Props Interface
// ============================================

interface BlowIndicatorProps {
  isBlowing: boolean;
  volume?: number; // 0-1, for visual feedback
  hasPermission: boolean;
  visible?: boolean;
  onTapStart?: () => void;
  onTapEnd?: () => void;
  showVolumeIndicator?: boolean;
  label?: string;
}

// ============================================
// Component
// ============================================

export const BlowIndicator: React.FC<BlowIndicatorProps> = ({
  isBlowing,
  volume = 0,
  hasPermission,
  visible = true,
  onTapStart,
  onTapEnd,
  showVolumeIndicator = true,
  label = "💨",
}) => {
  // Animation values
  const [pulseAnim] = useState(new Animated.Value(1));
  const [glowAnim] = useState(new Animated.Value(0));

  // Pulse animation when blowing
  useEffect(() => {
    if (isBlowing) {
      // Start pulsing
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 200,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();

      // Glow on
      Animated.timing(glowAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: false,
      }).start();

      return () => pulse.stop();
    } else {
      // Reset animations
      pulseAnim.setValue(1);
      Animated.timing(glowAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  }, [isBlowing, pulseAnim, glowAnim]);

  // Handle tap press
  const handlePressIn = useCallback(() => {
    onTapStart?.();
  }, [onTapStart]);

  const handlePressOut = useCallback(() => {
    onTapEnd?.();
  }, [onTapEnd]);

  if (!visible) {
    return null;
  }

  // Calculate colors based on state
  const backgroundColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [BUTTON_CONFIG.colors.idle, BUTTON_CONFIG.colors.pressed],
  });

  const borderColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [BUTTON_CONFIG.colors.border, "rgba(255, 200, 100, 0.8)"],
  });

  return (
    <View style={styles.container}>
      {/* Volume indicator bar */}
      {showVolumeIndicator && hasPermission && (
        <View style={styles.volumeContainer}>
          <View style={styles.volumeTrack}>
            <View
              style={[
                styles.volumeFill,
                { width: `${volume * 100}%` },
                isBlowing && styles.volumeFillActive,
              ]}
            />
          </View>
          <Text style={styles.volumeLabel}>
            {hasPermission ? "MIC" : "TAP"}
          </Text>
        </View>
      )}

      {/* Main button */}
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.buttonWrapper}
      >
        <Animated.View
          style={[
            styles.button,
            {
              transform: [{ scale: pulseAnim }],
              backgroundColor,
              borderColor,
            },
          ]}
        >
          <Text style={styles.buttonLabel}>{label}</Text>
          {!hasPermission && <Text style={styles.tapHint}>TAP</Text>}
        </Animated.View>
      </Pressable>

      {/* Status indicator */}
      <View style={styles.statusContainer}>
        <View
          style={[
            styles.statusDot,
            isBlowing ? styles.statusActive : styles.statusInactive,
          ]}
        />
        <Text style={styles.statusText}>{isBlowing ? "ACTIVE" : "READY"}</Text>
      </View>
    </View>
  );
};

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
  },
  volumeContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    width: 80,
  },
  volumeTrack: {
    flex: 1,
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 2,
    overflow: "hidden",
  },
  volumeFill: {
    height: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    borderRadius: 2,
  },
  volumeFillActive: {
    backgroundColor: "rgba(100, 255, 100, 0.8)",
  },
  volumeLabel: {
    marginLeft: 6,
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.5)",
    fontWeight: "600",
  },
  buttonWrapper: {
    // Touch target padding
  },
  button: {
    width: BUTTON_CONFIG.size * 1.2,
    height: BUTTON_CONFIG.size * 1.2,
    borderRadius: BUTTON_CONFIG.size * 0.6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonLabel: {
    fontSize: 28,
  },
  tapHint: {
    position: "absolute",
    bottom: 4,
    fontSize: 8,
    color: "rgba(255, 255, 255, 0.6)",
    fontWeight: "bold",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusActive: {
    backgroundColor: "#4ade80",
  },
  statusInactive: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  statusText: {
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.5)",
    fontWeight: "600",
  },
});

export default BlowIndicator;
