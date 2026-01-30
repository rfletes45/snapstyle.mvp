/**
 * CrazyEightsGameScreen
 *
 * Features:
 * - Real-time turn-based card gameplay via Firestore
 * - Fan-style hand display with card selection
 * - Central discard pile and deck with haptic feedback
 * - Suit selector when playing an 8
 * - Turn indicator and game status
 * - Game invites and matchmaking
 * - Polished game over modal
 *
 * @see docs/07_GAMES_ARCHITECTURE.md
 * @see src/types/turnBased.ts
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Modal, Portal, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import FriendPickerModal from "@/components/FriendPickerModal";
import { GameOverModal, GameResult } from "@/components/games/GameOverModal";
import { useGameHaptics } from "@/hooks/useGameHaptics";
import { sendGameInvite } from "@/services/gameInvites";
import {
  calculateHandScore,
  createInitialCrazyEightsState,
  getPlayableCards,
  getSuitColor,
  getSuitSymbol,
  hasPlayableCard,
  sortHand,
  validateCrazyEightsMove,
} from "@/services/games/crazyEightsLogic";
import {
  endMatch,
  resignMatch,
  submitMove,
  subscribeToMatch,
} from "@/services/turnBasedGames";
import { useAuth } from "@/store/AuthContext";
import { useUser } from "@/store/UserContext";
import {
  Card,
  CardSuit,
  CrazyEightsGameState,
  CrazyEightsMatch,
  CrazyEightsMove,
} from "@/types/turnBased";
import { BorderRadius, Spacing } from "../../../constants/theme";
// =============================================================================
// Constants
// =============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const CARD_WIDTH = 60;
const CARD_HEIGHT = 90;
const CARD_BORDER_RADIUS = 8;

// Colors
const CARD_BACKGROUND = "#FFFFFF";
const CARD_BORDER = "#CCCCCC";
const FELT_GREEN = "#2d5a27";
const DECK_BLUE = "#1a3a5c";

// =============================================================================
// Types
// =============================================================================

interface CrazyEightsGameScreenProps {
  navigation: any;
  route: {
    params?: {
      matchId?: string;
      inviteId?: string;
    };
  };
}

type GameMode = "menu" | "local" | "online" | "waiting";

// Extended state to track hands (not stored in Firestore gameState for privacy)
interface LocalGameState {
  hands: Record<string, Card[]>;
  deck: Card[];
}

// =============================================================================
// Card Component
// =============================================================================

interface CardComponentProps {
  card: Card;
  isPlayable?: boolean;
  isSelected?: boolean;
  onPress?: () => void;
  faceDown?: boolean;
  style?: any;
}

function CardComponent({
  card,
  isPlayable = true,
  isSelected = false,
  onPress,
  faceDown = false,
  style,
}: CardComponentProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isSelected) {
      Animated.spring(scaleAnim, {
        toValue: 1.1,
        useNativeDriver: true,
        friction: 5,
      }).start();
    } else {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 5,
      }).start();
    }
  }, [isSelected, scaleAnim]);

  if (faceDown) {
    return (
      <View style={[styles.card, styles.cardBack, style]}>
        <View style={styles.cardBackPattern}>
          <Text style={styles.cardBackIcon}>🎴</Text>
        </View>
      </View>
    );
  }

  const suitColor = getSuitColor(card.suit);
  const suitSymbol = getSuitSymbol(card.suit);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!isPlayable || !onPress}
      activeOpacity={0.8}
    >
      <Animated.View
        style={[
          styles.card,
          !isPlayable && styles.cardUnplayable,
          isSelected && styles.cardSelected,
          { transform: [{ scale: scaleAnim }] },
          style,
        ]}
      >
        {/* Top left corner */}
        <View style={styles.cardCornerTop}>
          <Text style={[styles.cardRank, { color: suitColor }]}>
            {card.rank}
          </Text>
          <Text style={[styles.cardSuitSmall, { color: suitColor }]}>
            {suitSymbol}
          </Text>
        </View>

        {/* Center suit */}
        <Text style={[styles.cardSuitCenter, { color: suitColor }]}>
          {suitSymbol}
        </Text>

        {/* Bottom right corner (inverted) */}
        <View style={styles.cardCornerBottom}>
          <Text style={[styles.cardRank, { color: suitColor }]}>
            {card.rank}
          </Text>
          <Text style={[styles.cardSuitSmall, { color: suitColor }]}>
            {suitSymbol}
          </Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// =============================================================================
// Suit Selector Modal
// =============================================================================

interface SuitSelectorModalProps {
  visible: boolean;
  onSelect: (suit: CardSuit) => void;
}

