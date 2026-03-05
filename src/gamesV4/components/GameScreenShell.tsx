/**
 * Games V4 — Game Screen Shell (Runtime HOC)
 *
 * Wraps individual game screen components to provide:
 * - Live session, public state, and result subscriptions
 * - Adapter-driven local move validation (optimistic)
 * - submitMove() / resign() action dispatch
 * - Terminal detection + auto-navigation to GameOverV4
 * - Resign FAB + confirmation modal
 * - Back-handler suppression during active game
 *
 * Usage:
 *   import { withGameV4Shell } from "@/gamesV4/components/GameScreenShell";
 *   export default withGameV4Shell(MyGameUI, "tic_tac_toe");
 *
 * The wrapped component receives GameShellProps:
 *   { publicState, isMyTurn, submitMove, resign, isTerminal, myUid, ... }
 *
 * @module gamesV4/components/GameScreenShell
 */

import { getAdapter } from "@/gamesV4/adapters/registry";
import { useGameSessionV4 } from "@/gamesV4/hooks/useGameSessionV4";
import type { GameId } from "@/gamesV4/types/common";
import { getFirestoreInstance } from "@/services/firebase";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import type { MainStackParamList } from "@/types/navigation/root";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Nav = NativeStackNavigationProp<MainStackParamList>;

// =============================================================================
// Props interface for wrapped game components
// =============================================================================

export interface GameShellProps {
  /** Current public state from Firestore (live). */
  publicState: Record<string, unknown> | null;
  /** Whether it's the current user's turn. */
  isMyTurn: boolean;
  /** Whether the game has ended (terminal state). */
  isTerminal: boolean;
  /** Current user's UID. */
  myUid: string;
  /** All participant UIDs in turn order. */
  turnOrder: string[];
  /** Current turn player index. */
  currentTurnIndex: number;
  /** Current game settings. */
  settings: Record<string, unknown>;
  /** Submit a move. Returns true if accepted by local adapter validation. */
  submitMove: (movePayload: Record<string, unknown>) => Promise<boolean>;
  /** Resign from the game. */
  resign: () => void;
  /** Whether an action is in progress. */
  actionLoading: boolean;
  /** Last action error. */
  actionError: string | null;
  /** Session ID. */
  sessionId: string;
}

// =============================================================================
// HOC
// =============================================================================

/**
 * Higher-order component that wraps a game UI with V4 session management.
 *
 * The wrapped component must accept GameShellProps.
 */
