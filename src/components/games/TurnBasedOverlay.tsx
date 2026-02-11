/**
 * TurnBasedOverlay — Shared UI overlays for turn-based Colyseus multiplayer games
 *
 * Provides reusable components for:
 * - Turn indicator bar (whose turn + timer + piece color)
 * - Waiting for opponent (matchmaking)
 * - Countdown (3, 2, 1, GO!)
 * - Reconnecting indicator
 * - Draw offer dialog
 * - Resign confirmation
 * - Turn-based game over results (win/lose/draw with board context)
 * - Rematch prompt
 *
 * Used by Phase 2 turn-based game screens: TicTacToe, ConnectFour, Gomoku, Hex, Reversi
 *
 * @see docs/COLYSEUS_MULTIPLAYER_PLAN.md §8
 */

import {
  Canvas,
  Circle,
  LinearGradient,
  RoundedRect,
  Shadow,
  vec,
} from "@shopify/react-native-skia";
import React from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Text } from "react-native-paper";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// =============================================================================
// Types
// =============================================================================

export interface TurnOverlayColors {
  primary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  player1?: string;
  player2?: string;
}

const DEFAULT_P1 = "#3498db"; // Blue
const DEFAULT_P2 = "#e74c3c"; // Red

// =============================================================================
// Turn Indicator Bar — Shows at top of game screen during play
// =============================================================================

export function TurnIndicatorBar({
  isMyTurn,
  myName,
  opponentName,
  currentPlayerIndex,
  myPlayerIndex,
  turnNumber,
  myScore,
  opponentScore,
  opponentDisconnected,
  lastMoveNotation,
  colors,
  showScores = false,
  player1Label,
  player2Label,
}: {
  isMyTurn: boolean;
  myName: string;
  opponentName: string;
  currentPlayerIndex: number;
  myPlayerIndex: number;
  turnNumber: number;
  myScore?: number;
  opponentScore?: number;
  opponentDisconnected: boolean;
  lastMoveNotation?: string;
  colors: TurnOverlayColors;
  showScores?: boolean;
  player1Label?: string;
  player2Label?: string;
}) {
  const p1Color = colors.player1 ?? DEFAULT_P1;
  const p2Color = colors.player2 ?? DEFAULT_P2;
  const myColor = myPlayerIndex === 0 ? p1Color : p2Color;
  const oppColor = myPlayerIndex === 0 ? p2Color : p1Color;

  return (
    <View style={[styles.turnBar, { borderBottomColor: colors.border }]}>
      {/* My side */}
      <View style={styles.turnBarSide}>
        <View style={styles.turnBarPlayerRow}>
          <Canvas style={{ width: 14, height: 14 }}>
            <Circle cx={7} cy={7} r={6} color={myColor} />
          </Canvas>
          <Text
            style={[
              styles.turnBarLabel,
              {
                color: isMyTurn ? colors.primary : colors.textSecondary,
                fontWeight: isMyTurn ? "800" : "600",
              },
            ]}
            numberOfLines={1}
          >
            {player1Label && myPlayerIndex === 0
              ? `YOU (${player1Label})`
              : player2Label && myPlayerIndex === 1
                ? `YOU (${player2Label})`
                : "YOU"}
          </Text>
        </View>
        {showScores && (
          <Text style={[styles.turnBarScore, { color: colors.primary }]}>
            {myScore ?? 0}
          </Text>
        )}
      </View>

      {/* Center: turn indicator */}
      <View style={styles.turnBarCenter}>
        <Canvas style={{ width: 80, height: 28 }}>
          <RoundedRect x={0} y={0} width={80} height={28} r={14}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(80, 0)}
              colors={[
                isMyTurn ? colors.primary + "50" : oppColor + "50",
                isMyTurn ? colors.primary + "20" : oppColor + "20",
              ]}
            />
            <Shadow dx={0} dy={1} blur={3} color="rgba(0,0,0,0.15)" />
          </RoundedRect>
        </Canvas>
        <Text
          style={[
            styles.turnCenterText,
            {
              color: isMyTurn ? colors.primary : oppColor,
              position: "absolute",
            },
          ]}
        >
          {isMyTurn ? "YOUR TURN" : "WAITING"}
        </Text>
      </View>

      {/* Opponent side */}
      <View style={styles.turnBarSide}>
        <View style={styles.turnBarPlayerRow}>
          <Canvas style={{ width: 14, height: 14 }}>
            <Circle cx={7} cy={7} r={6} color={oppColor} />
          </Canvas>
          <Text
            style={[
              styles.turnBarLabel,
              {
                color: opponentDisconnected
                  ? "#e74c3c"
                  : !isMyTurn
                    ? colors.primary
                    : colors.textSecondary,
                fontWeight: !isMyTurn ? "800" : "600",
              },
            ]}
            numberOfLines={1}
          >
            {opponentDisconnected
              ? "⚠️ OFFLINE"
              : player1Label && myPlayerIndex !== 0
                ? `${opponentName} (${player1Label})`
                : player2Label && myPlayerIndex !== 1
                  ? `${opponentName} (${player2Label})`
                  : opponentName}
          </Text>
        </View>
        {showScores && (
          <Text style={[styles.turnBarScore, { color: colors.text }]}>
            {opponentScore ?? 0}
          </Text>
        )}
      </View>
    </View>
  );
}

