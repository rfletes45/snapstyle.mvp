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

/**
 * Navigate to a screen from outside React component tree.
 * Safely checks if navigation is ready before navigating.
 */
export function navigate<RouteName extends keyof RootStackParamList>(
  name: RouteName,
  params?: RootStackParamList[RouteName],
) {
  if (navigationRef.isReady()) {
    navigationRef.dispatch(
      CommonActions.navigate({
        name: name as string,
        params,
      }),
    );
  } else {
    logger.warn(
      "[navigationRef] Cannot navigate - navigator not ready yet. Target:",
      name,
    );
  }
}

/**
 * Reset navigation state from outside React component tree.
 */
export function resetTo<RouteName extends keyof RootStackParamList>(
  name: RouteName,
  params?: RootStackParamList[RouteName],
) {
  if (navigationRef.isReady()) {
    navigationRef.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: name as string, params }],
      }),
    );
  }
}
