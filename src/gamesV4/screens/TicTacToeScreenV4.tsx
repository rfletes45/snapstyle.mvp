/**
 * Games V4 — Tic-Tac-Toe Game Screen (Polished)
 *
 * A premium, mobile-first Tic-Tac-Toe experience featuring:
 * - SVG-rendered X and O marks with entrance animations
 * - Animated winning line overlay
 * - Last-move emphasis ring
 * - Haptic feedback on valid moves, wins, and draws
 * - Shared TurnStatusCard / BoardTray / InlineNotice components
 * - Full safe-area awareness
 * - Animations via core RN Animated API (native-driver safe)
 *
 * All game logic, move submission, session lifecycle, and navigation remain
 * unchanged — only visual and interaction polish is applied.
 *
 * @module gamesV4/screens/TicTacToeScreenV4
 */

import {
  GameShellProps,
  withGameV4Shell,
} from "@/gamesV4/components/GameScreenShell";
import {
  BoardTray,
  InlineNotice,
  TurnStatusCard,
} from "@/gamesV4/components/turnBased";
import type { PlayerChipProps } from "@/gamesV4/components/turnBased/PlayerChip";
import { useAppTheme } from "@/store/ThemeContext";
import * as Haptics from "@/utils/haptics";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Svg, { Circle, Line } from "react-native-svg";

// =============================================================================
// Types
// =============================================================================

type Cell = "X" | "O" | null;
type Board = Cell[][];

const EMPTY_BOARD: Board = Array.from({ length: 3 }, () =>
  Array.from({ length: 3 }, () => null),
);

// =============================================================================
// Winning lines (mirrored from adapter for client-side highlighting)
// =============================================================================

