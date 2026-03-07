/**
 * Minesweeper — Board Component
 *
 * Renders the full Minesweeper board with touch handling.
 * Supports:
 * - Tap to reveal
 * - Long press to flag
 * - Tap on revealed numbered cell for chord reveal
 * - Flag mode toggle (tap = flag instead of reveal)
 * - Pinch-to-zoom and pan for Expert boards
 * - Prevention of accidental reveals during pan/zoom gestures
 *
 * @module gamesV4/screens/minesweeper/MinesweeperBoard
 */

import {
  getIncorrectFlags,
  getNeighbors,
} from "@/gamesV4/games/minesweeper/engine";
import type { MinesweeperPublicState } from "@/gamesV4/games/minesweeper/types";
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  GestureResponderEvent,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { MinesweeperCell } from "./MinesweeperCell";

// =============================================================================
// Props
// =============================================================================

export interface MinesweeperBoardProps {
  state: MinesweeperPublicState;
  cellSize: number;
  flagMode: boolean;
  onReveal: (cellIdx: number) => void;
  onFlag: (cellIdx: number) => void;
  onChord: (cellIdx: number) => void;
  boardWidth: number;
  boardHeight: number;
  zoomEnabled: boolean;
}

// =============================================================================
// Board Component
// =============================================================================

function MinesweeperBoardInner({
  state,
  cellSize,
  flagMode,
  onReveal,
  onFlag,
  onChord,
  boardWidth,
  boardHeight,
  zoomEnabled,
}: MinesweeperBoardProps) {
  const isGameOver = state.status === "won" || state.status === "lost";
  const incorrectFlags = useMemo(
    () =>
      state.status === "lost"
        ? new Set(getIncorrectFlags(state))
        : new Set<number>(),
    [state],
  );

  // Pressed cell tracking for visual feedback
  const [pressedCell, setPressedCell] = useState<number | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = useRef({ x: 0, y: 0 });
  const didMove = useRef(false);
  const didLongPress = useRef(false);

  // Chord preview: cells that would be revealed by chord
  const chordPreviewCells = useMemo(() => {
    if (pressedCell === null) return new Set<number>();
    if (state.cellStates[pressedCell] !== "revealed") return new Set<number>();
    const val = state.board[pressedCell];
    if (val <= 0) return new Set<number>();
    const neighbors = getNeighbors(pressedCell, state.rows, state.cols);
    const preview = new Set<number>();
    for (const n of neighbors) {
      if (state.cellStates[n] === "hidden") preview.add(n);
    }
    return preview;
  }, [pressedCell, state]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, []);

  const handleTouchStart = useCallback(
    (cellIdx: number, evt: GestureResponderEvent) => {
      if (isGameOver) return;
      touchStartPos.current = {
        x: evt.nativeEvent.pageX,
        y: evt.nativeEvent.pageY,
      };
      didMove.current = false;
      didLongPress.current = false;
      setPressedCell(cellIdx);

      // Long press = flag (750ms)
      longPressTimer.current = setTimeout(() => {
        didLongPress.current = true;
        setPressedCell(null);
        if (!flagMode && state.cellStates[cellIdx] !== "revealed") {
          onFlag(cellIdx);
        }
      }, 500);
    },
    [isGameOver, flagMode, state.cellStates, onFlag],
  );

  const handleTouchMove = useCallback((evt: GestureResponderEvent) => {
    const dx = Math.abs(evt.nativeEvent.pageX - touchStartPos.current.x);
    const dy = Math.abs(evt.nativeEvent.pageY - touchStartPos.current.y);
    if (dx > 10 || dy > 10) {
      didMove.current = true;
      setPressedCell(null);
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
  }, []);

  const handleTouchEnd = useCallback(
    (cellIdx: number) => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      setPressedCell(null);

      if (isGameOver || didMove.current || didLongPress.current) return;

      const cellState = state.cellStates[cellIdx];

      if (cellState === "revealed") {
        // Chord reveal on revealed numbered cell
        onChord(cellIdx);
      } else if (cellState === "hidden") {
        if (flagMode) {
          onFlag(cellIdx);
        } else {
          onReveal(cellIdx);
        }
      } else if (cellState === "flagged") {
        // Tap on flagged cell = remove flag
        onFlag(cellIdx);
      }
    },
    [isGameOver, state.cellStates, flagMode, onReveal, onFlag, onChord],
  );

  // Build the board grid
  const boardContent = useMemo(() => {
    const rows: React.ReactNode[] = [];
    for (let r = 0; r < state.rows; r++) {
      const cells: React.ReactNode[] = [];
      for (let c = 0; c < state.cols; c++) {
        const idx = r * state.cols + c;
        const isPressedOrPreview =
          pressedCell === idx || chordPreviewCells.has(idx);

        cells.push(
          <CellTouchWrapper
            key={idx}
            idx={idx}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <MinesweeperCell
              cellSize={cellSize}
              cellState={state.cellStates[idx]}
              cellValue={state.board[idx]}
              isExploded={state.explodedCell === idx}
              isIncorrectFlag={incorrectFlags.has(idx)}
              isGameOver={isGameOver}
              pressed={isPressedOrPreview}
            />
          </CellTouchWrapper>,
        );
      }
      rows.push(
        <View key={r} style={styles.row}>
          {cells}
        </View>,
      );
    }
    return rows;
  }, [
    state,
    cellSize,
    incorrectFlags,
    isGameOver,
    pressedCell,
    chordPreviewCells,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  ]);

  const totalBoardWidth = state.cols * cellSize;
  const totalBoardHeight = state.rows * cellSize;

  const boardView = (
    <View
      style={[
        styles.boardContainer,
        {
          width: totalBoardWidth + 6,
          height: totalBoardHeight + 6,
          backgroundColor: "#808080",
        },
      ]}
    >
      <View
        style={[
          styles.board,
          {
            width: totalBoardWidth,
            height: totalBoardHeight,
          },
        ]}
      >
        {boardContent}
      </View>
    </View>
  );

  // For Expert boards, wrap in ScrollView for zoom/pan
  if (zoomEnabled) {
    return (
      <ScrollView
        horizontal
        style={{ maxWidth: boardWidth, maxHeight: boardHeight }}
        contentContainerStyle={styles.scrollContent}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        bounces={false}
        minimumZoomScale={0.5}
        maximumZoomScale={2.5}
        bouncesZoom={false}
        {...(Platform.OS === "web" ? {} : {})}
      >
        <ScrollView
          style={{ maxHeight: boardHeight }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
          nestedScrollEnabled
        >
          {boardView}
        </ScrollView>
      </ScrollView>
    );
  }

  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      {boardView}
    </View>
  );
}

