/**
 * Navigation Ref Service
 *
 * Provides a global navigation ref that can be used to navigate
 * from outside React components (e.g., notification handlers).
 *
 * Usage:
 *   1. Pass the ref to NavigationContainer in RootNavigator
 *   2. Call navigate() from anywhere (notification handlers, services, etc.)
 *
 * @module services/navigationRef
 */

import {
  CommonActions,
  createNavigationContainerRef,
} from "@react-navigation/native";

import type { RootStackParamList } from "@/types/navigation";

import { createLogger } from "@/utils/log";
const logger = createLogger("services/navigationRef");
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
const pendingActions: (() => void)[] = [];
const MAX_PENDING_ACTIONS = 20;

export function hasRenderedNavigator(): boolean {
  return navigationRef.getRootState() !== undefined;
}

export function isNavigationReady(): boolean {
  return navigationRef.isReady();
}

export function getCurrentRouteNameSafe():
  | keyof RootStackParamList
  | undefined {
  if (!hasRenderedNavigator()) return undefined;

  try {
    return navigationRef.getCurrentRoute()?.name;
  } catch (error) {
    logger.warn("[navigationRef] Failed to read current route:", error);
    return undefined;
  }
}

function runOrQueue(action: () => void, label: string): void {
  if (navigationRef.isReady()) {
    action();
    return;
  }

  if (pendingActions.length >= MAX_PENDING_ACTIONS) {
    pendingActions.shift();
  }

  pendingActions.push(action);
  logger.info(`[navigationRef] Queued navigation action until ready: ${label}`);
}

export function flushPendingNavigation(): void {
  if (!navigationRef.isReady()) return;

  while (pendingActions.length > 0) {
    const nextAction = pendingActions.shift();
    if (!nextAction) continue;

    try {
      nextAction();
    } catch (error) {
      logger.warn("[navigationRef] Failed to flush pending action:", error);
    }
  }
}

/**
 * Navigate to a screen from outside React component tree.
 * Safely checks if navigation is ready before navigating.
 */
export function navigate<RouteName extends keyof RootStackParamList>(
  name: RouteName,
  params?: RootStackParamList[RouteName],
) {
  runOrQueue(
    () =>
      navigationRef.dispatch(
        CommonActions.navigate({
          name: name as string,
          params,
        }),
      ),
    `navigate:${String(name)}`,
  );
}

/**
 * Reset navigation state from outside React component tree.
 */
export function resetTo<RouteName extends keyof RootStackParamList>(
  name: RouteName,
  params?: RootStackParamList[RouteName],
) {
  runOrQueue(
    () =>
      navigationRef.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: name as string, params }],
        }),
      ),
    `reset:${String(name)}`,
  );
}
