/**
 * Chess UI — Board Renderer
 *
 * Composes 64 memoized ChessSquare components + animated ChessPiece
 * overlays. Handles animated piece movement by tracking the last move
 * and translating pieces from origin to destination.
 *
 * Supports two input modes (controlled via settings):
 *   **tap**  — tap a piece then tap a target square (default).
 *   **drag** — press-and-drag a piece to its destination.
 *
 * Performance:
 * - Squares are memoized and only re-render when their highlight state changes.
 * - Piece positions use core RN Animated values with useNativeDriver.
 * - Board renders are batched via useMemo.
 * - Drag tracking uses Reanimated shared values for 60fps gesture.
 *
 * @module gamesV4/screens/chess/ChessBoard
 */

import {
  generateLegalMoves,
  isInCheck,
} from "@/gamesV4/adapters/chess/chessEngine";
import type {
  ChessPublicStateV1,
  Piece,
  Side,
  Square,
} from "@/gamesV4/adapters/chess/chessTypes";
import {
  FILES,
  indicesToSquare,
  pieceColor,
  squareToIndices,
} from "@/gamesV4/adapters/chess/chessTypes";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import ReAnimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { ChessPiece } from "./ChessPiece";
import { ChessSquare } from "./ChessSquare";
import type { ChessBoardTheme } from "./chessThemes";
import { BOARD_SIZE, MOVE_ANIM_DURATION, SQUARE_SIZE } from "./constants";
import type { ChessSettings } from "./useChessSettings";

// =============================================================================
// Props
// =============================================================================

interface ChessBoardProps {
  state: ChessPublicStateV1;
  boardTheme: ChessBoardTheme;
  settings: ChessSettings;
  /** Currently selected square */
  selectedSquare: Square | null;
  /** Queued move (premove) squares */
  queuedFrom: Square | null;
  queuedTo: Square | null;
  /** Board flip (true = black at bottom) */
  flipped: boolean;
  /** My side color */
  myColor: Side;
  /** Whether user can interact (my turn + not terminal + not spectator) */
  canInteract: boolean;
  /** Whether game is terminal */
  isTerminal: boolean;
  /** Whether viewer is a spectator */
  isSpectator?: boolean;
  /** Square tap callback (used in tap mode) */
  onSquareTap: (row: number, col: number) => void;
  /** Drag-move callback (used in drag mode) */
  onDragMove?: (
    fromRow: number,
    fromCol: number,
    toRow: number,
    toCol: number,
  ) => void;
}

// =============================================================================
// Component
// =============================================================================

