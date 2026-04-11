/**
 * Games V4 — Mini Golf Screen
 *
 * Full-featured mobile-first Mini Golf game screen with:
 * - Top-down SVG course rendering
 * - Ball-anchored aim bar (always visible on mobile + web)
 * - Two-phase rolling: shot → animate → commit
 * - Compact HUD with scores
 * - Pinch-zoom + pan + recenter
 * - Spectator support
 *
 * Wrapped with withGameV4Shell for session management.
 *
 * @module gamesV4/screens/MinigolfScreenV4
 */

import {
  withGameV4Shell,
  type GameShellProps,
} from "@/gamesV4/components/GameScreenShell";
import { getCoursePack } from "@/gamesV4/games/miniGolf/courses/pigeonClassic";
import { useRollingPlayback } from "@/gamesV4/games/miniGolf/hooks/useRollingPlayback";
import CourseRenderer from "@/gamesV4/games/miniGolf/render/CourseRenderer";
import type {
  MiniGolfPublicState,
  RollingPayload,
  Vec2,
} from "@/gamesV4/games/miniGolf/types";
import AimInputOverlay from "@/gamesV4/games/miniGolf/ui/AimInputOverlay";
import ScoreHUD from "@/gamesV4/games/miniGolf/ui/ScoreHUD";
import {
  getCachedProfileSync,
  prefetchProfiles,
} from "@/services/cache/profileCache";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// =============================================================================
// Constants
// =============================================================================

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;
const BALL_COLORS: Record<number, string> = {
  0: "#FFFFFF",
  1: "#FFD700",
  2: "#FF69B4",
};
const VB_PAD = 0.25; // viewBox padding (matching CourseRenderer)

// =============================================================================
// Main Game Screen Component
// =============================================================================

