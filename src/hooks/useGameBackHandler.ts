/**
 * useGameBackHandler – Shared back-navigation logic for all game screens.
 *
 * Behaviour:
 *  • **Non-daily SP games**: shows a confirmation Alert before leaving.
 *    "Your current game will not be saved."
 *  • **Daily games** (word_master): leaves immediately (progress is persisted
 *    separately; see daily-game persistence).
 *  • **Turn-based multiplayer games** (chess, checkers, etc.): shows a softer
 *    prompt — "Your progress will be saved." — because the server
 *    automatically persists game state to Firestore via saveGameState() when
 *    all players disconnect.
 *  • **Real-time multiplayer games** (dot_match, mini_golf, etc.): shows
 *    "Leaving will end the match." because these sessions cannot be resumed.
 *  • On confirmation (or for dailies), navigates to **GamesHub** so the user
 *    always lands on the Play screen.
 *  • Also intercepts the Android hardware back button via `BackHandler`.
 *  • Intercepts the navigation `beforeRemove` event so swipe-back on iOS and
 *    header back buttons are also covered.
 *
 * @module hooks/useGameBackHandler
 */

import { DAILY_GAMES } from "@/constants/featureFlags";
import { CommonActions, useNavigation } from "@react-navigation/native";
import { useCallback, useEffect, useRef } from "react";
import { Alert, BackHandler } from "react-native";

/**
 * Turn-based multiplayer game types whose state is automatically saved to
 * Firestore when all players disconnect (via TurnBasedRoom.onDispose →
 * saveGameState).  Leaving these games is safe — progress is preserved.
 */
const TURN_BASED_SAVE_GAMES: string[] = [
  "chess",
  "chess_game",
  "checkers",
  "checkers_game",
  "crazy_eights",
  "crazy_eights_game",
  "tic_tac_toe",
  "tic_tac_toe_game",
  "connect_four",
  "connect_four_game",
  "gomoku_master",
  "gomoku_master_game",
  "gomoku",
  "reversi_game",
  "reversi",
];

/**
 * Real-time multiplayer game types that CANNOT be resumed after leaving.
 * The match ends immediately when a player disconnects.
 */
const REAL_TIME_MULTIPLAYER_GAMES: string[] = [
  "dot_match",
  "dot_match_game",
  "pong",
  "pong_game",
  "bounce_blitz",
  "bounce_blitz_game",
];

interface UseGameBackHandlerOptions {
  /** The game type key, e.g. "snake_master", "word_master" */
  gameType: string;
  /** Whether the game is already finished (game over / won). When true the
   *  user can leave without the confirmation dialog. */
  isGameOver?: boolean;
  /** Whether the game is currently in an online multiplayer session.
   *  When true for turn-based games, the "progress will be saved" prompt is
   *  shown instead of "will not be saved". Defaults to false. */
  isMultiplayer?: boolean;
  /** Optional callback that runs *before* the actual navigation (e.g. endHosting). */
  onBeforeLeave?: () => void | Promise<void>;
  /**
   * Where the user entered the game from. Used for deterministic back-
   * navigation so the user always returns to the correct screen.
   *
   * - "play" → Play tab / GamesHub
   * - "chat" → Inbox / ChatDetail or GroupChat
   * - "invite_queue" → Play tab / GamesHub (came from invite)
   * - undefined → default to GamesHub
   */
  entryPoint?: string;
  /** Conversation ID for chat-based exit navigation (DM or group) */
  conversationId?: string;
  /** Conversation type for chat-based exit navigation */
  conversationType?: "dm" | "group";
  /** Opponent UID for DM navigation */
  opponentUid?: string;
  /**
   * Whether the user is currently in the pre-game lobby (waiting to start).
   * When true, the back handler navigates immediately without any
   * confirmation dialog — there is no game-in-progress to save.
   */
  isInLobby?: boolean;
}

/**
 * Returns a `handleBack` callback that can be wired to any back button.
 * Also registers BackHandler + beforeRemove automatically.
 */
