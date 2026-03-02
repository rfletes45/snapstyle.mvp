/**
 * BattleshipGameScreen — Full Battleship game with invite lobby + Colyseus
 *
 * Modes:
 * - Invite (default): Real-time 1v1 via Colyseus invite flow
 * - Spectator: Read-only observation via spectator flag
 *
 * Phase machine: lobby → placement → combat → finished
 *
 * How to play:
 * 1. Place all 5 ships on your 10×10 grid (tap to place + rotate)
 * 2. Once both players lock in, take turns firing at opponent's grid
 * 3. Sink all 5 enemy ships to win!
 */

import { MultiplayerLobbyOverlay } from "@/components/games/MultiplayerLobbyOverlay";
import InvitePickerModal, {
  type FriendItem,
  type GroupItem,
} from "@/components/InvitePickerModal";
import {
  useBattleshipGame,
  type ShotRecordClient,
  type SunkShipClient,
} from "@/hooks/useBattleshipGame";
import { useGameBackHandler } from "@/hooks/useGameBackHandler";
import { useGameCompletion } from "@/hooks/useGameCompletion";
import { useGameConnection } from "@/hooks/useGameConnection";
import { useGameLobbyController } from "@/hooks/useGameLobbyController";
import { withMultiplayerRuntime } from "@/screens/games/MultiplayerRuntimeShell";
import { getGroupMembers } from "@/services/groups";
import { useAuth } from "@/store/AuthContext";
import {
  computeGhost,
  type GhostResult,
  type PlacedShip,
} from "@/utils/battleshipPlacement";
import { error as errorBuzz, light as lightTap } from "@/utils/haptics";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";

// =============================================================================
// Constants
// =============================================================================

const GRID_SIZE = 10;
const GAME_TYPE = "battleship";
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_PX = Math.min(SCREEN_WIDTH - 48, 360);
const CELL_PX = Math.floor(GRID_PX / (GRID_SIZE + 1)); // +1 for labels

const ROW_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
const COL_LABELS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

interface FleetShip {
  id: string;
  name: string;
  size: number;
}

const FLEET: FleetShip[] = [
  { id: "carrier", name: "Carrier", size: 5 },
  { id: "battleship", name: "Battleship", size: 4 },
  { id: "cruiser", name: "Cruiser", size: 3 },
  { id: "submarine", name: "Submarine", size: 3 },
  { id: "destroyer", name: "Destroyer", size: 2 },
];

type GameViewState = "lobby" | "game";

// =============================================================================
// Component
// =============================================================================

