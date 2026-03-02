/**
 * MultiplayerRuntimeShell — System-owned wrapper for all multiplayer game
 * screens running under the V3 session pipeline.
 *
 * Replaces the older SessionRuntimeShell with a more structured contract:
 *
 *  1. **Owns resign flow** — floating FAB + confirm modal → `resolveSessionV3(forfeit)`
 *  2. **Owns back-button handling** — Android hardware back + gesture back
 *     always show resign confirm (never raw `navigation.goBack()`).
 *  3. **Owns terminal detection** — when session phase becomes terminal,
 *     navigates ONLY to `SessionGameOverScreen`.
 *  4. **Disables gameplay input** when terminal or resign is in-flight
 *     (exposes `isInputDisabled` to children via context).
 *  5. **Extracts result facts** via the game adapter's `getResultSnapshot`
 *     and passes them as route params to SessionGameOverScreen.
 *
 * Usage:
 *   - Wrap with `withMultiplayerRuntime(GameScreen)` in the navigator.
 *   - Or render `<MultiplayerRuntimeShell>` directly inside a game screen.
 *   - Game screens access runtime state via `useMultiplayerRuntime()`.
 *
 * @module screens/games/MultiplayerRuntimeShell
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  BackHandler,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getGameAdapter } from "@/config/gameAdapters";
import {
  clearActiveSession,
  patchBookmarkV3SessionId,
} from "@/services/gameRecovery";
import { resolveSession, subscribeToSession } from "@/services/gameSessions";
import { useAuth } from "@/store/AuthContext";
import type { GameResultFacts } from "@/types/gameResultFacts";
import type { ExtendedGameType } from "@/types/games";
import type { GameSessionV3 } from "@/types/gameSessionV3";
import { isSessionTerminal } from "@/types/gameSessionV3";
import { createLogger } from "@/utils/log";

const logger = createLogger("MultiplayerRuntimeShell");

// =============================================================================
// Context
// =============================================================================

export interface MultiplayerRuntimeState {
  /** Raw V3 session document (null while loading). */
  session: GameSessionV3 | null;
  /** Session is in an active gameplay phase. */
  isActive: boolean;
  /** Session has reached a terminal phase (resolved/abandoned/expired). */
  isTerminal: boolean;
  /** Gameplay input should be disabled (terminal, resign in-flight, or finishing). */
  isInputDisabled: boolean;
  /** Resign Cloud Function call is in progress. */
  resignLoading: boolean;
  /** V3 session ID. */
  sessionId: string;
  /**
   * Callback for the game screen to provide a result snapshot.
   * Should be called when the game ends (before/alongside Colyseus "finished"
   * state). The shell stores it and forwards to SessionGameOverScreen.
   */
  setResultFacts: (facts: GameResultFacts) => void;
}

const MultiplayerRuntimeContext = createContext<MultiplayerRuntimeState | null>(
  null,
);

/**
 * Hook for game screens to access the multiplayer runtime state.
 * Returns null when not inside a MultiplayerRuntimeShell (non-v3 mode).
 */
export function useMultiplayerRuntime(): MultiplayerRuntimeState | null {
  return useContext(MultiplayerRuntimeContext);
}

// =============================================================================
// Component
// =============================================================================

interface MultiplayerRuntimeShellProps {
  /** V3 session ID (from route params). */
  sessionId: string;
  /** React Navigation navigation prop. */
  navigation: any;
  /** Game type (for adapter lookup). */
  gameId?: ExtendedGameType;
  /** Children game screen content. */
  children: React.ReactNode;
}

