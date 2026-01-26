/**
 * MemorySnapGameScreen - Memory Card Matching Game
 *
 * How to play:
 * 1. Tap cards to flip them over
 * 2. Match pairs of identical cards
 * 3. Complete the board as fast as possible
 * 4. Fewer attempts = better score!
 *
 * Features:
 * - Multiple difficulty levels (4x3, 4x4, 5x4, 6x5)
 * - Themed card backs with Snap emojis
 * - Time tracking and attempt counting
 * - Star rating system
 */

import FriendPickerModal from "@/components/FriendPickerModal";
import { sendScorecard } from "@/services/games";
import { recordSinglePlayerSession } from "@/services/singlePlayerSessions";
import { useAuth } from "@/store/AuthContext";
import { useSnackbar } from "@/store/SnackbarContext";
import { useUser } from "@/store/UserContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
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
  SegmentedButtons,
  Text,
  useTheme,
} from "react-native-paper";

// =============================================================================
// Types
// =============================================================================

type GameStatus = "idle" | "playing" | "paused" | "completed";
type Difficulty = "easy" | "medium" | "hard" | "expert";

interface Card {
  id: number;
  emoji: string;
  isFlipped: boolean;
  isMatched: boolean;
  flipAnim: Animated.Value;
}

interface MemorySnapGameScreenProps {
  navigation: any;
}

// =============================================================================
// Constants
// =============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GAME_WIDTH = Math.min(SCREEN_WIDTH - 32, 380);

// Emojis for card faces
const CARD_EMOJIS = [
  "😀",
  "😎",
  "🥳",
  "😍",
  "🤩",
  "😇",
  "🤪",
  "😺",
  "🐶",
  "🐱",
  "🦊",
  "🐻",
  "🐼",
  "🐨",
  "🐯",
  "🦁",
  "🌟",
  "⭐",
  "🔥",
  "💎",
  "🎈",
  "🎁",
  "🎮",
  "🎯",
  "🍎",
  "🍊",
  "🍋",
  "🍇",
  "🍓",
  "🍒",
  "🥝",
  "🍑",
];

// Difficulty configurations
const DIFFICULTY_CONFIG: Record<
  Difficulty,
  { rows: number; cols: number; timeBonus: number }
> = {
  easy: { rows: 3, cols: 4, timeBonus: 60 },
  medium: { rows: 4, cols: 4, timeBonus: 90 },
  hard: { rows: 4, cols: 5, timeBonus: 120 },
  expert: { rows: 5, cols: 6, timeBonus: 180 },
};

// Star thresholds (based on attempts vs pairs)
const getStarRating = (pairs: number, attempts: number): number => {
  const ratio = attempts / pairs;
  if (ratio <= 1.2) return 3;
  if (ratio <= 1.8) return 2;
  if (ratio <= 2.5) return 1;
  return 0;
};

// =============================================================================
// Helper Functions
// =============================================================================

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function generateCards(rows: number, cols: number): Card[] {
  const totalCards = rows * cols;
  const pairCount = totalCards / 2;

  // Select random emojis
  const selectedEmojis = shuffleArray(CARD_EMOJIS).slice(0, pairCount);

  // Create pairs
  const cardEmojis = shuffleArray([...selectedEmojis, ...selectedEmojis]);

  return cardEmojis.map((emoji, index) => ({
    id: index,
    emoji,
    isFlipped: false,
    isMatched: false,
    flipAnim: new Animated.Value(0),
  }));
}

// =============================================================================
// Component
// =============================================================================

