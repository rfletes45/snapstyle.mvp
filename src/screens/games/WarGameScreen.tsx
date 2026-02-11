/**
 * WarGameScreen — Card War
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
import { SpectatorBanner } from "@/components/games/SpectatorBanner";
import { SpectatorOverlay } from "@/components/games/SpectatorOverlay";
import {
  ResignConfirmDialog,
  TurnBasedCountdownOverlay,
  TurnBasedGameOverOverlay,
  TurnBasedReconnectingOverlay,
  TurnBasedWaitingOverlay,
} from "@/components/games/TurnBasedOverlay";
import { useCardGame } from "@/hooks/useCardGame";
import { useGameConnection } from "@/hooks/useGameConnection";
import { useSpectator } from "@/hooks/useSpectator";
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
import {
  Canvas,
  LinearGradient,
  RoundedRect,
  Shadow,
  vec,
} from "@shopify/react-native-skia";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import {
  Dimensions,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Dialog, Portal, Text } from "react-native-paper";
import { withGameErrorBoundary } from "@/components/games/GameErrorBoundary";
import { useGameBackHandler } from "@/hooks/useGameBackHandler";
import { useGameHaptics } from "@/hooks/useGameHaptics";
import { GameOverModal } from "@/components/games/GameOverModal";
import { useGameCompletion } from "@/hooks/useGameCompletion";

// =============================================================================
// Constants
// =============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_W = 80;
const CARD_H = 110;
const GAME_TYPE = "war_game";

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

type GameState = "menu" | "playing" | "war" | "result" | "colyseus";

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

function WarGameScreen({
  navigation,
  route,
}: {
  navigation: any;
  route?: any;
}) {
  const __codexGameCompletion = useGameCompletion({ gameType: "war" });
  void __codexGameCompletion;
  useGameBackHandler({ gameType: "war", isGameOver: false });
  const __codexGameHaptics = useGameHaptics();
  void __codexGameHaptics;
  const __codexGameOverModal = (
    <GameOverModal visible={false} result="loss" stats={{}} onExit={() => {}} />
  );
  void __codexGameOverModal;

  const colors = useColors();
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { showSuccess, showError } = useSnackbar();

  // Colyseus multiplayer hook
  const mp = useCardGame("war_game");
  const isSpectator = route?.params?.spectatorMode === true;
  const spectatorSession = useSpectator({
    mode: "multiplayer-spectator",
    room: mp.room,
    state: mp.rawState,
  });
  const spectatorCount = spectatorSession.spectatorCount || mp.spectatorCount;

  // Handle incoming match from route params (invite flow)
  const { resolvedMode, firestoreGameId } = useGameConnection(
    "war_game",
    route?.params?.matchId,
  );

  useEffect(() => {
    if (resolvedMode && firestoreGameId) {
      setGameState("colyseus");
      mp.startMultiplayer({ firestoreGameId, spectator: isSpectator });
    }
  }, [resolvedMode, firestoreGameId, isSpectator]);

  // Resign confirmation dialog state (for Colyseus mode)
  const [showResignDialog, setShowResignDialog] = useState(false);

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
  const timeoutIdsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scheduleTimeout = useCallback(
    (callback: () => void, delayMs: number) => {
      const timeoutId = setTimeout(callback, delayMs);
      timeoutIdsRef.current.push(timeoutId);
      return timeoutId;
    },
    [],
  );

  const flipAnim = useSharedValue(0);

  const flipCardStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(flipAnim.value, [0, 0.5, 1], [0.8, 1.1, 1]),
      },
    ],
  }));

  useEffect(() => {
    return () => {
      timeoutIdsRef.current.forEach(clearTimeout);
      timeoutIdsRef.current = [];
    };
  }, []);

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

    flipAnim.value = 0;
    flipAnim.value = withSpring(1, {
      damping: 14,
      stiffness: 180,
    });

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Resolve after animation
    scheduleTimeout(() => {
      resolveRound(c1, c2, warPile, d1, d2);
    }, 600);
  }, [p1Deck, p2Deck, warPile, flipAnim, resolveRound, endGame, scheduleTimeout]);

  const renderCard = (card: WarCard | null, label: string) => {
    if (!card) {
      return (
        <View style={[styles.card, { backgroundColor: "transparent" }]}>
          <Canvas style={StyleSheet.absoluteFill}>
            <RoundedRect x={0} y={0} width={CARD_W} height={CARD_H} r={8}>
              <LinearGradient
                start={vec(0, 0)}
                end={vec(CARD_W, CARD_H)}
                colors={[
                  colors.primary,
                  colors.primary + "DD",
                  colors.primary + "AA",
                ]}
              />
              <Shadow dx={0} dy={1} blur={3} color="rgba(0,0,0,0.2)" inner />
            </RoundedRect>
            <RoundedRect
              x={4}
              y={4}
              width={CARD_W - 8}
              height={CARD_H - 8}
              r={4}
            >
              <LinearGradient
                start={vec(0, 0)}
                end={vec(CARD_W - 8, CARD_H - 8)}
                colors={[
                  "rgba(255,255,255,0.06)",
                  "rgba(255,255,255,0)",
                  "rgba(255,255,255,0.04)",
                ]}
              />
            </RoundedRect>
          </Canvas>
          <Text style={[styles.cardBack, { color: "#fff" }]}>🂠</Text>
        </View>
      );
    }
    return (
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: "transparent",
          },
          flipCardStyle,
        ]}
      >
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          <RoundedRect x={0} y={0} width={CARD_W} height={CARD_H} r={8}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(CARD_W, CARD_H)}
              colors={["#FFFFFF", "#F8F8F8", "#F0F0F0"]}
            />
            <Shadow dx={0} dy={1} blur={2} color="rgba(0,0,0,0.1)" inner />
          </RoundedRect>
        </Canvas>
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
      {isSpectator && (
        <SpectatorBanner
          spectatorCount={spectatorCount}
          onLeave={() => {
            mp.cancelMultiplayer();
            navigation.goBack();
          }}
        />
      )}
      {!isSpectator && mp.isMultiplayer && spectatorCount > 0 && (
        <SpectatorOverlay spectatorCount={spectatorCount} />
      )}

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
        <Text style={[styles.title, { color: colors.text }]}>⚔️ War</Text>
        <View style={{ width: 40 }} />
      </View>

      {gameState === "menu" && (
        <View style={styles.menuContainer}>
          <Text style={[styles.menuTitle, { color: colors.text }]}>War</Text>
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
            style={{
              backgroundColor: colors.primary,
              marginTop: 24,
            }}
            labelStyle={{ color: "#fff" }}
          >
            Play vs AI
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

      {/* Colyseus online play area */}
      {gameState === "colyseus" && mp.phase === "playing" && (
        <View style={styles.playArea}>
          {/* Opponent side */}
          <View style={styles.playerSection}>
            <Text style={[styles.deckCount, { color: colors.textSecondary }]}>
              {mp.opponentName || "Opponent"}:{" "}
              {mp.myPlayerIndex === 0 ? mp.p2DeckSize : mp.p1DeckSize} cards
            </Text>
            {renderCard(
              mp.myPlayerIndex === 0
                ? (mp.player2Card as WarCard | null)
                : (mp.player1Card as WarCard | null),
              "Opponent",
            )}
          </View>

          {/* Message */}
          <View style={styles.messageRow}>
            <Text style={[styles.messageText, { color: colors.primary }]}>
              {mp.isWar
                ? "⚔️ WAR! ⚔️"
                : mp.roundResult === "player1"
                  ? mp.myPlayerIndex === 0
                    ? "You win this round! 🎉"
                    : "Opponent wins this round 😤"
                  : mp.roundResult === "player2"
                    ? mp.myPlayerIndex === 1
                      ? "You win this round! 🎉"
                      : "Opponent wins this round 😤"
                    : mp.myFlippedCard
                      ? "Waiting for opponent to flip..."
                      : "Tap to flip!"}
            </Text>
            {mp.warPileSize > 0 && (
              <Text
                style={[styles.warPileText, { color: colors.textSecondary }]}
              >
                War pile: {mp.warPileSize} cards
              </Text>
            )}
          </View>

          {/* Player side */}
          <View style={styles.playerSection}>
            {renderCard(
              mp.myPlayerIndex === 0
                ? (mp.player1Card as WarCard | null)
                : (mp.player2Card as WarCard | null),
              "You",
            )}
            <Text style={[styles.deckCount, { color: colors.textSecondary }]}>
              You: {mp.myPlayerIndex === 0 ? mp.p1DeckSize : mp.p2DeckSize}{" "}
              cards
            </Text>
          </View>

          {/* Flip button — always enabled unless already flipped this round */}
          <TouchableOpacity
            onPress={() => {
              if (!isSpectator && !mp.myFlippedCard) {
                mp.flipCard();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }}
            style={[
              styles.flipBtn,
              {
                backgroundColor: mp.myFlippedCard
                  ? colors.primary + "66"
                  : colors.primary,
              },
            ]}
            activeOpacity={0.7}
            disabled={!!mp.myFlippedCard || isSpectator}
          >
            <Text style={styles.flipBtnText}>
              {mp.myFlippedCard
                ? "Waiting..."
                : mp.isWar
                  ? "⚔️ War Flip!"
                  : "Flip!"}
            </Text>
          </TouchableOpacity>

          {/* Resign button */}
          {!isSpectator && (
            <TouchableOpacity
              onPress={() => setShowResignDialog(true)}
              style={{ marginTop: 12 }}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                Resign
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Colyseus Multiplayer Overlays */}
      {gameState === "colyseus" && (
        <>
          <TurnBasedWaitingOverlay
            colors={{
              primary: colors.primary,
              background: colors.background,
              surface: colors.surface,
              text: colors.text,
              textSecondary: colors.textSecondary,
              border: colors.border,
            }}
            onCancel={() => {
              mp.cancelMultiplayer();
              setGameState("menu");
            }}
            gameName="War"
            visible={mp.phase === "waiting" || mp.phase === "connecting"}
          />

          <TurnBasedCountdownOverlay
            countdown={mp.countdown}
            colors={{
              primary: colors.primary,
              background: colors.background,
              surface: colors.surface,
              text: colors.text,
              textSecondary: colors.textSecondary,
              border: colors.border,
            }}
            visible={mp.phase === "countdown"}
          />

          <TurnBasedReconnectingOverlay
            colors={{
              primary: colors.primary,
              background: colors.background,
              surface: colors.surface,
              text: colors.text,
              textSecondary: colors.textSecondary,
              border: colors.border,
            }}
            visible={mp.phase === "reconnecting"}
          />

          <TurnBasedGameOverOverlay
            isWinner={mp.isWinner}
            isDraw={mp.isDraw}
            winnerName={mp.winnerName}
            winReason={mp.winReason}
            myName={mp.myName}
            opponentName={mp.opponentName}
            rematchRequested={mp.rematchRequested}
            colors={{
              primary: colors.primary,
              background: colors.background,
              surface: colors.surface,
              text: colors.text,
              textSecondary: colors.textSecondary,
              border: colors.border,
            }}
            onRematch={mp.requestRematch}
            onAcceptRematch={mp.acceptRematch}
            onMenu={() => {
              mp.cancelMultiplayer();
              setGameState("menu");
            }}
            visible={mp.phase === "finished"}
          />

          <ResignConfirmDialog
            visible={showResignDialog}
            colors={{
              primary: colors.primary,
              background: colors.background,
              surface: colors.surface,
              text: colors.text,
              textSecondary: colors.textSecondary,
              border: colors.border,
            }}
            onConfirm={() => {
              setShowResignDialog(false);
              mp.resign();
            }}
            onCancel={() => setShowResignDialog(false)}
          />
        </>
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

export default withGameErrorBoundary(WarGameScreen, "war");
