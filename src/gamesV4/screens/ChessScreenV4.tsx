/**
 * Games V4 — Chess Game Screen
 *
 * Full-featured chess UI wrapped by the V4 game shell.
 * Supports: tap-to-move, legal move highlights, promotion modal,
 * draw offer/accept, captured pieces, move list, spectator mode.
 *
 * @module gamesV4/screens/ChessScreenV4
 */

import {
  generateLegalMoves,
  getCapturedPieces,
  isInCheck,
} from "@/gamesV4/adapters/chess/chessEngine";
import type {
  ChessPublicStateV1,
  Piece,
  PromotionPiece,
  Side,
  Square,
} from "@/gamesV4/adapters/chess/chessTypes";
import {
  FILES,
  indicesToSquare,
  pieceColor,
} from "@/gamesV4/adapters/chess/chessTypes";
import {
  GameShellProps,
  withGameV4Shell,
} from "@/gamesV4/components/GameScreenShell";
import { useAppTheme } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import {
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// =============================================================================
// Piece Unicode Symbols
// =============================================================================

const PIECE_SYMBOLS: Record<string, string> = {
  wK: "\u2654",
  wQ: "\u2655",
  wR: "\u2656",
  wB: "\u2657",
  wN: "\u2658",
  wP: "\u2659",
  bK: "\u265A",
  bQ: "\u265B",
  bR: "\u265C",
  bB: "\u265D",
  bN: "\u265E",
  bP: "\u265F",
};

const PIECE_ICONS: Record<string, string> = {
  wP: "chess-pawn",
  wN: "chess-knight",
  wB: "chess-bishop",
  wR: "chess-rook",
  wQ: "chess-queen",
  wK: "chess-king",
  bP: "chess-pawn",
  bN: "chess-knight",
  bB: "chess-bishop",
  bR: "chess-rook",
  bQ: "chess-queen",
  bK: "chess-king",
};

// =============================================================================
// Constants
// =============================================================================

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;
const BOARD_PADDING = 16;
const BOARD_SIZE = Math.min(SCREEN_WIDTH - BOARD_PADDING, 400);
const SQUARE_SIZE = BOARD_SIZE / 8;

const LIGHT_SQUARE = "#F0D9B5";
const DARK_SQUARE = "#B58863";
const SELECTED_COLOR = "rgba(255, 255, 0, 0.5)";
const LEGAL_MOVE_COLOR = "rgba(0, 0, 0, 0.2)";
const LEGAL_CAPTURE_COLOR = "rgba(255, 0, 0, 0.3)";
const LAST_MOVE_COLOR = "rgba(155, 199, 0, 0.4)";
const CHECK_COLOR = "rgba(255, 0, 0, 0.5)";

// =============================================================================
// Chess UI Component
// =============================================================================

function ChessUI({
  publicState,
  isMyTurn,
  isTerminal,
  myUid,
  turnOrder,
  submitMove,
  actionLoading,
  sessionId,
}: GameShellProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const state = publicState as unknown as ChessPublicStateV1 | null;

  // Player color determination
  const whiteUid = turnOrder[0];
  const blackUid = turnOrder[1];
  const isSpectator = myUid !== whiteUid && myUid !== blackUid;
  const myColor: Side = myUid === whiteUid ? "w" : "b";

  // Board orientation: player's color at bottom
  const [boardFlipped, setBoardFlipped] = useState(false);
  const effectiveFlip = isSpectator ? boardFlipped : myColor === "b";

  // Selection state
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [promotionTarget, setPromotionTarget] = useState<{
    from: Square;
    to: Square;
  } | null>(null);
  const [showMoveList, setShowMoveList] = useState(false);

  // Legal moves for selected piece
  const legalMoves = useMemo(() => {
    if (!state || !selectedSquare || isTerminal || !isMyTurn) return [];
    return generateLegalMoves(
      state.board,
      state.sideToMove,
      state.castling,
      state.enPassant,
    ).filter((m) => m.from === selectedSquare);
  }, [state, selectedSquare, isTerminal, isMyTurn]);

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

  // Handle square tap
  const handleSquareTap = useCallback(
    (row: number, col: number) => {
      if (!state || isTerminal || actionLoading) return;
      if (isSpectator || !isMyTurn) return;

      const sq = indicesToSquare(row, col);
      const piece = state.board[row][col];

      // If tapping on a legal move target of the selected piece
      if (selectedSquare && legalTargets.has(sq)) {
        const move = legalMoves.find((m) => m.to === sq);
        if (move?.promotion) {
          // Need promotion choice
          setPromotionTarget({ from: selectedSquare, to: sq });
          return;
        }
        // Submit the move
        submitMove({
          action: "move",
          from: selectedSquare,
          to: sq,
        });
        setSelectedSquare(null);
        return;
      }

      // If tapping on own piece, select it
      if (piece && pieceColor(piece) === myColor) {
        setSelectedSquare(sq === selectedSquare ? null : sq);
        return;
      }

      // Deselect
      setSelectedSquare(null);
    },
    [
      state,
      isTerminal,
      actionLoading,
      isSpectator,
      isMyTurn,
      selectedSquare,
      legalTargets,
      legalMoves,
      myColor,
      submitMove,
    ],
  );

  // Handle promotion choice
  const handlePromotionChoice = useCallback(
    (piece: PromotionPiece) => {
      if (!promotionTarget) return;
      submitMove({
        action: "move",
        from: promotionTarget.from,
        to: promotionTarget.to,
        promotion: piece,
      });
      setPromotionTarget(null);
      setSelectedSquare(null);
    },
    [promotionTarget, submitMove],
  );

  // Handle draw offer
  const handleOfferDraw = useCallback(() => {
    if (!state || isTerminal || !isMyTurn) return;
    // Cannot offer draw if already a pending offer by us
    if (state.pendingDrawOfferByUid === myUid) return;
    // Draw offers are attached to the next move via offerDraw flag
    // For now show an alert — the actual offer will be on the user's next move
    // We'll use a simple approach: submit special draw-offer move
  }, [state, isTerminal, isMyTurn, myUid]);

  // Handle accept draw
  const handleAcceptDraw = useCallback(() => {
    if (!state || isTerminal) return;
    if (state.pendingDrawOfferByUid && state.pendingDrawOfferByUid !== myUid) {
      submitMove({ action: "acceptDraw" });
    }
  }, [state, isTerminal, myUid, submitMove]);

  // Handle claim draw
  const handleClaimDraw = useCallback(
    (claim: "threefold" | "fiftyMove") => {
      if (!state || isTerminal || !isMyTurn) return;
      submitMove({ action: "claimDraw", claim });
    },
    [state, isTerminal, isMyTurn, submitMove],
  );

  if (!state) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <Text style={{ color: theme.colors.primary }}>Loading...</Text>
      </View>
    );
  }

  // Compute check status
  const kingInCheck = isInCheck(state.board, state.sideToMove);
  const kingSquare = (() => {
    const kingPiece = state.sideToMove === "w" ? "wK" : "bK";
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (state.board[r][c] === kingPiece) return indicesToSquare(r, c);
      }
    }
    return null;
  })();

  // Status text
  const statusText = (() => {
    if (state.terminal) {
      if (state.terminal.type === "win") {
        const winnerId = state.terminal.winnerUids?.[0];
        const winnerIsMe = winnerId === myUid;
        return winnerIsMe ? "You win!" : isSpectator ? "Game Over" : "You lose";
      }
      return `Draw — ${state.terminal.reason.replace(/_/g, " ")}`;
    }
    if (isSpectator) {
      return state.sideToMove === "w" ? "White to move" : "Black to move";
    }
    if (isMyTurn) {
      return kingInCheck ? "Your turn — Check!" : "Your turn";
    }
    return "Opponent's turn";
  })();

  // Captured pieces
  const whiteCaptured = getCapturedPieces(state.board, "w");
  const blackCaptured = getCapturedPieces(state.board, "b");

  // Draw offer indicator
  const pendingDraw = state.pendingDrawOfferByUid;
  const canAcceptDraw =
    pendingDraw && pendingDraw !== myUid && isMyTurn && !isTerminal;
  const canClaimThreefold =
    isMyTurn &&
    !isTerminal &&
    (state.repetitionCounts[state.positionHash] ?? 0) >= 3;
  const canClaimFiftyMove =
    isMyTurn && !isTerminal && state.halfmoveClock >= 100;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.isDark ? "#1a1a1a" : "#f5f5f5" },
      ]}
    >
      {/* Status bar */}
      <View style={styles.statusBar}>
        <Text style={[styles.statusText, { color: theme.colors.primary }]}>
          {statusText}
        </Text>
        {pendingDraw && !isTerminal && (
          <View style={styles.drawPill}>
            <Text style={styles.drawPillText}>Draw offered</Text>
          </View>
        )}
      </View>

      {/* Top captured pieces (opponent's from player's perspective) */}
      <CapturedPiecesRow
        pieces={effectiveFlip ? whiteCaptured : blackCaptured}
        side={effectiveFlip ? "w" : "b"}
      />

      {/* Board */}
      <View
        style={[
          styles.boardContainer,
          { width: BOARD_SIZE, height: BOARD_SIZE },
        ]}
      >
        {Array.from({ length: 8 }, (_, visualRow) => {
          const boardRow = effectiveFlip ? 7 - visualRow : visualRow;
          return Array.from({ length: 8 }, (_, visualCol) => {
            const boardCol = effectiveFlip ? 7 - visualCol : visualCol;
            const sq = indicesToSquare(boardRow, boardCol);
            const piece = state.board[boardRow][boardCol];
            const isLight = (boardRow + boardCol) % 2 === 0;
            const isSelected = sq === selectedSquare;
            const isLegalTarget = legalTargets.has(sq);
            const isLegalCapture = legalCaptures.has(sq);
            const isLastMoveFrom = state.lastMove?.from === sq;
            const isLastMoveTo = state.lastMove?.to === sq;
            const isKingCheck = kingInCheck && sq === kingSquare;

            let bgColor = isLight ? LIGHT_SQUARE : DARK_SQUARE;

            return (
              <TouchableOpacity
                key={sq}
                style={[
                  styles.square,
                  {
                    width: SQUARE_SIZE,
                    height: SQUARE_SIZE,
                    backgroundColor: bgColor,
                    left: visualCol * SQUARE_SIZE,
                    top: visualRow * SQUARE_SIZE,
                  },
                ]}
                activeOpacity={0.8}
                onPress={() => handleSquareTap(boardRow, boardCol)}
              >
                {/* Highlight overlays */}
                {isLastMoveFrom || isLastMoveTo ? (
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      { backgroundColor: LAST_MOVE_COLOR },
                    ]}
                  />
                ) : null}
                {isSelected ? (
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      { backgroundColor: SELECTED_COLOR },
                    ]}
                  />
                ) : null}
                {isKingCheck ? (
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      { backgroundColor: CHECK_COLOR },
                    ]}
                  />
                ) : null}

                {/* Piece */}
                {piece ? (
                  <Text
                    style={[styles.pieceText, { fontSize: SQUARE_SIZE * 0.75 }]}
                  >
                    {PIECE_SYMBOLS[piece] ?? "?"}
                  </Text>
                ) : null}

                {/* Legal move dot */}
                {isLegalTarget && !isLegalCapture && !piece ? (
                  <View style={styles.legalMoveDot} />
                ) : null}

                {/* Legal capture ring */}
                {isLegalTarget && (isLegalCapture || piece) ? (
                  <View style={styles.legalCaptureRing} />
                ) : null}

                {/* Coordinate labels */}
                {visualCol === 0 ? (
                  <Text
                    style={[
                      styles.coordLabel,
                      styles.rankLabel,
                      { color: isLight ? DARK_SQUARE : LIGHT_SQUARE },
                    ]}
                  >
                    {8 - boardRow}
                  </Text>
                ) : null}
                {visualRow === 7 ? (
                  <Text
                    style={[
                      styles.coordLabel,
                      styles.fileLabel,
                      { color: isLight ? DARK_SQUARE : LIGHT_SQUARE },
                    ]}
                  >
                    {FILES[boardCol]}
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          });
        })}
      </View>

      {/* Bottom captured pieces */}
      <CapturedPiecesRow
        pieces={effectiveFlip ? blackCaptured : whiteCaptured}
        side={effectiveFlip ? "b" : "w"}
      />

      {/* Action buttons */}
      <View style={styles.actionsRow}>
        {canAcceptDraw && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#4CAF50" }]}
            onPress={handleAcceptDraw}
          >
            <Text style={styles.actionBtnText}>Accept Draw</Text>
          </TouchableOpacity>
        )}
        {canClaimThreefold && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#FF9800" }]}
            onPress={() => handleClaimDraw("threefold")}
          >
            <Text style={styles.actionBtnText}>Claim Threefold</Text>
          </TouchableOpacity>
        )}
        {canClaimFiftyMove && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#FF9800" }]}
            onPress={() => handleClaimDraw("fiftyMove")}
          >
            <Text style={styles.actionBtnText}>Claim 50-Move</Text>
          </TouchableOpacity>
        )}
        {isSpectator && (
          <TouchableOpacity
            style={[
              styles.actionBtn,
              { backgroundColor: theme.colors.primary },
            ]}
            onPress={() => setBoardFlipped(!boardFlipped)}
          >
            <MaterialCommunityIcons
              name="rotate-3d-variant"
              size={16}
              color="#FFF"
            />
            <Text style={styles.actionBtnText}>Flip</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.actionBtn,
            { backgroundColor: theme.isDark ? "#444" : "#888" },
          ]}
          onPress={() => setShowMoveList(!showMoveList)}
        >
          <MaterialCommunityIcons
            name="format-list-numbered"
            size={16}
            color="#FFF"
          />
          <Text style={styles.actionBtnText}>Moves</Text>
        </TouchableOpacity>
      </View>

      {/* Move list panel */}
      {showMoveList && (
        <View
          style={[
            styles.moveListPanel,
            { backgroundColor: theme.isDark ? "#222" : "#fff" },
          ]}
        >
          <Text style={[styles.moveListTitle, { color: theme.colors.primary }]}>
            Move History
          </Text>
          <ScrollView style={styles.moveListScroll}>
            <Text
              style={[
                styles.moveListText,
                { color: theme.isDark ? "#ccc" : "#333" },
              ]}
            >
              {state.plyCount === 0
                ? "No moves yet"
                : `${state.plyCount} ply${state.plyCount !== 1 ? "s" : ""} played`}
              {state.lastMove?.san ? `\nLast: ${state.lastMove.san}` : ""}
            </Text>
          </ScrollView>
        </View>
      )}

      {/* Spectator banner */}
      {isSpectator && (
        <View style={styles.spectatorBanner}>
          <MaterialCommunityIcons name="eye" size={14} color="#FFF" />
          <Text style={styles.spectatorText}>Watching</Text>
        </View>
      )}

      {/* Promotion modal */}
      <Modal
        visible={promotionTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {}} // Cannot dismiss — must choose
      >
        <View style={styles.promoOverlay}>
          <View
            style={[
              styles.promoCard,
              { backgroundColor: theme.isDark ? "#333" : "#fff" },
            ]}
          >
            <Text style={[styles.promoTitle, { color: theme.colors.primary }]}>
              Choose promotion piece
            </Text>
            <View style={styles.promoRow}>
              {(["q", "r", "b", "n"] as PromotionPiece[]).map((p) => {
                const pieceName =
                  myColor === "w"
                    ? `w${p.toUpperCase()}`
                    : `b${p.toUpperCase()}`;
                return (
                  <TouchableOpacity
                    key={p}
                    style={styles.promoOption}
                    onPress={() => handlePromotionChoice(p)}
                  >
                    <Text style={styles.promoSymbol}>
                      {PIECE_SYMBOLS[pieceName] ?? "?"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// =============================================================================
// Captured Pieces Component
// =============================================================================

function CapturedPiecesRow({ pieces, side }: { pieces: Piece[]; side: Side }) {
  if (pieces.length === 0) return <View style={styles.capturedRow} />;

  // Sort by value descending
  const sorted = [...pieces].sort((a, b) => {
    const vals: Record<string, number> = { Q: 5, R: 4, B: 3, N: 2, P: 1 };
    return (vals[b[1]] ?? 0) - (vals[a[1]] ?? 0);
  });

  return (
    <View style={styles.capturedRow}>
      {sorted.map((p, i) => (
        <Text key={`${p}-${i}`} style={styles.capturedPiece}>
          {PIECE_SYMBOLS[p] ?? ""}
        </Text>
      ))}
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
    justifyContent: "center",
  },
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
  },
  statusText: {
    fontSize: 18,
    fontWeight: "700",
  },
  drawPill: {
    backgroundColor: "#FF9800",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  drawPillText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "600",
  },
  boardContainer: {
    position: "relative",
    borderRadius: 4,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  square: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  pieceText: {
    textAlign: "center",
  },
  legalMoveDot: {
    width: SQUARE_SIZE * 0.25,
    height: SQUARE_SIZE * 0.25,
    borderRadius: SQUARE_SIZE * 0.125,
    backgroundColor: LEGAL_MOVE_COLOR,
  },
  legalCaptureRing: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: SQUARE_SIZE * 0.08,
    borderColor: LEGAL_CAPTURE_COLOR,
    borderRadius: SQUARE_SIZE * 0.5,
  },
  coordLabel: {
    position: "absolute",
    fontSize: 9,
    fontWeight: "600",
  },
  rankLabel: {
    top: 1,
    left: 2,
  },
  fileLabel: {
    bottom: 1,
    right: 2,
  },
  capturedRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    minHeight: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  capturedPiece: {
    fontSize: 16,
    marginRight: 1,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  actionBtnText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "600",
  },
  moveListPanel: {
    maxHeight: 120,
    marginHorizontal: 16,
    borderRadius: 8,
    padding: 8,
    elevation: 2,
    width: "90%",
  },
  moveListTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  moveListScroll: {
    maxHeight: 80,
  },
  moveListText: {
    fontSize: 13,
    lineHeight: 18,
  },
  spectatorBanner: {
    position: "absolute",
    top: 8,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  spectatorText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "600",
  },
  promoOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  promoCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    elevation: 8,
    width: 280,
  },
  promoTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 16,
  },
  promoRow: {
    flexDirection: "row",
    gap: 16,
  },
  promoOption: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  promoSymbol: {
    fontSize: 36,
  },
});

export default withGameV4Shell(ChessUI, "chess");
