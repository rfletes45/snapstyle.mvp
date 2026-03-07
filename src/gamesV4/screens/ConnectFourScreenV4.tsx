/**
 * Games V4 — Connect Four Game Screen (Polished)
 *
 * A tactile, dramatic Connect Four experience featuring:
 * - Column drop rail with ghost-disc preview
 * - Gravity-based disc drop animation with settle bounce
 * - Winning four highlight with connective accent
 * - Full-column visual feedback
 * - Haptic feedback on selection, drop, and win
 * - Shared TurnStatusCard / BoardTray / InlineNotice components
 * - Responsive layout for narrow phones and larger devices
 * - Safe-area aware, mobile-first
 *
 * All game logic, move submission, session lifecycle, and navigation remain
 * unchanged — only visual and interaction polish is applied.
 *
 * @module gamesV4/screens/ConnectFourScreenV4
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
  Text,
  View,
} from "react-native";
import Svg, { Line as SvgLine } from "react-native-svg";

// =============================================================================
// Constants
// =============================================================================

const ROWS = 6;
const COLS = 7;

const SCREEN_WIDTH = Dimensions.get("window").width;
// Responsive cell sizing: fit 7 cols + padding + gaps within screen width
const MAX_BOARD_WIDTH = Math.min(SCREEN_WIDTH - 32, 380);
const CELL_GAP = 3;
const CELL_SIZE = Math.floor((MAX_BOARD_WIDTH - (COLS + 1) * CELL_GAP) / COLS);
const DISC_SIZE = CELL_SIZE - 4;
const BOARD_WIDTH = COLS * CELL_SIZE + (COLS + 1) * CELL_GAP;
const BOARD_HEIGHT = ROWS * CELL_SIZE + (ROWS + 1) * CELL_GAP;

/** 0 = empty, 1 = player 1 (red), 2 = player 2 (yellow) */
type CellVal = 0 | 1 | 2;
type Board = CellVal[][];

// =============================================================================
// Color palette
// =============================================================================

const PLAYER_COLORS: Record<1 | 2, string> = {
  1: "#FF4C6A", // warm red-pink (matches TTT X)
  2: "#FFCC44", // warm yellow
};

const PLAYER_LABELS: Record<1 | 2, string> = {
  1: "Red",
  2: "Yellow",
};

const WIN_ACCENT = "#FFD700";

// =============================================================================
// Win detection (client-side for highlighting)
// =============================================================================

function findWinCells(board: Board): Array<[number, number]> | null {
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const val = board[r][c];
      if (val === 0) continue;
      for (const [dr, dc] of dirs) {
        const cells: Array<[number, number]> = [[r, c]];
        for (let i = 1; i < 4; i++) {
          const nr = r + dr * i;
          const nc = c + dc * i;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break;
          if (board[nr][nc] !== val) break;
          cells.push([nr, nc]);
        }
        if (cells.length === 4) return cells;
      }
    }
  }
  return null;
}

function isBoardFull(board: Board): boolean {
  return board[0].every((cell) => cell !== 0);
}

function isColumnFull(board: Board, col: number): boolean {
  return board[0][col] !== 0;
}

// =============================================================================
// Ghost Disc (preview before dropping)
// =============================================================================

function GhostDisc({ color, size }: { color: string; size: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 0.35,
      duration: 120,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Animated.View
      style={[
        styles.ghostDisc,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity,
        },
      ]}
    />
  );
}

// =============================================================================
// Individual Disc with Drop Animation
// =============================================================================

interface DiscProps {
  value: CellVal;
  isLastMove: boolean;
  isWinCell: boolean;
  isNewDrop: boolean;
  isDark: boolean;
}

