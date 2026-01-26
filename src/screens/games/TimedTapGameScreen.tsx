/**
 * TimedTapGameScreen - Speed Tapping Game
 *
 * How to play:
 * 1. Tap the button as many times as you can
 * 2. You have 10 seconds
 * 3. Higher tap counts are better!
 */

import FriendPickerModal from "@/components/FriendPickerModal";
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
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import {
  Button,
  Dialog,
  Portal,
  ProgressBar,
  Text,
  useTheme,
} from "react-native-paper";
import { AppColors } from "../../../constants/theme";

// =============================================================================
// Types
// =============================================================================

type GameState = "waiting" | "playing" | "finished";

interface TimedTapGameScreenProps {
  navigation: any;
}

// =============================================================================
// Constants
// =============================================================================

const GAME_DURATION = 10000; // 10 seconds
const UPDATE_INTERVAL = 100; // Update timer every 100ms

// =============================================================================
// Component
// =============================================================================

export default function TimedTapGameScreen({
  navigation,
}: TimedTapGameScreenProps) {
  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { showSuccess, showError, showInfo } = useSnackbar();

  const [gameState, setGameState] = useState<GameState>("waiting");
  const [tapCount, setTapCount] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(GAME_DURATION);
  const [personalBest, setPersonalBest] = useState<PersonalBest | null>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const buttonColorAnim = useRef(new Animated.Value(0)).current;

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

      // Animate button press
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 50,
          useNativeDriver: true,
        }),
      ]).start();

      // Flash color
      Animated.sequence([
        Animated.timing(buttonColorAnim, {
          toValue: 1,
          duration: 50,
          useNativeDriver: false,
        }),
        Animated.timing(buttonColorAnim, {
          toValue: 0,
          duration: 100,
          useNativeDriver: false,
        }),
      ]).start();

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
      console.error("[TimedTap] Error sharing score:", error);
      showError("Failed to share score. Try again.");
    } finally {
      setIsSending(false);
    }
  };

  const progress = timeRemaining / GAME_DURATION;

  const buttonBackgroundColor = buttonColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [AppColors.primary, "#FF6B00"],
  });

  const getTapsPerSecond = () => {
    if (tapCount === 0) return "0.0";
    const elapsed = GAME_DURATION - timeRemaining;
    if (elapsed === 0) return "0.0";
    return (tapCount / (elapsed / 1000)).toFixed(1);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Speed Tap</Text>
        <View style={styles.headerSpacer} />
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
              <Text style={styles.personalBestText}>
                Personal Best: {personalBest.bestScore} taps
              </Text>
            )}
          </>
        )}

        {gameState === "playing" && (
          <>
            <View style={styles.timerContainer}>
              <Text style={styles.timerText}>
                {(timeRemaining / 1000).toFixed(1)}s
              </Text>
              <ProgressBar
                progress={progress}
                color={theme.colors.primary}
                style={styles.progressBar}
              />
            </View>
            <Text style={styles.tapCountBig}>{tapCount}</Text>
            <Text style={styles.tapsPerSecond}>
              {getTapsPerSecond()} taps/sec
            </Text>
          </>
        )}

        {gameState === "finished" && (
          <>
            <Text style={styles.finishedLabel}>TIME'S UP!</Text>
            <Text style={styles.tapCountFinal}>{tapCount}</Text>
            <Text style={styles.tapsLabel}>TAPS</Text>
            {isNewBest && <Text style={styles.newBestBadge}>🎉 NEW BEST!</Text>}
          </>
        )}
      </View>

      {/* Tap Button */}
      <View style={styles.buttonArea}>
        <TouchableOpacity
          onPress={handleTap}
          activeOpacity={1}
          style={styles.tapButtonOuter}
        >
          {/* Outer Animated.View for scale (uses native driver) */}
          <Animated.View
            style={{
              transform: [{ scale: scaleAnim }],
            }}
          >
            {/* Inner Animated.View for backgroundColor (uses JS driver) */}
            <Animated.View
              style={[
                styles.tapButton,
                {
                  backgroundColor:
                    gameState === "playing"
                      ? buttonBackgroundColor
                      : theme.colors.primary,
                },
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

      {/* Friend Picker Modal */}
      {currentFirebaseUser && (
        <FriendPickerModal
          visible={showFriendPicker}
          onDismiss={() => setShowFriendPicker(false)}
          onSelectFriend={handleSelectFriend}
          currentUserId={currentFirebaseUser.uid}
          title="Share Score With"
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
    color: AppColors.primary,
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
    color: AppColors.primary,
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
    color: AppColors.primary,
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
    shadowColor: AppColors.primary,
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
