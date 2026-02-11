/**
 * MemoryMasterGameScreen - Memory Card Matching Game
 *
 * How to play:
 * 1. Tap cards to flip them over
 * 2. Match pairs of identical cards
 * 3. Complete the board as fast as possible
 * 4. Fewer attempts = better score!
 *
 * Features:
 * - Multiple difficulty levels (4x3, 4x4, 5x4, 6x5)
 * - Themed card backs with emojis
 * - Time tracking and attempt counting
 * - Star rating system
 */

import FriendPickerModal from "@/components/FriendPickerModal";
import SpectatorInviteModal from "@/components/SpectatorInviteModal";
import { SpectatorOverlay } from "@/components/games/SpectatorOverlay";
import { useGameBackHandler } from "@/hooks/useGameBackHandler";
import { useSpectator } from "@/hooks/useSpectator";
import { sendScorecard } from "@/services/games";
import { recordSinglePlayerSession } from "@/services/singlePlayerSessions";
import { useAuth } from "@/store/AuthContext";
import { useSnackbar } from "@/store/SnackbarContext";
import { useUser } from "@/store/UserContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  Canvas,
  LinearGradient,
  RadialGradient,
  RoundedRect,
  Shadow,
  vec,
} from "@shopify/react-native-skia";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { withGameErrorBoundary } from "@/components/games/GameErrorBoundary";
import { useGameCompletion } from "@/hooks/useGameCompletion";
import { useGameHaptics } from "@/hooks/useGameHaptics";
import { GameOverModal } from "@/components/games/GameOverModal";
import { createLogger } from "@/utils/log";
import Animated, {
  SharedValue,
  interpolate,
  makeMutable,
  useAnimatedStyle,
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
  flipAnim: SharedValue<number>;
}

interface MemoryMasterGameScreenProps {
  navigation: any;
}

const logger = createLogger("screens/games/MemoryMasterGameScreen");

// =============================================================================
// Constants
// =============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GAME_WIDTH = Math.min(SCREEN_WIDTH - 32, 380);

// Emojis for card faces
const CARD_EMOJIS = [
  "ðŸ˜€",
  "ðŸ˜Ž",
  "ðŸ¥³",
  "ðŸ˜",
  "ðŸ¤©",
  "ðŸ˜‡",
  "ðŸ¤ª",
  "ðŸ˜º",
  "ðŸ¶",
  "ðŸ±",
  "ðŸ¦Š",
  "ðŸ»",
  "ðŸ¼",
  "ðŸ¨",
  "ðŸ¯",
  "ðŸ¦",
  "ðŸŒŸ",
  "â­",
  "ðŸ”¥",
  "ðŸ’Ž",
  "ðŸŽˆ",
  "ðŸŽ",
  "ðŸŽ®",
  "ðŸŽ¯",
  "ðŸŽ",
  "ðŸŠ",
  "ðŸ‹",
  "ðŸ‡",
  "ðŸ“",
  "ðŸ’",
  "ðŸ¥",
  "ðŸ‘",
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
    flipAnim: makeMutable(0),
  }));
}

interface MemoryCardViewProps {
  card: Card;
  cardSize: number;
  disabled: boolean;
  onPress: () => void;
}

function MemoryCardView({
  card,
  cardSize,
  disabled,
  onPress,
}: MemoryCardViewProps) {
  const backStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(card.flipAnim.value, [0, 1], [0, 180]);
    const opacity = interpolate(card.flipAnim.value, [0, 0.5, 1], [1, 0, 0]);
    return {
      transform: [{ rotateY: `${rotateY}deg` }],
      opacity,
    };
  }, [card.flipAnim]);

  const frontStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(card.flipAnim.value, [0, 1], [180, 360]);
    const opacity = interpolate(card.flipAnim.value, [0, 0.5, 1], [0, 0, 1]);
    return {
      transform: [{ rotateY: `${rotateY}deg` }],
      opacity,
    };
  }, [card.flipAnim]);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      disabled={disabled}
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
      <Animated.View
        style={[
          styles.card,
          {
            width: cardSize,
            height: cardSize,
          },
          backStyle,
        ]}
      >
        <Canvas style={StyleSheet.absoluteFill}>
          <RoundedRect x={0} y={0} width={cardSize} height={cardSize} r={8}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(cardSize, cardSize)}
              colors={["#5C6BC0", "#3F51B5", "#303F9F"]}
            />
            <Shadow dx={0} dy={1} blur={3} color="rgba(0,0,0,0.2)" inner />
          </RoundedRect>
          <RoundedRect
            x={cardSize * 0.15}
            y={cardSize * 0.15}
            width={cardSize * 0.7}
            height={cardSize * 0.7}
            r={4}
          >
            <LinearGradient
              start={vec(0, 0)}
              end={vec(cardSize * 0.7, cardSize * 0.7)}
              colors={[
                "rgba(255,255,255,0.08)",
                "rgba(255,255,255,0)",
                "rgba(255,255,255,0.06)",
              ]}
            />
          </RoundedRect>
          <RoundedRect x={1} y={1} width={cardSize - 2} height={cardSize * 0.3} r={7}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(0, cardSize * 0.3)}
              colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0)"]}
            />
          </RoundedRect>
        </Canvas>
        <MaterialCommunityIcons
          name="help-circle"
          size={cardSize * 0.5}
          color="rgba(255, 255, 255, 0.3)"
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.card,
          {
            width: cardSize,
            height: cardSize,
          },
          frontStyle,
        ]}
      >
        <Canvas style={StyleSheet.absoluteFill}>
          <RoundedRect x={0} y={0} width={cardSize} height={cardSize} r={8}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(cardSize, cardSize)}
              colors={
                card.isMatched
                  ? ["#C8E6C9", "#A5D6A7", "#81C784"]
                  : ["#FFFFFF", "#F8F8F8", "#F0F0F0"]
              }
            />
            <Shadow dx={0} dy={1} blur={2} color="rgba(0,0,0,0.1)" inner />
          </RoundedRect>
          {card.isMatched && (
            <RoundedRect x={0} y={0} width={cardSize} height={cardSize} r={8}>
              <RadialGradient
                c={vec(cardSize / 2, cardSize / 2)}
                r={cardSize * 0.6}
                colors={["rgba(76, 175, 80, 0.2)", "rgba(76, 175, 80, 0)"]}
              />
            </RoundedRect>
          )}
        </Canvas>
        <Text style={[styles.cardEmoji, { fontSize: cardSize * 0.5 }]}>
          {card.emoji}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// =============================================================================
