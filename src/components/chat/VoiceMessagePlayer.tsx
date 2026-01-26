/**
 * VoiceMessagePlayer Component
 *
 * Inline voice message player with waveform visualization.
 *
 * Features:
 * - Play/pause toggle
 * - Playback progress bar
 * - Duration display
 * - Playback speed control
 *
 * @module components/chat/VoiceMessagePlayer
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
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

const WAVEFORM_BARS = 20;

// =============================================================================
// Helper Functions
// =============================================================================

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// Generate fake waveform data (in real app, you'd analyze the audio)
function generateWaveformData(bars: number): number[] {
  return Array.from({ length: bars }, () => 0.3 + Math.random() * 0.7);
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
    <View
      style={[
        styles.container,
        isOwn ? styles.containerOwn : styles.containerOther,
      ]}
    >
      <View style={[styles.playButton, styles.playButtonDisabled]}>
        <MaterialCommunityIcons name="play" size={24} color="#888" />
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
                  backgroundColor: "#666",
                },
              ]}
            />
          ))}
        </View>
        <Text style={styles.notAvailableText}>
          Install expo-audio for playback
        </Text>
      </View>

      <Text style={[styles.duration, { color: "#888" }]}>
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
    if (isPlaying) {
      player.pause();
    } else {
      // Reset if at end
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
  ]);

  const displayDuration =
    isPlaying || currentTime > 0
      ? formatDuration(currentTime)
      : formatDuration(durationMs);

  return (
    <View
      style={[
        styles.container,
        isOwn ? styles.containerOwn : styles.containerOther,
      ]}
    >
      {/* Play/Pause Button */}
      <TouchableOpacity
        style={[
          styles.playButton,
          {
            backgroundColor: isOwn ? "rgba(0,0,0,0.2)" : theme.colors.primary,
          },
        ]}
        onPress={handlePlayPause}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons
          name={isPlaying ? "pause" : "play"}
          size={24}
          color={isOwn ? "#000" : "#FFF"}
        />
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
                    backgroundColor: isActive
                      ? isOwn
                        ? "#000"
                        : theme.colors.primary
                      : isOwn
                        ? "rgba(0,0,0,0.3)"
                        : "#555",
                  },
                ]}
              />
            );
          })}
        </View>
      </View>

      {/* Duration */}
      <Text
        style={[styles.duration, { color: isOwn ? "rgba(0,0,0,0.7)" : "#888" }]}
      >
        {displayDuration}
      </Text>
    </View>
  );
}

// =============================================================================
// Export
// =============================================================================

export const VoiceMessagePlayer = memo(function VoiceMessagePlayer(
  props: VoiceMessagePlayerProps,
) {
  // Use fallback if expo-audio is not available
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
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    minWidth: 200,
    maxWidth: 280,
    gap: 10,
  },
  containerOwn: {
    backgroundColor: "transparent",
  },
  containerOther: {
    backgroundColor: "transparent",
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  playButtonDisabled: {
    backgroundColor: "#333",
  },
  waveformContainer: {
    flex: 1,
    height: 32,
    justifyContent: "center",
  },
  waveform: {
    flexDirection: "row",
    alignItems: "center",
    height: "100%",
    gap: 2,
  },
  waveformBar: {
    flex: 1,
    borderRadius: 2,
    minWidth: 3,
  },
  notAvailableText: {
    position: "absolute",
    fontSize: 8,
    color: "#666",
    textAlign: "center",
    width: "100%",
  },
  duration: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    minWidth: 36,
    textAlign: "right",
  },
});

export default VoiceMessagePlayer;
