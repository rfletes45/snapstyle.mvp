/**
 * Games V4 — Battleship Game Screen
 *
 * Mobile-first UI for the Battleship game.
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
import { useAppTheme } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  autoPlaceFleet,
  computeShipCells,
  validateFleetPlacement,
} from "../adapters/battleship/battleshipEngine";
import type {
  BattleshipPublicState,
  Direction,
  GridSize,
  PlayerStats,
  ShipPlacement,
} from "../adapters/battleship/battleshipTypes";
import { getFleetForPreset } from "../adapters/battleship/battleshipTypes";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// =============================================================================
// Types
// =============================================================================

type CellStatus = "empty" | "ship" | "hit" | "miss" | "sunk" | "selected";

interface GridCellData {
  status: CellStatus;
  shipId?: string;
}

// =============================================================================
// Helpers
// =============================================================================

function asState(
  ps: Record<string, unknown> | null,
): BattleshipPublicState | null {
  if (!ps) return null;
  return ps as unknown as BattleshipPublicState;
}

function getGridCellSize(gridSize: GridSize): number {
  const padding = 32; // 16 each side
  const labelWidth = 24; // row labels
  return Math.floor((SCREEN_WIDTH - padding - labelWidth) / gridSize) - 1;
}

function cellKey(r: number, c: number): string {
  return `${r},${c}`;
}

function colLabel(c: number): string {
  return String.fromCharCode(65 + c);
}

// =============================================================================
// Grid Component — Shared between setup, battle, and spectator
// =============================================================================

interface GridProps {
  gridSize: GridSize;
  cells: GridCellData[][];
  onCellPress?: (r: number, c: number) => void;
  disabled?: boolean;
  selectedTargets?: Set<string>;
  theme: ReturnType<typeof useAppTheme>["theme"];
  label?: string;
}

function BattleshipGrid({
  gridSize,
  cells,
  onCellPress,
  disabled,
  selectedTargets,
  theme,
  label,
}: GridProps) {
  const cellSize = getGridCellSize(gridSize);
  const isDark = theme.isDark;

  const getCellColor = (status: CellStatus): string => {
    switch (status) {
      case "ship":
        return isDark ? "#4A90D9" : "#3478F6";
      case "hit":
        return "#FF3B30";
      case "miss":
        return isDark ? "#555" : "#CCC";
      case "sunk":
        return "#8B0000";
      case "selected":
        return "#FF9500";
      case "empty":
      default:
        return isDark ? "#1A2332" : "#E8F0FE";
    }
  };

  return (
    <View style={styles.gridWrapper}>
      {label && (
        <Text style={[styles.gridLabel, { color: theme.colors.primary }]}>
          {label}
        </Text>
      )}

      {/* Column headers */}
      <View style={styles.gridRow}>
        <View style={{ width: 20 }} />
        {Array.from({ length: gridSize }).map((_, c) => (
          <View
            key={c}
            style={[styles.headerCell, { width: cellSize, height: 18 }]}
          >
            <Text
              style={[styles.headerText, { color: isDark ? "#AAA" : "#666" }]}
            >
              {colLabel(c)}
            </Text>
          </View>
        ))}
      </View>

      {/* Grid rows */}
      {Array.from({ length: gridSize }).map((_, r) => (
        <View key={r} style={styles.gridRow}>
          <View style={[styles.rowLabel, { width: 20, height: cellSize }]}>
            <Text
              style={[styles.headerText, { color: isDark ? "#AAA" : "#666" }]}
            >
              {r + 1}
            </Text>
          </View>
          {Array.from({ length: gridSize }).map((_, c) => {
            const cell = cells[r]?.[c] ?? { status: "empty" as CellStatus };
            const isSelected = selectedTargets?.has(cellKey(r, c));
            const bg = isSelected ? "#FF9500" : getCellColor(cell.status);

            return (
              <TouchableOpacity
                key={c}
                style={[
                  styles.gridCell,
                  {
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: bg,
                    borderColor: isDark ? "#333" : "#B0BEC5",
                  },
                ]}
                onPress={() => onCellPress?.(r, c)}
                disabled={disabled}
                activeOpacity={0.7}
              >
                {cell.status === "hit" && (
                  <Text style={styles.cellIcon}>💥</Text>
                )}
                {cell.status === "miss" && (
                  <View
                    style={[
                      styles.missDot,
                      { backgroundColor: isDark ? "#888" : "#999" },
                    ]}
                  />
                )}
                {cell.status === "sunk" && (
                  <Text style={styles.cellIcon}>🔥</Text>
                )}
                {isSelected && (
                  <MaterialCommunityIcons
                    name="crosshairs"
                    size={cellSize * 0.6}
                    color="#FFF"
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// =============================================================================
// Setup Phase — Fleet Placement UI
// =============================================================================

interface SetupPhaseProps {
  state: BattleshipPublicState;
  myUid: string;
  submitMove: (payload: Record<string, unknown>) => Promise<boolean>;
  actionLoading: boolean;
  theme: ReturnType<typeof useAppTheme>["theme"];
  onPlacementsConfirmed: (placements: ShipPlacement[]) => void;
}

function SetupPhase({
  state,
  myUid,
  submitMove,
  actionLoading,
  theme,
  onPlacementsConfirmed,
}: SetupPhaseProps) {
  const gridSize = state.rules.gridSize;
  const fleet = getFleetForPreset(state.rules.fleetPreset);
  const isDark = theme.isDark;
  const isReady = state.setup.readyByUid[myUid] ?? false;

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
          Alert.alert("Invalid", "Ship goes off the grid.");
          return;
        }
      }

      // Check overlap with other placed ships
      const otherCells = new Set<string>();
      for (const p of filtered) {
        for (const ck of p.cells) otherCells.add(ck);
      }
      if (cells.some((ck) => otherCells.has(ck))) {
        Alert.alert("Invalid", "Ships cannot overlap.");
        return;
      }

      // Check adjacency if rule requires
      if (!state.rules.allowAdjacentShips) {
        const blocked = new Set<string>();
        for (const ck of [...otherCells]) {
          const [ar, ac] = ck.split(",").map(Number);
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr !== 0 || dc !== 0) blocked.add(`${ar + dr},${ac + dc}`);
            }
          }
        }
        if (cells.some((ck) => blocked.has(ck))) {
          Alert.alert("Invalid", "Ships must have a gap between them.");
          return;
        }
      }

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
    ],
  );

  const handleAutoPlace = useCallback(() => {
    const result = autoPlaceFleet(
      gridSize,
      state.rules.fleetPreset,
      state.rules.allowAdjacentShips,
    );
    if (result.length > 0) {
      setPlacements(result);
      setSelectedShipId(null);
    } else {
      Alert.alert("Error", "Could not auto-place fleet. Try again.");
    }
  }, [gridSize, state.rules.fleetPreset, state.rules.allowAdjacentShips]);

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
      Alert.alert("Invalid Fleet", validation.error ?? "Check your placement.");
      return;
    }
    await submitMove({
      action: "place_fleet",
      placements,
    });
    onPlacementsConfirmed(placements);
  }, [
    allPlaced,
    placements,
    gridSize,
    state.rules,
    submitMove,
    onPlacementsConfirmed,
  ]);

  if (isReady) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: isDark ? "#000" : theme.colors.background },
        ]}
      >
        <MaterialCommunityIcons
          name="check-circle"
          size={64}
          color="#34C759"
          style={{ marginBottom: 16 }}
        />
        <Text style={[styles.statusText, { color: theme.colors.primary }]}>
          Fleet Deployed!
        </Text>
        <Text style={[styles.subText, { color: isDark ? "#AAA" : "#666" }]}>
          Waiting for opponent to deploy their fleet...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: isDark ? "#000" : theme.colors.background }}
      contentContainerStyle={styles.setupContainer}
    >
      {/* Header */}
      <Text style={[styles.phaseTitle, { color: theme.colors.primary }]}>
        Deploy Your Fleet
      </Text>

      {/* Grid */}
      <BattleshipGrid
        gridSize={gridSize}
        cells={gridCells}
        onCellPress={handleCellPress}
        disabled={isReady}
        theme={theme}
      />

      {/* Ship Carousel */}
      <View style={styles.shipDock}>
        <Text style={[styles.dockTitle, { color: isDark ? "#CCC" : "#333" }]}>
          Ships
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {fleet.map((shipDef) => {
            const isPlaced = placedShipIds.has(shipDef.shipId);
            const isSelected = selectedShipId === shipDef.shipId;
            return (
              <TouchableOpacity
                key={shipDef.shipId}
                style={[
                  styles.shipCard,
                  {
                    borderColor: isSelected
                      ? theme.colors.primary
                      : isDark
                        ? "#444"
                        : "#DDD",
                    backgroundColor: isPlaced
                      ? isDark
                        ? "#1A3A1A"
                        : "#E8F5E9"
                      : isDark
                        ? "#1A1A2E"
                        : "#FFF",
                    opacity: isPlaced && !isSelected ? 0.6 : 1,
                  },
                ]}
                onPress={() => setSelectedShipId(shipDef.shipId)}
              >
                <Text
                  style={[
                    styles.shipName,
                    {
                      color: isSelected
                        ? theme.colors.primary
                        : isDark
                          ? "#CCC"
                          : "#333",
                    },
                  ]}
                >
                  {shipDef.name}
                </Text>
                <View style={styles.shipSizeRow}>
                  {Array.from({ length: shipDef.size }).map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.shipSizeBlock,
                        {
                          backgroundColor: isPlaced
                            ? "#34C759"
                            : isDark
                              ? "#4A90D9"
                              : "#3478F6",
                        },
                      ]}
                    />
                  ))}
                </View>
                {isPlaced && (
                  <MaterialCommunityIcons
                    name="check"
                    size={14}
                    color="#34C759"
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[
            styles.actionBtn,
            { backgroundColor: isDark ? "#333" : "#E0E0E0" },
          ]}
          onPress={() => setDirection((d) => (d === "H" ? "V" : "H"))}
        >
          <MaterialCommunityIcons
            name={direction === "H" ? "arrow-right" : "arrow-down"}
            size={20}
            color={isDark ? "#FFF" : "#333"}
          />
          <Text
            style={[styles.actionBtnText, { color: isDark ? "#FFF" : "#333" }]}
          >
            {direction === "H" ? "Horizontal" : "Vertical"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionBtn,
            { backgroundColor: isDark ? "#333" : "#E0E0E0" },
          ]}
          onPress={handleAutoPlace}
        >
          <MaterialCommunityIcons
            name="auto-fix"
            size={20}
            color={isDark ? "#FFF" : "#333"}
          />
          <Text
            style={[styles.actionBtnText, { color: isDark ? "#FFF" : "#333" }]}
          >
            Random
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionBtn,
            { backgroundColor: isDark ? "#333" : "#E0E0E0" },
          ]}
          onPress={handleClear}
        >
          <MaterialCommunityIcons
            name="eraser"
            size={20}
            color={isDark ? "#FFF" : "#333"}
          />
          <Text
            style={[styles.actionBtnText, { color: isDark ? "#FFF" : "#333" }]}
          >
            Clear
          </Text>
        </TouchableOpacity>
      </View>

      {/* Confirm Button */}
      <TouchableOpacity
        style={[
          styles.confirmBtn,
          {
            backgroundColor: allPlaced
              ? theme.colors.primary
              : isDark
                ? "#333"
                : "#CCC",
            opacity: allPlaced && !actionLoading ? 1 : 0.5,
          },
        ]}
        onPress={handleConfirm}
        disabled={!allPlaced || actionLoading}
      >
        <MaterialCommunityIcons name="anchor" size={20} color="#FFF" />
        <Text style={styles.confirmBtnText}>
          {actionLoading ? "Deploying..." : "Confirm Fleet"}
        </Text>
      </TouchableOpacity>

      {/* Info */}
      {unplacedShips.length > 0 && (
        <Text style={[styles.infoText, { color: isDark ? "#888" : "#999" }]}>
          {unplacedShips.length} ship{unplacedShips.length !== 1 ? "s" : ""}{" "}
          remaining
          {selectedShipId
            ? ` — Placing: ${fleet.find((s) => s.shipId === selectedShipId)?.name}`
            : ""}
        </Text>
      )}
    </ScrollView>
  );
}

