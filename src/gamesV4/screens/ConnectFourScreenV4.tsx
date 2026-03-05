/**
 * Games V4 — Connect Four Game Screen (Pilot)
 *
 * A minimal Connect Four UI wrapped by the V4 game shell.
 * Demonstrates the adapter-driven game screen pattern for a grid game.
 *
 * @module gamesV4/screens/ConnectFourScreenV4
 */

import {
  GameShellProps,
  withGameV4Shell,
} from "@/gamesV4/components/GameScreenShell";
import { useAppTheme } from "@/store/ThemeContext";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

const ROWS = 6;
const COLS = 7;
const CELL_SIZE = 44;

/** 0 = empty, 1 = player 1 (red), 2 = player 2 (yellow) */
type CellVal = 0 | 1 | 2;

function ConnectFourUI({
  publicState,
  isMyTurn,
  isTerminal,
  myUid,
  turnOrder,
  submitMove,
  actionLoading,
}: GameShellProps) {
  const { theme } = useAppTheme();

  // Board: ROWS × COLS, column-major in publicState, but we flatten to row-major for display
  const board: CellVal[][] =
    (publicState?.board as CellVal[][]) ??
    Array.from({ length: ROWS }, () => Array(COLS).fill(0));

  const myPlayerNumber: 1 | 2 = turnOrder[0] === myUid ? 1 : 2;
  const colorMap: Record<number, string> = {
    0: "transparent",
    1: "#FF4444",
    2: "#FFCC00",
  };

  const handleColumnPress = async (col: number) => {
    if (!isMyTurn || isTerminal || actionLoading) return;
    await submitMove({ col });
  };

  const statusText = isTerminal
    ? "Game Over"
    : isMyTurn
      ? "Your turn — tap a column"
      : "Opponent's turn";

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.isDark ? "#111" : theme.colors.background,
        },
      ]}
    >
      <Text style={[styles.status, { color: theme.colors.primary }]}>
        {statusText}
      </Text>

      <Text
        style={[styles.symbolLabel, { color: theme.isDark ? "#CCC" : "#555" }]}
      >
        You are {myPlayerNumber === 1 ? "Red" : "Yellow"}
      </Text>

      {/* Column drop buttons */}
      <View style={styles.colButtons}>
        {Array.from({ length: COLS }).map((_, col) => (
          <TouchableOpacity
            key={col}
            style={styles.colButton}
            onPress={() => handleColumnPress(col)}
            disabled={!isMyTurn || isTerminal || actionLoading}
          >
            <Text style={{ color: theme.colors.primary, fontWeight: "700" }}>
              ▼
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Board grid */}
      <View
        style={[
          styles.board,
          { backgroundColor: theme.isDark ? "#1A237E" : "#1565C0" },
        ]}
      >
        {board.map((row, r) => (
          <View key={r} style={styles.row}>
            {row.map((cell, c) => (
              <View key={c} style={styles.cellOuter}>
                <View
                  style={[
                    styles.cellInner,
                    {
                      backgroundColor:
                        cell === 0
                          ? theme.isDark
                            ? "#222"
                            : "#FFF"
                          : colorMap[cell],
                    },
                  ]}
                />
              </View>
            ))}
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
    padding: 16,
  },
  status: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  symbolLabel: {
    fontSize: 14,
    marginBottom: 16,
  },
  colButtons: {
    flexDirection: "row",
    marginBottom: 4,
  },
  colButton: {
    width: CELL_SIZE,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 2,
  },
  board: {
    borderRadius: 8,
    padding: 4,
  },
  row: {
    flexDirection: "row",
  },
  cellOuter: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 2,
    marginVertical: 2,
  },
  cellInner: {
    width: CELL_SIZE - 8,
    height: CELL_SIZE - 8,
    borderRadius: (CELL_SIZE - 8) / 2,
  },
});

export default withGameV4Shell(ConnectFourUI, "connect_four");
