/**
 * ScoreRaceOverlay — Unified multiplayer overlay for Phase 4 physics / real-time games
 *
 * Combines all game phases into a single component:
 * - Connecting: spinner while joining server
 * - Waiting: matchmaking / waiting for opponent
 * - Countdown: 3, 2, 1, GO!
 * - Playing: shows opponent score bar at top (handled by parent; overlay hidden)
 * - Finished: game over results with win/lose/tie, rematch, and leave
 * - Error: connection error with retry
 * - Reconnecting: reconnection spinner
 *
 * Used by Phase 4 game screens: Pong, Snake, BounceBlitz, BrickBreaker, Race
 *
 * @see docs/COLYSEUS_MULTIPLAYER_PLAN.md §11
 */

import {
  Canvas,
  LinearGradient,
  RoundedRect,
  Shadow,
  vec,
} from "@shopify/react-native-skia";
import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  StyleSheet,
  View,
} from "react-native";
import { Button, Text } from "react-native-paper";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// =============================================================================
// Types
// =============================================================================

export type ScoreRaceOverlayPhase =
  | "connecting"
  | "waiting"
  | "countdown"
  | "playing"
  | "finished"
  | "error"
  | "idle"
  | "reconnecting";

export interface ScoreRaceOverlayProps {
  /** Current phase of the multiplayer session */
  phase: ScoreRaceOverlayPhase;
  /** Countdown value (3, 2, 1, 0) */
  countdown: number;
  /** Player's score */
  myScore: number;
  /** Opponent's score */
  opponentScore: number;
  /** Opponent display name */
  opponentName: string;
  /** Whether the local player won */
  isWinner: boolean | null;
  /** Whether the result is a tie */
  isTie: boolean;
  /** Display name of the winner */
  winnerName: string;
  /** Called when player is ready (e.g. after countdown) */
  onReady: () => void;
  /** Called when player requests rematch */
  onRematch: () => void;
  /** Called to accept opponent's rematch request */
  onAcceptRematch: () => void;
  /** Called when player wants to leave the session */
  onLeave: () => void | Promise<void>;
  /** Whether the opponent requested a rematch */
  rematchRequested: boolean;
  /** Whether the client is reconnecting */
  reconnecting: boolean;
  /** Whether the opponent is currently disconnected */
  opponentDisconnected: boolean;
}

// Theme colors for the overlay
const COLORS = {
  primary: "#7C3AED", // Purple accent
  background: "#1a1a2e",
  surface: "#25253e",
  text: "#FFFFFF",
  textSecondary: "rgba(255, 255, 255, 0.6)",
  border: "rgba(255, 255, 255, 0.1)",
  win: "#10B981",
  lose: "#EF4444",
  tie: "#F59E0B",
};

// =============================================================================
// Main Component
// =============================================================================

export default function ScoreRaceOverlay({
  phase,
  countdown,
  myScore,
  opponentScore,
  opponentName,
  isWinner,
  isTie,
  winnerName,
  onReady,
  onRematch,
  onAcceptRematch,
  onLeave,
  rematchRequested,
  reconnecting,
  opponentDisconnected,
}: ScoreRaceOverlayProps) {
  // Don't render anything during playing or idle
  if (phase === "playing" || phase === "idle") {
    // But show reconnecting banner if needed
    if (reconnecting) {
      return <ReconnectingBanner />;
    }
    if (opponentDisconnected) {
      return <OpponentDisconnectedBanner />;
    }
    return null;
  }

  if (phase === "reconnecting" || reconnecting) {
    return <ReconnectingOverlay />;
  }

  if (phase === "connecting") {
    return <ConnectingOverlay />;
  }

  if (phase === "waiting") {
    return <WaitingOverlay onCancel={onLeave} />;
  }

  if (phase === "countdown") {
    return <CountdownOverlay countdown={countdown} />;
  }

  if (phase === "error") {
    return <ErrorOverlay onRetry={onReady} onLeave={onLeave} />;
  }

  if (phase === "finished") {
    return (
      <FinishedOverlay
        isWinner={isWinner}
        isTie={isTie}
        winnerName={winnerName}
        myScore={myScore}
        opponentScore={opponentScore}
        opponentName={opponentName}
        rematchRequested={rematchRequested}
        onRematch={onRematch}
        onAcceptRematch={onAcceptRematch}
        onLeave={onLeave}
      />
    );
  }

  return null;
}

// =============================================================================
// Connecting
// =============================================================================