// =============================================================================
// Cell Touch Wrapper — minimal wrapper for touch events
// =============================================================================

interface CellTouchWrapperProps {
  idx: number;
  onTouchStart: (idx: number, evt: GestureResponderEvent) => void;
  onTouchMove: (evt: GestureResponderEvent) => void;
  onTouchEnd: (idx: number) => void;
  children: React.ReactNode;
}

const CellTouchWrapper = memo(function CellTouchWrapper({
  idx,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  children,
}: CellTouchWrapperProps) {
  return (
    <TouchableWithoutFeedback
      onPressIn={(evt) => onTouchStart(idx, evt)}
      onPressOut={() => onTouchEnd(idx)}
    >
      <View onMoveShouldSetResponder={() => true} onResponderMove={onTouchMove}>
        {children}
      </View>
    </TouchableWithoutFeedback>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  boardContainer: {
    padding: 3,
    borderWidth: 3,
    borderTopColor: "#808080",
    borderLeftColor: "#808080",
    borderBottomColor: "#FFFFFF",
    borderRightColor: "#FFFFFF",
  },
  board: {
    flexDirection: "column",
  },
  row: {
    flexDirection: "row",
  },
  scrollContent: {
    alignItems: "center",
    justifyContent: "center",
  },
});

// =============================================================================
// Memoized Export
// =============================================================================

export const MinesweeperBoard = memo(MinesweeperBoardInner);