const WINNING_LINES: Array<Array<[number, number]>> = [
  [
    [0, 0],
    [0, 1],
    [0, 2],
  ],
  [
    [1, 0],
    [1, 1],
    [1, 2],
  ],
  [
    [2, 0],
    [2, 1],
    [2, 2],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
  ],
  [
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  [
    [0, 2],
    [1, 2],
    [2, 2],
  ],
  [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  [
    [0, 2],
    [1, 1],
    [2, 0],
  ],
];

function findWinLine(
  board: Board,
): { mark: Cell; cells: Array<[number, number]> } | null {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line;
    const cellA = board[a[0]][a[1]];
    if (cellA && cellA === board[b[0]][b[1]] && cellA === board[c[0]][c[1]]) {
      return { mark: cellA, cells: line };
    }
  }
  return null;
}

function isBoardFull(board: Board): boolean {
  return board.every((row) => row.every((cell) => cell !== null));
}

// =============================================================================
// Color palette
// =============================================================================

const MARK_COLORS = {
  X: "#FF4C6A", // warm red-pink
  O: "#4C9AFF", // cool blue
} as const;

const WIN_LINE_COLOR = "#FFD700"; // gold

// =============================================================================
// Dimensions
// =============================================================================

const SCREEN_WIDTH = Dimensions.get("window").width;
const MAX_BOARD_SIZE = Math.min(SCREEN_WIDTH - 48, 340);
const CELL_SIZE = Math.floor(MAX_BOARD_SIZE / 3);
const BOARD_SIZE = CELL_SIZE * 3;
const MARK_INSET = Math.floor(CELL_SIZE * 0.2);
const MARK_SIZE = CELL_SIZE - MARK_INSET * 2;

// =============================================================================
// Animated Mark Components
// =============================================================================

/** Animated X mark using SVG lines with a scale entrance.
 *  Uses core RN Animated API (not reanimated) for reliable native animation. */
function AnimatedX({
  size,
  color,
  animate,
}: {
  size: number;
  color: string;
  animate: boolean;
}) {
  const progress = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const pad = size * 0.15;
  const sw = Math.max(3, size * 0.08);

  useEffect(() => {
    if (animate) {
      Animated.timing(progress, {
        toValue: 1,
        duration: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animOpacity = animate ? progress : 1;
  const animScale = animate
    ? progress.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] })
    : 1;

  return (
    <Animated.View
      style={[
        { width: size, height: size },
        { opacity: animOpacity, transform: [{ scale: animScale }] },
      ]}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Line
          x1={pad}
          y1={pad}
          x2={size - pad}
          y2={size - pad}
          stroke={color}
          strokeWidth={sw}
          strokeLinecap="round"
        />
        <Line
          x1={size - pad}
          y1={pad}
          x2={pad}
          y2={size - pad}
          stroke={color}
          strokeWidth={sw}
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
}

/** Animated O mark — circle with a spring-scale entrance.
 *  Uses core RN Animated API (not reanimated) for reliable native animation. */
function AnimatedO({
  size,
  color,
  animate,
}: {
  size: number;
  color: string;
  animate: boolean;
}) {
  const progress = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const radius = size * 0.35;
  const sw = Math.max(3, size * 0.08);

  useEffect(() => {
    if (animate) {
      Animated.spring(progress, {
        toValue: 1,
        stiffness: 180,
        damping: 12,
        mass: 1,
        useNativeDriver: true,
      }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animOpacity = animate ? progress : 1;
  const animScale = animate
    ? progress.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] })
    : 1;

  return (
    <Animated.View
      style={[
        { width: size, height: size },
        { opacity: animOpacity, transform: [{ scale: animScale }] },
      ]}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={sw}
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}

/** Simple fade-in wrapper using core RN Animated (replaces reanimated FadeIn). */
function FadeInView({
  delay = 0,
  duration = 300,
  style,
  children,
  ...rest
}: React.ComponentProps<typeof View> & { delay?: number; duration?: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Animated.View style={[style, { opacity }]} {...rest}>
      {children}
    </Animated.View>
  );
}

// =============================================================================
// Board Cell
// =============================================================================

interface CellProps {
  cell: Cell;
  row: number;
  col: number;
  isLastMove: boolean;
  isWinCell: boolean;
  isMyTurn: boolean;
  isTerminal: boolean;
  isDark: boolean;
  onPress: (row: number, col: number) => void;
  isNewMove: boolean;
}

function TicTacToeCell({
  cell,
  row,
  col,
  isLastMove,
  isWinCell,
  isMyTurn,
  isTerminal,
  isDark,
  onPress,
  isNewMove,
}: CellProps) {
  const canTap = !isTerminal && isMyTurn && cell === null;

  // Last-move ring pulse (core RN Animated)
  const pulseScale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (isLastMove && isNewMove) {
      Animated.sequence([
        Animated.spring(pulseScale, {
          toValue: 1.08,
          stiffness: 200,
          damping: 6,
          mass: 1,
          useNativeDriver: true,
        }),
        Animated.spring(pulseScale, {
          toValue: 1,
          stiffness: 150,
          damping: 10,
          mass: 1,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isLastMove, isNewMove, pulseScale]);

  const pulseStyle = { transform: [{ scale: pulseScale }] };

  // Cell background — win cells glow gold, last-move gets a subtle mark-colour tint
  const bgColor = isWinCell
    ? isDark
      ? "rgba(255, 215, 0, 0.12)"
      : "rgba(255, 215, 0, 0.10)"
    : isLastMove && cell
      ? isDark
        ? `${MARK_COLORS[cell]}18` // ~9 % opacity
        : `${MARK_COLORS[cell]}0F` // ~6 % opacity
      : canTap
        ? isDark
          ? "rgba(255,255,255,0.03)"
          : "rgba(0,0,0,0.015)"
        : "transparent";

  // Border styling for grid lines
  const borderStyle = {
    borderRightWidth: col < 2 ? 2 : 0,
    borderBottomWidth: row < 2 ? 2 : 0,
    borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)",
  };

  return (
    <Pressable
      onPress={() => onPress(row, col)}
      disabled={!canTap}
      style={({ pressed }) => [
        styles.cell,
        { width: CELL_SIZE, height: CELL_SIZE },
        borderStyle,
        {
          backgroundColor:
            pressed && canTap
              ? isDark
                ? "rgba(255,255,255,0.08)"
                : "rgba(0,0,0,0.04)"
              : bgColor,
        },
      ]}
      accessibilityLabel={
        cell
          ? `${cell} at row ${row + 1}, column ${col + 1}`
          : `Empty cell, row ${row + 1}, column ${col + 1}`
      }
      accessibilityRole="button"
      accessibilityState={{ disabled: !canTap }}
    >
      <Animated.View style={pulseStyle}>
        {/* Mark */}
        {cell === "X" && (
          <AnimatedX
            size={MARK_SIZE}
            color={MARK_COLORS.X}
            animate={isNewMove}
          />
        )}
        {cell === "O" && (
          <AnimatedO
            size={MARK_SIZE}
            color={MARK_COLORS.O}
            animate={isNewMove}
          />
        )}

        {/* Empty tappable indicator */}
        {cell === null && canTap && (
          <View
            style={[
              styles.emptyDot,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(0,0,0,0.04)",
              },
            ]}
          />
        )}
      </Animated.View>
    </Pressable>
  );
}

// =============================================================================
// Winning Line Overlay
// =============================================================================

function WinLineOverlay({
  cells,
  isDark,
}: {
  cells: Array<[number, number]>;
  isDark: boolean;
}) {
  const [r0, c0] = cells[0];
  const [r2, c2] = cells[2];
  const x1 = c0 * CELL_SIZE + CELL_SIZE / 2;
  const y1 = r0 * CELL_SIZE + CELL_SIZE / 2;
  const x2 = c2 * CELL_SIZE + CELL_SIZE / 2;
  const y2 = r2 * CELL_SIZE + CELL_SIZE / 2;

  const winOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(winOpacity, {
      toValue: 1,
      duration: 350,
      delay: 150,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={[styles.winOverlay, { opacity: winOpacity }]}
      pointerEvents="none"
    >
      <Svg width={BOARD_SIZE} height={BOARD_SIZE}>
        <Line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={WIN_LINE_COLOR}
          strokeWidth={5}
          strokeLinecap="round"
          opacity={isDark ? 0.85 : 0.75}
        />
      </Svg>
    </Animated.View>
  );
}

// =============================================================================
// Main UI Component
// =============================================================================

function TicTacToeUI({
  publicState,
  isMyTurn,
  isTerminal,
  myUid,
  turnOrder,
  players,
  submitMove,
  actionLoading,
}: GameShellProps) {
  const { theme } = useAppTheme();
  const isDark = theme.isDark;
  const board: Board = (publicState?.board as Board) ?? EMPTY_BOARD;
  const moveCount = (publicState?.moveCount as number) ?? 0;

  // Player identity
  const mySymbol: "X" | "O" = turnOrder[0] === myUid ? "X" : "O";
  const oppSymbol: "X" | "O" = mySymbol === "X" ? "O" : "X";

  // ---------- Synchronous new-move detection ----------
  // Using refs ensures the "new move" flag is available in the SAME render
  // cycle where the board state changes, preventing the one-frame flash
  // (mark appears at full opacity before the animation can start) that
  // broke mobile animations. useEffect-based detection lags by one render
  // because it fires AFTER React commits; on native each commit is a visible
  // frame, so the intermediate "already at full size" state was visible.
  const knownBoardRef = useRef<Board | null>(null);
  const knownMoveCountRef = useRef<number | null>(null);
  const lastMoveRef = useRef<{ row: number; col: number } | null>(null);

  // First render: snapshot current board — existing cells are not "new"
  if (knownBoardRef.current === null) {
    knownBoardRef.current = board.map((r) => [...r]);
    knownMoveCountRef.current = moveCount;
  }

  // Detect newly placed cell by diffing board against known snapshot
  let newCellKey: string | null = null;
  if (moveCount > knownMoveCountRef.current!) {
    const known = knownBoardRef.current!;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (known[r][c] === null && board[r][c] !== null) {
          newCellKey = `${r}-${c}`;
          lastMoveRef.current = { row: r, col: c };
        }
      }
    }
    knownBoardRef.current = board.map((r) => [...r]);
    knownMoveCountRef.current = moveCount;
  }

  const lastMove = lastMoveRef.current;

  // Win detection
  const winResult = useMemo(() => findWinLine(board), [board]);
  const isDraw = useMemo(
    () => !winResult && isBoardFull(board),
    [winResult, board],
  );
  const winCellSet = useMemo(() => {
    if (!winResult) return new Set<string>();
    return new Set(winResult.cells.map(([r, c]) => `${r}-${c}`));
  }, [winResult]);

  // Status copy
  const getStatusText = useCallback((): string => {
    if (isTerminal) {
      if (winResult) {
        return winResult.mark === mySymbol ? "You won!" : "You lost";
      }
      return "Draw — board filled";
    }
    if (isMyTurn) return `Your turn — place ${mySymbol}`;
    return "Waiting for opponent…";
  }, [isTerminal, isMyTurn, winResult, mySymbol]);

  const getStatusColor = useCallback((): string | undefined => {
    if (!isTerminal) return undefined;
    if (winResult) {
      return winResult.mark === mySymbol ? "#34C759" : "#FF3B30";
    }
    return isDark ? "#AAA" : "#888";
  }, [isTerminal, winResult, mySymbol, isDark]);

  // Cell press handler
  const handlePress = useCallback(
    async (row: number, col: number) => {
      if (
        !isMyTurn ||
        board[row][col] !== null ||
        isTerminal ||
        actionLoading
      ) {
        return;
      }
      Haptics.light();
      await submitMove({ row, col });
    },
    [isMyTurn, board, isTerminal, actionLoading, submitMove],
  );

  // Terminal haptic (fire once)
  const terminalHapticFired = useRef(false);
  useEffect(() => {
    if (isTerminal && !terminalHapticFired.current) {
      terminalHapticFired.current = true;
      if (winResult) {
        if (winResult.mark === mySymbol) {
          Haptics.success();
        } else {
          Haptics.medium();
        }
      } else {
        Haptics.light();
      }
    }
  }, [isTerminal, winResult, mySymbol]);

  // Resolve player metadata from session
  const opponentUid = turnOrder.find((uid) => uid !== myUid) ?? "";
  const mySlot = players.find((p) => p.uid === myUid);
  const oppSlot = players.find((p) => p.uid === opponentUid);

  // Player chip configs
  const localChip: PlayerChipProps = {
    displayName: mySlot?.displayName || "You",
    markLabel: mySymbol,
    markColor: MARK_COLORS[mySymbol],
    isActive: isMyTurn && !isTerminal,
    isLocal: true,
    avatarUrl: mySlot?.profilePictureUrl,
  };
  const opponentChip: PlayerChipProps = {
    displayName: oppSlot?.displayName || "Opponent",
    markLabel: oppSymbol,
    markColor: MARK_COLORS[oppSymbol],
    isActive: !isMyTurn && !isTerminal,
    avatarUrl: oppSlot?.profilePictureUrl,
  };

  // Inline notice state
  const [notice, setNotice] = useState<string | null>(null);

  const gameBg = isDark ? "#0A0A0A" : theme.colors.background;

  return (
    <View style={[styles.container, { backgroundColor: gameBg }]}>
      {/* Status card */}
      <TurnStatusCard
        statusText={getStatusText()}
        localPlayer={localChip}
        opponentPlayer={opponentChip}
        isLocalTurn={isMyTurn}
        isTerminal={isTerminal}
        statusColor={getStatusColor()}
      />

      {/* Board */}
      <View style={styles.boardArea}>
        <BoardTray padding={8}>
          <View style={{ width: BOARD_SIZE, height: BOARD_SIZE }}>
            <View style={styles.gridContainer}>
              {board.map((row, r) =>
                row.map((cell, c) => {
                  const cellId = `${r}-${c}`;
                  const isCellLastMove =
                    lastMove !== null &&
                    lastMove.row === r &&
                    lastMove.col === c;
                  return (
                    <TicTacToeCell
                      key={cellId}
                      cell={cell}
                      row={r}
                      col={c}
                      isLastMove={isCellLastMove}
                      isWinCell={winCellSet.has(cellId)}
                      isMyTurn={isMyTurn}
                      isTerminal={isTerminal}
                      isDark={isDark}
                      onPress={handlePress}
                      isNewMove={newCellKey === cellId}
                    />
                  );
                }),
              )}
            </View>

            {/* Win line overlay */}
            {winResult && (
              <WinLineOverlay cells={winResult.cells} isDark={isDark} />
            )}

            {/* Draw overlay — soft whole-board emphasis */}
            {isDraw && isTerminal && (
              <FadeInView
                delay={200}
                duration={400}
                style={[
                  styles.drawOverlay,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.04)"
                      : "rgba(0,0,0,0.03)",
                  },
                ]}
                pointerEvents="none"
              />
            )}
          </View>
        </BoardTray>
      </View>

      {/* Inline notice area */}
      {notice && (
        <InlineNotice
          message={notice}
          severity="warning"
          dismissAfterMs={2500}
          onDismiss={() => setNotice(null)}
        />
      )}
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    paddingTop: 12,
    gap: 16,
  },
  boardArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 24,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: BOARD_SIZE,
    height: BOARD_SIZE,
  },
  cell: {
    justifyContent: "center",
    alignItems: "center",
  },

  emptyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  winOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  drawOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
  },
});

export default withGameV4Shell(TicTacToeUI, "tic_tac_toe");
