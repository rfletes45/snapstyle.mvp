/**
 * 2048 — Board Component
 *
 * Renders the 4×4 grid background cells and positions animated tiles on top.
 * The grid background is always visible; tiles float above it.
 *
 * Tiles are keyed by `${tile.id}_${phaseKey}` to force React to remount
 * them for each animation cycle, ensuring fresh Animated values.
 *
 * @module gamesV4/screens/play2048/Board
 */

import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { AnimatedTile } from "./AnimatedTile";
import type { BoardTheme } from "./constants";
import { BOARD_PADDING, CELL_GAP, GRID_SIZE, cellPosition } from "./constants";
import type { RenderTile } from "./types";

interface BoardProps {
  tiles: RenderTile[];
  /** Key that changes with each animation phase (forces tile remount). */
  phaseKey: string;
  boardSize: number;
  cellSize: number;
  theme: BoardTheme;
}

function BoardInner({
  tiles,
  phaseKey,
  boardSize,
  cellSize,
  theme,
}: BoardProps) {
  // Pre-compute empty cell positions
  const emptyCells = useMemo(() => {
    const cells: Array<{ key: string; x: number; y: number }> = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        cells.push({
          key: `cell_${r}_${c}`,
          x: cellPosition(c, cellSize, CELL_GAP, BOARD_PADDING),
          y: cellPosition(r, cellSize, CELL_GAP, BOARD_PADDING),
        });
      }
    }
    return cells;
  }, [cellSize]);

  return (
    <View
      style={[
        styles.board,
        {
          width: boardSize,
          height: boardSize,
          borderRadius: Math.max(boardSize * 0.025, 8),
          backgroundColor: theme.boardBg,
        },
      ]}
    >
      {/* Empty cell backgrounds */}
      {emptyCells.map((cell) => (
        <View
          key={cell.key}
          style={[
            styles.emptyCell,
            {
              left: cell.x,
              top: cell.y,
              width: cellSize,
              height: cellSize,
              borderRadius: Math.max(cellSize * 0.08, 4),
              backgroundColor: theme.cellBg,
            },
          ]}
        />
      ))}

      {/* Animated tiles */}
      {tiles.map((tile) => (
        <AnimatedTile
          key={`${tile.id}_${phaseKey}`}
          value={tile.value}
          row={tile.row}
          col={tile.col}
          prevRow={tile.prevRow}
          prevCol={tile.prevCol}
          isNew={tile.isNew}
          isMergeResult={tile.isMergeResult}
          cellSize={cellSize}
          cellGap={CELL_GAP}
          boardPadding={BOARD_PADDING}
          zIndex={tile.zIndex ?? 1}
        />
      ))}
    </View>
  );
}

export const Board = React.memo(BoardInner);

const styles = StyleSheet.create({
  board: {
    position: "relative",
    overflow: "hidden",
    // Depth
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  emptyCell: {
    position: "absolute",
  },
});