function Disc({ value, isLastMove, isWinCell, isNewDrop, isDark }: DiscProps) {
  const scale = useRef(new Animated.Value(isNewDrop ? 0.6 : 1)).current;

  useEffect(() => {
    if (isNewDrop) {
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.08,
          duration: 150,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          stiffness: 200,
          damping: 8,
          mass: 1,
          useNativeDriver: true,
        }),
      ]).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animStyle = { transform: [{ scale }] };

  if (value === 0) {
    return (
      <View
        style={[
          styles.emptySlot,
          {
            width: DISC_SIZE,
            height: DISC_SIZE,
            borderRadius: DISC_SIZE / 2,
            backgroundColor: isDark
              ? "rgba(0,0,0,0.5)"
              : "rgba(255,255,255,0.85)",
          },
        ]}
      />
    );
  }

  const discColor = PLAYER_COLORS[value as 1 | 2];

  return (
    <Animated.View style={animStyle}>
      <View
        style={[
          styles.disc,
          {
            width: DISC_SIZE,
            height: DISC_SIZE,
            borderRadius: DISC_SIZE / 2,
            backgroundColor: discColor,
          },
          isWinCell && {
            borderWidth: 3,
            borderColor: WIN_ACCENT,
          },
          isLastMove &&
            !isWinCell && {
              borderWidth: 2,
              borderColor: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.3)",
            },
        ]}
      >
        {/* Inner highlight for depth */}
        <View
          style={[
            styles.discHighlight,
            {
              width: DISC_SIZE * 0.55,
              height: DISC_SIZE * 0.55,
              borderRadius: (DISC_SIZE * 0.55) / 2,
            },
          ]}
        />
      </View>
    </Animated.View>
  );
}

// =============================================================================
// Win Line Overlay for Connect Four
// =============================================================================

function C4WinOverlay({ cells }: { cells: Array<[number, number]> }) {
  if (cells.length < 2) return null;

  const [r0, c0] = cells[0];
  const [rN, cN] = cells[cells.length - 1];

  // Calculate pixel positions (center of each cell)
  const halfCell = CELL_SIZE / 2;
  const x1 = CELL_GAP + c0 * (CELL_SIZE + CELL_GAP) + halfCell;
  const y1 = CELL_GAP + r0 * (CELL_SIZE + CELL_GAP) + halfCell;
  const x2 = CELL_GAP + cN * (CELL_SIZE + CELL_GAP) + halfCell;
  const y2 = CELL_GAP + rN * (CELL_SIZE + CELL_GAP) + halfCell;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const opacity = useRef(new Animated.Value(0)).current;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 350,
      delay: 150,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={[styles.winOverlay, { opacity }]}
      pointerEvents="none"
    >
      <Svg width={BOARD_WIDTH} height={BOARD_HEIGHT}>
        <SvgLine
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={WIN_ACCENT}
          strokeWidth={4}
          strokeLinecap="round"
          opacity={0.7}
        />
      </Svg>
    </Animated.View>
  );
}

// =============================================================================
// Drop Rail Component
// =============================================================================

interface DropRailProps {
  board: Board;
  selectedCol: number | null;
  myPlayerNumber: 1 | 2;
  isMyTurn: boolean;
  isTerminal: boolean;
  actionLoading: boolean;
  isDark: boolean;
  onColumnPress: (col: number) => void;
  onColumnHover: (col: number | null) => void;
}

