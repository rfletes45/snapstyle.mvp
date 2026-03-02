/**
 * SessionRuntimeShell — Universal wrapper for multiplayer game screens.
 *
 * Responsibilities:
 *  1. Subscribes to the V3 session doc in Firestore.
 *  2. Shows a floating "Resign" FAB when the session is active.
 *  3. Displays a resign confirmation modal (calls resolveSessionV3 with "forfeit").
 *  4. Auto-navigates to SessionGameOverScreen when session becomes terminal.
 *  5. Intercepts Android hardware-back during active play → resign confirm.
 *
 * Usage: Wrap with the `withSessionRuntime` HOC in the navigator, or
 *   render `<SessionRuntimeShell>` directly inside a game screen.
 *
 * @module screens/games/SessionRuntimeShell
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
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

import { clearActiveSession } from "@/services/gameRecovery";
import { resolveSession, subscribeToSession } from "@/services/gameSessions";
import { useAuth } from "@/store/AuthContext";
import type { GameSessionV3 } from "@/types/gameSessionV3";
import { isSessionTerminal } from "@/types/gameSessionV3";
import { createLogger } from "@/utils/log";

const logger = createLogger("screens/SessionRuntimeShell");

// =============================================================================
// Hook: useSessionRuntime
// =============================================================================

export interface UseSessionRuntimeReturn {
  /** Raw session document (null while loading). */
  session: GameSessionV3 | null;
  /** Session is in an active gameplay phase. */
  isActive: boolean;
  /** Session has reached a terminal phase. */
  isTerminal: boolean;
  /** Gameplay input should be disabled (terminal or resign in flight). */
  isInputDisabled: boolean;
  /** Resign Cloud Function call is in progress. */
  resignLoading: boolean;
}

/**
 * Core runtime hook – subscribes to the V3 session doc and provides
 * resign + terminal-detection state.  Used internally by the Shell;
 * also exported for advanced composition.
 */
