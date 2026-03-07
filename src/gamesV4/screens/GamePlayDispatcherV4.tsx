/**
 * Games V4 — Game Play Dispatcher Screen
 *
 * Routes to the correct game-specific screen based on gameId.
 * Registered as "GamePlayV4" in the main navigator.
 *
 * This acts as a thin switch — each game's screen is a shell-wrapped component
 * that independently subscribes to session state.
 *
 * @module gamesV4/screens/GamePlayDispatcherV4
 */

import { subscribeToSession } from "@/gamesV4/services/gameServiceV4";
import type { GameId } from "@/gamesV4/types/common";
import { useAppTheme } from "@/store/ThemeContext";
import type { MainStackParamList } from "@/types/navigation/root";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// Lazy imports to avoid pulling all game UIs into the initial bundle
import BattleshipScreenV4 from "./BattleshipScreenV4";
import BrickBreakerScreenV4 from "./BrickBreakerScreenV4";
import ChessScreenV4 from "./ChessScreenV4";
import ConnectFourScreenV4 from "./ConnectFourScreenV4";
import CrazyEightsScreenV4 from "./CrazyEightsScreenV4";
import MinesweeperScreenV4 from "./MinesweeperScreenV4";
import MinigolfScreenV4 from "./MinigolfScreenV4";
import Play2048ScreenV4 from "./Play2048ScreenV4";
import SketchPartyScreenV4 from "./SketchPartyScreenV4";
import SolitaireKlondikeScreenV4 from "./SolitaireKlondikeScreenV4";
import TicTacToeScreenV4 from "./TicTacToeScreenV4";

type Nav = NativeStackNavigationProp<MainStackParamList>;

/**
 * Map of gameId → pilot screen component.
 * Extend this map as new adapters are added.
 */
const GAME_SCREEN_MAP: Partial<Record<GameId, React.ComponentType<object>>> = {
  tic_tac_toe: TicTacToeScreenV4,
  connect_four: ConnectFourScreenV4,
  play_2048: Play2048ScreenV4,
  chess: ChessScreenV4,
  sketch_party_game: SketchPartyScreenV4,
  battleship: BattleshipScreenV4,
  brick_breaker: BrickBreakerScreenV4,
  crazy_eights: CrazyEightsScreenV4,
  minigolf_duels: MinigolfScreenV4,
  minesweeper: MinesweeperScreenV4,
  solitaire_klondike: SolitaireKlondikeScreenV4,
};

export default function GamePlayDispatcherV4() {
  const { theme } = useAppTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<{
    key: string;
    name: string;
    params: { sessionId: string; gameId?: string };
  }>();

  const { sessionId, gameId: gameIdParam } = route.params;

  // When arriving via deep link, gameId may be missing from the URL.
  // Fetch it from the session document so the dispatcher can route.
  const [resolvedGameId, setResolvedGameId] = useState<string | undefined>(
    gameIdParam,
  );
  useEffect(() => {
    if (gameIdParam) {
      setResolvedGameId(gameIdParam);
      return;
    }
    if (!sessionId) return;
    const unsub = subscribeToSession(
      sessionId,
      (sess) => {
        if (sess?.gameId) setResolvedGameId(sess.gameId);
      },
      (err) => console.warn("[GamePlayDispatcher] session fetch error:", err),
    );
    return unsub;
  }, [sessionId, gameIdParam]);

  const GameScreen = resolvedGameId
    ? GAME_SCREEN_MAP[resolvedGameId as GameId]
    : undefined;

  // Still resolving gameId from session doc — show spinner
  if (!resolvedGameId) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.isDark ? "#000" : theme.colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!GameScreen) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.isDark ? "#000" : theme.colors.background,
          },
        ]}
      >
        <Text style={[styles.errorText, { color: theme.colors.primary }]}>
          No V4 screen available for "{resolvedGameId}"
        </Text>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: theme.colors.primary }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <GameScreen />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  backBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backBtnText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 14,
  },
});