function DropRail({
  board,
  selectedCol,
  myPlayerNumber,
  isMyTurn,
  isTerminal,
  actionLoading,
  isDark,
  onColumnPress,
  onColumnHover,
}: DropRailProps) {
  const canAct = isMyTurn && !isTerminal && !actionLoading;
  const myColor = PLAYER_COLORS[myPlayerNumber];

  return (
    <View style={styles.dropRail}>
      {Array.from({ length: COLS }).map((_, col) => {
        const colFull = isColumnFull(board, col);
        const isSelected = selectedCol === col;
        const disabled = !canAct || colFull;

        return (
          <Pressable
            key={col}
            onPress={() => onColumnPress(col)}
            onPressIn={() => !disabled && onColumnHover(col)}
            onPressOut={() => onColumnHover(null)}
            disabled={disabled}
            style={({ pressed }) => [
              styles.dropTarget,
              {
                width: CELL_SIZE + CELL_GAP,
                height: CELL_SIZE + 8,
              },
              pressed && !disabled && styles.dropTargetPressed,
            ]}
            accessibilityLabel={
              colFull ? `Column ${col + 1}, full` : `Drop in column ${col + 1}`
            }
            accessibilityRole="button"
            accessibilityState={{ disabled }}
          >
            {/* Ghost preview disc */}
            {isSelected && !colFull && canAct && (
              <GhostDisc color={myColor} size={DISC_SIZE * 0.8} />
            )}

            {/* Down arrow indicator */}
            {!colFull && canAct && !isSelected && (
              <Text
                style={[
                  styles.dropArrow,
                  {
                    color: isDark
                      ? "rgba(255,255,255,0.2)"
                      : "rgba(0,0,0,0.15)",
                  },
                ]}
              >
                ▼
              </Text>
            )}

            {/* Full column indicator */}
            {colFull && (
              <View
                style={[
                  styles.fullIndicator,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.08)"
                      : "rgba(0,0,0,0.05)",
                  },
                ]}
              />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

// =============================================================================
// Main UI Component
// =============================================================================

function ConnectFourUI({
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

  const board: Board =
    (publicState?.board as Board) ??
    Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  const moveCount = (publicState?.moveCount as number) ?? 0;
  const serverLastMove = publicState?.lastMove as {
    row: number;
    col: number;
  } | null;

  const myPlayerNumber: 1 | 2 = turnOrder[0] === myUid ? 1 : 2;
  const oppPlayerNumber: 1 | 2 = myPlayerNumber === 1 ? 2 : 1;

  // ---------- Synchronous new-drop detection ----------
  // Using refs ensures the "new drop" flag is available in the SAME render
  // cycle where the board state changes, preventing the one-frame flash
  // (disc appears at full size before animation starts) that broke mobile
  // animations. useEffect-based detection lags by one render because it
  // fires AFTER React commits; on native each commit is a visible frame.
  const knownMoveCountRef = useRef<number | null>(null);
  const lastDropCellRef = useRef<{ row: number; col: number } | null>(null);

  // First render: snapshot current moveCount — existing discs are not "new"
  if (knownMoveCountRef.current === null) {
    knownMoveCountRef.current = moveCount;
  }

  // Detect whether THIS render contains a brand-new drop
  let isNewDropThisRender = false;
  if (moveCount > knownMoveCountRef.current && serverLastMove) {
    lastDropCellRef.current = serverLastMove;
    isNewDropThisRender = true;
    knownMoveCountRef.current = moveCount;
  } else if (moveCount > knownMoveCountRef.current) {
    knownMoveCountRef.current = moveCount;
  }

  const lastDropCell = lastDropCellRef.current;

  // Win detection
  const winCells = useMemo(() => findWinCells(board), [board]);
  const isDraw = useMemo(
    () => !winCells && isBoardFull(board),
    [winCells, board],
  );
  const winCellSet = useMemo(() => {
    if (!winCells) return new Set<string>();
    return new Set(winCells.map(([r, c]) => `${r}-${c}`));
  }, [winCells]);

  // Selected column for preview
  const [selectedCol, setSelectedCol] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Status text
  const getStatusText = useCallback((): string => {
    if (isTerminal) {
      if (winCells) {
        const winVal = board[winCells[0][0]][winCells[0][1]];
        const iWon = winVal === myPlayerNumber;
        return iWon ? "You won!" : "You lost";
      }
      return "Draw — board filled";
    }
    if (isMyTurn) return "Your turn — tap a column";
    return "Waiting for opponent…";
  }, [isTerminal, isMyTurn, winCells, board, myPlayerNumber]);

  const getStatusColor = useCallback((): string | undefined => {
    if (!isTerminal) return undefined;
    if (winCells) {
      const winVal = board[winCells[0][0]][winCells[0][1]];
      return winVal === myPlayerNumber ? "#34C759" : "#FF3B30";
    }
    return isDark ? "#AAA" : "#888";
  }, [isTerminal, winCells, board, myPlayerNumber, isDark]);

  // Column press handler
  const handleColumnPress = useCallback(
    async (col: number) => {
      if (!isMyTurn || isTerminal || actionLoading) return;
      if (isColumnFull(board, col)) {
        setNotice("Column is full");
        Haptics.warning();
        return;
      }
      Haptics.medium();
      setSelectedCol(null);
      await submitMove({ col });
    },
    [isMyTurn, isTerminal, actionLoading, board, submitMove],
  );

  const handleColumnHover = useCallback((col: number | null) => {
    setSelectedCol(col);
    if (col !== null) {
      Haptics.selection();
    }
  }, []);

  // Terminal haptic
  const terminalHapticFired = useRef(false);
  useEffect(() => {
    if (isTerminal && !terminalHapticFired.current) {
      terminalHapticFired.current = true;
      if (winCells) {
        const winVal = board[winCells[0][0]][winCells[0][1]];
        if (winVal === myPlayerNumber) {
          Haptics.success();
        } else {
          Haptics.medium();
        }
      } else {
        Haptics.light();
      }
    }
  }, [isTerminal, winCells, board, myPlayerNumber]);

  // Resolve player metadata from session
  const opponentUid = turnOrder.find((uid) => uid !== myUid) ?? "";
  const mySlot = players.find((p) => p.uid === myUid);
  const oppSlot = players.find((p) => p.uid === opponentUid);

  // Player chip configs
  const localChip: PlayerChipProps = {
    displayName: mySlot?.displayName || "You",
    markLabel: PLAYER_LABELS[myPlayerNumber][0],
    markColor: PLAYER_COLORS[myPlayerNumber],
    isActive: isMyTurn && !isTerminal,
    isLocal: true,
    avatarUrl: mySlot?.profilePictureUrl,
  };
  const opponentChip: PlayerChipProps = {
    displayName: oppSlot?.displayName || "Opponent",
    markLabel: PLAYER_LABELS[oppPlayerNumber][0],
    markColor: PLAYER_COLORS[oppPlayerNumber],
    isActive: !isMyTurn && !isTerminal,
    avatarUrl: oppSlot?.profilePictureUrl,
  };

  // Board surface colors
  const boardBg = isDark ? "#1A237E" : "#1565C0";
  const gameBg = isDark ? "#0A0A0A" : theme.colors.background;

  return (
    <View style={[styles.container, { backgroundColor: gameBg }]}>
      {/* Status card */}
      <TurnStatusCard
        statusText={getStatusText()}
        subtitle={
          !isTerminal && isMyTurn
            ? `Playing as ${PLAYER_LABELS[myPlayerNumber]}`
            : undefined
        }
        localPlayer={localChip}
        opponentPlayer={opponentChip}
        isLocalTurn={isMyTurn}
        isTerminal={isTerminal}
        statusColor={getStatusColor()}
      />

      {/* Board area */}
      <View style={styles.boardArea}>
        {/* Drop rail */}
        <DropRail
          board={board}
          selectedCol={selectedCol}
          myPlayerNumber={myPlayerNumber}
          isMyTurn={isMyTurn}
          isTerminal={isTerminal}
          actionLoading={actionLoading}
          isDark={isDark}
          onColumnPress={handleColumnPress}
          onColumnHover={handleColumnHover}
        />

        {/* Board frame */}
        <BoardTray backgroundColor={boardBg} padding={CELL_GAP}>
          <View style={{ width: BOARD_WIDTH, height: BOARD_HEIGHT }}>
            {/* Grid */}
            {board.map((row, r) => (
              <View key={r} style={styles.row}>
                {row.map((cell, c) => {
                  const isLast =
                    lastDropCell !== null &&
                    lastDropCell.row === r &&
                    lastDropCell.col === c;
                  const isWin = winCellSet.has(`${r}-${c}`);
                  // Cell-value key: Disc remounts when cell transitions
                  // from empty (0) to occupied, triggering the drop animation
                  // on mount instead of mid-lifecycle.
                  const isCellNewDrop = isNewDropThisRender && isLast;

                  return (
                    <View
                      key={c}
                      style={[
                        styles.cellSlot,
                        {
                          width: CELL_SIZE,
                          height: CELL_SIZE,
                          margin: CELL_GAP / 2,
                        },
                      ]}
                    >
                      <Disc
                        key={cell === 0 ? `e-${r}-${c}` : `d-${r}-${c}`}
                        value={cell}
                        isLastMove={isLast}
                        isWinCell={isWin}
                        isNewDrop={isCellNewDrop}
                        isDark={isDark}
                      />
                    </View>
                  );
                })}
              </View>
            ))}

            {/* Win line overlay */}
            {winCells && <C4WinOverlay cells={winCells} />}
          </View>
        </BoardTray>
      </View>

      {/* Inline notice */}
      {notice && (
        <InlineNotice
          message={notice}
          severity="warning"
          dismissAfterMs={2000}
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
    gap: 8,
  },
  boardArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 16,
    gap: 2,
  },
  // Drop rail
  dropRail: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: CELL_GAP,
  },
  dropTarget: {
    justifyContent: "center",
    alignItems: "center",
  },
  dropTargetPressed: {
    opacity: 0.7,
  },
  dropArrow: {
    fontSize: 14,
    fontWeight: "700",
  },
  ghostDisc: {
    // sized dynamically
  },
  fullIndicator: {
    width: 16,
    height: 3,
    borderRadius: 1.5,
  },
  // Board grid
  row: {
    flexDirection: "row",
  },
  cellSlot: {
    justifyContent: "center",
    alignItems: "center",
  },
  emptySlot: {
    // sized dynamically
  },
  disc: {
    justifyContent: "center",
    alignItems: "center",
    // shadow for depth
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  discHighlight: {
    backgroundColor: "rgba(255,255,255,0.2)",
    position: "absolute",
    top: 3,
    left: 3,
  },
  winOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
  },
});

export default withGameV4Shell(ConnectFourUI, "connect_four");
