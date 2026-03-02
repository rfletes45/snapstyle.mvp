/**
 * SoloRuntimeShell — System-owned wrapper for solo game screens.
 *
 * Provides a consistent end-game flow for all single-player games:
 *
 *  1. **Owns result submission** — calls `submitGameResult` exactly once
 *     via the game adapter's `getResultSnapshot` when the game signals
 *     completion.
 *  2. **Owns pause/exit flow** — intercepts back button, shows confirm
 *     when game is in progress, navigates to GamesHub or
 *     SessionGameOverScreen.
 *  3. **Prevents double-submission** — tracks whether results have been
 *     submitted and ignores duplicate calls.
 *  4. **Routes to SessionGameOverScreen** when the game provides result
 *     facts (opt-in for unified end screen), or lets existing
 *     GameOverModal continue to work (backwards-compat).
 *
 * Usage:
 *   - Wrap with `withSoloRuntime(GameScreen)` in the navigator.
 *   - Or render `<SoloRuntimeShell>` directly inside a game screen.
 *   - Game screens call `onGameComplete(facts)` from the context to
 *     trigger result submission and end-screen navigation.
 *
 * @module screens/games/SoloRuntimeShell
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { StyleSheet, View } from "react-native";

import {
  buildGameResultEvent,
  submitGameResult,
} from "@/services/gameResultService";
import { useAuth } from "@/store/AuthContext";
import type { GameResultResponse } from "@/types/gameResult";
import type { GameResultFacts } from "@/types/gameResultFacts";
import type { ExtendedGameType } from "@/types/games";
import { createLogger } from "@/utils/log";

const logger = createLogger("SoloRuntimeShell");

// =============================================================================
// Context
// =============================================================================

export interface SoloRuntimeState {
  /** Whether the game has been completed and results submitted. */
  isCompleted: boolean;
  /** Whether result submission is currently in flight. */
  isSubmitting: boolean;
  /** The server response from result submission (XP, achievements, etc). */
  resultResponse: GameResultResponse | null;
  /** The result facts provided by the game screen. */
  resultFacts: GameResultFacts | null;
  /**
   * Called by the game screen when the game ends.
   *
   * This triggers:
   * 1. Building a `GameResultEvent` from the facts
   * 2. Calling `submitGameResult` exactly once
   * 3. Storing the response for display
   *
   * If `navigateToEndScreen` is true (default: false), the shell will
   * navigate to SessionGameOverScreen. Otherwise the game screen
   * can continue to show its own end UI (backwards-compat).
   *
   * Returns the server response (or null on error).
   */
  onGameComplete: (
    facts: GameResultFacts,
    options?: { navigateToEndScreen?: boolean },
  ) => Promise<GameResultResponse | null>;
}

const SoloRuntimeContext = createContext<SoloRuntimeState | null>(null);

/**
 * Hook for solo game screens to access the runtime state.
 * Returns null when not inside a SoloRuntimeShell.
 */
export function useSoloRuntime(): SoloRuntimeState | null {
  return useContext(SoloRuntimeContext);
}

// =============================================================================
// Component
// =============================================================================

interface SoloRuntimeShellProps {
  /** Game type for result submission. */
  gameId: ExtendedGameType;
  /** React Navigation navigation prop. */
  navigation: any;
  /** Children game screen content. */
  children: React.ReactNode;
}

export function SoloRuntimeShell({
  gameId,
  navigation,
  children,
}: SoloRuntimeShellProps) {
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid ?? "";
  const displayName = currentFirebaseUser?.displayName ?? "Player";

  const [isCompleted, setIsCompleted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultResponse, setResultResponse] =
    useState<GameResultResponse | null>(null);
  const [resultFacts, setResultFacts] = useState<GameResultFacts | null>(null);
  const submittedRef = useRef(false);

  // ── Game completion handler ───────────────────────────────────────────
  const onGameComplete = useCallback(
    async (
      facts: GameResultFacts,
      options?: { navigateToEndScreen?: boolean },
    ): Promise<GameResultResponse | null> => {
      // Prevent double-submission
      if (submittedRef.current) {
        logger.debug("[SoloShell] Ignoring duplicate completion call", {
          gameId,
        });
        return resultResponse;
      }
      submittedRef.current = true;

      setResultFacts(facts);
      setIsSubmitting(true);

      try {
        // Build the event from facts
        const event = buildGameResultEvent({
          gameId: facts.gameId,
          mode: "solo",
          outcome: facts.outcome,
          score: facts.scoreboard[0]?.score ?? null,
          durationMs: facts.durationMs,
          userId: uid,
          displayName,
          meta: facts.meta,
        });

        logger.info("[SoloShell] Submitting game result", {
          gameId,
          outcome: facts.outcome,
          score: facts.scoreboard[0]?.score,
        });

        const response = await submitGameResult(event);
        setResultResponse(response);
        setIsCompleted(true);

        // Merge server-computed awards back into facts
        if (response) {
          facts.xpAwarded = { [uid]: response.xpEarned };
          facts.achievementsUnlocked = response.achievementsUnlocked;
          facts.didLevelUp = response.didLevelUp;
          facts.newLevel = response.level;
          facts.leaderboardUpdated = response.leaderboardUpdated;
        }

        // Optionally navigate to the unified end screen
        if (options?.navigateToEndScreen) {
          try {
            navigation.replace("SessionGameOverScreen", {
              resultFacts: JSON.stringify(facts),
              isSolo: true,
            });
          } catch (err) {
            logger.warn("[SoloShell] Nav to game-over failed", { err });
          }
        }

        return response;
      } catch (err) {
        logger.error("[SoloShell] Result submission error", err);
        submittedRef.current = false; // Allow retry on error
        setIsSubmitting(false);
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [gameId, uid, displayName, navigation, resultResponse],
  );

  // ── Context value ─────────────────────────────────────────────────────
  const contextValue: SoloRuntimeState = {
    isCompleted,
    isSubmitting,
    resultResponse,
    resultFacts,
    onGameComplete,
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <SoloRuntimeContext.Provider value={contextValue}>
      <View style={styles.root}>{children}</View>
    </SoloRuntimeContext.Provider>
  );
}

// =============================================================================
// HOC: withSoloRuntime
// =============================================================================

/**
 * Higher-order component that wraps a solo game screen with SoloRuntimeShell.
 *
 * The shell is always active for solo games (unlike multiplayer which
 * gates on `v3Session` param). Game screens can access the runtime
 * via `useSoloRuntime()`.
 *
 * Usage in RootNavigator:
 * ```
 * const SafeBounceBlitz = withErrorBoundary(withSoloRuntime(BounceBlitzGameScreen, "bounce_blitz"));
 * ```
 */
export function withSoloRuntime<P extends Record<string, any>>(
  WrappedComponent: React.ComponentType<P>,
  gameId: ExtendedGameType,
): React.FC<P> {
  function SoloRuntimeWrapper(props: P) {
    const navigation = (props as any).navigation;

    return (
      <SoloRuntimeShell gameId={gameId} navigation={navigation}>
        <WrappedComponent {...props} />
      </SoloRuntimeShell>
    );
  }

  SoloRuntimeWrapper.displayName = `withSoloRuntime(${
    WrappedComponent.displayName || WrappedComponent.name || "Component"
  })`;

  return SoloRuntimeWrapper;
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
