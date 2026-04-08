/**
 * Games V4 — Battleship Game Screen (Polished)
 *
 * Mobile-first UI for the Battleship game with premium presentation.
 * Handles three phases: Setup (fleet placement), Battle (firing), and Spectator.
 *
 * Uses the withGameV4Shell HOC for session management, move submission,
 * and auto-navigation to GameOverV4 on terminal.
 *
 * Hidden-info safe:
 *   - Ship placements are never displayed from public state during battle.
 *   - Spectators see only fog-of-war (shots + results).
 *   - Post-game reveal uses resolved.reveal data.
 *
 * @module gamesV4/screens/BattleshipScreenV4
 */

import {
  GameShellProps,
  withGameV4Shell,
} from "@/gamesV4/components/GameScreenShell";
import { subscribeToPrivateState } from "@/gamesV4/services/gameServiceV4";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  LinearTransition,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  autoPlaceFleet,
  computeShipCells,
  validateFleetPlacement,
} from "../adapters/battleship/battleshipEngine";
import type {
  BattleshipPrivateState,
  BattleshipPublicState,
  Direction,
  PlayerStats,
  ShipPlacement,
} from "../adapters/battleship/battleshipTypes";
import { getFleetForPreset } from "../adapters/battleship/battleshipTypes";
import type {
  BattleLogEntry,
  BattlePhaseId,
  CellStatus,
  GridCellData,
} from "./battleship";
import {
  BattleshipGrid,
  BoardCard,
  BS,
  EventRibbon,
  FleetStatus,
  PhaseChip,
  ShipCarousel,
  StatBadge,
  useBattleshipFeedback,
  useBattleshipTheme,
} from "./battleship";

// =============================================================================
// Helpers
// =============================================================================

function asState(
  ps: Record<string, unknown> | null,
): BattleshipPublicState | null {
  if (!ps) return null;
  return ps as unknown as BattleshipPublicState;
}

function asPrivateState(
  ps: Record<string, unknown> | null,
): BattleshipPrivateState | null {
  if (!ps) return null;
  return ps as unknown as BattleshipPrivateState;
}

function cellKey(r: number, c: number): string {
  return r + "," + c;
}

function colLabel(c: number): string {
  return String.fromCharCode(65 + c);
}

function emptyStats(): PlayerStats {
  return {
    hits: 0,
    misses: 0,
    accuracy: 0,
    shipsRemaining: 0,
    shipsSunk: 0,
    turnsTaken: 0,
  };
}

/** Derive event type from the lastEvent string for ribbon styling */
function inferEventType(
  evt: string | null,
): "hit" | "miss" | "sunk" | "phase" | "info" {
  if (!evt) return "info";
  const lower = evt.toLowerCase();
  if (lower.includes("sunk") || lower.includes("sank")) return "sunk";
  if (lower.includes("hit")) return "hit";
  if (lower.includes("miss")) return "miss";
  if (
    lower.includes("begins") ||
    lower.includes("deployed") ||
    lower.includes("ready")
  )
    return "phase";
  return "info";
}

/** Build a battle log from shot history */
function buildBattleLog(
  state: BattleshipPublicState,
  turnOrder: string[],
): BattleLogEntry[] {
  const entries: BattleLogEntry[] = [];
  for (const defenderUid of turnOrder) {
    const shots = state.shotsByDefender[defenderUid] ?? {};
    const attackerUid = turnOrder.find((u) => u !== defenderUid) ?? "?";
    const attackerIdx = turnOrder.indexOf(attackerUid) + 1;
    for (const [key, shot] of Object.entries(shots)) {
      const [r, c] = key.split(",").map(Number);
      const coord = colLabel(c) + (r + 1);
      let text =
        "P" +
        attackerIdx +
        " fired " +
        coord +
        " - " +
        shot.result.toUpperCase();
      if (shot.result === "sunk" && shot.shipId) {
        text += " (" + shot.shipId + ")";
      }
      entries.push({
        id: defenderUid + "-" + key,
        text,
        type:
          shot.result === "sunk"
            ? "sunk"
            : shot.result === "hit"
              ? "hit"
              : "miss",
        turn: shot.atTurn,
      });
    }
  }
  entries.sort((a, b) => (a.turn ?? 0) - (b.turn ?? 0));
  return entries;
}

// =============================================================================
// Setup Phase - Fleet Placement UI
// =============================================================================

interface SetupPhaseProps {
  state: BattleshipPublicState;
  myUid: string;
  submitMove: (payload: Record<string, unknown>) => Promise<boolean>;
  actionLoading: boolean;
  tokens: ReturnType<typeof useBattleshipTheme>;
  onPlacementsConfirmed: (placements: ShipPlacement[]) => void;
}

