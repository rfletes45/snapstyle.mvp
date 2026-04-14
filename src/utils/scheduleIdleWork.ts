/**
 * scheduleIdleWork
 *
 * Schedules low-priority work that should run when the JS thread is idle,
 * without blocking navigation transitions or animations.
 *
 * Uses requestIdleCallback where available (web, newer RN), falls back to
 * setTimeout(fn, 1) which yields to the next event-loop tick.
 *
 * Returns a cancel function for cleanup in useEffect teardowns.
 *
 * @module utils/scheduleIdleWork
 */

type CancelFn = () => void;

const hasIdleCallback =
  typeof globalThis !== "undefined" &&
  typeof (globalThis as any).requestIdleCallback === "function";

export function scheduleIdleWork(fn: () => void): CancelFn {
  if (hasIdleCallback) {
    const id = (globalThis as any).requestIdleCallback(fn);
    return () => (globalThis as any).cancelIdleCallback(id);
  }
  // Fallback: setTimeout(fn, 1) yields to the event loop without
  // being tied to InteractionManager's animation-gate semantics.
  const id = setTimeout(fn, 1);
  return () => clearTimeout(id);
}
