/**
 * MultiplayerOverlay — Shared UI overlays for Colyseus multiplayer games
 *
 * Provides reusable components for:
 * - Waiting for opponent
 * - Countdown (3, 2, 1, GO!)
 * - Opponent score display
 * - Reconnecting indicator
 * - Game over results
 * - Rematch prompt
 *
 * Used by all 8 quick-play game screens when in multiplayer mode.
 */

import {
  Canvas,
  LinearGradient,
  RoundedRect,
  Shadow,
  vec,
} from "@shopify/react-native-skia";
import React from "react";
import { ActivityIndicator, Dimensions, StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// =============================================================================
// Types
// =============================================================================

interface OverlayColors {
  primary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
}

// =============================================================================
// Waiting for Opponent
// =============================================================================

export function WaitingOverlay({
  colors,
  onCancel,
  visible,
}: {
  colors: OverlayColors;
  onCancel: () => void;
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
        Finding a match
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

export function CountdownOverlay({
  countdown,
  count,
  colors,
  visible,
}: {
  countdown?: number;
  count?: number;
  colors: OverlayColors;
  visible?: boolean;
}) {
  if (visible === false) return null;
  const value = countdown ?? count ?? 0;
  const label = value > 0 ? value.toString() : "GO!";
  const size = value > 0 ? 80 : 60;

  return (
    <View style={[styles.overlay, { backgroundColor: "rgba(0,0,0,0.7)" }]}>
      <Text
        style={[
          styles.countdownText,
          {
            color: value > 0 ? "#fff" : colors.primary,
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
// Opponent Score Bar — Shows at top of game screen during play
// =============================================================================

export function OpponentScoreBar({
  opponentName,
  opponentScore,
  myScore,
  timeRemaining,
  opponentDisconnected,
  colors,
}: {
  opponentName: string;
  opponentScore: number;
  myScore: number;
  timeRemaining: number;
  opponentDisconnected: boolean;
  colors: OverlayColors;
}) {
  const timeSeconds = Math.ceil(timeRemaining / 1000);

  return (
    <View style={[styles.scoreBar, { borderBottomColor: colors.border }]}>
      {/* My score */}
      <View style={styles.scoreBarSide}>
        <Text style={[styles.scoreBarLabel, { color: colors.textSecondary }]}>
          YOU
        </Text>
        <Text style={[styles.scoreBarValue, { color: colors.primary }]}>
          {myScore}
        </Text>
      </View>

      {/* Timer */}
      <View style={styles.scoreBarCenter}>
        <Canvas style={{ width: 60, height: 32 }}>
          <RoundedRect x={0} y={0} width={60} height={32} r={16}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(60, 0)}
              colors={[colors.primary + "40", colors.primary + "20"]}
            />
            <Shadow dx={0} dy={1} blur={4} color="rgba(0,0,0,0.2)" />
          </RoundedRect>
        </Canvas>
        <Text
          style={[
            styles.timerText,
            {
              color: timeSeconds <= 5 ? "#e74c3c" : colors.text,
              position: "absolute",
            },
          ]}
        >
          {timeSeconds}s
        </Text>
      </View>

      {/* Opponent score */}
      <View style={styles.scoreBarSide}>
        <Text
          style={[
            styles.scoreBarLabel,
            {
              color: opponentDisconnected ? "#e74c3c" : colors.textSecondary,
            },
          ]}
          numberOfLines={1}
        >
          {opponentDisconnected ? "⚠️ OFFLINE" : opponentName}
        </Text>
        <Text style={[styles.scoreBarValue, { color: colors.text }]}>
          {opponentScore}
        </Text>
      </View>
    </View>
  );
}

// =============================================================================
// Reconnecting Overlay
// =============================================================================

export function ReconnectingOverlay({
  colors,
  visible,
}: {
  colors: OverlayColors;
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
        Please wait while we restore your connection
      </Text>
    </View>
  );
}

// =============================================================================
// Game Over Results
// =============================================================================

export function GameOverOverlay({
  isWinner,
  isTie,
  winnerName,
  myScore,
  opponentScore,
  opponentName,
  rematchRequested,
  colors,
  onPlayAgain,
  onRematch,
  onAcceptRematch,
  onMenu,
  onShare,
  visible,
}: {
  isWinner: boolean | null;
  isTie: boolean;
  winnerName: string;
  myScore: number;
  opponentScore: number;
  opponentName: string;
  rematchRequested: boolean;
  colors: OverlayColors;
  onPlayAgain: () => void;
  onRematch: () => void;
  onAcceptRematch: () => void;
  onMenu: () => void;
  onShare?: () => void;
  visible?: boolean;
}) {
  if (visible === false) return null;
  const emoji = isTie ? "🤝" : isWinner ? "🏆" : "😔";
  const title = isTie ? "It's a Tie!" : isWinner ? "You Win!" : "You Lose";

  return (
    <View
      style={[styles.overlay, { backgroundColor: colors.background + "F5" }]}
    >
      <Text style={{ fontSize: 48 }}>{emoji}</Text>
      <Text
        style={[
          styles.overlayTitle,
          {
            color: isTie ? colors.text : isWinner ? colors.primary : "#e74c3c",
            marginTop: 12,
          },
        ]}
      >
        {title}
      </Text>

      {/* Score comparison */}
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

      {/* Rematch prompt */}
      {rematchRequested && (
        <View style={styles.rematchPrompt}>
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
  scoreBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  scoreBarSide: {
    alignItems: "center",
    minWidth: 80,
  },
  scoreBarCenter: {
    alignItems: "center",
    justifyContent: "center",
  },
  scoreBarLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  scoreBarValue: {
    fontSize: 24,
    fontWeight: "800",
  },
  timerText: {
    fontSize: 14,
    fontWeight: "700",
  },
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
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  rematchText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
