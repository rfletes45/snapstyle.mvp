/**
 * Battleship — BoardCard + BattleshipGrid
 *
 * Premium board presentation with:
 * - Rounded card container with shadow/stroke
 * - Coordinate rails (A–J top, 1–10 left) — dynamic for 8/10/12
 * - Memoized cell rendering for performance
 * - Pluggable CellMarker components (Hit/Miss/Sunk/Selected)
 * - Minimum 44pt touch targets on mobile
 *
 * @module gamesV4/screens/battleship/BoardCard
 */

import React, { useCallback, useMemo } from "react";
import {
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { GridSize } from "../../adapters/battleship/battleshipTypes";
import {
  HitMarker,
  MissMarker,
  SelectedMarker,
  SunkMarker,
} from "./CellMarkers";
import type { BattleshipTokens } from "./battleshipTheme";
import { BS } from "./battleshipTheme";

// =============================================================================
// Types
// =============================================================================

export type CellStatus =
  | "empty"
  | "ship"
  | "hit"
  | "miss"
  | "sunk"
  | "selected";

export interface GridCellData {
  status: CellStatus;
  shipId?: string;
}

// =============================================================================
// Helpers
// =============================================================================

function colLabel(c: number): string {
  return String.fromCharCode(65 + c);
}

function cellKey(r: number, c: number): string {
  return `${r},${c}`;
}

function computeCellSize(gridSize: GridSize): number {
  const screenW = Dimensions.get("window").width;
  // Card has horizontal padding, rail has width, and the card itself has margin
  const availableWidth =
    screenW -
    BS.spacing.lg * 2 - // screen horizontal padding
    BS.gridPadding * 2 - // card internal padding
    BS.coordinateRailWidth - // row label rail
    4; // cell gaps
  const raw = Math.floor(availableWidth / gridSize);
  return Math.max(BS.minTouchTarget - 10, Math.min(raw, 44)); // clamp between 34–44
}

// =============================================================================
// GridCell — Memoized individual cell
// =============================================================================

interface CellProps {
  r: number;
  c: number;
  data: GridCellData;
  size: number;
  tokens: BattleshipTokens;
  isSelected: boolean;
  onPress?: (r: number, c: number) => void;
  disabled?: boolean;
}

const GridCell = React.memo(function GridCell({
  r,
  c,
  data,
  size,
  tokens,
  isSelected,
  onPress,
  disabled,
}: CellProps) {
  const handlePress = useCallback(() => {
    onPress?.(r, c);
  }, [onPress, r, c]);

  const bgColor = isSelected
    ? tokens.cellSelected
    : getCellBg(data.status, tokens);

  const borderColor = isSelected ? tokens.cellSelectedBorder : tokens.gridLine;

  return (
    <TouchableOpacity
      style={[
        styles.cell,
        {
          width: size,
          height: size,
          backgroundColor: bgColor,
          borderColor,
        },
      ]}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Cell ${colLabel(c)}${r + 1}, ${data.status}`}
    >
      {data.status === "miss" && <MissMarker size={size} tokens={tokens} />}
      {data.status === "hit" && <HitMarker size={size} tokens={tokens} />}
      {data.status === "sunk" && <SunkMarker size={size} tokens={tokens} />}
      {isSelected && (
        <SelectedMarker
          size={size}
          tokens={tokens}
          label={`${colLabel(c)}${r + 1}`}
        />
      )}
    </TouchableOpacity>
  );
});

function getCellBg(status: CellStatus, tokens: BattleshipTokens): string {
  switch (status) {
    case "ship":
      return tokens.cellShip;
    case "hit":
      return tokens.markerHit + "18"; // subtle tinted bg behind marker
    case "miss":
      return tokens.cellEmpty; // marker draws the circle
    case "sunk":
      return tokens.markerSunk + "30";
    case "selected":
      return tokens.cellSelected;
    case "empty":
    default:
      return tokens.cellEmpty;
  }
}

// =============================================================================
// CoordinateRail — Column headers (top) + Row labels (left)
// =============================================================================

interface RailProps {
  gridSize: GridSize;
  cellSize: number;
  tokens: BattleshipTokens;
}

const ColumnHeaders = React.memo(function ColumnHeaders({
  gridSize,
  cellSize,
  tokens,
}: RailProps) {
  return (
    <View style={styles.colHeaderRow}>
      {/* Spacer for row label column */}
      <View style={{ width: BS.coordinateRailWidth }} />
      {Array.from({ length: gridSize }).map((_, c) => (
        <View key={c} style={[styles.colHeaderCell, { width: cellSize }]}>
          <Text style={[styles.coordText, { color: tokens.coordinateText }]}>
            {colLabel(c)}
          </Text>
        </View>
      ))}
    </View>
  );
});

const RowLabel = React.memo(function RowLabel({
  row,
  cellSize,
  tokens,
}: {
  row: number;
  cellSize: number;
  tokens: BattleshipTokens;
}) {
  return (
    <View
      style={[
        styles.rowLabelCell,
        { width: BS.coordinateRailWidth, height: cellSize },
      ]}
    >
      <Text style={[styles.coordText, { color: tokens.coordinateText }]}>
        {row + 1}
      </Text>
    </View>
  );
});

// =============================================================================
// BattleshipGrid — Full grid with coordinate rails
// =============================================================================

export interface BattleshipGridProps {
  gridSize: GridSize;
  cells: GridCellData[][];
  onCellPress?: (r: number, c: number) => void;
  disabled?: boolean;
  selectedTargets?: Set<string>;
  tokens: BattleshipTokens;
  label?: string;
}

export const BattleshipGrid = React.memo(function BattleshipGrid({
  gridSize,
  cells,
  onCellPress,
  disabled,
  selectedTargets,
  tokens,
  label,
}: BattleshipGridProps) {
  const cellSize = useMemo(() => computeCellSize(gridSize), [gridSize]);

  return (
    <View style={styles.gridWrapper}>
      {label && (
        <Text
          style={[
            styles.gridLabel,
            {
              color: tokens.textSecondary,
              fontSize: BS.fonts.sm,
              fontWeight: BS.fontWeights.semibold,
            },
          ]}
        >
          {label}
        </Text>
      )}
      <ColumnHeaders gridSize={gridSize} cellSize={cellSize} tokens={tokens} />
      {Array.from({ length: gridSize }).map((_, r) => (
        <View key={r} style={styles.gridRow}>
          <RowLabel row={r} cellSize={cellSize} tokens={tokens} />
          {Array.from({ length: gridSize }).map((_, c) => {
            const cell = cells[r]?.[c] ?? { status: "empty" as CellStatus };
            const isSelected = selectedTargets?.has(cellKey(r, c)) ?? false;
            return (
              <GridCell
                key={c}
                r={r}
                c={c}
                data={cell}
                size={cellSize}
                tokens={tokens}
                isSelected={isSelected}
                onPress={onCellPress}
                disabled={disabled}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
});

// =============================================================================
// BoardCard — Wraps a grid in a premium card treatment
// =============================================================================

export interface BoardCardProps {
  children: React.ReactNode;
  tokens: BattleshipTokens;
}

export function BoardCard({ children, tokens }: BoardCardProps) {
  return (
    <View
      style={[
        styles.boardCard,
        {
          backgroundColor: tokens.boardCardBg,
          borderColor: tokens.boardStroke,
          ...BS.elevation.md,
        },
      ]}
    >
      {children}
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  // BoardCard
  boardCard: {
    borderRadius: BS.radius.md,
    borderWidth: 1,
    padding: BS.gridPadding,
    marginHorizontal: BS.spacing.lg,
    marginVertical: BS.spacing.sm,
    overflow: "hidden",
  },

  // Grid
  gridWrapper: {
    alignItems: "center",
  },
  gridLabel: {
    marginBottom: BS.spacing.xs,
    textAlign: "center",
  },
  colHeaderRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  colHeaderCell: {
    justifyContent: "center",
    alignItems: "center",
    height: 18,
  },
  coordText: {
    fontSize: 10,
    fontWeight: "600",
    fontFamily: Platform.select({
      ios: "Menlo",
      android: "monospace",
      default: "monospace",
    }),
  },
  rowLabelCell: {
    justifyContent: "center",
    alignItems: "center",
  },
  gridRow: {
    flexDirection: "row",
  },
  cell: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0.5,
    borderRadius: 2,
    margin: 0.5,
    overflow: "hidden",
  },
});
