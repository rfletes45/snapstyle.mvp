/**
 * CallQualityIndicator - Displays network quality during calls
 * Shows signal strength bars and connection status
 */

import { Ionicons } from "@expo/vector-icons";
import React, { JSX, useEffect, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

export type NetworkQuality = "excellent" | "good" | "fair" | "poor" | "unknown";

interface CallQualityIndicatorProps {
  /** Network quality level */
  quality?: NetworkQuality;
  /** Show text label */
  showLabel?: boolean;
  /** Size variant */
  size?: "small" | "medium" | "large";
  /** Custom style */
  style?: object;
}

// Quality to bars mapping
const QUALITY_CONFIG: Record<
  NetworkQuality,
  { bars: number; color: string; label: string }
> = {
  excellent: { bars: 4, color: "#4caf50", label: "Excellent" },
  good: { bars: 3, color: "#8bc34a", label: "Good" },
  fair: { bars: 2, color: "#ffc107", label: "Fair" },
  poor: { bars: 1, color: "#f44336", label: "Poor" },
  unknown: { bars: 0, color: "#9e9e9e", label: "Connecting" },
};

// Size configurations
const SIZE_CONFIG = {
  small: { barWidth: 3, barGap: 2, barHeights: [6, 9, 12, 15], fontSize: 10 },
  medium: { barWidth: 4, barGap: 2, barHeights: [8, 12, 16, 20], fontSize: 12 },
  large: { barWidth: 5, barGap: 3, barHeights: [10, 15, 20, 25], fontSize: 14 },
};

export function CallQualityIndicator({
  quality = "unknown",
  showLabel = false,
  size = "medium",
  style,
}: CallQualityIndicatorProps): JSX.Element {
  const config = QUALITY_CONFIG[quality];
  const sizeConfig = SIZE_CONFIG[size];
  const [pulseAnim] = useState(new Animated.Value(1));

  // Pulse animation for poor/unknown quality
  useEffect(() => {
    if (quality === "poor" || quality === "unknown") {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.6,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [quality, pulseAnim]);

  return (
    <Animated.View
      style={[styles.container, { opacity: pulseAnim }, style]}
      accessibilityLabel={`Network quality: ${config.label}`}
      accessibilityRole="text"
    >
      {/* Signal Bars */}
      <View style={styles.barsContainer}>
        {[0, 1, 2, 3].map((index) => (
          <View
            key={index}
            style={[
              styles.bar,
              {
                width: sizeConfig.barWidth,
                height: sizeConfig.barHeights[index],
                marginLeft: index > 0 ? sizeConfig.barGap : 0,
                backgroundColor:
                  index < config.bars
                    ? config.color
                    : "rgba(255, 255, 255, 0.3)",
              },
            ]}
          />
        ))}
      </View>

      {/* Label */}
      {showLabel && (
        <Text
          style={[
            styles.label,
            { fontSize: sizeConfig.fontSize, color: config.color },
          ]}
        >
          {config.label}
        </Text>
      )}
    </Animated.View>
  );
}

// ============================================================================
// Connection Status Indicator
// ============================================================================

interface ConnectionStatusProps {
  /** Connection state */
  state: "connecting" | "connected" | "reconnecting" | "disconnected";
  /** Show reconnect progress */
  showProgress?: boolean;
  /** Custom style */
  style?: object;
}

const CONNECTION_CONFIG: Record<
  string,
  { icon: string; color: string; label: string }
> = {
  connecting: { icon: "sync", color: "#ffc107", label: "Connecting..." },
  connected: { icon: "checkmark-circle", color: "#4caf50", label: "Connected" },
  reconnecting: { icon: "refresh", color: "#ff9800", label: "Reconnecting..." },
  disconnected: {
    icon: "close-circle",
    color: "#f44336",
    label: "Disconnected",
  },
};

export function ConnectionStatusIndicator({
  state,
  showProgress = false,
  style,
}: ConnectionStatusProps): JSX.Element {
  const config = CONNECTION_CONFIG[state];
  const [spinAnim] = useState(new Animated.Value(0));

  // Spinning animation for connecting/reconnecting states
  useEffect(() => {
    if (state === "connecting" || state === "reconnecting") {
      const spin = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      );
      spin.start();
      return () => spin.stop();
    } else {
      spinAnim.setValue(0);
    }
  }, [state, spinAnim]);

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={[styles.connectionContainer, style]}>
      <Animated.View
        style={
          state === "connecting" || state === "reconnecting"
            ? { transform: [{ rotate: spinInterpolate }] }
            : undefined
        }
      >
        <Ionicons
          name={config.icon as keyof typeof Ionicons.glyphMap}
          size={20}
          color={config.color}
        />
      </Animated.View>
      <Text style={[styles.connectionLabel, { color: config.color }]}>
        {config.label}
      </Text>
    </View>
  );
}

// ============================================================================
// Bandwidth Stats Display
// ============================================================================

export interface BandwidthStats {
  /** Upload bitrate in kbps */
  uploadBitrate: number;
  /** Download bitrate in kbps */
  downloadBitrate: number;
  /** Packet loss percentage */
  packetLoss: number;
  /** Round trip time in ms */
  rtt: number;
  /** Jitter in ms */
  jitter: number;
}

interface BandwidthStatsDisplayProps {
  stats: BandwidthStats;
  style?: object;
}

export function BandwidthStatsDisplay({
  stats,
  style,
}: BandwidthStatsDisplayProps): JSX.Element {
  const formatBitrate = (kbps: number): string => {
    if (kbps >= 1000) {
      return `${(kbps / 1000).toFixed(1)} Mbps`;
    }
    return `${kbps.toFixed(0)} kbps`;
  };

  return (
    <View style={[styles.statsContainer, style]}>
      <View style={styles.statRow}>
        <Ionicons name="arrow-up" size={12} color="#4caf50" />
        <Text style={styles.statText}>
          {formatBitrate(stats.uploadBitrate)}
        </Text>
      </View>
      <View style={styles.statRow}>
        <Ionicons name="arrow-down" size={12} color="#2196f3" />
        <Text style={styles.statText}>
          {formatBitrate(stats.downloadBitrate)}
        </Text>
      </View>
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>Loss:</Text>
        <Text
          style={[styles.statText, stats.packetLoss > 5 && styles.statWarning]}
        >
          {stats.packetLoss.toFixed(1)}%
        </Text>
      </View>
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>RTT:</Text>
        <Text style={[styles.statText, stats.rtt > 200 && styles.statWarning]}>
          {stats.rtt.toFixed(0)}ms
        </Text>
      </View>
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  barsContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  bar: {
    borderRadius: 1,
  },
  label: {
    marginLeft: 6,
    fontWeight: "500",
  },

  // Connection status
  connectionContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  connectionLabel: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: "500",
  },

  // Bandwidth stats
  statsContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 8,
    padding: 8,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 2,
  },
  statLabel: {
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.7)",
    marginRight: 4,
  },
  statText: {
    fontSize: 10,
    color: "#fff",
    marginLeft: 4,
  },
  statWarning: {
    color: "#ffc107",
  },
});
