/**
 * BounceBlitzGameScreen — Ballz-style Bounce Blitz 2.0
 *
 * Powered by Planck.js (Box2D) for reliable physics with CCD.
 * All game logic lives in BounceBlitzEngine; rendering is handled by
 * BounceBlitzRenderer (single Skia Canvas). This screen handles
 * SnapStyle integration (Colyseus, spectator, leaderboard, achievements,
 * XP, haptics) and UI chrome (header, modals, overlays).
 *
 * How to play:
 * 1. Swipe/drag to aim your shot angle
 * 2. Release to launch a chain of balls
 * 3. Each ball hit reduces a brick's number by 1 — destroy it at 0
 * 4. Collect green pickups for extra balls
 * 5. Bricks advance each round — don't let them reach the bottom!
 */

import FriendPickerModal from "@/components/FriendPickerModal";
import { SpectatorOverlay } from "@/components/games/SpectatorOverlay";
import ScoreRaceOverlay, {
  type ScoreRaceOverlayPhase,
} from "@/components/ScoreRaceOverlay";
import SpectatorInviteModal from "@/components/SpectatorInviteModal";
import { COLYSEUS_FEATURES } from "@/constants/featureFlags";
import { useGameBackHandler } from "@/hooks/useGameBackHandler";
import { useGameConnection } from "@/hooks/useGameConnection";
import { useScoreRace } from "@/hooks/useScoreRace";
import { useSpectator } from "@/hooks/useSpectator";
import { sendScorecard } from "@/services/games";
import { recordSinglePlayerSession } from "@/services/singlePlayerSessions";
import { useAuth } from "@/store/AuthContext";
import { useSnackbar } from "@/store/SnackbarContext";
import { useUser } from "@/store/UserContext";
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
  Platform,
  StyleSheet,
  Vibration,
  View,
} from "react-native";
import { Button, Dialog, Portal, Text, useTheme } from "react-native-paper";

import { withGameErrorBoundary } from "@/components/games/GameErrorBoundary";
import { GameOverModal } from "@/components/games/GameOverModal";
import { useGameHaptics } from "@/hooks/useGameHaptics";
import { onGameResultNotification } from "@/services/gameResultEvents";
import { createLogger } from "@/utils/log";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

// ── Bounce Blitz 2.0 engine + renderer ───────────────────────────────────
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  ROWS,
  getBrickColor,
} from "@/games/bounceBlitz/BounceBlitzConfig";
import { BounceBlitzRenderer } from "@/games/bounceBlitz/BounceBlitzRenderer";
import type { BounceBlitzResult } from "@/games/bounceBlitz/BounceBlitzTypes";
import { useBounceBlitzGame } from "@/games/bounceBlitz/useBounceBlitzGame";

const logger = createLogger("screens/games/BounceBlitzGameScreen");

// =============================================================================
// Screen dimensions
// =============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// =============================================================================
// Component
// =============================================================================

interface BounceBlitzGameScreenProps {
  navigation: any;
}

