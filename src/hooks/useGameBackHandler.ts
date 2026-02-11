/**
 * useGameBackHandler – Shared back-navigation logic for all game screens.
 *
 * Behaviour:
 *  • **Non-daily SP games**: shows a confirmation Alert before leaving.
 *    "Your current game will not be saved."
 *  • **Daily games** (word_master): leaves immediately (progress is persisted
 *    separately; see daily-game persistence).
 *  • On confirmation (or for dailies), navigates to **GamesHub** so the user
 *    always lands on the Play screen.
 *  • Also intercepts the Android hardware back button via `BackHandler`.
 *  • Intercepts the navigation `beforeRemove` event so swipe-back on iOS and
 *    header back buttons are also covered.
 *
 * @module hooks/useGameBackHandler
 */

import { DAILY_GAMES } from "@/constants/featureFlags";
import { useNavigation } from "@react-navigation/native";
import { useCallback, useEffect } from "react";
import { Alert, BackHandler } from "react-native";

interface UseGameBackHandlerOptions {
  /** The game type key, e.g. "snake_master", "word_master" */
  gameType: string;
  /** Whether the game is already finished (game over / won). When true the
   *  user can leave without the confirmation dialog. */
  isGameOver?: boolean;
  /** Optional callback that runs *before* the actual navigation (e.g. endHosting). */
  onBeforeLeave?: () => void | Promise<void>;
}

/**
 * Returns a `handleBack` callback that can be wired to any back button.
 * Also registers BackHandler + beforeRemove automatically.
 */
export function useGameBackHandler(options: UseGameBackHandlerOptions) {
  const { gameType, isGameOver = false, onBeforeLeave } = options;
  const navigation = useNavigation<any>();

  const isDaily = DAILY_GAMES.includes(gameType);

  /** Navigate safely to GamesHub. */
  const navigateToHub = useCallback(async () => {
    if (onBeforeLeave) {
      await onBeforeLeave();
    }
    // Always navigate to GamesHub explicitly – avoids falling through to
    // the wrong tab when the stack is shallow.
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("GamesHub");
    }
  }, [navigation, onBeforeLeave]);

  /** The user-facing back handler. */
  const handleBack = useCallback(() => {
    // Game already over → leave immediately (no unsaved progress).
    if (isGameOver) {
      navigateToHub();
      return;
    }

    // Daily games → leave immediately (progress saved separately).
    if (isDaily) {
      navigateToHub();
      return;
    }

    // Non-daily, in-progress game → confirm.
    Alert.alert(
      "Leave Game?",
      "Your current game will not be saved. Are you sure you want to leave?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: () => navigateToHub(),
        },
      ],
    );
  }, [isGameOver, isDaily, navigateToHub]);

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
      // If game is over or daily, let it go through.
      if (isGameOver || isDaily) return;

      // Prevent default and show dialog.
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
  }, [navigation, isGameOver, isDaily]);

  return { handleBack };
}
