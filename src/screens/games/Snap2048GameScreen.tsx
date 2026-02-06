/**
 * Snap2048GameScreen – The classic 2048 game
 *
 * Game logic is a line-for-line TypeScript port of the original open-source
 * 2048 by Gabriele Cirulli (https://github.com/gabrielecirulli/2048):
 *   - js/tile.js       → Tile class
 *   - js/grid.js       → Grid class
 *   - js/game_manager.js → GameManager class
 *
 * Animation faithfully reproduces the original's visual behaviour:
 *   - CSS `transition: 100ms ease-in-out` on `transform`
 *       → Reanimated `withTiming(100ms, easeInOut)` on translateX/Y
 *   - `@keyframes appear` (scale 0→1, 200ms, delayed 100ms)
 *       → new tiles scale in with `withDelay`
 *   - `@keyframes pop` (scale 0→1.2→1, 200ms, delayed 100ms)
 *       → merged tiles pop with `withDelay` + `withSequence`
 *   - HTMLActuator clears DOM & re-creates nodes each move
 *       → we increment a `moveId` counter; each tile gets a stable React key
 *         composed of `tileId-moveId` so React unmounts old instances and
 *         mounts fresh ones each move, just like the original's DOM rebuild.
 *         This guarantees every tile starts its animation from the correct
 *         previousPosition without stale shared-value state.
 *
 * The rendering layer uses React Native + Reanimated and the app's standard
 * game-screen patterns (header, scores, GameOverModal, FriendPickerModal,
 * haptics, single-player session recording).
 */

import FriendPickerModal from "@/components/FriendPickerModal";
import { GameOverModal } from "@/components/games/GameOverModal";
import { useGameHaptics } from "@/hooks/useGameHaptics";
import { sendScorecard } from "@/services/games";
import { recordSinglePlayerSession } from "@/services/singlePlayerSessions";
import { useAuth } from "@/store/AuthContext";
import { useSnackbar } from "@/store/SnackbarContext";
import { useUser } from "@/store/UserContext";
import { Snap2048Stats } from "@/types/singlePlayerGames";
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
  GestureResponderEvent,
  PanResponder,
  PanResponderGestureState,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { Button, Dialog, Portal, Text, useTheme } from "react-native-paper";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

// =============================================================================
// Layout constants
// =============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_SIZE = 4;
const BOARD_SIZE = Math.min(SCREEN_WIDTH - 48, 380);
const CELL_GAP = 8;
const CELL_SIZE = (BOARD_SIZE - CELL_GAP * (GRID_SIZE + 1)) / GRID_SIZE;
const SWIPE_THRESHOLD = 30;

// Original 2048: $transition-speed: 100ms
const TRANSITION_SPEED = 100;
const APPEAR_DURATION = 200;

// Original 2048: merged.value === 2048  →  this.won = true
const WIN_VALUE = 2048;

// Classic 2048 tile colours (from original SCSS $special-colors + base colours)
const TILE_COLORS: Record<number, string> = {
  2: "#EEE4DA",
  4: "#EDE0C8",
  8: "#F2B179",
  16: "#F59563",
  32: "#F67C5F",
  64: "#F65E3B",
  128: "#EDCF72",
  256: "#EDCC61",
  512: "#EDC850",
  1024: "#EDC53F",
  2048: "#EDC22E",
  4096: "#3C3A32",
  8192: "#3C3A32",
};

// =============================================================================
// Tile class  (direct port of js/tile.js)
// =============================================================================

let _nextTileId = 1;

class Tile {
  x: number;
  y: number;
  value: number;
  id: number;
  previousPosition: { x: number; y: number } | null = null;
  mergedFrom: [Tile, Tile] | null = null;

  constructor(position: { x: number; y: number }, value?: number) {
    this.x = position.x;
    this.y = position.y;
    this.value = value ?? 2;
    this.id = _nextTileId++;
  }

  savePosition(): void {
    this.previousPosition = { x: this.x, y: this.y };
  }

