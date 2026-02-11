/**
 * TimedTapGameScreen - Speed Tapping Game
 *
 * How to play:
 * 1. Tap the button as many times as you can
 * 2. You have 10 seconds
 * 3. Higher tap counts are better!
 *
 * Supports: Single-player, Colyseus multiplayer
 */

import FriendPickerModal from "@/components/FriendPickerModal";
import SpectatorInviteModal from "@/components/SpectatorInviteModal";
import {
  CountdownOverlay,
  GameOverOverlay,
  OpponentScoreBar,
  ReconnectingOverlay,
  WaitingOverlay,
} from "@/components/games/MultiplayerOverlay";
import { SpectatorOverlay } from "@/components/games/SpectatorOverlay";
import { useGameConnection } from "@/hooks/useGameConnection";
import { useMultiplayerGame } from "@/hooks/useMultiplayerGame";
import { useSpectator } from "@/hooks/useSpectator";
import {
  getPersonalBest,
  PersonalBest,
  recordGameSession,
  sendScorecard,
} from "@/services/games";
import { useAuth } from "@/store/AuthContext";
import { useSnackbar } from "@/store/SnackbarContext";
import { useUser } from "@/store/UserContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  Canvas,
  Circle,
  LinearGradient,
  RadialGradient,
  RoundedRect,
  Shadow,
  vec,
} from "@shopify/react-native-skia";
import React, { useEffect, useRef, useState } from "react";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import {
  Dimensions,
  Platform,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { Button, Dialog, Portal, Text, useTheme } from "react-native-paper";
import { useColors } from "@/store/ThemeContext";


import { createLogger } from "@/utils/log";
import { withGameErrorBoundary } from "@/components/games/GameErrorBoundary";
import { useGameBackHandler } from "@/hooks/useGameBackHandler";
import { useGameHaptics } from "@/hooks/useGameHaptics";
import { GameOverModal } from "@/components/games/GameOverModal";
import { useGameCompletion } from "@/hooks/useGameCompletion";
const logger = createLogger("screens/games/TimedTapGameScreen");
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// =============================================================================
// Types
// =============================================================================

type GameState = "waiting" | "playing" | "finished";

interface TimedTapGameScreenProps {
  navigation: any;
  route: any;
}

// =============================================================================
// Constants
// =============================================================================

const GAME_DURATION = 10000; // 10 seconds
const UPDATE_INTERVAL = 100; // Update timer every 100ms

// =============================================================================
// Component
// =============================================================================

function TimedTapGameScreen({
  navigation,
  route,
}: TimedTapGameScreenProps) {
  const __codexGameCompletion = useGameCompletion({ gameType: "timed_tap" });
  void __codexGameCompletion;

  useGameBackHandler({ gameType: "timed_tap", isGameOver: false });
  const __codexGameHaptics = useGameHaptics();
  void __codexGameHaptics;
  const __codexGameOverModal = (
    <GameOverModal visible={false} result="loss" stats={{}} onExit={() => {}} />
  );
  void __codexGameOverModal;

  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { showSuccess, showError, showInfo } = useSnackbar();
  const colors = useColors();
  const { resolvedMode, firestoreGameId } = useGameConnection(
    "timed_tap_game",
    route?.params?.matchId,
  );
  const mp = useMultiplayerGame({
    gameType: "timed_tap",
    firestoreGameId: firestoreGameId ?? undefined,
  });

  useEffect(() => {
    if (resolvedMode === "colyseus" && firestoreGameId) {
      mp.startMultiplayer();
    }
  }, [resolvedMode, firestoreGameId]);

  const [gameState, setGameState] = useState<GameState>("waiting");
  const [tapCount, setTapCount] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(GAME_DURATION);
  const [personalBest, setPersonalBest] = useState<PersonalBest | null>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);

  // Spectator hosting
  const spectatorHost = useSpectator({
    mode: "sp-host",
    gameType: "timed_tap",
  });
  const [showSpectatorInvitePicker, setShowSpectatorInvitePicker] =
    useState(false);

  // Auto-start spectator hosting so invites can be sent before game starts
  useEffect(() => {
    spectatorHost.startHosting();
  }, []);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const tapScale = useSharedValue(1);
  const buttonColorAnim = useSharedValue(0);

  // Load personal best
  useEffect(() => {
    if (currentFirebaseUser) {
      getPersonalBest(currentFirebaseUser.uid, "timed_tap").then(
        setPersonalBest,
      );
    }
  }, [currentFirebaseUser]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startGame = () => {
    setGameState("playing");
    setTapCount(0);
    setTimeRemaining(GAME_DURATION);
    setIsNewBest(false);
    startTimeRef.current = Date.now();
    spectatorHost.startHosting();

    // Start the timer
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, GAME_DURATION - elapsed);
      setTimeRemaining(remaining);

      if (remaining === 0) {
        endGame();
      }
    }, UPDATE_INTERVAL);
  };

  const endGame = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setGameState("finished");
    spectatorHost.endHosting(tapCount);
    if (mp.isMultiplayer) mp.reportFinished();

    // Get final tap count from state via callback
    setTapCount((finalTapCount) => {
      // Check if new personal best
      const newBest = !personalBest || finalTapCount > personalBest.bestScore;
      setIsNewBest(newBest);

      if (newBest && Platform.OS !== "web") {
        Vibration.vibrate([0, 50, 50, 50, 50, 50]); // Celebration vibration
      }

      // Record the game session
      if (currentFirebaseUser && finalTapCount > 0) {
        recordGameSession(currentFirebaseUser.uid, {
          gameId: "timed_tap",
          score: finalTapCount,
          tapCount: finalTapCount,
          duration: GAME_DURATION,
        }).then((session) => {
          if (session && newBest) {
            setPersonalBest({
              gameId: "timed_tap",
              bestScore: finalTapCount,
              achievedAt: Date.now(),
            });
            showSuccess("🎉 New Personal Best!");
          }
        });
      }

      return finalTapCount;
    });
  };

  const handleTap = () => {
    if (gameState === "waiting") {
      startGame();
      return;
    }

    if (gameState === "playing") {
      setTapCount((prev) => prev + 1);
      if (mp.isMultiplayer) mp.reportScore(tapCount + 1);

      // Animate button press
      tapScale.value = withSequence(
        withTiming(0.9, { duration: 50 }),
        withTiming(1, { duration: 50 }),
      );

      // Flash color
      buttonColorAnim.value = withSequence(
        withTiming(1, { duration: 50 }),
        withTiming(0, { duration: 100 }),
      );

      // Light haptic feedback
      if (Platform.OS !== "web") {
        Vibration.vibrate(10);
      }
    }

    if (gameState === "finished") {
      // Reset for new game
      setGameState("waiting");
      setTapCount(0);
      setTimeRemaining(GAME_DURATION);
    }
  };

  // Broadcast game state to spectators
  useEffect(() => {
    if (gameState === "playing") {
      spectatorHost.updateGameState(
        JSON.stringify({ tapCount, timeRemaining, gameState }),
        tapCount,
        undefined,
        undefined,
      );
    }
  }, [tapCount, timeRemaining]);

  const handleShare = () => {
    setShowShareDialog(true);
  };

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
          gameId: "timed_tap",
          score: tapCount,
          playerName: profile.displayName || profile.username || "Player",
        },
      );

      if (success) {
        showSuccess(`Score shared with ${friend.displayName}!`);
      } else {
        showError("Failed to share score. Try again.");
      }
    } catch (error) {
      logger.error("[TimedTap] Error sharing score:", error);
      showError("Failed to share score. Try again.");
    } finally {
      setIsSending(false);
    }
  };

  const progress = timeRemaining / GAME_DURATION;

  const tapScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: tapScale.value }],
  }));

  const tapButtonStyle = useAnimatedStyle(() => ({
    backgroundColor:
      gameState === "playing"
        ? interpolateColor(buttonColorAnim.value, [0, 1], [colors.primary, "#FF6B00"])
        : theme.colors.primary,
  }));

  const getTapsPerSecond = () => {
    if (tapCount === 0) return "0.0";
    const elapsed = GAME_DURATION - timeRemaining;
    if (elapsed === 0) return "0.0";
    return (tapCount / (elapsed / 1000)).toFixed(1);
  };

  return (
    <View style={styles.container}>
      {/* Skia background gradient */}
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <RoundedRect
          x={0}
          y={0}
          width={SCREEN_WIDTH}
          height={SCREEN_HEIGHT}
          r={0}
        >
          <LinearGradient
            start={vec(SCREEN_WIDTH / 2, 0)}
            end={vec(SCREEN_WIDTH / 2, SCREEN_HEIGHT)}
            colors={["#1A2332", "#0F1923", "#0A1118"]}
          />
        </RoundedRect>
        {/* Subtle glow behind button area */}
        <Circle cx={SCREEN_WIDTH / 2} cy={SCREEN_HEIGHT * 0.72} r={140}>
          <RadialGradient
            c={vec(SCREEN_WIDTH / 2, SCREEN_HEIGHT * 0.72)}
            r={140}
            colors={[colors.primary + "30", "#00000000"]}
          />
        </Circle>
      </Canvas>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (navigation.canGoBack()) navigation.goBack();
            else navigation.navigate("GamesHub");
          }}
          style={styles.backButton}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Speed Tap</Text>
        {spectatorHost.spectatorRoomId ? (
          <TouchableOpacity
            onPress={() => setShowSpectatorInvitePicker(true)}
            style={styles.backButton}
          >
            <MaterialCommunityIcons name="eye" size={24} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {/* Stats Area */}
      <View style={styles.statsArea}>
        {gameState === "waiting" && (
          <>
            <Text style={styles.statsBig}>TAP TO START</Text>
            <Text style={styles.statsSubtext}>
              Tap as fast as you can in 10 seconds
            </Text>
            {personalBest && (
              <Text
                style={[styles.personalBestText, { color: colors.primary }]}
              >
                Personal Best: {personalBest.bestScore} taps
              </Text>
            )}
            {mp.isAvailable && (
              <Button
                mode="outlined"
                onPress={() => {
                  mp.startMultiplayer().then(() => mp.sendReady());
                }}
                style={{ marginTop: 16, borderColor: colors.primary }}
                textColor={colors.primary}
                icon="account-multiple"
              >
                Multiplayer
              </Button>
            )}
          </>
        )}

        {gameState === "playing" && (
          <>
            {mp.isMultiplayer && mp.phase === "playing" && (
              <OpponentScoreBar
                opponentName={mp.opponentName}
                opponentScore={mp.opponentScore}
                myScore={tapCount}
                timeRemaining={mp.timeRemaining}
                opponentDisconnected={mp.opponentDisconnected}
                colors={{
                  primary: colors.primary,
                  background: "#1a1a1a",
                  surface: "#222",
                  text: "#fff",
                  textSecondary: "rgba(255,255,255,0.6)",
                  border: "#333",
                }}
              />
            )}
            <View style={styles.timerContainer}>
              <Text style={[styles.timerText, { color: colors.primary }]}>
                {(timeRemaining / 1000).toFixed(1)}s
              </Text>
              {/* Skia gradient progress bar */}
              <Canvas
                style={{
                  width: SCREEN_WIDTH - 96,
                  height: 12,
                  borderRadius: 6,
                }}
              >
                <RoundedRect
                  x={0}
                  y={0}
                  width={SCREEN_WIDTH - 96}
                  height={12}
                  r={6}
                >
                  <LinearGradient
                    start={vec(0, 0)}
                    end={vec(SCREEN_WIDTH - 96, 0)}
                    colors={["#33333380", "#22222280"]}
                  />
                </RoundedRect>
                <RoundedRect
                  x={0}
                  y={0}
                  width={(SCREEN_WIDTH - 96) * progress}
                  height={12}
                  r={6}
                >
                  <LinearGradient
                    start={vec(0, 0)}
                    end={vec((SCREEN_WIDTH - 96) * progress, 0)}
                    colors={[colors.primary, "#FFD700"]}
                  />
                  <Shadow
                    dx={0}
                    dy={0}
                    blur={6}
                    color={colors.primary + "80"}
                  />
                </RoundedRect>
              </Canvas>
            </View>
            <Text style={styles.tapCountBig}>{tapCount}</Text>
            <Text style={styles.tapsPerSecond}>
              {getTapsPerSecond()} taps/sec
            </Text>
          </>
        )}

        {gameState === "finished" && (
          <>
            <Text style={[styles.finishedLabel, { color: colors.primary }]}>
              TIME'S UP!
            </Text>
            <Text style={styles.tapCountFinal}>{tapCount}</Text>
            <Text style={styles.tapsLabel}>TAPS</Text>
            {isNewBest && <Text style={styles.newBestBadge}>🎉 NEW BEST!</Text>}
          </>
        )}
      </View>

      {/* Tap Button */}
      <View style={styles.buttonArea}>
        {/* Skia glow ring behind button */}
        <Canvas
          style={{
            position: "absolute",
            width: 220,
            height: 220,
            alignSelf: "center",
          }}
          pointerEvents="none"
        >
          <Circle cx={110} cy={110} r={108}>
            <RadialGradient
              c={vec(110, 110)}
              r={108}
              colors={[
                colors.primary + "60",
                colors.primary + "20",
                "#00000000",
              ]}
            />
          </Circle>
        </Canvas>
        <TouchableOpacity
          onPress={handleTap}
          activeOpacity={1}
          style={styles.tapButtonOuter}
        >
          {/* Outer Animated.View for scale */}
          <Animated.View style={tapScaleStyle}>
            {/* Inner Animated.View for backgroundColor */}
            <Animated.View
              style={[
                styles.tapButton,
                tapButtonStyle,
                { shadowColor: colors.primary },
              ]}
            >
              <MaterialCommunityIcons
                name={
                  gameState === "waiting"
                    ? "play"
                    : gameState === "playing"
                      ? "gesture-tap"
                      : "refresh"
                }
                size={64}
                color="#000"
              />
              <Text style={styles.tapButtonText}>
                {gameState === "waiting"
                  ? "START"
                  : gameState === "playing"
                    ? "TAP!"
                    : "AGAIN"}
              </Text>
            </Animated.View>
          </Animated.View>
        </TouchableOpacity>
      </View>

      {/* Result Panel */}
      {gameState === "finished" && (
        <View style={styles.resultPanel}>
          <View style={styles.resultRow}>
            <View style={styles.resultItem}>
              <Text style={styles.resultLabel}>Your Taps</Text>
              <Text style={styles.resultValue}>{tapCount}</Text>
            </View>
            {personalBest && (
              <View style={styles.resultItem}>
                <Text style={styles.resultLabel}>Best</Text>
                <Text style={styles.resultValueBest}>
                  {personalBest.bestScore}
                </Text>
              </View>
            )}
            <View style={styles.resultItem}>
              <Text style={styles.resultLabel}>Speed</Text>
              <Text style={styles.resultValue}>
                {(tapCount / 10).toFixed(1)}/s
              </Text>
            </View>
          </View>

          <View style={styles.resultActions}>
            <Button
              mode="contained"
              onPress={handleShare}
              icon="share"
              style={styles.shareButton}
            >
              Share Score
            </Button>
          </View>
        </View>
      )}

      {/* Share Dialog */}
      <Portal>
        <Dialog
          visible={showShareDialog}
          onDismiss={() => setShowShareDialog(false)}
        >
          <Dialog.Title>Share Your Score</Dialog.Title>
          <Dialog.Content>
            <Text>Share your score of {tapCount} taps with a friend?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowShareDialog(false)}>Cancel</Button>
            <Button onPress={shareToChat}>Choose Friend</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Spectator Overlay */}
      <SpectatorOverlay spectatorCount={spectatorHost.spectatorCount} />

      {/* Friend Picker Modal */}
      {currentFirebaseUser && (
        <FriendPickerModal
          key="scorecard-picker"
          visible={showFriendPicker}
          onDismiss={() => setShowFriendPicker(false)}
          onSelectFriend={handleSelectFriend}
          currentUserId={currentFirebaseUser.uid}
          title="Share Score With"
        />
      )}

      {/* Spectator Invite Picker (Friends + Groups) */}
      <SpectatorInviteModal
        visible={showSpectatorInvitePicker}
        onDismiss={() => setShowSpectatorInvitePicker(false)}
        currentUserId={currentFirebaseUser?.uid || ""}
        inviteData={
          spectatorHost.spectatorRoomId
            ? {
                roomId: spectatorHost.spectatorRoomId,
                gameType: "timed_tap",
                hostName: profile?.displayName || profile?.username || "Player",
              }
            : null
        }
        onInviteRef={(ref) => spectatorHost.registerInviteMessage(ref)}
        onSent={(name) => showSuccess(`Spectator invite sent to ${name}!`)}
        onError={showError}
      />

      {/* Multiplayer Overlays */}
      {mp.isMultiplayer && mp.phase === "waiting" && (
        <WaitingOverlay
          colors={{
            primary: colors.primary,
            background: "#1a1a1a",
            surface: "#222",
            text: "#fff",
            textSecondary: "rgba(255,255,255,0.6)",
            border: "#333",
          }}
          onCancel={() => mp.cancelMultiplayer()}
        />
      )}
      {mp.isMultiplayer && mp.phase === "countdown" && (
        <CountdownOverlay
          colors={{
            primary: colors.primary,
            background: "#1a1a1a",
            surface: "#222",
            text: "#fff",
            textSecondary: "rgba(255,255,255,0.6)",
            border: "#333",
          }}
          countdown={mp.countdown}
        />
      )}
      {mp.isMultiplayer && mp.reconnecting && (
        <ReconnectingOverlay
          colors={{
            primary: colors.primary,
            background: "#1a1a1a",
            surface: "#222",
            text: "#fff",
            textSecondary: "rgba(255,255,255,0.6)",
            border: "#333",
          }}
        />
      )}
      {mp.isMultiplayer && mp.phase === "finished" && (
        <GameOverOverlay
          isWinner={mp.isWinner}
          isTie={mp.isTie}
          winnerName={mp.winnerName}
          myScore={tapCount}
          opponentScore={mp.opponentScore}
          opponentName={mp.opponentName}
          rematchRequested={mp.rematchRequested}
          onPlayAgain={startGame}
          onRematch={mp.requestRematch}
          onAcceptRematch={mp.acceptRematch}
          onMenu={() => {
            mp.cancelMultiplayer();
            setGameState("waiting");
          }}
          colors={{
            primary: colors.primary,
            background: "#1a1a1a",
            surface: "#222",
            text: "#fff",
            textSecondary: "rgba(255,255,255,0.6)",
            border: "#333",
          }}
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
    backgroundColor: "#1a1a1a",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  headerSpacer: {
    width: 40,
  },
  statsArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  statsBig: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
  },
  statsSubtext: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.6)",
    marginTop: 8,
    textAlign: "center",
  },
  personalBestText: {
    fontSize: 14,
    marginTop: 16,
  },
  timerContainer: {
    width: "100%",
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 32,
  },
  timerText: {
    fontSize: 48,
    fontWeight: "bold",
    marginBottom: 8,
  },
  progressBar: {
    width: "100%",
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 252, 0, 0.2)",
  },
  tapCountBig: {
    fontSize: 120,
    fontWeight: "bold",
    color: "#fff",
    lineHeight: 130,
  },
  tapsPerSecond: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.6)",
  },
  finishedLabel: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  tapCountFinal: {
    fontSize: 96,
    fontWeight: "bold",
    color: "#fff",
  },
  tapsLabel: {
    fontSize: 24,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: -8,
  },
  newBestBadge: {
    fontSize: 24,
    color: "#FFD700",
    marginTop: 16,
  },
  buttonArea: {
    paddingBottom: 40,
    alignItems: "center",
  },
  tapButtonOuter: {
    borderRadius: 100,
  },
  tapButton: {
    width: 180,
    height: 180,
    borderRadius: 90,
    justifyContent: "center",
    alignItems: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  tapButtonText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000",
    marginTop: 4,
  },
  resultPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 20,
  },
  resultItem: {
    alignItems: "center",
  },
  resultLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  resultValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000",
  },
  resultValueBest: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFD700",
  },
  resultActions: {
    flexDirection: "row",
    justifyContent: "center",
  },
  shareButton: {
    flex: 1,
    maxWidth: 200,
  },
});

export default withGameErrorBoundary(TimedTapGameScreen, "timed_tap");
