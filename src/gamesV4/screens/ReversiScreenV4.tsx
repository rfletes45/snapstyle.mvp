/**
 * Games V4 — Reversi Game Screen (Premium Polish)
 *
 * A premium, board-first Reversi / Othello experience featuring:
 * - Board-hero layout with intentional visual hierarchy
 * - Dimensional disc rendering with inner highlight + depth
 * - Staggered flip animations cascading from placed piece
 * - Subtle corner cell accents for strategic emphasis
 * - Polished pass-turn UX with clear messaging and icon
 * - Compact score card with disc icons
 * - Legal move indicator dots calibrated for visibility
 * - Last-move golden ring highlight
 * - Haptic feedback on valid moves, flips, pass, wins, and draws
 * - Shared TurnStatusCard / BoardTray / InlineNotice components
 * - Full safe-area awareness via GameScreenShell
 * - Animations via core RN Animated API (native-driver safe)
 *
 * @module gamesV4/screens/ReversiScreenV4
 */

import { BorderRadius, Elevation, Spacing } from "@/constants/theme";
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
import { MaterialCommunityIcons } from "@expo/vector-icons";
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
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

// =============================================================================
// Types
// =============================================================================

type Disc = "B" | "W" | null;
type Board = Disc[][];

const SIZE = 8;

const EMPTY_BOARD: Board = Array.from({ length: SIZE }, () =>
  Array.from({ length: SIZE }, () => null),
);

// =============================================================================
// Color palette — refined for premium feel
// =============================================================================

/** Disc fill colors */
const DISC_COLORS = {
  B: "#1A1A2E",
  W: "#F0F0EA",
} as const;

/** Disc border for subtle edge */
const DISC_BORDER = {
  B: "#2A2A48",
  W: "#C8C8BB",
} as const;

/** Inner highlight for dimensional depth */
const DISC_HIGHLIGHT = {
  B: "rgba(255,255,255,0.07)",
  W: "rgba(255,255,255,0.55)",
} as const;

const LEGAL_DOT_COLOR = "rgba(100, 200, 120, 0.50)";
const LAST_MOVE_RING = "#FFD54F";
const BOARD_BG_DARK = "#1B5E20";
const BOARD_BG_LIGHT = "#2E7D32";
const BOARD_FRAME_DARK = "#0D3B12";
const BOARD_FRAME_LIGHT = "#1B5E20";
const CELL_BORDER_DARK = "rgba(0,0,0,0.30)";
const CELL_BORDER_LIGHT = "rgba(0,0,0,0.18)";
const CORNER_HINT_DARK = "rgba(255,215,0,0.05)";
const CORNER_HINT_LIGHT = "rgba(255,215,0,0.07)";

// =============================================================================
// Dimensions
// =============================================================================

const SCREEN_WIDTH = Dimensions.get("window").width;
const BOARD_PADDING = 6;
const MAX_BOARD_SIZE = Math.min(SCREEN_WIDTH - 32, 400);
const CELL_SIZE = Math.floor(MAX_BOARD_SIZE / SIZE);
const BOARD_PX = CELL_SIZE * SIZE;
const DISC_INSET = Math.floor(CELL_SIZE * 0.1);
const DISC_SIZE = CELL_SIZE - DISC_INSET * 2;
const HIGHLIGHT_SIZE = Math.floor(DISC_SIZE * 0.42);

/** Strategic corner cell positions */
const CORNER_CELLS = new Set(["0-0", "0-7", "7-0", "7-7"]);

// =============================================================================
// Animated Disc — with inner highlight and stagger support
// =============================================================================

interface AnimatedDiscProps {
  color: "B" | "W";
  animate: boolean;
  isFlip: boolean;
  staggerMs?: number;
}