export function useGameBackHandler(options: UseGameBackHandlerOptions) {
  const {
    gameType,
    isGameOver = false,
    isMultiplayer = false,
    onBeforeLeave,
    entryPoint,
    conversationId,
    conversationType,
    opponentUid,
    isInLobby = false,
  } = options;
  const navigation = useNavigation<any>();

  // Guard flag: when true, the user already confirmed leaving via handleBack's
  // Alert — let beforeRemove pass through without showing a second dialog.
  const leavingRef = useRef(false);

  const isDaily = DAILY_GAMES.includes(gameType);
  const isTurnBasedSaveable =
    isMultiplayer && TURN_BASED_SAVE_GAMES.includes(gameType);
  const isRealTimeMultiplayer =
    isMultiplayer && REAL_TIME_MULTIPLAYER_GAMES.includes(gameType);

  /**
   * Navigate to the correct screen based on entryPoint.
   *
   * Priority:
   * 1. entryPoint === "chat" + conversationId → return to that chat
   * 2. entryPoint === "play" / "invite_queue" → GamesHub
   * 3. Default → GamesHub (never falls to Shop or random stack state)
   */
  const navigateToOrigin = useCallback(async () => {
    // Mark as intentionally leaving so beforeRemove doesn't show a 2nd dialog
    leavingRef.current = true;

    if (onBeforeLeave) {
      await onBeforeLeave();
    }

    // Chat entry point with conversation context
    if (entryPoint === "chat" && conversationId) {
      if (conversationType === "dm" && opponentUid) {
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [
              {
                name: "Inbox",
                state: {
                  routes: [
                    { name: "ChatList" },
                    { name: "ChatDetail", params: { friendUid: opponentUid } },
                  ],
                  index: 1,
                },
              },
            ],
          }),
        );
        return;
      }
      if (conversationType === "group") {
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [
              {
                name: "Inbox",
                state: {
                  routes: [
                    { name: "ChatList" },
                    { name: "GroupChat", params: { groupId: conversationId } },
                  ],
                  index: 1,
                },
              },
            ],
          }),
        );
        return;
      }
    }

    // Default: always go to Play tab → GamesHub via deterministic reset.
    // This fixes Bug #1 — never falls through to Shop or wrong tab.
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [
          {
            name: "Play",
            state: {
              routes: [{ name: "GamesHub" }],
              index: 0,
            },
          },
        ],
      }),
    );
  }, [
    navigation,
    onBeforeLeave,
    entryPoint,
    conversationId,
    conversationType,
    opponentUid,
  ]);

  /** The user-facing back handler. */
  const handleBack = useCallback(() => {
    // Game already over → leave immediately (no unsaved progress).
    if (isGameOver) {
      navigateToOrigin();
      return;
    }

    // Lobby mode → leave immediately (no game in progress to save).
    if (isInLobby) {
      navigateToOrigin();
      return;
    }

    // Daily games → leave immediately (progress saved separately).
    if (isDaily) {
      navigateToOrigin();
      return;
    }

    // Turn-based multiplayer game → progress IS auto-saved to Firestore.
    // Show a gentle "progress will be saved" prompt instead of a warning.
    if (isTurnBasedSaveable) {
      Alert.alert(
        "Leave Game?",
        "Your progress will be saved. You can resume this game later.",
        [
          { text: "Stay", style: "cancel" },
          {
            text: "Leave",
            onPress: () => navigateToOrigin(),
          },
        ],
      );
      return;
    }

    // Real-time multiplayer game → match ends immediately on disconnect.
    if (isRealTimeMultiplayer) {
      Alert.alert(
        "Leave Match?",
        "Leaving will end the match. Your opponent will be notified.",
        [
          { text: "Stay", style: "cancel" },
          {
            text: "Leave",
            style: "destructive",
            onPress: () => navigateToOrigin(),
          },
        ],
      );
      return;
    }

    // Non-daily, non-turn-based, in-progress game → confirm with warning.
    Alert.alert(
      "Leave Game?",
      "Your current game will not be saved. Are you sure you want to leave?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: () => navigateToOrigin(),
        },
      ],
    );
  }, [
    isGameOver,
    isInLobby,
    isDaily,
    isTurnBasedSaveable,
    isRealTimeMultiplayer,
    navigateToOrigin,
  ]);

  // ── Android hardware back button ──────────────────────────────────────
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      handleBack();
      return true; // prevent default
    });
    return () => sub.remove();
  }, [handleBack]);

  // ── React Navigation beforeRemove (iOS swipe, header back) ───────────
  useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", (e: any) => {
      // If we already confirmed via handleBack, allow navigation immediately
      if (leavingRef.current) return;

      // If game is over, daily, or in lobby, let navigation proceed
      // immediately — no game-in-progress to save.
      if (isGameOver || isDaily || isInLobby) return;

      // Turn-based multiplayer: show the "progress saved" prompt
      if (isTurnBasedSaveable) {
        e.preventDefault();
        Alert.alert(
          "Leave Game?",
          "Your progress will be saved. You can resume this game later.",
          [
            { text: "Stay", style: "cancel" },
            {
              text: "Leave",
              onPress: () => navigation.dispatch(e.data.action),
            },
          ],
        );
        return;
      }

      // Real-time multiplayer: match ends immediately
      if (isRealTimeMultiplayer) {
        e.preventDefault();
        Alert.alert(
          "Leave Match?",
          "Leaving will end the match. Your opponent will be notified.",
          [
            { text: "Stay", style: "cancel" },
            {
              text: "Leave",
              style: "destructive",
              onPress: () => navigation.dispatch(e.data.action),
            },
          ],
        );
        return;
      }

      // Prevent default and show warning dialog.
      e.preventDefault();

      Alert.alert(
        "Leave Game?",
        "Your current game will not be saved. Are you sure you want to leave?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Leave",
            style: "destructive",
            onPress: () => navigation.dispatch(e.data.action),
          },
        ],
      );
    });

    return unsub;
  }, [
    navigation,
    isGameOver,
    isDaily,
    isInLobby,
    isTurnBasedSaveable,
    isRealTimeMultiplayer,
  ]);

  return { handleBack };
}
