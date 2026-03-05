/**
 * Games V4 — TicTacToe Game Screen (Pilot)
 *
 * A minimal TicTacToe UI wrapped by the V4 game shell.
 * Demonstrates the adapter-driven game screen pattern.
 *
 * @module gamesV4/screens/TicTacToeScreenV4
 */

import {
  GameShellProps,
  withGameV4Shell,
} from "@/gamesV4/components/GameScreenShell";
import { useAppTheme } from "@/store/ThemeContext";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Cell = "X" | "O" | null;
type Board = Cell[][];

const EMPTY_BOARD: Board = Array.from({ length: 3 }, () =>
  Array.from({ length: 3 }, () => null),
);

function TicTacToeUI({
  publicState,
  isMyTurn,
  isTerminal,
  myUid,
  turnOrder,
  submitMove,
  actionLoading,
}: GameShellProps) {
  const { theme } = useAppTheme();
  const board: Board = (publicState?.board as Board) ?? EMPTY_BOARD;
  const mySymbol = turnOrder[0] === myUid ? "X" : "O";

  const handlePress = async (row: number, col: number) => {
    if (!isMyTurn || board[row][col] !== null || isTerminal || actionLoading) {
      return;
    }
    await submitMove({ row, col });
  };

  const statusText = isTerminal
    ? "Game Over"
    : isMyTurn
      ? "Your turn"
      : "Opponent's turn";

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.isDark ? "#111" : theme.colors.background },
      ]}
    >
      <Text style={[styles.status, { color: theme.colors.primary }]}>
        {statusText}
      </Text>

      <Text
        style={[styles.symbolLabel, { color: theme.isDark ? "#CCC" : "#555" }]}
      >
        You are {mySymbol}
      </Text>

      <View style={styles.board}>
        {board.map((row, r) =>
          row.map((cell, c) => (
            <TouchableOpacity
              key={`${r}-${c}`}
              style={[
                styles.cell,
                {
                  borderColor: theme.isDark ? "#555" : "#CCC",
                },
              ]}
              onPress={() => handlePress(r, c)}
              disabled={
                !isMyTurn || cell !== null || isTerminal || actionLoading
              }
            >
              <Text
                style={[
                  styles.cellText,
                  {
                    color:
                      cell === "X"
                        ? "#FF4444"
                        : cell === "O"
                          ? "#4488FF"
                          : "transparent",
                  },
                ]}
              >
                {cell ?? " "}
              </Text>
            </TouchableOpacity>
          )),
        )}
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
  status: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  symbolLabel: {
    fontSize: 14,
    marginBottom: 24,
  },
  board: {
    width: 300,
    height: 300,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    width: 100,
    height: 100,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  cellText: {
    fontSize: 40,
    fontWeight: "800",
  },
});

export default withGameV4Shell(TicTacToeUI, "tic_tac_toe");
