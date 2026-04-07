/**
 * VoiceMessagePlayer Component
 *
 * Modern inline voice message player with waveform visualization.
 *
 * Features:
 * - Play/pause toggle with smooth animations
 * - Waveform progress visualization
 * - Duration display with elapsed/remaining toggle
 * - Playback speed control (1×/1.5×/2×)
 *
 * @module components/chat/VoiceMessagePlayer
 */

import { formatDurationMs as formatDuration } from "@/utils/time";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "react-native-paper";

// Conditionally import expo-audio
let useAudioPlayer: any = null;
let useAudioPlayerStatus: any = null;

try {
  const expoAudio = require("expo-audio");
  useAudioPlayer = expoAudio.useAudioPlayer;
  useAudioPlayerStatus = expoAudio.useAudioPlayerStatus;
} catch (e) {
  // expo-audio not installed
}

// =============================================================================
// Types
// =============================================================================

export interface VoiceMessagePlayerProps {
  /** URL of the voice message */
  url: string;
  /** Duration in milliseconds (for display before loading) */
  durationMs: number;
  /** Whether this is the sender's message */
  isOwn?: boolean;
  /** Callback when playback starts */
  onPlay?: () => void;
  /** Callback when playback ends */
  onEnd?: () => void;
}

// =============================================================================
// Constants
// =============================================================================

const WAVEFORM_BARS = 28;
const SPEED_OPTIONS = [1, 1.5, 2] as const;

// Generate fake waveform data (in real app, you'd analyze the audio)
function generateWaveformData(bars: number): number[] {
  return Array.from({ length: bars }, (_, i) => {
    // Create a natural-looking waveform envelope
    const pos = i / bars;
    const envelope = Math.sin(pos * Math.PI) * 0.5 + 0.5;
    return Math.max(0.15, envelope * (0.4 + Math.random() * 0.6));
  });
}

// =============================================================================
// Fallback Component (when expo-audio is not installed)
// =============================================================================

function VoiceMessagePlayerFallback({
  durationMs,
  isOwn = false,
}: VoiceMessagePlayerProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { opacity: 0.6 }]}>
      <View
        style={[
          styles.playButton,
          {
            backgroundColor: isOwn
              ? theme.dark
                ? "rgba(255,255,255,0.2)"
                : theme.colors.surfaceVariant
              : theme.colors.surfaceVariant,
          },
        ]}
      >
        <MaterialCommunityIcons
          name="play"
          size={22}
          color={
            isOwn
              ? theme.dark
                ? "rgba(255,255,255,0.6)"
                : theme.colors.onSurfaceVariant
              : theme.colors.onSurfaceVariant
          }
        />
      </View>

      <View style={styles.waveformContainer}>
        <View style={styles.waveform}>
          {generateWaveformData(WAVEFORM_BARS).map((height, index) => (
            <View
              key={index}
              style={[
                styles.waveformBar,
                {
                  height: `${height * 100}%`,
                  backgroundColor: isOwn
                    ? theme.dark
                      ? "rgba(255,255,255,0.3)"
                      : "rgba(0,0,0,0.15)"
                    : "rgba(0,0,0,0.15)",
                },
              ]}
            />
          ))}
        </View>
      </View>

      <Text
        style={[
          styles.duration,
          {
            color: isOwn
              ? theme.dark
                ? "rgba(255,255,255,0.6)"
                : theme.colors.onSurfaceVariant
              : theme.colors.onSurfaceVariant,
          },
        ]}
      >
        {formatDuration(durationMs)}
      </Text>
    </View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