  updatePosition(position: { x: number; y: number }): void {
    this.x = position.x;
    this.y = position.y;
  }
}

// =============================================================================
// Grid class  (direct port of js/grid.js)
// =============================================================================

type CellGrid = (Tile | null)[][];

class Grid {
  size: number;
  cells: CellGrid;

  constructor(size: number) {
    this.size = size;
    this.cells = this.empty();
  }

  // Build a grid of the specified size
  empty(): CellGrid {
    const cells: CellGrid = [];
    for (let x = 0; x < this.size; x++) {
      const row: (Tile | null)[] = [];
      for (let y = 0; y < this.size; y++) {
        row.push(null);
      }
      cells.push(row);
    }
    return cells;
  }

  // Find the first available random position
  randomAvailableCell(): { x: number; y: number } | undefined {
    const cells = this.availableCells();
    if (cells.length) {
      return cells[Math.floor(Math.random() * cells.length)];
    }
    return undefined;
  }

  availableCells(): Array<{ x: number; y: number }> {
    const cells: Array<{ x: number; y: number }> = [];
    this.eachCell((x, y, tile) => {
      if (!tile) cells.push({ x, y });
    });
    return cells;
  }

  // Call callback for every cell
  eachCell(callback: (x: number, y: number, tile: Tile | null) => void): void {
    for (let x = 0; x < this.size; x++) {
      for (let y = 0; y < this.size; y++) {
        callback(x, y, this.cells[x][y]);
      }
    }
  }

  // Check if there are any cells available
  cellsAvailable(): boolean {
    return this.availableCells().length > 0;
  }

  // Check if the specified cell is taken
  cellAvailable(cell: { x: number; y: number }): boolean {
    return !this.cellOccupied(cell);
  }

  cellOccupied(cell: { x: number; y: number }): boolean {
    return !!this.cellContent(cell);
  }

  cellContent(cell: { x: number; y: number }): Tile | null {
    if (this.withinBounds(cell)) {
      return this.cells[cell.x][cell.y];
    }
    return null;
  }

  // Inserts a tile at its position
  insertTile(tile: Tile): void {
    this.cells[tile.x][tile.y] = tile;
  }

  removeTile(tile: Tile): void {
    this.cells[tile.x][tile.y] = null;
  }

  withinBounds(position: { x: number; y: number }): boolean {
    return (
      position.x >= 0 &&
      position.x < this.size &&
      position.y >= 0 &&
      position.y < this.size
    );
  }
}

// =============================================================================
// GameManager  (direct port of js/game_manager.js)
//
// Differences from original:
//   - No InputManager / Actuator / StorageManager dependencies
//   - move() returns boolean instead of void (so React layer knows if grid changed)
//   - snapshot() added to produce an immutable render-list for React
//   - bestTile() helper added
// =============================================================================

// 0: up, 1: right, 2: down, 3: left  (matches original exactly)
type Direction = 0 | 1 | 2 | 3;

const VECTORS: Record<Direction, { x: number; y: number }> = {
  0: { x: 0, y: -1 }, // Up
  1: { x: 1, y: 0 }, // Right
  2: { x: 0, y: 1 }, // Down
  3: { x: -1, y: 0 }, // Left
};

class GameManager {
  size: number;
  grid!: Grid;
  score = 0;
  over = false;
  won = false;
  _keepPlaying = false;
  moveCount = 0;
  private startTiles = 2;

  constructor(size: number) {
    this.size = size;
    this.setup();
  }

  // Set up the game
  setup(): void {
    _nextTileId = 1;
    this.grid = new Grid(this.size);
    this.score = 0;
    this.over = false;
    this.won = false;
    this._keepPlaying = false;
    this.moveCount = 0;
    // Add the initial tiles
    this.addStartTiles();
  }

  // Restart the game
  restart(): void {
    this.setup();
  }

  // Keep playing after winning (allows going over 2048)
  keepPlaying(): void {
    this._keepPlaying = true;
  }

  // Return true if the game is lost, or has won and the user hasn't kept playing
  isGameTerminated(): boolean {
    return this.over || (this.won && !this._keepPlaying);
  }

