/**
 * Minesweeper — Main Game Component
 *
 * Mobile-first, classic XP-style Minesweeper with:
 * - Digital mine counter and timer
 * - Smiley reset button
 * - Flag mode toggle
 * - Difficulty selector
 * - Help modal
 * - Zoom/pan for Expert boards
 * - Win/loss overlays
 *
 * Layout (portrait):
 *   ┌─────────────────────────────┐
 *   │  [Menu]   [Difficulty]      │  Top bar
 *   ├─────────────────────────────┤
 *   │  [💣 10]  [😊]  [⏱ 000]   │  Status bar (XP style)
 *   ├─────────────────────────────┤
 *   │                             │
 *   │      ┌───────────────┐     │  Board (centered)
 *   │      │               │     │
 *   │      │   Minefield   │     │
 *   │      │               │     │
 *   │      └───────────────┘     │
 *   │                             │
 *   ├─────────────────────────────┤
 *   │  [🚩 Flag Mode]  [? Help]  │  Bottom controls
 *   └─────────────────────────────┘
 *
 * @module gamesV4/screens/minesweeper/MinesweeperGame
 */

import type { GameShellProps } from "@/gamesV4/components/GameScreenShell";
import { getRemainingMines } from "@/gamesV4/games/minesweeper/engine";
import type {
  MinesweeperDifficulty,
  MinesweeperPublicState,
} from "@/gamesV4/games/minesweeper/types";
import {
  DIFFICULTY_PRESETS,
  formatTime,
} from "@/gamesV4/games/minesweeper/types";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MinesweeperBoard } from "./MinesweeperBoard";
import { MinesweeperHelpModal } from "./MinesweeperHelpModal";

// =============================================================================
// Constants
// =============================================================================

const XP_BLUE = "#000080";
const XP_GRAY = "#C0C0C0";
const XP_DARK_GRAY = "#808080";
const XP_WHITE = "#FFFFFF";
const COUNTER_BG = "#000000";
const COUNTER_RED = "#FF0000";

const SMILEY_FACES: Record<string, string> = {
  idle: "🙂",
  active: "🙂",
  playing: "🙂",
  pressed: "😮",
  won: "😎",
  lost: "😵",
};

// =============================================================================
// Component
// =============================================================================