function MiniGolfGameUI(props: GameShellProps) {
  const {
    publicState,
    isMyTurn,
    isTerminal,
    myUid,
    turnOrder,
    currentTurnIndex,
    settings,
    submitMove,
    actionLoading,
    actionError,
    sessionId,
  } = props;

  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState<Vec2>({ x: 0, y: 0 });

  // Parse state
  const state = publicState as unknown as MiniGolfPublicState | null;

  // Get course pack and current hole
  const pack = useMemo(() => getCoursePack("pigeon_classic"), []);
  const currentHole = useMemo(() => {
    if (!pack || !state) return null;
    return pack.holes[state.holeIndex] ?? null;
  }, [pack, state]);

  // Is this user a participant or spectator?
  const isParticipant = turnOrder.includes(myUid);
  const isSpectator = !isParticipant;

  // ── Rolling state ─────────────────────────────────────────────────
  const rolling: RollingPayload | null =
    (state?.rolling as RollingPayload | null | undefined) ?? null;

  // Finish roll handler — submits finish_roll move
  const handleFinishRoll = useCallback(
    async (shotId: string) => {
      try {
        await submitMove({ type: "finish_roll", shotId });
      } catch (err) {
        // Idempotent — safe to swallow
      }
    },
    [submitMove],
  );

  // Rolling playback hook
  const { isRolling, animatedPos, progress, frameIndex, totalFrames } =
    useRollingPlayback(rolling, currentHole, handleFinishRoll);

  // Can this player shoot?
  const canShoot = useMemo(() => {
    if (!state || !isMyTurn || isTerminal || isSpectator || actionLoading)
      return false;
    if (state.phase !== "aim") return false;
    if (state.ballSunkByUid[myUid]) return false;
    const maxStrokes = (settings.maxStrokesPerHole as number) || 10;
    if (state.strokesThisHoleByUid[myUid] >= maxStrokes) return false;
    return true;
  }, [
    state,
    isMyTurn,
    isTerminal,
    isSpectator,
    actionLoading,
    myUid,
    settings,
  ]);

  // ── __DEV__ interaction diagnostics ─────────────────────────────────

  // Handle shot
  const handleShot = useCallback(
    async (angleQ: number, powerQ: number) => {
      if (!canShoot) return;
      await submitMove({ type: "shot", angleQ, powerQ });
    },
    [canShoot, submitMove],
  );

  // Handle pickup
  const handlePickup = useCallback(async () => {
    if (!isMyTurn || isTerminal || isSpectator || actionLoading) return;
    await submitMove({ type: "pickup" });
  }, [isMyTurn, isTerminal, isSpectator, actionLoading, submitMove]);

  // Recenter view
  const handleRecenter = useCallback(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  // Player display names — fetch from profile cache
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await prefetchProfiles(turnOrder);
      if (cancelled) return;
      const result: Record<string, string> = {};
      for (const uid of turnOrder) {
        if (uid === myUid) {
          result[uid] = "You";
        } else {
          const p = getCachedProfileSync(uid);
          result[uid] =
            p?.displayName ||
            p?.username ||
            `Player ${turnOrder.indexOf(uid) + 1}`;
        }
      }
      setPlayerNames(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [turnOrder, myUid]);

  // Ball colors
  const ballColors = useMemo(() => {
    const colors: Record<string, string> = {};
    turnOrder.forEach((uid, i) => {
      colors[uid] = BALL_COLORS[i] || "#AAAAAA";
    });
    return colors;
  }, [turnOrder]);

  // Sunken UIDs set
  const sunkenUids = useMemo(() => {
    if (!state) return new Set<string>();
    return new Set(
      Object.entries(state.ballSunkByUid)
        .filter(([, sunk]) => sunk)
        .map(([uid]) => uid),
    );
  }, [state]);

  // Render dimensions
  const courseWidth = SCREEN_WIDTH - 16;
  const courseHeight = SCREEN_HEIGHT * 0.55;

  // ── ViewBox params (must match CourseRenderer) ─────────────────────
  const viewBoxParams = useMemo(() => {
    if (!currentHole) return { minX: 0, minY: 0, width: 1, height: 1 };
    const vbW = currentHole.bounds.width;
    const vbH = currentHole.bounds.height;
    return {
      minX: -VB_PAD,
      minY: -VB_PAD,
      width: vbW + 2 * VB_PAD,
      height: vbH + 2 * VB_PAD,
    };
  }, [currentHole]);

  // ── Ball positions (override with animated during rolling) ────────
  const effectiveBallPositions = useMemo(() => {
    if (!state) return {};
    if (isRolling && animatedPos && rolling) {
      // Override the rolling player's ball with animated position
      return {
        ...state.ballPosByUid,
        [rolling.uid]: animatedPos,
      };
    }
    return state.ballPosByUid;
  }, [state, isRolling, animatedPos, rolling]);

  // Current active player's ball world position (for aim overlay)
  const myBallWorldPos = useMemo(() => {
    if (!state) return null;
    return state.ballPosByUid[myUid] ?? null;
  }, [state, myUid]);

  // ── Loading state ─────────────────────────────────────────────────

  if (!state || !currentHole || !pack) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading course...</Text>
      </SafeAreaView>
    );
  }

  // ── Current turn player ───────────────────────────────────────────

  const currentTurnUid = turnOrder[currentTurnIndex % turnOrder.length];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Spectator badge */}
      {isSpectator && (
        <View style={styles.spectatorBadge}>
          <MaterialCommunityIcons name="eye" size={14} color="#fff" />
          <Text style={styles.spectatorText}>Spectating</Text>
        </View>
      )}

      {/* Score HUD */}
      <ScoreHUD
        state={state}
        turnOrder={turnOrder}
        currentTurnIndex={currentTurnIndex}
        myUid={myUid}
        playerNames={playerNames}
        holeName={currentHole.name}
      />

      {/* Course View — stacking order:
            1. CourseRenderer (pointerEvents="none" — purely visual)
            2. AimInputOverlay input layer (zIndex 20 — captures input)
            3. AimInputOverlay viz layer (zIndex 30 — aim bar SVG)
            4. Rolling overlay (zIndex 35, pointerEvents="none") */}
      <View style={styles.courseContainer}>
        <CourseRenderer
          hole={currentHole}
          ballPositions={effectiveBallPositions}
          ballColors={ballColors}
          currentPlayerUid={currentTurnUid}
          sunkenUids={sunkenUids}
          width={courseWidth}
          height={courseHeight}
          offsetX={panOffset.x}
          offsetY={panOffset.y}
          scale={50 * zoom}
        />

        {/* AimInputOverlay — always mounted; canInteract gates input */}
        {!isTerminal && !isSpectator && (
          <AimInputOverlay
            canInteract={canShoot}
            onShot={handleShot}
            showAssist={(settings.assistGhostLine as boolean) || false}
            width={courseWidth}
            height={courseHeight}
            ballWorldPos={myBallWorldPos}
            viewBox={viewBoxParams}
          />
        )}

        {/* Rolling indicator */}
        {state.phase === "rolling" && (
          <View style={styles.rollingOverlay} pointerEvents="none">
            <Text style={styles.rollingText}>Rolling...</Text>
          </View>
        )}
      </View>

      {/* Bottom controls */}
      <View style={styles.bottomBar}>
        {/* Hole name */}
        {currentHole && (
          <Text style={styles.holeNameText}>
            {currentHole.name} · Par {currentHole.par}
          </Text>
        )}

        {/* Turn indicator */}
        <View style={styles.turnIndicator}>
          {isTerminal ? (
            <Text style={styles.turnText}>Game Over!</Text>
          ) : state.phase === "rolling" ? (
            <Text style={styles.turnText}>
              {rolling?.uid === myUid
                ? "Your shot is rolling..."
                : `${playerNames[rolling?.uid ?? ""] || "Opponent"}'s shot rolling...`}
            </Text>
          ) : (
            <Text style={styles.turnText}>
              {isMyTurn
                ? "Your turn — drag to aim"
                : `${playerNames[currentTurnUid] || "Opponent"}'s turn`}
            </Text>
          )}
        </View>

        {/* Action buttons */}
        <View style={styles.buttonsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleRecenter}>
            <MaterialCommunityIcons
              name="crosshairs-gps"
              size={20}
              color="#fff"
            />
            <Text style={styles.actionBtnText}>Recenter</Text>
          </TouchableOpacity>

          {isMyTurn &&
            !isTerminal &&
            !isSpectator &&
            state.phase === "aim" &&
            (settings.allowPickups as boolean) && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.pickupBtn]}
                onPress={handlePickup}
                disabled={actionLoading}
              >
                <MaterialCommunityIcons
                  name="hand-back-right"
                  size={20}
                  color="#fff"
                />
                <Text style={styles.actionBtnText}>Pick Up</Text>
              </TouchableOpacity>
            )}

        </View>

        {/* Error display */}
        {actionError && <Text style={styles.errorText}>{actionError}</Text>}

        {/* Loading indicator */}
        {actionLoading && (
          <ActivityIndicator
            size="small"
            color="#FFD700"
            style={styles.loadingSpinner}
          />
        )}

              {rolling.sunk ? "SUNK" : rolling.penalty ? "PENALTY" : "STOP"} → (
      </View>
    </SafeAreaView>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a3a28",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a3a28",
  },
  loadingText: {
    color: "#fff",
    marginTop: 12,
    fontSize: 14,
  },
  spectatorBadge: {
    position: "absolute",
    top: 50,
    right: 12,
    zIndex: 100,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(156,39,176,0.8)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  spectatorText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  courseContainer: {
    flex: 1,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    margin: 8,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#0d291a",
  },
  rollingOverlay: {
    position: "absolute",
    bottom: 16,
    alignSelf: "center",
    zIndex: 35,
    backgroundColor: "rgba(255,152,0,0.85)",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  rollingText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  bottomBar: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  holeNameText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 2,
  },
  turnIndicator: {
    alignItems: "center",
    marginBottom: 8,
  },
  turnText: {
    color: "#FFD700",
    fontSize: 14,
    fontWeight: "700",
  },
  buttonsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  pickupBtn: {
    backgroundColor: "rgba(244,67,54,0.3)",
  },
  debugBtn: {
    backgroundColor: "rgba(156,39,176,0.3)",
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  errorText: {
    color: "#F44336",
    fontSize: 12,
    textAlign: "center",
    marginTop: 6,
  },
  loadingSpinner: {
    marginTop: 6,
  },
  devRollingDebug: {
    marginTop: 6,
    padding: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 6,
  },
  devRollingText: {
    color: "#0F0",
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontWeight: "600",
  },
});

// =============================================================================
// Export wrapped with GameScreenShell
// =============================================================================

export default withGameV4Shell(MiniGolfGameUI, "minigolf_duels");
