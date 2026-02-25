/**
 * MiniGolfDuelsGameScreen — Multiplayer mini-golf game (2-player duels)
 *
 * Phases: waiting (lobby / invite), countdown, playing (Skia canvas + controls),
 * finished (game-over modal / rematch).
 *
 * Follows the same patterns as SketchPartyGameScreen for invite flow,
 * useGameConnection, useGameBackHandler, and spectator support.
 */

import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { Button, IconButton, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import InvitePickerModal, {
  type FriendItem,
  type GroupItem,
} from "@/components/InvitePickerModal";
import { GameOverModal, type GameResult } from "@/components/games";
import { MiniGolfCanvas } from "@/components/games/minigolf/MiniGolfCanvas";
import { MiniGolfDebugOverlay } from "@/components/games/minigolf/MiniGolfDebugOverlay";
import type { HoleConfig } from "@/games/minigolf/courseLoader";
import { loadHole } from "@/games/minigolf/courseLoader";
import { useGameBackHandler } from "@/hooks/useGameBackHandler";
import { useGameConnection } from "@/hooks/useGameConnection";
import { useMiniGolfDuels } from "@/hooks/useMiniGolfDuels";
import {
  sendUniversalInvite,
  subscribeToUniversalInvite,
} from "@/services/gameInvites";
import { onGameResultNotification } from "@/services/gameResultEvents";
import {
  buildGameResultEvent,
  submitGameResult,
} from "@/services/gameResultService";
import { getGroupMembers } from "@/services/groups";
import { useAuth } from "@/store/AuthContext";
import { useSnackbar } from "@/store/SnackbarContext";
import { useUser } from "@/store/UserContext";
import type { PlayStackParamList } from "@/types/navigation/root";
import type { UniversalGameInvite } from "@/types/turnBased";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { createLogger } from "@/utils/log";
const logger = createLogger("screens/MiniGolfDuelsGame");

// =============================================================================
// Types
// =============================================================================

type Props = NativeStackScreenProps<PlayStackParamList, "MiniGolfDuelsGame">;

interface RouteParamsShape {
  matchId?: string;
  inviteId?: string;
  entryPoint?: string;
  spectator?: boolean;
}

function asRouteParams(raw: unknown): RouteParamsShape {
  if (!raw || typeof raw !== "object") return {};
  const params = raw as Record<string, unknown>;
  return {
    matchId: typeof params.matchId === "string" ? params.matchId : undefined,
    inviteId: typeof params.inviteId === "string" ? params.inviteId : undefined,
    entryPoint:
      typeof params.entryPoint === "string" ? params.entryPoint : undefined,
    spectator: typeof params.spectator === "boolean" ? params.spectator : false,
  };
}

// =============================================================================
// Constants
// =============================================================================

const GAME_TYPE = "minigolf_duels";
const MAX_POWER = 20;

// =============================================================================
// Screen
// =============================================================================

export default function MiniGolfDuelsGameScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const routeParams = asRouteParams(route.params);
  const {
    matchId: routeMatchId,
    inviteId,
    spectator: routeSpectator,
  } = routeParams;

  // Auth + profile
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { showSuccess, showError } = useSnackbar();

  // ---------------------------------------------------------------------------
  // Host room key — generated once for direct-launch so the Colyseus room
  // gets a deterministic firestoreGameId that can be shared via invites.
  // ---------------------------------------------------------------------------
  const [hostRoomKey] = useState(() =>
    !inviteId && !routeMatchId
      ? `mg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      : undefined,
  );

  // ---------------------------------------------------------------------------
  // Queue mode: wait for invite to become active before joining room
  // ---------------------------------------------------------------------------
  const [resolvedMatchId, setResolvedMatchId] = useState<string | undefined>(
    routeMatchId,
  );
  const [queueInvite, setQueueInvite] = useState<UniversalGameInvite | null>(
    null,
  );
  const [queueError, setQueueError] = useState<string | null>(null);

  const isQueueMode = !!inviteId && !resolvedMatchId;

  // Subscribe to invite doc while in queue
  useEffect(() => {
    if (!inviteId || resolvedMatchId) return;
    const unsubscribe = subscribeToUniversalInvite(
      inviteId,
      (invite) => {
        if (!invite) {
          setQueueError("Invite not found");
          return;
        }
        setQueueInvite(invite);
        // For games like mini-golf where the host already has a Colyseus room,
        // the colyseusRoomKey in settings IS the firestoreGameId needed to join
        // the existing room. Use it as soon as the invite is past "pending".
        const roomKey =
          (invite.settings as any)?.colyseusRoomKey || invite.gameId;
        if (
          roomKey &&
          ["filling", "ready", "starting", "active"].includes(invite.status)
        ) {
          setResolvedMatchId(roomKey);
          return;
        }
        if (
          invite.status === "cancelled" ||
          invite.status === "expired" ||
          invite.status === "declined"
        ) {
          setQueueError(
            `Invite ${invite.status === "cancelled" ? "was cancelled" : invite.status === "expired" ? "expired" : "was declined"}`,
          );
        }
      },
      (err) => setQueueError("Failed to load invite"),
    );
    return () => unsubscribe();
  }, [inviteId, resolvedMatchId]);

  // Game connection resolution
  const { firestoreGameId } = useGameConnection(GAME_TYPE, resolvedMatchId);
  const effectiveGameId = firestoreGameId ?? hostRoomKey ?? undefined;

  // Connect to Colyseus room
  const mg = useMiniGolfDuels({
    firestoreGameId: effectiveGameId,
    autoJoin: !isQueueMode,
    spectator: !!routeSpectator,
    inviteId,
  });

  // When queue resolves, trigger join
  const didJoinRef = useRef(false);
  useEffect(() => {
    if (!resolvedMatchId || !inviteId) return;
    if (didJoinRef.current) return;
    didJoinRef.current = true;
    mg.joinRoom();
  }, [resolvedMatchId, inviteId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Back handler
  const isGameOver = mg.phase === "finished";
  const { handleBack } = useGameBackHandler({
    gameType: GAME_TYPE,
    isGameOver,
  });

  // ---------------------------------------------------------------------------
  // Local UI state
  // ---------------------------------------------------------------------------
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);

  // XP state (populated via GameResult notification)
  const [xpEarned, setXpEarned] = useState(0);
  const [didLevelUp, setDidLevelUp] = useState(false);
  const [newXpLevel, setNewXpLevel] = useState(0);

  // Listen for game result notifications (XP + achievements)
  useEffect(() => {
    const unsub = onGameResultNotification((n) => {
      if (n.gameId === "minigolf_duels") {
        setXpEarned(n.xpEarned);
        setDidLevelUp(n.didLevelUp);
        setNewXpLevel(n.newLevel);
      }
    });
    return unsub;
  }, []);

  // Aim state
  const [isAiming, setIsAiming] = useState(false);
  const [aimAngle, setAimAngle] = useState(0);
  const [aimPower, setAimPower] = useState(0);

  // Canvas layout for debug overlay
  const [canvasLayout, setCanvasLayout] = useState({ width: 0, height: 0 });

  // ---------------------------------------------------------------------------
  // Load hole geometry from local JSON
  // ---------------------------------------------------------------------------
  const holeConfig = useMemo<HoleConfig | null>(() => {
    if (!mg.packId || mg.holeIndex < 0) return null;
    try {
      return loadHole(mg.packId, mg.holeIndex) ?? null;
    } catch {
      return null;
    }
  }, [mg.packId, mg.holeIndex]);

  // Player color map (player0 → 0, player1 → 1)
  const playerColors = useMemo(() => {
    const map: Record<string, number> = {};
    mg.players.forEach((p) => {
      map[p.uid] = p.playerIndex;
    });
    return map;
  }, [mg.players]);

  // Show game over when phase transitions to finished
  useEffect(() => {
    if (mg.phase === "finished" && mg.gameOverData) {
      setShowGameOver(true);
      // Submit to XP pipeline
      if (currentFirebaseUser) {
        const myTotal = mg.strokesTotalByUid[mg.myUid] ?? 0;
        submitGameResult(
          buildGameResultEvent({
            gameId: "minigolf_duels",
            mode: "realtime",
            outcome:
              mg.gameOverData.winnerId === mg.myUid
                ? "win"
                : mg.gameOverData.winnerId === ""
                  ? "draw"
                  : "lose",
            score: myTotal,
            durationMs: 0,
            userId: currentFirebaseUser.uid,
            displayName: currentFirebaseUser.displayName || "Player",
          }),
        ).catch(() => {});
      }
    }
  }, [mg.phase, mg.gameOverData]);

  // Reset aim when turn changes or subPhase changes
  useEffect(() => {
    setIsAiming(false);
    setAimAngle(0);
    setAimPower(0);
  }, [mg.currentTurnUid, mg.subPhase, mg.holeIndex]);

  // ---------------------------------------------------------------------------
  // Aim gesture (pan on canvas area)
  // ---------------------------------------------------------------------------
  const myBall = mg.balls[mg.myUid];

  // Refs to avoid stale closures inside gesture callbacks
  const aimAngleRef = useRef(0);
  const aimPowerRef = useRef(0);
  const myBallRef = useRef(myBall);
  myBallRef.current = myBall;

  const panGesture = Gesture.Pan()
    .runOnJS(true) // Must run on JS thread — callbacks use setState + sendMessage
    .enabled(mg.isMyTurn && mg.subPhase === "aiming" && !mg.isSpectator)
    .onStart(() => {
      if (!myBallRef.current) return;
      setIsAiming(true);
    })
    .onUpdate((e) => {
      if (!myBallRef.current) return;
      // Compute angle/power from drag vector
      const dx = e.translationX;
      const dy = e.translationY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Aim opposite to drag direction (pull back to shoot forward)
      const angle = Math.atan2(-dy, -dx);
      const power = Math.min(dist / 15, MAX_POWER);
      aimAngleRef.current = angle;
      aimPowerRef.current = power;
      setAimAngle(angle);
      setAimPower(power);
      mg.sendAim(angle, power);
    })
    .onEnd(() => {
      if (!myBallRef.current || aimPowerRef.current < 0.5) {
        setIsAiming(false);
        return;
      }
      mg.sendShot(aimAngleRef.current, aimPowerRef.current);
      setIsAiming(false);
      setAimAngle(0);
      setAimPower(0);
      aimAngleRef.current = 0;
      aimPowerRef.current = 0;
    });

  // ---------------------------------------------------------------------------
  // Invite handlers
  // ---------------------------------------------------------------------------
  const handleSelectFriend = useCallback(
    async (friend: FriendItem) => {
      if (!currentFirebaseUser) return;
      try {
        const invite = await sendUniversalInvite({
          senderId: currentFirebaseUser.uid,
          senderName: profile?.displayName || "Player",
          senderAvatar: profile?.avatarConfig
            ? JSON.stringify(profile.avatarConfig)
            : undefined,
          gameType: GAME_TYPE as any,
          context: "dm",
          conversationId: "",
          recipientId: friend.friendUid,
          recipientName: friend.displayName || "Friend",
          settings: effectiveGameId
            ? { colyseusRoomKey: effectiveGameId }
            : undefined,
        });
        logger.info(`[MiniGolf] Invite sent: ${invite.id}`);
        showSuccess("Invite sent!");
      } catch {
        showError("Failed to send invite");
      }
      setShowInviteModal(false);
    },
    [currentFirebaseUser, profile, showSuccess, showError, effectiveGameId],
  );

  const handleSelectGroup = useCallback(
    async (group: GroupItem) => {
      if (!currentFirebaseUser) return;
      try {
        const members = await getGroupMembers(group.groupId);
        const memberIds = members.map((m: any) => m.uid);
        const invite = await sendUniversalInvite({
          senderId: currentFirebaseUser.uid,
          senderName: profile?.displayName || "Player",
          senderAvatar: profile?.avatarConfig
            ? JSON.stringify(profile.avatarConfig)
            : undefined,
          gameType: GAME_TYPE as any,
          context: "group",
          conversationId: group.groupId,
          conversationName: group.name,
          eligibleUserIds: memberIds,
          settings: effectiveGameId
            ? { colyseusRoomKey: effectiveGameId }
            : undefined,
        });
        logger.info(`[MiniGolf] Group invite sent: ${invite.id}`);
        showSuccess(`Invite sent to ${group.name}!`);
      } catch {
        showError("Failed to send group invite");
      }
      setShowInviteModal(false);
    },
    [currentFirebaseUser, profile, showSuccess, showError, effectiveGameId],
  );

  // ---------------------------------------------------------------------------
  // Game-over helpers
  // ---------------------------------------------------------------------------
  const gameResult = useMemo<GameResult>(() => {
    if (!mg.gameOverData) return "draw";
    if (mg.gameOverData.winnerId === mg.myUid) return "win";
    if (mg.gameOverData.winnerId === "") return "draw";
    return "loss";
  }, [mg.gameOverData, mg.myUid]);

  const gameOverStats = useMemo(() => {
    const myTotal = mg.strokesTotalByUid[mg.myUid] ?? 0;
    const opName = mg.opponentPlayer?.displayName || "Opponent";
    return {
      score: myTotal,
      opponentName: opName,
      winMethod: mg.winReason || undefined,
    };
  }, [mg.strokesTotalByUid, mg.myUid, mg.opponentPlayer, mg.winReason]);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  const renderWaiting = () => (
    <View style={styles.centeredContainer}>
      <Text variant="headlineMedium" style={styles.titleText}>
        ⛳ Mini-Golf Duels
      </Text>
      <Text variant="bodyLarge" style={styles.subtitleText}>
        Waiting for opponent...
      </Text>

      {/* Player list */}
      <View style={styles.lobbyPlayers}>
        {mg.players.map((p) => (
          <View key={p.uid} style={styles.lobbyPlayerRow}>
            <Text variant="bodyMedium">{p.displayName}</Text>
            <Text
              variant="bodySmall"
              style={{ color: p.ready ? "#4CAF50" : "#999" }}
            >
              {p.ready ? "Ready" : "Not Ready"}
            </Text>
          </View>
        ))}
      </View>

      {/* Actions */}
      <View style={styles.lobbyActions}>
        {!mg.isSpectator && (
          <>
            <Button
              mode="contained"
              onPress={() => mg.sendReady()}
              style={styles.actionButton}
            >
              Ready
            </Button>
            <Button
              mode="outlined"
              onPress={() => setShowInviteModal(true)}
              style={styles.actionButton}
              icon="account-plus"
            >
              Invite
            </Button>
          </>
        )}
        <Button mode="text" onPress={handleBack}>
          Leave
        </Button>
      </View>

      {mg.isSpectator && (
        <View style={styles.spectatorBanner}>
          <Text variant="bodySmall" style={styles.spectatorText}>
            👁 Watching as spectator
          </Text>
        </View>
      )}
    </View>
  );

  const renderCountdown = () => (
    <View style={styles.centeredContainer}>
      <Text variant="displayLarge" style={styles.countdownText}>
        {mg.countdown > 0 ? mg.countdown : "GO!"}
      </Text>
      <Text variant="bodyLarge" style={styles.subtitleText}>
        Hole {mg.holeIndex + 1} of {mg.holesTotal} — Par {mg.par}
      </Text>
    </View>
  );

  const renderPlaying = () => {
    const myStrokes = mg.strokesHoleByUid[mg.myUid] ?? 0;
    const oppStrokes = mg.opponentPlayer
      ? (mg.strokesHoleByUid[mg.opponentPlayer.uid] ?? 0)
      : 0;

    return (
      <View style={styles.playContainer}>
        {/* HUD */}
        <View style={styles.hud}>
          <View style={styles.hudRow}>
            <Text variant="labelLarge" style={styles.hudLabel}>
              Hole {mg.holeIndex + 1}/{mg.holesTotal}
            </Text>
            <Text variant="labelLarge" style={styles.hudLabel}>
              Par {mg.par}
            </Text>
          </View>
          <View style={styles.hudRow}>
            <Text variant="bodySmall" style={styles.hudScore}>
              You: {myStrokes}
            </Text>
            {mg.opponentPlayer && (
              <Text variant="bodySmall" style={styles.hudScore}>
                {mg.opponentPlayer.displayName}: {oppStrokes}
              </Text>
            )}
          </View>
          {/* Turn indicator */}
          <View style={styles.turnBanner}>
            <Text
              variant="labelMedium"
              style={[
                styles.turnText,
                mg.isMyTurn && !mg.isSpectator
                  ? styles.turnActive
                  : styles.turnInactive,
              ]}
            >
              {mg.isSpectator
                ? `${mg.players.find((p) => p.uid === mg.currentTurnUid)?.displayName || "..."}'s turn`
                : mg.isMyTurn
                  ? "Your turn — aim & shoot!"
                  : "Opponent's turn..."}
            </Text>
          </View>
        </View>

        {/* Spectator banner */}
        {mg.isSpectator && (
          <View style={styles.spectatorBanner}>
            <Text variant="bodySmall" style={styles.spectatorText}>
              👁 Watching as spectator
            </Text>
          </View>
        )}

        {/* Canvas with gesture */}
        <GestureDetector gesture={panGesture}>
          <View
            style={styles.canvasWrap}
            onLayout={(e) =>
              setCanvasLayout({
                width: e.nativeEvent.layout.width,
                height: e.nativeEvent.layout.height,
              })
            }
          >
            <MiniGolfCanvas
              holeConfig={holeConfig}
              balls={mg.balls}
              obstacles={mg.obstacles}
              isAiming={isAiming}
              aimAngle={aimAngle}
              aimPower={aimPower}
              myUid={mg.myUid}
              playerColors={playerColors}
            />
            <MiniGolfDebugOverlay
              holeConfig={holeConfig}
              layout={canvasLayout}
            />
          </View>
        </GestureDetector>

        {/* Power meter */}
        {isAiming && (
          <View style={styles.powerMeter}>
            <View style={styles.powerTrack}>
              <View
                style={[
                  styles.powerFill,
                  {
                    width: `${Math.min((aimPower / MAX_POWER) * 100, 100)}%`,
                    backgroundColor:
                      aimPower < 7
                        ? "#4CAF50"
                        : aimPower < 14
                          ? "#FFC107"
                          : "#F44336",
                  },
                ]}
              />
            </View>
            <Text variant="labelSmall" style={styles.powerLabel}>
              Power: {Math.round(aimPower)}
            </Text>
          </View>
        )}

        {/* Total strokes */}
        <View style={styles.totalScoreRow}>
          <Text variant="labelSmall" style={styles.totalLabel}>
            Total: You {mg.strokesTotalByUid[mg.myUid] ?? 0}
          </Text>
          {mg.opponentPlayer && (
            <Text variant="labelSmall" style={styles.totalLabel}>
              {mg.opponentPlayer.displayName}{" "}
              {mg.strokesTotalByUid[mg.opponentPlayer.uid] ?? 0}
            </Text>
          )}
        </View>
      </View>
    );
  };

  // ---------------------------------------------------------------------------
  // Loading / error / queue states
  // ---------------------------------------------------------------------------
  if (queueError) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.centeredContainer}>
          <Text variant="headlineSmall">Error</Text>
          <Text variant="bodyMedium">{queueError}</Text>
          <Button
            mode="contained"
            onPress={handleBack}
            style={{ marginTop: 16 }}
          >
            Go Back
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  if (isQueueMode) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" />
          <Text variant="bodyLarge" style={{ marginTop: 16 }}>
            Waiting for game to start...
          </Text>
          <Button mode="text" onPress={handleBack} style={{ marginTop: 8 }}>
            Cancel
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  if (!mg.connected && !mg.reconnecting) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" />
          <Text variant="bodyLarge" style={{ marginTop: 16 }}>
            Connecting...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (mg.reconnecting) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" />
          <Text variant="bodyLarge" style={{ marginTop: 16 }}>
            Reconnecting...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (mg.error) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.centeredContainer}>
          <Text variant="headlineSmall">Connection Error</Text>
          <Text variant="bodyMedium">{mg.error}</Text>
          <Button
            mode="contained"
            onPress={handleBack}
            style={{ marginTop: 16 }}
          >
            Go Back
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------
  return (
    <SafeAreaView style={styles.root}>
      {/* Back button (always visible) */}
      <View style={styles.topBar}>
        <IconButton icon="arrow-left" onPress={handleBack} />
        <Text variant="titleSmall">Mini-Golf Duels</Text>
        <View style={{ width: 48 }} />
      </View>

      {/* Phase content */}
      {mg.phase === "waiting" && renderWaiting()}
      {mg.phase === "countdown" && renderCountdown()}
      {(mg.phase === "playing" || mg.phase === "transitioning") &&
        renderPlaying()}
      {mg.phase === "finished" && renderPlaying()}

      {/* Invite picker */}
      <InvitePickerModal
        visible={showInviteModal}
        onDismiss={() => setShowInviteModal(false)}
        onSelectFriend={handleSelectFriend}
        onSelectGroup={handleSelectGroup}
        currentUserId={currentFirebaseUser?.uid || ""}
        title="Invite to Mini-Golf"
      />

      {/* Game over modal */}
      <GameOverModal
        visible={showGameOver}
        result={gameResult}
        stats={{
          ...gameOverStats,
          xpEarned: xpEarned || undefined,
          didLevelUp: didLevelUp || undefined,
          newLevel: newXpLevel || undefined,
        }}
        onRematch={() => {
          mg.sendRematch();
          setShowGameOver(false);
        }}
        onExit={async () => {
          await mg.leaveRoom();
          handleBack();
        }}
        showRematch={!mg.isSpectator}
        title={
          gameResult === "win"
            ? "You Win! ⛳"
            : gameResult === "loss"
              ? "You Lose"
              : "It's a Draw"
        }
      />
    </SafeAreaView>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#1B5E20",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  centeredContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  titleText: {
    color: "#FFFFFF",
    marginBottom: 8,
  },
  subtitleText: {
    color: "#FFFFFFCC",
    marginBottom: 16,
  },
  countdownText: {
    color: "#FFFFFF",
    fontSize: 72,
    fontWeight: "bold",
  },

  // Lobby
  lobbyPlayers: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#FFFFFF15",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  lobbyPlayerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#FFFFFF30",
  },
  lobbyActions: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  actionButton: {
    minWidth: 100,
  },

  // Spectator
  spectatorBanner: {
    backgroundColor: "#FF980040",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: "center",
    marginVertical: 4,
  },
  spectatorText: {
    color: "#FFFFFF",
    textAlign: "center",
  },

  // Playing
  playContainer: {
    flex: 1,
  },
  hud: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  hudRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  hudLabel: {
    color: "#FFFFFFE0",
  },
  hudScore: {
    color: "#FFFFFFCC",
  },
  turnBanner: {
    alignItems: "center",
    marginVertical: 4,
  },
  turnText: {
    paddingHorizontal: 12,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  turnActive: {
    backgroundColor: "#4CAF50",
    color: "#FFFFFF",
  },
  turnInactive: {
    backgroundColor: "#FFFFFF20",
    color: "#FFFFFFAA",
  },
  canvasWrap: {
    flex: 1,
    marginHorizontal: 8,
    marginVertical: 4,
    borderRadius: 8,
    overflow: "hidden",
  },

  // Power meter
  powerMeter: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    alignItems: "center",
  },
  powerTrack: {
    width: "80%",
    height: 8,
    backgroundColor: "#FFFFFF30",
    borderRadius: 4,
    overflow: "hidden",
  },
  powerFill: {
    height: "100%",
    borderRadius: 4,
  },
  powerLabel: {
    color: "#FFFFFFBB",
    marginTop: 2,
  },

  // Total score row
  totalScoreRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  totalLabel: {
    color: "#FFFFFFCC",
  },
});