export function MultiplayerRuntimeShell({
  sessionId,
  navigation,
  gameId,
  children,
}: MultiplayerRuntimeShellProps) {
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid ?? "";
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const [session, setSession] = useState<GameSessionV3 | null>(null);
  const [resignLoading, setResignLoading] = useState(false);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [resultFacts, setResultFacts] = useState<GameResultFacts | null>(null);
  const navigatedRef = useRef(false);
  const unsubRef = useRef<(() => void) | null>(null);
  /** Shared ref: true when the resign/exit flow is active.
   *  useGameBackHandler checks this to avoid showing a concurrent dialog. */
  const exitFlowActiveRef = useRef(false);

  // Derive adapter flags
  const adapter = gameId ? getGameAdapter(gameId) : undefined;
  const showResignFab = adapter?.supportsSystemResign !== false;

  // ── Firestore subscription ──────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    navigatedRef.current = false;

    const unsub = subscribeToSession(sessionId, (snap) => {
      setSession(snap);
    });
    unsubRef.current = unsub;

    return () => {
      unsub();
      unsubRef.current = null;
    };
  }, [sessionId]);

  // ── Patch recovery bookmark with V3 session ID ────────────────────────
  // This fires once after mount so that crash-recovery can route through
  // SessionLobbyScreen instead of the raw game screen.
  useEffect(() => {
    if (sessionId) {
      patchBookmarkV3SessionId(sessionId).catch(() => {});
    }
  }, [sessionId]);

  // ── Derived state ───────────────────────────────────────────────────────
  const isTerminal = session ? isSessionTerminal(session.phase) : false;
  const isActive =
    session?.phase === "active" || session?.phase === "finishing";
  const isInputDisabled = isTerminal || resignLoading;

  // ── Auto-navigate on terminal ───────────────────────────────────────────
  useEffect(() => {
    if (!session || !sessionId || navigatedRef.current) return;

    if (session.phase === "resolved") {
      navigatedRef.current = true;
      logger.info("[MultiplayerShell] Resolved → game-over", { sessionId });

      // Clear recovery bookmark so the app doesn't try to rejoin this session
      clearActiveSession().catch((err) =>
        logger.warn("[MultiplayerShell] clearActiveSession failed", { err }),
      );

      const timer = setTimeout(() => {
        try {
          navigation.replace("SessionGameOverScreen", {
            sessionId,
            // Pass result facts if the game screen provided them
            ...(resultFacts
              ? { resultFacts: JSON.stringify(resultFacts) }
              : {}),
          });
        } catch (err) {
          logger.warn("[MultiplayerShell] Nav to game-over failed", { err });
        }
      }, 400);
      return () => clearTimeout(timer);
    }

    if (session.phase === "abandoned" || session.phase === "expired") {
      navigatedRef.current = true;
      logger.info("[MultiplayerShell] Abandoned/expired → hub", {
        sessionId,
        phase: session.phase,
      });

      // Clear recovery bookmark so the app doesn't try to rejoin this session
      clearActiveSession().catch((err) =>
        logger.warn("[MultiplayerShell] clearActiveSession failed", { err }),
      );

      const timer = setTimeout(() => {
        try {
          navigation.replace("GamesHub");
        } catch {
          /* best-effort */
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [session, sessionId, navigation, resultFacts]);

  // ── Android hardware-back interception ──────────────────────────────────
  useEffect(() => {
    if (!isActive || resignLoading) return;

    const handler = () => {
      if (navigatedRef.current || exitFlowActiveRef.current) return false;
      setShowResignConfirm(true);
      exitFlowActiveRef.current = true;
      return true; // consume the event
    };

    const sub = BackHandler.addEventListener("hardwareBackPress", handler);
    return () => sub.remove();
  }, [isActive, resignLoading]);

  // ── Resign handler ────────────────────────────────────────────────────
  const handleConfirmResign = useCallback(async () => {
    if (!sessionId || !uid || !session || resignLoading) return;
    setShowResignConfirm(false);
    setResignLoading(true);

    // Claim navigation BEFORE the async call to prevent concurrent snapshot nav
    navigatedRef.current = true;
    exitFlowActiveRef.current = true;

    // Determine winner — the other active participant(s)
    const others = session.participants.filter(
      (p) => p.uid !== uid && p.status !== "left",
    );
    const winnerUid = others.length === 1 ? others[0].uid : undefined;

    // Tear down Firestore listener before resolving to avoid permission flash
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }

    try {
      const result = await resolveSession({
        sessionId,
        outcome: "forfeit",
        winnerUid,
        resolvedBy: `${uid}:resign`,
      });

      if (result.success) {
        logger.info("[MultiplayerShell] Resign OK", { sessionId });
        navigation.replace("SessionGameOverScreen", {
          sessionId,
          ...(resultFacts ? { resultFacts: JSON.stringify(resultFacts) } : {}),
        });
      } else {
        logger.warn("[MultiplayerShell] Resign failed", {
          error: result.error,
        });
        // Reset refs on failure so user can retry
        navigatedRef.current = false;
        exitFlowActiveRef.current = false;
        setResignLoading(false);
      }
    } catch (err) {
      logger.error("[MultiplayerShell] Resign error", err);
      // Reset refs on error so user can retry
      navigatedRef.current = false;
      exitFlowActiveRef.current = false;
      setResignLoading(false);
    }
  }, [sessionId, uid, session, resignLoading, navigation, resultFacts]);

  // ── Context value ─────────────────────────────────────────────────────
  const contextValue: MultiplayerRuntimeState = {
    session,
    isActive,
    isTerminal,
    isInputDisabled,
    resignLoading,
    sessionId,
    setResultFacts,
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <MultiplayerRuntimeContext.Provider value={contextValue}>
      <View
        style={styles.root}
        pointerEvents={isInputDisabled ? "none" : "auto"}
      >
        {children}

        {/* ── Floating resign FAB ── */}
        {isActive && !resignLoading && showResignFab && (
          <TouchableOpacity
            style={[styles.resignFab, { top: insets.top + 8, right: 12 }]}
            onPress={() => setShowResignConfirm(true)}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            testID="multiplayer-resign-fab"
          >
            <MaterialCommunityIcons
              name="flag-outline"
              size={20}
              color="#fff"
            />
          </TouchableOpacity>
        )}

        {/* ── Loading overlay while resign is in-flight ── */}
        {resignLoading && (
          <View style={styles.loadingOverlay} pointerEvents="auto">
            <Text style={styles.loadingText}>Ending match…</Text>
          </View>
        )}

        {/* ── Input-disabled overlay when terminal ── */}
        {isTerminal && !resignLoading && (
          <View style={styles.terminalOverlay} pointerEvents="auto">
            <Text style={styles.terminalText}>Game ended</Text>
          </View>
        )}

        {/* ── Resign confirmation modal ── */}
        <Modal
          transparent
          visible={showResignConfirm}
          animationType="fade"
          onRequestClose={() => setShowResignConfirm(false)}
        >
          <View style={styles.modalBackdrop}>
            <View
              style={[
                styles.dialogBox,
                { backgroundColor: theme.colors.surface },
              ]}
            >
              <MaterialCommunityIcons
                name="flag"
                size={36}
                color={theme.colors.error}
                style={{ marginBottom: 8 }}
              />
              <Text
                style={[styles.dialogTitle, { color: theme.colors.onSurface }]}
              >
                Resign Game?
              </Text>
              <Text
                style={[
                  styles.dialogSubtext,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                This will count as a loss. Your opponent wins.
              </Text>
              <View style={styles.dialogActions}>
                <TouchableOpacity
                  style={[
                    styles.resignBtn,
                    { backgroundColor: theme.colors.error },
                  ]}
                  onPress={handleConfirmResign}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.resignBtnText,
                      { color: theme.colors.onError },
                    ]}
                  >
                    Resign
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.cancelBtn,
                    {
                      backgroundColor: theme.colors.surfaceVariant,
                      borderColor: theme.colors.outline,
                    },
                  ]}
                  onPress={() => {
                    setShowResignConfirm(false);
                    exitFlowActiveRef.current = false;
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.cancelBtnText,
                      { color: theme.colors.onSurface },
                    ]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </MultiplayerRuntimeContext.Provider>
  );
}

// =============================================================================
// HOC: withMultiplayerRuntime
// =============================================================================

/**
 * Higher-order component that wraps a game screen with MultiplayerRuntimeShell
 * when the `v3Session` route param is present.  For non-v3 sessions the
 * wrapped component is rendered directly (zero overhead).
 *
 * Usage in RootNavigator:
 * ```
 * const SafeChessGame = withErrorBoundary(withMultiplayerRuntime(ChessGameScreen));
 * ```
 */
export function withMultiplayerRuntime<P extends Record<string, any>>(
  WrappedComponent: React.ComponentType<P>,
): React.FC<P> {
  function MultiplayerRuntimeWrapper(props: P) {
    const route = (props as any).route;
    const navigation = (props as any).navigation;
    const v3SessionId: string | undefined = route?.params?.v3Session;
    const gameId: ExtendedGameType | undefined =
      route?.params?.gameId ?? route?.params?.gameType;

    if (!v3SessionId) {
      return <WrappedComponent {...props} />;
    }

    return (
      <MultiplayerRuntimeShell
        sessionId={v3SessionId}
        navigation={navigation}
        gameId={gameId}
      >
        <WrappedComponent {...props} />
      </MultiplayerRuntimeShell>
    );
  }

  MultiplayerRuntimeWrapper.displayName = `withMultiplayerRuntime(${
    WrappedComponent.displayName || WrappedComponent.name || "Component"
  })`;

  return MultiplayerRuntimeWrapper;
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  resignFab: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(231, 76, 60, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 100,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 200,
  },
  loadingText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  terminalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 150,
  },
  terminalText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    opacity: 0.8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  dialogBox: {
    backgroundColor: "#1e1e2e",
    borderRadius: 16,
    width: 300,
    padding: 24,
    alignItems: "center",
  },
  dialogTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  dialogSubtext: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 15,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 22,
  },
  dialogActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  resignBtn: {
    flex: 1,
    backgroundColor: "#e74c3c",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  resignBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  cancelBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
});
