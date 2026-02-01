/**
 * useHideTabBar Hook
 *
 * Hides the bottom tab bar when the screen is focused.
 * Uses useLayoutEffect to hide the tab bar BEFORE the screen renders,
 * preventing flicker during screen transitions.
 *
 * @file src/hooks/useHideTabBar.ts
 */

import { useNavigation } from "@react-navigation/native";
import { useLayoutEffect } from "react";

/**
 * Hook to hide the bottom tab bar when a screen is mounted.
 *
 * This uses useLayoutEffect instead of useFocusEffect to ensure
 * the tab bar is hidden synchronously BEFORE the first paint,
 * preventing visible flicker during navigation transitions.
 *
 * @example
 * ```tsx
 * function ChatScreen() {
 *   useHideTabBar();
 *   // ... rest of component
 * }
 * ```
 */
export function useHideTabBar(): void {
  const navigation = useNavigation();

  // Use useLayoutEffect to run synchronously before paint
  // This prevents the tab bar from being visible during the transition
  useLayoutEffect(() => {
    const parent = navigation.getParent();
    if (!parent) return;

    // Hide the tab bar immediately (before first paint)
    parent.setOptions({
      tabBarStyle: { display: "none" },
    });

    // Restore tab bar when unmounting
    return () => {
      parent.setOptions({
        tabBarStyle: undefined,
      });
    };
  }, [navigation]);
}

export default useHideTabBar;