function SetupPhase({
  state,
  myUid,
  submitMove,
  actionLoading,
  tokens,
  onPlacementsConfirmed,
}: SetupPhaseProps) {
  const gridSize = state.rules.gridSize;
  const fleet = getFleetForPreset(state.rules.fleetPreset);
  const isReady = state.setup.readyByUid[myUid] ?? false;
  const feedback = useBattleshipFeedback(true);
  const insets = useSafeAreaInsets();

  const [placements, setPlacements] = useState<ShipPlacement[]>([]);
  const [selectedShipId, setSelectedShipId] = useState<string | null>(
    fleet[0]?.shipId ?? null,
  );
  const [direction, setDirection] = useState<Direction>("H");

  // Build grid from current placements
  const gridCells = useMemo(() => {
    const grid: GridCellData[][] = Array.from({ length: gridSize }, () =>
      Array.from({ length: gridSize }, () => ({
        status: "empty" as CellStatus,
      })),
    );
    for (const p of placements) {
      const cells = computeShipCells(
        p.startRow,
        p.startCol,
        p.size,
        p.direction,
      );
      for (const ck of cells) {
        const [r, c] = ck.split(",").map(Number);
        if (r >= 0 && r < gridSize && c >= 0 && c < gridSize) {
          grid[r][c] = { status: "ship", shipId: p.shipId };
        }
      }
    }
    return grid;
  }, [placements, gridSize]);

  const placedShipIds = useMemo(
    () => new Set(placements.map((p) => p.shipId)),
    [placements],
  );

  const unplacedShips = useMemo(
    () => fleet.filter((s) => !placedShipIds.has(s.shipId)),
    [fleet, placedShipIds],
  );

  const allPlaced = placements.length === fleet.length;

  const handleCellPress = useCallback(
    (r: number, c: number) => {
      if (!selectedShipId || isReady) return;

      const shipDef = fleet.find((s) => s.shipId === selectedShipId);
      if (!shipDef) return;

      // If already placed, remove it first
      const filtered = placements.filter((p) => p.shipId !== selectedShipId);

      const cells = computeShipCells(r, c, shipDef.size, direction);
      const newPlacement: ShipPlacement = {
        shipId: shipDef.shipId,
        size: shipDef.size,
        startRow: r,
        startCol: c,
        direction,
        cells,
      };

      // Quick bounds check
      for (const ck of cells) {
        const [cr, cc] = ck.split(",").map(Number);
        if (cr < 0 || cr >= gridSize || cc < 0 || cc >= gridSize) {
          feedback.invalidFeedback();
          Alert.alert("Invalid", "Ship goes off the grid.");
          return;
        }
      }

      // Check overlap
      const otherCells = new Set<string>();
      for (const p of filtered) {
        for (const ck of p.cells) otherCells.add(ck);
      }
      if (cells.some((ck) => otherCells.has(ck))) {
        feedback.invalidFeedback();
        Alert.alert("Invalid", "Ships cannot overlap.");
        return;
      }

      // Adjacency check
      if (!state.rules.allowAdjacentShips) {
        const blocked = new Set<string>();
        for (const ck of [...otherCells]) {
          const [ar, ac] = ck.split(",").map(Number);
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr !== 0 || dc !== 0) blocked.add(ar + dr + "," + (ac + dc));
            }
          }
        }
        if (cells.some((ck) => blocked.has(ck))) {
          feedback.invalidFeedback();
          Alert.alert("Invalid", "Ships must have a gap between them.");
          return;
        }
      }

      feedback.placeFeedback();
      const newPlacements = [...filtered, newPlacement];
      setPlacements(newPlacements);

      // Auto-select next unplaced ship
      const nextUnplaced = fleet.find(
        (s) =>
          s.shipId !== selectedShipId &&
          !newPlacements.some((p) => p.shipId === s.shipId),
      );
      if (nextUnplaced) setSelectedShipId(nextUnplaced.shipId);
    },
    [
      selectedShipId,
      direction,
      placements,
      fleet,
      gridSize,
      isReady,
      state.rules.allowAdjacentShips,
      feedback,
    ],
  );

  const handleAutoPlace = useCallback(() => {
    const result = autoPlaceFleet(
      gridSize,
      state.rules.fleetPreset,
      state.rules.allowAdjacentShips,
    );
    if (result.length > 0) {
      feedback.placeFeedback();
      setPlacements(result);
      setSelectedShipId(null);
    } else {
      feedback.invalidFeedback();
      Alert.alert("Error", "Could not auto-place fleet. Try again.");
    }
  }, [
    gridSize,
    state.rules.fleetPreset,
    state.rules.allowAdjacentShips,
    feedback,
  ]);

  const handleClear = useCallback(() => {
    setPlacements([]);
    setSelectedShipId(fleet[0]?.shipId ?? null);
  }, [fleet]);

  const handleConfirm = useCallback(async () => {
    if (!allPlaced) return;
    const validation = validateFleetPlacement(
      placements,
      gridSize,
      state.rules.fleetPreset,
      state.rules.allowAdjacentShips,
    );
    if (!validation.valid) {
      feedback.invalidFeedback();
      Alert.alert("Invalid Fleet", validation.error ?? "Check your placement.");
      return;
    }
    feedback.confirmFeedback();
    const committed = await submitMove({ action: "place_fleet", placements });
    if (committed) {
      onPlacementsConfirmed(placements);
    }
  }, [
    allPlaced,
    placements,
    gridSize,
    state.rules,
    submitMove,
    onPlacementsConfirmed,
    feedback,
  ]);

  // -- Waiting state --
  if (isReady) {
    return (
      <View style={[styles.center, { backgroundColor: tokens.screenBg }]}>
        <Animated.View entering={FadeIn.duration(400)} style={styles.center}>
          <MaterialCommunityIcons
            name="check-circle"
            size={64}
            color={tokens.statusSuccess}
            style={{ marginBottom: BS.spacing.lg }}
          />
          <Text style={[styles.statusText, { color: tokens.tabActiveTint }]}>
            Fleet Deployed!
          </Text>
          <Text style={[styles.subText, { color: tokens.textSecondary }]}>
            Waiting for opponent to deploy their fleet...
          </Text>
        </Animated.View>
      </View>
    );
  }

  // -- Placement UI --
  const dockPad = Math.max(insets.bottom, 8);

  return (
    <View style={[styles.flex1, { backgroundColor: tokens.screenBg }]}>
      {/* Board area — flex:1, board vertically centered */}
      <View style={styles.boardArea}>
        <BoardCard tokens={tokens}>
          <BattleshipGrid
            gridSize={gridSize}
            cells={gridCells}
            onCellPress={handleCellPress}
            disabled={isReady}
            tokens={tokens}
          />
        </BoardCard>
      </View>

      {/* ── Bottom Dock — always visible, safe-area aware ── */}
      <View
        style={[
          styles.dock,
          {
            backgroundColor: tokens.surfaceSecondary,
            borderTopColor: tokens.divider,
            paddingBottom: dockPad,
          },
        ]}
      >
        {/* Ship Carousel */}
        <ShipCarousel
          fleet={fleet}
          selectedShipId={selectedShipId}
          placedShipIds={placedShipIds}
          onSelectShip={setSelectedShipId}
          tokens={tokens}
          disabled={isReady}
        />

        {/* Action Row + Confirm — single row */}
        <View style={styles.dockActionRow}>
          <TouchableOpacity
            style={[styles.dockBtn, { backgroundColor: tokens.cancelBtnBg }]}
            onPress={() => setDirection((d) => (d === "H" ? "V" : "H"))}
            accessibilityLabel={
              direction === "H" ? "Rotate to vertical" : "Rotate to horizontal"
            }
          >
            <MaterialCommunityIcons
              name={direction === "H" ? "arrow-right" : "arrow-down"}
              size={18}
              color={tokens.textPrimary}
            />
            <Text style={[styles.dockBtnText, { color: tokens.textPrimary }]}>
              {direction === "H" ? "H" : "V"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dockBtn, { backgroundColor: tokens.cancelBtnBg }]}
            onPress={handleAutoPlace}
            accessibilityLabel="Auto-place fleet randomly"
          >
            <MaterialCommunityIcons
              name="auto-fix"
              size={18}
              color={tokens.textPrimary}
            />
            <Text style={[styles.dockBtnText, { color: tokens.textPrimary }]}>
              Rand
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dockBtn, { backgroundColor: tokens.cancelBtnBg }]}
            onPress={handleClear}
            accessibilityLabel="Clear all placed ships"
          >
            <MaterialCommunityIcons
              name="eraser"
              size={18}
              color={tokens.textPrimary}
            />
            <Text style={[styles.dockBtnText, { color: tokens.textPrimary }]}>
              Clear
            </Text>
          </TouchableOpacity>

          {/* Confirm CTA — grows to fill remaining space */}
          <TouchableOpacity
            style={[
              styles.dockConfirmBtn,
              {
                backgroundColor: allPlaced
                  ? tokens.confirmBtnBg
                  : tokens.fireBtnDisabledBg,
                opacity: allPlaced && !actionLoading ? 1 : 0.5,
              },
            ]}
            onPress={handleConfirm}
            disabled={!allPlaced || actionLoading}
            accessibilityLabel={
              actionLoading ? "Deploying fleet" : "Confirm fleet placement"
            }
          >
            <MaterialCommunityIcons
              name="anchor"
              size={18}
              color={tokens.confirmBtnText}
            />
            <Text
              style={[styles.dockConfirmText, { color: tokens.confirmBtnText }]}
            >
              {actionLoading ? "Deploy..." : "Confirm"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Status line */}
        {unplacedShips.length > 0 && (
          <Text style={[styles.dockInfo, { color: tokens.textMuted }]}>
            {unplacedShips.length} ship{unplacedShips.length !== 1 ? "s" : ""}{" "}
            left
            {selectedShipId
              ? " · Placing: " +
                (fleet.find((s) => s.shipId === selectedShipId)?.name ?? "")
              : ""}
          </Text>
        )}
      </View>
    </View>
  );
}

