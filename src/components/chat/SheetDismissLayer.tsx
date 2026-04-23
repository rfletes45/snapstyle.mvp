/**
 * SheetDismissLayer
 *
 * A transparent wrapper that detects short taps and downward drag gestures
 * in the chat content area and dismisses the active keyboard-replacement
 * sheet (emoji/GIF/sticker picker).
 *
 * Touch discrimination:
 * - Short tap  (< 300ms, < 10px movement) → dismiss active sheet
 * - Downward drag (> DRAG_DISMISS_PX, and primarily vertical) → dismiss active sheet
 *   (parity with RKBC `keyboardDismissMode="interactive"` for the keyboard)
 * - Horizontal / upward drag → no dismissal; scrolling continues
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
import { chatDbg } from "@/utils/chatUiDebug";
import React, { useCallback, useRef } from "react";
import type { GestureResponderEvent } from "react-native";
import { StyleSheet, View } from "react-native";

// ─── Tuning ──────────────────────────────────────────────────────────────────

/** Maximum duration (ms) for a touch to count as a "tap". */
const TAP_MAX_MS = 300;

/** Minimum movement (px) to treat the touch as a scroll/drag. */
const DRAG_THRESHOLD_PX = 10;

/** Downward drag distance (px) that triggers sheet dismissal. */
const DRAG_DISMISS_PX = 48;

// ─── Types ───────────────────────────────────────────────────────────────────

interface TouchState {
  time: number;
  pageX: number;
  pageY: number;
  /** Treat as scroll/drag (not a tap) — may still fire drag-dismiss. */
  isDrag: boolean;
  /** Drag-dismiss has already fired for this touch (don't fire again). */
  dragDismissed: boolean;
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
    isDrag: false,
    dragDismissed: false,
  });

  const onTouchStart = useCallback(
    (e: GestureResponderEvent) => {
      if (isSheetActive.value !== 1) return;
      touchRef.current = {
        time: Date.now(),
        pageX: e.nativeEvent.pageX,
        pageY: e.nativeEvent.pageY,
        isDrag: false,
        dragDismissed: false,
      };
    },
    [isSheetActive],
  );

  const onTouchMove = useCallback(
    (e: GestureResponderEvent) => {
      const t = touchRef.current;
      if (t.time === 0 || t.dragDismissed) return;

      const dx = e.nativeEvent.pageX - t.pageX;
      const dy = e.nativeEvent.pageY - t.pageY;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);

      // Promote to drag once movement exceeds the tap threshold.
      if (adx > DRAG_THRESHOLD_PX || ady > DRAG_THRESHOLD_PX) {
        t.isDrag = true;
      }

      // Downward drag that is primarily vertical dismisses the sheet —
      // mirroring the behavior of keyboardDismissMode="interactive" for
      // the system keyboard.  This gives users one consistent gesture
      // to pull any bottom-region overlay down.
      if (
        !t.dragDismissed &&
        isSheetActive.value === 1 &&
        dy >= DRAG_DISMISS_PX &&
        ady > adx
      ) {
        const elapsedMs = Date.now() - t.time;
        // Classify the drag as "slow" vs "fast" using the time-to-threshold.
        // Slow drag is the historically-buggy path (see
        // ComposerSheetContext#activateSheet comment on the
        // handoffPendingRef latch); logging the classification lets us
        // correlate dismiss timing with the post-dismiss toolbar state.
        const classification = elapsedMs > 300 ? "slow-drag" : "fast-drag";
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.log("[ChatTransientUi] SheetDismissLayer drag-to-dismiss", {
            dy: Math.round(dy),
            dx: Math.round(dx),
            elapsedMs,
            classification,
          });
        }
        chatDbg("SheetDismissLayer:drag-dismiss", {
          dy: Math.round(dy),
          dx: Math.round(dx),
          elapsedMs,
          classification,
        });
        t.dragDismissed = true;
        dismissActiveSheet();
      }
    },
    [isSheetActive, dismissActiveSheet],
  );

  const onTouchEnd = useCallback(() => {
    const t = touchRef.current;
    if (t.time === 0) return;
    // Drag already dismissed — or movement was drag-like but not enough to
    // dismiss — nothing to do at end-of-touch.
    if (t.dragDismissed || t.isDrag) {
      t.time = 0;
      return;
    }
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
      chatDbg("SheetDismissLayer:tap-dismiss", { durationMs: duration });
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
