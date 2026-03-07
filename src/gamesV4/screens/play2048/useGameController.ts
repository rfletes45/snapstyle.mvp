/**
 * 2048 — Game Controller Hook
 *
 * Orchestrates the entire 2048 gameplay and animation lifecycle:
 *
 *   1. Initializes tile entities from the V4 publicState.
 *   2. Handles directional input (swipe / keyboard).
 *   3. Computes moves via the tile-tracking engine.
 *   4. Manages the animation pipeline:
 *        idle → sliding+merging+appearing → idle
 *   5. Calls submitMove() onto the V4 GameScreenShell for
 *      optimistic state + server validation.
 *   6. Manages input locking during animations.
 *   7. Reconciles with server state if it diverges.
 *
 * @module gamesV4/screens/play2048/useGameController
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ANIM_TOTAL_MS } from "./constants";
import { boardsMatch, computeMove, tilesFromBoard } from "./engine";
import type { Direction, GameState, RenderTile, TileData } from "./types";

// ── Hook interface ────────────────────────────────────────────────────────────

interface UseGameControllerParams {
  /** Live publicState from the V4 shell (optimistic or authoritative). */
  publicState: Record<string, unknown> | null;
  /** Whether the session is terminal (game resolved by the server). */
  isTerminal: boolean;
  /** Submit a move to the V4 shell. */
  submitMove: (payload: Record<string, unknown>) => Promise<boolean>;
}

interface UseGameControllerReturn {
  /** Tiles to render (includes animation metadata). */
  renderTiles: RenderTile[];
  /** Key that changes per animation phase (forces tile remount). */
  phaseKey: string;
  /** Current score. */
  score: number;
  /** Best score (highest this session has reached — used as PB indicator). */
  bestScore: number;
  /** Whether the 2048 tile has been reached. */
  hasWon: boolean;
  /** Whether no moves remain. */
  gameOver: boolean;
  /** Whether the win overlay should be shown. */
  showWinOverlay: boolean;
  /** Current move count. */
  moveCount: number;
  /** Current best tile value. */
  bestTile: number;
  /** Whether input is currently locked (animation in progress). */
  inputLocked: boolean;
  /** Last score delta (for pop animation). */
  scoreDelta: number;
  /** Pop key counter (incremented per move, for ScoreCard pop). */
  popKey: number;
  /** Process a directional move. */
  handleMove: (direction: Direction) => void;
  /** Dismiss the win overlay. */
  dismissWinOverlay: () => void;
  /** Whether the game state has been initialized. */
  initialized: boolean;
}

// ── Hook implementation ───────────────────────────────────────────────────────