export function withGameV4Shell<P extends GameShellProps>(
  GameComponent: React.ComponentType<P>,
  gameId: GameId,
) {
  function GameScreenShell(props: Omit<P, keyof GameShellProps>) {
    const { theme } = useAppTheme();
    const { currentFirebaseUser } = useAuth();
    const navigation = useNavigation<Nav>();
    const route = useRoute<{
      key: string;
      name: string;
      params: { sessionId: string };
    }>();

    const { sessionId } = route.params;
    const uid = currentFirebaseUser?.uid ?? "";

    const sessionHook = useGameSessionV4(sessionId);
    const {
      session,
      publicState,
      result,
      isTerminal,
      isMyTurn,
      submitMove: hookSubmitMove,
      resign: hookResign,
      actionLoading,
      actionError,
    } = sessionHook;

    const [resignVisible, setResignVisible] = useState(false);
    const hasNavigatedToResult = useRef(false);

    // ── Optimistic state overlay ────────────────────────────────────
    // When the player makes a move, we apply the adapter's nextPublicState
    // locally so the board updates instantly without waiting for the
    // Cloud Function → Firestore → onSnapshot round-trip (~500-1500 ms).
    const [optimisticState, setOptimisticState] = useState<Record<
      string,
      unknown
    > | null>(null);
    const [optimisticTurnAdvanced, setOptimisticTurnAdvanced] = useState(false);

    // Clear optimistic state once Firestore delivers the authoritative update.
    // We detect this by comparing a version/ply counter so we don't clear on
    // stale snapshots.
    const optimisticVersionRef = useRef<number | null>(null);
    const optimisticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );

    // Helper: clear all optimistic state
    const clearOptimistic = useCallback(() => {
      setOptimisticState(null);
      setOptimisticTurnAdvanced(false);
      optimisticVersionRef.current = null;
      if (optimisticTimerRef.current) {
        clearTimeout(optimisticTimerRef.current);
        optimisticTimerRef.current = null;
      }
    }, []);

    // Clear optimistic state once Firestore delivers the authoritative update.
    // We detect this by comparing a version/ply counter so we don't clear on
    // stale snapshots.
    useEffect(() => {
      if (!publicState || optimisticVersionRef.current === null) return;
      const serverPly =
        (publicState as Record<string, unknown>).plyCount ??
        (publicState as Record<string, unknown>).moveCount ??
        (publicState as Record<string, unknown>).turnNumber ??
        null;
      if (
        serverPly !== null &&
        typeof serverPly === "number" &&
        serverPly >= optimisticVersionRef.current
      ) {
        // Server has caught up — discard optimistic overlay
        clearOptimistic();
      }
    }, [publicState, clearOptimistic]);

    // Safety: also clear optimistic turn when the session's turn tracking
    // updates (belt-and-suspenders for the version check above).
    useEffect(() => {
      if (optimisticTurnAdvanced && isMyTurn !== undefined) {
        // Session snapshot arrived — its turnPlayerId is authoritative.
        // The optimistic turn-off is no longer needed.
        setOptimisticTurnAdvanced(false);
      }
      // Only trigger when the real isMyTurn value changes from a session
      // snapshot, NOT when optimisticTurnAdvanced changes (avoid loop).
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMyTurn]);

    // Derive effective public state and turn flag for the game component
    const effectivePublicState = optimisticState ?? publicState;
    const effectiveIsMyTurn = optimisticTurnAdvanced ? false : isMyTurn;

    // DEBUG: Log turn state on every render
    useEffect(() => {
      const pubPhase = (publicState as Record<string, unknown> | null)?.phase;
      const pubTurnUid = (publicState as Record<string, unknown> | null)
        ?.currentTurnUid;
      const pubMoveCount = (publicState as Record<string, unknown> | null)
        ?.moveCount;
      console.log(
        `[gamesV4][DEBUG] GameScreenShell: uid=${uid}, isMyTurn(hook)=${isMyTurn}, optimisticTurnAdvanced=${optimisticTurnAdvanced}, effectiveIsMyTurn=${effectiveIsMyTurn}, hasOptimisticState=${!!optimisticState}, session.currentTurnPlayerId=${session?.currentTurnPlayerId}, session.currentTurnIndex=${session?.currentTurnIndex}, pubPhase=${pubPhase}, pubTurnUid=${pubTurnUid}, pubMoveCount=${pubMoveCount}`,
      );
    }, [
      isMyTurn,
      optimisticTurnAdvanced,
      effectiveIsMyTurn,
      optimisticState,
      session?.currentTurnPlayerId,
      session?.currentTurnIndex,
      publicState,
      uid,
    ]);

    // ── Game Presence: Write presence doc for notification gating ────
    useEffect(() => {
      if (!uid || !sessionId) return;
      const db = getFirestoreInstance();
      const presenceRef = doc(db, "Users", uid, "GamePresence", sessionId);
      setDoc(presenceRef, {
        uid,
        sessionId,
        gameId,
        activeAt: serverTimestamp(),
      }).catch((err) =>
        console.warn("[gamesV4] Failed to write presence:", err),
      );
      return () => {
        deleteDoc(presenceRef).catch((err) =>
          console.warn("[gamesV4] Failed to remove presence:", err),
        );
      };
    }, [uid, sessionId]);

    // ── Adapter for local validation ────────────────────────────────
    const adapter = getAdapter(gameId);

    // ── Local + server move submission (with optimistic updates) ─────
    const submitMove = useCallback(
      async (movePayload: Record<string, unknown>): Promise<boolean> => {
        const stateForValidation = effectivePublicState;

        // Optimistic local validation.
        // NOTE: The shell passes {} for privateStateByPlayer because it
        // does not have access to per-player private state.  For hidden-info
        // games (like Crazy 8's) the adapter will reject locally because
        // it cannot find the player's hand.  In that case we still submit
        // to the server — the server reads real private state inside its
        // Firestore transaction and is the authoritative validator.
        let localValidationPassed = false;
        if (adapter?.validateMove && stateForValidation && session) {
          const localResult = adapter.validateMove(
            stateForValidation,
            {},
            movePayload,
            {
              uid,
              turnOrder: session.turnOrder,
              currentTurnIndex: session.currentTurnIndex,
              settings: session.settings,
            },
          );
          if (!localResult.ok) {
            // Log but do NOT block — server is authoritative.
            console.warn(
              `[gamesV4] Local validation rejected move (submitting to server anyway): ${localResult.error}`,
            );
          } else {
            localValidationPassed = true;

            console.log(
              `[gamesV4][DEBUG] submitMove local validated OK: action=${(movePayload as Record<string, unknown>).action}, turnAdvance=${localResult.turnAdvance}, nextTurnPlayerId=${localResult.nextTurnPlayerId}, nextPhase=${(localResult.nextPublicState as Record<string, unknown> | undefined)?.phase}, nextMoveCount=${(localResult.nextPublicState as Record<string, unknown> | undefined)?.moveCount}`,
            );

            // Apply optimistic state immediately so the UI updates without
            // waiting for the server round-trip.
            if (localResult.nextPublicState) {
              setOptimisticState(localResult.nextPublicState);
              // Track the expected version so we know when Firestore catches up
              const nextPly =
                (localResult.nextPublicState as Record<string, unknown>)
                  .plyCount ??
                (localResult.nextPublicState as Record<string, unknown>)
                  .moveCount ??
                (localResult.nextPublicState as Record<string, unknown>)
                  .turnNumber ??
                null;
              if (nextPly !== null && typeof nextPly === "number") {
                optimisticVersionRef.current = nextPly;
              }

              // Determine if the turn moves away from this player.
              // turnAdvance=true is the classic signal, but many adapters
              // (like Crazy 8's) return turnAdvance=false with an explicit
              // nextTurnPlayerId.  Both cases should mark the optimistic
              // turn as advanced when the next player is NOT this player.
              const nextPlayerId = localResult.nextTurnPlayerId;
              if (
                localResult.turnAdvance ||
                (nextPlayerId && nextPlayerId !== uid)
              ) {
                setOptimisticTurnAdvanced(true);
              }

              // Safety timeout: auto-clear optimistic state if server hasn't
              // confirmed within 12 s (covers cold-start, network hiccup, or
              // server rejection that didn't propagate via .catch).
              if (optimisticTimerRef.current) {
                clearTimeout(optimisticTimerRef.current);
              }
              optimisticTimerRef.current = setTimeout(() => {
                console.warn(
                  "[gamesV4] Optimistic state timed out — reverting to server state.",
                );
                clearOptimistic();
              }, 12_000);
            }
          }
        }

        // Submit to server in the background — don't await to avoid
        // blocking the UI. Errors revert the optimistic state.
        hookSubmitMove(movePayload).catch((err) => {
          console.warn(
            "[gamesV4] Server rejected move, reverting optimistic state:",
            err,
          );
          clearOptimistic();
        });
        return true;
      },
      [
        adapter,
        effectivePublicState,
        session,
        uid,
        hookSubmitMove,
        clearOptimistic,
      ],
    );

    // ── Resign with confirmation ────────────────────────────────────
    const handleResign = useCallback(() => {
      Alert.alert(
        "Resign Game",
        "Are you sure you want to resign? This will end the game.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Resign",
            style: "destructive",
            onPress: () => hookResign(),
          },
        ],
      );
    }, [hookResign]);

    // ── Back handler suppression ────────────────────────────────────
    useEffect(() => {
      const handler = BackHandler.addEventListener("hardwareBackPress", () => {
        if (!isTerminal) {
          setResignVisible(true);
          Alert.alert("Leave Game?", "Leaving will resign the game.", [
            { text: "Stay", style: "cancel" },
            {
              text: "Leave & Resign",
              style: "destructive",
              onPress: () => {
                hookResign();
                navigation.goBack();
              },
            },
          ]);
          return true; // prevent default back
        }
        return false;
      });
      return () => handler.remove();
    }, [isTerminal, hookResign, navigation]);

    // ── Auto-navigate to GameOverV4 on terminal ─────────────────────
    // Navigate as soon as terminal is detected — don't wait for result doc.
    // GameOverScreenV4 handles its own loading state if results are delayed.
    useEffect(() => {
      if (isTerminal && !hasNavigatedToResult.current) {
        hasNavigatedToResult.current = true;
        // Small delay to let the terminal state render briefly
        const timer = setTimeout(() => {
          navigation.replace("GameOverV4", { sessionId });
        }, 1500);
        return () => clearTimeout(timer);
      }
    }, [isTerminal, sessionId, navigation]);

    // ── Loading state ───────────────────────────────────────────────
    if (!session || !effectivePublicState) {
      return (
        <SafeAreaView
          style={[
            styles.loadingContainer,
            {
              backgroundColor: theme.isDark ? "#000" : theme.colors.background,
            },
          ]}
        >
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text
            style={[
              styles.loadingText,
              { color: theme.isDark ? "#AAA" : "#666" },
            ]}
          >
            Connecting to game...
          </Text>
        </SafeAreaView>
      );
    }

    const shellProps: GameShellProps = {
      publicState: effectivePublicState,
      isMyTurn: effectiveIsMyTurn,
      isTerminal,
      myUid: uid,
      turnOrder: session.turnOrder,
      currentTurnIndex: session.currentTurnIndex,
      settings: session.settings,
      submitMove,
      resign: handleResign,
      actionLoading,
      actionError,
      sessionId,
    };

    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        {/* Wrapped game component */}
        <GameComponent {...(props as unknown as P)} {...shellProps} />

        {/* Resign FAB (visible during active game for multiplayer) */}
        {!isTerminal && session.runtimeType !== "solo" && (
          <TouchableOpacity
            style={[styles.resignFab, { backgroundColor: "#FF3B30" }]}
            onPress={handleResign}
          >
            <MaterialCommunityIcons
              name="flag-outline"
              size={20}
              color="#FFF"
            />
          </TouchableOpacity>
        )}
      </SafeAreaView>
    );
  }

  GameScreenShell.displayName = `GameV4Shell(${
    GameComponent.displayName ?? GameComponent.name ?? gameId
  })`;

  return GameScreenShell;
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  resignFab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