export function ChessBoard({
  state,
  boardTheme,
  settings,
  selectedSquare,
  queuedFrom,
  queuedTo,
  flipped,
  myColor,
  canInteract,
  isTerminal,
  isSpectator,
  onSquareTap,
  onDragMove,
}: ChessBoardProps) {
  const prevPlyRef = useRef(state.plyCount);
  const isDragMode = settings.inputMode === "drag";

  // Detect new move for animation
  const isNewMove = state.plyCount !== prevPlyRef.current;
  useEffect(() => {
    prevPlyRef.current = state.plyCount;
  }, [state.plyCount]);

  // =========================================================================
  // Drag-to-move state (Reanimated shared values for 60fps gesture tracking)
  // =========================================================================

  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const dragActive = useSharedValue(false);
  const dragFromVR = useSharedValue(0);
  const dragFromVC = useSharedValue(0);

  // Piece being dragged (JS-thread state for rendering)
  const [dragPiece, setDragPiece] = useState<Piece | null>(null);
  const [dragFromSquare, setDragFromSquare] = useState<Square | null>(null);

  // Ref-stable versions of frequently-changing props (prevents gesture recreation)
  const stateRef = useRef(state);
  stateRef.current = state;
  const flippedRef = useRef(flipped);
  flippedRef.current = flipped;

  /** Called on JS thread when the pan gesture starts — validates the touch. */
  const handleDragStart = useCallback(
    (vr: number, vc: number, x: number, y: number) => {
      // Spectators cannot drag pieces
      if (isSpectator) {
        dragActive.value = false;
        return;
      }
      const br = flippedRef.current ? 7 - vr : vr;
      const bc = flippedRef.current ? 7 - vc : vc;
      const piece = stateRef.current.board[br][bc];
      if (!piece || pieceColor(piece) !== myColor) {
        dragActive.value = false;
        return;
      }
      setDragPiece(piece);
      setDragFromSquare(indicesToSquare(br, bc));
    },
    [myColor, isSpectator, dragActive],
  );

  /** Called on JS thread when the drag ends — dispatches the move. */
  const handleDragEnd = useCallback(
    (toVR: number, toVC: number) => {
      const fromVR = dragFromVR.value;
      const fromVC = dragFromVC.value;
      const fromBR = flippedRef.current ? 7 - fromVR : fromVR;
      const fromBC = flippedRef.current ? 7 - fromVC : fromVC;
      const toBR = flippedRef.current ? 7 - toVR : toVR;
      const toBC = flippedRef.current ? 7 - toVC : toVC;
      setDragPiece(null);
      setDragFromSquare(null);
      onDragMove?.(fromBR, fromBC, toBR, toBC);
    },
    [onDragMove, dragFromVR, dragFromVC],
  );

  /** Clean up drag state on cancel / finalize. */
  const handleDragCancel = useCallback(() => {
    setDragPiece(null);
    setDragFromSquare(null);
  }, []);

  // Build the pan gesture (only used when drag mode is active)
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin((e) => {
          "worklet";
          const vc = Math.min(7, Math.max(0, Math.floor(e.x / SQUARE_SIZE)));
          const vr = Math.min(7, Math.max(0, Math.floor(e.y / SQUARE_SIZE)));
          dragFromVR.value = vr;
          dragFromVC.value = vc;
          dragX.value = e.x;
          dragY.value = e.y;
          dragActive.value = true;
          runOnJS(handleDragStart)(vr, vc, e.x, e.y);
        })
        .onUpdate((e) => {
          "worklet";
          dragX.value = e.x;
          dragY.value = e.y;
        })
        .onEnd((e) => {
          "worklet";
          const toVC = Math.min(7, Math.max(0, Math.floor(e.x / SQUARE_SIZE)));
          const toVR = Math.min(7, Math.max(0, Math.floor(e.y / SQUARE_SIZE)));
          dragActive.value = false;
          runOnJS(handleDragEnd)(toVR, toVC);
        })
        .onFinalize(() => {
          "worklet";
          dragActive.value = false;
          runOnJS(handleDragCancel)();
        }),
    [
      handleDragStart,
      handleDragEnd,
      handleDragCancel,
      dragFromVR,
      dragFromVC,
      dragX,
      dragY,
      dragActive,
    ],
  );

  // Animated style for the floating drag piece
  const floatingPieceStyle = useAnimatedStyle(() => ({
    position: "absolute" as const,
    left: dragX.value - SQUARE_SIZE / 2,
    top: dragY.value - SQUARE_SIZE / 2,
    width: SQUARE_SIZE,
    height: SQUARE_SIZE,
    zIndex: 100,
    opacity: dragActive.value ? 1 : 0,
    transform: [{ scale: 1.15 }],
  }));

  // Clean up drag visual state when switching away from drag mode
  useEffect(() => {
    if (!isDragMode) {
      setDragPiece(null);
      setDragFromSquare(null);
      dragActive.value = false;
    }
  }, [isDragMode, dragActive]);

  // Legal moves for selected piece (also works for the piece being dragged)
  const activePiece = dragFromSquare ?? selectedSquare;

  const legalMoves = useMemo(() => {
    if (!activePiece || isTerminal || !canInteract) return [];
    return generateLegalMoves(
      state.board,
      state.sideToMove,
      state.castling,
      state.enPassant,
    ).filter((m) => m.from === activePiece);
  }, [state, activePiece, isTerminal, canInteract]);

  const legalTargets = useMemo(() => {
    const set = new Set<string>();
    for (const m of legalMoves) set.add(m.to);
    return set;
  }, [legalMoves]);

  const legalCaptures = useMemo(() => {
    const set = new Set<string>();
    for (const m of legalMoves) {
      if (m.captured) set.add(m.to);
    }
    return set;
  }, [legalMoves]);

  // Check state
  const kingInCheck = isInCheck(state.board, state.sideToMove);
  const kingSquare = useMemo(() => {
    const kingPiece = state.sideToMove === "w" ? "wK" : "bK";
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (state.board[r][c] === kingPiece) return indicesToSquare(r, c);
      }
    }
    return null;
  }, [state.board, state.sideToMove]);

  // No-op handler for drag mode (squares shouldn't consume taps)
  const noop = useCallback(() => {}, []);

  // Build squares grid
  const squares = useMemo(() => {
    const els: React.ReactElement[] = [];

    for (let vr = 0; vr < 8; vr++) {
      const br = flipped ? 7 - vr : vr;
      for (let vc = 0; vc < 8; vc++) {
        const bc = flipped ? 7 - vc : vc;
        const sq = indicesToSquare(br, bc);
        const isLight = (br + bc) % 2 === 0;

        // Coordinate labels
        const rankLabel = vc === 0 ? `${8 - br}` : undefined;
        const fileLabel = vr === 7 ? FILES[bc] : undefined;

        els.push(
          <ChessSquare
            key={sq}
            square={sq}
            visualRow={vr}
            visualCol={vc}
            isLight={isLight}
            boardTheme={boardTheme}
            isSelected={sq === activePiece}
            isLastMoveFrom={
              settings.highlightLastMove && state.lastMove?.from === sq
            }
            isLastMoveTo={
              settings.highlightLastMove && state.lastMove?.to === sq
            }
            isKingCheck={kingInCheck && sq === kingSquare}
            isLegalTarget={legalTargets.has(sq)}
            isLegalCapture={legalCaptures.has(sq)}
            isQueuedFrom={queuedFrom === sq}
            isQueuedTo={queuedTo === sq}
            showLegalMoves={settings.showLegalMoves}
            highlightLastMove={settings.highlightLastMove}
            highlightCheck={settings.highlightCheck}
            showCoordinates={settings.showCoordinates}
            reducedMotion={settings.reducedMotion}
            rankLabel={rankLabel}
            fileLabel={fileLabel}
            onPress={isDragMode ? noop : () => onSquareTap(br, bc)}
          />,
        );
      }
    }
    return els;
  }, [
    state,
    boardTheme,
    settings,
    activePiece,
    queuedFrom,
    queuedTo,
    flipped,
    kingInCheck,
    kingSquare,
    legalTargets,
    legalCaptures,
    isDragMode,
    noop,
    onSquareTap,
  ]);

  // Build piece layer — each piece gets an animated position
  // When dragging, hide the piece at its original square (it's shown as the floating ghost).
  const pieces = useMemo(() => {
    const els: React.ReactElement[] = [];

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = state.board[r][c];
        if (!piece) continue;

        const vr = flipped ? 7 - r : r;
        const vc = flipped ? 7 - c : c;
        const sq = indicesToSquare(r, c);

        // Hide the piece on its home square while it's being dragged
        if (dragFromSquare === sq && dragPiece) continue;

        // Determine if this piece just moved here (for entrance animation)
        const justLanded = isNewMove && state.lastMove?.to === sq;

        els.push(
          <AnimatedPieceWrapper
            key={`${piece}-${sq}`}
            piece={piece}
            visualRow={vr}
            visualCol={vc}
            boardTheme={boardTheme}
            justLanded={justLanded}
            lastMove={state.lastMove}
            flipped={flipped}
            reducedMotion={settings.reducedMotion}
          />,
        );
      }
    }
    return els;
  }, [
    state,
    boardTheme,
    flipped,
    isNewMove,
    settings.reducedMotion,
    dragFromSquare,
    dragPiece,
  ]);

  // Board content (shared between tap and drag mode)
  const boardContent = (
    <>
      {/* Square layer */}
      {squares}
      {/* Piece layer (above squares for proper z-ordering) */}
      {pieces}
      {/* Floating drag piece */}
      {isDragMode && dragPiece && (
        <ReAnimated.View style={floatingPieceStyle} pointerEvents="none">
          <ChessPiece piece={dragPiece} boardTheme={boardTheme} reducedMotion />
        </ReAnimated.View>
      )}
    </>
  );

  // In drag mode, wrap the board in a GestureDetector for pan tracking
  if (isDragMode) {
    return (
      <GestureDetector gesture={panGesture}>
        <ReAnimated.View
          style={[styles.board, { width: BOARD_SIZE, height: BOARD_SIZE }]}
        >
          {boardContent}
        </ReAnimated.View>
      </GestureDetector>
    );
  }

  return (
    <View style={[styles.board, { width: BOARD_SIZE, height: BOARD_SIZE }]}>
      {boardContent}
    </View>
  );
}