export function useSessionRuntime(
  sessionId: string | undefined,
  navigation: any,
): UseSessionRuntimeReturn {
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid ?? "";

  const [session, setSession] = useState<GameSessionV3 | null>(null);
  const [resignLoading, setResignLoading] = useState(false);
  const navigatedRef = useRef(false);
  const unsubRef = useRef<(() => void) | null>(null);

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

  const isTerminal = session ? isSessionTerminal(session.phase) : false;
  const isActive = session?.phase === "active";
  const isInputDisabled = isTerminal || resignLoading;

  // ── Auto-navigate on terminal ───────────────────────────────────────────
  useEffect(() => {
    if (!session || !sessionId || navigatedRef.current) return;

    if (session.phase === "resolved") {
      navigatedRef.current = true;
      logger.info("[SessionRuntime] Resolved → game-over", { sessionId });
      const timer = setTimeout(() => {
        try {
          navigation.replace("SessionGameOverScreen", { sessionId });
        } catch (err) {
          logger.warn("[SessionRuntime] Nav to game-over failed", { err });
        }
      }, 400);
      return () => clearTimeout(timer);
    }

    if (session.phase === "abandoned" || session.phase === "expired") {
      navigatedRef.current = true;
      logger.info("[SessionRuntime] Abandoned/expired → hub", {
        sessionId,
        phase: session.phase,
      });
      const timer = setTimeout(() => {
        try {
          navigation.replace("GamesHub");
        } catch {
          /* best-effort */
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [session, sessionId, navigation]);

  return { session, isActive, isTerminal, isInputDisabled, resignLoading };
}

// =============================================================================
// Component: SessionRuntimeShell
// =============================================================================

interface SessionRuntimeShellProps {
  sessionId: string;
  navigation: any;
  children: React.ReactNode;
}

export function SessionRuntimeShell({
  sessionId,
  navigation,
  children,
}: SessionRuntimeShellProps) {
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid ?? "";
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const [session, setSession] = useState<GameSessionV3 | null>(null);
  const [resignLoading, setResignLoading] = useState(false);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const navigatedRef = useRef(false);
  const unsubRef = useRef<(() => void) | null>(null);

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

  const isActive = session?.phase === "active";

  // ── Auto-navigate to SessionGameOverScreen on terminal ──────────────────
  useEffect(() => {
    if (!session || !sessionId || navigatedRef.current) return;

    if (session.phase === "resolved") {
      navigatedRef.current = true;
      logger.info("[Shell] Resolved → SessionGameOverScreen", { sessionId });

      // Clear recovery bookmark so the app doesn't try to rejoin this session
      clearActiveSession().catch((err) =>
        logger.warn("[Shell] clearActiveSession failed", { err }),
      );

      const timer = setTimeout(() => {
        try {
          navigation.replace("SessionGameOverScreen", { sessionId });
        } catch (err) {
          logger.warn("[Shell] Nav to game-over failed", { err });
        }
      }, 400);
      return () => clearTimeout(timer);
    }

    if (session.phase === "abandoned" || session.phase === "expired") {
      navigatedRef.current = true;
      logger.info("[Shell] Abandoned/expired → GamesHub", {
        sessionId,
        phase: session.phase,
      });

      // Clear recovery bookmark so the app doesn't try to rejoin this session
      clearActiveSession().catch((err) =>
        logger.warn("[Shell] clearActiveSession failed", { err }),
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
  }, [session, sessionId, navigation]);

  // ── Android hardware-back interception ──────────────────────────────────
  useEffect(() => {
    if (!isActive || resignLoading) return;

    const handler = () => {
      if (navigatedRef.current) return false;
      setShowResignConfirm(true);
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

    // Determine winner — the other active participant(s)
    const others = session.participants.filter(
      (p) => p.uid !== uid && p.status !== "left",
    );
    const winnerUid = others.length === 1 ? others[0].uid : undefined;

    // Tear down Firestore listener before resolving to avoid brief
    // "missing permissions" flash as the session doc updates.
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
        logger.info("[Shell] Resign OK", { sessionId });
        navigation.replace("SessionGameOverScreen", { sessionId });
      } else {
        logger.warn("[Shell] Resign failed", { error: result.error });
        // Reset ref on failure so user can retry
        navigatedRef.current = false;
        setResignLoading(false);
      }
    } catch (err) {
      logger.error("[Shell] Resign error", err);
      // Reset ref on error so user can retry
      navigatedRef.current = false;
      setResignLoading(false);
    }
  }, [sessionId, uid, session, resignLoading, navigation]);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {children}

      {/* ── Floating resign FAB ── */}
      {isActive && !resignLoading && (
        <TouchableOpacity
          style={[styles.resignFab, { top: insets.top + 8, right: 12 }]}
          onPress={() => setShowResignConfirm(true)}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          testID="session-resign-fab"
        >
          <MaterialCommunityIcons name="flag-outline" size={20} color="#fff" />
        </TouchableOpacity>
      )}

      {/* ── Loading overlay while resign is in-flight ── */}
      {resignLoading && (
        <View style={styles.loadingOverlay} pointerEvents="auto">
          <Text style={styles.loadingText}>Ending match…</Text>
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
                onPress={() => setShowResignConfirm(false)}
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
  );
}

// =============================================================================
// HOC: withSessionRuntime
// =============================================================================

/**
 * Higher-order component that wraps a game screen with SessionRuntimeShell
 * when the `v3Session` route param is present.  For non-v3 sessions the
 * wrapped component is rendered directly (zero overhead).
 *
 * Usage in RootNavigator:
 * ```
 * const SafeChessGame = withErrorBoundary(withSessionRuntime(ChessGameScreen));
 * ```
 */
export function withSessionRuntime<P extends Record<string, any>>(
  WrappedComponent: React.ComponentType<P>,
): React.FC<P> {
  function SessionRuntimeWrapper(props: P) {
    const route = (props as any).route;
    const navigation = (props as any).navigation;
    const v3SessionId: string | undefined = route?.params?.v3Session;

    if (!v3SessionId) {
      return <WrappedComponent {...props} />;
    }

    return (
      <SessionRuntimeShell sessionId={v3SessionId} navigation={navigation}>
        <WrappedComponent {...props} />
      </SessionRuntimeShell>
    );
  }

  SessionRuntimeWrapper.displayName = `withSessionRuntime(${
    WrappedComponent.displayName || WrappedComponent.name || "Component"
  })`;

  return SessionRuntimeWrapper;
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