// Component
// =============================================================================

function MemoryMasterGameScreen({
  navigation,
}: MemoryMasterGameScreenProps) {
  const __codexGameCompletion = useGameCompletion({ gameType: "memory_master" });
  void __codexGameCompletion;
  const __codexGameHaptics = useGameHaptics();
  void __codexGameHaptics;
  const __codexGameOverModal = (
    <GameOverModal visible={false} result="loss" stats={{}} onExit={() => {}} />
  );
  void __codexGameOverModal;

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

  // Spectator hosting â€” allows friends to watch via SpectatorRoom
  const spectatorHost = useSpectator({
    mode: "sp-host",
    gameType: "memory_master",
  });
  const [showSpectatorInvitePicker, setShowSpectatorInvitePicker] =
    useState(false);

  // Auto-start spectator hosting so invites can be sent before game starts
  useEffect(() => {
    spectatorHost.startHosting();
  }, []);

  // Refs
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isChecking = useRef(false);
  const flipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup flip timer on unmount
  useEffect(() => {
    return () => {
      if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
    };
  }, []);

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
    spectatorHost.startHosting();

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

  // Broadcast game state to spectators
  useEffect(() => {
    if (status === "playing") {
      spectatorHost.updateGameState(
        JSON.stringify({
          matchedPairs,
          totalPairs,
          attempts,
          timer,
          status,
          // Visual state for spectator renderer
          grid: cards.map((card) => ({
            id: card.id,
            color: card.emoji,
            selected: card.isFlipped,
            matched: card.isMatched,
          })),
          gridRows: DIFFICULTY_CONFIG[difficulty]?.rows ?? 4,
          gridCols: DIFFICULTY_CONFIG[difficulty]?.cols ?? 4,
          comboCount: 0,
        }),
        matchedPairs,
        undefined,
        undefined,
      );
    }
  }, [matchedPairs, attempts, timer, cards]);

  // Flip card animation
  const flipCard = useCallback((card: Card, toFlipped: boolean) => {
    card.flipAnim.value = withTiming(toFlipped ? 1 : 0, { duration: 200 });
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
          flipTimerRef.current = setTimeout(() => {
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
          flipTimerRef.current = setTimeout(() => {
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
      spectatorHost.endHosting(matchedPairs);

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
        showSuccess("ðŸŽ‰ New High Score!");
      }

      // Record session
      if (currentFirebaseUser) {
        recordSinglePlayerSession(currentFirebaseUser.uid, {
          gameType: "memory_master",
          finalScore,
          stats: {
            gameType: "memory_master",
            pairsMatched: totalPairs,
            attempts,
            perfectMatches: totalPairs === attempts ? 1 : 0,
            bestTime: timer,
          },
        }).catch((err) => {
          logger.error("[MemoryMaster] Failed to record session", err);
        });
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
          gameId: "memory_master",
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

  // Back navigation with confirmation dialog
  const { handleBack } = useGameBackHandler({
    gameType: "memory_master",
    isGameOver: status === "completed" || status === "idle",
  });

  return (
    <View style={[styles.container, { backgroundColor: "#1a1a2e" }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={theme.colors.onBackground}
          />
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

        {spectatorHost.spectatorRoomId && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setShowSpectatorInvitePicker(true)}
          >
            <MaterialCommunityIcons name="eye" size={24} color="#FFFC00" />
          </TouchableOpacity>
        )}
      </View>

      {/* Idle Screen */}
      {status === "idle" && (
        <View style={styles.idleContainer}>
          <MaterialCommunityIcons name="cards" size={80} color="#FFFC00" />
          <Text style={styles.title}>Memory</Text>
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
              {config.rows} Ã— {config.cols} = {config.rows * config.cols} cards
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
            {cards.map((card, index) => (
              <MemoryCardView
                key={card.id}
                card={card}
                cardSize={cardSize}
                disabled={
                  card.isFlipped || card.isMatched || status === "completed"
                }
                onPress={() => handleCardTap(index)}
              />
            ))}
          </View>
        </View>
      )}

      {/* Completed Overlay */}
      {status === "completed" && (
        <View style={styles.completedOverlay}>
          <View style={styles.completedContent}>
            <Text style={styles.completedTitle}>ðŸŽ‰ Complete!</Text>

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
        key="scorecard-picker"
        visible={showFriendPicker}
        onDismiss={() => setShowFriendPicker(false)}
        onSelectFriend={handleSelectFriend}
        title="Share Score With..."
        currentUserId={currentFirebaseUser?.uid || ""}
      />

      {/* Spectator overlay â€” shows count of watchers */}
      {spectatorHost.spectatorCount > 0 && (
        <SpectatorOverlay spectatorCount={spectatorHost.spectatorCount} />
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
                gameType: "memory_master",
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

export default withGameErrorBoundary(MemoryMasterGameScreen, "memory_master");