// =============================================================================
// Animated Piece Wrapper
// =============================================================================

interface AnimatedPieceWrapperProps {
  piece: Piece;
  visualRow: number;
  visualCol: number;
  boardTheme: ChessBoardTheme;
  justLanded: boolean;
  lastMove: ChessPublicStateV1["lastMove"];
  flipped: boolean;
  reducedMotion: boolean;
}

const AnimatedPieceWrapper = React.memo(function AnimatedPieceWrapper({
  piece,
  visualRow,
  visualCol,
  boardTheme,
  justLanded,
  lastMove,
  flipped,
  reducedMotion,
}: AnimatedPieceWrapperProps) {
  const targetX = visualCol * SQUARE_SIZE;
  const targetY = visualRow * SQUARE_SIZE;

  // Calculate starting position if this piece just moved
  let startX = targetX;
  let startY = targetY;

  if (justLanded && lastMove && !reducedMotion) {
    const [fromR, fromC] = squareToIndices(lastMove.from);
    const fromVR = flipped ? 7 - fromR : fromR;
    const fromVC = flipped ? 7 - fromC : fromC;
    startX = fromVC * SQUARE_SIZE;
    startY = fromVR * SQUARE_SIZE;
  }

  // Core RN Animated values (offset model: animate from offset → 0)
  const offsetX = useRef(new Animated.Value(startX - targetX)).current;
  const offsetY = useRef(new Animated.Value(startY - targetY)).current;

  useEffect(() => {
    if (
      justLanded &&
      !reducedMotion &&
      (startX !== targetX || startY !== targetY)
    ) {
      Animated.parallel([
        Animated.timing(offsetX, {
          toValue: 0,
          duration: MOVE_ANIM_DURATION,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(offsetY, {
          toValue: 0,
          duration: MOVE_ANIM_DURATION,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={[
        styles.pieceAbsolute,
        {
          left: targetX,
          top: targetY,
          transform: [{ translateX: offsetX }, { translateY: offsetY }],
        },
      ]}
    >
      <ChessPiece
        piece={piece}
        boardTheme={boardTheme}
        reducedMotion={reducedMotion}
      />
    </Animated.View>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  board: {
    position: "relative",
    borderRadius: 6,
    overflow: "hidden",
  },
  pieceAbsolute: {
    position: "absolute",
    width: SQUARE_SIZE,
    height: SQUARE_SIZE,
    zIndex: 10,
    pointerEvents: "none",
  },
});