export default function MemorySnapGameScreen({
  navigation,
}: MemorySnapGameScreenProps) {
  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { showSuccess, showError } = useSnackbar();

  // Game state
  const [status, setStatus] = useState<GameStatus>("idle");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [timer, setTimer] = useState(0);
  const [highScore, setHighScore] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);

  // Share state
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Refs
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isChecking = useRef(false);

  // Get current config
  const config = DIFFICULTY_CONFIG[difficulty];
  const totalPairs = (config.rows * config.cols) / 2;
  const cardSize = Math.min(
    (GAME_WIDTH - (config.cols + 1) * 8) / config.cols,
    70,
  );

  // Start game
  const startGame = useCallback(() => {
    const newCards = generateCards(config.rows, config.cols);
    setCards(newCards);
    setFlippedCards([]);
    setMatchedPairs(0);
    setAttempts(0);
    setTimer(0);
    setIsNewBest(false);
    setStatus("playing");

    // Start timer
    timerRef.current = setInterval(() => {
      setTimer((t) => t + 1);
    }, 1000);
  }, [config]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Flip card animation
  const flipCard = useCallback((card: Card, toFlipped: boolean) => {
    Animated.timing(card.flipAnim, {
      toValue: toFlipped ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, []);

  // Handle card tap
  const handleCardTap = useCallback(
    (cardIndex: number) => {
      if (status !== "playing" || isChecking.current) return;

      const card = cards[cardIndex];
      if (card.isFlipped || card.isMatched) return;
      if (flippedCards.length >= 2) return;

      // Flip the card
      const newCards = [...cards];
      newCards[cardIndex] = { ...card, isFlipped: true };
      setCards(newCards);
      flipCard(card, true);

      if (Platform.OS !== "web") {
        Vibration.vibrate(10);
      }

      const newFlipped = [...flippedCards, cardIndex];
      setFlippedCards(newFlipped);

      // Check for match when 2 cards are flipped
      if (newFlipped.length === 2) {
        setAttempts((a) => a + 1);
        isChecking.current = true;

        const [firstIndex, secondIndex] = newFlipped;
        const firstCard = newCards[firstIndex];
        const secondCard = newCards[secondIndex];

        if (firstCard.emoji === secondCard.emoji) {
          // Match found!
          setTimeout(() => {
            if (Platform.OS !== "web") {
              Vibration.vibrate([0, 30, 30, 30]);
            }

            const matchedCards = [...newCards];
            matchedCards[firstIndex] = {
              ...matchedCards[firstIndex],
              isMatched: true,
            };
            matchedCards[secondIndex] = {
              ...matchedCards[secondIndex],
              isMatched: true,
            };
            setCards(matchedCards);
            setMatchedPairs((m) => m + 1);
            setFlippedCards([]);
            isChecking.current = false;
          }, 300);
        } else {
          // No match - flip back
          setTimeout(() => {
            const resetCards = [...newCards];
            resetCards[firstIndex] = {
              ...resetCards[firstIndex],
              isFlipped: false,
            };
            resetCards[secondIndex] = {
              ...resetCards[secondIndex],
              isFlipped: false,
            };
            flipCard(firstCard, false);
            flipCard(secondCard, false);
            setCards(resetCards);
            setFlippedCards([]);
            isChecking.current = false;
          }, 800);
        }
      }
    },
    [status, cards, flippedCards, flipCard],
  );

  // Check for game completion
  useEffect(() => {
    if (status === "playing" && matchedPairs === totalPairs) {
      // Game completed!
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      setStatus("completed");

      if (Platform.OS !== "web") {
        Vibration.vibrate([0, 50, 50, 50, 50, 100]);
      }

      // Calculate score
      const timeBonus = Math.max(0, config.timeBonus - timer) * 10;
      const attemptBonus = Math.max(0, totalPairs * 2 - attempts) * 50;
      const finalScore = 1000 + timeBonus + attemptBonus;

      // Check high score
      if (!highScore || finalScore > highScore) {
        setHighScore(finalScore);
        setIsNewBest(true);
        showSuccess("🎉 New High Score!");
      }

      // Record session
      if (currentFirebaseUser) {
        recordSinglePlayerSession(currentFirebaseUser.uid, {
          gameType: "memory_snap",
          finalScore,
          stats: {
            gameType: "memory_snap",
            pairsMatched: totalPairs,
            attempts,
            perfectMatches: totalPairs === attempts ? 1 : 0,
            bestTime: timer,
          },
        }).catch(console.error);
      }
    }
  }, [
    matchedPairs,
    totalPairs,
    status,
    timer,
    attempts,
    config.timeBonus,
    highScore,
    currentFirebaseUser,
    showSuccess,
  ]);

  // Format time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Calculate score
  const calculateScore = (): number => {
    const timeBonus = Math.max(0, config.timeBonus - timer) * 10;
    const attemptBonus = Math.max(0, totalPairs * 2 - attempts) * 50;
    return 1000 + timeBonus + attemptBonus;
  };

  // Share handlers
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
          gameId: "memory_snap",
          score: calculateScore(),
          playerName: profile.displayName || profile.username || "Player",
        },
      );

      if (success) {
        showSuccess(`Score shared with ${friend.displayName}!`);
      } else {
        showError("Failed to share score. Try again.");
      }
    } catch (error) {
      showError("Failed to share score. Try again.");
    } finally {
      setIsSending(false);
    }
  };

  // Render star rating
  const renderStars = (rating: number) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3].map((star) => (
          <MaterialCommunityIcons
            key={star}
            name={star <= rating ? "star" : "star-outline"}
            size={32}
            color={star <= rating ? "#FFD700" : "rgba(255, 255, 255, 0.3)"}
          />
        ))}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: "#1a1a2e" }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
        </TouchableOpacity>

        {status === "playing" && (
          <View style={styles.headerStats}>
            <View style={styles.statBadge}>
              <MaterialCommunityIcons
                name="clock-outline"
                size={16}
                color="white"
              />
              <Text style={styles.statText}>{formatTime(timer)}</Text>
            </View>
            <View style={styles.statBadge}>
              <MaterialCommunityIcons
                name="gesture-tap"
                size={16}
                color="white"
              />
              <Text style={styles.statText}>{attempts}</Text>
            </View>
            <View style={styles.statBadge}>
              <MaterialCommunityIcons name="cards" size={16} color="#4CAF50" />
              <Text style={styles.statText}>
                {matchedPairs}/{totalPairs}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Idle Screen */}
      {status === "idle" && (
        <View style={styles.idleContainer}>
          <MaterialCommunityIcons name="cards" size={80} color="#FFFC00" />
          <Text style={styles.title}>Memory Snap</Text>
          <Text style={styles.subtitle}>Match all the pairs!</Text>

          <View style={styles.difficultyContainer}>
            <Text style={styles.difficultyLabel}>Difficulty</Text>
            <SegmentedButtons
              value={difficulty}
              onValueChange={(value) => setDifficulty(value as Difficulty)}
              buttons={[
                { value: "easy", label: "Easy" },
                { value: "medium", label: "Medium" },
                { value: "hard", label: "Hard" },
                { value: "expert", label: "Expert" },
              ]}
              style={styles.segmentedButtons}
            />
            <Text style={styles.difficultyInfo}>
              {config.rows} × {config.cols} = {config.rows * config.cols} cards
            </Text>
          </View>

          <Button
            mode="contained"
            onPress={startGame}
            style={styles.startButton}
            buttonColor="#FFFC00"
            textColor="#1a1a2e"
            icon="play"
          >
            Start Game
          </Button>
        </View>
      )}

      {/* Game Board */}
      {(status === "playing" || status === "completed") && (
        <View style={styles.gameContainer}>
          <View
            style={[
              styles.board,
              {
                width: config.cols * (cardSize + 8) + 8,
                paddingHorizontal: 4,
              },
            ]}
          >
            {cards.map((card, index) => {
              const row = Math.floor(index / config.cols);
              const col = index % config.cols;

              const frontRotate = card.flipAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ["180deg", "360deg"],
              });

              const backRotate = card.flipAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ["0deg", "180deg"],
              });

              const frontOpacity = card.flipAnim.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, 0, 1],
              });

              const backOpacity = card.flipAnim.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [1, 0, 0],
              });

              return (
                <TouchableOpacity
                  key={card.id}
                  onPress={() => handleCardTap(index)}
                  activeOpacity={0.8}
                  disabled={
                    card.isFlipped || card.isMatched || status === "completed"
                  }
                  style={[
                    styles.cardContainer,
                    {
                      width: cardSize,
                      height: cardSize,
                      marginLeft: 4,
                      marginTop: 4,
                    },
                  ]}
                >
                  {/* Card Back */}
                  <Animated.View
                    style={[
                      styles.card,
                      styles.cardBack,
                      {
                        width: cardSize,
                        height: cardSize,
                        transform: [{ rotateY: backRotate }],
                        opacity: backOpacity,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="help-circle"
                      size={cardSize * 0.5}
                      color="rgba(255, 255, 255, 0.3)"
                    />
                  </Animated.View>

                  {/* Card Front */}
                  <Animated.View
                    style={[
                      styles.card,
                      styles.cardFront,
                      card.isMatched && styles.cardMatched,
                      {
                        width: cardSize,
                        height: cardSize,
                        transform: [{ rotateY: frontRotate }],
                        opacity: frontOpacity,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.cardEmoji, { fontSize: cardSize * 0.5 }]}
                    >
                      {card.emoji}
                    </Text>
                  </Animated.View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Completed Overlay */}
      {status === "completed" && (
        <View style={styles.completedOverlay}>
          <View style={styles.completedContent}>
            <Text style={styles.completedTitle}>🎉 Complete!</Text>

            {renderStars(getStarRating(totalPairs, attempts))}

            <View style={styles.completedStats}>
              <View style={styles.completedStatItem}>
                <Text style={styles.completedStatValue}>
                  {formatTime(timer)}
                </Text>
                <Text style={styles.completedStatLabel}>Time</Text>
              </View>
              <View style={styles.completedStatItem}>
                <Text style={styles.completedStatValue}>{attempts}</Text>
                <Text style={styles.completedStatLabel}>Attempts</Text>
              </View>
              <View style={styles.completedStatItem}>
                <Text style={styles.completedStatValue}>
                  {calculateScore()}
                </Text>
                <Text style={styles.completedStatLabel}>Score</Text>
              </View>
            </View>

            {isNewBest && (
              <View style={styles.newBestBadge}>
                <MaterialCommunityIcons name="star" size={16} color="#FFD700" />
                <Text style={styles.newBestText}>New Best!</Text>
              </View>
            )}

            <View style={styles.buttonRow}>
              <Button
                mode="contained"
                onPress={startGame}
                buttonColor="#4CAF50"
                icon="refresh"
              >
                Play Again
              </Button>
              <Button
                mode="contained"
                onPress={handleShare}
                buttonColor="#FFFC00"
                textColor="#1a1a2e"
                icon="share"
              >
                Share
              </Button>
            </View>

            <Button
              mode="text"
              onPress={() => setStatus("idle")}
              textColor="rgba(255, 255, 255, 0.7)"
            >
              Change Difficulty
            </Button>
          </View>
        </View>
      )}

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
              Challenge your friends! {difficulty.toUpperCase()} mode, Score:{" "}
              {calculateScore()}
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

      {/* Friend Picker */}
      <FriendPickerModal
        visible={showFriendPicker}
        onDismiss={() => setShowFriendPicker(false)}
        onSelectFriend={handleSelectFriend}
        title="Share Score With..."
        currentUserId={currentFirebaseUser?.uid || ""}
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
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 10,
  },
  backButton: {
    padding: 8,
  },
  headerStats: {
    flexDirection: "row",
    gap: 12,
  },
  statBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  statText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  idleContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    color: "white",
    fontSize: 36,
    fontWeight: "bold",
    marginTop: 16,
  },
  subtitle: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 16,
    marginTop: 8,
    marginBottom: 32,
  },
  difficultyContainer: {
    width: "100%",
    maxWidth: 350,
    marginBottom: 32,
  },
  difficultyLabel: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center",
  },
  segmentedButtons: {
    marginBottom: 8,
  },
  difficultyInfo: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 12,
    textAlign: "center",
  },
  startButton: {
    minWidth: 180,
  },
  gameContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  board: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    padding: 4,
  },
  cardContainer: {
    position: "relative",
  },
  card: {
    position: "absolute",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    backfaceVisibility: "hidden",
  },
  cardBack: {
    backgroundColor: "#3f51b5",
    borderWidth: 2,
    borderColor: "#5c6bc0",
  },
  cardFront: {
    backgroundColor: "#fff",
  },
  cardMatched: {
    backgroundColor: "#c8e6c9",
    borderWidth: 2,
    borderColor: "#4CAF50",
  },
  cardEmoji: {
    textAlign: "center",
  },
  completedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  completedContent: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    padding: 24,
    borderRadius: 20,
    width: "100%",
    maxWidth: 320,
  },
  completedTitle: {
    color: "white",
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 16,
  },
  starsContainer: {
    flexDirection: "row",
    marginBottom: 20,
  },
  completedStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginBottom: 20,
  },
  completedStatItem: {
    alignItems: "center",
  },
  completedStatValue: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
  },
  completedStatLabel: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 12,
  },
  newBestBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 215, 0, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 20,
    gap: 4,
  },
  newBestText: {
    color: "#FFD700",
    fontSize: 14,
    fontWeight: "600",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
});
