/**
 * Games V4 — Game Screen Shell (Runtime HOC)
 *
 * Wraps individual game screen components to provide:
 * - Live session, public state, and result subscriptions
 * - Adapter-driven local move validation (optimistic)
 * - submitMove() / resign() action dispatch
 * - Terminal detection + auto-navigation to GameOverV4
 * - Runtime-aware header and overlay controls
 * - Back-handler: non-destructive for turn-based AND solo, destructive for realtime
 * - Game Presence lifecycle
 *
 * Exit model by runtimeType:
 *   turnBased — back arrow (top-left) + resign (top-right) in header row, non-destructive leave
 *   solo      — overlay back arrow (top-left) + overlay menu button (top-right)
 *               back arrow waits for suspend, then exits without resigning
 *               menu contains: Restart, Resign
 *   realtime  — resign/quit button (top-right), destructive exit required
 *
 * Usage:
 *   import { withGameV4Shell } from "@/gamesV4/components/GameScreenShell";
 *   export default withGameV4Shell(MyGameUI, "tic_tac_toe");
 *
 * The wrapped component receives GameShellProps:
 *   { publicState, isMyTurn, submitMove, resign, isTerminal, myUid, onSoloPause, ... }
 *
 * @module gamesV4/components/GameScreenShell
 */

