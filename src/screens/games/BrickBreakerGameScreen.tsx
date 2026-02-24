/**
 * Brick Breaker Game Screen — Atari Breakout Replica
 *
 * Classic arcade game with Planck.js physics. Control a paddle to bounce
 * a ball and destroy two walls of colored bricks.
 *
 * Game Mechanics:
 * - Drag to move paddle horizontally
 * - Tap to launch ball from paddle
 * - 8 rows x 14 cols of bricks per wall (2 walls total)
 * - Row scoring: yellow=1, green=3, orange=5, red=7
 * - Speed tiers: 4-hit, 12-hit, orange contact, red contact
 * - Paddle shrinks after red breakthrough + ceiling hit
 * - 3 lives, game over when all lost
 */

import FriendPickerModal from "@/components/FriendPickerModal";
import ScoreRaceOverlay, {
  type ScoreRaceOverlayPhase,
} from "@/components/ScoreRaceOverlay";
import SpectatorInviteModal from "@/components/SpectatorInviteModal";
import { withGameErrorBoundary } from "@/components/games/GameErrorBoundary";
import { GameOverModal } from "@/components/games/GameOverModal";
import { SpectatorOverlay } from "@/components/games/SpectatorOverlay";
import { COLYSEUS_FEATURES } from "@/constants/featureFlags";
import { useGameBackHandler } from "@/hooks/useGameBackHandler";
import { useGameCompletion } from "@/hooks/useGameCompletion";
import { useGameConnection } from "@/hooks/useGameConnection";
import { useGameHaptics } from "@/hooks/useGameHaptics";
import { useScoreRace } from "@/hooks/useScoreRace";
import { useSpectator } from "@/hooks/useSpectator";
import { onGameResultNotification } from "@/services/gameResultEvents";
import { sendScorecard } from "@/services/games";
import { recordSinglePlayerSession } from "@/services/singlePlayerSessions";
import { useAuth } from "@/store/AuthContext";
import { useSnackbar } from "@/store/SnackbarContext";
import { useUser } from "@/store/UserContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { RouteProp, useRoute } from "@react-navigation/native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { Button, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  GAME_HEIGHT,
  GAME_WIDTH,
  TOTAL_WALLS,
} from "@/games/brickBreaker/BreakoutConfig";
import { BreakoutRenderer } from "@/games/brickBreaker/BreakoutRenderer";
import { useBreakoutGame } from "@/games/brickBreaker/useBreakoutGame";
import { createLogger } from "@/utils/log";

const logger = createLogger("screens/games/BrickBreakerGameScreen");

// =============================================================================
// Types
// =============================================================================

type BrickBreakerRouteParams = {
  BrickBreakerGame: {
    matchId?: string;
    entryPoint?: string;
    conversationId?: string;
    conversationType?: "dm" | "group";
  };
};

interface BrickBreakerGameScreenProps {
  navigation: any;
}

// =============================================================================
// Main Component
// =============================================================================

