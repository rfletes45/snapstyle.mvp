/**
 * Games V4 — 2048 Game Screen (Pilot)
 *
 * A minimal 2048 solo UI wrapped by the V4 game shell.
 * Demonstrates the solo runtime pattern with gesture-based moves.
 *
 * @module gamesV4/screens/Play2048ScreenV4
 */

import {
  GameShellProps,
  withGameV4Shell,
} from "@/gamesV4/components/GameScreenShell";
import { useAppTheme } from "@/store/ThemeContext";
import React, { useRef } from "react";
import {
  GestureResponderEvent,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from "react-native";

const GRID_SIZE = 4;
const TILE_SIZE = 72;
const TILE_GAP = 8;

const TILE_COLORS: Record<number, string> = {
  0: "#CDC1B4",
  2: "#EEE4DA",
  4: "#EDE0C8",
  8: "#F2B179",
  16: "#F59563",
  32: "#F67C5F",
  64: "#F65E3B",
  128: "#EDCF72",
  256: "#EDCC61",
  512: "#EDC850",
  1024: "#EDC53F",
  2048: "#EDC22E",
};

function Play2048UI({
  publicState,
  isTerminal,
  submitMove,
  actionLoading,
}: GameShellProps) {
  const { theme } = useAppTheme();

  const grid: number[][] =
    (publicState?.grid as number[][]) ??
    Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
  const score = (publicState?.score as number) ?? 0;

  // Swipe detection
  const startXY = useRef({ x: 0, y: 0 });
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        startXY.current = {
          x: evt.nativeEvent.pageX,
          y: evt.nativeEvent.pageY,
        };
      },
      onPanResponderRelease: (evt: GestureResponderEvent) => {
        if (isTerminal || actionLoading) return;
        const dx = evt.nativeEvent.pageX - startXY.current.x;
        const dy = evt.nativeEvent.pageY - startXY.current.y;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        const threshold = 30;

        if (Math.max(absDx, absDy) < threshold) return;

        let direction: "up" | "down" | "left" | "right";
        if (absDx > absDy) {
          direction = dx > 0 ? "right" : "left";
        } else {
          direction = dy > 0 ? "down" : "up";
        }

        submitMove({ direction });
      },
    }),
  ).current;

  const statusText = isTerminal ? "Game Over" : "Swipe to play";

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.isDark ? "#111" : "#FAF8EF" },
      ]}
    >
      <Text style={[styles.title, { color: theme.colors.primary }]}>2048</Text>
      <Text
        style={[styles.score, { color: theme.isDark ? "#CCC" : "#776E65" }]}
      >
        Score: {score}
      </Text>
      <Text
        style={[styles.status, { color: theme.isDark ? "#AAA" : "#776E65" }]}
      >
        {statusText}
      </Text>

      <View
        {...panResponder.panHandlers}
        style={[
          styles.board,
          { backgroundColor: theme.isDark ? "#333" : "#BBADA0" },
        ]}
      >
        {grid.map((row, r) => (
          <View key={r} style={styles.row}>
            {row.map((cell, c) => {
              const bgColor = TILE_COLORS[cell] ?? "#3C3A32";
              const textColor = cell <= 4 ? "#776E65" : "#F9F6F2";
              return (
                <View
                  key={c}
                  style={[styles.tile, { backgroundColor: bgColor }]}
                >
                  {cell > 0 && (
                    <Text
                      style={[
                        styles.tileText,
                        { color: textColor },
                        cell >= 1024 && styles.tileTextSmall,
                      ]}
                    >
                      {cell}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: "800",
    marginBottom: 4,
  },
  score: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  status: {
    fontSize: 14,
    marginBottom: 20,
  },
  board: {
    borderRadius: 8,
    padding: TILE_GAP,
  },
  row: {
    flexDirection: "row",
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 4,
    margin: TILE_GAP / 2,
    justifyContent: "center",
    alignItems: "center",
  },
  tileText: {
    fontSize: 28,
    fontWeight: "700",
  },
  tileTextSmall: {
    fontSize: 20,
  },
});

export default withGameV4Shell(Play2048UI, "play_2048");
