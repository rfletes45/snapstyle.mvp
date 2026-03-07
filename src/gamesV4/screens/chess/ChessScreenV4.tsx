/**
 * Games V4 — Chess Game Screen (Polished)
 *
 * A premium, mobile-first chess experience featuring:
 * - Animated piece movement (slide from→to) with capture shrink/fade
 * - Animated check pulse + CHECK status pill
 * - Shared TurnStatusCard / BoardTray / InlineNotice components
 * - Haptic feedback (selectable intensity)
 * - Configurable highlights (last move, legal moves, check, coordinates)
 * - Confirm-move mode to prevent mis-taps
 * - Queued move (premove-style) while waiting
 * - Collapsible move list with full algebraic notation + replay mode
 * - Polished promotion picker with icons + labels
 * - Spectator mode with "Watching" banner + disabled input
 * - Board theme selector (6 themes including high-contrast)
 * - Material advantage chip + captured pieces display
 * - Full safe-area awareness and V4 shell integration
 *
 * @module gamesV4/screens/chess/ChessScreenV4
 */

import {
  generateLegalMoves,
  getCapturedPieces,
  getMaterialValue,
  isInCheck,
} from "@/gamesV4/adapters/chess/chessEngine";
import type {
  ChessPublicStateV1,
  PromotionPiece,
  Side,
  Square,
} from "@/gamesV4/adapters/chess/chessTypes";
import {
  indicesToSquare,
  pieceColor,
} from "@/gamesV4/adapters/chess/chessTypes";
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
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { ChessBoard } from "./ChessBoard";
import { ChessStatusPills, PlayerBar } from "./ChessHUD";
import { ChessMoveList } from "./ChessMoveList";
import { ChessPromotion } from "./ChessPromotion";
import { ChessSettingsModal } from "./ChessSettings";
import { getBoardTheme } from "./chessThemes";
import { useChessFeedback } from "./useChessFeedback";
import { useChessSettings } from "./useChessSettings";

// =============================================================================
// Chess UI Component
// =============================================================================

