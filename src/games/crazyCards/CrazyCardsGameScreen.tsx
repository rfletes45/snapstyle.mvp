/**
 * CrazyCardsGameScreen — UNO-inspired card game (replaces old CrazyEightsGameScreen)
 *
 * Modular composition of:
 * - OpponentBar        — opponent info / challenge button
 * - DirectionIndicator — CW / CCW arrow
 * - DrawDiscardPiles   — center piles + color ring
 * - CardHand           — player's scrollable hand
 * - ColorPicker        — wild color selection overlay
 * - UnoCallButton      — pulsing UNO call
 *
 * Hooks:
 * - useCardGame        — Colyseus multiplayer state + actions
 * - useGameLobbyController — lobby / invite flow
 * - useGameCompletion  — XP / achievements / exit
 * - useGameHaptics     — tactile feedback
 * - useGameBackHandler — Android back button
 *
 * Internal gameId stays "crazy_eights" for routing stability.
 * Navigation route: "CrazyEightsGame"
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { Canvas, LinearGradient, Rect, vec } from "@shopify/react-native-skia";

// ── Crazy Cards components ──
import { CardHand } from "@/games/crazyCards/CardHand";
import { ColorPicker } from "@/games/crazyCards/ColorPicker";
import { CARD_COLORS, DISPLAY_NAME } from "@/games/crazyCards/CrazyCardsConfig";
import {
  getPlayableCards,
  hasPlayableCard,
  parseSyncCard,
} from "@/games/crazyCards/CrazyCardsEngine";
import { DrawDiscardPiles } from "@/games/crazyCards/DrawDiscardPiles";
import { OpponentHandsArea } from "@/games/crazyCards/OpponentHandsArea";
import { UnoCallButton } from "@/games/crazyCards/UnoCallButton";

// ── Shared game components ──
import { withGameErrorBoundary } from "@/components/games/GameErrorBoundary";
import {
  GameOverModal,
  type GameResult,
} from "@/components/games/GameOverModal";
import { MultiplayerLobbyOverlay } from "@/components/games/MultiplayerLobbyOverlay";
import { SpectatorBanner } from "@/components/games/SpectatorBanner";
import { SpectatorOverlay } from "@/components/games/SpectatorOverlay";
import {
  ResignConfirmDialog,
  TurnBasedCountdownOverlay,
  TurnBasedGameOverOverlay,
  TurnBasedReconnectingOverlay,
  TurnBasedWaitingOverlay,
} from "@/components/games/TurnBasedOverlay";

// ── Hooks ──
import { useCardGame, type CardInfo } from "@/hooks/useCardGame";
import { useGameBackHandler } from "@/hooks/useGameBackHandler";
import { useGameCompletion } from "@/hooks/useGameCompletion";
import { useGameConnection } from "@/hooks/useGameConnection";
import { useGameHaptics } from "@/hooks/useGameHaptics";
import { useGameLobbyController } from "@/hooks/useGameLobbyController";
import { useSpectator } from "@/hooks/useSpectator";

// ── Services ──
import { onGameResultNotification } from "@/services/gameResultEvents";
import {
  buildGameResultEvent,
  submitGameResult,
} from "@/services/gameResultService";

// ── Stores ──
import { useAuth } from "@/store/AuthContext";
import { useUser } from "@/store/UserContext";

// ── Types ──
import type { CrazyCard, CrazyCardColor } from "@/types/turnBased";

import InvitePickerModal, {
  type FriendItem,
  type GroupItem,
} from "@/components/InvitePickerModal";
import { getGroupMembers } from "@/services/groups";
import { createLogger } from "@/utils/log";

const logger = createLogger("CrazyCardsGameScreen");

// =============================================================================
// Constants
// =============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

/** Colyseus room key — used by useCardGame / useGameConnection / COLYSEUS_ROOM_NAMES */
const COLYSEUS_KEY = "crazy_eights_game";
/** ExtendedGameType — used by invite system, GAME_METADATA, GAME_SCREEN_MAP */
const GAME_ID = "crazy_eights";
const BG_DARK = "#c93030";
const BG_FELT = "#c93030";