function BounceBlitzGameScreen({
  navigation,
  route,
}: BounceBlitzGameScreenProps & { route: any }) {
  const haptics = useGameHaptics();
  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { showSuccess, showError } = useSnackbar();

  // ── Colyseus multiplayer ────────────────────────────────────────────────
  const { resolvedMode, firestoreGameId } = useGameConnection(
    "bounce_blitz_game",
    route?.params?.matchId,
  );
  const isOnlineAvailable =
    !!COLYSEUS_FEATURES.COLYSEUS_ENABLED && !!COLYSEUS_FEATURES.PHYSICS_ENABLED;
  const [isOnlineMode, setIsOnlineMode] = useState(false);
  const mpRace = useScoreRace({
    gameType: "bounce_blitz",
    autoJoin: isOnlineMode,
    firestoreGameId: firestoreGameId ?? undefined,
  });

  useEffect(() => {
    if (resolvedMode === "colyseus" && firestoreGameId) {
      setIsOnlineMode(true);
    }
  }, [resolvedMode, firestoreGameId]);

  // ── Game-over modal / XP state ──────────────────────────────────────────
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);
  const [didLevelUp, setDidLevelUp] = useState(false);
  const [newLevel, setNewLevel] = useState(0);
  const [gameResult, setGameResult] = useState<BounceBlitzResult | null>(null);

  // Listen for game result notifications (XP + achievements)
  useEffect(() => {
    const unsub = onGameResultNotification((n) => {
      if (n.gameId === "bounce_blitz") {
        setXpEarned(n.xpEarned);
        setDidLevelUp(n.didLevelUp);
        setNewLevel(n.newLevel);
      }
    });
    return unsub;
  }, []);

  // ── Share state ─────────────────────────────────────────────────────────
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showSpectatorInvitePicker, setShowSpectatorInvitePicker] =
    useState(false);

  // ── Spectator hosting ───────────────────────────────────────────────────
  const spectatorHost = useSpectator({
    mode: "sp-host",
    gameType: "bounce_blitz",
  });

  useEffect(() => {
    spectatorHost.startHosting();
    return () => {
      spectatorHost.endHosting();
    };
  }, []);

  // ── Game area layout measurement ────────────────────────────────────────
  const gameAreaRef = useRef<View>(null);
  const gameAreaOffset = useRef({ x: 0, y: 0 });

  const onGameAreaLayout = useCallback(() => {
    gameAreaRef.current?.measureInWindow((x, y) => {
      gameAreaOffset.current = { x, y };
    });
  }, []);

  // ── Bounce Blitz 2.0 Engine (via hook) ──────────────────────────────────
  const {
    snapshot,
    startGame: engineStartGame,
    handleAimMove,
    handleAimRelease,
    aimAngle,
    toggleSpeed,
    forceRetractBalls,
    result,
    isNewBest,
    debugCollisions,
    phase,
  } = useBounceBlitzGame(
    gameAreaOffset.current.x,
    gameAreaOffset.current.y,
    haptics.trigger,
  );

  // ── Spectator frame broadcasting ───────────────────────────────────────
  // Broadcast game state to spectators during all active phases (not just shooting).
  // Throttle to every 2nd render during shooting for smooth playback;
  // aiming/gameOver broadcast on every change since render rate is lower.
  const spectatorFrameCount = useRef(0);
  useEffect(() => {
    if (phase === "idle") return;

    spectatorFrameCount.current += 1;
    // During shooting, send every 2nd frame; otherwise send every update
    if (phase === "shooting" && spectatorFrameCount.current % 2 !== 0) return;

    spectatorHost.updateGameState(
      JSON.stringify({
        score: snapshot.score,
        level: snapshot.level,
        status: phase,
        ballCount: snapshot.ballCount,
        aimAngle: aimAngle ?? null,
        launchX: snapshot.launchX,
        blocks: snapshot.bricks.map((b) => ({
          id: b.id,
          row: b.row,
          col: b.col,
          health: b.hp,
          color: getBrickColor(b.hp),
          type: b.type,
        })),
        balls: snapshot.balls
          .filter((b) => b.active)
          .map((b) => ({ x: b.x, y: b.y })),
      }),
      snapshot.score,
      snapshot.level,
      undefined,
    );
  }, [snapshot, aimAngle]); // updates on each render from engine

  // ── Sync score to Colyseus in online mode ──────────────────────────────
  useEffect(() => {
    if (isOnlineMode && mpRace.phase === "playing") {
      mpRace.sendScore(snapshot.score);
    }
  }, [snapshot.score, isOnlineMode, mpRace]);

  // ── Handle game over from engine ──────────────────────────────────────
  useEffect(() => {
    if (!result) return;

    setGameResult(result);

    if (Platform.OS !== "web") {
      Vibration.vibrate([0, 100, 50, 100]);
    }
    haptics.gameOverPattern(false);
    spectatorHost.endHosting(result.score);

    if (result.isNewBest) {
      showSuccess("🎉 New High Score!");
    }

    // Show modal
    setXpEarned(0);
    setDidLevelUp(false);
    setNewLevel(0);
    setShowGameOverModal(true);

    // Record session (non-blocking)
    if (currentFirebaseUser) {
      logger.info(
        "[BounceBlitz] Recording session for user:",
        currentFirebaseUser.uid,
      );
      recordSinglePlayerSession(currentFirebaseUser.uid, {
        gameType: "bounce_blitz",
        finalScore: result.score,
        stats: result.stats,
      })
        .then(() => logger.info("[BounceBlitz] Session recorded successfully"))
        .catch((error: unknown) =>
          logger.error("[BounceBlitz] Error recording session:", error),
        );
    }
  }, [result]);

  // ── Start game wrapper ─────────────────────────────────────────────────
  const startGame = useCallback(() => {
    logger.info("[BounceBlitz] startGame called");
    setShowGameOverModal(false);
    setGameResult(null);
    spectatorHost.startHosting();
    engineStartGame();
  }, [engineStartGame]);

  // ── Pan gesture for aiming + LongPress for anti-stuck ────────────────
  // Use stable refs so the gesture handler always calls the latest callbacks
  const handleAimMoveRef = useRef(handleAimMove);
  handleAimMoveRef.current = handleAimMove;
  const handleAimReleaseRef = useRef(handleAimRelease);
  handleAimReleaseRef.current = handleAimRelease;
  const forceRetractRef = useRef(forceRetractBalls);
  forceRetractRef.current = forceRetractBalls;

  const aimGesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onUpdate((event) => {
          handleAimMoveRef.current(event.absoluteX, event.absoluteY);
        })
        .onEnd(() => {
          handleAimReleaseRef.current();
        }),
    [],
  );

  // Long-press (3 s) to retract all balls when stuck during shooting
  const retractGesture = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(3000)
        .runOnJS(true)
        .onEnd((_event, success) => {
          if (success) {
            forceRetractRef.current();
          }
        }),
    [],
  );

  // Compose: simultaneous so pan aiming still works alongside long-press
  const composedGesture = useMemo(
    () => Gesture.Simultaneous(aimGesture, retractGesture),
    [aimGesture, retractGesture],
  );

  // ── Share handlers ─────────────────────────────────────────────────────
  const handleShare = () => setShowShareDialog(true);

  const shareToChat = () => {
    setShowShareDialog(false);
    setShowFriendPicker(true);
  };

  const handleSelectFriend = async (friend: {
    friendUid: string;
    username: string;
    displayName: string;
  }) => {
    if (!currentFirebaseUser || !profile) return;

    setIsSending(true);
    setShowFriendPicker(false);

    try {
      const success = await sendScorecard(
        currentFirebaseUser.uid,
        friend.friendUid,
        {
          gameId: "bounce_blitz",
          score: snapshot.score,
          playerName: profile.displayName || profile.username || "Player",
        },
      );
      if (success) {
        showSuccess(`Score shared with ${friend.displayName}!`);
      } else {
        showError("Failed to share score. Try again.");
      }
    } catch {
      showError("Failed to share score. Try again.");
    } finally {
      setIsSending(false);
    }
  };

  // ── Back navigation ────────────────────────────────────────────────────
  const { handleBack } = useGameBackHandler({
    gameType: "bounce_blitz",
    isGameOver: phase === "gameOver",
  });

  // ── Warning row indicator ──────────────────────────────────────────────
  const lowestBrickRow = snapshot.bricks.reduce(
    (max, b) => Math.max(max, b.row),
    0,
  );
  const showWarning = lowestBrickRow >= ROWS - 2;

  // ── Turn transition flash ─────────────────────────────────────────────
  const turnFlash = useRef(new Animated.Value(0)).current;
  const prevLevelRef = useRef(snapshot.level);

  useEffect(() => {
    if (snapshot.level > prevLevelRef.current && snapshot.level > 1) {
      // Brief white flash overlay when bricks advance
      turnFlash.setValue(0.25);
      Animated.timing(turnFlash, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start();
      haptics.trigger("impact_light");
    }
    prevLevelRef.current = snapshot.level;
  }, [snapshot.level]);

  // =====================================================================
  // RENDER
  // =====================================================================

  return (
    <View style={[styles.container, { backgroundColor: "#1a1a2e" }]}>
      {/* Header HUD */}
      <View style={styles.header}>
        <View style={styles.backButton}>
          <Button onPress={handleBack} icon="arrow-left" textColor="white">
            Back
          </Button>
          {spectatorHost.spectatorRoomId && (
            <Button
              compact
              mode="text"
              icon="eye-plus"
              textColor="rgba(255,255,255,0.7)"
              onPress={() => setShowSpectatorInvitePicker(true)}
              labelStyle={{ fontSize: 11 }}
            >
              Invite
            </Button>
          )}
        </View>
        <View style={styles.headerStats}>
          <View style={styles.statBadge}>
            <Text style={styles.statLabel}>ROUND</Text>
            <Text style={styles.statValue}>{snapshot.level}</Text>
          </View>
          <View style={[styles.statBadge, styles.bestBadge]}>
            <Text style={styles.statLabel}>BEST</Text>
            <Text style={styles.statValue}>{snapshot.bestScore}</Text>
          </View>
          <View style={styles.statBadge}>
            <Text style={styles.statLabel}>BALLS</Text>
            <Text style={styles.statValue}>{snapshot.ballCount}</Text>
          </View>
          {phase === "shooting" && (
            <Button
              compact
              mode="outlined"
              textColor="#FFFC00"
              style={styles.speedBtn}
              onPress={toggleSpeed}
              contentStyle={{
                paddingHorizontal: 6,
                paddingVertical: 4,
                minHeight: 36,
              }}
              labelStyle={{
                fontSize: 14,
                lineHeight: 18,
                marginVertical: 0,
                includeFontPadding: false,
              }}
            >
              {snapshot.speedMultiplier === 1 ? "1×" : "2×"}
            </Button>
          )}
        </View>
      </View>

      {/* Game Area — single Skia Canvas handled by BounceBlitzRenderer */}
      <GestureDetector gesture={composedGesture}>
        <View
          ref={gameAreaRef}
          onLayout={onGameAreaLayout}
          style={[styles.gameArea, { width: GAME_WIDTH, height: GAME_HEIGHT }]}
        >
          {/* Main game renderer — all bricks, balls, aim line in one Canvas */}
          <BounceBlitzRenderer
            bricks={snapshot.bricks}
            balls={snapshot.balls}
            aimAngle={aimAngle}
            launchX={snapshot.launchX}
            ballCount={snapshot.ballCount}
            phase={phase}
            showWarning={showWarning}
            speedMultiplier={snapshot.speedMultiplier}
          />

          {/* Turn transition flash overlay */}
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: "white",
                opacity: turnFlash,
                borderRadius: 16,
              },
            ]}
          />

          {/* Idle overlay — start screen */}
          {phase === "idle" && (
            <View style={styles.overlay}>
              <MaterialCommunityIcons
                name="circle-multiple"
                size={64}
                color="#FFFC00"
              />
              <Text style={styles.overlayTitle}>Bounce Blitz</Text>
              <Text style={styles.overlaySubtitle}>
                Swipe to aim, release to shoot!
              </Text>
              <Button
                mode="contained"
                onPress={startGame}
                style={styles.startButton}
                buttonColor="#FFFC00"
                textColor="#1a1a2e"
                labelStyle={{ fontWeight: "bold", fontSize: 16 }}
              >
                Start Game
              </Button>
            </View>
          )}
        </View>
      </GestureDetector>

      {/* Instruction hint */}
      {phase === "aiming" && (
        <View style={styles.instructions}>
          <Text style={styles.instructionText}>
            ☝️ Swipe up to aim • Release to shoot
          </Text>
        </View>
      )}
      {phase === "shooting" && (
        <View style={styles.instructions}>
          <Text style={styles.instructionText}>
            ✋ Hold 3 sec to retract all balls
          </Text>
        </View>
      )}

      {/* Game Over Modal */}
      <GameOverModal
        visible={showGameOverModal}
        result={isNewBest ? "win" : "loss"}
        stats={{
          score: gameResult?.score ?? snapshot.score,
          personalBest: snapshot.bestScore,
          isNewBest,
          moves: gameResult?.stats.blocksDestroyed ?? 0,
          xpEarned: xpEarned || undefined,
          didLevelUp: didLevelUp || undefined,
          newLevel: newLevel || undefined,
        }}
        onRematch={() => {
          setShowGameOverModal(false);
          startGame();
        }}
        onShare={handleShare}
        onExit={handleBack}
        showRematch={true}
        showShare={true}
        title={`Game Over — Round ${gameResult?.score ?? snapshot.level}`}
      />

      {/* Share Dialog */}
      <Portal>
        <Dialog
          visible={showShareDialog}
          onDismiss={() => setShowShareDialog(false)}
          style={{ backgroundColor: theme.colors.surface }}
        >
          <Dialog.Title>Share Your Score</Dialog.Title>
          <Dialog.Content>
            <Text>
              Challenge your friends! Round {snapshot.level}, Score:{" "}
              {snapshot.score}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowShareDialog(false)}>Cancel</Button>
            <Button onPress={shareToChat} mode="contained">
              Send to Friend
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Colyseus multiplayer overlay */}
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

      {/* Spectator overlay */}
      {spectatorHost.spectatorCount > 0 && (
        <SpectatorOverlay spectatorCount={spectatorHost.spectatorCount} />
      )}

      {/* Friend Picker */}
      <FriendPickerModal
        key="scorecard-picker"
        visible={showFriendPicker}
        onDismiss={() => setShowFriendPicker(false)}
        onSelectFriend={handleSelectFriend}
        title="Share Score With..."
        currentUserId={currentFirebaseUser?.uid || ""}
      />

      {/* Spectator Invite Picker */}
      <SpectatorInviteModal
        visible={showSpectatorInvitePicker}
        onDismiss={() => setShowSpectatorInvitePicker(false)}
        currentUserId={currentFirebaseUser?.uid || ""}
        inviteData={
          spectatorHost.spectatorRoomId
            ? {
                roomId: spectatorHost.spectatorRoomId,
                gameType: "bounce_blitz",
                hostName: profile?.displayName || profile?.username || "Player",
              }
            : null
        }
        onInviteRef={(ref) => spectatorHost.registerInviteMessage(ref)}
        onSent={(name) => showSuccess(`Spectator invite sent to ${name}!`)}
        onError={showError}
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
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 8,
    paddingTop: Platform.OS === "ios" ? 54 : 40,
    paddingBottom: 10,
  },
  backButton: {
    flex: 1,
  },
  headerStats: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  statBadge: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    minWidth: 50,
  },
  bestBadge: {
    backgroundColor: "rgba(255, 252, 0, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 252, 0, 0.2)",
  },
  statLabel: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  statValue: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  speedBtn: {
    borderColor: "rgba(255, 252, 0, 0.4)",
    borderRadius: 12,
    marginLeft: 4,
  },
  gameArea: {
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 8,
    // elevation for Android shadow
    elevation: 8,
    // iOS shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.87)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    borderRadius: 16,
  },
  overlayTitle: {
    color: "white",
    fontSize: 34,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 8,
  },
  overlaySubtitle: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 16,
    marginBottom: 28,
    textAlign: "center",
  },
  startButton: {
    minWidth: 160,
    borderRadius: 24,
  },
  instructions: {
    marginTop: 16,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  instructionText: {
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: 14,
  },
});

export default withGameErrorBoundary(BounceBlitzGameScreen, "bounce_blitz");