// =============================================================================
// Battle Phase — Firing UI
// =============================================================================

interface BattlePhaseProps {
  state: BattleshipPublicState;
  myUid: string;
  turnOrder: string[];
  submitMove: (payload: Record<string, unknown>) => Promise<boolean>;
  actionLoading: boolean;
  isMyTurn: boolean;
  theme: ReturnType<typeof useAppTheme>["theme"];
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
  theme,
  settings,
  myPlacements,
}: BattlePhaseProps) {
  const isDark = theme.isDark;
  const gridSize = state.rules.gridSize;
  const isSalvo = state.rules.shotMode === "salvo";
  const confirmBeforeFire = (settings.confirmBeforeFire as boolean) ?? true;

  const opponentUid = turnOrder[0] === myUid ? turnOrder[1] : turnOrder[0];

  // Tab state: "target" (opponent's grid) or "fleet" (my grid)
  const [activeTab, setActiveTab] = useState<"target" | "fleet">("target");

  // Salvo target selection
  const [salvoTargets, setSalvoTargets] = useState<Set<string>>(new Set());
  const myStats = state.statsByUid[myUid] ?? emptyStats();
  const opponentStats = state.statsByUid[opponentUid] ?? emptyStats();

  // Build opponent's grid (shots I've fired at them)
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

  // Build my grid (shots opponent fired at me + my ship positions)
  const myGrid = useMemo(() => {
    const grid: GridCellData[][] = Array.from({ length: gridSize }, () =>
      Array.from({ length: gridSize }, () => ({
        status: "empty" as CellStatus,
      })),
    );
    // First, overlay my ship placements so the player can see their fleet
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
    // Then, overlay incoming shots on top (hits/misses/sinks take priority)
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

  const handleTargetPress = useCallback(
    async (r: number, c: number) => {
      if (!actualIsMyTurn || actionLoading) return;
      const key = cellKey(r, c);

      // Check if already shot
      if (state.shotsByDefender[opponentUid]?.[key]) return;

      if (isSalvo) {
        // Toggle selection
        setSalvoTargets((prev) => {
          const next = new Set(prev);
          if (next.has(key)) {
            next.delete(key);
          } else {
            // Allow up to shipsRemaining targets
            if (next.size >= myStats.shipsRemaining) {
              Alert.alert(
                "Salvo Limit",
                `You can fire ${myStats.shipsRemaining} shots (ships remaining).`,
              );
              return prev;
            }
            next.add(key);
          }
          return next;
        });
        return;
      }

      // Single shot mode
      if (confirmBeforeFire) {
        Alert.alert("Confirm Fire", `Fire at ${colLabel(c)}${r + 1}?`, [
          { text: "Cancel", style: "cancel" },
          {
            text: "Fire!",
            style: "destructive",
            onPress: () => submitMove({ action: "fire", target: { r, c } }),
          },
        ]);
      } else {
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
    ],
  );

  const handleSalvoConfirm = useCallback(async () => {
    if (salvoTargets.size !== myStats.shipsRemaining) {
      Alert.alert(
        "Incomplete",
        `Select exactly ${myStats.shipsRemaining} targets.`,
      );
      return;
    }
    const targets = Array.from(salvoTargets).map((key) => {
      const [r, c] = key.split(",").map(Number);
      return { r, c };
    });
    await submitMove({ action: "salvo_fire", targets });
    setSalvoTargets(new Set());
  }, [salvoTargets, myStats.shipsRemaining, submitMove]);

  // DEBUG: Log isMyTurn prop received in BattlePhase
  useEffect(() => {
    console.log(
      `[gamesV4][DEBUG] BattlePhase: myUid=${myUid}, isMyTurn(prop)=${isMyTurn}, state.currentTurnUid=${state.currentTurnUid}, stateBasedIsMyTurn=${state.currentTurnUid === myUid}, state.phase=${state.phase}, state.moveCount=${state.moveCount}, state.turnNumber=${state.turnNumber}`,
    );
  }, [
    isMyTurn,
    myUid,
    state.phase,
    state.currentTurnUid,
    state.moveCount,
    state.turnNumber,
  ]);

  const turnText = actualIsMyTurn ? "Your Turn — Fire!" : "Opponent's Turn...";

  return (
    <View
      style={[
        styles.battleContainer,
        { backgroundColor: isDark ? "#000" : theme.colors.background },
      ]}
    >
      {/* Turn indicator */}
      <View
        style={[
          styles.turnBanner,
          {
            backgroundColor: actualIsMyTurn
              ? "#34C759"
              : isDark
                ? "#333"
                : "#E0E0E0",
          },
        ]}
      >
        <Text
          style={[
            styles.turnText,
            { color: actualIsMyTurn ? "#FFF" : isDark ? "#CCC" : "#333" },
          ]}
        >
          {turnText}
        </Text>
        <Text
          style={[
            styles.turnSub,
            { color: actualIsMyTurn ? "#E8F5E9" : isDark ? "#888" : "#888" },
          ]}
        >
          Turn {state.turnNumber} | Ships: {myStats.shipsRemaining}
        </Text>
      </View>

      {/* Event ribbon */}
      {state.lastEvent && (
        <View
          style={[
            styles.eventRibbon,
            { backgroundColor: isDark ? "#1A1A2E" : "#FFF3E0" },
          ]}
        >
          <Text
            style={[
              styles.eventText,
              { color: isDark ? "#FF9500" : "#E65100" },
            ]}
          >
            {state.lastEvent}
          </Text>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === "target" && {
              borderBottomColor: theme.colors.primary,
              borderBottomWidth: 2,
            },
          ]}
          onPress={() => setActiveTab("target")}
        >
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === "target"
                    ? theme.colors.primary
                    : isDark
                      ? "#888"
                      : "#999",
              },
            ]}
          >
            🎯 Target
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === "fleet" && {
              borderBottomColor: theme.colors.primary,
              borderBottomWidth: 2,
            },
          ]}
          onPress={() => setActiveTab("fleet")}
        >
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === "fleet"
                    ? theme.colors.primary
                    : isDark
                      ? "#888"
                      : "#999",
              },
            ]}
          >
            ⚓ Fleet
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {activeTab === "target" ? (
          <>
            <BattleshipGrid
              gridSize={gridSize}
              cells={targetGrid}
              onCellPress={handleTargetPress}
              disabled={!actualIsMyTurn || actionLoading}
              selectedTargets={isSalvo ? salvoTargets : undefined}
              theme={theme}
              label="Opponent's Waters"
            />

            {/* Salvo confirm */}
            {isSalvo && actualIsMyTurn && (
              <View style={styles.salvoRow}>
                <Text
                  style={[
                    styles.salvoText,
                    { color: isDark ? "#CCC" : "#333" },
                  ]}
                >
                  Salvo: {salvoTargets.size}/{myStats.shipsRemaining}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.salvoBtn,
                    { backgroundColor: isDark ? "#333" : "#E0E0E0" },
                  ]}
                  onPress={() => setSalvoTargets(new Set())}
                >
                  <Text style={{ color: isDark ? "#FFF" : "#333" }}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.salvoBtn,
                    {
                      backgroundColor:
                        salvoTargets.size === myStats.shipsRemaining
                          ? "#FF3B30"
                          : isDark
                            ? "#555"
                            : "#CCC",
                    },
                  ]}
                  onPress={handleSalvoConfirm}
                  disabled={salvoTargets.size !== myStats.shipsRemaining}
                >
                  <Text style={{ color: "#FFF", fontWeight: "700" }}>
                    Fire Salvo!
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Stats summary */}
            <View style={styles.statRow}>
              <StatBadge
                label="Hits"
                value={myStats.hits}
                color="#FF3B30"
                theme={theme}
              />
              <StatBadge
                label="Misses"
                value={myStats.misses}
                color={isDark ? "#555" : "#999"}
                theme={theme}
              />
              <StatBadge
                label="Accuracy"
                value={`${myStats.accuracy}%`}
                color="#34C759"
                theme={theme}
              />
              <StatBadge
                label="Sunk"
                value={myStats.shipsSunk}
                color="#8B0000"
                theme={theme}
              />
            </View>
          </>
        ) : (
          <>
            <BattleshipGrid
              gridSize={gridSize}
              cells={myGrid}
              disabled
              theme={theme}
              label="Your Waters"
            />
            <View style={styles.statRow}>
              <StatBadge
                label="Ships Left"
                value={myStats.shipsRemaining}
                color="#34C759"
                theme={theme}
              />
              <StatBadge
                label="Incoming"
                value={opponentStats.hits + opponentStats.misses}
                color="#FF9500"
                theme={theme}
              />
              <StatBadge
                label="Opp Acc"
                value={`${opponentStats.accuracy}%`}
                color="#FF3B30"
                theme={theme}
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
  theme: ReturnType<typeof useAppTheme>["theme"];
}

