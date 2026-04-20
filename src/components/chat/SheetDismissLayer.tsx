/**
 * SheetDismissLayer
 *
 * A transparent wrapper that detects short taps and scroll/drag gestures
 * in the chat content area and dismisses the active keyboard-replacement
 * sheet (emoji/GIF/sticker picker).
 *
 * Touch discrimination:
 * - Short tap  (< 300ms, < 10px movement) → dismiss active sheet
 * - Scroll/drag                           → no dismissal; scrolling continues
 * - Long press (> 300ms, minimal movement) → no dismissal; the underlying
 *   message TouchableOpacity.onLongPress fires normally
 *
 * Implementation:
 * Uses React Native's synthetic onTouchStart/Move/End events which bubble
 * up from child views regardless of native scroll handling or RNGH gesture
 * handlers.  The wrapper View has default pointerEvents so it never blocks
 * or intercepts touches — it only monitors the bubble phase.
 *
 * @module components/chat/SheetDismissLayer
 */

import { useComposerSheet } from "@/contexts/ComposerSheetContext";
import React, { useCallback, useRef } from "react";
import type { GestureResponderEvent } from "react-native";
import { StyleSheet, View } from "react-native";

// ─── Tuning ──────────────────────────────────────────────────────────────────

/** Maximum duration (ms) for a touch to count as a "tap". */
const TAP_MAX_MS = 300;

/** Minimum movement (px) to treat the touch as a scroll/drag. */
const DRAG_THRESHOLD_PX = 10;

// ─── Types ───────────────────────────────────────────────────────────────────

interface TouchState {
  time: number;
  pageX: number;
  pageY: number;
  dismissed: boolean;
}

export interface SheetDismissLayerProps {
  children: React.ReactNode;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SheetDismissLayer({ children }: SheetDismissLayerProps) {
  const { isSheetActive, dismissActiveSheet } = useComposerSheet();
  const touchRef = useRef<TouchState>({
    time: 0,
    pageX: 0,
    pageY: 0,
    dismissed: false,
  });

  const onTouchStart = useCallback(
    (e: GestureResponderEvent) => {
      if (isSheetActive.value !== 1) return;
      touchRef.current = {
        time: Date.now(),
        pageX: e.nativeEvent.pageX,
        pageY: e.nativeEvent.pageY,
        dismissed: false,
      };
    },
    [isSheetActive],
  );

  const onTouchMove = useCallback((e: GestureResponderEvent) => {
    const t = touchRef.current;
    if (t.time === 0 || t.dismissed) return;

    const dx = Math.abs(e.nativeEvent.pageX - t.pageX);
    const dy = Math.abs(e.nativeEvent.pageY - t.pageY);

    // If the finger moved significantly, treat as scroll/drag — not a tap.
    // Mark dismissed so onTouchEnd won't fire a tap-dismiss either.
    if (dx > DRAG_THRESHOLD_PX || dy > DRAG_THRESHOLD_PX) {
      t.dismissed = true;
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    const t = touchRef.current;
    if (t.time === 0 || t.dismissed) return;
    if (isSheetActive.value !== 1) {
      t.time = 0;
      return;
    }

    const duration = Date.now() - t.time;
    if (duration < TAP_MAX_MS) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log("[ChatTransientUi] SheetDismissLayer tap-to-dismiss", {
          durationMs: duration,
        });
      }
      dismissActiveSheet();
    }
    t.time = 0;
  }, [isSheetActive, dismissActiveSheet]);

  return (
    <View
      style={styles.container}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {children}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