function ConnectingOverlay() {
  return (
    <View
      style={[styles.overlay, { backgroundColor: COLORS.background + "F0" }]}
    >
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text
        style={[styles.overlayTitle, { color: COLORS.text, marginTop: 16 }]}
      >
        Connecting...
      </Text>
      <Text
        style={[
          styles.overlaySubtext,
          { color: COLORS.textSecondary, marginTop: 8 },
        ]}
      >
        Setting up multiplayer
      </Text>
    </View>
  );
}

// =============================================================================
// Waiting for Opponent
// =============================================================================

function WaitingOverlay({
  onCancel,
}: {
  onCancel: () => void | Promise<void>;
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <View
      style={[styles.overlay, { backgroundColor: COLORS.background + "F5" }]}
    >
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <Text style={{ fontSize: 48 }}>⚔️</Text>
      </Animated.View>
      <Text
        style={[styles.overlayTitle, { color: COLORS.text, marginTop: 16 }]}
      >
        Waiting for Opponent...
      </Text>
      <Text
        style={[
          styles.overlaySubtext,
          { color: COLORS.textSecondary, marginTop: 8 },
        ]}
      >
        Finding a match for you
      </Text>
      <ActivityIndicator
        size="small"
        color={COLORS.primary}
        style={{ marginTop: 16 }}
      />
      <Button
        mode="outlined"
        onPress={onCancel}
        style={{
          marginTop: 24,
          borderColor: COLORS.border,
          borderRadius: 24,
        }}
        textColor={COLORS.text}
      >
        Cancel
      </Button>
    </View>
  );
}

// =============================================================================
// Countdown (3, 2, 1, GO!)
// =============================================================================

function CountdownOverlay({ countdown }: { countdown: number }) {
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    scaleAnim.setValue(0.5);
    opacityAnim.setValue(0);
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [countdown, scaleAnim, opacityAnim]);

  const label = countdown > 0 ? countdown.toString() : "GO!";
  const color = countdown > 0 ? "#FFFFFF" : COLORS.primary;
  const size = countdown > 0 ? 96 : 72;

  return (
    <View style={[styles.overlay, { backgroundColor: "rgba(0,0,0,0.8)" }]}>
      <Animated.View
        style={{
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        }}
      >
        <Text style={[styles.countdownText, { color, fontSize: size }]}>
          {label}
        </Text>
      </Animated.View>
      {countdown > 0 && (
        <Text
          style={[
            styles.overlaySubtext,
            { color: COLORS.textSecondary, marginTop: 24 },
          ]}
        >
          Get ready!
        </Text>
      )}
    </View>
  );
}

// =============================================================================
// Reconnecting (full overlay)
// =============================================================================

