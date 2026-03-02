/**
 * useGameRecovery — Hook that checks for a recoverable game session
 *
 * On mount and on every background→foreground transition, reads the
 * AsyncStorage bookmark and validates against Firestore.  Exposes:
 *
 * - `recoverableSession` — non-null when the user can resume a game
 * - `resumeGame()` — navigates to the game screen with the right params
 * - `dismissRecovery()` — clears the bookmark and hides the banner
 * - `checking` — true while the async validation is in flight
 *
 * Usage:
 *   function GamesHubScreen() {
 *     const { recoverableSession, resumeGame, dismissRecovery } = useGameRecovery();
 *     if (recoverableSession) return <ResumeGameBanner onResume={resumeGame} onDismiss={dismissRecovery} />;
 *   }
 *
 * @module hooks/useGameRecovery
 */

import {
  clearActiveSession,
  recoverActiveSession,
  type RecoverableSession,
} from "@/services/gameRecovery";
import { createLogger } from "@/utils/log";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { getAuth } from "firebase/auth";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";

const logger = createLogger("hooks/useGameRecovery");

// =============================================================================
// Types
// =============================================================================

export interface UseGameRecoveryReturn {
  /** Non-null when a resumable session exists */
  recoverableSession: RecoverableSession | null;
  /** True while the recovery check is in progress */
  checking: boolean;
  /** Navigate to the recovered game screen */
  resumeGame: () => void;
  /** Dismiss the recovery banner and clear the bookmark */
  dismissRecovery: () => Promise<void>;
}

// =============================================================================
// Hook
// =============================================================================

export function useGameRecovery(): UseGameRecoveryReturn {
  const [recoverableSession, setRecoverableSession] =
    useState<RecoverableSession | null>(null);
  const [checking, setChecking] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const mountedRef = useRef(true);
  const navigation = useNavigation<any>();

  // ── Core check function ─────────────────────────────────────────────
  const checkRecovery = useCallback(async () => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) return;

    setChecking(true);
    try {
      const session = await recoverActiveSession(uid);
      if (mountedRef.current) {
        setRecoverableSession(session);
      }
    } catch (err) {
      logger.warn("[useGameRecovery] Recovery check failed:", err);
    } finally {
      if (mountedRef.current) {
        setChecking(false);
      }
    }
  }, []);

  // ── Check on mount ──────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    checkRecovery();
    return () => {
      mountedRef.current = false;
    };
  }, [checkRecovery]);

  // ── Check on foreground return ──────────────────────────────────────
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        const previous = appStateRef.current;
        appStateRef.current = nextAppState;

        if (
          previous.match(/inactive|background/) &&
          nextAppState === "active"
        ) {
          logger.info("[useGameRecovery] Foreground — rechecking recovery");
          checkRecovery();
        }
      },
    );

    return () => subscription.remove();
  }, [checkRecovery]);

  // ── Re-check when the hub screen gains focus ───────────────────────
  // This catches the common case: user finishes a game, taps "Back to Hub",
  // the navigation reset brings the hub into focus.  Even if the mount
  // check ran too early (before AsyncStorage was cleared), this focus
  // check re-validates once the hub is fully on screen.
  useFocusEffect(
    useCallback(() => {
      logger.info("[useGameRecovery] Screen focused — rechecking recovery");
      checkRecovery();
    }, [checkRecovery]),
  );

  // ── Resume navigation ───────────────────────────────────────────────
  const resumeGame = useCallback(() => {
    if (!recoverableSession) return;

    const { bookmark, screenName } = recoverableSession;

    logger.info(
      `[useGameRecovery] Resuming game: screen=${screenName}, ` +
        `inviteId=${bookmark.inviteId}, gameType=${bookmark.gameType}` +
        (bookmark.v3SessionId ? `, v3SessionId=${bookmark.v3SessionId}` : ""),
    );

    // V3 sessions route through SessionLobbyScreen which handles reconnection
    if (bookmark.v3SessionId) {
      navigation.navigate("SessionLobbyScreen", {
        sessionId: bookmark.v3SessionId,
        source: "recovery" as const,
      });
      return;
    }

    // Legacy path — navigate directly to the game screen
    navigation.navigate(screenName, {
      inviteId: bookmark.inviteId,
      matchId: bookmark.firestoreGameId,
      gameType: bookmark.gameType,
      conversationId: bookmark.conversationId,
      fromRecovery: true,
    });
  }, [recoverableSession, navigation]);

  // ── Dismiss ─────────────────────────────────────────────────────────
  const dismissRecovery = useCallback(async () => {
    setRecoverableSession(null);
    await clearActiveSession();
    logger.info("[useGameRecovery] User dismissed recovery banner");
  }, []);

  return {
    recoverableSession,
    checking,
    resumeGame,
    dismissRecovery,
  };
}