  // Set up the initial tiles to start the game with
  addStartTiles(): void {
    for (let i = 0; i < this.startTiles; i++) {
      this.addRandomTile();
    }
  }

  // Adds a tile in a random position
  addRandomTile(): void {
    if (this.grid.cellsAvailable()) {
      const value = Math.random() < 0.9 ? 2 : 4;
      const cell = this.grid.randomAvailableCell();
      if (cell) {
        const tile = new Tile(cell, value);
        this.grid.insertTile(tile);
      }
    }
  }

  // Save all tile positions and remove merger info
  prepareTiles(): void {
    this.grid.eachCell((_x, _y, tile) => {
      if (tile) {
        tile.mergedFrom = null;
        tile.savePosition();
      }
    });
  }

  // Move a tile and its representation
  moveTile(tile: Tile, cell: { x: number; y: number }): void {
    this.grid.cells[tile.x][tile.y] = null;
    this.grid.cells[cell.x][cell.y] = tile;
    tile.updatePosition(cell);
  }

  // Move tiles on the grid in the specified direction
  move(direction: Direction): boolean {
    // 0: up, 1: right, 2: down, 3: left
    if (this.isGameTerminated()) return false;

    const vector = this.getVector(direction);
    const traversals = this.buildTraversals(vector);
    let moved = false;

    // Save the current tile positions and remove merger information
    this.prepareTiles();

    // Traverse the grid in the right direction and move tiles
    traversals.x.forEach((x) => {
      traversals.y.forEach((y) => {
        const cell = { x, y };
        const tile = this.grid.cellContent(cell);

        if (tile) {
          const positions = this.findFarthestPosition(cell, vector);
          const next = this.grid.cellContent(positions.next);

          // Only one merger per row traversal
          if (next && next.value === tile.value && !next.mergedFrom) {
            const merged = new Tile(positions.next, tile.value * 2);
            merged.mergedFrom = [tile, next];

            this.grid.insertTile(merged);
            this.grid.removeTile(tile);

            // Converge the two tiles' positions
            tile.updatePosition(positions.next);

            // Update the score
            this.score += merged.value;

            // The mighty 2048 tile
            if (merged.value === WIN_VALUE) this.won = true;
          } else {
            this.moveTile(tile, positions.farthest);
          }

          if (!this.positionsEqual(cell, tile)) {
            moved = true; // The tile moved from its original cell!
          }
        }
      });
    });

    if (moved) {
      this.addRandomTile();
      this.moveCount++;

      if (!this.movesAvailable()) {
        this.over = true; // Game over!
      }
    }

    return moved;
  }

  // Get the vector representing the chosen direction
  getVector(direction: Direction): { x: number; y: number } {
    return VECTORS[direction];
  }

  // Build a list of positions to traverse in the right order
  buildTraversals(vector: { x: number; y: number }): {
    x: number[];
    y: number[];
  } {
    const traversals: { x: number[]; y: number[] } = { x: [], y: [] };

    for (let pos = 0; pos < this.size; pos++) {
      traversals.x.push(pos);
      traversals.y.push(pos);
    }

    // Always traverse from the farthest cell in the chosen direction
    if (vector.x === 1) traversals.x = traversals.x.reverse();
    if (vector.y === 1) traversals.y = traversals.y.reverse();

    return traversals;
  }

  findFarthestPosition(
    cell: { x: number; y: number },
    vector: { x: number; y: number },
  ): { farthest: { x: number; y: number }; next: { x: number; y: number } } {
    let previous: { x: number; y: number };
    let current = cell;

    // Progress towards the vector direction until an obstacle is found
    do {
      previous = current;
      current = { x: previous.x + vector.x, y: previous.y + vector.y };
    } while (
      this.grid.withinBounds(current) &&
      this.grid.cellAvailable(current)
    );

    return {
      farthest: previous,
      next: current, // Used to check if a merge is required
    };
  }

  movesAvailable(): boolean {
    return this.grid.cellsAvailable() || this.tileMatchesAvailable();
  }