import { getAdapter } from "@/gamesV4/adapters";
import {
  GAME_METADATA,
  getGameLifecyclePolicy,
  isPersistentSoloGame,
} from "@/gamesV4/constants";
import { useGameSessionV4 } from "@/gamesV4/hooks/useGameSessionV4";
import {
  archiveSoloSession,
  restartSoloSession,
  suspendSoloSession,
} from "@/gamesV4/services/gameServiceV4";
import type { GameId, GameRuntimeType } from "@/gamesV4/types/common";
import { startTrace } from "@/gamesV4/utils/perfTrace";
import { getFirestoreInstance } from "@/services/firebase";
import { markGameNotificationsRead } from "@/services/userNotifications";
import { useAuth } from "@/store/AuthContext";
import { useInAppNotifications } from "@/store/InAppNotificationsContext";
import { useAppTheme } from "@/store/ThemeContext";
import type { MainStackParamList } from "@/types/navigation/root";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

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
  /** Player slot metadata (display names, avatars, etc.). */
  players: Array<{
    uid: string;
    displayName?: string;
    profilePictureUrl?: string | null;
  }>;
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
  /**
   * Solo-only: register a pause callback that the shell will invoke
   * just before suspending and navigating away. Games with running
   * animation loops (e.g. Brick Breaker) should call this in a useEffect
   * to register their local pause function. E.g.:
   *
   *   useEffect(() => {
   *     registerSoloPause?.(() => setPaused(true));
   *   }, [registerSoloPause]);
   *
   * When the player taps the back arrow, the shell calls the registered
   * callback, waits for suspend to succeed, then navigates away.
   */
  registerSoloPause?: (pauseFn: () => void) => void;
  /**
   * Solo-only: register a resume callback the shell invokes when the
   * player taps "Resume" in the options menu. Clears pause state and
   * restarts the game loop.
   */
  registerSoloResume?: (resumeFn: () => void) => void;
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
    const { setActiveGameRuntimeType, setCurrentGameSessionId } =
      useInAppNotifications();
    const insets = useSafeAreaInsets();
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
      isTerminal,
      isMyTurn,
      submitMove: hookSubmitMove,
      resign: hookResign,
      actionLoading,
      actionError,
    } = sessionHook;

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

    // ── Sync guard: session and publicState are subscribed separately, so
    // they can briefly disagree on whose turn it is.  When they diverge,
    // clamp isMyTurn to false until they reconcile.  This prevents the UI
    // from allowing a move based on stale session data while the state
    // snapshot is still in-flight.
    const pubTurnUid = ((publicState as Record<string, unknown> | null)
      ?.currentTurnUid ??
      (publicState as Record<string, unknown> | null)?.currentTurnPlayerId) as
      | string
      | undefined;
    const sessionTurnUid = session?.currentTurnPlayerId as string | undefined;
    const isSynced =
      !pubTurnUid || !sessionTurnUid || pubTurnUid === sessionTurnUid;
    const effectiveIsMyTurn = optimisticTurnAdvanced
      ? false
      : isSynced
        ? isMyTurn
        : false;

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
        const trace = startTrace("move_optimistic");
        const stateForValidation = effectivePublicState;

        // Optimistic local validation.
        // NOTE: The shell passes {} for privateStateByPlayer because it
        // does not have access to per-player private state.  For hidden-info
        // games (like Crazy 8's) the adapter will reject locally because
        // it cannot find the player's hand.  In that case we still submit
        // to the server — the server reads real private state inside its
        // Firestore transaction and is the authoritative validator.
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
            if (__DEV__) {
              console.log(
                `[gamesV4][DEBUG] submitMove local validated OK: action=${(movePayload as Record<string, unknown>).action}, turnAdvance=${localResult.turnAdvance}, nextTurnPlayerId=${localResult.nextTurnPlayerId}, nextPhase=${(localResult.nextPublicState as Record<string, unknown> | undefined)?.phase}, nextMoveCount=${(localResult.nextPublicState as Record<string, unknown> | undefined)?.moveCount}`,
              );
            }

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
        trace.mark("server_submit_fired");
        hookSubmitMove(movePayload).catch((err) => {
          console.warn(
            "[gamesV4] Server rejected move, reverting optimistic state:",
            err,
          );
          clearOptimistic();
        });
        trace.mark("local_done");
        trace.end();
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

    // ── Runtime type derivation ────────────────────────────────────
    // Derive from session first, fall back to GAME_METADATA.
    const runtimeType: GameRuntimeType =
      session?.runtimeType ?? GAME_METADATA[gameId]?.runtimeType ?? "turnBased";

    // ── Notification gating: inform the notification system about the
    // active game's runtime type so achievement banners can be allowed
    // during solo/turn-based games while suppressed during realtime.
    useEffect(() => {
      setActiveGameRuntimeType(runtimeType);
      return () => setActiveGameRuntimeType(null);
    }, [runtimeType, setActiveGameRuntimeType]);

    useEffect(() => {
      setCurrentGameSessionId(sessionId);
      return () => setCurrentGameSessionId(null);
    }, [sessionId, setCurrentGameSessionId]);

    useEffect(() => {
      if (!uid || !sessionId) return;
      markGameNotificationsRead(uid, { sessionId }).catch((error) => {
        console.warn(
          "[gamesV4] Failed to mark session notifications read:",
          error,
        );
      });
    }, [uid, sessionId]);

    // Exit behavior invariants:
    //   turnBased  → back arrow (left) + resign button (right) in header
    //   solo       → overlay back arrow (left) + overlay menu button (right)
    //               back arrow waits for suspend, then exits without resigning
    //   realtime   → resign/quit button (top-right) only
    //
    // Persistent solo overrides:
    //   - No resign action ever (allowResign = false)
    //   - No auto-navigate to Game Over on suspend
    //   - Menu shows: Return to Hub, Restart Run, Archive Run (no Resign)
    const lifecyclePolicy = getGameLifecyclePolicy(gameId);
    const isPersistent = isPersistentSoloGame(gameId);

    const showBackArrow =
      (runtimeType === "turnBased" || runtimeType === "solo") && !isTerminal;
    const showResignAction =
      !isTerminal && runtimeType !== "solo" && !isPersistent; // solo uses menu; persistent never shows resign

    // Solo menu state
    const [soloMenuVisible, setSoloMenuVisible] = useState(false);
    const [soloSuspendLoading, setSoloSuspendLoading] = useState(false);
    const soloOnPauseRef = useRef<(() => void) | undefined>(undefined);
    const soloOnResumeRef = useRef<(() => void) | undefined>(undefined);

    const resumeSoloGameplay = useCallback(() => {
      soloOnResumeRef.current?.();
    }, []);

    const closeSoloMenuAndResume = useCallback(() => {
      resumeSoloGameplay();
      setSoloMenuVisible(false);
    }, [resumeSoloGameplay]);

    // ── Non-destructive leave (turn-based) ──────────────────────────
    const handleNonDestructiveLeave = useCallback(() => {
      // Simply navigate away — presence cleanup happens via useEffect unmount.
      // Session stays active; user can rejoin via invite chip, deep link, or notification.
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    }, [navigation]);

    // ── Solo suspend & leave (non-destructive) ──────────────────────
    const handleSoloSuspendAndLeave = useCallback(async () => {
      if (soloSuspendLoading) return;

      setSoloMenuVisible(false);

      // 1. Call the game's pause callback (freezes animation loops)
      if (soloOnPauseRef.current) {
        soloOnPauseRef.current();
      }

      // 2. Mark session as suspended server-side before leaving.
      setSoloSuspendLoading(true);
      try {
        await suspendSoloSession({ sessionId });
      } catch (err) {
        setSoloSuspendLoading(false);
        resumeSoloGameplay();
        const msg =
          err instanceof Error ? err.message : "Could not save your game.";
        Alert.alert("Couldn't Save Game", msg);
        return;
      }

      setSoloSuspendLoading(false);

      // 3. Navigate away
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    }, [sessionId, navigation, soloSuspendLoading, resumeSoloGameplay]);

    // ── Resign with confirmation ────────────────────────────────────
    // Persistent solo games never expose resign. Guard here just in case.
    const handleResign = useCallback(() => {
      if (isPersistent) return; // should never be called, but safety guard

      const title = runtimeType === "solo" ? "Resign Game" : "Resign Game";
      const message =
        runtimeType === "solo"
          ? "Are you sure you want to resign? This will end your current run."
          : "Are you sure you want to resign? This will end the game.";

      Alert.alert(title, message, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Resign",
          style: "destructive",
          onPress: () => {
            setSoloMenuVisible(false);
            hookResign().catch(() => {
              resumeSoloGameplay();
            });
          },
        },
      ]);
    }, [hookResign, runtimeType, isPersistent, resumeSoloGameplay]);

    // ── Solo restart ────────────────────────────────────────────────
    const handleSoloRestart = useCallback(() => {
      const title = isPersistent ? "Restart Run" : "Restart Game";
      const message = isPersistent
        ? "Are you sure? Your current run will be archived and a fresh run will start."
        : "Are you sure? Your current run will be discarded.";

      Alert.alert(title, message, [
        { text: "Cancel", style: "cancel" },
        {
          text: isPersistent ? "Restart Run" : "Restart",
          style: "destructive",
          onPress: async () => {
            setSoloMenuVisible(false);
            try {
              const { sessionId: newSessionId } = await restartSoloSession({
                sessionId,
              });
              // Replace the current screen with the new session
              navigation.replace("GamePlayV4", {
                sessionId: newSessionId,
                gameId,
              });
            } catch (err) {
              resumeSoloGameplay();
              const msg =
                err instanceof Error ? err.message : "Could not restart game.";
              Alert.alert("Error", msg);
            }
          },
        },
      ]);
    }, [sessionId, gameId, navigation, isPersistent, resumeSoloGameplay]);

    // ── Persistent solo: archive run ────────────────────────────────
    const handleArchiveRun = useCallback(() => {
      if (!isPersistent) return;

      Alert.alert(
        "Archive Run",
        "This will finalize your current run, calculate your final score, and unlock any end-of-run rewards. You can start a fresh run afterwards.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Archive Run",
            style: "default",
            onPress: async () => {
              setSoloMenuVisible(false);
              try {
                await archiveSoloSession({ sessionId });
                // Navigate to Game Over to show the final summary
                navigation.replace("GameOverV4", { sessionId });
              } catch (err) {
                resumeSoloGameplay();
                const msg =
                  err instanceof Error ? err.message : "Could not archive run.";
                Alert.alert("Error", msg);
              }
            },
          },
        ],
      );
    }, [isPersistent, sessionId, navigation, resumeSoloGameplay]);

    // ── Back handler (runtime-aware) ────────────────────────────────
    useEffect(() => {
      const handler = BackHandler.addEventListener("hardwareBackPress", () => {
        if (isTerminal) return false; // allow default back after game ends

        if (runtimeType === "solo") {
          // Solo: non-destructive suspend & leave
          void handleSoloSuspendAndLeave();
          return true;
        }

        if (runtimeType === "turnBased") {
          // Turn-based: non-destructive leave — just go back
          handleNonDestructiveLeave();
          return true;
        }

        // Realtime: destructive exit confirmation required
        Alert.alert("Leave Game?", "Leaving will resign the game.", [
          { text: "Stay", style: "cancel" },
          {
            text: "Leave & Resign",
            style: "destructive",
                onPress: async () => {
              // Await resign so the session is resolved server-side before
              // we tear down snapshot listeners via navigation. This prevents
              // the "Missing Firebase permissions" error that occurred when
              // listeners fired during the mid-resolution window.
              try {
                await hookResign();
              } catch {
                // Resign already sets actionError internally; swallow here.
              }
              navigation.goBack();
            },
          },
        ]);
        return true; // prevent default back
      });
      return () => handler.remove();
    }, [
      isTerminal,
      runtimeType,
      hookResign,
      navigation,
      handleNonDestructiveLeave,
      handleSoloSuspendAndLeave,
    ]);

    // ── Auto-navigate to GameOverV4 on terminal ─────────────────────
    // Navigate as soon as terminal is detected — don't wait for result doc.
    // GameOverScreenV4 handles its own loading state if results are delayed.
    //
    // EXCEPTION: Persistent solo games do NOT auto-navigate to Game Over
    // when the session becomes terminal due to archive. The archive handler
    // explicitly navigates to GameOverV4 after the callable completes.
    // This prevents unexpected navigation during normal suspend/resume.
    useEffect(() => {
      if (isTerminal && !hasNavigatedToResult.current && !isPersistent) {
        hasNavigatedToResult.current = true;
        // PERF: Reduced delay from 1500ms to 600ms. The terminal state
        // renders a brief "game ending" visual, then navigates quickly.
        // Result doc is loaded async by GameOverScreenV4.
        const timer = setTimeout(() => {
          navigation.replace("GameOverV4", { sessionId });
        }, 600);
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
      players: session.players ?? [],
      submitMove,
      resign: handleResign,
      actionLoading,
      actionError,
      sessionId,
      registerSoloPause:
        runtimeType === "solo"
          ? (pauseFn: () => void) => {
              soloOnPauseRef.current = pauseFn;
            }
          : undefined,
      registerSoloResume:
        runtimeType === "solo"
          ? (resumeFn: () => void) => {
              soloOnResumeRef.current = resumeFn;
            }
          : undefined,
    };

    // For solo: overlay header with back arrow + menu. No layout shift.
    // For realtime: overlay resign button (right only).
    // For turn-based: normal-flow header row.
    const isSolo = runtimeType === "solo";
    const isRealtime = runtimeType === "realtime";
    const useOverlayHeader = isSolo || isRealtime;

    // Derive the game-surface background. For solo/realtime the entire
    // screen should be one continuous color with no strip at the top.
    const gameBg = theme.isDark ? "#000" : theme.colors.background;

    // ── Solo / Realtime: full-bleed layout (no SafeAreaView padding) ──
    // The game component fills the whole screen; overlay controls are
    // absolutely positioned with safe-area offsets applied via style.
    if (useOverlayHeader) {
      return (
        <View style={[styles.container, { backgroundColor: gameBg }]}>
          {/* Game fills entire screen */}
          <GameComponent {...(props as unknown as P)} {...shellProps} />

          {/* ── Solo: overlay back arrow (top-left) + menu button (top-right) ── */}
          {isSolo && !isTerminal && (
            <View
              style={[styles.soloOverlayHeader, { paddingTop: insets.top + 8 }]}
              pointerEvents="box-none"
            >
              <TouchableOpacity
                style={styles.soloOverlayBtn}
                onPress={() => {
                  void handleSoloSuspendAndLeave();
                }}
                disabled={soloSuspendLoading}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={Platform.OS === "ios" ? "chevron-back" : "arrow-back"}
                  size={22}
                  color="#FFF"
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.soloOverlayBtn}
                onPress={() => {
                  if (soloOnPauseRef.current) soloOnPauseRef.current();
                  setSoloMenuVisible(true);
                }}
                disabled={soloSuspendLoading}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="ellipsis-vertical" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}

          {/* ── Realtime: floating resign button overlay (right only) ── */}
          {isRealtime && !isTerminal && (
            <View
              style={[styles.overlayHeader, { paddingTop: insets.top + 8 }]}
              pointerEvents="box-none"
            >
              <TouchableOpacity
                style={[styles.resignBtn, styles.overlayResignBtn]}
                onPress={handleResign}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <MaterialCommunityIcons
                  name="flag-outline"
                  size={16}
                  color="#FFF"
                />
                <Text style={styles.resignBtnText}>Resign</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Solo menu modal ── */}
          <Modal
            visible={soloMenuVisible}
            transparent
            animationType="fade"
            onRequestClose={closeSoloMenuAndResume}
          >
            <Pressable
              style={styles.soloMenuOverlay}
              onPress={closeSoloMenuAndResume}
            >
              <View
                style={[
                  styles.soloMenuContent,
                  {
                    backgroundColor: theme.isDark ? "#222" : "#FFF",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.soloMenuTitle,
                    { color: theme.isDark ? "#FFF" : "#333" },
                  ]}
                >
                  {isPersistent ? "Session Menu" : "Game Menu"}
                </Text>

                {/* Restart — shown for all solo games */}
                {lifecyclePolicy.allowRestart && (
                  <TouchableOpacity
                    style={[
                      styles.soloMenuItem,
                      { backgroundColor: theme.colors.primary },
                    ]}
                    onPress={handleSoloRestart}
                  >
                    <Ionicons name="refresh" size={18} color="#FFF" />
                    <Text style={styles.soloMenuItemText}>
                      {isPersistent ? "Restart Run" : "Restart Game"}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Archive Run — persistent solo only */}
                {isPersistent && (
                  <TouchableOpacity
                    style={[
                      styles.soloMenuItem,
                      { backgroundColor: "#FF9500" },
                    ]}
                    onPress={handleArchiveRun}
                  >
                    <MaterialCommunityIcons
                      name="archive-outline"
                      size={18}
                      color="#FFF"
                    />
                    <Text style={styles.soloMenuItemText}>Archive Run</Text>
                  </TouchableOpacity>
                )}

                {/* Resign — standard solo only (NEVER shown for persistent) */}
                {!isPersistent && (
                  <TouchableOpacity
                    style={[
                      styles.soloMenuItem,
                      { backgroundColor: "#FF3B30" },
                    ]}
                    onPress={handleResign}
                  >
                    <MaterialCommunityIcons
                      name="flag-outline"
                      size={18}
                      color="#FFF"
                    />
                    <Text style={styles.soloMenuItemText}>Resign</Text>
                  </TouchableOpacity>
                )}

                {/* Return to Hub — persistent solo gets friendlier label */}
                {isPersistent && (
                  <TouchableOpacity
                    style={[
                      styles.soloMenuItem,
                      {
                        backgroundColor: theme.isDark ? "#444" : "#E0E0E0",
                      },
                    ]}
                    onPress={() => {
                      void handleSoloSuspendAndLeave();
                    }}
                  >
                    <Ionicons
                      name="arrow-back"
                      size={18}
                      color={theme.isDark ? "#FFF" : "#333"}
                    />
                    <Text
                      style={[
                        styles.soloMenuItemText,
                        { color: theme.isDark ? "#FFF" : "#333" },
                      ]}
                    >
                      Save & Return to Hub
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Resume — close menu and continue playing */}
                <TouchableOpacity
                  style={[
                    styles.soloMenuItem,
                    {
                      backgroundColor: theme.isDark ? "#444" : "#E0E0E0",
                    },
                  ]}
                  onPress={closeSoloMenuAndResume}
                >
                  <Text
                    style={[
                      styles.soloMenuItemText,
                      { color: theme.isDark ? "#FFF" : "#333" },
                    ]}
                  >
                    Resume
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Modal>
        </View>
      );
    }

    // ── Turn-based: SafeAreaView with normal-flow header ──
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        {!isTerminal && (
          <View style={styles.shellHeader}>
            {/* Left: back arrow */}
            {showBackArrow ? (
              <TouchableOpacity
                style={styles.headerBtn}
                onPress={handleNonDestructiveLeave}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={Platform.OS === "ios" ? "chevron-back" : "arrow-back"}
                  size={24}
                  color={theme.isDark ? "#FFF" : "#333"}
                />
              </TouchableOpacity>
            ) : (
              <View style={styles.headerBtn} />
            )}

            {/* Right: resign */}
            {showResignAction ? (
              <TouchableOpacity
                style={[styles.resignBtn, { backgroundColor: "#FF3B30" }]}
                onPress={handleResign}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <MaterialCommunityIcons
                  name="flag-outline"
                  size={16}
                  color="#FFF"
                />
                <Text style={styles.resignBtnText}>Resign</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.headerBtn} />
            )}
          </View>
        )}

        {/* Wrapped game component */}
        <GameComponent {...(props as unknown as P)} {...shellProps} />
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
  // ── Turn-based: normal-flow header ──────────────────────────────
  shellHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 44,
  },
  headerBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  resignBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  resignBtnText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "700",
  },
  // ── Overlay header for realtime (resign button only, right-aligned) ──
  overlayHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 8,
    zIndex: 100,
  },
  overlayResignBtn: {
    backgroundColor: "rgba(255, 59, 48, 0.88)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  // ── Solo overlay header (back arrow left, menu right) ───────────
  soloOverlayHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 8,
    zIndex: 100,
  },
  soloOverlayBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  // ── Solo menu modal ─────────────────────────────────────────────
  soloMenuOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  soloMenuContent: {
    width: 260,
    borderRadius: 16,
    padding: 20,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  soloMenuTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 4,
  },
  soloMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  soloMenuItemText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "600",
  },
});