function VoiceMessagePlayerImpl({
  url,
  durationMs,
  isOwn = false,
  onPlay,
  onEnd,
}: VoiceMessagePlayerProps) {
  const theme = useTheme();
  const [waveformData] = useState(() => generateWaveformData(WAVEFORM_BARS));
  const [speedIndex, setSpeedIndex] = useState(0);
  const buttonScale = useRef(new Animated.Value(1)).current;

  // Use expo-audio player
  const player = useAudioPlayer(url);
  const status = useAudioPlayerStatus(player);

  const isPlaying = status?.playing ?? false;
  const currentTime = (status?.currentTime ?? 0) * 1000; // Convert to ms
  const totalDuration = (status?.duration ?? 0) * 1000 || durationMs;
  const progress = totalDuration > 0 ? currentTime / totalDuration : 0;

  // Handle playback end
  useEffect(() => {
    if (status?.didJustFinish) {
      onEnd?.();
    }
  }, [status?.didJustFinish, onEnd]);

  const handlePlayPause = useCallback(() => {
    // Micro-bounce feedback
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.85,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.spring(buttonScale, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();

    if (isPlaying) {
      player.pause();
    } else {
      if (status?.didJustFinish || currentTime >= totalDuration - 100) {
        player.seekTo(0);
      }
      player.play();
      onPlay?.();
    }
  }, [
    isPlaying,
    player,
    status?.didJustFinish,
    currentTime,
    totalDuration,
    onPlay,
    buttonScale,
  ]);

  const handleSpeedPress = useCallback(() => {
    const nextIndex = (speedIndex + 1) % SPEED_OPTIONS.length;
    setSpeedIndex(nextIndex);
    try {
      player.rate = SPEED_OPTIONS[nextIndex];
    } catch (_) {
      // rate assignment unsupported
    }
  }, [speedIndex, player]);

  const displayDuration =
    isPlaying || currentTime > 0
      ? formatDuration(currentTime)
      : formatDuration(durationMs);

  const speed = SPEED_OPTIONS[speedIndex];

  const activeColor = isOwn
    ? theme.dark
      ? "#FFF"
      : theme.colors.primary
    : theme.colors.primary;
  const inactiveColor = isOwn
    ? theme.dark
      ? "rgba(255,255,255,0.3)"
      : "rgba(0,0,0,0.15)"
    : "rgba(0,0,0,0.20)";
  const textColor = isOwn
    ? theme.dark
      ? "rgba(255,255,255,0.85)"
      : theme.colors.onSurface
    : theme.colors.onSurfaceVariant;

  return (
    <View style={styles.container}>
      {/* Play/Pause Button */}
      <TouchableOpacity
        onPress={handlePlayPause}
        activeOpacity={0.8}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Animated.View
          style={[
            styles.playButton,
            {
              backgroundColor: isOwn
                ? theme.dark
                  ? "rgba(255,255,255,0.2)"
                  : theme.colors.primary
                : theme.colors.primary,
              transform: [{ scale: buttonScale }],
            },
          ]}
        >
          <MaterialCommunityIcons
            name={isPlaying ? "pause" : "play"}
            size={22}
            color="#FFF"
          />
        </Animated.View>
      </TouchableOpacity>

      {/* Waveform / Progress */}
      <View style={styles.waveformContainer}>
        <View style={styles.waveform}>
          {waveformData.map((height, index) => {
            const barProgress = (index + 1) / WAVEFORM_BARS;
            const isActive = barProgress <= progress;

            return (
              <View
                key={index}
                style={[
                  styles.waveformBar,
                  {
                    height: `${height * 100}%`,
                    backgroundColor: isActive ? activeColor : inactiveColor,
                    borderRadius: 1.5,
                  },
                ]}
              />
            );
          })}
        </View>
      </View>

      {/* Duration + Speed */}
      <View style={styles.metaColumn}>
        <Text style={[styles.duration, { color: textColor }]}>
          {displayDuration}
        </Text>
        {isPlaying && speed !== 1 && (
          <TouchableOpacity
            onPress={handleSpeedPress}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Text style={[styles.speedLabel, { color: activeColor }]}>
              {speed}×
            </Text>
          </TouchableOpacity>
        )}
        {isPlaying && speed === 1 && (
          <TouchableOpacity
            onPress={handleSpeedPress}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Text style={[styles.speedLabel, { color: textColor }]}>1×</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// =============================================================================
// Export
// =============================================================================

export const VoiceMessagePlayer = memo(function VoiceMessagePlayer(
  props: VoiceMessagePlayerProps,
) {
  if (!useAudioPlayer || !useAudioPlayerStatus) {
    return <VoiceMessagePlayerFallback {...props} />;
  }
  return <VoiceMessagePlayerImpl {...props} />;
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
    minWidth: 220,
    maxWidth: 300,
    gap: 8,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  waveformContainer: {
    flex: 1,
    height: 28,
    justifyContent: "center",
  },
  waveform: {
    flexDirection: "row",
    alignItems: "center",
    height: "100%",
    gap: 1.5,
  },
  waveformBar: {
    flex: 1,
    minWidth: 2.5,
  },
  metaColumn: {
    alignItems: "flex-end",
    justifyContent: "center",
    minWidth: 38,
  },
  duration: {
    fontSize: 11,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  speedLabel: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 1,
  },
});

export default VoiceMessagePlayer;
