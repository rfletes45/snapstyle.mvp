/**
 * chatUiDebug — structured debug logging for the chat transient-UI stack.
 *
 * Covers: picker sheets (emoji / GIF / sticker / game / gif-sticker),
 * main composer keyboard handoff, `ComposerSheetContext` state transitions,
 * and the `ChatKeyboardScrollView` footer-offset derivation.
 *
 * Every event carries:
 *   - `seq`: monotonically increasing sequence number (global)
 *   - `ts`:  performance-now millis since app start (or `Date.now()` fallback)
 *   - `event`: short stable identifier (e.g. "activateSheet")
 *   - `data`: bag of relevant shared-value snapshots / flags
 *
 * Enable with `setChatUiDebugEnabled(true)` from a debug menu, or flip the
 * `DEFAULT_ENABLED` constant below while iterating.  When disabled the
 * helper is a near-zero-cost no-op.
 *
 * Why not a generic logger?  The chat UI state-convergence bugs are timing-
 * sensitive — a `console.log` with `Date.now()` per-call inside a worklet
 * branch creates uneven output that's hard to correlate.  This module:
 *   1. assigns a single monotonic seq so events can be sorted deterministically
 *   2. always formats the prefix as `[ChatUI #seq @ms] event`
 *   3. avoids serializing objects on the worklet side — only JS-side callers
 *      pass the `data` bag
 *
 * If the bug survives another fix pass, flip `DEFAULT_ENABLED` and repro;
 * the log line sequence + state snapshots will pinpoint the exact
 * transition path that failed to converge.
 *
 * @module utils/chatUiDebug
 */

/** Default on/off.  Flip to `true` while iterating on picker/keyboard bugs. */
const DEFAULT_ENABLED: boolean = false;

let enabled: boolean = __DEV__ && DEFAULT_ENABLED;
let seq = 0;
const startTs =
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

function nowMs(): number {
  if (
    typeof performance !== "undefined" &&
    typeof performance.now === "function"
  ) {
    return Math.round(performance.now() - startTs);
  }
  return Date.now() - startTs;
}

export function setChatUiDebugEnabled(next: boolean): void {
  enabled = __DEV__ && next;
}

export function isChatUiDebugEnabled(): boolean {
  return enabled;
}

/**
 * Primary logger.  Safe to call from any JS thread path (React render,
 * useEffect, setTimeout, useAnimatedReaction JS side via `runOnJS`).
 *
 * Do NOT call directly from a worklet — use `runOnJS(chatDbg)(...)` so
 * the payload can be safely serialized.
 */
export function chatDbg(event: string, data?: Record<string, unknown>): void {
  if (!enabled) return;
  seq += 1;
  // eslint-disable-next-line no-console
  console.log(`[ChatUI #${seq} @${nowMs()}ms] ${event}`, data ?? {});
}

/** Snapshot of the composer-sheet shared-value world at a point in time. */
export interface ChatUiStateSnapshot {
  isSheetActive: number;
  sheetTranslateY: number;
  sheetVisible: number;
  initialSnapHeight: number;
  handoffFloor: number;
  liveKeyboardHeight: number;
  sheetExtraPadding: number;
  handoffPending?: boolean;
  switching?: boolean;
}

/** Format a shared-value snapshot as a compact object — rounds floats. */
export function snapshotToLog(s: ChatUiStateSnapshot): Record<string, unknown> {
  return {
    isSheetActive: s.isSheetActive,
    sheetTranslateY: Math.round(s.sheetTranslateY),
    sheetVisible: Math.round(s.sheetVisible),
    initialSnapHeight: Math.round(s.initialSnapHeight),
    handoffFloor: Math.round(s.handoffFloor),
    liveKeyboardHeight: Math.round(s.liveKeyboardHeight),
    sheetExtraPadding: Math.round(s.sheetExtraPadding),
    handoffPending: s.handoffPending,
    switching: s.switching,
  };
}

// ─── Motion-discontinuity detector ───────────────────────────────────────────
//
// A "smooth" bottom-offset transition should move at most ~keyboardHeight/15
// (~22px per frame at 60fps for a standard 250ms keyboard animation).  A
// single-frame delta substantially larger than that is a TELEPORT — the
// composer/toolbar appears to snap instead of slide.
//
// `reportOffsetJump` is called from a `useAnimatedReaction` via `runOnJS`
// whenever the delta between two consecutive frames exceeds
// `MOTION_JUMP_THRESHOLD_PX`.  The sampled event lets us:
//   - confirm whether rigidness is caused by a real discontinuity
//     (jump > threshold) or by a layout-property animation stutter
//     (smooth, all deltas < threshold, but rendered in fewer frames)
//   - correlate jumps with the preceding state transition (activateSheet,
//     deactivateSheet, keyboard show/hide) using the monotonic seq
//
// Flip `DEFAULT_ENABLED` to see these logs.