function ReconnectingOverlay() {
  return (
    <View style={[styles.overlay, { backgroundColor: "rgba(0,0,0,0.8)" }]}>
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
// Reconnecting Banner (shown during playing phase)
// =============================================================================

function ReconnectingBanner() {
  return (
    <View style={styles.banner}>
      <ActivityIndicator size="small" color="#fff" />
      <Text style={styles.bannerText}>Reconnecting...</Text>
    </View>
  );
}

// =============================================================================
// Opponent Disconnected Banner (shown during playing phase)
// =============================================================================

function OpponentDisconnectedBanner() {
  return (
    <View style={[styles.banner, { backgroundColor: "#EF444490" }]}>
      <Text style={styles.bannerText}>⚠️ Opponent disconnected</Text>
    </View>
  );
}

// =============================================================================
// Error Overlay
// =============================================================================

function ErrorOverlay({
  onRetry,
  onLeave,
}: {
  onRetry: () => void;
  onLeave: () => void | Promise<void>;
}) {
  return (
    <View
      style={[styles.overlay, { backgroundColor: COLORS.background + "F5" }]}
    >
      <Text style={{ fontSize: 48 }}>😵</Text>
      <Text
        style={[styles.overlayTitle, { color: COLORS.lose, marginTop: 12 }]}
      >
        Connection Error
      </Text>
      <Text
        style={[
          styles.overlaySubtext,
          { color: COLORS.textSecondary, marginTop: 8 },
        ]}
      >
        Could not connect to the game server
      </Text>
      <View style={styles.resultActions}>
        <Button
          mode="contained"
          onPress={onRetry}
          style={{
            backgroundColor: COLORS.primary,
            flex: 1,
            marginRight: 8,
            borderRadius: 24,
          }}
          labelStyle={{ color: "#fff" }}
        >
          Retry
        </Button>
        <Button
          mode="outlined"
          onPress={onLeave}
          style={{
            borderColor: COLORS.border,
            flex: 1,
            borderRadius: 24,
          }}
          textColor={COLORS.text}
        >
          Leave
        </Button>
      </View>
    </View>
  );
}

// =============================================================================
// Finished / Game Over
// =============================================================================

function FinishedOverlay({
  isWinner,
  isTie,
  winnerName,
  myScore,
  opponentScore,
  opponentName,
  rematchRequested,
  onRematch,
  onAcceptRematch,
  onLeave,
}: {
  isWinner: boolean | null;
  isTie: boolean;
  winnerName: string;
  myScore: number;
  opponentScore: number;
  opponentName: string;
  rematchRequested: boolean;
  onRematch: () => void;
  onAcceptRematch: () => void;
  onLeave: () => void | Promise<void>;
}) {
  const slideAnim = useRef(new Animated.Value(50)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 6,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideAnim, fadeAnim]);

  const emoji = isTie ? "🤝" : isWinner ? "🏆" : "😔";
  const title = isTie ? "It's a Tie!" : isWinner ? "You Win!" : "You Lose";
  const titleColor = isTie ? COLORS.tie : isWinner ? COLORS.win : COLORS.lose;

  return (
    <View
      style={[styles.overlay, { backgroundColor: COLORS.background + "F8" }]}
    >
      <Animated.View
        style={{
          alignItems: "center",
          transform: [{ translateY: slideAnim }],
          opacity: fadeAnim,
        }}
      >
        <Text style={{ fontSize: 56 }}>{emoji}</Text>
        <Text
          style={[
            styles.overlayTitle,
            { color: titleColor, marginTop: 12, fontSize: 28 },
          ]}
        >
          {title}
        </Text>

        {!isTie && winnerName.length > 0 && (
          <Text
            style={[
              styles.overlaySubtext,
              { color: COLORS.textSecondary, marginTop: 4 },
            ]}
          >
            {isWinner ? "Congratulations!" : `${winnerName} wins`}
          </Text>
        )}

        {/* Score comparison */}
        <View style={styles.resultScores}>
          <View style={styles.resultScoreCol}>
            <Text style={[styles.resultLabel, { color: COLORS.textSecondary }]}>
              YOU
            </Text>
            <Canvas style={{ width: 80, height: 52 }}>
              <RoundedRect x={0} y={0} width={80} height={52} r={12}>
                <LinearGradient
                  start={vec(0, 0)}
                  end={vec(80, 52)}
                  colors={[
                    (isWinner ? COLORS.win : COLORS.primary) + "30",
                    (isWinner ? COLORS.win : COLORS.primary) + "10",
                  ]}
                />
                <Shadow dx={0} dy={2} blur={4} color="rgba(0,0,0,0.2)" />
              </RoundedRect>
            </Canvas>
            <Text
              style={[
                styles.resultValue,
                {
                  color: isWinner ? COLORS.win : COLORS.text,
                  position: "absolute",
                  top: 28,
                },
              ]}
            >
              {myScore}
            </Text>
          </View>

          <Text
            style={[
              styles.resultVs,
              { color: COLORS.textSecondary, marginTop: 16 },
            ]}
          >
            vs
          </Text>

          <View style={styles.resultScoreCol}>
            <Text
              style={[styles.resultLabel, { color: COLORS.textSecondary }]}
              numberOfLines={1}
            >
              {opponentName || "Opponent"}
            </Text>
            <Canvas style={{ width: 80, height: 52 }}>
              <RoundedRect x={0} y={0} width={80} height={52} r={12}>
                <LinearGradient
                  start={vec(0, 0)}
                  end={vec(80, 52)}
                  colors={[
                    (!isWinner && !isTie ? COLORS.win : COLORS.primary) + "30",
                    (!isWinner && !isTie ? COLORS.win : COLORS.primary) + "10",
                  ]}
                />
                <Shadow dx={0} dy={2} blur={4} color="rgba(0,0,0,0.2)" />
              </RoundedRect>
            </Canvas>
            <Text
              style={[
                styles.resultValue,
                {
                  color: !isWinner && !isTie ? COLORS.win : COLORS.text,
                  position: "absolute",
                  top: 28,
                },
              ]}
            >
              {opponentScore}
            </Text>
          </View>
        </View>

        {/* Rematch prompt */}
        {rematchRequested && (
          <View style={styles.rematchPrompt}>
            <Text style={[styles.rematchText, { color: COLORS.primary }]}>
              {opponentName || "Opponent"} wants a rematch!
            </Text>
            <Button
              mode="contained"
              onPress={onAcceptRematch}
              style={{
                backgroundColor: COLORS.win,
                marginTop: 8,
                borderRadius: 24,
              }}
              labelStyle={{ color: "#fff", fontWeight: "700" }}
            >
              Accept Rematch
            </Button>
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.resultActions}>
          {!rematchRequested && (
            <Button
              mode="contained"
              onPress={onRematch}
              style={{
                backgroundColor: COLORS.primary,
                flex: 1,
                marginRight: 8,
                borderRadius: 24,
              }}
              labelStyle={{ color: "#fff", fontWeight: "700" }}
            >
              Rematch
            </Button>
          )}
          <Button
            mode="outlined"
            onPress={onLeave}
            style={{
              borderColor: COLORS.border,
              flex: rematchRequested ? undefined : 1,
              borderRadius: 24,
              minWidth: 100,
            }}
            textColor={COLORS.text}
          >
            Leave
          </Button>
        </View>
      </Animated.View>
    </View>
  );
}

// =============================================================================
// Opponent Score Bar (exported for use during "playing" phase)
// =============================================================================

export function ScoreRaceScoreBar({
  opponentName,
  opponentScore,
  myScore,
  timeRemaining,
  opponentDisconnected,
}: {
  opponentName: string;
  opponentScore: number;
  myScore: number;
  timeRemaining?: number;
  opponentDisconnected?: boolean;
}) {
  const timeSeconds =
    timeRemaining != null ? Math.ceil(timeRemaining / 1000) : null;

  return (
    <View style={[styles.scoreBar, { borderBottomColor: COLORS.border }]}>
      {/* My score */}
      <View style={styles.scoreBarSide}>
        <Text style={[styles.scoreBarLabel, { color: COLORS.textSecondary }]}>
          YOU
        </Text>
        <Text style={[styles.scoreBarValue, { color: COLORS.primary }]}>
          {myScore}
        </Text>
      </View>

      {/* Timer (optional) */}
      {timeSeconds != null && (
        <View style={styles.scoreBarCenter}>
          <Canvas style={{ width: 60, height: 32 }}>
            <RoundedRect x={0} y={0} width={60} height={32} r={16}>
              <LinearGradient
                start={vec(0, 0)}
                end={vec(60, 0)}
                colors={[COLORS.primary + "40", COLORS.primary + "20"]}
              />
              <Shadow dx={0} dy={1} blur={4} color="rgba(0,0,0,0.2)" />
            </RoundedRect>
          </Canvas>
          <Text
            style={[
              styles.timerText,
              {
                color: timeSeconds <= 5 ? COLORS.lose : COLORS.text,
                position: "absolute",
              },
            ]}
          >
            {timeSeconds}s
          </Text>
        </View>
      )}

      {/* Opponent score */}
      <View style={styles.scoreBarSide}>
        <Text
          style={[
            styles.scoreBarLabel,
            {
              color: opponentDisconnected ? COLORS.lose : COLORS.textSecondary,
            },
          ]}
          numberOfLines={1}
        >
          {opponentDisconnected ? "⚠️ OFFLINE" : opponentName || "Opponent"}
        </Text>
        <Text style={[styles.scoreBarValue, { color: COLORS.text }]}>
          {opponentScore}
        </Text>
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
    maxWidth: SCREEN_WIDTH * 0.8,
  },
  countdownText: {
    fontWeight: "900",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },

  // Banner (shown during playing phase)
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: "rgba(124, 58, 237, 0.85)",
    zIndex: 99,
    gap: 8,
  },
  bannerText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },

  // Score bar
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

  // Result screen
  resultScores: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 28,
    gap: 28,
  },
  resultScoreCol: {
    alignItems: "center",
  },
  resultLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 8,
    maxWidth: 100,
  },
  resultValue: {
    fontSize: 32,
    fontWeight: "800",
  },
  resultVs: {
    fontSize: 16,
    fontWeight: "600",
  },
  resultActions: {
    flexDirection: "row",
    marginTop: 28,
    paddingHorizontal: 24,
    width: "100%",
    maxWidth: 340,
  },
  rematchPrompt: {
    marginTop: 20,
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    backgroundColor: "rgba(124, 58, 237, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.2)",
    width: "90%",
    maxWidth: 300,
  },
  rematchText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