// =============================================================================
// Battle Phase - Firing UI
// =============================================================================

interface BattlePhaseProps {
  state: BattleshipPublicState;
  myUid: string;
  turnOrder: string[];
  submitMove: (payload: Record<string, unknown>) => Promise<boolean>;
  actionLoading: boolean;
  isMyTurn: boolean;
  tokens: ReturnType<typeof useBattleshipTheme>;
  settings: Record<string, unknown>;
  myPlacements: ShipPlacement[];
}

function BattlePhase({
  state,
  myUid,
  turnOrder,
  submitMove,
  actionLoading,
  isMyTurn,
  tokens,
  settings,
  myPlacements,
}: BattlePhaseProps) {
  const gridSize = state.rules.gridSize;
  const fleet = getFleetForPreset(state.rules.fleetPreset);
  const opponentUid = turnOrder.find((u) => u !== myUid) ?? "";
  const isSalvo = state.rules.shotMode === "salvo";
  const confirmBeforeFire = (settings.confirmBeforeFire as boolean) ?? true;
  const hapticsEnabled = (settings.haptics as boolean) ?? true;

  const feedback = useBattleshipFeedback(hapticsEnabled);

  const [activeTab, setActiveTab] = useState<"target" | "fleet">("target");
  const [salvoTargets, setSalvoTargets] = useState<Set<string>>(new Set());

  // Stats
  const myStats = state.statsByUid[myUid] ?? emptyStats();
  const opponentStats = state.statsByUid[opponentUid] ?? emptyStats();

  // Build target grid (shots the player has fired at opponent)
  const targetGrid = useMemo(() => {
    const grid: GridCellData[][] = Array.from({ length: gridSize }, () =>
      Array.from({ length: gridSize }, () => ({
        status: "empty" as CellStatus,
      })),
    );
    const shots = state.shotsByDefender[opponentUid] ?? {};
    for (const [key, shot] of Object.entries(shots)) {
      const [r, c] = key.split(",").map(Number);
      if (r >= 0 && r < gridSize && c >= 0 && c < gridSize) {
        grid[r][c] = {
          status:
            shot.result === "sunk"
              ? "sunk"
              : shot.result === "hit"
                ? "hit"
                : "miss",
          shipId: shot.shipId,
        };
      }
    }
    return grid;
  }, [state.shotsByDefender, opponentUid, gridSize]);

  // Build fleet grid (incoming shots + own ships)
  const myGrid = useMemo(() => {
    const grid: GridCellData[][] = Array.from({ length: gridSize }, () =>
      Array.from({ length: gridSize }, () => ({
        status: "empty" as CellStatus,
      })),
    );
    for (const p of myPlacements) {
      const cells = computeShipCells(
        p.startRow,
        p.startCol,
        p.size,
        p.direction,
      );
      for (const ck of cells) {
        const [r, c] = ck.split(",").map(Number);
        if (r >= 0 && r < gridSize && c >= 0 && c < gridSize) {
          grid[r][c] = { status: "ship", shipId: p.shipId };
        }
      }
    }
    const shots = state.shotsByDefender[myUid] ?? {};
    for (const [key, shot] of Object.entries(shots)) {
      const [r, c] = key.split(",").map(Number);
      if (r >= 0 && r < gridSize && c >= 0 && c < gridSize) {
        grid[r][c] = {
          status:
            shot.result === "sunk"
              ? "sunk"
              : shot.result === "hit"
                ? "hit"
                : "miss",
          shipId: shot.shipId,
        };
      }
    }
    return grid;
  }, [state.shotsByDefender, myUid, gridSize, myPlacements]);

  // Use publicState.currentTurnUid as the authoritative turn indicator
  // during battle phase. The session.currentTurnPlayerId (isMyTurn prop)
  // can desync briefly because the session doc and public state doc are
  // delivered via separate Firestore onSnapshot listeners.
  const actualIsMyTurn =
    state.phase === "battle" ? state.currentTurnUid === myUid : isMyTurn;

  // Build battle log for drawer
  const battleLog = useMemo(
    () => buildBattleLog(state, turnOrder),
    [state, turnOrder],
  );

  // Track previous turn for haptic on turn change
  const prevIsMyTurn = useRef(actualIsMyTurn);
  useEffect(() => {
    if (actualIsMyTurn && !prevIsMyTurn.current) {
      feedback.yourTurnFeedback();
    }
    prevIsMyTurn.current = actualIsMyTurn;
  }, [actualIsMyTurn, feedback]);

  // Ship health for fleet status
  const { shipHealth, sunkShips } = useMemo(() => {
    const hp: Record<string, number> = {};
    const sunk = new Set<string>();
    for (const ship of fleet) {
      hp[ship.shipId] = ship.size;
    }
    const shots = state.shotsByDefender[myUid] ?? {};
    for (const shot of Object.values(shots)) {
      if (
        shot.result === "hit" &&
        shot.shipId &&
        hp[shot.shipId] !== undefined
      ) {
        hp[shot.shipId] = Math.max(0, hp[shot.shipId] - 1);
      }
      if (shot.result === "sunk" && shot.shipId) {
        hp[shot.shipId] = 0;
        sunk.add(shot.shipId);
      }
    }
    return { shipHealth: hp, sunkShips: sunk };
  }, [state.shotsByDefender, myUid, fleet]);

  const handleTargetPress = useCallback(
    async (r: number, c: number) => {
      if (!actualIsMyTurn || actionLoading) return;
      const key = cellKey(r, c);

      if (state.shotsByDefender[opponentUid]?.[key]) return;

      if (isSalvo) {
        setSalvoTargets((prev) => {
          const next = new Set(prev);
          if (next.has(key)) {
            next.delete(key);
          } else {
            if (next.size >= myStats.shipsRemaining) {
              Alert.alert(
                "Salvo Limit",
                "You can fire " +
                  myStats.shipsRemaining +
                  " shots (ships remaining).",
              );
              return prev;
            }
            next.add(key);
          }
          return next;
        });
        feedback.placeFeedback();
        return;
      }

      // Single shot
      if (confirmBeforeFire) {
        Alert.alert("Confirm Fire", "Fire at " + colLabel(c) + (r + 1) + "?", [
          { text: "Cancel", style: "cancel" },
          {
            text: "Fire!",
            style: "destructive",
            onPress: () => {
              feedback.fireFeedback();
              submitMove({ action: "fire", target: { r, c } });
            },
          },
        ]);
      } else {
        feedback.fireFeedback();
        await submitMove({ action: "fire", target: { r, c } });
      }
    },
    [
      actualIsMyTurn,
      actionLoading,
      state.shotsByDefender,
      opponentUid,
      isSalvo,
      confirmBeforeFire,
      myStats.shipsRemaining,
      submitMove,
      feedback,
    ],
  );

  const handleSalvoConfirm = useCallback(async () => {
    if (salvoTargets.size !== myStats.shipsRemaining) {
      Alert.alert(
        "Incomplete",
        "Select exactly " + myStats.shipsRemaining + " targets.",
      );
      return;
    }
    feedback.fireFeedback();
    const targets = Array.from(salvoTargets).map((key) => {
      const [r, c] = key.split(",").map(Number);
      return { r, c };
    });
    await submitMove({ action: "salvo_fire", targets });
    setSalvoTargets(new Set());
  }, [salvoTargets, myStats.shipsRemaining, submitMove, feedback]);

  const turnText = actualIsMyTurn ? "Your Turn - Fire!" : "Opponent's Turn...";

  return (
    <View style={[styles.flex1, { backgroundColor: tokens.screenBg }]}>
      {/* Turn Banner */}
      <Animated.View
        entering={FadeIn.duration(200)}
        layout={LinearTransition}
        style={[
          styles.turnBanner,
          {
            backgroundColor: actualIsMyTurn
              ? tokens.bannerMyTurn
              : tokens.bannerOpponentTurn,
          },
        ]}
      >
        <Text
          style={[
            styles.turnText,
            {
              color: actualIsMyTurn
                ? tokens.bannerMyTurnText
                : tokens.bannerOpponentTurnText,
            },
          ]}
        >
          {turnText}
        </Text>
        <Text
          style={[
            styles.turnSub,
            {
              color: actualIsMyTurn
                ? tokens.bannerMyTurnText + "CC"
                : tokens.textMuted,
            },
          ]}
        >
          Turn {state.turnNumber} | Ships: {myStats.shipsRemaining}
        </Text>
      </Animated.View>

      {/* Event Ribbon */}
      <EventRibbon
        lastEvent={state.lastEvent}
        eventType={inferEventType(state.lastEvent)}
        tokens={tokens}
        log={battleLog}
      />

      {/* Segmented Control */}
      <View style={[styles.tabRow, { borderBottomColor: tokens.divider }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === "target" && {
              borderBottomColor: tokens.tabIndicator,
              borderBottomWidth: 2.5,
            },
          ]}
          onPress={() => {
            setActiveTab("target");
            feedback.tabChangeFeedback();
          }}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === "target" }}
        >
          <MaterialCommunityIcons
            name="crosshairs-gps"
            size={16}
            color={
              activeTab === "target"
                ? tokens.tabActiveTint
                : tokens.tabInactiveTint
            }
          />
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === "target"
                    ? tokens.tabActiveTint
                    : tokens.tabInactiveTint,
              },
            ]}
          >
            Target
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === "fleet" && {
              borderBottomColor: tokens.tabIndicator,
              borderBottomWidth: 2.5,
            },
          ]}
          onPress={() => {
            setActiveTab("fleet");
            feedback.tabChangeFeedback();
          }}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === "fleet" }}
        >
          <MaterialCommunityIcons
            name="anchor"
            size={16}
            color={
              activeTab === "fleet"
                ? tokens.tabActiveTint
                : tokens.tabInactiveTint
            }
          />
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === "fleet"
                    ? tokens.tabActiveTint
                    : tokens.tabInactiveTint,
              },
            ]}
          >
            Fleet
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {activeTab === "target" ? (
          <>
            <BoardCard tokens={tokens}>
              <BattleshipGrid
                gridSize={gridSize}
                cells={targetGrid}
                onCellPress={handleTargetPress}
                disabled={!actualIsMyTurn || actionLoading}
                selectedTargets={isSalvo ? salvoTargets : undefined}
                tokens={tokens}
                label="Opponent's Waters"
              />
            </BoardCard>

            {/* Salvo controls */}
            {isSalvo && actualIsMyTurn && (
              <Animated.View
                entering={FadeInDown.duration(200)}
                style={styles.salvoRow}
              >
                <Text style={[styles.salvoText, { color: tokens.textPrimary }]}>
                  Salvo: {salvoTargets.size}/{myStats.shipsRemaining}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.salvoBtn,
                    { backgroundColor: tokens.cancelBtnBg },
                  ]}
                  onPress={() => setSalvoTargets(new Set())}
                >
                  <Text style={{ color: tokens.cancelBtnText }}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.salvoBtn,
                    {
                      backgroundColor:
                        salvoTargets.size === myStats.shipsRemaining
                          ? tokens.fireBtnBg
                          : tokens.fireBtnDisabledBg,
                    },
                  ]}
                  onPress={handleSalvoConfirm}
                  disabled={salvoTargets.size !== myStats.shipsRemaining}
                >
                  <Text
                    style={{
                      color: tokens.fireBtnText,
                      fontWeight: "700",
                    }}
                  >
                    Fire Salvo!
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* Stats */}
            <View style={styles.statRow}>
              <StatBadge
                label="Hits"
                value={myStats.hits}
                color={tokens.markerHit}
                tokens={tokens}
              />
              <StatBadge
                label="Misses"
                value={myStats.misses}
                color={tokens.markerMiss}
                tokens={tokens}
              />
              <StatBadge
                label="Accuracy"
                value={myStats.accuracy + "%"}
                color={tokens.statusSuccess}
                tokens={tokens}
              />
              <StatBadge
                label="Sunk"
                value={myStats.shipsSunk}
                color={tokens.markerSunk}
                tokens={tokens}
              />
            </View>
          </>
        ) : (
          <>
            {/* Fleet tab */}
            <BoardCard tokens={tokens}>
              <BattleshipGrid
                gridSize={gridSize}
                cells={myGrid}
                disabled
                tokens={tokens}
                label="Your Waters"
              />
            </BoardCard>

            {/* Fleet Status */}
            <FleetStatus
              fleet={fleet}
              shipHealth={shipHealth}
              sunkShips={sunkShips}
              tokens={tokens}
            />

            {/* Opponent stats */}
            <View style={styles.statRow}>
              <StatBadge
                label="Opp Hits"
                value={opponentStats.hits}
                color={tokens.statusWarning}
                tokens={tokens}
              />
              <StatBadge
                label="Opp Acc"
                value={opponentStats.accuracy + "%"}
                color={tokens.statusError}
                tokens={tokens}
              />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// =============================================================================
// Spectator View
// =============================================================================

interface SpectatorViewProps {
  state: BattleshipPublicState;
  turnOrder: string[];
  tokens: ReturnType<typeof useBattleshipTheme>;
}

function SpectatorView({ state, turnOrder, tokens }: SpectatorViewProps) {
  const gridSize = state.rules.gridSize;
  const [viewingPlayer, setViewingPlayer] = useState(0);
  const [showReveal, setShowReveal] = useState(false);

  const grids = useMemo(() => {
    return turnOrder.map((uid) => {
      const grid: GridCellData[][] = Array.from({ length: gridSize }, () =>
        Array.from({ length: gridSize }, () => ({
          status: "empty" as CellStatus,
        })),
      );
      const shots = state.shotsByDefender[uid] ?? {};
      for (const [key, shot] of Object.entries(shots)) {
        const [r, c] = key.split(",").map(Number);
        if (r >= 0 && r < gridSize && c >= 0 && c < gridSize) {
          grid[r][c] = {
            status:
              shot.result === "sunk"
                ? "sunk"
                : shot.result === "hit"
                  ? "hit"
                  : "miss",
          };
        }
      }
      return grid;
    });
  }, [state.shotsByDefender, turnOrder, gridSize]);

  const battleLog = useMemo(
    () => buildBattleLog(state, turnOrder),
    [state, turnOrder],
  );

  const currentUid = turnOrder[viewingPlayer];
  const playerStats = state.statsByUid[currentUid] ?? emptyStats();
  const canReveal = state.phase === "resolved" && !!state.resolved?.reveal;

  return (
    <ScrollView
      style={{ backgroundColor: tokens.screenBg }}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Event Ribbon */}
      <EventRibbon
        lastEvent={state.lastEvent}
        eventType={inferEventType(state.lastEvent)}
        tokens={tokens}
        log={battleLog}
      />

      {/* Player tabs */}
      <View style={[styles.tabRow, { borderBottomColor: tokens.divider }]}>
        {turnOrder.map((uid, idx) => (
          <TouchableOpacity
            key={uid}
            style={[
              styles.tab,
              viewingPlayer === idx && {
                borderBottomColor: tokens.tabIndicator,
                borderBottomWidth: 2.5,
              },
            ]}
            onPress={() => setViewingPlayer(idx)}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    viewingPlayer === idx
                      ? tokens.tabActiveTint
                      : tokens.tabInactiveTint,
                },
              ]}
            >
              Player {idx + 1}
              {state.currentTurnUid === uid ? " *" : ""}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Board */}
      <BoardCard tokens={tokens}>
        <BattleshipGrid
          gridSize={gridSize}
          cells={grids[viewingPlayer]}
          disabled
          tokens={tokens}
          label={"Player " + (viewingPlayer + 1) + "'s Board (Incoming Fire)"}
        />
      </BoardCard>

      {/* Stats */}
      <View style={styles.statRow}>
        <StatBadge
          label="Ships Left"
          value={playerStats.shipsRemaining}
          color={tokens.statusSuccess}
          tokens={tokens}
        />
        <StatBadge
          label="Hits Taken"
          value={playerStats.hits}
          color={tokens.markerHit}
          tokens={tokens}
        />
        <StatBadge
          label="Accuracy"
          value={playerStats.accuracy + "%"}
          color={tokens.statusInfo}
          tokens={tokens}
        />
      </View>

      {/* Post-game reveal toggle */}
      {canReveal && (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={styles.revealSection}
        >
          <TouchableOpacity
            style={[
              styles.revealToggle,
              {
                backgroundColor: showReveal
                  ? tokens.tabActiveTint + "20"
                  : tokens.surfaceSecondary,
                borderColor: showReveal ? tokens.tabActiveTint : tokens.divider,
              },
            ]}
            onPress={() => setShowReveal(!showReveal)}
          >
            <MaterialCommunityIcons
              name={showReveal ? "eye-off" : "eye"}
              size={20}
              color={tokens.tabActiveTint}
            />
            <Text
              style={[styles.revealToggleText, { color: tokens.tabActiveTint }]}
            >
              {showReveal ? "Hide Fleets" : "Reveal Fleets"}
            </Text>
          </TouchableOpacity>

          {showReveal && state.resolved?.reveal && (
            <Animated.View entering={FadeInDown.duration(300)}>
              {turnOrder.map((uid, idx) => {
                const playerPlacements =
                  state.resolved?.reveal?.placementsByUid[uid] ?? [];
                return (
                  <View key={uid} style={styles.revealPlayer}>
                    <Text
                      style={[
                        styles.revealPlayerName,
                        { color: tokens.textPrimary },
                      ]}
                    >
                      Player {idx + 1}
                    </Text>
                    {playerPlacements.map((p: ShipPlacement) => (
                      <Text
                        key={p.shipId}
                        style={{
                          color: tokens.textSecondary,
                          fontSize: BS.fonts.sm,
                        }}
                      >
                        {p.shipId} ({p.size}) at {colLabel(p.startCol)}
                        {p.startRow + 1} {p.direction}
                      </Text>
                    ))}
                  </View>
                );
              })}
            </Animated.View>
          )}
        </Animated.View>
      )}
    </ScrollView>
  );
}

