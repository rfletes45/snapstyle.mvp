/**
 * 2048 — Game Overlays
 *
 * Semi-transparent overlays shown on top of the board:
 *   - Win celebration (first time reaching 2048, with "Keep Going" button)
 *   - Game Over (no moves remaining, shown briefly before V4 navigation)
 *
 * @module gamesV4/screens/play2048/GameOverlay
 */

import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { BoardTheme } from "./constants";

// ── Win Overlay ───────────────────────────────────────────────────────────────

interface WinOverlayProps {
  onKeepGoing: () => void;
  theme: BoardTheme;
  boardSize: number;
}

export function WinOverlay({ onKeepGoing, theme, boardSize }: WinOverlayProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, scale]);

  const borderRadius = Math.max(boardSize * 0.025, 8);

  return (
    <Animated.View
      style={[
        styles.overlay,
        {
          width: boardSize,
          height: boardSize,
          borderRadius,
          backgroundColor: "rgba(237,194,46,0.55)",
          opacity,
        },
      ]}
    >
      <Animated.View style={{ transform: [{ scale }], alignItems: "center" }}>
        <Text style={styles.winEmoji}>🎉</Text>
        <Text style={[styles.winTitle, { color: "#F9F6F2" }]}>You Win!</Text>
        <Text style={[styles.winSubtitle, { color: "rgba(249,246,242,0.85)" }]}>
          You reached 2048!
        </Text>
        <TouchableOpacity
          style={styles.keepGoingBtn}
          onPress={onKeepGoing}
          activeOpacity={0.7}
        >
          <Text style={styles.keepGoingText}>Keep Going</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

// ── Game Over Overlay ─────────────────────────────────────────────────────────

interface GameOverOverlayProps {
  score: number;
  theme: BoardTheme;
  boardSize: number;
}

export function GameOverOverlay({
  score,
  theme,
  boardSize,
}: GameOverOverlayProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  const borderRadius = Math.max(boardSize * 0.025, 8);

  return (
    <Animated.View
      style={[
        styles.overlay,
        {
          width: boardSize,
          height: boardSize,
          borderRadius,
          backgroundColor: theme.overlayBg,
          opacity,
        },
      ]}
    >
      <View style={styles.overContent}>
        <Text style={[styles.overTitle, { color: theme.overlayText }]}>
          Game Over
        </Text>
        <Text style={[styles.overScore, { color: theme.overlayText }]}>
          Score: {score.toLocaleString()}
        </Text>
      </View>
    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  // Win
  winEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  winTitle: {
    fontSize: 40,
    fontWeight: "900",
    marginBottom: 4,
  },
  winSubtitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 20,
  },
  keepGoingBtn: {
    backgroundColor: "#8F7A66",
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 8,
  },
  keepGoingText: {
    color: "#F9F6F2",
    fontSize: 16,
    fontWeight: "800",
  },
  // Game over
  overContent: {
    alignItems: "center",
  },
  overTitle: {
    fontSize: 40,
    fontWeight: "900",
    marginBottom: 8,
  },
  overScore: {
    fontSize: 20,
    fontWeight: "700",
  },
});
