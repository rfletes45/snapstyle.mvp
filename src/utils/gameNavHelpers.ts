/**
 * gameNavHelpers — Deterministic navigation state builders for game exit.
 *
 * Problem: `CommonActions.reset({ index: 0, routes: [{ name: "Play" }] })`
 * dispatched from inside PlayStack bubbles up to the Tab Navigator.
 * React Navigation's Tab router rehydrates the state by inserting all
 * missing tabs in definition order (Shop=0, Inbox=1, Play=2, …).
 * The `index: 0` is preserved verbatim, so it points to Shop — not Play.
 *
 * Fix: Dispatch from the ROOT navigator (`navigationRef`) with a complete
 * state tree: MainStack → AppTabs (all 5 tabs, correct index) → target stack.
 *
 * @module utils/gameNavHelpers
 */

import { clearActiveSession } from "@/services/gameRecovery";
import { navigationRef } from "@/services/navigationRef";
import type { SessionEntrySource } from "@/types/gameSessionV3";
import { createLogger } from "@/utils/log";
import { CommonActions } from "@react-navigation/native";

const logger = createLogger("utils/gameNavHelpers");

// Tab order must match the Tab.Navigator definition in RootNavigator.tsx
const TAB_ORDER = ["Shop", "Inbox", "Play", "Moments", "Profile"] as const;

type TabName = (typeof TAB_ORDER)[number];

// =============================================================================
// Double-tap guard
// =============================================================================

let _exitInProgress = false;
let _exitTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Try to claim the exit lock. Returns `true` the first time; subsequent
 * calls within the cooldown window (800 ms) return `false`.
 */
export function claimExitLock(): boolean {
  if (_exitInProgress) {
    if (__DEV__) {
      logger.warn("[GameNav] Double-tap blocked — exit already in progress");
    }
    return false;
  }
  _exitInProgress = true;
  _exitTimer = setTimeout(() => {
    _exitInProgress = false;
    _exitTimer = null;
  }, 800);
  return true;
}

/** Force-release the exit lock (e.g. after navigation completes). */
export function releaseExitLock(): void {
  _exitInProgress = false;
  if (_exitTimer) {
    clearTimeout(_exitTimer);
    _exitTimer = null;
  }
}

// =============================================================================
// State builders
// =============================================================================

/**
 * Build a complete MainStack → AppTabs state that focuses the given tab
 * and optionally seeds that tab's nested stack state.
 *
 * @param targetTab  Which tab to focus (e.g. "Play", "Inbox").
 * @param tabState   Optional nested stack state for that tab.
 */
function buildTabsState(targetTab: TabName, tabState?: object) {
  const tabIndex = TAB_ORDER.indexOf(targetTab);
  if (tabIndex === -1) {
    throw new Error(`[gameNavHelpers] Unknown tab: ${targetTab}`);
  }

  const routes = TAB_ORDER.map((name) => {
    if (name === targetTab && tabState) {
      return { name, state: tabState };
    }
    return { name };
  });

  return {
    index: 0,
    routes: [
      {
        name: "MainTabs" as const,
        state: {
          index: tabIndex,
          routes,
        },
      },
    ],
  };
}

// =============================================================================
// Exit destination type
// =============================================================================

export type ExitDestination =
  | { type: "playHub" }
  | { type: "dmChat"; friendUid: string }
  | { type: "groupChat"; groupId: string };

// =============================================================================
// Internal navigation dispatch (no double-tap guard — callers own the lock)
// =============================================================================

function _dispatchNavTo(
  destination: ExitDestination,
  dispatch?: (action: any) => void,
): void {
  const globalReady = navigationRef.isReady();
  const dispatchFn = dispatch ?? (globalReady ? navigationRef.dispatch : null);

  if (!dispatchFn) {
    logger.warn(
      "[GameNav] no dispatch fn and navigationRef not ready — aborting",
    );
    releaseExitLock();
    return;
  }

  switch (destination.type) {
    case "playHub": {
      if (__DEV__) logger.info("[GameNav] → Play tab / GamesHub");
      dispatchFn(
        CommonActions.reset(
          buildTabsState("Play", {
            routes: [{ name: "GamesHub" }],
            index: 0,
          }) as any,
        ),
      );
      break;
    }
    case "dmChat": {
      if (__DEV__)
        logger.info("[GameNav] → Inbox / ChatDetail", {
          friendUid: destination.friendUid,
        });
      const dmTabsState = buildTabsState("Inbox");
      dispatchFn(
        CommonActions.reset({
          index: 1,
          routes: [
            dmTabsState.routes[0],
            {
              name: "ChatDetail" as const,
              params: { friendUid: destination.friendUid },
            },
          ],
        } as any),
      );
      break;
    }
    case "groupChat": {
      if (__DEV__)
        logger.info("[GameNav] → Inbox / GroupChat", {
          groupId: destination.groupId,
        });
      const groupTabsState = buildTabsState("Inbox");
      dispatchFn(
        CommonActions.reset({
          index: 1,
          routes: [
            groupTabsState.routes[0],
            {
              name: "GroupChat" as const,
              params: { groupId: destination.groupId },
            },
          ],
        } as any),
      );
      break;
    }
  }
}

// =============================================================================
// Navigation actions (simple, synchronous — backward compatible)
// =============================================================================

/**
 * Navigate to Play tab → GamesHub, resetting the Play stack so no stale
 * game routes remain.  Uses `navigationRef` (root navigator) for a
 * deterministic, full-state reset.
 */
export function navigateToPlayHub(dispatch?: (action: any) => void): void {
  if (!claimExitLock()) return;
  _dispatchNavTo({ type: "playHub" }, dispatch);
}