// =============================================================================
// Types
// =============================================================================

type GameMode = "menu" | "lobby" | "colyseus" | "waiting";

interface CrazyCardsScreenProps {
  navigation: any;
  route: {
    params?: {
      matchId?: string;
      inviteId?: string;
      entryPoint?: string;
      spectatorMode?: boolean;
    };
  };
}

// =============================================================================
// Helpers
// =============================================================================

/** Parse a CardInfo (from useCardGame) into a CrazyCard */
function cardInfoToCrazyCard(info: CardInfo): CrazyCard | null {
  if (info.id && info.color && info.type) {
    return {
      id: info.id,
      color: info.color as CrazyCardColor,
      type: info.type as CrazyCard["type"],
      value: info.value ?? null,
    };
  }
  // Fallback: parse from suit|rank encoding
  return parseSyncCard(info.suit, info.rank);
}

// =============================================================================
// Main Screen Component
// =============================================================================

// ── Overlay colors (Crazy Cards theme) ──
const OVERLAY_COLORS = {
  primary: CARD_COLORS.blue,
  background: BG_DARK,
  surface: "#1B1E2B",
  text: "#FFFFFF",
  textSecondary: "rgba(255,255,255,0.6)",
  border: "rgba(255,255,255,0.1)",
  player1: CARD_COLORS.blue,
  player2: CARD_COLORS.red,
};

