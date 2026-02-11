import {
  Canvas,
  LinearGradient as SkiaLinearGradient,
  RoundedRect,
  Shadow as SkiaShadow,
  vec,
} from "@shopify/react-native-skia";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

interface SimpleSpectatorCardProps {
  width: number;
  title: string;
  subtitle: string;
  score: number;
  level: number;
  lives: number;
}

export function SimpleSpectatorCard({
  width,
  title,
  subtitle,
  score,
  level,
  lives,
}: SimpleSpectatorCardProps) {
  const cardWidth = Math.min(width, 380);
  const cardHeight = Math.round(cardWidth * 0.58);

  return (
    <View style={[styles.card, { width: cardWidth, height: cardHeight }]}> 
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <RoundedRect x={0} y={0} width={cardWidth} height={cardHeight} r={16}>
          <SkiaLinearGradient
            start={vec(0, 0)}
            end={vec(cardWidth, cardHeight)}
            colors={["#182334", "#0f172a", "#111827"]}
          />
          <SkiaShadow dx={0} dy={4} blur={10} color="rgba(0,0,0,0.35)" />
        </RoundedRect>
      </Canvas>

      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Score</Text>
          <Text style={styles.statValue}>{score}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Level</Text>
          <Text style={styles.statValue}>{level}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Lives</Text>
          <Text style={styles.statValue}>{lives}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: "center",
    borderRadius: 16,
    overflow: "hidden",
    justifyContent: "space-between",
    padding: 16,
  },
  header: {
    gap: 4,
  },
  title: {
    color: "#f8fafc",
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    color: "rgba(226,232,240,0.8)",
    fontSize: 13,
    fontWeight: "500",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  statItem: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 8,
    backgroundColor: "rgba(148,163,184,0.16)",
    alignItems: "center",
  },
  statLabel: {
    color: "rgba(226,232,240,0.7)",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValue: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
  },
});