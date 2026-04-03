/**
 * useScreenOrientation - Per-screen orientation locking
 *
 * Locks the screen to a specified orientation on mount and restores
 * portrait orientation on unmount. Designed so any game screen can
 * opt into landscape mode without affecting the rest of the app.
 *
 * Prerequisites:
 *   - `expo-screen-orientation` installed
 *   - app.json / app.config.ts `orientation` set to `"default"` (not `"portrait"`)
 *   - App.tsx locks to portrait at startup (global default)
 *
 * Usage (landscape game):
 * ```ts
 * useScreenOrientation("LANDSCAPE");
 * ```
 *
 * Usage (landscape - follow sensor for auto-rotate between landscape-left/right):
 * ```ts
 * useScreenOrientation("LANDSCAPE_SENSOR");
 * ```
 *
 * On unmount the hook automatically restores portrait so the rest
 * of the app stays upright.
 *
 * @module hooks/useScreenOrientation
 */

import { createLogger } from "@/utils/log";
import * as ScreenOrientation from "expo-screen-orientation";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

const log = createLogger("useScreenOrientation");
const DEFAULT_PORTRAIT_LOCK = ScreenOrientation.OrientationLock.PORTRAIT_UP;

/**
 * Friendly orientation names -> expo-screen-orientation lock constants.
 *
 * - `PORTRAIT`          - locked upright
 * - `LANDSCAPE`         - locked left (home button on right)
 * - `LANDSCAPE_RIGHT`   - locked right (home button on left)
 * - `LANDSCAPE_SENSOR`  - auto-rotates between landscape-left & landscape-right
 * - `ALL`               - unlocked, follows device sensor
 */
export type OrientationLock =
  | "PORTRAIT"
  | "LANDSCAPE"
  | "LANDSCAPE_RIGHT"
  | "LANDSCAPE_SENSOR"
  | "ALL";

const LOCK_MAP: Record<OrientationLock, ScreenOrientation.OrientationLock> = {
  // Expo documents that OrientationLock.PORTRAIT can be invalid on devices
  // that don't support upside-down portrait, so the app uses upright portrait.
  PORTRAIT: DEFAULT_PORTRAIT_LOCK,
  LANDSCAPE: ScreenOrientation.OrientationLock.LANDSCAPE_LEFT,
  LANDSCAPE_RIGHT: ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT,
  LANDSCAPE_SENSOR: ScreenOrientation.OrientationLock.LANDSCAPE,
  ALL: ScreenOrientation.OrientationLock.ALL,
};

function isUnsupportedOrientationError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : error ? String(error) : "";
  return message
    .toLowerCase()
    .includes("does not support the requested orientation");
}

async function supportsOrientationLock(
  orientationLock: ScreenOrientation.OrientationLock,
): Promise<boolean> {
  try {
    return await ScreenOrientation.supportsOrientationLockAsync(
      orientationLock,
    );
  } catch {
    return true;
  }
}

/**
 * Lock the screen to `orientation` on mount; restore portrait on unmount.
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
      const isSupported = await supportsOrientationLock(targetLock);
      if (!isSupported) {
        log.info(`Skipping unsupported orientation lock: ${orientation}`);
        return;
      }

      try {
        await ScreenOrientation.lockAsync(targetLock);
        log.info(`Locked to ${orientation}`);
      } catch (err) {
        if (isUnsupportedOrientationError(err)) {
          log.info(`Orientation lock unsupported for ${orientation}`);
          return;
        }
        log.warn(`Failed to lock to ${orientation}:`, err);
      }
    };

    void lock();

    return () => {
      mountedRef.current = false;

      if (restoreOnUnmount) {
        supportsOrientationLock(DEFAULT_PORTRAIT_LOCK)
          .then((isSupported) => {
            if (!isSupported) return;
            return ScreenOrientation.lockAsync(DEFAULT_PORTRAIT_LOCK);
          })
          .catch((err) => {
            if (isUnsupportedOrientationError(err)) return;
            log.warn("Failed to restore portrait on unmount:", err);
          });
      }
    };
  }, [orientation, restoreOnUnmount]);
}

/**
 * Lock the app globally to portrait.
 *
 * Call this once at app startup so every screen defaults
 * to portrait. Individual screens can then use `useScreenOrientation()`
 * to temporarily switch to landscape.
 */
export async function lockToPortrait(): Promise<void> {
  if (Platform.OS === "web") return;

  const isSupported = await supportsOrientationLock(DEFAULT_PORTRAIT_LOCK);
  if (!isSupported) {
    log.info("Skipping startup portrait lock on unsupported device/runtime");
    return;
  }

  try {
    await ScreenOrientation.lockAsync(DEFAULT_PORTRAIT_LOCK);
  } catch (err) {
    if (isUnsupportedOrientationError(err)) {
      log.info("Startup portrait lock unsupported on this device/runtime");
      return;
    }
    log.warn("[useScreenOrientation] lockToPortrait failed:", err);
  }
}