function SuitSelectorModal({ visible, onSelect }: SuitSelectorModalProps) {
  const suits: CardSuit[] = ["hearts", "diamonds", "clubs", "spades"];

  return (
    <Portal>
      <Modal
        visible={visible}
        dismissable={false}
        contentContainerStyle={styles.suitModal}
      >
        <Text style={styles.suitModalTitle}>Choose a Suit</Text>
        <View style={styles.suitOptions}>
          {suits.map((suit) => (
            <TouchableOpacity
              key={suit}
              style={styles.suitOption}
              onPress={() => onSelect(suit)}
            >
              <Text
                style={[styles.suitOptionText, { color: getSuitColor(suit) }]}
              >
                {getSuitSymbol(suit)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </Portal>
  );
}

// =============================================================================
// Turn Transition Modal (for local multiplayer)
// =============================================================================

interface TurnTransitionModalProps {
  visible: boolean;
  playerName: string;
  onContinue: () => void;
}

function TurnTransitionModal({
  visible,
  playerName,
  onContinue,
}: TurnTransitionModalProps) {
  return (
    <Portal>
      <Modal
        visible={visible}
        dismissable={false}
        contentContainerStyle={styles.turnTransitionModal}
      >
        <View style={styles.turnTransitionContent}>
          <MaterialCommunityIcons name="cards" size={64} color="#FFFFFF" />
          <Text style={styles.turnTransitionTitle}>
            It's {playerName}'s Turn
          </Text>
          <Text style={styles.turnTransitionSubtitle}>
            Pass the device to {playerName}
          </Text>
          <Button
            mode="contained"
            onPress={onContinue}
            style={styles.turnTransitionButton}
            labelStyle={styles.turnTransitionButtonLabel}
          >
            Start Turn
          </Button>
        </View>
      </Modal>
    </Portal>
  );
}

// =============================================================================
// Hand Component
// =============================================================================

interface HandComponentProps {
  cards: Card[];
  playableCards: Card[];
  selectedCard: Card | null;
  onSelectCard: (card: Card) => void;
  isMyTurn: boolean;
}

function HandComponent({
  cards,
  playableCards,
  selectedCard,
  onSelectCard,
  isMyTurn,
}: HandComponentProps) {
  const sortedCards = sortHand(cards);
  const cardCount = sortedCards.length;

  // Calculate card positions for fan layout
  const maxFanAngle = Math.min(30, cardCount * 3);
  const fanWidth = Math.min(SCREEN_WIDTH - 40, cardCount * 35);

  return (
    <View style={styles.handContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.handScroll}
      >
        {sortedCards.map((card, index) => {
          const isPlayable =
            isMyTurn &&
            playableCards.some(
              (c) => c.suit === card.suit && c.rank === card.rank,
            );
          const isSelected =
            selectedCard?.suit === card.suit &&
            selectedCard?.rank === card.rank;

          return (
            <View
              key={card.id}
              style={[styles.handCard, isSelected && styles.handCardSelected]}
            >
              <CardComponent
                card={card}
                isPlayable={isPlayable}
                isSelected={isSelected}
                onPress={() => isPlayable && onSelectCard(card)}
              />
            </View>
          );
        })}
      </ScrollView>
      <Text style={styles.handCount}>{cardCount} cards</Text>
    </View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function CrazyEightsGameScreen({
  navigation,
  route,
}: CrazyEightsGameScreenProps) {
  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const { profile: userProfile } = useUser();
  const haptics = useGameHaptics();

  // Game state
  const [gameMode, setGameMode] = useState<GameMode>("menu");
  const [gameState, setGameState] = useState<CrazyEightsGameState | null>(null);
  const [localState, setLocalState] = useState<LocalGameState | null>(null);

  // Player count for local multiplayer (2-7 players)
  const [playerCount, setPlayerCount] = useState<number>(2);
  const [showPlayerCountPicker, setShowPlayerCountPicker] = useState(false);

  // Turn transition state for local multiplayer
  const [showTurnTransition, setShowTurnTransition] = useState(false);
  const [nextTurnPlayer, setNextTurnPlayer] = useState<string | null>(null);

  // Selection state
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [pendingSuitSelection, setPendingSuitSelection] = useState(false);

  // Game result
  const [winner, setWinner] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});

  // Online game state
  const [matchId, setMatchId] = useState<string | null>(
    route.params?.matchId || null,
  );
  const [match, setMatch] = useState<CrazyEightsMatch | null>(null);
  const [opponentName, setOpponentName] = useState<string>("Opponent");
  const [opponentHandSize, setOpponentHandSize] = useState(7);

  // UI state
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [gameResult, setGameResult] = useState<GameResult>("draw");

  // ==========================================================================
  // Online Game Subscription
  // ==========================================================================

  useEffect(() => {
    if (!matchId) return;

    console.log("[CrazyEights] Setting up subscription for match:", matchId);

    const unsubscribe = subscribeToMatch(matchId, (updatedMatch) => {
      if (!updatedMatch) {
        console.log("[CrazyEights] No match data received");
        return;
      }

      console.log(
        "[CrazyEights] Received match update:",
        updatedMatch.id,
        "Turn:",
        (updatedMatch as any).currentTurn,
      );

      const typedMatch = updatedMatch as CrazyEightsMatch;
      setMatch(typedMatch);

      // Update game state
      const state = typedMatch.gameState as CrazyEightsGameState;
      console.log(
        "[CrazyEights] Game state updated, currentTurn:",
        state.currentTurn,
        "hands:",
        state.hands ? Object.keys(state.hands) : "none",
      );

      setGameState(state);

      // For online games, extract hands and deck from game state
      // Always update localState to ensure UI reflects latest data
      if (state.hands && state.deck) {
        setLocalState({
          hands: state.hands,
          deck: state.deck,
        });
      }

      // Determine opponent and their hand size
      if (currentFirebaseUser) {
        const isPlayer1 =
          typedMatch.players.player1.userId === currentFirebaseUser.uid;
        const opponentId = isPlayer1
          ? typedMatch.players.player2.userId
          : typedMatch.players.player1.userId;

        setOpponentName(
          isPlayer1
            ? typedMatch.players.player2.displayName
            : typedMatch.players.player1.displayName,
        );

        // Get opponent hand size from hands in game state
        if (state.hands && state.hands[opponentId]) {
          setOpponentHandSize(state.hands[opponentId].length);
        }
      }

      // Check for game over
      if (typedMatch.status === "completed" && typedMatch.winnerId) {
        setWinner(typedMatch.winnerId);
        const didWin = typedMatch.winnerId === currentFirebaseUser?.uid;
        setGameResult(didWin ? "win" : "loss");
        setShowGameOverModal(true);
      }
    });

    return () => {
      console.log("[CrazyEights] Cleaning up subscription for match:", matchId);
      unsubscribe();
    };
  }, [matchId, currentFirebaseUser]);

  // Handle incoming match from route params
  useEffect(() => {
    if (route.params?.matchId) {
      setGameMode("online");
      setMatchId(route.params.matchId);
    }
  }, [route.params?.matchId]);

  // ==========================================================================
  // Local Game Logic
  // ==========================================================================
  const initLocalGame = () => {
    if (!currentFirebaseUser) return;

    // Create player IDs based on selected player count (2-7)
    const playerIds = Array.from(
      { length: playerCount },
      (_, i) => `player${i + 1}`,
    );

    const {
      gameState: initialState,
      hands,
      deck,
    } = createInitialCrazyEightsState(...playerIds);

    setGameState(initialState);
    setLocalState({ hands, deck });
    setSelectedCard(null);
    setWinner(null);

    // Show turn transition at start so players know who goes first
    setNextTurnPlayer("player1");
    setShowTurnTransition(true);
  };

  const handleSelectCard = (card: Card) => {
    if (selectedCard?.id === card.id) {
      // Deselect
      setSelectedCard(null);
    } else {
      haptics.trigger("selection");
      setSelectedCard(card);
    }
  };

  const handlePlayCard = async () => {
    if (!selectedCard || !gameState || !localState) return;

    const playerId = gameState.currentTurn;
    const playerHand = localState.hands[playerId];

    // Check if it's an 8 (needs suit selection)
    if (selectedCard.rank === "8") {
      haptics.trigger("selection");
      setPendingSuitSelection(true);
      return;
    }

    await executePlayCard(selectedCard, undefined);
  };

  const handleSuitSelected = async (suit: CardSuit) => {
    haptics.trigger("card_play");
    setPendingSuitSelection(false);
    if (selectedCard) {
      await executePlayCard(selectedCard, suit);
    }
  };

  const executePlayCard = async (card: Card, declaredSuit?: CardSuit) => {
    if (!gameState) return;

    // For online mode, use game state hands; for local, use localState
    const hands = gameMode === "online" ? gameState.hands : localState?.hands;
    const deck = gameMode === "online" ? gameState.deck : localState?.deck;

    if (!hands || !deck) return;

    const playerId = gameState.currentTurn;

    const move: CrazyEightsMove = {
      type: "play",
      card,
      declaredSuit,
      timestamp: Date.now(),
    };

    const result = validateCrazyEightsMove(
      gameState,
      hands,
      deck,
      move,
      playerId,
    );

    if (!result.valid) {
      haptics.trigger("error");
      Alert.alert("Invalid Move", result.error || "Cannot play this card");
      return;
    }

    haptics.trigger("card_play");

    // Check for winner first
    if (result.winner) {
      // Update local state
      setGameState(result.newState!);
      if (gameMode === "local") {
        setLocalState({
          hands: result.newHands!,
          deck: result.newDeck!,
        });
      }
      setSelectedCard(null);

      // For online mode, submit the move and end the game
      if (gameMode === "online" && matchId) {
        try {
          // Include hands and deck in the new state for Firestore
          const newStateWithData: CrazyEightsGameState = {
            ...result.newState!,
            hands: result.newHands!,
            deck: result.newDeck!,
          };
          await submitMove(
            matchId,
            move,
            newStateWithData,
            result.newState!.currentTurn,
          );
          await endMatch(matchId, result.winner, "normal");
        } catch (error) {
          console.error("[CrazyEights] Error submitting move:", error);
        }
      }

      handleGameOver(result.winner);
      return;
    }

    // For local multiplayer, show turn transition screen
    if (gameMode === "local" && result.newState!.currentTurn !== playerId) {
      setNextTurnPlayer(result.newState!.currentTurn);
      setShowTurnTransition(true);
    }

    // Update local state immediately for responsive UI
    const newStateWithData: CrazyEightsGameState = {
      ...result.newState!,
      hands: result.newHands!,
      deck: result.newDeck!,
    };
    setGameState(newStateWithData);
    setLocalState({
      hands: result.newHands!,
      deck: result.newDeck!,
    });
    setSelectedCard(null);

    // For online mode, submit the move to Firestore
    if (gameMode === "online" && matchId) {
      try {
        console.log(
          "[CrazyEights] Submitting move, next turn:",
          result.newState!.currentTurn,
        );
        await submitMove(
          matchId,
          move,
          newStateWithData,
          result.newState!.currentTurn,
        );
        console.log("[CrazyEights] Move submitted successfully");
      } catch (error) {
        console.error("[CrazyEights] Error submitting move:", error);
        Alert.alert("Error", "Failed to submit move. Please try again.");
      }
    }
  };

  const handleDrawCard = async () => {
    if (!gameState) return;

    // For online mode, use game state hands; for local, use localState
    const hands = gameMode === "online" ? gameState.hands : localState?.hands;
    const deck = gameMode === "online" ? gameState.deck : localState?.deck;

    if (!hands || !deck) return;

    const playerId = gameState.currentTurn;

    const move: CrazyEightsMove = {
      type: "draw",
      timestamp: Date.now(),
    };

    const result = validateCrazyEightsMove(
      gameState,
      hands,
      deck,
      move,
      playerId,
    );

    if (!result.valid) {
      haptics.trigger("error");
      Alert.alert("Cannot Draw", result.error || "Unable to draw a card");
      return;
    }

    // Update local state immediately for responsive UI
    const newStateWithData: CrazyEightsGameState = {
      ...result.newState!,
      hands: result.newHands!,
      deck: result.newDeck!,
    };
    setGameState(newStateWithData);
    setLocalState({
      hands: result.newHands!,
      deck: result.newDeck!,
    });

    haptics.trigger("card_draw");

    // For online mode, submit the move to Firestore
    if (gameMode === "online" && matchId) {
      try {
        await submitMove(
          matchId,
          move,
          newStateWithData,
          result.newState!.currentTurn,
        );
      } catch (error) {
        console.error("[CrazyEights] Error submitting draw:", error);
        Alert.alert("Error", "Failed to submit move. Please try again.");
      }
    }
  };

  const handlePass = async () => {
    if (!gameState) return;

    // For online mode, use game state hands; for local, use localState
    const hands = gameMode === "online" ? gameState.hands : localState?.hands;
    const deck = gameMode === "online" ? gameState.deck : localState?.deck;

    if (!hands || !deck) return;

    const playerId = gameState.currentTurn;

    const move: CrazyEightsMove = {
      type: "pass",
      timestamp: Date.now(),
    };

    const result = validateCrazyEightsMove(
      gameState,
      hands,
      deck,
      move,
      playerId,
    );

    if (!result.valid) {
      haptics.trigger("error");
      Alert.alert("Cannot Pass", result.error || "You must draw or play");
      return;
    }

    haptics.trigger("turn_change");

    // For local multiplayer, show turn transition screen
    if (gameMode === "local" && result.newState!.currentTurn !== playerId) {
      setNextTurnPlayer(result.newState!.currentTurn);
      setShowTurnTransition(true);
    }

    // Update local state immediately for responsive UI
    const newStateWithData: CrazyEightsGameState = {
      ...result.newState!,
      hands: result.newHands!,
      deck: result.newDeck!,
    };
    setGameState(newStateWithData);
    setLocalState({
      hands: result.newHands!,
      deck: result.newDeck!,
    });
    setSelectedCard(null);

    // For online mode, submit the move to Firestore
    if (gameMode === "online" && matchId) {
      try {
        await submitMove(
          matchId,
          move,
          newStateWithData,
          result.newState!.currentTurn,
        );
      } catch (error) {
        console.error("[CrazyEights] Error submitting pass:", error);
        Alert.alert("Error", "Failed to submit move. Please try again.");
      }
    }
  };

  const handleGameOver = (winnerId: string) => {
    setWinner(winnerId);

    // Determine game result based on game mode
    const didWin =
      gameMode === "local"
        ? winnerId === "player1"
        : winnerId === currentFirebaseUser?.uid;

    setGameResult(didWin ? "win" : "loss");
    setShowGameOverModal(true);

    // Calculate scores based on remaining cards
    if (localState) {
      const newScores: Record<string, number> = {};
      for (const [playerId, hand] of Object.entries(localState.hands)) {
        if (playerId !== winnerId) {
          newScores[winnerId] =
            (newScores[winnerId] || 0) + calculateHandScore(hand);
        }
      }
      setScores((prev) => ({
        ...prev,
        ...newScores,
      }));
    }

    // Haptic feedback based on win/loss
    haptics.gameOverPattern(didWin);
  };

  // ==========================================================================
  // Game Actions
  // ==========================================================================

  const resetGame = () => {
    initLocalGame();
    setShowGameOverModal(false);
  };

  const startLocalGame = () => {
    setGameMode("local");
    initLocalGame();
    setScores({});
  };

  const handleInviteFriend = () => {
    setShowFriendPicker(true);
  };

  const handleSelectFriend = async (friend: {
    friendUid: string;
    displayName: string;
  }) => {
    setShowFriendPicker(false);
    if (!currentFirebaseUser || !userProfile) return;

    setLoading(true);
    try {
      await sendGameInvite(
        currentFirebaseUser.uid,
        userProfile.displayName || "Player",
        userProfile.avatarConfig
          ? JSON.stringify(userProfile.avatarConfig)
          : undefined,
        {
          gameType: "crazy_eights",
          recipientId: friend.friendUid,
          recipientName: friend.displayName,
          settings: {
            isRated: false,
            chatEnabled: false,
          },
        },
      );

      Alert.alert(
        "Invite Sent!",
        `Game invite sent to ${friend.displayName}. You'll be notified when they respond.`,
      );
    } catch (error) {
      console.error("[CrazyEights] Error sending invite:", error);
      Alert.alert("Error", "Failed to send game invite. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResign = async () => {
    if (!matchId || !currentFirebaseUser) return;

    Alert.alert(
      "Resign Game",
      "Are you sure you want to resign? Your opponent will win.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Resign",
          style: "destructive",
          onPress: async () => {
            try {
              await resignMatch(matchId, currentFirebaseUser.uid);
              navigation.goBack();
            } catch (error) {
              console.error("[CrazyEights] Error resigning:", error);
            }
          },
        },
      ],
    );
  };

  const handlePlayAgain = () => {
    if (gameMode === "local") {
      resetGame();
    } else {
      setShowGameOverModal(false);
      navigation.goBack();
    }
  };

  const handleGoBack = () => {
    if (gameMode === "online" && match && match.status === "active") {
      handleResign();
    } else {
      navigation.goBack();
    }
  };

  // ==========================================================================
  // Render Helpers
  // ==========================================================================

  const isMyTurn = () => {
    if (!gameState) return false;
    if (gameMode === "local") {
      // In local mode, it's always the current turn player's turn
      // The turn transition screen handles switching between players
      return true;
    }
    if (gameMode === "online" && currentFirebaseUser) {
      return gameState.currentTurn === currentFirebaseUser.uid;
    }
    return false;
  };

  const getCurrentHand = (): Card[] => {
    if (!gameState) return [];

    // For online mode, get the current user's hand
    if (gameMode === "online" && currentFirebaseUser && gameState.hands) {
      return gameState.hands[currentFirebaseUser.uid] || [];
    }

    // For local mode, get the current turn player's hand from localState
    if (localState) {
      return localState.hands[gameState.currentTurn] || [];
    }

    return [];
  };

  const getMyHand = (): Card[] => {
    if (!gameState) return [];

    // For online mode, get the current user's hand
    if (gameMode === "online" && currentFirebaseUser && gameState.hands) {
      return gameState.hands[currentFirebaseUser.uid] || [];
    }

    // For local mode, get the current turn player's hand from localState
    if (localState) {
      return localState.hands[gameState.currentTurn] || [];
    }

    return [];
  };

  const getPlayableCardsInHand = (): Card[] => {
    if (!gameState) return [];
    const hand = getCurrentHand();
    // For online mode, use hands from gameState
    if (gameMode === "online" && gameState.hands) {
      return getPlayableCards(hand, gameState);
    }
    // For local mode, check localState
    if (!localState) return [];
    return getPlayableCards(hand, gameState);
  };

  // Get all opponents (for local multiplayer with 3+ players)
  const getOpponents = (): {
    id: string;
    name: string;
    cardCount: number;
  }[] => {
    if (!gameState || !localState) return [];

    const currentPlayerId = gameState.currentTurn;
    const allPlayerIds = Object.keys(localState.hands);

    return allPlayerIds
      .filter((id) => id !== currentPlayerId)
      .map((id) => ({
        id,
        name: `Player ${id.replace("player", "")}`,
        cardCount: localState.hands[id]?.length || 0,
      }));
  };

  const getStatusText = () => {
    if (winner) {
      if (gameMode === "local") {
        const playerNum = winner.replace("player", "");
        return `Player ${playerNum} Wins!`;
      }
      return winner === currentFirebaseUser?.uid
        ? "You Win! 🎉"
        : `${opponentName} Wins!`;
    }

    if (!gameState) return "";

    if (gameMode === "local") {
      const playerNum = gameState.currentTurn.replace("player", "");
      return `Player ${playerNum}'s turn`;
    }

    return isMyTurn() ? "Your turn" : `${opponentName}'s turn`;
  };

  // ==========================================================================
  // Menu Screen
  // ==========================================================================

  if (gameMode === "menu") {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.menuContainer}>
          <Text
            style={[styles.menuTitle, { color: theme.colors.onBackground }]}
          >
            🎴 Crazy Eights
          </Text>
          <Text
            style={[
              styles.menuSubtitle,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            Match cards by suit or rank
          </Text>

          <View style={styles.menuButtons}>
            {/* Player Count Selector for Local Mode */}
            <View style={styles.playerCountContainer}>
              <Text
                style={[
                  styles.playerCountLabel,
                  { color: theme.colors.onBackground },
                ]}
              >
                Local Players: {playerCount}
              </Text>
              <View style={styles.playerCountButtons}>
                {[2, 3, 4, 5, 6, 7].map((count) => (
                  <TouchableOpacity
                    key={count}
                    style={[
                      styles.playerCountButton,
                      playerCount === count && styles.playerCountButtonActive,
                      { borderColor: theme.colors.primary },
                    ]}
                    onPress={() => setPlayerCount(count)}
                  >
                    <Text
                      style={[
                        styles.playerCountButtonText,
                        playerCount === count && { color: "#FFFFFF" },
                        playerCount !== count && {
                          color: theme.colors.primary,
                        },
                      ]}
                    >
                      {count}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Button
              mode="contained"
              onPress={startLocalGame}
              style={styles.menuButton}
              icon="account-multiple"
            >
              Local {playerCount}-Player
            </Button>

            <Button
              mode="contained"
              onPress={handleInviteFriend}
              style={styles.menuButton}
              icon="account-plus"
              loading={loading}
            >
              Invite Friend
            </Button>

            <Button
              mode="outlined"
              onPress={() => navigation.goBack()}
              style={styles.menuButton}
              icon="arrow-left"
            >
              Back
            </Button>
          </View>

          {/* Rules */}
          <View style={styles.rulesContainer}>
            <Text
              style={[styles.rulesTitle, { color: theme.colors.onBackground }]}
            >
              How to Play
            </Text>
            <Text
              style={[
                styles.rulesText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              • Match the top card by suit or rank{"\n"}• 8s are wild - play
              anytime, choose next suit{"\n"}• Draw if you can't play{"\n"}•
              First to empty their hand wins!
            </Text>
          </View>
        </View>

        <FriendPickerModal
          visible={showFriendPicker}
          onDismiss={() => setShowFriendPicker(false)}
          onSelectFriend={handleSelectFriend}
          title="Challenge a Friend"
          currentUserId={currentFirebaseUser?.uid || ""}
        />
      </SafeAreaView>
    );
  }

  // ==========================================================================
  // Game Screen
  // ==========================================================================

  const currentHand = getCurrentHand();
  const playableCards = getPlayableCardsInHand();

  // Get deck from localState or gameState
  const getDeckLength = (): number => {
    if (localState && localState.deck) {
      return localState.deck.length;
    }
    if (gameState?.deck) {
      return gameState.deck.length;
    }
    return gameState?.deckSize || 0;
  };

  const deckLength = getDeckLength();
  const canDraw = deckLength > 0;
  const canPass =
    gameState &&
    (deckLength === 0 || gameState.drawCount > 0) &&
    !hasPlayableCard(currentHand, gameState);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: FELT_GREEN }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Crazy Eights</Text>

        {gameMode === "online" && (
          <TouchableOpacity onPress={handleResign} style={styles.resignButton}>
            <MaterialCommunityIcons name="flag" size={20} color="#FF6B6B" />
          </TouchableOpacity>
        )}
      </View>

      {/* Opponent Area */}
      <View style={styles.opponentArea}>
        {gameMode === "local" ? (
          // Local multiplayer: show all opponents in a scrollable row
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.opponentsScrollContent}
          >
            {getOpponents().map((opponent) => (
              <View key={opponent.id} style={styles.opponentContainer}>
                <Text style={styles.opponentName}>{opponent.name}</Text>
                <View style={styles.opponentHand}>
                  {Array.from({ length: Math.min(opponent.cardCount, 5) }).map(
                    (_, i) => (
                      <View key={i} style={styles.opponentCard}>
                        <CardComponent
                          card={{
                            suit: "hearts",
                            rank: "A",
                            id: `${opponent.id}-back-${i}`,
                          }}
                          faceDown
                          style={styles.opponentCardStyle}
                        />
                      </View>
                    ),
                  )}
                </View>
                <Text style={styles.cardCount}>{opponent.cardCount} cards</Text>
              </View>
            ))}
          </ScrollView>
        ) : (
          // Online mode: show single opponent
          <>
            <Text style={styles.opponentName}>{opponentName}</Text>
            <View style={styles.opponentHand}>
              {Array.from({ length: opponentHandSize }).map((_, i) => (
                <View key={i} style={styles.opponentCard}>
                  <CardComponent
                    card={{ suit: "hearts", rank: "A", id: `back-${i}` }}
                    faceDown
                    style={styles.opponentCardStyle}
                  />
                </View>
              ))}
            </View>
            <Text style={styles.cardCount}>{opponentHandSize} cards</Text>
          </>
        )}
      </View>

      {/* Play Area */}
      <View style={styles.playArea}>
        {/* Deck */}
        <TouchableOpacity
          style={styles.deckArea}
          onPress={handleDrawCard}
          disabled={!isMyTurn() || !canDraw}
        >
          <View style={[styles.deck, !canDraw && styles.deckEmpty]}>
            {canDraw ? (
              <>
                <View style={styles.deckStack} />
                <View style={styles.deckTop}>
                  <Text style={styles.deckIcon}>🎴</Text>
                </View>
              </>
            ) : (
              <Text style={styles.deckEmptyText}>Empty</Text>
            )}
          </View>
          <Text style={styles.deckCount}>{deckLength} cards</Text>
        </TouchableOpacity>

        {/* Discard Pile */}
        <View style={styles.discardArea}>
          {gameState?.topCard && (
            <CardComponent
              card={gameState.topCard}
              style={styles.discardCard}
            />
          )}
          {/* Current suit indicator */}
          {gameState && gameState.currentSuit !== gameState.topCard?.suit && (
            <View style={styles.suitIndicator}>
              <Text
                style={[
                  styles.suitIndicatorText,
                  { color: getSuitColor(gameState.currentSuit) },
                ]}
              >
                {getSuitSymbol(gameState.currentSuit)}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Status */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>{getStatusText()}</Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        {selectedCard && (
          <Button
            mode="contained"
            onPress={handlePlayCard}
            style={styles.actionButton}
            disabled={!isMyTurn()}
          >
            Play {selectedCard.rank}
            {getSuitSymbol(selectedCard.suit)}
          </Button>
        )}
        {!selectedCard && isMyTurn() && canDraw && (
          <Button
            mode="outlined"
            onPress={handleDrawCard}
            style={styles.actionButton}
            textColor="#FFFFFF"
          >
            Draw Card
          </Button>
        )}
        {!selectedCard && isMyTurn() && canPass && (
          <Button
            mode="outlined"
            onPress={handlePass}
            style={styles.actionButton}
            textColor="#FFFFFF"
          >
            Pass Turn
          </Button>
        )}
      </View>

      {/* Player Hand */}
      <View style={styles.playerArea}>
        <Text style={styles.playerName}>
          {gameMode === "local"
            ? gameState?.currentTurn === "player1"
              ? "Player 1"
              : "Player 2"
            : userProfile?.displayName || "You"}
        </Text>
        <HandComponent
          cards={currentHand}
          playableCards={playableCards}
          selectedCard={selectedCard}
          onSelectCard={handleSelectCard}
          isMyTurn={isMyTurn()}
        />
      </View>

      {/* Suit Selector Modal */}
      <SuitSelectorModal
        visible={pendingSuitSelection}
        onSelect={handleSuitSelected}
      />

      {/* Turn Transition Modal (for local multiplayer) */}
      <TurnTransitionModal
        visible={showTurnTransition}
        playerName={nextTurnPlayer === "player1" ? "Player 1" : "Player 2"}
        onContinue={() => setShowTurnTransition(false)}
      />

      {/* Game Over Modal */}
      <GameOverModal
        visible={showGameOverModal}
        result={gameResult}
        stats={{
          score: scores["player1"] || 0,
          opponentName: gameMode === "online" ? opponentName : "Player 2",
        }}
        showRematch={gameMode === "local"}
        onRematch={gameMode === "local" ? resetGame : undefined}
        onExit={() => {
          setShowGameOverModal(false);
          if (gameMode === "online") {
            navigation.goBack();
          } else {
            setGameMode("menu");
          }
        }}
      />

      <FriendPickerModal
        visible={showFriendPicker}
        onDismiss={() => setShowFriendPicker(false)}
        onSelectFriend={handleSelectFriend}
        title="Challenge a Friend"
        currentUserId={currentFirebaseUser?.uid || ""}
      />
    </SafeAreaView>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  menuContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  menuTitle: {
    fontSize: 48,
    fontWeight: "bold",
    marginBottom: Spacing.sm,
  },
  menuSubtitle: {
    fontSize: 16,
    marginBottom: Spacing.xl,
  },
  menuButtons: {
    width: "100%",
    maxWidth: 300,
    gap: Spacing.md,
  },
  menuButton: {
    marginVertical: Spacing.xs,
  },
  playerCountContainer: {
    alignItems: "center",
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  playerCountLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  playerCountButtons: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  playerCountButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  playerCountButtonActive: {
    backgroundColor: "#6200ee",
  },
  playerCountButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  rulesContainer: {
    marginTop: Spacing.xl,
    padding: Spacing.md,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: BorderRadius.md,
    maxWidth: 300,
  },
  rulesTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  rulesText: {
    fontSize: 14,
    lineHeight: 22,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  resignButton: {
    padding: Spacing.xs,
  },
  opponentArea: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  opponentsScrollContent: {
    flexDirection: "row",
    paddingHorizontal: Spacing.md,
    gap: Spacing.lg,
  },
  opponentContainer: {
    alignItems: "center",
    minWidth: 80,
  },
  opponentName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#FFFFFF",
    marginBottom: Spacing.xs,
  },
  opponentHand: {
    flexDirection: "row",
    justifyContent: "center",
    height: 50,
  },
  opponentCard: {
    marginHorizontal: -15,
  },
  opponentCardStyle: {
    transform: [{ scale: 0.5 }],
  },
  cardCount: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.7)",
    marginTop: Spacing.xs,
  },
  playArea: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing.lg,
    gap: Spacing.xl,
  },
  deckArea: {
    alignItems: "center",
  },
  deck: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  deckStack: {
    position: "absolute",
    width: CARD_WIDTH - 4,
    height: CARD_HEIGHT - 4,
    backgroundColor: DECK_BLUE,
    borderRadius: CARD_BORDER_RADIUS,
    top: 4,
    left: 2,
  },
  deckTop: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: DECK_BLUE,
    borderRadius: CARD_BORDER_RADIUS,
    borderWidth: 2,
    borderColor: "#0d2137",
    justifyContent: "center",
    alignItems: "center",
  },
  deckIcon: {
    fontSize: 30,
  },
  deckEmpty: {
    opacity: 0.5,
  },
  deckEmptyText: {
    color: "#FFFFFF",
    fontSize: 12,
  },
  deckCount: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.7)",
    marginTop: Spacing.xs,
  },
  discardArea: {
    alignItems: "center",
    position: "relative",
  },
  discardCard: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  suitIndicator: {
    position: "absolute",
    top: -10,
    right: -10,
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  suitIndicatorText: {
    fontSize: 20,
  },
  statusContainer: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  statusText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  actionButton: {
    minWidth: 120,
  },
  playerArea: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: Spacing.md,
  },
  playerName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  handContainer: {
    alignItems: "center",
  },
  handScroll: {
    paddingHorizontal: Spacing.md,
  },
  handCard: {
    marginHorizontal: -10,
  },
  handCardSelected: {
    marginTop: -20,
  },
  handCount: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.7)",
    marginTop: Spacing.xs,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: CARD_BACKGROUND,
    borderRadius: CARD_BORDER_RADIUS,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  cardBack: {
    backgroundColor: DECK_BLUE,
    borderColor: "#0d2137",
  },
  cardBackPattern: {
    justifyContent: "center",
    alignItems: "center",
  },
  cardBackIcon: {
    fontSize: 24,
  },
  cardUnplayable: {
    opacity: 0.5,
  },
  cardSelected: {
    borderColor: "#4CAF50",
    borderWidth: 3,
    shadowColor: "#4CAF50",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  cardCornerTop: {
    position: "absolute",
    top: 4,
    left: 6,
    alignItems: "center",
  },
  cardCornerBottom: {
    position: "absolute",
    bottom: 4,
    right: 6,
    alignItems: "center",
    transform: [{ rotate: "180deg" }],
  },
  cardRank: {
    fontSize: 14,
    fontWeight: "bold",
  },
  cardSuitSmall: {
    fontSize: 10,
    marginTop: -2,
  },
  cardSuitCenter: {
    fontSize: 28,
  },
  suitModal: {
    backgroundColor: "#FFFFFF",
    margin: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  suitModalTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: Spacing.md,
    color: "#000000",
  },
  suitOptions: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  suitOption: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: "#F5F5F5",
    width: 60,
    height: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  suitOptionText: {
    fontSize: 36,
  },
  // Turn Transition Modal styles
  turnTransitionModal: {
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    margin: 0,
    padding: 0,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  turnTransitionContent: {
    alignItems: "center",
    padding: Spacing.xl,
  },
  turnTransitionTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  turnTransitionSubtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.7)",
    marginBottom: Spacing.xl,
    textAlign: "center",
  },
  turnTransitionButton: {
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.md,
  },
  turnTransitionButtonLabel: {
    fontSize: 18,
    fontWeight: "600",
  },
});
