/**
 * useScreenOrientation — Per-screen orientation locking
 *
 * Locks the screen to a specified orientation on mount and restores
 * portrait orientation on unmount. Designed so any game screen can
 * opt into landscape mode without affecting the rest of the app.
 *
 * Prerequisites:
 *   - `expo-screen-orientation` installed
 *   - app.json / app.config.ts `orientation` set to `"default"` (not `"portrait"`)
 *   - App.tsx locks to PORTRAIT at startup (global default)
 *
 * Usage (landscape game):
 * ```ts
 * useScreenOrientation("LANDSCAPE");
 * ```
 *
 * Usage (landscape — follow sensor for auto-rotate between landscape-left/right):
 * ```ts
 * useScreenOrientation("LANDSCAPE_SENSOR");
 * ```
 *
 * On unmount the hook automatically restores PORTRAIT so the rest
 * of the app stays upright.
 *
 * @module hooks/useScreenOrientation
 */

import { createLogger } from "@/utils/log";
import * as ScreenOrientation from "expo-screen-orientation";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

const log = createLogger("useScreenOrientation");

/**
 * Friendly orientation names → expo-screen-orientation lock constants.
 *
 * - `PORTRAIT`          — locked upright
 * - `LANDSCAPE`         — locked left (home button on right)
 * - `LANDSCAPE_RIGHT`   — locked right (home button on left)
 * - `LANDSCAPE_SENSOR`  — auto-rotates between landscape-left & landscape-right
 * - `ALL`               — unlocked, follows device sensor
 */
export type OrientationLock =
  | "PORTRAIT"
  | "LANDSCAPE"
  | "LANDSCAPE_RIGHT"
  | "LANDSCAPE_SENSOR"
  | "ALL";

const LOCK_MAP: Record<OrientationLock, ScreenOrientation.OrientationLock> = {
  PORTRAIT: ScreenOrientation.OrientationLock.PORTRAIT,
  LANDSCAPE: ScreenOrientation.OrientationLock.LANDSCAPE_LEFT,
  LANDSCAPE_RIGHT: ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT,
  LANDSCAPE_SENSOR: ScreenOrientation.OrientationLock.LANDSCAPE,
  ALL: ScreenOrientation.OrientationLock.ALL,
};

/**
 * Lock the screen to `orientation` on mount; restore PORTRAIT on unmount.
 *
 * @param orientation - The desired orientation while this screen is active.
 *                      Defaults to `"LANDSCAPE_SENSOR"` (most common for games).
 * @param options.restoreOnUnmount - Whether to restore portrait on unmount.
 *                                   Defaults to `true`.
 */
export function useScreenOrientation(
  orientation: OrientationLock = "LANDSCAPE_SENSOR",
  options?: { restoreOnUnmount?: boolean },
): void {
  const restoreOnUnmount = options?.restoreOnUnmount ?? true;
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const targetLock = LOCK_MAP[orientation];

    const lock = async () => {
      try {
        await ScreenOrientation.lockAsync(targetLock);
        log.info(`Locked to ${orientation}`);
      } catch (err) {
        // expo-screen-orientation may throw on web or unsupported platforms
        log.warn(`Failed to lock to ${orientation}:`, err);
      }
    };

    void lock();

    return () => {
      mountedRef.current = false;

      if (restoreOnUnmount) {
        ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT,
        ).catch((err) => {
          log.warn("Failed to restore PORTRAIT on unmount:", err);
        });
      }
    };
  }, [orientation, restoreOnUnmount]);
}

/**
 * Lock the app globally to PORTRAIT.
 *
 * Call this once at app startup (in App.tsx) so every screen defaults
 * to portrait. Individual screens can then use `useScreenOrientation()`
 * to temporarily switch to landscape.
 */
export async function lockToPortrait(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.PORTRAIT,
    );
  } catch (err) {
    // Silently ignore — not critical at startup
    if (__DEV__) {
      console.warn("[useScreenOrientation] lockToPortrait failed:", err);
    }
  }
}