/**
 * Navigate to a DM chat (MainStack → ChatDetail) with the Inbox tab
 * focused underneath so the hardware-back lands on ChatList.
 */
export function navigateToDmChat(
  friendUid: string,
  dispatch?: (action: any) => void,
): void {
  if (!claimExitLock()) return;
  _dispatchNavTo({ type: "dmChat", friendUid }, dispatch);
}

/**
 * Navigate to a group chat (MainStack → GroupChat) with the Inbox tab
 * focused underneath.
 */
export function navigateToGroupChat(
  groupId: string,
  dispatch?: (action: any) => void,
): void {
  if (!claimExitLock()) return;
  _dispatchNavTo({ type: "groupChat", groupId }, dispatch);
}

// =============================================================================
// Unified exit pipeline
// =============================================================================

/**
 * Unified game-exit pipeline.
 *
 * Order of operations:
 *  1. Double-tap guard (800 ms cooldown)
 *  2. Clear recovery bookmark (AsyncStorage)
 *  3. Run optional pre-navigation callback (e.g. `leaveRoom()`)
 *  4. Navigate to destination
 *
 * All errors are caught — the function guarantees navigation even if
 * session cleanup or the pre-hook fails.
 *
 * @example
 * ```ts
 * await exitGameSession(
 *   { type: "playHub" },
 *   { onBeforeLeave: () => room?.leave() },
 * );
 * ```
 */
export async function exitGameSession(
  destination: ExitDestination,
  options?: {
    /** Optional callback that runs BEFORE navigation (e.g. leaveRoom). */
    onBeforeLeave?: () => void | Promise<void>;
    /** Optional dispatch from caller's local navigation. */
    dispatch?: (action: any) => void;
  },
): Promise<void> {
  if (!claimExitLock()) return;

  if (__DEV__) {
    logger.info("[GameExit] START", { destination: destination.type });
  }

  // 1. Clear recovery bookmark
  try {
    await clearActiveSession();
    if (__DEV__) logger.info("[GameExit] CLEAR_SESSION_DONE");
  } catch (err) {
    logger.error("[GameExit] clearActiveSession failed — continuing", err);
  }

  // 2. Pre-navigation callback
  try {
    if (options?.onBeforeLeave) {
      await options.onBeforeLeave();
      if (__DEV__) logger.info("[GameExit] BEFORE_LEAVE_DONE");
    }
  } catch (err) {
    logger.error("[GameExit] onBeforeLeave failed — continuing", err);
  }

  // 3. Navigate (must succeed even if cleanup failed)
  _dispatchNavTo(destination, options?.dispatch);

  if (__DEV__) {
    logger.info("[GameExit] END", { destination: destination.type });
  }
}

// =============================================================================
// v3: Navigate to Session Lobby
// =============================================================================

/**
 * Navigate to `SessionLobbyScreen` for a v3 game session.
 *
 * Uses the same deterministic root-level reset as other navigation helpers
 * to ensure the Play tab is focused underneath. This way the hardware-back
 * lands on GamesHub instead of a stale game screen.
 *
 * @param sessionId    The v3 GameSessions document ID
 * @param source       How the user got here (for analytics + post-game nav)
 * @param dispatch     Optional dispatch from the caller's local navigation.
 *                     Pass `navigation.dispatch` when calling from a screen
 *                     to avoid reliance on the global navigationRef.
 */
export function navigateToSessionLobby(
  sessionId: string,
  source: SessionEntrySource = "play",
  dispatch?: (action: any) => void,
): void {
  const globalReady = navigationRef.isReady();
  const dispatchFn = dispatch ?? (globalReady ? navigationRef.dispatch : null);

  logger.info("[Nav] navigateToSessionLobby", {
    sessionId,
    source,
    hasLocalDispatch: !!dispatch,
    globalRefReady: globalReady,
    willDispatch: !!dispatchFn,
  });

  if (!dispatchFn) {
    logger.error(
      "[Nav] Cannot navigate — no local dispatch and navigationRef not ready",
      { sessionId },
    );
    return;
  }

  try {
    const state = buildTabsState("Play", {
      routes: [
        { name: "GamesHub" },
        {
          name: "SessionLobbyScreen",
          params: { sessionId, source },
        },
      ],
      index: 1,
    });

    dispatchFn(CommonActions.reset(state as any));

    logger.info("[Nav] → SessionLobbyScreen dispatched", { sessionId });
  } catch (err) {
    logger.error("[Nav] navigateToSessionLobby dispatch THREW", err);
  }
}

/**
 * Navigate to the v3 SessionGameOverScreen.
 *
 * Called by game screens when a v3 game finishes. Uses the same
 * deterministic root-level reset so hardware-back lands on GamesHub.
 *
 * @param sessionId  The v3 GameSessions document ID
 * @param dispatch   Optional dispatch from the caller's local navigation.
 */
export function navigateToSessionGameOver(
  sessionId: string,
  dispatch?: (action: any) => void,
): void {
  const globalReady = navigationRef.isReady();
  const dispatchFn = dispatch ?? (globalReady ? navigationRef.dispatch : null);

  if (!dispatchFn) {
    logger.warn(
      "[GameNav] no dispatch fn and navigationRef not ready — cannot open game-over",
    );
    return;
  }

  if (__DEV__) {
    logger.info("[GameNav] → SessionGameOverScreen", { sessionId });
  }

  dispatchFn(
    CommonActions.reset(
      buildTabsState("Play", {
        routes: [
          { name: "GamesHub" },
          {
            name: "SessionGameOverScreen",
            params: { sessionId },
          },
        ],
        index: 1,
      }) as any,
    ),
  );
}