function AnimatedDisc({
  color,
  animate,
  isFlip,
  staggerMs = 0,
}: AnimatedDiscProps) {
  const progress = useRef(new Animated.Value(animate ? 0 : 1)).current;

  useEffect(() => {
    if (animate) {
      const runAnim = () => {
        Animated.timing(progress, {
          toValue: 1,
          duration: isFlip ? 260 : 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      };
      if (staggerMs > 0) {
        const timer = setTimeout(runAnim, staggerMs);
        return () => clearTimeout(timer);
      }
      runAnim();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animOpacity = animate ? progress : 1;
  const animScale = animate
    ? progress.interpolate({
        inputRange: [0, 1],
        outputRange: isFlip ? [0.75, 1] : [0.35, 1],
      })
    : 1;

  const bg = DISC_COLORS[color];
  const border = DISC_BORDER[color];
  const highlight = DISC_HIGHLIGHT[color];

  return (
    <Animated.View
      style={[
        styles.disc,
        {
          width: DISC_SIZE,
          height: DISC_SIZE,
          borderRadius: DISC_SIZE / 2,
          backgroundColor: bg,
          borderColor: border,
          opacity: animOpacity,
          transform: [{ scale: animScale }],
        },
      ]}
    >
      {/* Inner highlight for dimensional depth */}
      <View
        style={[
          styles.discHighlight,
          {
            width: HIGHLIGHT_SIZE,
            height: HIGHLIGHT_SIZE,
            borderRadius: HIGHLIGHT_SIZE / 2,
            backgroundColor: highlight,
          },
        ]}
      />
    </Animated.View>
  );
}

// =============================================================================
// Board Cell — with corner accent and stagger support
// =============================================================================

interface CellProps {
  disc: Disc;
  row: number;
  col: number;
  isLegalMove: boolean;
  isLastMove: boolean;
  isMyTurn: boolean;
  isTerminal: boolean;
  isDark: boolean;
  onPress: (row: number, col: number) => void;
  isNewPlacement: boolean;
  isFlipped: boolean;
  staggerMs: number;
}

const ReversiCell = React.memo(function ReversiCell({
  disc,
  row,
  col,
  isLegalMove,
  isLastMove,
  isMyTurn,
  isTerminal,
  isDark,
  onPress,
  isNewPlacement,
  isFlipped,
  staggerMs,
}: CellProps) {
  const canTap = !isTerminal && isMyTurn && isLegalMove;
  const isCorner = CORNER_CELLS.has(`${row}-${col}`);

  // Cell background — subtle alternating shade + corner accent
  const isLight = (row + col) % 2 === 0;
  let cellBg: string;
  if (isCorner && !disc) {
    cellBg = isDark ? CORNER_HINT_DARK : CORNER_HINT_LIGHT;
  } else {
    cellBg = isLight
      ? isDark
        ? "rgba(255,255,255,0.035)"
        : "rgba(255,255,255,0.055)"
      : "transparent";
  }

  const borderColor = isDark ? CELL_BORDER_DARK : CELL_BORDER_LIGHT;

  return (
    <Pressable
      onPress={() => onPress(row, col)}
      disabled={!canTap}
      style={({ pressed }) => [
        styles.cell,
        {
          width: CELL_SIZE,
          height: CELL_SIZE,
          borderRightWidth: col < SIZE - 1 ? StyleSheet.hairlineWidth : 0,
          borderBottomWidth: row < SIZE - 1 ? StyleSheet.hairlineWidth : 0,
          borderColor,
          backgroundColor:
            pressed && canTap ? "rgba(255,255,255,0.14)" : cellBg,
        },
      ]}
      accessibilityLabel={
        disc
          ? `${disc === "B" ? "Black" : "White"} disc at row ${row + 1}, column ${col + 1}`
          : isLegalMove
            ? `Legal move at row ${row + 1}, column ${col + 1}`
            : `Empty cell, row ${row + 1}, column ${col + 1}`
      }
      accessibilityRole="button"
      accessibilityState={{ disabled: !canTap }}
    >
      {/* Last move golden ring */}
      {isLastMove && disc && (
        <View
          style={[
            styles.lastMoveRing,
            {
              width: DISC_SIZE + 6,
              height: DISC_SIZE + 6,
              borderRadius: (DISC_SIZE + 6) / 2,
            },
          ]}
        />
      )}

      {/* Disc — key includes color so flips force remount + new animation */}
      {disc && (
        <AnimatedDisc
          key={`${row}-${col}-${disc}`}
          color={disc}
          animate={isNewPlacement || isFlipped}
          isFlip={isFlipped}
          staggerMs={isFlipped ? staggerMs : 0}
        />
      )}

      {/* Legal move indicator dot */}
      {!disc && isLegalMove && isMyTurn && !isTerminal && (
        <View style={styles.legalDot} />
      )}

      {/* Corner marker for empty corner cells (tiny strategic hint) */}
      {!disc && isCorner && !isLegalMove && <View style={styles.cornerDot} />}
    </Pressable>
  );
});

// =============================================================================
// Score Display — compact card with disc icons
// =============================================================================

function ScoreSide({
  color,
  count,
  isYou,
  isDark,
}: {
  color: "B" | "W";
  count: number;
  isYou: boolean;
  isDark: boolean;
}) {
  const accent = isYou ? "#FFD700" : isDark ? "#B0B0B0" : "#555";
  const labelColor = isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)";

  return (
    <View style={styles.scoreSide}>
      {/* Mini disc icon with highlight */}
      <View
        style={[
          styles.scoreDiscIcon,
          {
            backgroundColor: DISC_COLORS[color],
            borderColor: DISC_BORDER[color],
          },
        ]}
      >
        <View
          style={[
            styles.scoreDiscHL,
            { backgroundColor: DISC_HIGHLIGHT[color] },
          ]}
        />
      </View>
      <Text
        style={[
          styles.scoreCount,
          {
            color: accent,
            fontWeight: isYou ? "800" : "600",
          },
        ]}
      >
        {count}
      </Text>
      {isYou && (
        <Text style={[styles.scoreYouTag, { color: "#FFD700" }]}>YOU</Text>
      )}
      {!isYou && (
        <Text style={[styles.scoreLabel, { color: labelColor }]}>
          {color === "B" ? "BLK" : "WHT"}
        </Text>
      )}
    </View>
  );
}

function ScoreBar({
  blackCount,
  whiteCount,
  myColor,
  isDark,
}: {
  blackCount: number;
  whiteCount: number;
  myColor: "B" | "W";
  isDark: boolean;
}) {
  const cardBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)";
  const dividerColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

  return (
    <View style={[styles.scoreCard, { backgroundColor: cardBg }]}>
      <ScoreSide
        color="B"
        count={blackCount}
        isYou={myColor === "B"}
        isDark={isDark}
      />
      <View style={[styles.scoreDivider, { backgroundColor: dividerColor }]} />
      <ScoreSide
        color="W"
        count={whiteCount}
        isYou={myColor === "W"}
        isDark={isDark}
      />
    </View>
  );
}

// =============================================================================
// Main UI Component
// =============================================================================

function ReversiUI({
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
  const blackCount = (publicState?.blackCount as number) ?? 2;
  const whiteCount = (publicState?.whiteCount as number) ?? 2;
  const legalMoves = (publicState?.legalMoves as Array<[number, number]>) ?? [];
  const lastMoveData = publicState?.lastMove as
    | { type: "place"; row: number; col: number }
    | { type: "pass" }
    | null;
  const lastAction = publicState?.lastAction as "place" | "pass" | null;
  const turnNumber = (publicState?.turnNumber as number) ?? 1;
  const blackUid = (publicState?.blackUid as string) ?? turnOrder[0];
  const whiteUid = (publicState?.whiteUid as string) ?? turnOrder[1];

  // Player identity
  const myColor: "B" | "W" = myUid === blackUid ? "B" : "W";
  const oppColor: "B" | "W" = myColor === "B" ? "W" : "B";
  const opponentUid = turnOrder.find((uid) => uid !== myUid) ?? "";
  const mySlot = players.find((p) => p.uid === myUid);
  const oppSlot = players.find((p) => p.uid === opponentUid);

  // Legal move set for O(1) lookup
  const legalMoveSet = useMemo(() => {
    const set = new Set<string>();
    for (const [r, c] of legalMoves) {
      set.add(`${r}-${c}`);
    }
    return set;
  }, [legalMoves]);

  // Must pass detection
  const mustPass = isMyTurn && !isTerminal && legalMoves.length === 0;

  // ---------- New-move detection for animations ----------
  const knownBoardRef = useRef<Board | null>(null);
  const knownTurnRef = useRef<number>(turnNumber);
  const newCellsRef = useRef<Set<string>>(new Set());
  const flippedCellsRef = useRef<Set<string>>(new Set());
  const lastMoveCoordRef = useRef<{ row: number; col: number } | null>(null);

  if (knownBoardRef.current === null) {
    knownBoardRef.current = board.map((r) => [...r]);
    knownTurnRef.current = turnNumber;
  }

  if (turnNumber > knownTurnRef.current) {
    const known = knownBoardRef.current!;
    const newCells = new Set<string>();
    const flipped = new Set<string>();

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (known[r][c] === null && board[r][c] !== null) {
          newCells.add(`${r}-${c}`);
        } else if (
          known[r][c] !== null &&
          board[r][c] !== null &&
          known[r][c] !== board[r][c]
        ) {
          flipped.add(`${r}-${c}`);
        }
      }
    }

    newCellsRef.current = newCells;
    flippedCellsRef.current = flipped;

    // Determine last move coord
    if (lastMoveData && lastMoveData.type === "place") {
      lastMoveCoordRef.current = {
        row: lastMoveData.row,
        col: lastMoveData.col,
      };
    }

    knownBoardRef.current = board.map((r) => [...r]);
    knownTurnRef.current = turnNumber;
  }

  const newCells = newCellsRef.current;
  const flippedCells = flippedCellsRef.current;
  const lastMoveCoord = lastMoveCoordRef.current;

  // Compute stagger delays for cascading flip animations
  const staggerMap: Record<string, number> = {};
  if (lastMoveCoord) {
    flippedCells.forEach((cellId) => {
      const [r, c] = cellId.split("-").map(Number);
      const dist =
        Math.abs(r - lastMoveCoord.row) + Math.abs(c - lastMoveCoord.col);
      staggerMap[cellId] = dist * 45;
    });
  }

  // Status text
  const getStatusText = useCallback((): string => {
    if (isTerminal) {
      if (blackCount > whiteCount) {
        return myColor === "B" ? "You won!" : "You lost";
      }
      if (whiteCount > blackCount) {
        return myColor === "W" ? "You won!" : "You lost";
      }
      return "Draw — equal discs";
    }
    if (mustPass) return "No legal moves — you must pass";
    if (isMyTurn)
      return `Your turn — place ${myColor === "B" ? "Black" : "White"}`;
    return "Waiting for opponent…";
  }, [isTerminal, isMyTurn, mustPass, myColor, blackCount, whiteCount]);

  const getStatusColor = useCallback((): string | undefined => {
    if (!isTerminal) {
      if (mustPass) return "#FF9500";
      return undefined;
    }
    if (blackCount === whiteCount) return isDark ? "#AAA" : "#888";
    const iWon =
      (myColor === "B" && blackCount > whiteCount) ||
      (myColor === "W" && whiteCount > blackCount);
    return iWon ? "#34C759" : "#FF3B30";
  }, [isTerminal, mustPass, myColor, blackCount, whiteCount, isDark]);

  // Subtitle for richer TurnStatusCard
  const getSubtitle = useCallback((): string | undefined => {
    if (isTerminal) {
      const diff = Math.abs(blackCount - whiteCount);
      if (diff === 0) return `${blackCount} – ${whiteCount}`;
      return `${Math.max(blackCount, whiteCount)} – ${Math.min(blackCount, whiteCount)} · +${diff}`;
    }
    if (!isMyTurn) return `${oppSlot?.displayName || "Opponent"} is thinking…`;
    if (mustPass) return "Tap pass to continue";
    return `Playing as ${myColor === "B" ? "Black" : "White"}`;
  }, [
    isTerminal,
    isMyTurn,
    mustPass,
    myColor,
    blackCount,
    whiteCount,
    oppSlot?.displayName,
  ]);

  // Cell press handler
  const handlePress = useCallback(
    async (row: number, col: number) => {
      if (!isMyTurn || isTerminal || actionLoading) return;
      if (!legalMoveSet.has(`${row}-${col}`)) return;
      Haptics.light();
      await submitMove({ type: "place", row, col });
    },
    [isMyTurn, isTerminal, actionLoading, legalMoveSet, submitMove],
  );

  // Pass handler
  const handlePass = useCallback(async () => {
    if (!mustPass || actionLoading) return;
    Haptics.medium();
    await submitMove({ type: "pass" });
  }, [mustPass, actionLoading, submitMove]);

  // Terminal haptic
  const terminalHapticFired = useRef(false);
  useEffect(() => {
    if (isTerminal && !terminalHapticFired.current) {
      terminalHapticFired.current = true;
      const iWon =
        (myColor === "B" && blackCount > whiteCount) ||
        (myColor === "W" && whiteCount > blackCount);
      if (iWon) {
        Haptics.success();
      } else if (blackCount === whiteCount) {
        Haptics.light();
      } else {
        Haptics.medium();
      }
    }
  }, [isTerminal, myColor, blackCount, whiteCount]);

  // Player chips — use disc-coloured pips
  const localChip: PlayerChipProps = {
    displayName: mySlot?.displayName || "You",
    markLabel: myColor === "B" ? "●" : "○",
    markColor: myColor === "B" ? DISC_COLORS.B : DISC_COLORS.W,
    isActive: isMyTurn && !isTerminal,
    isLocal: true,
    avatarUrl: mySlot?.profilePictureUrl,
  };
  const opponentChip: PlayerChipProps = {
    displayName: oppSlot?.displayName || "Opponent",
    markLabel: oppColor === "B" ? "●" : "○",
    markColor: oppColor === "B" ? DISC_COLORS.B : DISC_COLORS.W,
    isActive: !isMyTurn && !isTerminal,
    avatarUrl: oppSlot?.profilePictureUrl,
  };

  // Inline notice
  const [notice, setNotice] = useState<string | null>(null);

  // Show notice when opponent passed
  useEffect(() => {
    if (lastAction === "pass" && !isTerminal && isMyTurn) {
      setNotice("Opponent passed — your turn");
    }
  }, [lastAction, isTerminal, isMyTurn]);

  const gameBg = isDark ? "#0A0A0A" : theme.colors.background;
  const boardBg = isDark ? BOARD_BG_DARK : BOARD_BG_LIGHT;
  const frameBg = isDark ? BOARD_FRAME_DARK : BOARD_FRAME_LIGHT;

  return (
    <View style={[styles.container, { backgroundColor: gameBg }]}>
      {/* Turn status card */}
      <TurnStatusCard
        statusText={getStatusText()}
        subtitle={getSubtitle()}
        localPlayer={localChip}
        opponentPlayer={opponentChip}
        isLocalTurn={isMyTurn}
        isTerminal={isTerminal}
        statusColor={getStatusColor()}
      />

      {/* Board region — hero */}
      <View style={styles.boardRegion}>
        {/* Score bar — compact, above board */}
        <ScoreBar
          blackCount={blackCount}
          whiteCount={whiteCount}
          myColor={myColor}
          isDark={isDark}
        />

        {/* Board frame — outer trim for premium feel */}
        <View
          style={[
            styles.boardFrame,
            {
              backgroundColor: frameBg,
              ...Elevation.lg,
            },
          ]}
        >
          <BoardTray
            padding={BOARD_PADDING}
            backgroundColor={boardBg}
            style={styles.boardTrayInner}
          >
            <View style={{ width: BOARD_PX, height: BOARD_PX }}>
              <View style={styles.gridContainer}>
                {board.map((rowData, r) =>
                  rowData.map((disc, c) => {
                    const cellId = `${r}-${c}`;
                    const isCellLastMove =
                      lastMoveCoord !== null &&
                      lastMoveCoord.row === r &&
                      lastMoveCoord.col === c;
                    return (
                      <ReversiCell
                        key={cellId}
                        disc={disc}
                        row={r}
                        col={c}
                        isLegalMove={legalMoveSet.has(cellId)}
                        isLastMove={isCellLastMove}
                        isMyTurn={isMyTurn}
                        isTerminal={isTerminal}
                        isDark={isDark}
                        onPress={handlePress}
                        isNewPlacement={newCells.has(cellId)}
                        isFlipped={flippedCells.has(cellId)}
                        staggerMs={staggerMap[cellId] ?? 0}
                      />
                    );
                  }),
                )}
              </View>
            </View>
          </BoardTray>
        </View>
      </View>

      {/* Bottom action/status region — compact, no layout shift */}
      <View style={styles.bottomRegion}>
        {mustPass && (
          <Pressable
            style={({ pressed }) => [
              styles.passButton,
              { opacity: actionLoading ? 0.6 : pressed ? 0.85 : 1 },
            ]}
            onPress={handlePass}
            disabled={actionLoading}
            accessibilityLabel="Pass turn"
            accessibilityRole="button"
          >
            <MaterialCommunityIcons
              name="debug-step-over"
              size={18}
              color="#FFF"
            />
            <Text style={styles.passButtonText}>
              {actionLoading ? "Passing…" : "Pass Turn"}
            </Text>
          </Pressable>
        )}

        {!mustPass && !isTerminal && !isMyTurn && (
          <View style={styles.waitingPill}>
            <View style={styles.waitingDot} />
            <Text
              style={[
                styles.waitingText,
                {
                  color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.3)",
                },
              ]}
            >
              Opponent’s turn
            </Text>
          </View>
        )}

        {notice && (
          <InlineNotice
            message={notice}
            severity="info"
            dismissAfterMs={3000}
            onDismiss={() => setNotice(null)}
          />
        )}
      </View>
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
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  // Board region — hero, centered, fills available space
  boardRegion: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  // Board frame — outer premium trim
  boardFrame: {
    borderRadius: BorderRadius.lg + 2,
    padding: 3,
  },
  boardTrayInner: {
    borderRadius: BorderRadius.lg,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: BOARD_PX,
    height: BOARD_PX,
  },
  cell: {
    justifyContent: "center",
    alignItems: "center",
  },
  disc: {
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
    ...Elevation.md,
  },
  discHighlight: {
    position: "absolute",
    top: 3,
    left: 3,
  },
  lastMoveRing: {
    position: "absolute",
    borderWidth: 2,
    borderColor: LAST_MOVE_RING,
    opacity: 0.65,
  },
  legalDot: {
    width: CELL_SIZE * 0.24,
    height: CELL_SIZE * 0.24,
    borderRadius: CELL_SIZE * 0.12,
    backgroundColor: LEGAL_DOT_COLOR,
  },
  cornerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,215,0,0.15)",
  },
  // Score card
  scoreCard: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.xl,
    gap: Spacing.md,
  },
  scoreSide: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  scoreDiscIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scoreDiscHL: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    position: "absolute",
    top: 2,
    left: 2,
  },
  scoreCount: {
    fontSize: 20,
    fontVariant: ["tabular-nums"],
  },
  scoreYouTag: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  scoreLabel: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  scoreDivider: {
    width: 1,
    height: 20,
    borderRadius: 0.5,
  },
  // Bottom region
  bottomRegion: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Platform.select({ ios: Spacing.md, default: Spacing.lg }),
    gap: Spacing.sm,
    alignItems: "center",
    minHeight: 52,
  },
  // Pass button — prominent action CTA
  passButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: BorderRadius.xxl,
    backgroundColor: "#FF9500",
    ...Elevation.md,
  },
  passButtonText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "700",
  },
  // Waiting pill — subtle bottom indicator
  waitingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.full,
  },
  waitingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  waitingText: {
    fontSize: 12,
    fontWeight: "500",
  },
});

export default withGameV4Shell(ReversiUI, "reversi");