function BattleshipGameScreen({
  navigation,
  route,
}: {
  navigation: any;
  route: {
    params?: {
      matchId?: string;
      inviteId?: string;
      entryPoint?: string;
      spectatorMode?: boolean;
      v3Session?: string;
      sessionId?: string;
      firestoreGameId?: string;
    };
  };
}) {
  const isV3 = !!route?.params?.v3Session;
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid || "";

  // Game completion hook (for achievements integration)
  const __completionHook = useGameCompletion({ gameType: GAME_TYPE });
  void __completionHook;

  const isSpectatorMode = route?.params?.spectatorMode === true;

  // ── Battleship game hook ────────────────────────────────────────────
  const bs = useBattleshipGame();

  // ── View state ──────────────────────────────────────────────────────
  const [viewState, setViewState] = useState<GameViewState>("lobby");
  const [showInvitePicker, setShowInvitePicker] = useState(false);

  // ── Lobby controller ────────────────────────────────────────────────
  const lobbyController = useGameLobbyController({
    gameType: GAME_TYPE,
    inviteId: route?.params?.inviteId,
    entryPoint: route?.params?.entryPoint,
    isTurnBased: false,
    onGameReady: (gameId: string) => {
      setViewState("game");
      bs.startMultiplayer({
        firestoreGameId: gameId,
        spectator: isSpectatorMode,
        inviteId: route?.params?.inviteId,
      });
    },
    onLeaveLobby: () => {
      navigation.goBack();
    },
    room: bs.room,
    roomPhase:
      bs.phase === "idle" || bs.phase === "connecting" ? null : bs.phase,
    roomReconnecting: bs.reconnecting,
    roomOpponentDisconnected: bs.opponentDisconnected,
    roomError: bs.error,
  });

  // ── Direct matchId support (from chat "Play" overlay) ───────────────
  const { resolvedMode, firestoreGameId: directGameId } = useGameConnection(
    GAME_TYPE,
    route?.params?.matchId,
  );
  // v3 auto-start: bypass useGameConnection, join room directly
  const v3StartedRef = useRef(false);
  useEffect(() => {
    if (!isV3 || v3StartedRef.current) return;
    const fId =
      route?.params?.firestoreGameId ||
      route?.params?.matchId ||
      route?.params?.v3Session;
    if (fId) {
      v3StartedRef.current = true;
      setViewState("game");
      bs.startMultiplayer({ firestoreGameId: fId, spectator: isSpectatorMode });
    }
  }, [
    isV3,
    route?.params?.firestoreGameId,
    route?.params?.matchId,
    route?.params?.v3Session,
    isSpectatorMode,
  ]);

  useEffect(() => {
    if (route?.params?.inviteId || isV3) return;
    if (resolvedMode === "colyseus" && directGameId) {
      setViewState("game");
      bs.startMultiplayer({ firestoreGameId: directGameId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedMode, directGameId, route?.params?.inviteId, isV3]);

  // ── Invite handlers ─────────────────────────────────────────────────
  const handleSelectFriend = useCallback(
    async (friend: FriendItem) => {
      setShowInvitePicker(false);
      await lobbyController.lobby.sendFriendInvite(
        friend.friendUid,
        friend.displayName,
        friend.profilePictureUrl ?? undefined,
      );
    },
    [lobbyController.lobby],
  );

  const handleSelectGroup = useCallback(
    async (group: GroupItem) => {
      setShowInvitePicker(false);
      const members = await getGroupMembers(group.groupId);
      const memberUids = members.map((m: any) => m.uid || m.id);
      await lobbyController.lobby.sendGroupInvite(
        group.groupId,
        group.name,
        memberUids,
      );
    },
    [lobbyController.lobby],
  );

  // ── Back handler ────────────────────────────────────────────────────
  const { handleBack } = useGameBackHandler({
    gameType: GAME_TYPE,
    isGameOver: bs.phase === "finished",
    isMultiplayer: bs.isMultiplayer,
    isInLobby: viewState === "lobby" && !isV3,
    entryPoint: route?.params?.entryPoint,
    onBeforeLeave: async () => {
      if (bs.isMultiplayer) {
        await bs.leave();
      }
    },
  });

  // ── Placement local state ──────────────────────────────────────────
  const [selectedShipId, setSelectedShipId] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">(
    "horizontal",
  );
  /** Cell the player last tapped — drives the ghost preview. */
  const [cursorCell, setCursorCell] = useState<{
    row: number;
    col: number;
  } | null>(null);

  // Determine which ships are placed
  const placedShipIds = useMemo(
    () => new Set(bs.myPlacements.map((p) => p.shipId)),
    [bs.myPlacements],
  );

  // Bridge myPlacements to PlacedShip[] for the ghost calculator
  const placedShipsForGhost: PlacedShip[] = useMemo(
    () => bs.myPlacements.map((p) => ({ shipId: p.shipId, cells: p.cells })),
    [bs.myPlacements],
  );

  // Ghost preview computation
  const ghost: GhostResult | null = useMemo(() => {
    if (!selectedShipId || !cursorCell) return null;
    const ship = FLEET.find((f) => f.id === selectedShipId);
    if (!ship) return null;
    return computeGhost(
      cursorCell.row,
      cursorCell.col,
      ship.size,
      orientation,
      placedShipsForGhost,
      GRID_SIZE,
      // Exclude the selected ship so re-placing doesn't self-overlap
      placedShipIds.has(selectedShipId) ? selectedShipId : undefined,
    );
  }, [
    selectedShipId,
    cursorCell,
    orientation,
    placedShipsForGhost,
    placedShipIds,
  ]);

  // Ghost cells as a lookup set for rendering
  const ghostCellSet = useMemo(() => {
    if (!ghost) return new Set<string>();
    return new Set(ghost.cells.map((c) => `${c.row},${c.col}`));
  }, [ghost]);

  // Build own grid view (placement phase)
  const ownGridData = useMemo(() => {
    const grid: string[][] = Array.from({ length: GRID_SIZE }, () =>
      Array(GRID_SIZE).fill(""),
    );
    for (const p of bs.myPlacements) {
      for (const cell of p.cells) {
        grid[cell.row][cell.col] = p.shipId;
      }
    }
    return grid;
  }, [bs.myPlacements]);

  // Build incoming shots on own board (combat phase)
  const incomingShotMap = useMemo(() => {
    const map = new Map<string, ShotRecordClient>();
    for (const shot of bs.shotHistory) {
      if (shot.targetUid === bs.myUid) {
        map.set(`${shot.row},${shot.col}`, shot);
      }
    }
    return map;
  }, [bs.shotHistory, bs.myUid]);

  // Build outgoing shots on enemy board (combat phase)
  const outgoingShotMap = useMemo(() => {
    const map = new Map<string, ShotRecordClient>();
    for (const shot of bs.shotHistory) {
      if (shot.shooterUid === bs.myUid) {
        map.set(`${shot.row},${shot.col}`, shot);
      }
    }
    return map;
  }, [bs.shotHistory, bs.myUid]);

  // Sunk ships on enemy board (opponent's ships that I sunk)
  const enemySunkShips = useMemo(
    () => bs.sunkShips.filter((s) => s.ownerUid !== bs.myUid),
    [bs.sunkShips, bs.myUid],
  );

  // Sunk ships on my board
  const mySunkShips = useMemo(
    () => bs.sunkShips.filter((s) => s.ownerUid === bs.myUid),
    [bs.sunkShips, bs.myUid],
  );

  // ── Placement tap handler ──────────────────────────────────────────
  // First tap → show ghost preview.  Second tap on same cell → commit.
  const handlePlacementCellTap = useCallback(
    (row: number, col: number) => {
      if (!selectedShipId || bs.myPlayer?.placementReady) return;

      // If a ghost is already showing at this cell — commit
      if (
        cursorCell &&
        cursorCell.row === row &&
        cursorCell.col === col &&
        ghost
      ) {
        if (ghost.isValid) {
          lightTap();
          bs.placeShip(selectedShipId, row, col, orientation);
          setCursorCell(null);
          // Auto-advance to next unplaced ship
          const nextShip = FLEET.find(
            (f) => f.id !== selectedShipId && !placedShipIds.has(f.id),
          );
          setSelectedShipId(nextShip?.id ?? null);
        } else {
          errorBuzz();
        }
        return;
      }

      // First tap → move ghost preview
      lightTap();
      setCursorCell({ row, col });
    },
    [selectedShipId, orientation, bs, cursorCell, ghost, placedShipIds],
  );

  // Reset cursor when orientation changes (ghost shape changes)
  // Keep cursorCell so the ghost visually rotates in place.
  // No need to clear it — the ghost recomputes automatically.

  // Reset cursor when ship selection changes
  useEffect(() => {
    setCursorCell(null);
  }, [selectedShipId]);

  // ── Combat tap handler (fire) ──────────────────────────────────────
  const handleFireCellTap = useCallback(
    (row: number, col: number) => {
      if (!bs.isMyTurn || bs.phase !== "combat" || bs.isSpectator) return;
      if (outgoingShotMap.has(`${row},${col}`)) return; // Already shot
      bs.fire(row, col);
    },
    [bs, outgoingShotMap],
  );

  // ═══════════════════════════════════════════════════════════════════════
  // Render — Lobby
  // ═══════════════════════════════════════════════════════════════════════

  if (
    viewState === "lobby" &&
    !isV3 &&
    bs.phase !== "placement" &&
    bs.phase !== "combat" &&
    bs.phase !== "finished"
  ) {
    return (
      <View style={[styles.container, { backgroundColor: "#0a1628" }]}>
        <MultiplayerLobbyOverlay
          controller={lobbyController}
          gameTitle="Battleship"
          gameIcon="🚢"
          onInvitePress={() => setShowInvitePicker(true)}
          onLeave={() => {
            lobbyController.lobby.leaveLobby();
            navigation.goBack();
          }}
          showReadyButton={false}
        >
          <View style={{ flex: 1 }} />
        </MultiplayerLobbyOverlay>

        <InvitePickerModal
          visible={showInvitePicker}
          onDismiss={() => setShowInvitePicker(false)}
          onSelectFriend={handleSelectFriend}
          onSelectGroup={handleSelectGroup}
          currentUserId={uid}
          title="Challenge to Battleship"
        />
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Render — Game (placement / combat / finished)
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <View style={[styles.container, { backgroundColor: "#0a1628" }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🚢 Battleship</Text>
        <View style={styles.headerRight}>
          {bs.spectatorCount > 0 && (
            <View style={styles.spectatorBadge}>
              <MaterialCommunityIcons name="eye" size={14} color="#9C27B0" />
              <Text style={styles.spectatorText}>{bs.spectatorCount}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Connection info bar */}
      {bs.reconnecting && (
        <View style={styles.connectionBar}>
          <Text style={styles.connectionBarText}>Reconnecting…</Text>
        </View>
      )}
      {bs.opponentDisconnected && !bs.reconnecting && (
        <View style={[styles.connectionBar, { backgroundColor: "#FF9800" }]}>
          <Text style={styles.connectionBarText}>
            Opponent disconnected — waiting for reconnect…
          </Text>
        </View>
      )}

      {/* Player info strip */}
      <View style={styles.playerStrip}>
        {bs.isSpectator ? (
          <>
            <PlayerInfo
              label={bs.myPlayer?.displayName || "Player 1"}
              player={bs.myPlayer}
              isActive={
                bs.currentTurnUid === bs.myPlayer?.uid && bs.phase === "combat"
              }
            />
            <Text style={styles.vsText}>VS</Text>
            <PlayerInfo
              label={bs.opponentPlayer?.displayName || "Player 2"}
              player={bs.opponentPlayer}
              isActive={
                bs.currentTurnUid === bs.opponentPlayer?.uid &&
                bs.phase === "combat"
              }
            />
          </>
        ) : (
          <>
            <PlayerInfo
              label="You"
              player={bs.myPlayer}
              isActive={bs.isMyTurn && bs.phase === "combat"}
            />
            <Text style={styles.vsText}>VS</Text>
            <PlayerInfo
              label={bs.opponentPlayer?.displayName || "Opponent"}
              player={bs.opponentPlayer}
              isActive={!bs.isMyTurn && bs.phase === "combat"}
            />
          </>
        )}
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
      >
        {/* ── PLACEMENT PHASE ────────────────────────────────────── */}
        {bs.phase === "placement" && (
          <PlacementView
            ownGrid={ownGridData}
            placedShipIds={placedShipIds}
            selectedShipId={selectedShipId}
            orientation={orientation}
            ghostCellSet={ghostCellSet}
            ghostValidity={
              ghost ? (ghost.isValid ? "valid" : "invalid") : "none"
            }
            onSelectShip={setSelectedShipId}
            onToggleOrientation={() =>
              setOrientation((o) =>
                o === "horizontal" ? "vertical" : "horizontal",
              )
            }
            onCellTap={handlePlacementCellTap}
            onRandomize={bs.randomize}
            onLockIn={bs.lockIn}
            isLocked={bs.myPlayer?.placementReady ?? false}
            opponentReady={bs.opponentPlayer?.placementReady ?? false}
            timeRemaining={bs.placementTimeRemaining}
            isSpectator={bs.isSpectator}
          />
        )}

        {/* ── COMBAT PHASE ───────────────────────────────────────── */}
        {bs.phase === "combat" && (
          <CombatView
            isMyTurn={bs.isMyTurn}
            isSpectator={bs.isSpectator}
            turnNumber={bs.turnNumber}
            turnTimeRemaining={bs.turnTimeRemaining}
            currentTurnUid={bs.currentTurnUid}
            myUid={bs.myUid}
            myPlayer={bs.myPlayer}
            opponentPlayer={bs.opponentPlayer}
            ownGrid={ownGridData}
            incomingShotMap={incomingShotMap}
            outgoingShotMap={outgoingShotMap}
            enemySunkShips={enemySunkShips}
            mySunkShips={mySunkShips}
            lastActionType={bs.lastActionType}
            lastActionRow={bs.lastActionRow}
            lastActionCol={bs.lastActionCol}
            onFireCell={handleFireCellTap}
            onSurrender={bs.surrender}
          />
        )}

        {/* ── FINISHED PHASE ─────────────────────────────────────── */}
        {/* In v3 mode the SessionRuntimeShell navigates to
            SessionGameOverScreen automatically — skip custom end UI. */}
        {bs.phase === "finished" && !isV3 && (
          <FinishedView
            isWinner={bs.isWinner}
            winReason={bs.winReason}
            myPlayer={bs.myPlayer}
            opponentPlayer={bs.opponentPlayer}
            turnNumber={bs.turnNumber}
            shotHistory={bs.shotHistory}
            myUid={bs.myUid}
            onExit={handleBack}
          />
        )}

        {/* ── WAITING / CONNECTING ───────────────────────────────── */}
        {(bs.phase === "waiting" ||
          bs.phase === "connecting" ||
          bs.phase === "idle") && (
          <View style={styles.centeredMessage}>
            <Text style={styles.waitingText}>
              {bs.phase === "connecting"
                ? "Connecting to server…"
                : "Waiting for opponent…"}
            </Text>
          </View>
        )}

        {/* ── ERROR PHASE ────────────────────────────────────────── */}
        {bs.phase === "error" && (
          <View style={styles.centeredMessage}>
            <Text style={[styles.waitingText, { color: "#ff6b6b" }]}>
              Connection Failed
            </Text>
            <Text
              style={[
                styles.waitingText,
                { fontSize: 14, marginTop: 8, opacity: 0.7 },
              ]}
            >
              {bs.error || "Unable to connect to the game server."}
            </Text>
            <TouchableOpacity
              style={{
                marginTop: 20,
                paddingHorizontal: 24,
                paddingVertical: 12,
                backgroundColor: "#1a3a5c",
                borderRadius: 8,
              }}
              onPress={handleBack}
            >
              <Text style={{ color: "#fff", fontSize: 16 }}>Go Back</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

// ── Player Info Strip ─────────────────────────────────────────────────────

function PlayerInfo({
  label,
  player,
  isActive,
}: {
  label: string;
  player: ReturnType<typeof useBattleshipGame>["myPlayer"];
  isActive: boolean;
}) {
  return (
    <View style={[styles.playerInfo, isActive && styles.playerInfoActive]}>
      <Text style={styles.playerLabel}>{label}</Text>
      <Text style={styles.playerName} numberOfLines={1}>
        {player?.displayName || "—"}
      </Text>
      <View style={styles.playerStats}>
        <Text style={styles.statText}>
          🚢 {player?.shipsRemaining ?? 5}/{FLEET.length}
        </Text>
        {player && (
          <View
            style={[
              styles.connDot,
              {
                backgroundColor: player.connected ? "#4CAF50" : "#F44336",
              },
            ]}
          />
        )}
      </View>
    </View>
  );
}

// ── Placement View ────────────────────────────────────────────────────────

function PlacementView({
  ownGrid,
  placedShipIds,
  selectedShipId,
  orientation,
  ghostCellSet,
  ghostValidity,
  onSelectShip,
  onToggleOrientation,
  onCellTap,
  onRandomize,
  onLockIn,
  isLocked,
  opponentReady,
  timeRemaining,
  isSpectator,
}: {
  ownGrid: string[][];
  placedShipIds: Set<string>;
  selectedShipId: string | null;
  orientation: "horizontal" | "vertical";
  ghostCellSet: Set<string>;
  ghostValidity: "valid" | "invalid" | "none";
  onSelectShip: (id: string | null) => void;
  onToggleOrientation: () => void;
  onCellTap: (row: number, col: number) => void;
  onRandomize: () => void;
  onLockIn: () => void;
  isLocked: boolean;
  opponentReady: boolean;
  timeRemaining: number;
  isSpectator: boolean;
}) {
  const allPlaced = placedShipIds.size === FLEET.length;
  const timerSec = Math.ceil(timeRemaining / 1000);

  return (
    <View style={styles.phaseContainer}>
      <View style={styles.phaseHeader}>
        <Text style={styles.phaseTitle}>Place Your Ships</Text>
        <Text style={[styles.timerText, timerSec <= 10 && styles.timerDanger]}>
          ⏱ {timerSec}s
        </Text>
      </View>

      {opponentReady && (
        <Text style={styles.opponentStatus}>✅ Opponent is ready!</Text>
      )}

      {isLocked && (
        <Text style={styles.lockedStatus}>
          ✅ Your ships are locked in. Waiting for opponent…
        </Text>
      )}

      {/* Ship palette */}
      {!isLocked && !isSpectator && (
        <View style={styles.shipPalette}>
          {FLEET.map((ship) => {
            const isPlaced = placedShipIds.has(ship.id);
            const isSelected = selectedShipId === ship.id;
            return (
              <TouchableOpacity
                key={ship.id}
                style={[
                  styles.shipChip,
                  isPlaced && styles.shipChipPlaced,
                  isSelected && styles.shipChipSelected,
                ]}
                onPress={() => onSelectShip(isSelected ? null : ship.id)}
              >
                <Text style={styles.shipChipText}>
                  {ship.name} ({ship.size})
                </Text>
                {isPlaced && <Text style={styles.shipChipCheck}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Controls */}
      {!isLocked && !isSpectator && (
        <View style={styles.placementControls}>
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={onToggleOrientation}
          >
            <MaterialCommunityIcons
              name="rotate-right"
              size={20}
              color="#fff"
            />
            <Text style={styles.controlBtnText}>
              {orientation === "horizontal" ? "H" : "V"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlBtn} onPress={onRandomize}>
            <MaterialCommunityIcons name="shuffle" size={20} color="#fff" />
            <Text style={styles.controlBtnText}>Random</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.controlBtn,
              styles.readyBtn,
              !allPlaced && styles.btnDisabled,
            ]}
            onPress={onLockIn}
            disabled={!allPlaced}
          >
            <MaterialCommunityIcons name="check-bold" size={20} color="#fff" />
            <Text style={styles.controlBtnText}>Ready</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Selected ship info */}
      {!isLocked && !isSpectator && selectedShipId && (
        <View style={styles.selectedShipInfo}>
          <Text style={styles.selectedShipText}>
            {FLEET.find((f) => f.id === selectedShipId)?.name ?? selectedShipId}{" "}
            ({FLEET.find((f) => f.id === selectedShipId)?.size ?? "?"})
          </Text>
          <Text style={styles.orientationBadge}>
            {orientation === "horizontal" ? "↔ Horizontal" : "↕ Vertical"}
          </Text>
          {ghostValidity === "invalid" && (
            <Text style={styles.invalidHint}>⚠ Invalid position</Text>
          )}
          {ghostValidity === "valid" && (
            <Text style={styles.validHint}>Tap again to place</Text>
          )}
        </View>
      )}

      {/* Grid */}
      <GridView
        grid={ownGrid}
        onCellTap={!isLocked && !isSpectator ? onCellTap : undefined}
        shotMap={new Map()}
        shipGrid={ownGrid}
        showShips={true}
        sunkShips={[]}
        isEnemy={false}
        ghostCellSet={ghostCellSet}
        ghostValidity={ghostValidity}
      />
    </View>
  );
}

// ── Combat View ───────────────────────────────────────────────────────────

function CombatView({
  isMyTurn,
  isSpectator,
  turnNumber,
  turnTimeRemaining,
  currentTurnUid,
  myUid,
  myPlayer,
  opponentPlayer,
  ownGrid,
  incomingShotMap,
  outgoingShotMap,
  enemySunkShips,
  mySunkShips,
  lastActionType,
  lastActionRow,
  lastActionCol,
  onFireCell,
  onSurrender,
}: {
  isMyTurn: boolean;
  isSpectator: boolean;
  turnNumber: number;
  turnTimeRemaining: number;
  currentTurnUid: string;
  myUid: string;
  myPlayer: any;
  opponentPlayer: any;
  ownGrid: string[][];
  incomingShotMap: Map<string, ShotRecordClient>;
  outgoingShotMap: Map<string, ShotRecordClient>;
  enemySunkShips: SunkShipClient[];
  mySunkShips: SunkShipClient[];
  lastActionType: string;
  lastActionRow: number;
  lastActionCol: number;
  onFireCell: (row: number, col: number) => void;
  onSurrender: () => void;
}) {
  const timerSec = Math.ceil(turnTimeRemaining / 1000);

  // Build enemy grid for display (only shows shots + sunk outlines)
  const enemyGrid: string[][] = useMemo(() => {
    const grid = Array.from({ length: GRID_SIZE }, () =>
      Array(GRID_SIZE).fill(""),
    );
    for (const sunk of enemySunkShips) {
      for (const cell of sunk.cells) {
        grid[cell.row][cell.col] = sunk.shipId;
      }
    }
    return grid;
  }, [enemySunkShips]);

  return (
    <View style={styles.phaseContainer}>
      {/* Turn indicator */}
      <View style={styles.turnHeader}>
        <Text style={styles.turnText}>
          Turn {turnNumber} —{" "}
          {isSpectator
            ? `${currentTurnUid === myPlayer?.uid ? myPlayer?.displayName : opponentPlayer?.displayName}'s turn`
            : isMyTurn
              ? "Your turn! 🎯"
              : `${opponentPlayer?.displayName || "Opponent"}'s turn…`}
        </Text>
        <Text style={[styles.timerText, timerSec <= 5 && styles.timerDanger]}>
          ⏱ {timerSec}s
        </Text>
      </View>

      {/* Last action notification */}
      {lastActionType && (
        <View
          style={[
            styles.lastAction,
            lastActionType === "miss"
              ? styles.lastActionMiss
              : lastActionType === "sunk"
                ? styles.lastActionSunk
                : styles.lastActionHit,
          ]}
        >
          <Text style={styles.lastActionText}>
            {lastActionType === "miss"
              ? `💦 Miss at ${ROW_LABELS[lastActionRow]}${lastActionCol + 1}`
              : lastActionType === "hit"
                ? `💥 Hit at ${ROW_LABELS[lastActionRow]}${lastActionCol + 1}!`
                : `🔥 SUNK at ${ROW_LABELS[lastActionRow]}${lastActionCol + 1}!`}
          </Text>
        </View>
      )}

      {/* Enemy grid — for firing */}
      <Text style={styles.gridLabel}>
        {isSpectator
          ? `${opponentPlayer?.displayName}'s Board`
          : "Enemy Waters"}
      </Text>
      <GridView
        grid={enemyGrid}
        onCellTap={!isSpectator && isMyTurn ? onFireCell : undefined}
        shotMap={outgoingShotMap}
        shipGrid={enemyGrid}
        showShips={false}
        sunkShips={enemySunkShips}
        isEnemy={true}
        lastActionRow={lastActionRow}
        lastActionCol={lastActionCol}
        lastActionType={lastActionType}
      />

      {/* Own grid — showing ships + incoming hits */}
      <Text style={[styles.gridLabel, { marginTop: 16 }]}>
        {isSpectator ? `${myPlayer?.displayName}'s Board` : "Your Fleet"}
      </Text>
      <GridView
        grid={ownGrid}
        shotMap={incomingShotMap}
        shipGrid={ownGrid}
        showShips={!isSpectator}
        sunkShips={mySunkShips}
        isEnemy={false}
      />

      {/* Surrender button */}
      {!isSpectator && (
        <TouchableOpacity style={styles.surrenderBtn} onPress={onSurrender}>
          <Text style={styles.surrenderText}>🏳️ Surrender</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Grid View ─────────────────────────────────────────────────────────────

function GridView({
  grid,
  onCellTap,
  shotMap,
  shipGrid,
  showShips,
  sunkShips,
  isEnemy,
  lastActionRow,
  lastActionCol,
  lastActionType,
  ghostCellSet,
  ghostValidity,
}: {
  grid: string[][];
  onCellTap?: (row: number, col: number) => void;
  shotMap: Map<string, ShotRecordClient>;
  shipGrid: string[][];
  showShips: boolean;
  sunkShips: SunkShipClient[];
  isEnemy: boolean;
  lastActionRow?: number;
  lastActionCol?: number;
  lastActionType?: string;
  ghostCellSet?: Set<string>;
  ghostValidity?: "valid" | "invalid" | "none";
}) {
  // Build set of sunk ship cells for highlighting
  const sunkCells = useMemo(() => {
    const set = new Set<string>();
    for (const ship of sunkShips) {
      for (const cell of ship.cells) {
        set.add(`${cell.row},${cell.col}`);
      }
    }
    return set;
  }, [sunkShips]);

  return (
    <View style={styles.gridContainer}>
      {/* Column labels */}
      <View style={styles.gridRow}>
        <View style={[styles.gridCell, styles.labelCell]} />
        {COL_LABELS.map((label) => (
          <View key={label} style={[styles.gridCell, styles.labelCell]}>
            <Text style={styles.labelText}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Grid rows */}
      {Array.from({ length: GRID_SIZE }, (_, row) => (
        <View key={row} style={styles.gridRow}>
          {/* Row label */}
          <View style={[styles.gridCell, styles.labelCell]}>
            <Text style={styles.labelText}>{ROW_LABELS[row]}</Text>
          </View>

          {/* Cells */}
          {Array.from({ length: GRID_SIZE }, (_, col) => {
            const key = `${row},${col}`;
            const shot = shotMap.get(key);
            const hasShip = showShips && shipGrid[row][col] !== "";
            const isSunkCell = sunkCells.has(key);
            const isLastAction =
              lastActionRow === row &&
              lastActionCol === col &&
              !!lastActionType;
            const isGhost = ghostCellSet?.has(key) ?? false;

            let cellStyle = styles.waterCell;
            let cellContent = "";

            if (shot) {
              if (shot.result === "miss") {
                cellStyle = styles.missCell;
                cellContent = "•";
              } else if (shot.result === "hit" || shot.result === "sunk") {
                cellStyle = styles.hitCell;
                cellContent = "✕";
              }
            } else if (isGhost) {
              // Ghost preview layer (drawn on top of water, under placed ships)
              cellStyle =
                ghostValidity === "valid"
                  ? styles.ghostValidCell
                  : styles.ghostInvalidCell;
            } else if (hasShip) {
              cellStyle = styles.shipCell;
            } else if (isSunkCell && isEnemy) {
              cellStyle = styles.sunkOutlineCell;
            }

            const canTap = !!onCellTap && !shot;

            return (
              <Pressable
                key={col}
                style={({ pressed }) => [
                  styles.gridCell,
                  cellStyle,
                  isLastAction && styles.lastActionCell,
                  canTap && pressed && styles.cellPressed,
                  // Web: show pointer cursor for clickable cells
                  canTap &&
                    Platform.OS === "web" &&
                    ({ cursor: "pointer", userSelect: "none" } as any),
                ]}
                onPress={canTap ? () => onCellTap!(row, col) : undefined}
                disabled={!canTap}
              >
                {cellContent ? (
                  <Text
                    style={[
                      styles.cellText,
                      shot?.result === "hit" || shot?.result === "sunk"
                        ? styles.hitCellText
                        : styles.missCellText,
                    ]}
                  >
                    {cellContent}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ── Finished View ─────────────────────────────────────────────────────────

function FinishedView({
  isWinner,
  winReason,
  myPlayer,
  opponentPlayer,
  turnNumber,
  shotHistory,
  myUid,
  onExit,
}: {
  isWinner: boolean | null;
  winReason: string;
  myPlayer: any;
  opponentPlayer: any;
  turnNumber: number;
  shotHistory: ShotRecordClient[];
  myUid: string;
  onExit: () => void;
}) {
  const myShots = shotHistory.filter((s) => s.shooterUid === myUid);
  const myHits = myShots.filter(
    (s) => s.result === "hit" || s.result === "sunk",
  ).length;
  const accuracy =
    myShots.length > 0 ? Math.round((myHits / myShots.length) * 100) : 0;

  const reasonLabel =
    winReason === "sunk"
      ? "All ships sunk"
      : winReason === "surrender"
        ? "Surrender"
        : winReason === "disconnect"
          ? "Disconnect"
          : winReason === "timeout"
            ? "Timeout"
            : winReason;

  return (
    <View style={styles.finishedContainer}>
      <Text style={styles.resultEmoji}>
        {isWinner === true ? "🏆" : isWinner === false ? "💀" : "🤝"}
      </Text>
      <Text style={styles.resultTitle}>
        {isWinner === true
          ? "Victory!"
          : isWinner === false
            ? "Defeat"
            : "Game Over"}
      </Text>
      <Text style={styles.resultReason}>{reasonLabel}</Text>

      <View style={styles.statsGrid}>
        <StatItem label="Turns" value={String(turnNumber)} />
        <StatItem label="Shots" value={String(myShots.length)} />
        <StatItem label="Hits" value={String(myHits)} />
        <StatItem label="Accuracy" value={`${accuracy}%`} />
        <StatItem
          label="Ships Left"
          value={String(myPlayer?.shipsRemaining ?? 0)}
        />
        <StatItem
          label="Opp. Ships"
          value={String(opponentPlayer?.shipsRemaining ?? 0)}
        />
      </View>

      <TouchableOpacity style={styles.exitBtn} onPress={onExit}>
        <Text style={styles.exitBtnText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // ── Header ──────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 8,
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  headerRight: {
    width: 40,
    alignItems: "flex-end",
  },
  spectatorBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(156,39,176,0.2)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  spectatorText: {
    color: "#CE93D8",
    fontSize: 12,
    fontWeight: "600",
  },
  // ── Connection bar ──────────────────────────────────────────────────
  connectionBar: {
    backgroundColor: "#F44336",
    paddingVertical: 4,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  connectionBarText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  // ── Player strip ────────────────────────────────────────────────────
  playerStrip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  playerInfo: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    padding: 10,
    borderWidth: 2,
    borderColor: "transparent",
  },
  playerInfoActive: {
    borderColor: "#4CAF50",
  },
  playerLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  playerName: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 2,
  },
  playerStats: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  statText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
  },
  connDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  vsText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 14,
    fontWeight: "700",
  },
  // ── Scroll content ──────────────────────────────────────────────────
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  // ── Phase container ─────────────────────────────────────────────────
  phaseContainer: {
    marginTop: 8,
  },
  phaseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  phaseTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  timerText: {
    color: "#4CAF50",
    fontSize: 16,
    fontWeight: "700",
  },
  timerDanger: {
    color: "#F44336",
  },
  opponentStatus: {
    color: "#4CAF50",
    fontSize: 13,
    marginBottom: 8,
  },
  lockedStatus: {
    color: "#2196F3",
    fontSize: 13,
    marginBottom: 8,
  },
  // ── Ship palette ────────────────────────────────────────────────────
  shipPalette: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  shipChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  shipChipPlaced: {
    borderColor: "#4CAF50",
    backgroundColor: "rgba(76,175,80,0.15)",
  },
  shipChipSelected: {
    borderColor: "#2196F3",
    backgroundColor: "rgba(33,150,243,0.2)",
  },
  shipChipText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  shipChipCheck: {
    color: "#4CAF50",
    fontSize: 14,
    marginLeft: 4,
  },
  // ── Placement controls ──────────────────────────────────────────────
  placementControls: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  controlBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  controlBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  readyBtn: {
    backgroundColor: "#4CAF50",
  },
  btnDisabled: {
    opacity: 0.4,
  },
  // ── Grid ────────────────────────────────────────────────────────────
  gridContainer: {
    alignSelf: "center",
  },
  gridRow: {
    flexDirection: "row",
  },
  gridCell: {
    width: CELL_PX,
    height: CELL_PX,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.15)",
  },
  labelCell: {
    backgroundColor: "transparent",
    borderWidth: 0,
  },
  labelText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
    fontWeight: "600",
  },
  waterCell: {
    backgroundColor: "rgba(13,71,161,0.4)",
  },
  shipCell: {
    backgroundColor: "rgba(120,144,156,0.6)",
  },
  missCell: {
    backgroundColor: "rgba(13,71,161,0.25)",
  },
  hitCell: {
    backgroundColor: "rgba(244,67,54,0.5)",
  },
  sunkOutlineCell: {
    backgroundColor: "rgba(120,144,156,0.3)",
  },
  // ── Ghost preview cells ──────────────────────────────────────────────
  ghostValidCell: {
    backgroundColor: "rgba(76,175,80,0.35)",
    borderColor: "rgba(76,175,80,0.6)",
    borderWidth: 1,
  },
  ghostInvalidCell: {
    backgroundColor: "rgba(244,67,54,0.3)",
    borderColor: "rgba(244,67,54,0.55)",
    borderWidth: 1,
  },
  cellPressed: {
    opacity: 0.6,
  },
  // ── Selected ship info ───────────────────────────────────────────────
  selectedShipInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  selectedShipText: {
    color: "#82B1FF",
    fontSize: 13,
    fontWeight: "700",
  },
  orientationBadge: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontWeight: "600",
  },
  invalidHint: {
    color: "#EF9A9A",
    fontSize: 12,
    fontWeight: "600",
  },
  validHint: {
    color: "#A5D6A7",
    fontSize: 12,
    fontWeight: "600",
  },
  lastActionCell: {
    borderWidth: 2,
    borderColor: "#FFD600",
  },
  cellText: {
    fontSize: 14,
    fontWeight: "700",
  },
  hitCellText: {
    color: "#F44336",
  },
  missCellText: {
    color: "rgba(255,255,255,0.4)",
  },
  // ── Turn header ─────────────────────────────────────────────────────
  turnHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  turnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  // ── Last action ─────────────────────────────────────────────────────
  lastAction: {
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 8,
    alignItems: "center",
  },
  lastActionMiss: {
    backgroundColor: "rgba(33,150,243,0.2)",
  },
  lastActionHit: {
    backgroundColor: "rgba(255,152,0,0.2)",
  },
  lastActionSunk: {
    backgroundColor: "rgba(244,67,54,0.2)",
  },
  lastActionText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  // ── Grid label ──────────────────────────────────────────────────────
  gridLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  // ── Surrender ───────────────────────────────────────────────────────
  surrenderBtn: {
    alignSelf: "center",
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "rgba(244,67,54,0.2)",
    borderWidth: 1,
    borderColor: "rgba(244,67,54,0.4)",
  },
  surrenderText: {
    color: "#EF9A9A",
    fontSize: 14,
    fontWeight: "600",
  },
  // ── Finished ────────────────────────────────────────────────────────
  finishedContainer: {
    alignItems: "center",
    paddingTop: 32,
  },
  resultEmoji: {
    fontSize: 64,
    marginBottom: 12,
  },
  resultTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 4,
  },
  resultReason: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    marginBottom: 24,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
    marginBottom: 32,
  },
  statItem: {
    alignItems: "center",
    minWidth: 80,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    padding: 12,
  },
  statValue: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
  },
  statLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
    textTransform: "uppercase",
  },
  exitBtn: {
    backgroundColor: "#2196F3",
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  exitBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  // ── Waiting ─────────────────────────────────────────────────────────
  centeredMessage: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
  },
  waitingText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default withMultiplayerRuntime(BattleshipGameScreen);