/** Any single-frame change in the effective bottom offset above this is flagged. */
export const MOTION_JUMP_THRESHOLD_PX = 40;

export interface MotionJumpReport {
  /** Short label for the pipeline that jumped (e.g. "effectiveInset"). */
  source: string;
  /** Previous frame's value. */
  from: number;
  /** Current frame's value. */
  to: number;
  /** Delta (always positive). */
  delta: number;
  /** Extra correlated state for diagnosis. */
  context?: Record<string, unknown>;
}

export function reportOffsetJump(report: MotionJumpReport): void {
  if (!enabled) return;
  // Re-use chatDbg's formatting so jumps interleave with state transitions
  // in the unified timeline.
  chatDbg(`MOTION_JUMP:${report.source}`, {
    from: Math.round(report.from),
    to: Math.round(report.to),
    delta: Math.round(report.delta),
    ...(report.context ?? {}),
  });
}

// ─── Keyboard↔Toolbar sync diagnostics ───────────────────────────────────────
//
// The chat composer/toolbar position is driven by `effectiveInset` in the
// fallback path (animated `paddingBottom` on `FallbackKeyboardContainer`),
// which is derived as `max(|keyboardHeight|, sheetVisible-clamped,
// handoffFloor)`.  When no sheet is active and no handoff floor is
// pending, this should equal `|keyboardHeight|` exactly every frame —
// any non-zero drift is a synchronization bug.
//
// The canonical symptom: during an open or close, the toolbar reaches its
// target before the iOS keyboard visually does (toolbar outruns), leaving
// a visible gap on open / partial overlap on close.  This helper captures
// the exact frame and state where the drift exceeds the threshold so we
// can trace it back to which driver is out of sync.
//
// Drift up to a few pixels is unavoidable due to native bridge marshalling
// latency; anything over ~2 px during active motion is a real desync.
export const KEYBOARD_TOOLBAR_SYNC_THRESHOLD_PX = 2;

export type KeyboardToolbarSyncSource =
  | "rkbc-native" // react-native-keyboard-controller native module available
  | "rn-fallback" // Expo Go / fallback bridge via RN Keyboard events
  | "unknown";

export interface KeyboardToolbarSyncReport {
  event:
    | "motion-start"
    | "motion-end"
    | "drift"
    | "toolbar-ahead"
    | "toolbar-behind";
  keyboardHeight: number;
  toolbarOffset: number;
  delta: number; // toolbar - keyboard; positive means toolbar ahead (higher than keyboard)
  source: KeyboardToolbarSyncSource;
  direction: "opening" | "closing" | "rest";
  floor?: number;
  sheetActive?: number;
  route?: string;
}

export function logKeyboardToolbarSync(
  report: KeyboardToolbarSyncReport,
): void {
  if (!enabled) return;
  chatDbg(`kbtb:${report.event}`, {
    kb: Math.round(report.keyboardHeight),
    tb: Math.round(report.toolbarOffset),
    delta: Math.round(report.delta),
    dir: report.direction,
    src: report.source,
    floor: report.floor !== undefined ? Math.round(report.floor) : undefined,
    sheetActive: report.sheetActive,
    route: report.route,
  });
}

/**
 * Emit a single startup log identifying which keyboard-animation driver is
 * active.  Helps distinguish "RKBC is missing and we're on the Reanimated
 * fallback with iOS-approximated easing" from "RKBC is loaded and driving
 * the shared value via CADisplayLink" when debugging TestFlight builds.
 *
 * Call exactly once at app startup (gated by a module-level flag).  Always
 * logs (not gated by `enabled`) so the driver identity is visible even
 * when debug logging is otherwise off — this is a one-shot identity fact,
 * not per-frame noise.
 */
let keyboardDriverLogged = false;
export function logKeyboardDriverOnce(source: KeyboardToolbarSyncSource): void {
  if (keyboardDriverLogged) return;
  keyboardDriverLogged = true;
  // eslint-disable-next-line no-console
  console.log(`[ChatUI boot] keyboard-driver=${source}`);
}