function CrazyCardsGameScreen({ navigation, route }: CrazyCardsScreenProps) {
  const theme = useTheme();
  const auth = useAuth();
  const { profile } = useUser();
  const haptics = useGameHaptics();

  // ── Route params ──
  const routeMatchId = route.params?.matchId;
  const routeInviteId = route.params?.inviteId;
  const routeEntryPoint = route.params?.entryPoint;
  const routeSpectator = route.params?.spectatorMode;

  // ── Game mode ──
  const [gameMode, setGameMode] = useState<GameMode>(
    routeInviteId ? "lobby" : "menu",
  );

  // ── Multiplayer hook ──
  const mp = useCardGame(COLYSEUS_KEY);

  // ── Game connection resolver ──
  const { resolvedMode, firestoreGameId } = useGameConnection(
    COLYSEUS_KEY,
    routeMatchId,
  );

  // ── Lobby controller ──
  const lobbyController = useGameLobbyController({
    gameType: GAME_ID,
    inviteId: routeInviteId,
    entryPoint: routeEntryPoint,
    isTurnBased: false,
    onGameReady: (gameId: string) => {
      mp.startMultiplayer({ firestoreGameId: gameId });
      setGameMode("colyseus");
    },
    onLeaveLobby: () => {
      setGameMode("menu");
    },
    room: mp.room,
    roomPhase: mp.phase,
    roomReconnecting: mp.reconnecting,
    roomOpponentDisconnected: mp.opponentDisconnected,
    roomError: mp.error,
  });

  // ── Spectator ──
  const spectator = useSpectator({
    mode: "multiplayer-spectator",
    room: mp.room,
    state: mp.rawState,
  });

  // ── Game completion (XP, achievements, exit) ──
  const completion = useGameCompletion({
    gameType: GAME_ID,
    entryPoint: (routeEntryPoint as "play" | "chat") ?? "play",
  });

  // ── Back handler ──
  useGameBackHandler({
    gameType: GAME_ID,
    isMultiplayer: mp.isMultiplayer,
    isGameOver: mp.phase === "finished",
    entryPoint: routeEntryPoint,
    onBeforeLeave: () => {
      if (gameMode === "colyseus" && mp.phase === "playing") {
        setShowResignConfirm(true);
      }
    },
  });

  // ── UI state ──
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const selectedCardRef = useRef<string | null>(null);
  const [actionInFlight, setActionInFlight] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pendingWildCard, setPendingWildCard] = useState<CrazyCard | null>(
    null,
  );
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);
  const [didLevelUp, setDidLevelUp] = useState(false);
  const [hasCalledThisTurn, setHasCalledThisTurn] = useState(false);

  // Keep ref in sync with state for closure-safe access
  useEffect(() => {
    selectedCardRef.current = selectedCardId;
  }, [selectedCardId]);

  // ── Derived state ──

  /** Parse hand from CardInfo[] to CrazyCard[] */
  const hand: CrazyCard[] = useMemo(() => {
    return mp.hand
      .map(cardInfoToCrazyCard)
      .filter((c): c is CrazyCard => c !== null);
  }, [mp.hand]);

  /** Parse top card */
  const topCard: CrazyCard | null = useMemo(() => {
    if (!mp.topCard) return null;
    return cardInfoToCrazyCard(mp.topCard);
  }, [mp.topCard]);

  /** Current active color */
  const currentColor: CrazyCardColor = useMemo(() => {
    if (mp.currentSuit) {
      // Parse from encoded suit: "color|type|value"
      const parts = mp.currentSuit.split("|");
      if (
        parts[0] &&
        ["red", "yellow", "green", "blue", "wild"].includes(parts[0])
      ) {
        return parts[0] as CrazyCardColor;
      }
    }
    if (topCard) return topCard.color;
    return "wild";
  }, [mp.currentSuit, topCard]);

  /** Set of playable card IDs */
  const playableCardIds: Set<string> = useMemo(() => {
    if (!mp.isMyTurn || !topCard) return new Set();
    const playable = getPlayableCards(hand, topCard, currentColor);
    return new Set(playable.map((c) => c.id));
  }, [hand, topCard, currentColor, mp.isMyTurn]);

  /** Whether the selected card is a valid play */
  const hasPlayableSelection = useMemo(() => {
    return !!selectedCardId && playableCardIds.has(selectedCardId);
  }, [selectedCardId, playableCardIds]);

  /** Whether the player can draw (only if haven't already drawn this turn) */
  const canDraw = useMemo(() => {
    return (
      mp.isMyTurn &&
      mp.phase === "playing" &&
      mp.drawCount === 0 &&
      !actionInFlight
    );
  }, [mp.isMyTurn, mp.phase, mp.drawCount, actionInFlight]);

  /** Whether to show Call! button — at start of turn with 2 cards + valid play */
  const showUnoButton =
    mp.isMyTurn &&
    !mp.isSpectator &&
    hand.length === 2 &&
    playableCardIds.size > 0 &&
    !hasCalledThisTurn;

  /** Handle challenge from the opponent area */
  const handleChallengeFromStrip = useCallback(
    (sessionId: string) => {
      haptics.trigger("warning");
      mp.challengeUno(sessionId);
    },
    [mp, haptics],
  );

  // ── Effects ──

  // Auto-connect when routed with matchId
  useEffect(() => {
    if (resolvedMode === "colyseus" && firestoreGameId && gameMode === "menu") {
      mp.startMultiplayer({ firestoreGameId, spectator: routeSpectator });
      setGameMode("colyseus");
    }
  }, [resolvedMode, firestoreGameId, gameMode, routeSpectator]);

  // Game over detection
  useEffect(() => {
    if (mp.phase === "finished") {
      haptics.gameOverPattern(mp.isWinner === true);

      const result: GameResult = mp.isWinner
        ? "win"
        : mp.isDraw
          ? "draw"
          : "loss";
      setGameResult(result);

      // Submit result
      try {
        const outcome =
          result === "loss"
            ? ("lose" as const)
            : result === "win"
              ? ("win" as const)
              : ("draw" as const);
        const event = buildGameResultEvent({
          gameId: GAME_ID as any,
          mode: "realtime",
          outcome,
          score: mp.myScore,
          durationMs: 0,
          userId: auth.currentFirebaseUser?.uid ?? "",
          displayName: profile?.displayName ?? "Player",
          meta: {
            handSize: hand.length,
          },
        });
        submitGameResult(event);
      } catch (e) {
        logger.warn("Failed to submit game result", e);
      }

      setTimeout(() => setShowGameOverModal(true), 800);
    }
  }, [mp.phase]);

  // Clear selection and action lock when turn changes
  useEffect(() => {
    if (!mp.isMyTurn) {
      setSelectedCardId(null);
      setActionInFlight(false);
      setHasCalledThisTurn(false);
    }
  }, [mp.isMyTurn]);

  // Clear action lock when hand changes (server confirmed play/draw)
  useEffect(() => {
    setActionInFlight(false);
  }, [mp.hand]);

  // XP notification listener
  useEffect(() => {
    const unsub = onGameResultNotification((notification) => {
      if (notification.xpEarned) setXpEarned(notification.xpEarned);
      if (notification.didLevelUp) setDidLevelUp(true);
    });
    return unsub;
  }, []);

  // ── Handlers ──

  /** Helper: dispatch play to server */
  const dispatchPlay = useCallback(
    (card: CrazyCard, chosenColor?: CrazyCardColor) => {
      setActionInFlight(true);
      haptics.trigger("impact_medium");
      const cardInfo: CardInfo = {
        suit: `${card.color}|${card.type}|${card.value ?? ""}`,
        rank: card.id,
        id: card.id,
        color: card.color,
        type: card.type,
        value: card.value,
      };
      mp.playCard(cardInfo, chosenColor, hasCalledThisTurn);
      setSelectedCardId(null);
    },
    [mp, haptics, hasCalledThisTurn],
  );

  const handleCardSelect = useCallback(
    (card: CrazyCard) => {
      if (!mp.isMyTurn || actionInFlight) return;
      haptics.trigger("selection");
      // Toggle: deselect if tapping the same card again
      setSelectedCardId((prev) => (prev === card.id ? null : card.id));
    },
    [mp.isMyTurn, actionInFlight, haptics],
  );

  /** Double-tap on a card in hand plays it directly */
  const handleCardPlay = useCallback(
    (card: CrazyCard) => {
      if (!mp.isMyTurn || actionInFlight) return;
      if (!playableCardIds.has(card.id)) {
        haptics.trigger("error");
        return;
      }

      // If wild, show color picker
      if (card.type === "wild" || card.type === "wild_draw_four") {
        setPendingWildCard(card);
        setShowColorPicker(true);
        return;
      }

      dispatchPlay(card);
    },
    [mp.isMyTurn, actionInFlight, playableCardIds, haptics, dispatchPlay],
  );

  /** Tap discard pile to play the currently selected card */
  const handlePlaySelected = useCallback(() => {
    if (!mp.isMyTurn || actionInFlight) return;
    const id = selectedCardRef.current;
    if (!id) return;
    const card = hand.find((c) => c.id === id);
    if (!card) return;
    if (!playableCardIds.has(card.id)) {
      haptics.trigger("error");
      return;
    }

    // If wild, show color picker
    if (card.type === "wild" || card.type === "wild_draw_four") {
      setPendingWildCard(card);
      setShowColorPicker(true);
      return;
    }

    dispatchPlay(card);
  }, [
    mp.isMyTurn,
    actionInFlight,
    hand,
    playableCardIds,
    haptics,
    dispatchPlay,
  ]);

  const handleColorChosen = useCallback(
    (color: CrazyCardColor) => {
      if (!pendingWildCard) return;
      dispatchPlay(pendingWildCard, color);
      setShowColorPicker(false);
      setPendingWildCard(null);
    },
    [pendingWildCard, dispatchPlay],
  );

  const handleDraw = useCallback(() => {
    if (!canDraw || actionInFlight) return;
    setSelectedCardId(null);
    setActionInFlight(true);
    haptics.trigger("impact_light");
    mp.drawCard();
  }, [canDraw, actionInFlight, mp, haptics]);

  const handlePass = useCallback(() => {
    if (!mp.isMyTurn || actionInFlight) return;
    setActionInFlight(true);
    haptics.trigger("selection");
    mp.pass();
  }, [mp, actionInFlight, haptics]);

  const handleCallUno = useCallback(() => {
    haptics.trigger("success");
    setHasCalledThisTurn(true);
    mp.callUno();
  }, [mp, haptics]);

  const handleResign = useCallback(() => {
    mp.resign();
    setShowResignConfirm(false);
  }, [mp]);

  const handlePlayAgain = useCallback(() => {
    setShowGameOverModal(false);
    setGameResult(null);
    setXpEarned(0);
    setDidLevelUp(false);
    mp.requestRematch();
  }, [mp]);

  const handleGoBack = useCallback(() => {
    mp.cancelMultiplayer();
    if (routeEntryPoint === "chat") {
      navigation.goBack();
    } else {
      navigation.navigate("GamesHub");
    }
  }, [mp, navigation, routeEntryPoint]);

  const handleInviteFriend = useCallback(() => {
    setShowFriendPicker(true);
  }, []);

  const handleSelectFriend = useCallback(
    async (friend: FriendItem) => {
      setShowFriendPicker(false);
      if (!auth.currentFirebaseUser) return;
      try {
        await lobbyController.lobby.sendFriendInvite(
          friend.friendUid,
          friend.displayName || friend.username,
          undefined,
        );
      } catch (error: any) {
        logger.error("Failed to send invite", error);
        Alert.alert("Error", error?.message || "Failed to send game invite.");
      }
    },
    [lobbyController.lobby, auth.currentFirebaseUser],
  );

  const handleSelectGroup = useCallback(
    async (group: GroupItem) => {
      setShowFriendPicker(false);
      if (!auth.currentFirebaseUser) return;
      try {
        const members = await getGroupMembers(group.groupId);
        const memberIds = members.map((m) => m.uid);
        await lobbyController.lobby.sendGroupInvite(
          group.groupId,
          group.name,
          memberIds,
        );
      } catch (error: any) {
        logger.error("Failed to send group invite", error);
        Alert.alert("Error", error?.message || "Failed to send group invite.");
      }
    },
    [lobbyController.lobby, auth.currentFirebaseUser],
  );

  const handleStartOnline = useCallback(() => {
    setGameMode("lobby");
  }, []);

  const handleStartPractice = useCallback(async () => {
    try {
      setGameMode("colyseus");
      await mp.startMultiplayer({ practice: true });
    } catch (e: any) {
      logger.error("[CrazyCards] Practice start failed:", e);
      setGameMode("menu");
    }
  }, [mp]);

  // ── Status text ──
  const statusText = useMemo(() => {
    if (mp.phase === "waiting") return "Waiting for players...";
    if (mp.phase === "countdown") return `Starting in ${mp.countdown}...`;
    if (mp.phase === "finished") {
      if (mp.isWinner) return "You win!";
      if (mp.isDraw) return "Draw!";
      return "You lose!";
    }
    if (!mp.isMyTurn) {
      const currentTurnOpp = mp.opponents.find((o) => o.isTheirTurn);
      const turnName =
        currentTurnOpp?.displayName || mp.opponentName || "Opponent";
      return `${turnName}'s turn`;
    }
    if (playableCardIds.size === 0) return "No playable cards — draw or pass";
    return "Your turn — play a card!";
  }, [
    mp.phase,
    mp.isMyTurn,
    mp.opponentName,
    mp.opponents,
    mp.countdown,
    mp.isWinner,
    mp.isDraw,
    playableCardIds,
  ]);

  // =========================================================================
  // RENDER: Menu Mode
  // =========================================================================

  if (gameMode === "menu") {
    return (
      <SafeAreaView style={styles.menuContainer}>
        <View style={styles.menuContent}>
          <Text style={styles.menuTitle}>{DISPLAY_NAME}</Text>
          <Text style={styles.menuSubtitle}>UNO-inspired card game</Text>

          <View style={styles.menuButtons}>
            <Button
              mode="contained"
              onPress={handleStartOnline}
              style={styles.menuButton}
              labelStyle={styles.menuButtonLabel}
              icon="account-multiple"
            >
              Play Online
            </Button>

            <Button
              mode="contained"
              onPress={handleStartPractice}
              style={[styles.menuButton, styles.menuButtonPractice]}
              labelStyle={styles.menuButtonLabel}
              icon="robot"
            >
              Practice vs AI
            </Button>

            <Button
              mode="outlined"
              onPress={handleGoBack}
              style={[styles.menuButton, styles.menuButtonOutlined]}
              labelStyle={styles.menuButtonLabelOutlined}
              icon="arrow-left"
            >
              Back to Games
            </Button>
          </View>

          {/* Rules summary */}
          <View style={styles.rulesContainer}>
            <Text style={styles.rulesTitle}>How to Play</Text>
            <Text style={styles.rulesText}>
              Match cards by color or number. Action cards (Skip, Reverse, +2)
              add strategy. Wild cards let you choose the color. Be first to
              empty your hand — and don't forget to call UNO when you have one
              card left!
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // =========================================================================
  // RENDER: Lobby Mode
  // =========================================================================

  if (gameMode === "lobby") {
    return (
      <View style={{ flex: 1 }}>
        <MultiplayerLobbyOverlay
          controller={lobbyController}
          gameTitle={DISPLAY_NAME}
          gameIcon="cards-playing-outline"
          onInvitePress={handleInviteFriend}
          onLeave={() => setGameMode("menu")}
        >
          {/* Placeholder child — actual game view renders in "colyseus" mode */}
          <View style={{ flex: 1 }} />
        </MultiplayerLobbyOverlay>

        <InvitePickerModal
          visible={showFriendPicker}
          onDismiss={() => setShowFriendPicker(false)}
          onSelectFriend={handleSelectFriend}
          onSelectGroup={handleSelectGroup}
          currentUserId={auth.currentFirebaseUser?.uid ?? ""}
        />
      </View>
    );
  }

  // =========================================================================
  // RENDER: Gameplay (Colyseus)
  // =========================================================================

  return (
    <View style={styles.gameContainer}>
      {/* Felt table background */}
      <Canvas style={StyleSheet.absoluteFill}>
        <Rect x={0} y={0} width={SCREEN_WIDTH} height={SCREEN_HEIGHT}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(SCREEN_WIDTH, SCREEN_HEIGHT)}
            colors={[BG_DARK, BG_FELT, BG_DARK]}
          />
        </Rect>
      </Canvas>

      <SafeAreaView style={styles.gameContent}>
        {/* ── Spectator Banner ── */}
        {mp.isSpectator && (
          <SpectatorBanner
            spectatorCount={mp.spectatorCount}
            onLeave={handleGoBack}
          />
        )}

        {/* ── Header Bar ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{DISPLAY_NAME}</Text>
          {mp.phase === "playing" && !mp.isSpectator && (
            <TouchableOpacity
              onPress={() => setShowResignConfirm(true)}
              style={styles.headerButton}
            >
              <Text style={styles.headerButtonText}>🏳️</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Opponent Hands (card backs) ── */}
        <OpponentHandsArea
          opponents={mp.opponents}
          onChallenge={handleChallengeFromStrip}
          unoChallengeTarget={mp.unoChallengeTarget}
        />

        {/* ── Play Area ── */}
        <View style={styles.playArea}>
          {/* Draw + Discard piles */}
          <DrawDiscardPiles
            topCard={topCard}
            deckSize={mp.deckSize}
            currentColor={currentColor}
            canDraw={canDraw}
            onDraw={handleDraw}
            onPlaySelected={handlePlaySelected}
            isMyTurn={mp.isMyTurn}
            hasPlayableSelection={hasPlayableSelection}
            actionInFlight={actionInFlight}
          />
        </View>

        {/* ── Status Text ── */}
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>{statusText}</Text>
        </View>

        {/* ── Action Buttons (Pass — only after drawing) ── */}
        {mp.isMyTurn && mp.phase === "playing" && !mp.isSpectator && (
          <View style={styles.actionButtons}>
            {mp.drawCount > 0 &&
              !hasPlayableCard(hand, topCard!, currentColor) && (
                <TouchableOpacity
                  style={styles.passButton}
                  onPress={handlePass}
                  activeOpacity={0.7}
                >
                  <Text style={styles.passButtonText}>PASS</Text>
                </TouchableOpacity>
              )}
          </View>
        )}

        {/* ── Player Hand ── */}
        {!mp.isSpectator && (
          <CardHand
            hand={hand}
            selectedCardId={selectedCardId}
            playableCardIds={playableCardIds}
            isMyTurn={mp.isMyTurn}
            onCardSelect={handleCardSelect}
            onCardPlay={handleCardPlay}
          />
        )}

        {/* ── Spectator Overlay ── */}
        {mp.isSpectator && spectator && (
          <SpectatorOverlay spectatorCount={mp.spectatorCount} />
        )}
      </SafeAreaView>

      {/* ── UNO Call Button ── */}
      <UnoCallButton visible={showUnoButton} onCall={handleCallUno} />

      {/* ── Color Picker Overlay ── */}
      <ColorPicker
        visible={showColorPicker}
        onColorChosen={handleColorChosen}
        onCancel={() => {
          setShowColorPicker(false);
          setPendingWildCard(null);
        }}
      />

      {/* ── Colyseus Phase Overlays ── */}
      {mp.phase === "waiting" && (
        <TurnBasedWaitingOverlay
          colors={OVERLAY_COLORS}
          onCancel={() => {
            mp.cancelMultiplayer();
            setGameMode("menu");
          }}
          gameName={DISPLAY_NAME}
        />
      )}
      {mp.phase === "countdown" && (
        <TurnBasedCountdownOverlay
          countdown={mp.countdown}
          colors={OVERLAY_COLORS}
        />
      )}
      {mp.reconnecting && (
        <TurnBasedReconnectingOverlay colors={OVERLAY_COLORS} />
      )}
      {mp.phase === "finished" && !showGameOverModal && (
        <TurnBasedGameOverOverlay
          isWinner={mp.isWinner}
          isDraw={mp.isDraw}
          winnerName={mp.winnerName}
          winReason={mp.winReason}
          myName={mp.myName}
          opponentName={mp.opponentName}
          myScore={mp.myScore}
          opponentScore={mp.opponentScore}
          rematchRequested={mp.rematchRequested}
          colors={OVERLAY_COLORS}
          onRematch={handlePlayAgain}
          onAcceptRematch={() => mp.acceptRematch()}
          onMenu={handleGoBack}
        />
      )}

      {/* ── Resign Dialog ── */}
      <ResignConfirmDialog
        visible={showResignConfirm}
        colors={OVERLAY_COLORS}
        onConfirm={handleResign}
        onCancel={() => setShowResignConfirm(false)}
      />

      {/* ── Game Over Modal ── */}
      {showGameOverModal && gameResult && (
        <GameOverModal
          visible={showGameOverModal}
          result={gameResult}
          stats={{
            score: mp.myScore,
            opponentName: mp.opponentName,
            xpEarned,
            didLevelUp,
          }}
          onRematch={handlePlayAgain}
          onExit={handleGoBack}
          showRematch
        />
      )}

      {/* ── Friend Picker ── */}
      <InvitePickerModal
        visible={showFriendPicker}
        onDismiss={() => setShowFriendPicker(false)}
        onSelectFriend={handleSelectFriend}
        onSelectGroup={handleSelectGroup}
        currentUserId={auth.currentFirebaseUser?.uid ?? ""}
      />
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  // ── Menu ──
  menuContainer: {
    flex: 1,
    backgroundColor: BG_DARK,
  },
  menuContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  menuTitle: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 8,
  },
  menuSubtitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    marginBottom: 40,
  },
  menuButtons: {
    width: "100%",
    gap: 12,
  },
  menuButton: {
    borderRadius: 14,
    paddingVertical: 4,
  },
  menuButtonLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  menuButtonOutlined: {
    borderColor: "rgba(255,255,255,0.2)",
  },
  menuButtonPractice: {
    backgroundColor: "#3DE57A",
  },
  menuButtonLabelOutlined: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 16,
  },
  rulesContainer: {
    marginTop: 40,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 20,
    width: "100%",
  },
  rulesTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  rulesText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    lineHeight: 20,
  },

  // ── Game ──
  gameContainer: {
    flex: 1,
    backgroundColor: BG_DARK,
  },
  gameContent: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerButtonText: {
    fontSize: 16,
    color: "#FFFFFF",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  playArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  statusContainer: {
    alignItems: "center",
    paddingVertical: 8,
  },
  statusText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: 4,
    gap: 12,
  },
  passButton: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  passButtonText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
  },
});

export default withGameErrorBoundary(CrazyCardsGameScreen, "crazy_eights");