  // Check for available matches between tiles (more expensive check)
  tileMatchesAvailable(): boolean {
    for (let x = 0; x < this.size; x++) {
      for (let y = 0; y < this.size; y++) {
        const tile = this.grid.cellContent({ x, y });

        if (tile) {
          for (let direction = 0; direction < 4; direction++) {
            const vector = this.getVector(direction as Direction);
            const other = this.grid.cellContent({
              x: x + vector.x,
              y: y + vector.y,
            });

            if (other && other.value === tile.value) {
              return true; // These two tiles can be merged
            }
          }
        }
      }
    }

    return false;
  }

  positionsEqual(
    first: { x: number; y: number },
    second: { x: number; y: number },
  ): boolean {
    return first.x === second.x && first.y === second.y;
  }

  // ── Helpers for the React rendering layer ──

  bestTile(): number {
    let best = 0;
    this.grid.eachCell((_x, _y, tile) => {
      if (tile && tile.value > best) best = tile.value;
    });
    return best;
  }

  /**
   * Produce an array of render-ready tile descriptors.
   *
   * This mirrors what HTMLActuator.addTile does in the original:
   *
   * 1. For a tile with `previousPosition` (it moved):
   *    - First render at previousPosition, then animate to current position
   *
   * 2. For a tile with `mergedFrom` (two tiles merged into it):
   *    - Render both source tiles sliding into the merge cell
   *    - Render the merged tile itself with a "pop" animation (delayed)
   *
   * 3. For a tile with neither (brand new):
   *    - Render with an "appear" animation (scale 0→1, delayed)
   */
  snapshot(): RenderTile[] {
    const tiles: RenderTile[] = [];

    this.grid.eachCell((_x, _y, tile) => {
      if (!tile) return;

      if (tile.mergedFrom) {
        // Emit the two source tiles that slide into the merge cell
        for (const source of tile.mergedFrom) {
          const prev = source.previousPosition ?? {
            x: source.x,
            y: source.y,
          };
          tiles.push({
            id: source.id,
            value: source.value,
            toX: tile.x,
            toY: tile.y,
            fromX: prev.x,
            fromY: prev.y,
            anim: "slide",
          });
        }
        // Emit the merged tile (pops in after slide completes)
        tiles.push({
          id: tile.id,
          value: tile.value,
          toX: tile.x,
          toY: tile.y,
          fromX: tile.x,
          fromY: tile.y,
          anim: "pop",
        });
      } else if (tile.previousPosition) {
        // Regular tile that moved
        tiles.push({
          id: tile.id,
          value: tile.value,
          toX: tile.x,
          toY: tile.y,
          fromX: tile.previousPosition.x,
          fromY: tile.previousPosition.y,
          anim: "slide",
        });
      } else {
        // Brand-new tile
        tiles.push({
          id: tile.id,
          value: tile.value,
          toX: tile.x,
          toY: tile.y,
          fromX: tile.x,
          fromY: tile.y,
          anim: "appear",
        });
      }
    });

    return tiles;
  }
}

// =============================================================================
// Types for the React rendering layer
// =============================================================================

interface RenderTile {
  id: number;
  value: number;
  toX: number; // destination grid column
  toY: number; // destination grid row
  fromX: number; // origin grid column (for slide start)
  fromY: number; // origin grid row
  anim: "slide" | "appear" | "pop";
}

// =============================================================================
// Helper: grid coordinate → pixel offset
// =============================================================================

function gridToPx(pos: number): number {
  return CELL_GAP + pos * (CELL_SIZE + CELL_GAP);
}