export default function MinesweeperGame({
  publicState,
  isTerminal,
  submitMove,
  actionLoading,
}: GameShellProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // ── Safe area offsets ──
  // The GameScreenShell renders solo overlay buttons (← back, ⋮ menu) at
  // insets.top + 8, each 40px tall. Game controls must start below them.
  const SHELL_OVERLAY_CLEARANCE = 52; // 8px gap + 40px button + 4px breathing
  const topPad = insets.top + SHELL_OVERLAY_CLEARANCE;
  const bottomPad = Math.max(insets.bottom, 8) + 8;

  // Parse game state from public state
  const gameState = publicState as unknown as MinesweeperPublicState | null;

  // Local UI state
  const [flagMode, setFlagMode] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
  const [diffMenuVisible, setDiffMenuVisible] = useState(false);
  const [smileyPressed, setSmileyPressed] = useState(false);
  const [localElapsed, setLocalElapsed] = useState(0);

  // Timer
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!gameState) return;

    if (gameState.status === "active" && gameState.startedAtMs > 0) {
      // Start local timer
      timerRef.current = setInterval(() => {
        setLocalElapsed(Date.now() - gameState.startedAtMs);
      }, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (gameState.status === "won" || gameState.status === "lost") {
        setLocalElapsed(gameState.elapsedMs);
      } else {
        setLocalElapsed(0);
      }
    }
  }, [gameState?.status, gameState?.startedAtMs, gameState?.elapsedMs]);

  // ── Board sizing ──
  const boardLayout = useMemo(() => {
    if (!gameState)
      return {
        cellSize: 30,
        boardWidth: 300,
        boardHeight: 300,
        needsZoom: false,
      };

    const { cols, rows } = gameState;
    const maxBoardWidth = screenWidth - 24;
    // Subtract safe-area offsets + fixed UI height (menuBar + statusBar +
    // bottomBar + frame borders + board padding ≈ 140px).
    const maxBoardHeight = screenHeight - topPad - bottomPad - 140;

    // Calculate cell size to fit board
    const cellFromWidth = Math.floor(maxBoardWidth / cols);
    const cellFromHeight = Math.floor(maxBoardHeight / rows);
    let cellSize = Math.min(cellFromWidth, cellFromHeight);

    // Minimum cell size for usability
    const MIN_CELL = 24;
    const needsZoom = cellSize < MIN_CELL;

    if (needsZoom) {
      // For Expert: use MIN_CELL and enable scrolling
      cellSize = MIN_CELL;
    }

    // Cap cell size for small boards
    cellSize = Math.min(cellSize, 44);

    const boardWidth = Math.min(cols * cellSize + 12, maxBoardWidth);
    const boardHeight = Math.min(rows * cellSize + 12, maxBoardHeight);

    return { cellSize, boardWidth, boardHeight, needsZoom };
  }, [gameState, screenWidth, screenHeight, topPad, bottomPad]);

  // ── Move handlers ──
  const handleReveal = useCallback(
    (cellIdx: number) => {
      if (!gameState || isTerminal || actionLoading) return;
      submitMove({ action: "reveal", cell: cellIdx });
    },
    [gameState, isTerminal, actionLoading, submitMove],
  );

  const handleFlag = useCallback(
    (cellIdx: number) => {
      if (!gameState || isTerminal || actionLoading) return;
      submitMove({ action: "flag", cell: cellIdx });
    },
    [gameState, isTerminal, actionLoading, submitMove],
  );

  const handleChord = useCallback(
    (cellIdx: number) => {
      if (!gameState || isTerminal || actionLoading) return;
      submitMove({ action: "chord", cell: cellIdx });
    },
    [gameState, isTerminal, actionLoading, submitMove],
  );

  const handleRestart = useCallback(
    (difficulty?: MinesweeperDifficulty) => {
      submitMove({ action: "restart", difficulty });
      setFlagMode(false);
      setLocalElapsed(0);
    },
    [submitMove],
  );

  const handleDifficultyChange = useCallback(
    (diff: MinesweeperDifficulty) => {
      setDiffMenuVisible(false);
      handleRestart(diff);
    },
    [handleRestart],
  );

  // ── Computed display values ──
  const remainingMines = gameState ? getRemainingMines(gameState) : 0;
  const displayTimer = Math.floor(localElapsed / 1000);
  const smileyFace = smileyPressed
    ? SMILEY_FACES.pressed
    : gameState?.status === "won"
      ? SMILEY_FACES.won
      : gameState?.status === "lost"
        ? SMILEY_FACES.lost
        : SMILEY_FACES.active;

  if (!gameState) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { paddingTop: topPad, paddingBottom: bottomPad },
      ]}
    >
      {/* ── Top Menu Bar ── */}
      <View style={styles.menuBar}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setDiffMenuVisible(!diffMenuVisible)}
        >
          <Text style={styles.menuText}>
            {DIFFICULTY_PRESETS[gameState.difficulty].label} ▾
          </Text>
        </TouchableOpacity>

        <View style={styles.menuRight}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setHelpVisible(true)}
          >
            <Text style={styles.menuText}>Help</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Difficulty Dropdown ── */}
      {diffMenuVisible && (
        <View style={[styles.diffDropdown, { top: topPad + 32 }]}>
          {(["easy", "intermediate", "expert"] as MinesweeperDifficulty[]).map(
            (diff) => {
              const preset = DIFFICULTY_PRESETS[diff];
              const isActive = gameState.difficulty === diff;
              return (
                <TouchableOpacity
                  key={diff}
                  style={[
                    styles.diffOption,
                    isActive && styles.diffOptionActive,
                  ]}
                  onPress={() => handleDifficultyChange(diff)}
                >
                  <Text
                    style={[
                      styles.diffOptionText,
                      isActive && styles.diffOptionTextActive,
                    ]}
                  >
                    {isActive ? "✓ " : "   "}
                    {preset.label} ({preset.cols}×{preset.rows},{" "}
                    {preset.mineCount} mines)
                  </Text>
                </TouchableOpacity>
              );
            },
          )}
        </View>
      )}

      {/* ── XP-Style Frame ── */}
      <View style={styles.gameFrame}>
        {/* Status Bar: Mine Counter | Smiley | Timer */}
        <View style={styles.statusBar}>
          {/* Mine Counter (left) */}
          <View style={styles.digitalCounter}>
            <Text style={styles.digitalText}>
              {String(Math.max(-99, Math.min(999, remainingMines))).padStart(
                3,
                " ",
              )}
            </Text>
          </View>

          {/* Smiley Reset Button */}
          <TouchableOpacity
            style={styles.smileyBtn}
            onPressIn={() => setSmileyPressed(true)}
            onPressOut={() => setSmileyPressed(false)}
            onPress={() => handleRestart(gameState.difficulty)}
            activeOpacity={1}
          >
            <View
              style={[
                styles.smileyInner,
                smileyPressed && styles.smileyInnerPressed,
              ]}
            >
              <Text style={styles.smileyText}>{smileyFace}</Text>
            </View>
          </TouchableOpacity>

          {/* Timer (right) */}
          <View style={styles.digitalCounter}>
            <Text style={styles.digitalText}>
              {String(Math.min(999, displayTimer)).padStart(3, "0")}
            </Text>
          </View>
        </View>

        {/* Board */}
        <View style={styles.boardWrapper}>
          <MinesweeperBoard
            state={gameState}
            cellSize={boardLayout.cellSize}
            flagMode={flagMode}
            onReveal={handleReveal}
            onFlag={handleFlag}
            onChord={handleChord}
            boardWidth={boardLayout.boardWidth}
            boardHeight={boardLayout.boardHeight}
            zoomEnabled={boardLayout.needsZoom}
          />
        </View>
      </View>

      {/* ── Bottom Controls ── */}
      <View style={styles.bottomBar}>
        {/* Flag Mode Toggle */}
        <TouchableOpacity
          style={[styles.bottomBtn, flagMode && styles.bottomBtnActive]}
          onPress={() => setFlagMode(!flagMode)}
        >
          <Text style={styles.bottomBtnEmoji}>🚩</Text>
          <Text
            style={[
              styles.bottomBtnText,
              flagMode && styles.bottomBtnTextActive,
            ]}
          >
            {flagMode ? "Flag ON" : "Flag OFF"}
          </Text>
        </TouchableOpacity>

        {/* Game Status */}
        <View style={styles.statusInfo}>
          {gameState.status === "won" && (
            <Text style={styles.statusWin}>🏆 Cleared!</Text>
          )}
          {gameState.status === "lost" && (
            <Text style={styles.statusLoss}>💥 Mine Hit!</Text>
          )}
          {gameState.status === "active" && (
            <Text style={styles.statusActive}>
              {gameState.revealedCount}/{gameState.totalSafeCells}
            </Text>
          )}
          {gameState.status === "idle" && (
            <Text style={styles.statusIdle}>Tap to start</Text>
          )}
        </View>

        {/* Help Button */}
        <TouchableOpacity
          style={styles.bottomBtn}
          onPress={() => setHelpVisible(true)}
        >
          <Text style={styles.bottomBtnEmoji}>❓</Text>
          <Text style={styles.bottomBtnText}>Help</Text>
        </TouchableOpacity>
      </View>

      {/* ── Win Overlay ── */}
      {gameState.status === "won" && (
        <View style={styles.resultOverlay}>
          <View style={styles.resultCard}>
            <Text style={styles.resultEmoji}>😎</Text>
            <Text style={styles.resultTitle}>Board Cleared!</Text>
            <Text style={styles.resultDetail}>
              {DIFFICULTY_PRESETS[gameState.difficulty].label} •{" "}
              {formatTime(gameState.elapsedMs)}
            </Text>
            <Text style={styles.resultSubtext}>
              {gameState.moveCount} moves • {gameState.chordCount} chords
            </Text>
            <View style={styles.resultButtons}>
              <TouchableOpacity
                style={styles.resultBtn}
                onPress={() => handleRestart(gameState.difficulty)}
              >
                <Text style={styles.resultBtnText}>Play Again</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ── Loss Overlay ── */}
      {gameState.status === "lost" && (
        <View style={styles.resultOverlay}>
          <View style={[styles.resultCard, styles.resultCardLoss]}>
            <Text style={styles.resultEmoji}>💥</Text>
            <Text style={styles.resultTitle}>Mine Hit!</Text>
            <Text style={styles.resultDetail}>
              {DIFFICULTY_PRESETS[gameState.difficulty].label} •{" "}
              {formatTime(gameState.elapsedMs)}
            </Text>
            <Text style={styles.resultSubtext}>
              {gameState.revealedCount}/{gameState.totalSafeCells} cells cleared
            </Text>
            <View style={styles.resultButtons}>
              <TouchableOpacity
                style={[styles.resultBtn, styles.resultBtnRetry]}
                onPress={() => handleRestart(gameState.difficulty)}
              >
                <Text style={styles.resultBtnText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Help modal */}
      <MinesweeperHelpModal
        visible={helpVisible}
        onClose={() => setHelpVisible(false)}
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
    backgroundColor: "#C0C0C0",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#C0C0C0",
  },
  loadingText: {
    fontSize: 16,
    color: "#333",
  },

  // ── Menu Bar ──
  menuBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: "#C0C0C0",
  },
  menuRight: {
    flexDirection: "row",
    gap: 4,
  },
  menuItem: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  menuText: {
    fontSize: 14,
    color: "#000",
    fontWeight: "500",
  },

  // ── Difficulty Dropdown ──
  diffDropdown: {
    position: "absolute",
    top: 32,
    left: 4,
    zIndex: 100,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#808080",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    minWidth: 280,
  },
  diffOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  diffOptionActive: {
    backgroundColor: "#000080",
  },
  diffOptionText: {
    fontSize: 13,
    color: "#000",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  diffOptionTextActive: {
    color: "#FFFFFF",
  },

  // ── XP Game Frame ──
  gameFrame: {
    flex: 1,
    marginHorizontal: 6,
    borderWidth: 3,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#FFFFFF",
    borderBottomColor: "#808080",
    borderRightColor: "#808080",
    backgroundColor: "#C0C0C0",
  },

  // ── Status Bar (mine counter + smiley + timer) ──
  statusBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderBottomWidth: 3,
    borderBottomColor: "#808080",
    backgroundColor: "#C0C0C0",
    // Inset border simulation
    borderWidth: 2,
    borderTopColor: "#808080",
    borderLeftColor: "#808080",
    borderRightColor: "#FFFFFF",
  },

  // ── Digital Counter (mine count / timer) ──
  digitalCounter: {
    backgroundColor: COUNTER_BG,
    borderWidth: 2,
    borderTopColor: "#808080",
    borderLeftColor: "#808080",
    borderBottomColor: "#FFFFFF",
    borderRightColor: "#FFFFFF",
    paddingHorizontal: 4,
    paddingVertical: 2,
    minWidth: 58,
    alignItems: "center",
  },
  digitalText: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 24,
    fontWeight: "900",
    color: COUNTER_RED,
    letterSpacing: 2,
    includeFontPadding: false,
  },

  // ── Smiley Button ──
  smileyBtn: {
    padding: 2,
  },
  smileyInner: {
    width: 36,
    height: 36,
    borderWidth: 2,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#FFFFFF",
    borderBottomColor: "#808080",
    borderRightColor: "#808080",
    backgroundColor: "#C0C0C0",
    justifyContent: "center",
    alignItems: "center",
  },
  smileyInnerPressed: {
    borderTopColor: "#808080",
    borderLeftColor: "#808080",
    borderBottomColor: "#FFFFFF",
    borderRightColor: "#FFFFFF",
  },
  smileyText: {
    fontSize: 22,
    includeFontPadding: false,
  },

  // ── Board Wrapper ──
  boardWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 4,
  },

  // ── Bottom Bar ──
  bottomBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#C0C0C0",
    borderTopWidth: 1,
    borderTopColor: "#FFFFFF",
  },
  bottomBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#D4D4D4",
    borderWidth: 2,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#FFFFFF",
    borderBottomColor: "#808080",
    borderRightColor: "#808080",
  },
  bottomBtnActive: {
    borderTopColor: "#808080",
    borderLeftColor: "#808080",
    borderBottomColor: "#FFFFFF",
    borderRightColor: "#FFFFFF",
    backgroundColor: "#A0A0A0",
  },
  bottomBtnEmoji: {
    fontSize: 16,
    includeFontPadding: false,
  },
  bottomBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#000",
  },
  bottomBtnTextActive: {
    color: "#FFF",
  },
  statusInfo: {
    alignItems: "center",
  },
  statusWin: {
    fontSize: 14,
    fontWeight: "800",
    color: "#008000",
  },
  statusLoss: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FF0000",
  },
  statusActive: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },
  statusIdle: {
    fontSize: 12,
    color: "#666",
  },

  // ── Result Overlays ──
  resultOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 50,
  },
  resultCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    minWidth: 260,
    maxWidth: 320,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  resultCardLoss: {
    backgroundColor: "#FFF5F5",
  },
  resultEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#000",
    marginBottom: 4,
  },
  resultDetail: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  resultSubtext: {
    fontSize: 13,
    color: "#666",
    marginBottom: 16,
  },
  resultButtons: {
    flexDirection: "row",
    gap: 12,
  },
  resultBtn: {
    backgroundColor: "#000080",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  resultBtnRetry: {
    backgroundColor: "#CC0000",
  },
  resultBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
