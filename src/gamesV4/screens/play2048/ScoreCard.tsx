/**
 * 2048 — Score Card Component
 *
 * Premium-looking score card chips inspired by the original 2048.
 * Shows a label on top and the value below.
 * Includes a "+N" pop animation when the score increases.
 *
 * @module gamesV4/screens/play2048/ScoreCard
 */

import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import type { BoardTheme } from "./constants";

// ── Score Pop Label ───────────────────────────────────────────────────────────

function ScorePop({ delta }: { delta: number }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -28,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);

  return (
    <Animated.Text
      style={[
        styles.scorePop,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      +{delta}
    </Animated.Text>
  );
}

// ── Score Card ────────────────────────────────────────────────────────────────

interface ScoreCardProps {
  label: string;
  value: number;
  /** Score delta for pop animation (only for the active score card). */
  scoreDelta?: number;
  /** Incremented key to trigger new pops. */
  popKey?: number;
  theme: BoardTheme;
  minWidth?: number;
}

export function ScoreCard({
  label,
  value,
  scoreDelta,
  popKey,
  theme,
  minWidth = 80,
}: ScoreCardProps) {
  const [pops, setPops] = useState<Array<{ key: number; delta: number }>>([]);
  const prevPopKey = useRef(popKey ?? 0);

  useEffect(() => {
    if (
      popKey !== undefined &&
      popKey !== prevPopKey.current &&
      scoreDelta !== undefined &&
      scoreDelta > 0
    ) {
      prevPopKey.current = popKey;
      const newPop = { key: popKey, delta: scoreDelta };
      setPops((prev) => [...prev, newPop]);

      // Auto-remove after animation
      const timer = setTimeout(() => {
        setPops((prev) => prev.filter((p) => p.key !== newPop.key));
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [popKey, scoreDelta]);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.scoreBg,
          minWidth,
        },
      ]}
    >
      <Text style={[styles.cardLabel, { color: theme.scoreLabel }]}>
        {label}
      </Text>
      <Text style={[styles.cardValue, { color: theme.scoreValue }]}>
        {value.toLocaleString()}
      </Text>

      {/* Score pop labels */}
      {pops.map((p) => (
        <ScorePop key={p.key} delta={p.delta} />
      ))}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    position: "relative",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  cardValue: {
    fontSize: 22,
    fontWeight: "800",
  },
  scorePop: {
    position: "absolute",
    top: -4,
    fontSize: 16,
    fontWeight: "800",
    color: "rgba(119,110,101,0.9)",
  },
});