// =============================================================================
// AnimatedTile
//
// Mirrors the original 2048's rendering approach:
//
// The original HTMLActuator.addTile():
//   1. Creates a wrapper <div> at previousPosition (via CSS class)
//   2. In requestAnimationFrame, updates the class to current position
//      → CSS transition: 100ms ease-in-out slides it smoothly
//   3. New tiles get class "tile-new" → @keyframes appear (200ms, delayed 100ms)
//   4. Merged tiles get class "tile-merged" → @keyframes pop (200ms, delayed 100ms)
//
// We replicate this exactly:
//   - Component mounts with translateX/Y at the FROM position
//   - useEffect immediately animates to the TO position (100ms ease-in-out)
//   - "appear" tiles start at scale=0, then withDelay(100ms) scale to 1
//   - "pop" tiles start at scale=0, then withDelay(100ms) scale 0→1.2→1
//
// CRITICAL: Each tile instance is fresh-mounted per move (via unique React key
// that includes moveId). This matches the original which clears and rebuilds
// the entire tile-container DOM each actuate() call. Fresh mount guarantees
// shared values start at the correct FROM position.
// =============================================================================

const SLIDE_CONFIG = {
  duration: TRANSITION_SPEED,
  easing: Easing.inOut(Easing.ease),
};

function AnimatedTile({ tile }: { tile: RenderTile }) {
  // Pixel positions
  const startX = gridToPx(tile.fromX);
  const startY = gridToPx(tile.fromY);
  const endX = gridToPx(tile.toX);
  const endY = gridToPx(tile.toY);

  // Initialize at the FROM position (component is fresh-mounted each move)
  const translateX = useSharedValue(startX);
  const translateY = useSharedValue(startY);
  const scale = useSharedValue(tile.anim === "slide" ? 1 : 0);

  useEffect(() => {
    // ── Slide: transition 100ms ease-in-out (matches original CSS) ──
    translateX.value = withTiming(endX, SLIDE_CONFIG);
    translateY.value = withTiming(endY, SLIDE_CONFIG);

    if (tile.anim === "appear") {
      // ── @keyframes appear: opacity 0→1, scale 0→1, 200ms ease ──
      // Original CSS: animation: appear 200ms ease $transition-speed
      // $transition-speed = 100ms delay (waits for slides to finish)
      scale.value = withDelay(
        TRANSITION_SPEED,
        withTiming(1, {
          duration: APPEAR_DURATION,
          easing: Easing.out(Easing.ease),
        }),
      );
    } else if (tile.anim === "pop") {
      // ── @keyframes pop: scale 0→1.2→1, 200ms ease ──
      // Original CSS: animation: pop 200ms ease $transition-speed
      // z-index: 20 on .tile-merged .tile-inner
      scale.value = withDelay(
        TRANSITION_SPEED,
        withSequence(
          withTiming(1.2, {
            duration: APPEAR_DURATION / 2,
            easing: Easing.out(Easing.ease),
          }),
          withSpring(1, { damping: 14, stiffness: 200 }),
        ),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    // Original: .tile-merged .tile-inner { z-index: 20 }, regular: z-index: 10
    zIndex: tile.anim === "pop" ? 20 : 10,
  }));

  // Tile colours & text
  const bgColor = TILE_COLORS[tile.value] || "#3C3A32";
  const textColor = tile.value <= 4 ? "#776E65" : "#F9F6F2";

  // Font size rules matching original CSS breakpoints
  const digits = tile.value.toString().length;
  let fontSize = CELL_SIZE * 0.45; // base: 55px / 107px ≈ 0.51, slightly smaller for mobile
  if (digits === 3)
    fontSize = CELL_SIZE * 0.38; // 45px in original
  else if (digits === 4)
    fontSize = CELL_SIZE * 0.3; // 35px
  else if (digits >= 5) fontSize = CELL_SIZE * 0.25; // 30px (super)

  return (
    <Animated.View
      style={[
        styles.tile,
        {
          width: CELL_SIZE,
          height: CELL_SIZE,
          backgroundColor: bgColor,
        },
        animStyle,
      ]}
    >
      <Text style={[styles.tileText, { color: textColor, fontSize }]}>
        {tile.value}
      </Text>
    </Animated.View>
  );
}

// =============================================================================
// Main component
// =============================================================================

interface Snap2048GameScreenProps {
  navigation: any;
}

export default function Snap2048GameScreen({
  navigation,
}: Snap2048GameScreenProps) {
  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { showSuccess, showError } = useSnackbar();
  const haptics = useGameHaptics();

  // ---------------------------------------------------------------------------
  // Game engine lives in a ref (mutable). React state holds render snapshots.
  // ---------------------------------------------------------------------------
  const managerRef = useRef(new GameManager(GRID_SIZE));

  // moveId increments each move. It's embedded in tile React keys so React
  // unmounts old AnimatedTile instances and mounts fresh ones — exactly like
  // the original's HTMLActuator.actuate() which clears the tile-container and
  // re-creates all DOM nodes.
  const [moveId, setMoveId] = useState(0);
  const [tiles, setTiles] = useState<RenderTile[]>(() =>
    managerRef.current.snapshot(),
  );
  const [score, setScore] = useState(0);
  const [isOver, setIsOver] = useState(false);
  const [isWon, setIsWon] = useState(false);
  const [totalMoves, setTotalMoves] = useState(0);

  const [highScore, setHighScore] = useState(0);
  const [showWinDialog, setShowWinDialog] = useState(false);
  const [hasShownWinDialog, setHasShownWinDialog] = useState(false);
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const startTimeRef = useRef(Date.now());
  const isProcessingRef = useRef(false);

  // Score animation
  const scoreScale = useSharedValue(1);

  useEffect(() => {
    if (score > 0) {
      scoreScale.value = withSequence(
        withSpring(1.15, { damping: 8, stiffness: 400 }),
        withSpring(1, { damping: 12, stiffness: 200 }),
      );
    }
  }, [score, scoreScale]);

  const scoreAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scoreScale.value }],
  }));

  // ---------------------------------------------------------------------------
  // actuate() — read engine state into React, mirrors original's actuate()
  // ---------------------------------------------------------------------------
  const actuate = useCallback(() => {
    const mgr = managerRef.current;
    setTiles(mgr.snapshot());
    setScore(mgr.score);
    setIsOver(mgr.over);
    setIsWon(mgr.won);
    setTotalMoves(mgr.moveCount);
    setMoveId((id) => id + 1);
  }, []);

  // ---------------------------------------------------------------------------
  // Handle game over — record session to Firebase
  // ---------------------------------------------------------------------------
  const handleGameOver = useCallback(
    async (finalScore: number, didWin: boolean, moves: number) => {
      const best = managerRef.current.bestTile();

      haptics.gameOverPattern(didWin);

      if (currentFirebaseUser?.uid) {
        const stats: Snap2048Stats = {
          gameType: "snap_2048",
          bestTile: best,
          moveCount: moves,
          mergeCount: 0,
          didWin,
        };

        const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);

        await recordSinglePlayerSession(currentFirebaseUser.uid, {
          gameType: "snap_2048",
          finalScore,
          stats,
          duration,
        });
      }

      setShowGameOverModal(true);
    },
    [currentFirebaseUser, haptics],
  );

  // ---------------------------------------------------------------------------
  // handleSwipe — the core move handler
  // ---------------------------------------------------------------------------
  const handleSwipe = useCallback(
    (direction: Direction) => {
      if (isProcessingRef.current) return;

      const mgr = managerRef.current;
      if (mgr.isGameTerminated()) return;

      isProcessingRef.current = true;

      const moved = mgr.move(direction);

      if (moved) {
        haptics.trigger("move");
        actuate();

        if (mgr.score > highScore) {
          setHighScore(mgr.score);
        }

        if (mgr.won && !hasShownWinDialog) {
          setHasShownWinDialog(true);
          setShowWinDialog(true);
          haptics.celebrationPattern();
        }

        if (mgr.over) {
          handleGameOver(mgr.score, mgr.won, mgr.moveCount);
        }
      }

      // Debounce: allow next move after animations complete
      setTimeout(() => {
        isProcessingRef.current = false;
      }, TRANSITION_SPEED + 50);
    },
    [highScore, hasShownWinDialog, haptics, handleGameOver, actuate],
  );

  const handleSwipeRef = useRef(handleSwipe);
  handleSwipeRef.current = handleSwipe;

  // ---------------------------------------------------------------------------
  // Pan responder — touch → direction mapping (matches original's touch handler)
  //
  // Original: absDx > absDy ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0)
  // ---------------------------------------------------------------------------
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderRelease: (
          _evt: GestureResponderEvent,
          gs: PanResponderGestureState,
        ) => {
          const { dx, dy } = gs;
          const absDx = Math.abs(dx);
          const absDy = Math.abs(dy);

          // Original uses threshold of 10; we use 30 for mobile
          if (Math.max(absDx, absDy) < SWIPE_THRESHOLD) return;

          // (right : left) : (down : up)  — exact same logic as original
          const direction: Direction =
            absDx > absDy ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;

          handleSwipeRef.current(direction);
        },
      }),
    [],
  );

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  const startNewGame = useCallback(() => {
    haptics.trigger("selection");
    managerRef.current.restart();
    actuate();
    setHasShownWinDialog(false);
    setShowWinDialog(false);
    setShowGameOverModal(false);
    isProcessingRef.current = false;
    startTimeRef.current = Date.now();
  }, [haptics, actuate]);

  const continueGame = useCallback(() => {
    managerRef.current.keepPlaying();
    setShowWinDialog(false);
  }, []);

  const handleShare = useCallback(() => {
    setShowFriendPicker(true);
  }, []);

  const handleSelectFriend = useCallback(
    async (friend: {
      friendUid: string;
      username: string;
      displayName: string;
    }) => {
      if (!currentFirebaseUser?.uid || !profile) return;

      setShowFriendPicker(false);

      try {
        const success = await sendScorecard(
          currentFirebaseUser.uid,
          friend.friendUid,
          {
            gameId: "snap_2048",
            score,
            playerName: profile.displayName || profile.username || "Player",
          },
        );

        if (success) {
          showSuccess(`Score shared with ${friend.displayName}!`);
        } else {
          showError("Failed to share score. Try again.");
        }
      } catch {
        showError("Failed to share score. Try again.");
      }
    },
    [currentFirebaseUser, profile, score, showSuccess, showError],
  );

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------
  const bestTile = managerRef.current.bestTile();

  const gridCells = useMemo(() => {
    const cells: React.ReactElement[] = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        cells.push(
          <View
            key={`bg-${r}-${c}`}
            style={[
              styles.gridCell,
              {
                left: gridToPx(c),
                top: gridToPx(r),
                width: CELL_SIZE,
                height: CELL_SIZE,
              },
            ]}
          />,
        );
      }
    }
    return cells;
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Button
          mode="text"
          onPress={() => navigation.goBack()}
          icon="arrow-left"
          textColor={theme.colors.onBackground}
        >
          Back
        </Button>
        <Text variant="headlineSmall" style={styles.title}>
          2048
        </Text>
        <View style={{ width: 80 }} />
      </View>

      {/* Score Display */}
      <View style={styles.scoreRow}>
        <Animated.View
          style={[
            styles.scoreBox,
            { backgroundColor: theme.colors.primaryContainer },
            scoreAnimStyle,
          ]}
        >
          <Text
            variant="labelMedium"
            style={{ color: theme.colors.onPrimaryContainer }}
          >
            SCORE
          </Text>
          <Text
            variant="headlineMedium"
            style={{
              color: theme.colors.onPrimaryContainer,
              fontWeight: "bold",
            }}
          >
            {score}
          </Text>
        </Animated.View>

        <View
          style={[
            styles.scoreBox,
            { backgroundColor: theme.colors.secondaryContainer },
          ]}
        >
          <Text
            variant="labelMedium"
            style={{ color: theme.colors.onSecondaryContainer }}
          >
            BEST
          </Text>
          <Text
            variant="headlineMedium"
            style={{
              color: theme.colors.onSecondaryContainer,
              fontWeight: "bold",
            }}
          >
            {Math.max(highScore, score)}
          </Text>
        </View>
      </View>

      {/* Best Tile */}
      <View style={styles.bestTileRow}>
        <Text variant="labelLarge" style={{ color: theme.colors.onBackground }}>
          Best Tile: {bestTile}
        </Text>
        {isWon && (
          <View style={styles.winBadge}>
            <MaterialCommunityIcons name="trophy" size={16} color="#FFD700" />
            <Text style={styles.winBadgeText}>2048!</Text>
          </View>
        )}
      </View>

      {/* Game Board */}
      <View
        style={[styles.board, { backgroundColor: "#BBADA0" }]}
        {...panResponder.panHandlers}
      >
        {gridCells}

        {/*
          Each tile gets a key that includes moveId so React creates a fresh
          AnimatedTile instance per move — matching the original's DOM rebuild.
          The index suffix handles the case where two source tiles from a merge
          share the same tileId within a single snapshot.
        */}
        {tiles.map((t, i) => (
          <AnimatedTile key={`${t.id}-${t.anim}-${moveId}-${i}`} tile={t} />
        ))}

        {/* Game Over Overlay */}
        {isOver && (
          <View style={styles.gameOverOverlay}>
            <Text style={styles.gameOverText}>Game Over!</Text>
            <Text style={styles.gameOverScore}>Score: {score}</Text>
          </View>
        )}
      </View>

      {/* Instructions */}
      <Text
        variant="bodyMedium"
        style={[styles.instructions, { color: theme.colors.onSurfaceVariant }]}
      >
        Swipe to move tiles. Matching tiles merge!
      </Text>

      {/* New Game Button */}
      <Button
        mode="contained"
        onPress={startNewGame}
        style={styles.newGameBtn}
        icon="refresh"
      >
        New Game
      </Button>

      {/* Win Dialog */}
      <Portal>
        <Dialog visible={showWinDialog} onDismiss={continueGame}>
          <Dialog.Title>🎉 You Win!</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyLarge">Congratulations! You reached 2048!</Text>
            <Text variant="bodyMedium" style={{ marginTop: 8 }}>
              Score: {score}
            </Text>
            <Text
              variant="bodySmall"
              style={{ marginTop: 4, color: theme.colors.onSurfaceVariant }}
            >
              You can continue playing to reach higher tiles!
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={startNewGame}>New Game</Button>
            <Button mode="contained" onPress={continueGame}>
              Keep Playing
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Game Over Modal */}
      <GameOverModal
        visible={showGameOverModal}
        result={isWon ? "win" : "loss"}
        stats={{
          score,
          personalBest: highScore,
          isNewBest: score > highScore,
          moves: totalMoves,
        }}
        onRematch={startNewGame}
        onShare={handleShare}
        onExit={() => navigation.goBack()}
        showRematch={true}
        showShare={true}
        title={isWon ? `🏆 ${bestTile} Achieved!` : `Best Tile: ${bestTile}`}
      />

      {/* Friend Picker */}
      <FriendPickerModal
        visible={showFriendPicker}
        onDismiss={() => setShowFriendPicker(false)}
        onSelectFriend={handleSelectFriend}
        title="Share Score With..."
        currentUserId={currentFirebaseUser?.uid || ""}
      />
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 60 : 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  title: {
    fontWeight: "bold",
  },
  scoreRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 16,
  },
  scoreBox: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    minWidth: 100,
  },
  bestTileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  winBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#4CAF50",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  winBadgeText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 12,
  },
  board: {
    width: BOARD_SIZE,
    height: BOARD_SIZE,
    borderRadius: 8,
    position: "relative",
    overflow: "hidden",
  },
  gridCell: {
    position: "absolute",
    backgroundColor: "#CDC1B4",
    borderRadius: 4,
  },
  tile: {
    position: "absolute",
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  tileText: {
    fontWeight: "bold",
  },
  gameOverOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(238, 228, 218, 0.73)",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  gameOverText: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#776E65",
  },
  gameOverScore: {
    fontSize: 24,
    color: "#776E65",
    marginTop: 8,
  },
  instructions: {
    marginTop: 24,
    textAlign: "center",
  },
  newGameBtn: {
    marginTop: 16,
  },
});