function ChessUI({
  publicState,
  isMyTurn,
  isTerminal,
  myUid,
  turnOrder,
  currentTurnIndex,
  settings: gameSettings,
  players,
  submitMove,
  actionLoading,
  actionError,
  sessionId,
}: GameShellProps) {
  const { theme } = useAppTheme();
  const isDark = theme.isDark;
  const state = publicState as unknown as ChessPublicStateV1 | null;

  // Chess settings (persisted)
  const { settings, updateSettings, applyPreset, loaded } = useChessSettings();
  const boardTheme = getBoardTheme(settings.boardTheme);
  const feedback = useChessFeedback(settings);

  // Player info
  const whiteUid = turnOrder[0];
  const blackUid = turnOrder[1];
  const isSpectator = myUid !== whiteUid && myUid !== blackUid;
  const myColor: Side = myUid === whiteUid ? "w" : "b";

  const whiteName =
    players.find((p) => p.uid === whiteUid)?.displayName ?? "White";
  const blackName =
    players.find((p) => p.uid === blackUid)?.displayName ?? "Black";

  // Board orientation
  const [boardFlipped, setBoardFlipped] = useState(false);
  const effectiveFlip = isSpectator ? boardFlipped : myColor === "b";

  // Selection state
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [promotionTarget, setPromotionTarget] = useState<{
    from: Square;
    to: Square;
  } | null>(null);

  // Confirm move state
  const [pendingConfirm, setPendingConfirm] = useState<{
    from: Square;
    to: Square;
    promotion?: PromotionPiece;
  } | null>(null);

  // Queued move (premove)
  const [queuedMove, setQueuedMove] = useState<{
    from: Square;
    to: Square;
    promotion?: PromotionPiece;
  } | null>(null);

  // Move list state
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [showMoveList, setShowMoveList] = useState(false);
  const [replayPly, setReplayPly] = useState<number | null>(null);

  // Settings modal
  const [showSettings, setShowSettings] = useState(false);

  // Ref to track whether promotion picker was triggered for a queued (premove) promotion
  const isQueuedPromotion = useRef(false);

  // Track ply for move history accumulation
  const prevPlyRef = useRef(0);
  const prevHapticPlyRef = useRef(0);
  const prevStateRef = useRef<ChessPublicStateV1 | null>(null);

  // ==========================================================================
  // Move history accumulation
  // ==========================================================================

  useEffect(() => {
    if (!state) return;
    if (state.plyCount > prevPlyRef.current && state.lastMove?.san) {
      setMoveHistory((prev) => {
        // Prevent duplicates on re-renders
        if (prev.length === state.plyCount) return prev;
        // If we're behind by more than 1, we may have missed moves
        // In that case, we can only append the latest — good enough for live play
        const next = [...prev];
        while (next.length < state.plyCount - 1) {
          next.push("…"); // placeholder for missed moves
        }
        if (next.length < state.plyCount) {
          next.push(state.lastMove!.san!);
        }
        return next;
      });
    }
    prevPlyRef.current = state.plyCount;
    prevStateRef.current = state;
  }, [state?.plyCount, state?.lastMove?.san]);

  // ==========================================================================
  // Queued move auto-submit
  // ==========================================================================

  useEffect(() => {
    if (!queuedMove || !isMyTurn || !state || isTerminal) return;

    // Check if queued move is still legal
    const legal = generateLegalMoves(
      state.board,
      state.sideToMove,
      state.castling,
      state.enPassant,
    );
    // When the user chose a promotion piece, match that specific variant;
    // otherwise, pick the first matching legal move (defaults to queen promo).
    const match = legal.find(
      (m) =>
        m.from === queuedMove.from &&
        m.to === queuedMove.to &&
        (!queuedMove.promotion || m.promotion === queuedMove.promotion),
    );

    if (match) {
      // Auto-submit — use the ENGINE's promotion value (authoritative)
      feedback.onQueueSubmitted();
      submitMove({
        action: "move",
        from: match.from,
        to: match.to,
        promotion: match.promotion,
      });
      setQueuedMove(null);
      setSelectedSquare(null);
    } else {
      // Queued move no longer legal
      feedback.onQueueCancelled();
      setQueuedMove(null);
    }
  }, [isMyTurn, state?.plyCount]);

  // ==========================================================================
  // Haptic feedback on state changes
  // ==========================================================================

  useEffect(() => {
    if (!state) return;
    if (state.plyCount <= prevHapticPlyRef.current) return;
    prevHapticPlyRef.current = state.plyCount;

    // Check if last move was a capture
    if (state.lastMove?.captured) {
      feedback.onCapture();
    } else {
      feedback.onMoveCommit();
    }

    // Check if king is now in check
    if (isInCheck(state.board, state.sideToMove) && !state.terminal) {
      setTimeout(() => feedback.onCheck(), 100);
    }

    // Check for game end
    if (state.terminal) {
      const isWin =
        state.terminal.type === "win" &&
        state.terminal.winnerUids?.includes(myUid);
      const isLoss =
        state.terminal.type === "win" &&
        !state.terminal.winnerUids?.includes(myUid) &&
        !isSpectator;

      setTimeout(() => {
        if (isWin) feedback.onCheckmate();
        else if (isLoss) feedback.onGameLost();
      }, 200);
    }
  }, [state?.plyCount]);

  // ==========================================================================
  // Clear selection on turn change + clean up on game end
  // ==========================================================================

  useEffect(() => {
    if (!isMyTurn) {
      setSelectedSquare(null);
      setPendingConfirm(null);
    }
  }, [isMyTurn]);

  useEffect(() => {
    if (isTerminal) {
      setQueuedMove(null);
      setPendingConfirm(null);
      setSelectedSquare(null);
    }
  }, [isTerminal]);

  // ==========================================================================
  // Square tap handler
  // ==========================================================================

  const canInteract = isMyTurn && !isTerminal && !isSpectator && !actionLoading;

  const handleSquareTap = useCallback(
    (row: number, col: number) => {
      if (!state || isTerminal || actionLoading) return;

      const sq = indicesToSquare(row, col);
      const piece = state.board[row][col];

      // If we're in replay mode, jump to live first
      if (replayPly !== null) {
        setReplayPly(null);
        return;
      }

      // SPECTATOR: no interaction
      if (isSpectator) return;

      // NOT MY TURN: handle premove queue
      if (!isMyTurn) {
        if (!settings.queueMove) return;

        // If tapping on own piece, select for premove
        if (piece && pieceColor(piece) === myColor) {
          feedback.onPieceSelect();
          setSelectedSquare(sq === selectedSquare ? null : sq);
          // Clear any existing queued move when re-selecting
          setQueuedMove(null);
          return;
        }

        // If piece selected and tapping a target square, validate and queue
        if (selectedSquare) {
          // Validate premove: generate legal moves as if it were our turn right now
          const hypotheticalLegal = generateLegalMoves(
            state.board,
            myColor,
            state.castling,
            state.enPassant,
          );
          const targets = hypotheticalLegal.filter(
            (m) => m.from === selectedSquare && m.to === sq,
          );

          if (targets.length === 0) {
            // Not a valid premove target
            feedback.onIllegalMove();
            setSelectedSquare(null);
            return;
          }

          // Check if this is a promotion move — show picker first
          const isPromotion = targets.some((m) => m.promotion);
          if (isPromotion) {
            isQueuedPromotion.current = true;
            setPromotionTarget({ from: selectedSquare, to: sq });
            setSelectedSquare(null);
            return;
          }

          feedback.onQueueMove();
          setQueuedMove({ from: selectedSquare, to: sq });
          setSelectedSquare(null);
          return;
        }
        return;
      }

      // MY TURN: normal interaction
      // If tapping on a legal move target of the selected piece
      if (selectedSquare) {
        const legal = generateLegalMoves(
          state.board,
          state.sideToMove,
          state.castling,
          state.enPassant,
        ).filter((m) => m.from === selectedSquare);

        const target = legal.find((m) => m.to === sq);
        if (target) {
          // Check if promotion needed
          if (target.promotion) {
            setPromotionTarget({ from: selectedSquare, to: sq });
            return;
          }

          // Check if confirm mode is on
          if (settings.confirmMove) {
            setPendingConfirm({ from: selectedSquare, to: sq });
            return;
          }

          // Submit immediately
          feedback.onMoveCommit();
          submitMove({
            action: "move",
            from: selectedSquare,
            to: sq,
          });
          setSelectedSquare(null);
          return;
        }
      }

      // If tapping on own piece, select it
      if (piece && pieceColor(piece) === myColor) {
        feedback.onPieceSelect();
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
      myColor,
      settings.confirmMove,
      settings.queueMove,
      replayPly,
      submitMove,
      feedback,
    ],
  );

  // ==========================================================================
  // Confirm / cancel pending move
  // ==========================================================================

  const handleConfirmMove = useCallback(() => {
    if (!pendingConfirm) return;
    feedback.onConfirmMove();
    submitMove({
      action: "move",
      from: pendingConfirm.from,
      to: pendingConfirm.to,
      promotion: pendingConfirm.promotion,
    });
    setPendingConfirm(null);
    setSelectedSquare(null);
  }, [pendingConfirm, submitMove, feedback]);

  const handleCancelMove = useCallback(() => {
    setPendingConfirm(null);
  }, []);

  // ==========================================================================
  // Promotion handler
  // ==========================================================================

  const handlePromotionChoice = useCallback(
    (piece: PromotionPiece) => {
      if (!promotionTarget) return;
      feedback.onPromotionSelect();

      // Queued (premove) promotion — store as queued move with the chosen piece
      if (isQueuedPromotion.current) {
        isQueuedPromotion.current = false;
        feedback.onQueueMove();
        setQueuedMove({
          from: promotionTarget.from,
          to: promotionTarget.to,
          promotion: piece,
        });
        setPromotionTarget(null);
        return;
      }

      // If confirm mode, go to confirm state
      if (settings.confirmMove) {
        setPendingConfirm({
          from: promotionTarget.from,
          to: promotionTarget.to,
          promotion: piece,
        });
        setPromotionTarget(null);
        setSelectedSquare(null);
        return;
      }

      // Submit directly (promotion selection IS the confirmation)
      submitMove({
        action: "move",
        from: promotionTarget.from,
        to: promotionTarget.to,
        promotion: piece,
      });
      setPromotionTarget(null);
      setSelectedSquare(null);
    },
    [promotionTarget, settings.confirmMove, submitMove, feedback],
  );

  // ==========================================================================
  // Drag-to-move handler (combines select + move in one gesture)
  // ==========================================================================

  const handleDragMove = useCallback(
    (fromRow: number, fromCol: number, toRow: number, toCol: number) => {
      if (!state || isTerminal || actionLoading || isSpectator) return;

      // Exit replay mode on any drag interaction
      if (replayPly !== null) {
        setReplayPly(null);
        return;
      }

      const from = indicesToSquare(fromRow, fromCol);
      const to = indicesToSquare(toRow, toCol);
      const piece = state.board[fromRow][fromCol];

      // Dropped on same square — treat as a tap (select/deselect)
      if (from === to) {
        if (piece && pieceColor(piece) === myColor) {
          setSelectedSquare((prev) => (prev === from ? null : from));
        }
        return;
      }

      if (!piece || pieceColor(piece) !== myColor) return;

      // NOT MY TURN: queued premove via drag
      if (!isMyTurn) {
        if (!settings.queueMove) return;
        const hypotheticalLegal = generateLegalMoves(
          state.board,
          myColor,
          state.castling,
          state.enPassant,
        );
        const targets = hypotheticalLegal.filter(
          (m) => m.from === from && m.to === to,
        );
        if (targets.length === 0) {
          feedback.onIllegalMove();
          return;
        }
        if (targets.some((m) => m.promotion)) {
          isQueuedPromotion.current = true;
          setPromotionTarget({ from, to });
          return;
        }
        feedback.onQueueMove();
        setQueuedMove({ from, to });
        return;
      }

      // MY TURN: normal move via drag
      const legal = generateLegalMoves(
        state.board,
        state.sideToMove,
        state.castling,
        state.enPassant,
      ).filter((m) => m.from === from);

      const target = legal.find((m) => m.to === to);
      if (!target) {
        feedback.onIllegalMove();
        return;
      }

      if (target.promotion) {
        setPromotionTarget({ from, to });
        return;
      }

      if (settings.confirmMove) {
        setPendingConfirm({ from, to });
        return;
      }

      feedback.onMoveCommit();
      submitMove({ action: "move", from, to });
      setSelectedSquare(null);
    },
    [
      state,
      isTerminal,
      actionLoading,
      isSpectator,
      isMyTurn,
      myColor,
      settings.queueMove,
      settings.confirmMove,
      submitMove,
      feedback,
      replayPly,
    ],
  );

  // ==========================================================================
  // Cancel queued move handler
  // ==========================================================================

  const handleCancelQueue = useCallback(() => {
    feedback.onQueueCancelled();
    setQueuedMove(null);
  }, [feedback]);

  // ==========================================================================
  // Draw actions
  // ==========================================================================

  const handleAcceptDraw = useCallback(() => {
    if (!state || isTerminal) return;
    if (state.pendingDrawOfferByUid && state.pendingDrawOfferByUid !== myUid) {
      submitMove({ action: "acceptDraw" });
    }
  }, [state, isTerminal, myUid, submitMove]);

  const handleClaimDraw = useCallback(
    (claim: "threefold" | "fiftyMove") => {
      if (!state || isTerminal || !isMyTurn) return;
      submitMove({ action: "claimDraw", claim });
    },
    [state, isTerminal, isMyTurn, submitMove],
  );

  // ==========================================================================
  // Replay mode handler
  // ==========================================================================

  const handleJumpToPly = useCallback((ply: number | null) => {
    setReplayPly(ply);
  }, []);

  // ==========================================================================
  // Render
  // ==========================================================================

  if (!state || !loaded) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <Text style={{ color: theme.colors.primary }}>Loading…</Text>
      </View>
    );
  }

  // Compute derived state
  const kingInCheck =
    isInCheck(state.board, state.sideToMove) && !state.terminal;
  const whiteMaterial = getMaterialValue(state.board, "w");
  const blackMaterial = getMaterialValue(state.board, "b");
  const materialDiff = whiteMaterial - blackMaterial;
  const whiteCaptured = getCapturedPieces(state.board, "w");
  const blackCaptured = getCapturedPieces(state.board, "b");

  // Status text for TurnStatusCard
  const statusText = (() => {
    if (state.terminal) {
      if (state.terminal.type === "win") {
        const winnerId = state.terminal.winnerUids?.[0];
        const winnerIsMe = winnerId === myUid;
        if (isSpectator) return "Game Over";
        return winnerIsMe ? "You win!" : "You lose";
      }
      return `Draw — ${state.terminal.reason.replace(/_/g, " ")}`;
    }
    if (isSpectator) {
      return state.sideToMove === "w" ? "White to move" : "Black to move";
    }
    if (isMyTurn) {
      return kingInCheck ? "Your turn — Check!" : "Your turn";
    }
    return "Waiting for opponent…";
  })();

  const statusColor = state.terminal
    ? state.terminal.type === "win" &&
      state.terminal.winnerUids?.includes(myUid)
      ? "#4CAF50"
      : state.terminal.type === "draw"
        ? undefined
        : "#E53935"
    : undefined;

  // TurnStatusCard player chips
  const localChip: PlayerChipProps = {
    displayName: myColor === "w" ? whiteName : blackName,
    markLabel: myColor === "w" ? "W" : "B",
    markColor: myColor === "w" ? "#E8E8E8" : "#333",
    isActive: isMyTurn,
    isLocal: true,
  };

  const opponentChip: PlayerChipProps = {
    displayName: myColor === "w" ? blackName : whiteName,
    markLabel: myColor === "w" ? "B" : "W",
    markColor: myColor === "w" ? "#333" : "#E8E8E8",
    isActive: !isMyTurn && !isTerminal,
    isLocal: false,
  };

  // If spectator, show both as non-local
  const leftChip = isSpectator
    ? {
        ...localChip,
        displayName: whiteName,
        markLabel: "W",
        markColor: "#E8E8E8",
        isLocal: false,
        isActive: state.sideToMove === "w" && !isTerminal,
      }
    : localChip;
  const rightChip = isSpectator
    ? {
        ...opponentChip,
        displayName: blackName,
        markLabel: "B",
        markColor: "#333",
        isLocal: false,
        isActive: state.sideToMove === "b" && !isTerminal,
      }
    : opponentChip;

  // Draw action state
  const canAcceptDraw =
    state.pendingDrawOfferByUid &&
    state.pendingDrawOfferByUid !== myUid &&
    isMyTurn &&
    !isTerminal;
  const canClaimThreefold =
    isMyTurn &&
    !isTerminal &&
    (state.repetitionCounts[state.positionHash] ?? 0) >= 3;
  const canClaimFiftyMove =
    isMyTurn && !isTerminal && state.halfmoveClock >= 100;

  // Top player (opponent from current player's perspective)
  const topSide: Side = effectiveFlip ? "w" : "b";
  const bottomSide: Side = effectiveFlip ? "b" : "w";
  const topName = topSide === "w" ? whiteName : blackName;
  const bottomName = bottomSide === "w" ? whiteName : blackName;
  const topIsActive =
    !isTerminal &&
    ((topSide === "w" && state.sideToMove === "w") ||
      (topSide === "b" && state.sideToMove === "b"));
  const bottomIsActive = !isTerminal && !topIsActive;

  // Inline notice
  const noticeMessage = (() => {
    if (actionError) return actionError;
    if (replayPly !== null) return "Replaying — tap board to return to live";
    if (queuedMove) return "Move queued — will submit when it's your turn";
    if (pendingConfirm) return "Confirm your move below";
    return null;
  })();
  const noticeSeverity = actionError
    ? ("error" as const)
    : replayPly !== null
      ? ("warning" as const)
      : ("info" as const);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? "#1A1A1A" : "#F5F5F5" },
      ]}
    >
      {/* Turn Status Card */}
      <TurnStatusCard
        statusText={statusText}
        subtitle={
          isTerminal ? state.terminal?.reason?.replace(/_/g, " ") : undefined
        }
        localPlayer={leftChip}
        opponentPlayer={rightChip}
        isLocalTurn={isMyTurn}
        isTerminal={isTerminal}
        statusColor={statusColor}
      />

      {/* Status pills (CHECK, DRAW, etc.) */}
      <ChessStatusPills
        state={state}
        isMyTurn={isMyTurn}
        isSpectator={isSpectator}
        myUid={myUid}
        kingInCheck={kingInCheck}
      />

      {/* Top player bar */}
      <PlayerBar
        displayName={topName}
        side={topSide}
        isActive={topIsActive}
        captured={topSide === "w" ? blackCaptured : whiteCaptured}
        materialAdvantage={
          topSide === "w"
            ? Math.max(0, materialDiff)
            : Math.max(0, -materialDiff)
        }
        boardTheme={boardTheme}
      />

      {/* Board */}
      <BoardTray padding={4}>
        <ChessBoard
          state={state}
          boardTheme={boardTheme}
          settings={settings}
          selectedSquare={selectedSquare}
          queuedFrom={queuedMove?.from ?? null}
          queuedTo={queuedMove?.to ?? null}
          flipped={effectiveFlip}
          myColor={myColor}
          canInteract={canInteract}
          isTerminal={isTerminal}
          isSpectator={isSpectator}
          onSquareTap={handleSquareTap}
          onDragMove={handleDragMove}
        />
      </BoardTray>

      {/* Bottom player bar */}
      <PlayerBar
        displayName={bottomName}
        side={bottomSide}
        isActive={bottomIsActive}
        captured={bottomSide === "w" ? blackCaptured : whiteCaptured}
        materialAdvantage={
          bottomSide === "w"
            ? Math.max(0, materialDiff)
            : Math.max(0, -materialDiff)
        }
        boardTheme={boardTheme}
      />

      {/* Queued move cancel bar */}
      {queuedMove && !pendingConfirm && (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(100)}
          style={styles.confirmBar}
        >
          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: "#F57C00" }]}
            onPress={handleCancelQueue}
          >
            <MaterialCommunityIcons name="close" size={20} color="#FFF" />
            <Text style={styles.confirmBtnText}>Cancel Queue</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Confirm move bar */}
      {pendingConfirm && (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(100)}
          style={styles.confirmBar}
        >
          <TouchableOpacity
            style={[styles.confirmBtn, styles.cancelBtn]}
            onPress={handleCancelMove}
          >
            <MaterialCommunityIcons name="close" size={20} color="#FFF" />
            <Text style={styles.confirmBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmBtn, styles.acceptBtn]}
            onPress={handleConfirmMove}
          >
            <MaterialCommunityIcons name="check" size={20} color="#FFF" />
            <Text style={styles.confirmBtnText}>Confirm</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Action buttons row */}
      <View style={styles.actionsRow}>
        {canAcceptDraw && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#4CAF50" }]}
            onPress={handleAcceptDraw}
          >
            <MaterialCommunityIcons name="handshake" size={14} color="#FFF" />
            <Text style={styles.actionBtnText}>Accept Draw</Text>
          </TouchableOpacity>
        )}
        {canClaimThreefold && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#2196F3" }]}
            onPress={() => handleClaimDraw("threefold")}
          >
            <Text style={styles.actionBtnText}>Claim Threefold</Text>
          </TouchableOpacity>
        )}
        {canClaimFiftyMove && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#2196F3" }]}
            onPress={() => handleClaimDraw("fiftyMove")}
          >
            <Text style={styles.actionBtnText}>Claim 50-Move</Text>
          </TouchableOpacity>
        )}
        {isSpectator && (
          <TouchableOpacity
            style={[
              styles.actionBtn,
              { backgroundColor: isDark ? "#444" : "#888" },
            ]}
            onPress={() => setBoardFlipped(!boardFlipped)}
          >
            <MaterialCommunityIcons
              name="rotate-3d-variant"
              size={14}
              color="#FFF"
            />
            <Text style={styles.actionBtnText}>Flip</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.actionBtn,
            { backgroundColor: isDark ? "#333" : "#777" },
          ]}
          onPress={() => setShowMoveList(!showMoveList)}
        >
          <MaterialCommunityIcons
            name="format-list-numbered"
            size={14}
            color="#FFF"
          />
          <Text style={styles.actionBtnText}>Moves</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.actionBtn,
            { backgroundColor: isDark ? "#333" : "#777" },
          ]}
          onPress={() => setShowSettings(true)}
        >
          <MaterialCommunityIcons name="cog" size={14} color="#FFF" />
          <Text style={styles.actionBtnText}>Options</Text>
        </TouchableOpacity>
      </View>

      {/* Inline notice */}
      {noticeMessage && (
        <InlineNotice
          message={noticeMessage}
          severity={noticeSeverity}
          dismissAfterMs={actionError ? 4000 : 0}
        />
      )}

      {/* Move list overlay (absolute — doesn't shift board layout) */}
      <View style={styles.moveListOverlay} pointerEvents="box-none">
        <ChessMoveList
          moveHistory={moveHistory}
          visible={showMoveList && !pendingConfirm && !queuedMove}
          onToggle={() => setShowMoveList(!showMoveList)}
          replayPly={replayPly}
          onJumpToPly={handleJumpToPly}
        />
      </View>

      {/* Promotion picker */}
      <ChessPromotion
        visible={promotionTarget !== null}
        side={myColor}
        onChoose={handlePromotionChoice}
        onCancel={() => {
          isQueuedPromotion.current = false;
          setPromotionTarget(null);
        }}
      />

      {/* Settings modal */}
      <ChessSettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onUpdate={updateSettings}
        onApplyPreset={applyPreset}
      />
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
    gap: 4,
    paddingHorizontal: 4,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 4,
  },
  actionBtnText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "600",
  },
  confirmBar: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 6,
  },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  cancelBtn: {
    backgroundColor: "#E53935",
  },
  acceptBtn: {
    backgroundColor: "#4CAF50",
  },
  confirmBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
  },
  moveListOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 50,
  },
});

export default withGameV4Shell(ChessUI, "chess");
