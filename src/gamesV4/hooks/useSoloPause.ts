/**
 * Games V4 — useSoloPause Hook
 *
 * Shared pause/resume contract for solo games.
 *
 * Solo games with continuous animation loops (e.g. Brick Breaker) must:
 * 1. Call `useSoloPause(onSoloPause)` passing the shell's onSoloPause prop
 * 2. Use the returned `paused` state to gate their RAF/timer loop
 * 3. On resume from a suspended session, start in paused state
 *
 * Solo games that are purely input-driven (e.g. 2048, Minesweeper) don't
 * need this hook — they have no running loop to pause.
 *
 * @module gamesV4/hooks/useSoloPause
 */

import { useCallback, useEffect, useRef, useState } from "react";

interface UseSoloPauseOptions {
  /**
   * The `onSoloPause` callback from GameShellProps.
   * When the shell is about to suspend & navigate away, it calls this.
   */
  onSoloPause?: () => void;
  /**
   * Whether the session was previously suspended (i.e. the player is
   * returning to a paused game). If true, the game starts paused.
   */
  startPaused?: boolean;
}

interface UseSoloPauseResult {
  /** Whether the game is currently paused. */
  paused: boolean;
  /** Pause the game. */
  pause: () => void;
  /** Resume the game. */
  resume: () => void;
  /** Toggle pause state. */
  togglePause: () => void;
}

/**
 * Provides a paused state and pause/resume controls for solo games
 * with continuous loops. The shell will call onSoloPause before
 * navigating away, which triggers the pause.
 */
export function useSoloPause(
  options: UseSoloPauseOptions = {},
): UseSoloPauseResult {
  const { startPaused = false } = options;
  const [paused, setPaused] = useState(startPaused);
  const pausedRef = useRef(paused);

  // Keep ref in sync
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const pause = useCallback(() => setPaused(true), []);
  const resume = useCallback(() => setPaused(false), []);
  const togglePause = useCallback(() => setPaused((p) => !p), []);

  // Register the pause function with the shell's onSoloPause callback.
  // The shell stores a ref to this; when the back arrow is pressed
  // the shell calls it before navigating away.
  // (This registration is handled by the game component itself —
  //  the game component should call onSoloPause in its own flow.)

  return { paused, pause, resume, togglePause };
}