// =============================================================================
// Main Battleship UI - Wrapped by GameScreenShell
// =============================================================================

function BattleshipUI({
  publicState,
  isMyTurn,
  isTerminal,
  myUid,
  turnOrder,
  currentTurnIndex,
  settings,
  submitMove,
  resign,
  actionLoading,
  actionError,
  sessionId,
}: GameShellProps) {
  const tokens = useBattleshipTheme();
  const state = asState(publicState);
  const isSpectator = !turnOrder.includes(myUid);

  // Fleet placements belong to PrivateState. Keep a local fallback so the
  // board stays populated between setup submission and the first private-state
  // snapshot, then defer to Firestore as the authoritative source.
  const [placementFallback, setPlacementFallback] = useState<ShipPlacement[]>(
    [],
  );
  const [privateState, setPrivateState] =
    useState<BattleshipPrivateState | null>(null);

  useEffect(() => {
    setPlacementFallback([]);
    setPrivateState(null);
  }, [sessionId, myUid]);

  useEffect(() => {
    if (!sessionId || !myUid || isSpectator) {
      setPrivateState(null);
      return;
    }
    const unsub = subscribeToPrivateState(
      sessionId,
      myUid,
      (raw) => setPrivateState(asPrivateState(raw)),
      (err) => console.warn("[Battleship] private state error:", err.message),
    );
    return unsub;
  }, [sessionId, myUid, isSpectator]);

  const myPlacements = useMemo(() => {
    const authoritativePlacements = privateState?.placements;
    if (authoritativePlacements && authoritativePlacements.length > 0) {
      return authoritativePlacements;
    }
    return placementFallback;
  }, [privateState, placementFallback]);

  if (!state) {
    return (
      <View style={[styles.center, { backgroundColor: tokens.screenBg }]}>
        <Text style={{ color: tokens.tabActiveTint }}>Loading...</Text>
      </View>
    );
  }

  // Derive phase for header
  const headerPhase: BattlePhaseId = isSpectator
    ? "spectate"
    : state.phase === "resolved"
      ? "resolved"
      : state.phase === "battle"
        ? "battle"
        : "setup";

  return (
    <View style={[styles.flex1, { backgroundColor: tokens.screenBg }]}>
      {/* Compact phase indicator — shell already provides back/resign header */}
      <View style={styles.phaseRow}>
        <PhaseChip phase={headerPhase} tokens={tokens} />
      </View>

      {/* Game Content */}
      {isSpectator ? (
        <SpectatorView state={state} turnOrder={turnOrder} tokens={tokens} />
      ) : state.phase === "setup" ? (
        <SetupPhase
          state={state}
          myUid={myUid}
          submitMove={submitMove}
          actionLoading={actionLoading}
          tokens={tokens}
          onPlacementsConfirmed={setPlacementFallback}
        />
      ) : state.phase === "battle" || state.phase === "resolved" ? (
        <BattlePhase
          state={state}
          myUid={myUid}
          turnOrder={turnOrder}
          submitMove={submitMove}
          actionLoading={actionLoading}
          isMyTurn={isMyTurn && !isTerminal}
          tokens={tokens}
          settings={settings}
          myPlacements={myPlacements}
        />
      ) : (
        <View style={[styles.center, { backgroundColor: tokens.screenBg }]}>
          <Text style={{ color: tokens.tabActiveTint }}>
            Unknown phase: {state.phase}
          </Text>
        </View>
      )}
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: BS.spacing.lg,
  },

  // Phase indicator row
  phaseRow: {
    alignItems: "center",
    paddingVertical: BS.spacing.xs,
  },

  // Board area — flex:1, vertically centers the board
  boardArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },

  // Status / Waiting
  statusText: {
    fontSize: BS.fonts.xxl,
    fontWeight: BS.fontWeights.bold,
  },
  subText: {
    fontSize: BS.fonts.md,
    marginTop: BS.spacing.sm,
    textAlign: "center",
  },

  // Bottom dock
  dock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: BS.spacing.sm,
  },
  dockActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: BS.spacing.sm,
    paddingHorizontal: BS.spacing.md,
    marginTop: BS.spacing.xs,
  },
  dockBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: BS.spacing.sm,
    paddingVertical: BS.spacing.sm,
    borderRadius: BS.radius.sm,
    gap: 3,
    minWidth: 44,
    minHeight: 40,
  },
  dockBtnText: {
    fontSize: BS.fonts.xs,
    fontWeight: BS.fontWeights.semibold,
  },
  dockConfirmBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: BS.spacing.sm,
    borderRadius: BS.radius.sm,
    gap: BS.spacing.xs,
    minHeight: 40,
  },
  dockConfirmText: {
    fontSize: BS.fonts.md,
    fontWeight: BS.fontWeights.bold,
  },
  dockInfo: {
    fontSize: BS.fonts.xs,
    textAlign: "center",
    marginTop: BS.spacing.xs,
    paddingHorizontal: BS.spacing.md,
  },

  // Battle
  turnBanner: {
    paddingVertical: BS.spacing.md,
    paddingHorizontal: BS.spacing.lg,
    alignItems: "center",
  },
  turnText: {
    fontSize: BS.fonts.lg,
    fontWeight: BS.fontWeights.bold,
  },
  turnSub: {
    fontSize: BS.fonts.sm,
    marginTop: 2,
  },

  // Tabs
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: BS.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: BS.spacing.xs,
    paddingVertical: BS.spacing.md,
  },
  tabText: {
    fontSize: BS.fonts.md,
    fontWeight: BS.fontWeights.semibold,
  },

  // Content
  scrollContent: {
    alignItems: "center",
    paddingBottom: 80,
    paddingHorizontal: BS.spacing.sm,
  },

  // Stats
  statRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: BS.spacing.lg,
    marginTop: BS.spacing.md,
    paddingHorizontal: BS.spacing.lg,
  },

  // Salvo
  salvoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: BS.spacing.md,
    marginTop: BS.spacing.md,
    paddingHorizontal: BS.spacing.lg,
  },
  salvoText: {
    fontSize: BS.fonts.md,
    fontWeight: BS.fontWeights.semibold,
  },
  salvoBtn: {
    paddingHorizontal: BS.spacing.lg,
    paddingVertical: BS.spacing.sm,
    borderRadius: BS.radius.sm,
  },

  // Reveal
  revealSection: {
    marginTop: BS.spacing.xl,
    paddingHorizontal: BS.spacing.lg,
    width: "100%",
  },
  revealToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: BS.spacing.sm,
    paddingVertical: BS.spacing.md,
    borderRadius: BS.radius.md,
    borderWidth: 1,
    marginBottom: BS.spacing.md,
  },
  revealToggleText: {
    fontSize: BS.fonts.md,
    fontWeight: BS.fontWeights.semibold,
  },
  revealPlayer: {
    marginBottom: BS.spacing.md,
  },
  revealPlayerName: {
    fontSize: BS.fonts.md,
    fontWeight: BS.fontWeights.semibold,
    marginBottom: BS.spacing.xs,
  },
});

// =============================================================================
// Export - wrapped with GameV4Shell
// =============================================================================

export default withGameV4Shell(BattleshipUI, "battleship");