function BrickBreakerGameScreen({
  navigation,
}: BrickBreakerGameScreenProps): React.ReactElement {
  // Track game completion (required by SnapStyle game framework)
  const __codexGameCompletion = useGameCompletion({
    gameType: "brick_breaker",
  });
  void __codexGameCompletion;

  const theme = useTheme();
  const haptics = useGameHaptics();
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { showError, showSuccess } = useSnackbar();
  const route =
    useRoute<RouteProp<BrickBreakerRouteParams, "BrickBreakerGame">>();

  // --------------------------------------------------------------------------
  // Colyseus multiplayer
  // --------------------------------------------------------------------------

  const { resolvedMode, firestoreGameId } = useGameConnection(
    "brick_breaker_game",
    route?.params?.matchId,
  );
  const isOnlineAvailable =
    !!COLYSEUS_FEATURES.COLYSEUS_ENABLED && !!COLYSEUS_FEATURES.PHYSICS_ENABLED;
  const [isOnlineMode, setIsOnlineMode] = useState(false);
  const mpRace = useScoreRace({
    gameType: "brick_breaker",
    autoJoin: isOnlineMode,
    firestoreGameId: firestoreGameId ?? undefined,
  });

  useEffect(() => {
    if (resolvedMode === "colyseus" && firestoreGameId) {
      setIsOnlineMode(true);
    }
  }, [resolvedMode, firestoreGameId]);

  // --------------------------------------------------------------------------
  // Spectator hosting
  // --------------------------------------------------------------------------

  const spectatorHost = useSpectator({
    mode: "sp-host",
    gameType: "brick_breaker",
  });

  const [showSpectatorInvitePicker, setShowSpectatorInvitePicker] =
    useState(false);

  useEffect(() => {
    spectatorHost.startHosting();
  }, []);

  // --------------------------------------------------------------------------
  // Game area offset tracking (for gesture coordinate translation)
  // --------------------------------------------------------------------------

  const gameAreaRef = useRef<View>(null);
  const [gameAreaOffset, setGameAreaOffset] = useState({ x: 0, y: 0 });

  const onGameAreaLayout = useCallback(() => {
    gameAreaRef.current?.measureInWindow((x, y) => {
      setGameAreaOffset({ x: x ?? 0, y: y ?? 0 });
    });
  }, []);

  // --------------------------------------------------------------------------
  // Breakout game hook
  // --------------------------------------------------------------------------

  const {
    snapshot,
    startGame: engineStartGame,
    launchBall,
    movePaddle,
    result,
    isNewBest,
    phase,
    debug,
    debugCollisions,
  } = useBreakoutGame(gameAreaOffset.x, gameAreaOffset.y, haptics.trigger);

  // --------------------------------------------------------------------------
  // UI state
  // --------------------------------------------------------------------------

  const [isGameStarted, setIsGameStarted] = useState(false);
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [showFriendPicker, setShowFriendPicker] = useState(false);

  // XP state (populated via GameResult notification)
  const [xpEarned, setXpEarned] = useState(0);
  const [didLevelUp, setDidLevelUp] = useState(false);
  const [newLevel, setNewLevel] = useState(0);

  // Listen for game result notifications (XP + achievements)
  useEffect(() => {
    const unsub = onGameResultNotification((n) => {
      if (n.gameId === "brick_breaker") {
        setXpEarned(n.xpEarned);
        setDidLevelUp(n.didLevelUp);
        setNewLevel(n.newLevel);
      }
    });
    return unsub;
  }, []);

  // --------------------------------------------------------------------------
  // Game lifecycle
  // --------------------------------------------------------------------------

  const startGame = useCallback(() => {
    engineStartGame();
    setIsGameStarted(true);
    setShowGameOverModal(false);
    setXpEarned(0);
    setDidLevelUp(false);
    setNewLevel(0);
    spectatorHost.startHosting();
    haptics.trigger("impact_medium");
  }, [engineStartGame, haptics, spectatorHost]);

  // Handle game result — record session + show modal
  useEffect(() => {
    if (!result) return;

    setShowGameOverModal(true);

    // Haptic feedback
    if (result.outcome === "win") {
      haptics.celebrationPattern?.();
    } else {
      haptics.gameOverPattern?.();
    }

    // Record single-player session
    if (currentFirebaseUser?.uid) {
      const duration = 0; // TODO: track duration in engine
      recordSinglePlayerSession(currentFirebaseUser.uid, {
        gameType: "brick_breaker",
        finalScore: result.score,
        stats: result.stats,
        duration,
      }).catch((err) => {
        logger.error("[BrickBreaker] Failed to record session:", err);
      });
    }

    // End spectator hosting
    spectatorHost.endHosting();
  }, [result]);

  // Broadcast game state to spectators (throttled — every ~5 frames)
  const spectatorFrameRef = useRef(0);
  useEffect(() => {
    if (phase === "playing" || phase === "serving") {
      spectatorFrameRef.current += 1;
      if (spectatorFrameRef.current % 5 !== 0) return;
      spectatorHost.updateGameState({
        phase,
        score: snapshot.score,
        lives: snapshot.lives,
        wall: snapshot.wall,
        bricksDestroyed: snapshot.bricksDestroyed,
        // Full snapshot for spectator renderer
        ball: snapshot.ball,
        paddle: snapshot.paddle,
        bricks: snapshot.bricks,
        paddleShrunk: snapshot.paddleShrunk,
      });
    }
  }, [snapshot, phase]);

  // --------------------------------------------------------------------------
  // Navigation & sharing
  // --------------------------------------------------------------------------

  const { handleBack } = useGameBackHandler({
    gameType: "brick_breaker",
    isGameOver: showGameOverModal,
  });

  const handlePlayAgain = useCallback(() => {
    setShowGameOverModal(false);
    startGame();
  }, [startGame]);

  const handleShare = useCallback(() => {
    setShowFriendPicker(true);
  }, []);

  const handleSelectFriend = useCallback(
    async (friend: {
      friendUid: string;
      username: string;
      displayName: string;
    }) => {
      if (!currentFirebaseUser?.uid || !result || !profile) return;
      setShowFriendPicker(false);

      try {
        const success = await sendScorecard(
          currentFirebaseUser.uid,
          friend.friendUid,
          {
            gameId: "brick_breaker",
            score: result.score,
            playerName: profile.displayName || profile.username || "Player",
          },
        );
        if (success) {
          showSuccess(`Score shared with ${friend.displayName}!`);
        } else {
          showError("Failed to share score. Try again.");
        }
      } catch (error) {
        logger.error("[BrickBreaker] Failed to send scorecard:", error);
        showError("Failed to share score. Try again.");
      }
    },
    [currentFirebaseUser?.uid, result, profile, showSuccess, showError],
  );

  const handleExitToHub = useCallback(() => {
    setShowGameOverModal(false);
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("GamesHub");
  }, [navigation]);

  // --------------------------------------------------------------------------
  // Gestures
  // --------------------------------------------------------------------------

  // Refs for stable gesture callbacks
  const movePaddleRef = useRef(movePaddle);
  movePaddleRef.current = movePaddle;
  const launchBallRef = useRef(launchBall);
  launchBallRef.current = launchBall;

  const panGesture = React.useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onUpdate((e) => {
          movePaddleRef.current(e.absoluteX);
        }),
    [],
  );

  const tapGesture = React.useMemo(
    () =>
      Gesture.Tap()
        .runOnJS(true)
        .onEnd(() => {
          launchBallRef.current();
        }),
    [],
  );

  const composedGesture = React.useMemo(
    () => Gesture.Simultaneous(panGesture, tapGesture),
    [panGesture, tapGesture],
  );

  // --------------------------------------------------------------------------
  // Render: idle / start screen
  // --------------------------------------------------------------------------

  if (!isGameStarted) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView
          style={[
            styles.container,
            { backgroundColor: theme.colors.background },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <MaterialCommunityIcons
                name="arrow-left"
                size={24}
                color={theme.colors.onBackground}
              />
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
          </View>

          {/* Start content */}
          <View style={styles.startContainer}>
            <Text
              variant="displaySmall"
              style={{ color: theme.colors.primary, marginBottom: 8 }}
            >
              {"\uD83E\uDDF1"}
            </Text>
            <Text
              variant="headlineLarge"
              style={{ color: theme.colors.onBackground, marginBottom: 16 }}
            >
              Brick Breaker
            </Text>
            <Text
              variant="bodyLarge"
              style={{
                color: theme.colors.onSurfaceVariant,
                textAlign: "center",
                marginBottom: 8,
                paddingHorizontal: 24,
              }}
            >
              Classic Atari Breakout {"\u2014"} destroy all bricks!
            </Text>
            <Text
              variant="bodyMedium"
              style={{
                color: theme.colors.onSurfaceVariant,
                textAlign: "center",
                marginBottom: 32,
                paddingHorizontal: 24,
              }}
            >
              Tap to launch {"\u2022"} Drag to move paddle{"\n"}
              Clear 2 walls {"\u2022"} Score by brick color
            </Text>

            {snapshot.bestScore > 0 && (
              <Text
                variant="titleMedium"
                style={{ color: theme.colors.primary, marginBottom: 24 }}
              >
                Best Score: {snapshot.bestScore.toLocaleString()}
              </Text>
            )}

            <Button
              mode="contained"
              onPress={startGame}
              style={{ borderRadius: 12, minWidth: 200 }}
              contentStyle={{ paddingVertical: 8 }}
              icon="play"
            >
              Start Game
            </Button>
          </View>
        </SafeAreaView>
      </GestureHandlerRootView>
    );
  }

  // --------------------------------------------------------------------------
  // Render: active game
  // --------------------------------------------------------------------------

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        {/* â”€â”€ Header bar â”€â”€ */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={theme.colors.onBackground}
            />
          </TouchableOpacity>

          {/* Spectator invite button */}
          <TouchableOpacity
            onPress={() => setShowSpectatorInvitePicker(true)}
            style={styles.inviteButton}
          >
            <MaterialCommunityIcons
              name="eye-plus-outline"
              size={20}
              color={theme.colors.onBackground}
            />
          </TouchableOpacity>

          <View style={{ flex: 1 }} />
        </View>

        {/* â”€â”€ HUD stats â”€â”€ */}
        <View style={styles.hudRow}>
          <HudBadge
            label="SCORE"
            value={snapshot.score.toLocaleString()}
            color={theme.colors.primary}
          />
          <HudBadge
            label="LIVES"
            value={String(snapshot.lives)}
            color={snapshot.lives <= 1 ? "#F44336" : theme.colors.onBackground}
          />
          <HudBadge
            label="WALL"
            value={`${snapshot.wall}/${TOTAL_WALLS}`}
            color={theme.colors.onBackground}
          />
          {snapshot.bestScore > 0 && (
            <HudBadge
              label="BEST"
              value={snapshot.bestScore.toLocaleString()}
              color={theme.colors.onSurfaceVariant}
            />
          )}
        </View>

        {/* â”€â”€ Game area â”€â”€ */}
        <View style={styles.gameAreaContainer}>
          <GestureDetector gesture={composedGesture}>
            <View
              ref={gameAreaRef}
              onLayout={onGameAreaLayout}
              style={[
                styles.gameArea,
                { width: GAME_WIDTH, height: GAME_HEIGHT },
              ]}
            >
              <BreakoutRenderer
                snapshot={snapshot}
                width={GAME_WIDTH}
                height={GAME_HEIGHT}
              />
            </View>
          </GestureDetector>
        </View>

        {/* â”€â”€ Instruction hint â”€â”€ */}
        <View style={styles.hintRow}>
          <Text
            style={[styles.hintText, { color: theme.colors.onSurfaceVariant }]}
          >
            {phase === "serving"
              ? "Tap to launch ball"
              : phase === "playing"
                ? "Drag to move paddle"
                : ""}
          </Text>
        </View>

        {/* â”€â”€ Game Over Modal â”€â”€ */}
        <GameOverModal
          visible={showGameOverModal}
          result={result?.outcome === "win" ? "win" : "loss"}
          stats={{
            score: result?.score ?? 0,
            personalBest: snapshot.bestScore,
            isNewBest,
            moves: result?.stats.bricksDestroyed ?? 0,
            xpEarned: xpEarned || undefined,
            didLevelUp: didLevelUp || undefined,
            newLevel: newLevel || undefined,
          }}
          onRematch={handlePlayAgain}
          onShare={handleShare}
          onExit={handleExitToHub}
          showRematch
          showShare
          title={
            result?.outcome === "win"
              ? "\uD83C\uDF89 Victory! Both Walls Cleared!"
              : `Game Over \u2014 Score: ${result?.score ?? 0}`
          }
        />

        {/* â”€â”€ Multiplayer overlay â”€â”€ */}
        {isOnlineMode && (
          <ScoreRaceOverlay
            phase={mpRace.phase as ScoreRaceOverlayPhase}
            countdown={mpRace.countdown}
            myScore={mpRace.myScore}
            opponentScore={mpRace.opponentScore}
            opponentName={mpRace.opponentName}
            isWinner={mpRace.isWinner}
            isTie={mpRace.isTie}
            winnerName={mpRace.isWinner ? "You" : mpRace.opponentName}
            onReady={() => mpRace.sendReady()}
            onRematch={() => mpRace.sendRematch()}
            onAcceptRematch={() => mpRace.acceptRematch()}
            onLeave={async () => {
              await mpRace.leave();
              setIsOnlineMode(false);
            }}
            rematchRequested={mpRace.rematchRequested}
            reconnecting={mpRace.reconnecting}
            opponentDisconnected={mpRace.opponentDisconnected}
          />
        )}

        {/* â”€â”€ Spectator count â”€â”€ */}
        {spectatorHost.spectatorCount > 0 && (
          <SpectatorOverlay spectatorCount={spectatorHost.spectatorCount} />
        )}

        {/* â”€â”€ Friend Picker (share scorecard) â”€â”€ */}
        <FriendPickerModal
          key="scorecard-picker"
          visible={showFriendPicker}
          onDismiss={() => setShowFriendPicker(false)}
          onSelectFriend={handleSelectFriend}
          title="Share Score With..."
          currentUserId={currentFirebaseUser?.uid || ""}
        />

        {/* â”€â”€ Spectator Invite Modal â”€â”€ */}
        <SpectatorInviteModal
          visible={showSpectatorInvitePicker}
          onDismiss={() => setShowSpectatorInvitePicker(false)}
          currentUserId={currentFirebaseUser?.uid || ""}
          inviteData={
            spectatorHost.spectatorRoomId
              ? {
                  roomId: spectatorHost.spectatorRoomId,
                  gameType: "brick_breaker",
                  hostName:
                    profile?.displayName || profile?.username || "Player",
                }
              : null
          }
          onInviteRef={(ref) => spectatorHost.registerInviteMessage(ref)}
          onSent={(name) => showSuccess(`Spectator invite sent to ${name}!`)}
          onError={showError}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

// =============================================================================
// HUD Badge Component
// =============================================================================

interface HudBadgeProps {
  label: string;
  value: string;
  color: string;
}

const HudBadge: React.FC<HudBadgeProps> = React.memo(
  ({ label, value, color }) => (
    <View style={styles.hudBadge}>
      <Text style={styles.hudLabel}>{label}</Text>
      <Text style={[styles.hudValue, { color }]}>{value}</Text>
    </View>
  ),
);
HudBadge.displayName = "HudBadge";

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
  },
  inviteButton: {
    padding: 8,
    borderRadius: 20,
    marginLeft: 4,
  },
  startContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  hudRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  hudBadge: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 56,
  },
  hudLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  hudValue: {
    fontSize: 16,
    fontWeight: "800",
    fontFamily: "monospace",
  },
  gameAreaContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  gameArea: {
    overflow: "hidden",
    borderRadius: 8,
  },
  hintRow: {
    alignItems: "center",
    paddingVertical: 10,
    minHeight: 36,
  },
  hintText: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
});

export default withGameErrorBoundary(BrickBreakerGameScreen, "brick_breaker");
