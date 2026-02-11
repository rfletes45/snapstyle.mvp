/**
 * ReactionTapGameScreen - Reaction Time Game
 *
 * How to play:
 * 1. Wait for the screen to turn green
 * 2. Tap as fast as you can when it changes
 * 3. Your reaction time is measured in milliseconds
 * 4. Lower scores are better!
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
  formatScore,
  getPersonalBest,
  PersonalBest,
  recordGameSession,
  sendScorecard,
} from "@/services/games";
import { useAuth } from "@/store/AuthContext";
import { useSnackbar } from "@/store/SnackbarContext";
import { useColors } from "@/store/ThemeContext";
import { useUser } from "@/store/UserContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  Canvas,
  Circle,
  LinearGradient,
  RadialGradient,
  RoundedRect,
  vec,
} from "@shopify/react-native-skia";
import React, { useEffect, useRef, useState } from "react";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
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
import { Button, Dialog, Portal, Text } from "react-native-paper";


import { createLogger } from "@/utils/log";
import { withGameErrorBoundary } from "@/components/games/GameErrorBoundary";
import { useGameBackHandler } from "@/hooks/useGameBackHandler";
import { useGameHaptics } from "@/hooks/useGameHaptics";
import { GameOverModal } from "@/components/games/GameOverModal";
import { useGameCompletion } from "@/hooks/useGameCompletion";
const logger = createLogger("screens/games/ReactionTapGameScreen");
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// =============================================================================
// Types
// =============================================================================

type GameState = "waiting" | "ready" | "go" | "tapped" | "too_early" | "result";

interface ReactionTapGameScreenProps {
  navigation: any;
  route: any;
}

// =============================================================================
// Constants
// =============================================================================

const MIN_WAIT_TIME = 1500; // Minimum wait before green (1.5s)
const MAX_WAIT_TIME = 5000; // Maximum wait before green (5s)

// =============================================================================
// Component
// =============================================================================

function ReactionTapGameScreen({
  navigation,
  route,
}: ReactionTapGameScreenProps) {
  const __codexGameCompletion = useGameCompletion({ gameType: "reaction_tap" });
  void __codexGameCompletion;

  useGameBackHandler({ gameType: "reaction_tap", isGameOver: false });
  const __codexGameHaptics = useGameHaptics();
  void __codexGameHaptics;
  const __codexGameOverModal = (
    <GameOverModal visible={false} result="loss" stats={{}} onExit={() => {}} />
  );
  void __codexGameOverModal;

  const colors = useColors();
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { showSuccess, showError, showInfo } = useSnackbar();
  const { resolvedMode, firestoreGameId } = useGameConnection(
    "reaction_tap",
    route?.params?.matchId,
  );
  const mp = useMultiplayerGame({
    gameType: "reaction_tap",
    firestoreGameId: firestoreGameId ?? undefined,
  });

  useEffect(() => {
    if (resolvedMode === "colyseus" && firestoreGameId) {
      mp.startMultiplayer();
    }
  }, [resolvedMode, firestoreGameId]);

  const [gameState, setGameState] = useState<GameState>("waiting");
  const [reactionTime, setReactionTime] = useState<number | null>(null);
  const [personalBest, setPersonalBest] = useState<PersonalBest | null>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);

  // Spectator hosting
  const spectatorHost = useSpectator({
    mode: "sp-host",
    gameType: "reaction_tap",
  });
  const [showSpectatorInvitePicker, setShowSpectatorInvitePicker] =
    useState(false);

  // Auto-start spectator hosting so invites can be sent before game starts
  useEffect(() => {
    spectatorHost.startHosting();
  }, []);

  const startTimeRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseScale = useSharedValue(1);

  // Load personal best
  useEffect(() => {
    if (currentFirebaseUser) {
      getPersonalBest(currentFirebaseUser.uid, "reaction_tap").then(
        setPersonalBest,
      );
    }
  }, [currentFirebaseUser]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (resultTimerRef.current) {
        clearTimeout(resultTimerRef.current);
      }
    };
  }, []);

  // Pulse animation for waiting state
  useEffect(() => {
    if (gameState === "ready") {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 500 }),
          withTiming(1, { duration: 500 }),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(pulseScale);
      pulseScale.value = 1;
    }

    return () => {
      cancelAnimation(pulseScale);
    };
  }, [gameState, pulseScale]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const startGame = () => {
    setGameState("ready");
    setReactionTime(null);
    setIsNewBest(false);
    spectatorHost.startHosting();

    // Random delay before showing green
    const delay =
      MIN_WAIT_TIME + Math.random() * (MAX_WAIT_TIME - MIN_WAIT_TIME);

    timeoutRef.current = setTimeout(() => {
      setGameState("go");
      startTimeRef.current = Date.now();
      // Vibrate to signal GO
      if (Platform.OS !== "web") {
        Vibration.vibrate(50);
      }
    }, delay);
  };

  // Broadcast game state to spectators
  useEffect(() => {
    if (gameState !== "waiting") {
      spectatorHost.updateGameState(
        JSON.stringify({
          gameState,
          reactionTime,
        }),
        reactionTime ?? 0,
        undefined,
        undefined,
      );
    }
  }, [gameState, reactionTime]);

  const handleTap = async () => {
    if (
      gameState === "waiting" ||
      gameState === "result" ||
      gameState === "too_early"
    ) {
      // Start new game
      startGame();
      return;
    }

    if (gameState === "ready") {
      // Too early!
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setGameState("too_early");
      if (Platform.OS !== "web") {
        Vibration.vibrate([0, 100, 50, 100]); // Error vibration
      }
      return;
    }

    if (gameState === "go") {
      // Calculate reaction time
      const endTime = Date.now();
      const reaction = endTime - startTimeRef.current;
      setReactionTime(reaction);
      setGameState("tapped");
      spectatorHost.endHosting(reaction);

      // Report to multiplayer
      if (mp.isMultiplayer) mp.reportScore(reaction);

      // Check if new personal best
      const newBest = !personalBest || reaction < personalBest.bestScore;
      setIsNewBest(newBest);

      if (newBest && Platform.OS !== "web") {
        Vibration.vibrate([0, 50, 50, 50, 50, 50]); // Celebration vibration
      }

      // Record the game session
      if (currentFirebaseUser) {
        const session = await recordGameSession(currentFirebaseUser.uid, {
          gameId: "reaction_tap",
          score: reaction,
          reactionTime: reaction,
        });

        if (session && newBest) {
          setPersonalBest({
            gameId: "reaction_tap",
            bestScore: reaction,
            achievedAt: Date.now(),
          });
          showSuccess("🎉 New Personal Best!");
        }

        if (mp.isMultiplayer) mp.reportFinished();
      }

      // Show result after a brief moment
      resultTimerRef.current = setTimeout(() => {
        setGameState("result");
      }, 1000);
    }
  };

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
    if (!currentFirebaseUser || !reactionTime || !profile) return;

    setIsSending(true);
    setShowFriendPicker(false);

    try {
      const success = await sendScorecard(
        currentFirebaseUser.uid,
        friend.friendUid,
        {
          gameId: "reaction_tap",
          score: reactionTime,
          playerName: profile.displayName || profile.username || "Player",
        },
      );

      if (success) {
        showSuccess(`Score shared with ${friend.displayName}!`);
      } else {
        showError("Failed to share score. Try again.");
      }
    } catch (error) {
      logger.error("[ReactionTap] Error sharing score:", error);
      showError("Failed to share score. Try again.");
    } finally {
      setIsSending(false);
    }
  };

  const getBackgroundColor = () => {
    switch (gameState) {
      case "waiting":
        return "#1a1a1a";
      case "ready":
        return "#d32f2f"; // Red - wait
      case "go":
        return "#4CAF50"; // Green - tap now!
      case "tapped":
        return "#2196F3"; // Blue - tapped
      case "too_early":
        return "#FF9800"; // Orange - too early
      case "result":
        return "#1a1a1a";
      default:
        return "#1a1a1a";
    }
  };

  const getInstructionText = () => {
    switch (gameState) {
      case "waiting":
        return "Tap to Start";
      case "ready":
        return "Wait for green...";
      case "go":
        return "TAP NOW!";
      case "tapped":
        return reactionTime ? `${reactionTime}ms` : "...";
      case "too_early":
        return "Too early! 😅";
      case "result":
        return "Tap to Play Again";
      default:
        return "";
    }
  };

  const getSubText = () => {
    switch (gameState) {
      case "waiting":
        return "Test your reaction time";
      case "ready":
        return "Don't tap yet!";
      case "go":
        return "";
      case "tapped":
        return isNewBest ? "🎉 New Best!" : "";
      case "too_early":
        return "Tap to try again";
      case "result":
        return personalBest
          ? `Personal Best: ${formatScore("reaction_tap", personalBest.bestScore)}`
          : "";
      default:
        return "";
    }
  };

  const getGradientColors = (): [string, string, string] => {
    switch (gameState) {
      case "waiting":
        return ["#1A2332", "#0F1923", "#0A1118"];
      case "ready":
        return ["#FF6B6B", "#D32F2F", "#8E1A1A"];
      case "go":
        return ["#66BB6A", "#4CAF50", "#2E7D32"];
      case "tapped":
        return ["#64B5F6", "#2196F3", "#1565C0"];
      case "too_early":
        return ["#FFB74D", "#FF9800", "#E65100"];
      case "result":
        return ["#1A2332", "#0F1923", "#0A1118"];
      default:
        return ["#1A2332", "#0F1923", "#0A1118"];
    }
  };

  const getGlowColor = (): string => {
    switch (gameState) {
      case "go":
        return "#4CAF5060";
      case "ready":
        return "#D32F2F50";
      case "tapped":
        return "#2196F360";
      case "too_early":
        return "#FF980060";
      default:
        return "#00000000";
    }
  };

  return (
    <View style={styles.container}>
      {/* Game Area */}
      <TouchableOpacity
        style={[styles.gameArea, { backgroundColor: getBackgroundColor() }]}
        onPress={handleTap}
        activeOpacity={0.9}
      >
        {/* Skia gradient overlay */}
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
              colors={getGradientColors()}
            />
          </RoundedRect>
          {/* Center glow */}
          <Circle
            cx={SCREEN_WIDTH / 2}
            cy={SCREEN_HEIGHT / 2.5}
            r={SCREEN_WIDTH * 0.6}
          >
            <RadialGradient
              c={vec(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2.5)}
              r={SCREEN_WIDTH * 0.6}
              colors={[getGlowColor(), "#00000000"]}
            />
          </Circle>
        </Canvas>
        <Animated.View style={[styles.instructionContainer, pulseStyle]}>
          {gameState === "go" && (
            <MaterialCommunityIcons
              name="gesture-tap"
              size={64}
              color="#fff"
              style={styles.tapIcon}
            />
          )}
          <Text style={styles.instructionText}>{getInstructionText()}</Text>
          {getSubText() ? (
            <Text style={styles.subText}>{getSubText()}</Text>
          ) : null}
        </Animated.View>
      </TouchableOpacity>

      {/* Result Panel */}
      {gameState === "result" && reactionTime && (
        <View style={styles.resultPanel}>
          <View style={styles.resultRow}>
            <View style={styles.resultItem}>
              <Text style={styles.resultLabel}>Your Time</Text>
              <Text style={styles.resultValue}>{reactionTime}ms</Text>
            </View>
            {personalBest && (
              <View style={styles.resultItem}>
                <Text style={styles.resultLabel}>Best</Text>
                <Text style={styles.resultValueBest}>
                  {personalBest.bestScore}ms
                </Text>
              </View>
            )}
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

      {/* Opponent Score Bar */}
      {mp.isMultiplayer && mp.opponentName && (
        <OpponentScoreBar
          opponentName={mp.opponentName}
          opponentScore={mp.opponentScore}
          myScore={mp.myScore}
          timeRemaining={mp.timeRemaining}
          opponentDisconnected={mp.opponentDisconnected}
          colors={{
            primary: "#4CAF50",
            background: "#1a1a1a",
            surface: "#222",
            text: "#fff",
            textSecondary: "rgba(255,255,255,0.6)",
            border: "#333",
          }}
        />
      )}

      {/* Back Button */}
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
        <Text style={styles.headerTitle}>Reaction Time</Text>
        <View style={styles.headerSpacer}>
          {spectatorHost.spectatorRoomId && (
            <TouchableOpacity
              onPress={() => setShowSpectatorInvitePicker(true)}
              accessibilityLabel="Invite spectators"
            >
              <MaterialCommunityIcons
                name="eye"
                size={22}
                color={colors.primary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Share Dialog */}
      <Portal>
        <Dialog
          visible={showShareDialog}
          onDismiss={() => setShowShareDialog(false)}
        >
          <Dialog.Title>Share Your Score</Dialog.Title>
          <Dialog.Content>
            <Text>
              Share your reaction time of {reactionTime}ms with a friend?
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowShareDialog(false)}>Cancel</Button>
            <Button onPress={shareToChat}>Choose Friend</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

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

      {/* Spectator Overlay */}
      <SpectatorOverlay spectatorCount={spectatorHost.spectatorCount} />

      {/* Spectator Invite Picker (Friends + Groups) */}
      <SpectatorInviteModal
        visible={showSpectatorInvitePicker}
        onDismiss={() => setShowSpectatorInvitePicker(false)}
        currentUserId={currentFirebaseUser?.uid || ""}
        inviteData={
          spectatorHost.spectatorRoomId
            ? {
                roomId: spectatorHost.spectatorRoomId,
                gameType: "reaction_tap",
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
          onCancel={() => mp.cancelMultiplayer()}
          colors={{
            primary: "#4CAF50",
            background: "#1a1a1a",
            surface: "#222",
            text: "#fff",
            textSecondary: "rgba(255,255,255,0.6)",
            border: "#333",
          }}
        />
      )}
      {mp.isMultiplayer && mp.phase === "countdown" && (
        <CountdownOverlay
          countdown={mp.countdown}
          colors={{
            primary: "#4CAF50",
            background: "#1a1a1a",
            surface: "#222",
            text: "#fff",
            textSecondary: "rgba(255,255,255,0.6)",
            border: "#333",
          }}
        />
      )}
      {mp.isMultiplayer && mp.reconnecting && (
        <ReconnectingOverlay
          colors={{
            primary: "#4CAF50",
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
          myScore={reactionTime || 0}
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
            primary: "#4CAF50",
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
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
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
  gameArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  instructionContainer: {
    alignItems: "center",
  },
  tapIcon: {
    marginBottom: 16,
  },
  instructionText: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
  },
  subText: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.7)",
    marginTop: 8,
    textAlign: "center",
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
    fontSize: 32,
    fontWeight: "bold",
    color: "#000",
  },
  resultValueBest: {
    fontSize: 32,
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
  multiplayerButtonContainer: {
    position: "absolute",
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  multiplayerButton: {
    minWidth: 180,
    borderRadius: 24,
  },
});

export default withGameErrorBoundary(ReactionTapGameScreen, "reaction_tap");
