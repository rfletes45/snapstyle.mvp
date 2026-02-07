/**
 * SnapWarGameScreen — Card War
 *
 * How to play:
 * 1. Each player flips a card simultaneously
 * 2. Higher card wins both cards
 * 3. On tie → WAR! Place 3 cards face-down, flip 1 more
 * 4. Player with all cards (or most when deck runs out) wins!
 *
 * Reuses Crazy Eights card components. Supports local 2-player.
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
import { useColors } from "@/store/ThemeContext";
import { useUser } from "@/store/UserContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Dialog, Portal, Text } from "react-native-paper";

// =============================================================================
// Constants
// =============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_W = 80;
const CARD_H = 110;
const GAME_TYPE = "snap_war";

const RANKS = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
] as const;
const SUITS = ["♠", "♥", "♦", "♣"] as const;
const SUIT_COLORS: Record<string, string> = {
  "♠": "#1a1a2e",
  "♣": "#1a1a2e",
  "♥": "#e74c3c",
  "♦": "#e74c3c",
};

type GameState = "menu" | "playing" | "war" | "result";

interface WarCard {
  rank: string;
  suit: string;
  value: number;
}

function createDeck(): WarCard[] {
  const deck: WarCard[] = [];
  for (const suit of SUITS) {
    for (let i = 0; i < RANKS.length; i++) {
      deck.push({ rank: RANKS[i], suit, value: i + 2 });
    }
  }
  return shuffle(deck);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// =============================================================================
// Component
// =============================================================================

export default function SnapWarGameScreen({ navigation }: { navigation: any }) {
  const colors = useColors();
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { showSuccess, showError } = useSnackbar();

  const [gameState, setGameState] = useState<GameState>("menu");
  const [p1Deck, setP1Deck] = useState<WarCard[]>([]);
  const [p2Deck, setP2Deck] = useState<WarCard[]>([]);
  const [p1Card, setP1Card] = useState<WarCard | null>(null);
  const [p2Card, setP2Card] = useState<WarCard | null>(null);
  const [warPile, setWarPile] = useState<WarCard[]>([]);
  const [message, setMessage] = useState("");
  const [wins, setWins] = useState(0);
  const [personalBest, setPersonalBest] = useState<PersonalBest | null>(null);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [roundCount, setRoundCount] = useState(0);

  const flipAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (currentFirebaseUser) {
      getPersonalBest(currentFirebaseUser.uid, GAME_TYPE).then(setPersonalBest);
    }
  }, [currentFirebaseUser]);

  const startGame = useCallback(() => {
    const deck = createDeck();
    setP1Deck(deck.slice(0, 26));
    setP2Deck(deck.slice(26));
    setP1Card(null);
    setP2Card(null);
    setWarPile([]);
    setMessage("Tap to flip!");
    setRoundCount(0);
    setGameState("playing");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const resolveRound = useCallback(
    (
      c1: WarCard,
      c2: WarCard,
      pile: WarCard[],
      d1: WarCard[],
      d2: WarCard[],
    ) => {
      const allCards = [c1, c2, ...pile];
      setRoundCount((r) => r + 1);

      if (c1.value > c2.value) {
        setMessage("You win this round! 🎉");
        const newD1 = [...d1, ...shuffle(allCards)];
        setP1Deck(newD1);
        setP2Deck(d2);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (d2.length === 0) {
          endGame(true);
          return;
        }
      } else if (c2.value > c1.value) {
        setMessage("AI wins this round 😤");
        const newD2 = [...d2, ...shuffle(allCards)];
        setP2Deck(newD2);
        setP1Deck(d1);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        if (d1.length === 0) {
          endGame(false);
          return;
        }
      } else {
        // WAR!
        setMessage("⚔️ WAR! ⚔️");
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setGameState("war");

        // Each player puts 3 face-down cards in pile
        const warCards: WarCard[] = [...allCards];
        const warCount = Math.min(3, d1.length - 1, d2.length - 1);
        if (warCount <= 0) {
          // Not enough cards for war — compare remaining
          if (d1.length > d2.length) {
            endGame(true);
          } else {
            endGame(false);
          }
          return;
        }
        warCards.push(...d1.splice(0, warCount));
        warCards.push(...d2.splice(0, warCount));
        setP1Deck([...d1]);
        setP2Deck([...d2]);
        setWarPile(warCards);
        return;
      }

      setWarPile([]);
      setGameState("playing");
    },
    [],
  );

  const endGame = useCallback(
    (playerWon: boolean) => {
      setGameState("result");
      setMessage(playerWon ? "🎉 You Win the War!" : "😢 AI Wins the War!");
      if (playerWon) {
        const newWins = wins + 1;
        setWins(newWins);
        if (currentFirebaseUser) {
          recordGameSession(currentFirebaseUser.uid, {
            gameId: GAME_TYPE,
            score: newWins,
            duration: 0,
          });
        }
      }
    },
    [wins, currentFirebaseUser],
  );

  const flip = useCallback(() => {
    if (p1Deck.length === 0 || p2Deck.length === 0) {
      endGame(p1Deck.length > p2Deck.length);
      return;
    }

    const d1 = [...p1Deck];
    const d2 = [...p2Deck];
    const c1 = d1.shift()!;
    const c2 = d2.shift()!;
    setP1Card(c1);
    setP2Card(c2);

    flipAnim.setValue(0);
    Animated.spring(flipAnim, {
      toValue: 1,
      friction: 8,
      useNativeDriver: true,
    }).start();

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Resolve after animation
    setTimeout(() => {
      resolveRound(c1, c2, warPile, d1, d2);
    }, 600);
  }, [p1Deck, p2Deck, warPile, flipAnim, resolveRound, endGame]);

  const renderCard = (card: WarCard | null, label: string) => {
    if (!card) {
      return (
        <View
          style={[
            styles.card,
            { backgroundColor: colors.primary, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.cardBack, { color: "#fff" }]}>🂠</Text>
        </View>
      );
    }
    return (
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: "#fff",
            borderColor: colors.border,
            transform: [
              {
                scale: flipAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.8, 1.1, 1],
                }),
              },
            ],
          },
        ]}
      >
        <Text
          style={[styles.cardRank, { color: SUIT_COLORS[card.suit] || "#000" }]}
        >
          {card.rank}
        </Text>
        <Text
          style={[styles.cardSuit, { color: SUIT_COLORS[card.suit] || "#000" }]}
        >
          {card.suit}
        </Text>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>⚔️ Snap War</Text>
        <View style={{ width: 40 }} />
      </View>

      {gameState === "menu" && (
        <View style={styles.menuContainer}>
          <Text style={[styles.menuTitle, { color: colors.text }]}>
            Snap War
          </Text>
          <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
            Flip cards — higher wins!
          </Text>
          {personalBest && (
            <Text style={[styles.bestText, { color: colors.primary }]}>
              Best: {personalBest.bestScore} wins
            </Text>
          )}
          <Button
            mode="contained"
            onPress={startGame}
            style={{ backgroundColor: colors.primary, marginTop: 24 }}
            labelStyle={{ color: "#fff" }}
          >
            Start Game
          </Button>
        </View>
      )}

      {(gameState === "playing" || gameState === "war") && (
        <View style={styles.playArea}>
          {/* AI side */}
          <View style={styles.playerSection}>
            <Text style={[styles.deckCount, { color: colors.textSecondary }]}>
              AI: {p2Deck.length} cards
            </Text>
            {renderCard(p2Card, "AI")}
          </View>

          {/* Message */}
          <View style={styles.messageRow}>
            <Text style={[styles.messageText, { color: colors.primary }]}>
              {message}
            </Text>
            {warPile.length > 0 && (
              <Text
                style={[styles.warPileText, { color: colors.textSecondary }]}
              >
                War pile: {warPile.length} cards
              </Text>
            )}
          </View>

          {/* Player side */}
          <View style={styles.playerSection}>
            {renderCard(p1Card, "You")}
            <Text style={[styles.deckCount, { color: colors.textSecondary }]}>
              You: {p1Deck.length} cards
            </Text>
          </View>

          {/* Flip button */}
          <TouchableOpacity
            onPress={flip}
            style={[styles.flipBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.7}
          >
            <Text style={styles.flipBtnText}>
              {gameState === "war" ? "⚔️ War Flip!" : "Flip!"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Result dialog */}
      <Portal>
        <Dialog
          visible={gameState === "result"}
          onDismiss={() => {}}
          style={{ backgroundColor: colors.surface }}
        >
          <Dialog.Title style={{ color: colors.text, textAlign: "center" }}>
            {message}
          </Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: colors.textSecondary, textAlign: "center" }}>
              Rounds played: {roundCount}
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={startGame}>Play Again</Button>
            <Button onPress={() => setShowFriendPicker(true)}>Share</Button>
            <Button onPress={() => setGameState("menu")}>Menu</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <FriendPickerModal
        visible={showFriendPicker}
        onDismiss={() => setShowFriendPicker(false)}
        onSelectFriend={async (friend) => {
          if (!currentFirebaseUser || isSending) return;
          setIsSending(true);
          try {
            await sendScorecard(currentFirebaseUser.uid, friend.friendUid, {
              gameId: GAME_TYPE,
              score: wins,
              playerName: profile?.displayName || "Player",
            });
            showSuccess("Score sent!");
          } catch {
            showError("Failed to send");
          }
          setIsSending(false);
          setShowFriendPicker(false);
        }}
        currentUserId={currentFirebaseUser?.uid || ""}
        title="Send Score To"
      />
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 56 : 40,
    paddingBottom: 8,
  },
  backBtn: { padding: 8 },
  title: { fontSize: 18, fontWeight: "700" },
  menuContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  menuTitle: { fontSize: 32, fontWeight: "800", marginBottom: 8 },
  menuSub: { fontSize: 16, marginBottom: 16 },
  bestText: { fontSize: 14, fontWeight: "600" },
  playArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-around",
    padding: 16,
  },
  playerSection: { alignItems: "center", gap: 8 },
  deckCount: { fontSize: 14, fontWeight: "600" },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  cardBack: { fontSize: 40 },
  cardRank: { fontSize: 28, fontWeight: "800" },
  cardSuit: { fontSize: 24, marginTop: 2 },
  messageRow: { alignItems: "center", gap: 4 },
  messageText: { fontSize: 20, fontWeight: "700" },
  warPileText: { fontSize: 13 },
  flipBtn: {
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 30,
    marginTop: 8,
  },
  flipBtnText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  dialogActions: { justifyContent: "center" },
});