// =============================================================================
// Waiting for Opponent (Matchmaking)
// =============================================================================

export function TurnBasedWaitingOverlay({
  colors,
  onCancel,
  gameName,
  visible,
}: {
  colors: TurnOverlayColors;
  onCancel: () => void;
  gameName?: string;
  visible?: boolean;
}) {
  if (visible === false) return null;
  return (
    <View
      style={[styles.overlay, { backgroundColor: colors.background + "F0" }]}
    >
      <ActivityIndicator size="large" color={colors.primary} />
      <Text
        style={[styles.overlayTitle, { color: colors.text, marginTop: 16 }]}
      >
        Waiting for Opponent...
      </Text>
      <Text
        style={[
          styles.overlaySubtext,
          { color: colors.textSecondary, marginTop: 8 },
        ]}
      >
        {gameName ? `Finding a ${gameName} match` : "Finding an opponent"}
      </Text>
      <Button
        mode="outlined"
        onPress={onCancel}
        style={{ marginTop: 24, borderColor: colors.border }}
        textColor={colors.text}
      >
        Cancel
      </Button>
    </View>
  );
}

// =============================================================================
// Countdown (3, 2, 1, GO!)
// =============================================================================

export function TurnBasedCountdownOverlay({
  countdown,
  colors,
  visible,
}: {
  countdown: number;
  colors: TurnOverlayColors;
  visible?: boolean;
}) {
  if (visible === false) return null;
  const label = countdown > 0 ? countdown.toString() : "GO!";
  const size = countdown > 0 ? 80 : 60;

  return (
    <View style={[styles.overlay, { backgroundColor: "rgba(0,0,0,0.7)" }]}>
      <Text
        style={[
          styles.countdownText,
          {
            color: countdown > 0 ? "#fff" : colors.primary,
            fontSize: size,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

// =============================================================================
// Reconnecting
// =============================================================================

export function TurnBasedReconnectingOverlay({
  colors,
  visible,
}: {
  colors: TurnOverlayColors;
  visible?: boolean;
}) {
  if (visible === false) return null;
  return (
    <View style={[styles.overlay, { backgroundColor: "rgba(0,0,0,0.75)" }]}>
      <ActivityIndicator size="large" color="#fff" />
      <Text style={[styles.overlayTitle, { color: "#fff", marginTop: 16 }]}>
        Reconnecting...
      </Text>
      <Text
        style={[
          styles.overlaySubtext,
          { color: "rgba(255,255,255,0.7)", marginTop: 8 },
        ]}
      >
        Your game is still in progress
      </Text>
    </View>
  );
}

// =============================================================================
// Draw Offer Dialog (modal)
// =============================================================================

export function DrawOfferDialog({
  visible,
  opponentName,
  isMyOffer,
  colors,
  onAccept,
  onDecline,
}: {
  visible: boolean;
  opponentName: string;
  isMyOffer: boolean;
  colors: TurnOverlayColors;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={[styles.dialogBox, { backgroundColor: colors.surface }]}>
          <Text style={[styles.dialogTitle, { color: colors.text }]}>
            {isMyOffer ? "Draw Offered" : "Draw Offer"}
          </Text>
          <Text style={[styles.dialogSubtext, { color: colors.textSecondary }]}>
            {isMyOffer
              ? `Waiting for ${opponentName} to respond...`
              : `${opponentName} is offering a draw`}
          </Text>

          {!isMyOffer && (
            <View style={styles.dialogActions}>
              <Button
                mode="contained"
                onPress={onAccept}
                style={{
                  backgroundColor: colors.primary,
                  flex: 1,
                  marginRight: 8,
                }}
                labelStyle={{ color: "#fff" }}
              >
                Accept
              </Button>
              <Button
                mode="outlined"
                onPress={onDecline}
                style={{ borderColor: colors.border, flex: 1 }}
                textColor={colors.text}
              >
                Decline
              </Button>
            </View>
          )}

          {isMyOffer && (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              style={{ marginTop: 16 }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

// =============================================================================
// Resign Confirmation Dialog (modal)
// =============================================================================

export function ResignConfirmDialog({
  visible,
  colors,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  colors: TurnOverlayColors;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={[styles.dialogBox, { backgroundColor: colors.surface }]}>
          <Text style={[styles.dialogTitle, { color: colors.text }]}>
            Resign Game?
          </Text>
          <Text style={[styles.dialogSubtext, { color: colors.textSecondary }]}>
            This will count as a loss. Are you sure?
          </Text>
          <View style={styles.dialogActions}>
            <Button
              mode="contained"
              onPress={onConfirm}
              style={{ backgroundColor: "#e74c3c", flex: 1, marginRight: 8 }}
              labelStyle={{ color: "#fff" }}
            >
              Resign
            </Button>
            <Button
              mode="outlined"
              onPress={onCancel}
              style={{ borderColor: colors.border, flex: 1 }}
              textColor={colors.text}
            >
              Cancel
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// =============================================================================
// Turn-Based Game Over Results
// =============================================================================

export function TurnBasedGameOverOverlay({
  isWinner,
  isDraw,
  winnerName,
  winReason,
  myName,
  opponentName,
  myScore,
  opponentScore,
  showScores,
  rematchRequested,
  colors,
  onRematch,
  onAcceptRematch,
  onMenu,
  onShare,
  visible,
}: {
  isWinner: boolean | null;
  isDraw: boolean;
  winnerName: string;
  winReason: string;
  myName: string;
  opponentName: string;
  myScore?: number;
  opponentScore?: number;
  showScores?: boolean;
  rematchRequested: boolean;
  colors: TurnOverlayColors;
  onRematch: () => void;
  onAcceptRematch: () => void;
  onMenu: () => void;
  onShare?: () => void;
  visible?: boolean;
}) {
  if (visible === false) return null;

  const emoji = isDraw ? "🤝" : isWinner ? "🏆" : "😔";
  const title = isDraw ? "Draw!" : isWinner ? "You Win!" : "You Lose";

  // Format win reason for display
  const formatReason = (reason: string): string => {
    switch (reason) {
      case "resignation":
        return isDraw ? "" : isWinner ? "Opponent resigned" : "You resigned";
      case "timeout":
        return isWinner ? "Opponent ran out of time" : "You ran out of time";
      case "disconnect":
        return "Opponent disconnected";
      case "draw_agreed":
        return "Draw by agreement";
      case "no_valid_moves":
        return "No more valid moves";
      default:
        return "";
    }
  };
  const reasonText = formatReason(winReason);

  return (
    <View
      style={[styles.overlay, { backgroundColor: colors.background + "F5" }]}
    >
      <Text style={{ fontSize: 48 }}>{emoji}</Text>
      <Text
        style={[
          styles.overlayTitle,
          {
            color: isDraw ? colors.text : isWinner ? colors.primary : "#e74c3c",
            marginTop: 12,
          },
        ]}
      >
        {title}
      </Text>

      {reasonText.length > 0 && (
        <Text
          style={[
            styles.overlaySubtext,
            { color: colors.textSecondary, marginTop: 6 },
          ]}
        >
          {reasonText}
        </Text>
      )}

      {/* Score comparison (for games with scores like Reversi) */}
      {showScores && myScore != null && opponentScore != null && (
        <View style={styles.resultScores}>
          <View style={styles.resultScoreCol}>
            <Text style={[styles.resultLabel, { color: colors.textSecondary }]}>
              YOU
            </Text>
            <Text style={[styles.resultValue, { color: colors.primary }]}>
              {myScore}
            </Text>
          </View>
          <Text style={[styles.resultVs, { color: colors.textSecondary }]}>
            vs
          </Text>
          <View style={styles.resultScoreCol}>
            <Text style={[styles.resultLabel, { color: colors.textSecondary }]}>
              {opponentName}
            </Text>
            <Text style={[styles.resultValue, { color: colors.text }]}>
              {opponentScore}
            </Text>
          </View>
        </View>
      )}

      {/* Rematch prompt */}
      {rematchRequested && (
        <View
          style={[styles.rematchPrompt, { backgroundColor: colors.surface }]}
        >
          <Text style={[styles.rematchText, { color: colors.primary }]}>
            {opponentName} wants a rematch!
          </Text>
          <Button
            mode="contained"
            onPress={onAcceptRematch}
            style={{ backgroundColor: colors.primary, marginTop: 8 }}
            labelStyle={{ color: "#fff" }}
          >
            Accept Rematch
          </Button>
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.resultActions}>
        <Button
          mode="contained"
          onPress={onRematch}
          style={{ backgroundColor: colors.primary, flex: 1, marginRight: 8 }}
          labelStyle={{ color: "#fff" }}
        >
          Rematch
        </Button>
        {onShare && (
          <Button
            mode="outlined"
            onPress={onShare}
            style={{ borderColor: colors.border, flex: 1, marginRight: 8 }}
            textColor={colors.text}
          >
            Share
          </Button>
        )}
        <Button
          mode="outlined"
          onPress={onMenu}
          style={{ borderColor: colors.border, flex: 1 }}
          textColor={colors.text}
        >
          Menu
        </Button>
      </View>
    </View>
  );
}

// =============================================================================
// Game Action Bar (Resign / Offer Draw buttons during gameplay)
// =============================================================================

export function GameActionBar({
  onResign,
  onOfferDraw,
  isMyTurn,
  drawPending,
  colors,
}: {
  onResign: () => void;
  onOfferDraw: () => void;
  isMyTurn: boolean;
  drawPending: boolean;
  colors: TurnOverlayColors;
}) {
  return (
    <View style={[styles.actionBar, { borderTopColor: colors.border }]}>
      <TouchableOpacity
        style={[styles.actionButton, { borderColor: "#e74c3c40" }]}
        onPress={onResign}
      >
        <Text style={[styles.actionButtonText, { color: "#e74c3c" }]}>
          🏳️ Resign
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.actionButton,
          {
            borderColor: drawPending ? colors.primary + "40" : colors.border,
            opacity: drawPending ? 0.5 : 1,
          },
        ]}
        onPress={onOfferDraw}
        disabled={drawPending}
      >
        <Text
          style={[
            styles.actionButtonText,
            { color: drawPending ? colors.textSecondary : colors.text },
          ]}
        >
          {drawPending ? "⏳ Draw Pending" : "🤝 Offer Draw"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  overlayTitle: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  overlaySubtext: {
    fontSize: 14,
    textAlign: "center",
  },
  countdownText: {
    fontWeight: "900",
    textAlign: "center",
  },

  // Turn indicator bar
  turnBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  turnBarSide: {
    alignItems: "center",
    minWidth: 80,
    maxWidth: 120,
  },
  turnBarPlayerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  turnBarLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  turnBarScore: {
    fontSize: 20,
    fontWeight: "800",
    marginTop: 2,
  },
  turnBarCenter: {
    alignItems: "center",
    justifyContent: "center",
  },
  turnCenterText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },

  // Score comparison in game over
  resultScores: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    gap: 24,
  },
  resultScoreCol: {
    alignItems: "center",
  },
  resultLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  resultValue: {
    fontSize: 36,
    fontWeight: "800",
  },
  resultVs: {
    fontSize: 16,
    fontWeight: "600",
  },
  resultActions: {
    flexDirection: "row",
    marginTop: 24,
    paddingHorizontal: 24,
    width: "100%",
  },
  rematchPrompt: {
    marginTop: 16,
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
  },
  rematchText: {
    fontSize: 14,
    fontWeight: "600",
  },

  // Dialogs
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  dialogBox: {
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  dialogSubtext: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
  },
  dialogActions: {
    flexDirection: "row",
    marginTop: 20,
    width: "100%",
  },

  // Action bar
  actionBar: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 12,
    borderTopWidth: 1,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
