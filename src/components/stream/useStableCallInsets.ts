import { useMemo } from "react";
import { Platform, StatusBar } from "react-native";
import {
  initialWindowMetrics,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

const LAST_RESORT_IOS_TOP_INSET = 59;

/**
 * Full-screen native-stack modals can briefly report a zero top inset on their
 * first mount. Call headers are critical touch targets, so they use the app's
 * initial window metrics as a deterministic first-render floor.
 */
export function useStableCallInsets() {
  const liveInsets = useSafeAreaInsets();
  const initialTopInset = initialWindowMetrics?.insets.top ?? 0;
  const androidStatusBarInset =
    Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0;
  const measuredTopInset = Math.max(
    liveInsets.top,
    initialTopInset,
    androidStatusBarInset,
  );
  const top =
    measuredTopInset > 0
      ? measuredTopInset
      : Platform.OS === "ios"
        ? LAST_RESORT_IOS_TOP_INSET
        : 0;

  return useMemo(
    () => ({
      ...liveInsets,
      top,
    }),
    [liveInsets, top],
  );
}