function SpectatorView({ state, turnOrder, theme }: SpectatorViewProps) {
  const isDark = theme.isDark;
  const gridSize = state.rules.gridSize;
  const [viewingPlayer, setViewingPlayer] = useState(0);

  // Build fog-of-war grids for each player
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

  const currentUid = turnOrder[viewingPlayer];
  const playerStats = state.statsByUid[currentUid] ?? emptyStats();

  return (
    <ScrollView
      style={{ backgroundColor: isDark ? "#000" : theme.colors.background }}
      contentContainerStyle={styles.scrollContent}
    >
      <Text style={[styles.phaseTitle, { color: theme.colors.primary }]}>
        📺 Spectating
      </Text>

      {state.lastEvent && (
        <View
          style={[
            styles.eventRibbon,
            { backgroundColor: isDark ? "#1A1A2E" : "#FFF3E0" },
          ]}
        >
          <Text
            style={[
              styles.eventText,
              { color: isDark ? "#FF9500" : "#E65100" },
            ]}
          >
            {state.lastEvent}
          </Text>
        </View>
      )}

      <View style={styles.tabRow}>
        {turnOrder.map((uid, idx) => (
          <TouchableOpacity
            key={uid}
            style={[
              styles.tab,
              viewingPlayer === idx && {
                borderBottomColor: theme.colors.primary,
                borderBottomWidth: 2,
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
                      ? theme.colors.primary
                      : isDark
                        ? "#888"
                        : "#999",
                },
              ]}
            >
              Player {idx + 1}
              {state.currentTurnUid === uid ? " 🔴" : ""}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <BattleshipGrid
        gridSize={gridSize}
        cells={grids[viewingPlayer]}
        disabled
        theme={theme}
        label={`Player ${viewingPlayer + 1}'s Board (Incoming Fire)`}
      />

      <View style={styles.statRow}>
        <StatBadge
          label="Ships Left"
          value={playerStats.shipsRemaining}
          color="#34C759"
          theme={theme}
        />
        <StatBadge
          label="Hits Taken"
          value={playerStats.hits}
          color="#FF3B30"
          theme={theme}
        />
      </View>

      {/* Post-game reveal */}
      {state.phase === "resolved" && state.resolved?.reveal && (
        <View style={styles.revealSection}>
          <Text style={[styles.revealTitle, { color: theme.colors.primary }]}>
            Full Fleet Reveal
          </Text>
          {turnOrder.map((uid, idx) => {
            const playerPlacements =
              state.resolved?.reveal?.placementsByUid[uid] ?? [];
            return (
              <View key={uid} style={styles.revealPlayer}>
                <Text
                  style={[
                    styles.revealPlayerName,
                    { color: isDark ? "#CCC" : "#333" },
                  ]}
                >
                  Player {idx + 1}
                </Text>
                {playerPlacements.map((p) => (
                  <Text
                    key={p.shipId}
                    style={{ color: isDark ? "#888" : "#666", fontSize: 12 }}
                  >
                    {p.shipId} ({p.size}) at {colLabel(p.startCol)}
                    {p.startRow + 1} {p.direction}
                  </Text>
                ))}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

// =============================================================================
// Stat Badge Component
// =============================================================================

function StatBadge({
  label,
  value,
  color,
  theme,
}: {
  label: string;
  value: number | string;
  color: string;
  theme: ReturnType<typeof useAppTheme>["theme"];
}) {
  return (
    <View style={styles.statBadge}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text
        style={[styles.statLabel, { color: theme.isDark ? "#888" : "#999" }]}
      >
        {label}
      </Text>
    </View>
  );
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

// =============================================================================
// Main Battleship UI — Wrapped by GameScreenShell
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
  const { theme } = useAppTheme();
  const state = asState(publicState);

  // Persist placements across phase transitions so the Fleet tab can show ships.
  // This is set when the player confirms their fleet in the setup phase.
  const [myPlacements, setMyPlacements] = useState<ShipPlacement[]>([]);

  if (!state) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.isDark ? "#000" : theme.colors.background },
        ]}
      >
        <Text style={{ color: theme.colors.primary }}>Loading...</Text>
      </View>
    );
  }

  // Determine if user is a spectator (not in turnOrder)
  const isSpectator = !turnOrder.includes(myUid);

  // DEBUG: Log phase transitions and isMyTurn in BattleshipUI
  console.log(
    `[gamesV4][DEBUG] BattleshipUI render: myUid=${myUid}, isMyTurn=${isMyTurn}, isTerminal=${isTerminal}, phase=${state.phase}, currentTurnUid=${state.currentTurnUid}, moveCount=${state.moveCount}, turnOrder=${JSON.stringify(turnOrder)}, currentTurnIndex=${currentTurnIndex}`,
  );

  if (isSpectator) {
    return <SpectatorView state={state} turnOrder={turnOrder} theme={theme} />;
  }

  if (state.phase === "setup") {
    return (
      <SetupPhase
        state={state}
        myUid={myUid}
        submitMove={submitMove}
        actionLoading={actionLoading}
        theme={theme}
        onPlacementsConfirmed={setMyPlacements}
      />
    );
  }

  if (state.phase === "battle" || state.phase === "resolved") {
    return (
      <BattlePhase
        state={state}
        myUid={myUid}
        turnOrder={turnOrder}
        submitMove={submitMove}
        actionLoading={actionLoading}
        isMyTurn={isMyTurn && !isTerminal}
        theme={theme}
        settings={settings}
        myPlacements={myPlacements}
      />
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.isDark ? "#000" : theme.colors.background },
      ]}
    >
      <Text style={{ color: theme.colors.primary }}>
        Unknown phase: {state.phase}
      </Text>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  setupContainer: {
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  battleContainer: {
    flex: 1,
  },
  scrollContent: {
    alignItems: "center",
    paddingBottom: 80,
    paddingHorizontal: 8,
  },
  phaseTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
  },
  statusText: {
    fontSize: 22,
    fontWeight: "700",
  },
  subText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },

  // Grid
  gridWrapper: {
    alignItems: "center",
    marginVertical: 8,
  },
  gridLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  gridRow: {
    flexDirection: "row",
  },
  headerCell: {
    justifyContent: "center",
    alignItems: "center",
  },
  headerText: {
    fontSize: 10,
    fontWeight: "600",
  },
  rowLabel: {
    justifyContent: "center",
    alignItems: "center",
  },
  gridCell: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0.5,
    borderRadius: 2,
    margin: 0.5,
  },
  cellIcon: {
    fontSize: 12,
  },
  missDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Ship dock
  shipDock: {
    width: "100%",
    marginTop: 12,
    paddingHorizontal: 8,
  },
  dockTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
  },
  shipCard: {
    borderWidth: 2,
    borderRadius: 8,
    padding: 8,
    marginRight: 8,
    alignItems: "center",
    minWidth: 72,
  },
  shipName: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
  },
  shipSizeRow: {
    flexDirection: "row",
    gap: 2,
    marginBottom: 2,
  },
  shipSizeBlock: {
    width: 14,
    height: 14,
    borderRadius: 2,
  },

  // Actions
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
    width: "80%",
  },
  confirmBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  infoText: {
    fontSize: 12,
    marginTop: 8,
    textAlign: "center",
  },

  // Battle
  turnBanner: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  turnText: {
    fontSize: 16,
    fontWeight: "700",
  },
  turnSub: {
    fontSize: 12,
    marginTop: 2,
  },
  eventRibbon: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginVertical: 4,
    borderRadius: 6,
    marginHorizontal: 16,
    alignSelf: "center",
  },
  eventText: {
    fontSize: 13,
    fontWeight: "600",
  },
  tabRow: {
    flexDirection: "row",
    marginVertical: 8,
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
  },

  // Stats
  statRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginTop: 12,
  },
  statBadge: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 10,
    marginTop: 2,
  },

  // Salvo
  salvoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
  },
  salvoText: {
    fontSize: 14,
    fontWeight: "600",
  },
  salvoBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },

  // Reveal
  revealSection: {
    marginTop: 20,
    padding: 12,
    width: "100%",
  },
  revealTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  revealPlayer: {
    marginBottom: 12,
  },
  revealPlayerName: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
});

// =============================================================================
// Export — wrapped with GameV4Shell
// =============================================================================

export default withGameV4Shell(BattleshipUI, "battleship");
