/**
 * 2048 — Main Game Component
 *
 * Mobile-first layout with responsive board, score cards, gesture handler,
 * keyboard support, and game overlays.
 *
 * Layout (portrait):
 *   ┌─────────────────────┐
 *   │  [SCORE]   [BEST]   │  Score cards row
 *   │                     │
 *   │   ┌─────────────┐   │  Board (centered, square)
 *   │   │             │   │
 *   │   │   4×4 grid  │   │
 *   │   │             │   │
 *   │   └─────────────┘   │
 *   │                     │
 *   │   Moves: 42         │  Bottom info
 *   └─────────────────────┘
 *
 * @module gamesV4/screens/play2048/Play2048Game
 */

import type { GameShellProps } from "@/gamesV4/components/GameScreenShell";
import { useAppTheme } from "@/store/ThemeContext";
import React, { useEffect, useMemo, useRef } from "react";
import {
  GestureResponderEvent,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Board } from "./Board";
import { GameOverOverlay, WinOverlay } from "./GameOverlay";
import { ScoreCard } from "./ScoreCard";
import {
  BOARD_PADDING,
  CELL_GAP,
  DARK_THEME,
  GRID_SIZE,
  LIGHT_THEME,
  MAX_BOARD_SIZE,
  SWIPE_THRESHOLD,
  type BoardTheme,
} from "./constants";
import type { Direction } from "./types";
import { useGameController } from "./useGameController";

// ── Main Component ────────────────────────────────────────────────────────────

export default function Play2048Game({
  publicState,
  isTerminal,
  submitMove,
  actionLoading,
}: GameShellProps) {
  const { theme: appTheme } = useAppTheme();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const boardTheme: BoardTheme = appTheme.isDark ? DARK_THEME : LIGHT_THEME;

  // ── Responsive board sizing ──
  const isLandscape = screenWidth > screenHeight;
  const maxWidth = isLandscape
    ? Math.min(screenHeight - 180, MAX_BOARD_SIZE)
    : Math.min(screenWidth - 32, MAX_BOARD_SIZE);
  const boardSize = Math.max(maxWidth, 200);
  const cellSize =
    (boardSize - 2 * BOARD_PADDING - (GRID_SIZE - 1) * CELL_GAP) / GRID_SIZE;

  // ── Game controller ──
  const {
    renderTiles,
    phaseKey,
    score,
    bestScore,
    hasWon,
    gameOver,
    showWinOverlay,
    moveCount,
    bestTile,
    inputLocked,
    scoreDelta,
    popKey,
    handleMove,
    dismissWinOverlay,
    initialized,
  } = useGameController({ publicState, isTerminal, submitMove });

  // ── Always-current ref for handleMove ──
  // PanResponder.create() captures its callbacks at mount time.
  // Without the ref, the stale handleMove closure would carry a stale
  // submitMove that validates against the initial effectivePublicState,
  // causing the direction-teleport / score-flash bug after the first swipe.
  const handleMoveRef = useRef(handleMove);
  handleMoveRef.current = handleMove;

  // ── Swipe gesture handler ──
  const startXY = useRef({ x: 0, y: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        startXY.current = {
          x: evt.nativeEvent.pageX,
          y: evt.nativeEvent.pageY,
        };
      },
      onPanResponderRelease: (evt: GestureResponderEvent) => {
        const dx = evt.nativeEvent.pageX - startXY.current.x;
        const dy = evt.nativeEvent.pageY - startXY.current.y;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (Math.max(absDx, absDy) < SWIPE_THRESHOLD) return;

        let direction: Direction;
        if (absDx > absDy) {
          direction = dx > 0 ? "right" : "left";
        } else {
          direction = dy > 0 ? "down" : "up";
        }

        handleMoveRef.current(direction);
      },
      // Prevent scroll interference
      onShouldBlockNativeResponder: () => true,
    }),
  ).current;

  // ── Keyboard support (web) ──
  // (handleMoveRef is defined above, before PanResponder)

  useEffect(() => {
    if (Platform.OS !== "web") return;

    const keyMap: Record<string, Direction> = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      w: "up",
      a: "left",
      s: "down",
      d: "right",
    };

    const handler = (e: KeyboardEvent) => {
      const dir = keyMap[e.key];
      if (dir) {
        e.preventDefault();
        handleMoveRef.current(dir);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Status text ──
  const statusText = useMemo(() => {
    if (gameOver) return "No moves remaining";
    if (isTerminal) return "Game ended";
    if (hasWon) return "Keep going for a higher score!";
    return `Moves: ${moveCount}`;
  }, [gameOver, isTerminal, hasWon, moveCount]);

  // ── Render ──
  if (!initialized) {
    return (
      <View
        style={[styles.container, { backgroundColor: boardTheme.screenBg }]}
      >
        <Text style={[styles.loading, { color: boardTheme.textSecondary }]}>
          Loading...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: boardTheme.screenBg }]}>
      {/* Top spacer: enough room for safe area + overlay buttons so they
          don't cover the score cards, but no extra header band. */}
      <View style={{ height: insets.top + 52 }} />

      {/* Content wrapper: centered in remaining space */}
      <View style={styles.contentWrapper}>
        {/* ── Score Cards ── */}
        <View style={styles.scoreRow}>
          <ScoreCard
            label="SCORE"
            value={score}
            scoreDelta={scoreDelta}
            popKey={popKey}
            theme={boardTheme}
            minWidth={boardSize * 0.38}
          />
          <View style={{ width: 10 }} />
          <ScoreCard
            label="BEST"
            value={bestScore}
            theme={boardTheme}
            minWidth={boardSize * 0.38}
          />
        </View>

        {/* ── Board with gesture handler ── */}
        <View style={styles.boardWrapper}>
          <View {...panResponder.panHandlers}>
            <View style={{ position: "relative" }}>
              <Board
                tiles={renderTiles}
                phaseKey={phaseKey}
                boardSize={boardSize}
                cellSize={cellSize}
                theme={boardTheme}
              />

              {/* Overlays */}
              {showWinOverlay && (
                <WinOverlay
                  onKeepGoing={dismissWinOverlay}
                  theme={boardTheme}
                  boardSize={boardSize}
                />
              )}
              {gameOver && !showWinOverlay && (
                <GameOverOverlay
                  score={score}
                  theme={boardTheme}
                  boardSize={boardSize}
                />
              )}
            </View>
          </View>
        </View>

        {/* ── Bottom info ── */}
        <View style={styles.bottomInfo}>
          <Text
            style={[styles.statusText, { color: boardTheme.textSecondary }]}
          >
            {statusText}
          </Text>
          {bestTile > 0 && (
            <Text
              style={[styles.bestTileText, { color: boardTheme.textSecondary }]}
            >
              Best Tile: {bestTile}
            </Text>
          )}
        </View>
      </View>

      {/* Bottom spacer: balance the top spacer for visual centering */}
      <View style={{ height: insets.bottom + 16 }} />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 16,
  },
  contentWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loading: {
    fontSize: 16,
    marginTop: 40,
  },
  scoreRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  boardWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  bottomInfo: {
    marginTop: 16,
    alignItems: "center",
    gap: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
  },
  bestTileText: {
    fontSize: 13,
    fontWeight: "500",
  },
});