export function useGameController({
  publicState,
  isTerminal,
  submitMove,
}: UseGameControllerParams): UseGameControllerReturn {
  // ── Core game state (authoritative for the presentation layer) ──
  const [gameState, setGameState] = useState<GameState | null>(null);
  const gameStateRef = useRef<GameState | null>(null);

  // ── Render tile list ──
  const [renderTiles, setRenderTiles] = useState<RenderTile[]>([]);
  const [phaseKey, setPhaseKey] = useState("init");

  // ── Animation / input lock ──
  const [inputLocked, setInputLocked] = useState(false);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Score tracking ──
  const [scoreDelta, setScoreDelta] = useState(0);
  const [popKey, setPopKey] = useState(0);
  const [bestScore, setBestScore] = useState(0);

  // ── Win overlay ──
  const [showWinOverlay, setShowWinOverlay] = useState(false);
  const hasShownWinRef = useRef(false);

  // ── Board sync tracking ──
  const lastBoardRef = useRef<number[][] | null>(null);

  // ── Always-current refs (avoid stale closures in PanResponder / timers) ──
  // PanResponder.create() captures callbacks at mount time. Without refs,
  // handleMove's closure would hold a stale submitMove that validates the
  // adapter against the initial effectivePublicState — the primary root
  // cause of the direction-teleport / score-flash bug.
  const submitMoveRef = useRef(submitMove);
  submitMoveRef.current = submitMove;
  const inputLockedRef = useRef(false);

  // ── Server submission throttle (prevent rate-limit rejections) ──────
  // The server enforces a 500 ms cooldown between moves. Without client-
  // side throttling, rapid swipes trigger "Too many requests" rejections
  // which cascade into optimistic state reverts → tile corruption.
  // We queue the latest move direction and drain the queue every 600 ms.
  const SUBMIT_THROTTLE_MS = 600;
  const lastSubmitTimeRef = useRef(0);
  const pendingSubmitRef = useRef<Record<string, unknown> | null>(null);
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
      if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current);
    };
  }, []);

  // ── Initialize / reconcile from publicState ──
  // Deps include inputLocked so that when animation ends (unlock),
  // we re-evaluate in case reconciliation was deferred during animation.
  useEffect(() => {
    if (!publicState) return;
    const serverBoard = publicState.board as number[][] | undefined;
    if (!serverBoard) return;

    // During animation the controller's tile-tracking state is authoritative.
    // Defer reconciliation — the inputLocked dep will re-trigger this effect
    // once the animation timer unlocks input.
    if (inputLockedRef.current) return;

    // ── Forward-only guard ──────────────────────────────────────────
    // The controller's gameStateRef is always at least as current as (or
    // ahead of) the shell's effectivePublicState.  When the shell reverts
    // optimistic state on a rate-limit rejection, its publicState can
    // temporarily fall back to a stale Firestore snapshot several moves
    // behind the controller.  Reconciling backwards would destroy tile
    // entities and cause the teleport / disappear bug.
    //
    // Rule: after initialization, only reconcile if the incoming state
    // is strictly AHEAD of the controller's state (i.e. a newer state
    // from a reconnect or device switch).
    const serverMoveCount = (publicState.moveCount as number) ?? 0;
    if (gameStateRef.current) {
      if (serverMoveCount < gameStateRef.current.moveCount) {
        // Incoming state is behind — ignore entirely.
        return;
      }
      if (serverMoveCount === gameStateRef.current.moveCount) {
        // Same move — sync lastBoardRef so subsequent checks are clean,
        // but don't rebuild tiles.
        lastBoardRef.current = serverBoard;
        return;
      }
    }

    // Already initialized and boards match — no-op
    if (
      lastBoardRef.current &&
      boardsMatch(lastBoardRef.current, serverBoard)
    ) {
      return;
    }

    // Initialize or reconcile
    const tiles = tilesFromBoard(serverBoard);
    const state: GameState = {
      board: serverBoard,
      tiles,
      score: (publicState.score as number) ?? 0,
      bestTile: (publicState.bestTile as number) ?? 0,
      moveCount: (publicState.moveCount as number) ?? 0,
      mergeCount: (publicState.mergeCount as number) ?? 0,
      hasWon: (publicState.hasWon as boolean) ?? false,
      gameOver: (publicState.gameOver as boolean) ?? false,
    };

    gameStateRef.current = state;
    setGameState(state);
    lastBoardRef.current = serverBoard;

    // Render tiles without animation (snap into place)
    setRenderTiles(
      tiles.map((t) => ({
        id: t.id,
        value: t.value,
        row: t.row,
        col: t.col,
        zIndex: 1,
      })),
    );
    setPhaseKey(`init_${state.moveCount}`);

    // Update best score
    setBestScore((prev) => Math.max(prev, state.score));

    // Check if already won (e.g., reconnecting to a won game)
    if (state.hasWon && !hasShownWinRef.current) {
      hasShownWinRef.current = true;
      setShowWinOverlay(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicState, inputLocked]);

  // ── Handle directional move ──
  const handleMove = useCallback(
    (direction: Direction) => {
      const state = gameStateRef.current;
      if (!state || inputLockedRef.current || state.gameOver || isTerminal)
        return;

      const result = computeMove(
        state.tiles,
        direction,
        state.moveCount,
        state.score,
        state.mergeCount,
        state.hasWon,
      );

      if (!result) return; // No effect

      // Lock input immediately via ref (synchronous guard against rapid
      // swipes before React processes the state update) and via state
      // (triggers re-render for UI + reconciliation dep).
      inputLockedRef.current = true;
      setInputLocked(true);

      // ── Build animated render tile list ──
      const mergeSourceIds = new Set(
        result.mergeEvents.flatMap((m) => m.sourceIds),
      );

      const animated: RenderTile[] = [];

      // Sliding tiles (survivors + merge sources)
      for (const st of result.slidingTiles) {
        const isMergeSource = mergeSourceIds.has(st.id);
        animated.push({
          id: st.id,
          value: st.value,
          row: st.toRow,
          col: st.toCol,
          prevRow: st.fromRow !== st.toRow ? st.fromRow : undefined,
          prevCol: st.fromCol !== st.toCol ? st.fromCol : undefined,
          zIndex: isMergeSource ? 1 : 2,
        });
      }

      // Merge results (pop in after slide)
      for (const me of result.mergeEvents) {
        animated.push({
          id: me.resultId,
          value: me.value,
          row: me.row,
          col: me.col,
          isNew: true,
          isMergeResult: true,
          zIndex: 10,
        });
      }

      // Spawned tile (appear after slide)
      if (result.spawnedTile) {
        animated.push({
          id: result.spawnedTile.id,
          value: result.spawnedTile.value,
          row: result.spawnedTile.row,
          col: result.spawnedTile.col,
          isNew: true,
          zIndex: 5,
        });
      }

      setRenderTiles(animated);
      setPhaseKey(`anim_${result.moveCount}`);

      // ── Update game state ──
      const newState: GameState = {
        board: result.board,
        tiles: result.stableTiles,
        score: result.totalScore,
        bestTile: result.bestTile,
        moveCount: result.moveCount,
        mergeCount: result.mergeCount,
        hasWon: result.hasWon,
        gameOver: result.gameOver,
      };

      gameStateRef.current = newState;
      setGameState(newState);
      lastBoardRef.current = result.board;

      // Score feedback
      setScoreDelta(result.scoreDelta);
      setPopKey((prev) => prev + 1);
      setBestScore((prev) => Math.max(prev, result.totalScore));

      // Win overlay (show only once per session)
      if (result.hasWon && !hasShownWinRef.current) {
        hasShownWinRef.current = true;
        // Small delay so tiles animate first
        setTimeout(() => setShowWinOverlay(true), ANIM_TOTAL_MS + 50);
      }

      // ── After animation: collapse to stable state ──
      // Read from gameStateRef (not the closure's newState) so that if
      // server reconciliation updates the state during the animation
      // window, we collapse to the most current version.
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
      animTimerRef.current = setTimeout(() => {
        const gs = gameStateRef.current;
        if (gs) {
          setRenderTiles(
            gs.tiles.map((t: TileData) => ({
              id: t.id,
              value: t.value,
              row: t.row,
              col: t.col,
              zIndex: 1,
            })),
          );
          setPhaseKey(`stable_${gs.moveCount}`);
        }
        inputLockedRef.current = false;
        setInputLocked(false);
      }, ANIM_TOTAL_MS);

      // ── Submit to V4 system via throttled queue ──
      // Rapid swipes can violate the server's 500 ms cooldown causing
      // "Too many requests" rejections.  We queue the payload and drain
      // after the throttle window so the server never rate-limits us.
      const payload = { direction };
      const now = Date.now();
      const elapsed = now - lastSubmitTimeRef.current;

      if (elapsed >= SUBMIT_THROTTLE_MS) {
        // Enough time has passed — submit immediately.
        lastSubmitTimeRef.current = now;
        submitMoveRef.current(payload);
      } else {
        // Too fast — queue the latest move and schedule a deferred submit.
        pendingSubmitRef.current = payload;
        if (!throttleTimerRef.current) {
          throttleTimerRef.current = setTimeout(() => {
            throttleTimerRef.current = null;
            if (pendingSubmitRef.current) {
              lastSubmitTimeRef.current = Date.now();
              submitMoveRef.current(pendingSubmitRef.current);
              pendingSubmitRef.current = null;
            }
          }, SUBMIT_THROTTLE_MS - elapsed);
        }
      }
    },
    [isTerminal],
  );

  // ── Dismiss win overlay ──
  const dismissWinOverlay = useCallback(() => {
    setShowWinOverlay(false);
  }, []);

  return {
    renderTiles,
    phaseKey,
    score: gameState?.score ?? 0,
    bestScore,
    hasWon: gameState?.hasWon ?? false,
    gameOver: gameState?.gameOver ?? false,
    showWinOverlay,
    moveCount: gameState?.moveCount ?? 0,
    bestTile: gameState?.bestTile ?? 0,
    inputLocked,
    scoreDelta,
    popKey,
    handleMove,
    dismissWinOverlay,
    initialized: gameState !== null,
  };
}
