/**
 * DraggableBottomSheet — A reusable bottom sheet that can be dragged
 * up/down between snap points, with swipe-down-to-dismiss.
 *
 * Uses react-native-gesture-handler + Reanimated for smooth UI-thread gestures.
 *
 * Supports an optional "composer-attached" mode where the sheet coordinates
 * with the chat composer via a shared Reanimated translateY value, enabling
 * the composer to track the sheet position at 60fps.
 */

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
} from "react";
import { BackHandler, Dimensions, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Portal, useTheme } from "react-native-paper";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

/** Total vertical height of the drag handle zone (padding + handle).
 *  Used by pickers to add this to the keyboard fraction so the visible
 *  content area exactly matches the keyboard height. */
export const HANDLE_ZONE_HEIGHT = 23; // paddingTop(10) + handle(5) + paddingBottom(8)

const SPRING_CONFIG = {
  damping: 28,
  stiffness: 280,
  mass: 0.8,
  overshootClamping: false,
  restDisplacementThreshold: 0.5,
  restSpeedThreshold: 0.5,
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DraggableBottomSheetHandle {
  /** Programmatically animate to a specific snap point index */
  snapToIndex: (index: number) => void;
}

export interface DraggableBottomSheetProps {
  /** Whether the sheet is visible */
  open: boolean;
  /** Called when sheet should close (drag down past threshold, backdrop tap) */
  onClose: () => void;
  /** Snap points as fractions of screen height (e.g., [0.45, 0.85]) — sorted ascending */
  snapPoints?: number[];
  /** Which snap point index to open to (default: last / tallest) */
  initialSnapIndex?: number;
  /** Sheet content */
  children: React.ReactNode;
  /** Whether to show the backdrop */
  showBackdrop?: boolean;
  /** Override border radius (0 = square edges) */
  borderRadius?: number;
  /** External shared value to sync translateY to (for composer coordination).
   *  When provided, the sheet writes its translateY here on every frame. */
  sharedTranslateY?: SharedValue<number>;
  /** Override sheet background color (allows themed keyboard-replacement surfaces). */
  surfaceColor?: string;
  /** Override drag handle color. */
  handleColor?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const DraggableBottomSheet = forwardRef<
  DraggableBottomSheetHandle,
  DraggableBottomSheetProps
>(function DraggableBottomSheet(
  {
    open,
    onClose,
    snapPoints = [0.5, 0.85],
    initialSnapIndex,
    children,
    showBackdrop = true,
    borderRadius = 0,
    sharedTranslateY,
    surfaceColor,
    handleColor,
  },
  ref,
) {
  const theme = useTheme();

  // Convert snap fractions to translateY values (0 = top of screen, SCREEN_HEIGHT = off-screen)
  // A snap at 0.85 means the sheet takes 85% of the screen → translateY = 0.15 * SCREEN_HEIGHT
  const snapTranslateYs = useMemo(
    () => snapPoints.map((frac) => SCREEN_HEIGHT * (1 - frac)),
    [snapPoints],
  );
  const dismissY = SCREEN_HEIGHT; // fully off screen
  const startIndex = initialSnapIndex ?? snapPoints.length - 1;

  const translateY = useSharedValue(dismissY);
  const startY = useSharedValue(0);
  const activeSnapIndex = useSharedValue(startIndex);

  // ── Sync translateY → sharedTranslateY (UI-thread, 60fps) ───────────────
  // Guard: never propagate the dismiss position (SCREEN_HEIGHT) to the
  // shared value. When the sheet re-opens, its internal translateY still
  // holds the dismiss value for one frame before useEffect sets the snap.
  // Without this guard, that stale dismiss value overwrites the pre-seed
  // set by activateSheet(), causing the composer and chat to briefly drop
  // during the keyboard→sheet transition (visible in production builds
  // where react-native-keyboard-controller reports real animated heights).

  useAnimatedReaction(
    () => translateY.value,
    (current) => {
      if (sharedTranslateY && current < dismissY) {
        sharedTranslateY.value = current;
      }
    },
    [sharedTranslateY, dismissY],
  );

  // ── Imperative handle ──────────────────────────────────────────────────────

  useImperativeHandle(
    ref,
    () => ({
      snapToIndex: (index: number) => {
        const target = snapTranslateYs[index];
        if (target !== undefined) {
          translateY.value = withSpring(target, SPRING_CONFIG);
          activeSnapIndex.value = index;
        }
      },
    }),
    [snapTranslateYs, translateY, activeSnapIndex],
  );

  // ── Keyboard-replacement mode (no backdrop, no Modal) ─────────────────────
  const isKeyboardReplacement = !!sharedTranslateY;

  // Open / close animations
  useEffect(() => {
    if (open) {
      if (isKeyboardReplacement) {
        // In keyboard-replacement mode, jump directly to the snap position.
        // This prevents a frame-gap where useAnimatedReaction would overwrite
        // the pre-seeded sheetTranslateY with SCREEN_HEIGHT (dismiss position),
        // causing the composer to drop and the chat to collapse.
        translateY.value = snapTranslateYs[startIndex];
      } else {
        translateY.value = withSpring(
          snapTranslateYs[startIndex],
          SPRING_CONFIG,
        );
      }
      activeSnapIndex.value = startIndex;
    } else {
      translateY.value = withSpring(dismissY, SPRING_CONFIG);
    }
  }, [
    open,
    snapTranslateYs,
    startIndex,
    dismissY,
    translateY,
    activeSnapIndex,
    isKeyboardReplacement,
  ]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Android back-button handling (replaces Modal's onRequestClose)
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      handleClose();
      return true;
    });
    return () => sub.remove();
  }, [open, handleClose]);

  // ── Pan gesture ────────────────────────────────────────────────────────────

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          startY.value = translateY.value;
        })
        .onUpdate((e) => {
          // Allow dragging down freely; clamp upward to highest snap
          const newY = startY.value + e.translationY;
          const minY = snapTranslateYs[snapTranslateYs.length - 1]; // highest snap (smallest translateY)
          translateY.value = Math.max(minY - 40, newY); // allow slight over-drag up (rubber band)
        })
        .onEnd((e) => {
          const currentY = translateY.value;
          const velocityY = e.velocityY;

          // Fast swipe down → dismiss
          if (velocityY > 800) {
            translateY.value = withSpring(dismissY, SPRING_CONFIG);
            runOnJS(handleClose)();
            return;
          }

          // Fast swipe up → go to highest snap
          if (velocityY < -800) {
            const highestIdx = snapTranslateYs.length - 1;
            translateY.value = withSpring(
              snapTranslateYs[highestIdx],
              SPRING_CONFIG,
            );
            activeSnapIndex.value = highestIdx;
            return;
          }

          // Find nearest snap point (or dismiss if past threshold)
          const dismissThreshold =
            snapTranslateYs[0] + (dismissY - snapTranslateYs[0]) * 0.4;
          if (currentY > dismissThreshold) {
            translateY.value = withSpring(dismissY, SPRING_CONFIG);
            runOnJS(handleClose)();
            return;
          }

          // Snap to nearest point
          let bestIdx = 0;
          let bestDist = Math.abs(currentY - snapTranslateYs[0]);
          for (let i = 1; i < snapTranslateYs.length; i++) {
            const dist = Math.abs(currentY - snapTranslateYs[i]);
            if (dist < bestDist) {
              bestDist = dist;
              bestIdx = i;
            }
          }

          translateY.value = withSpring(
            snapTranslateYs[bestIdx],
            SPRING_CONFIG,
          );
          activeSnapIndex.value = bestIdx;
        }),
    [
      snapTranslateYs,
      dismissY,
      translateY,
      startY,
      activeSnapIndex,
      handleClose,
    ],
  );

  // ── Animated styles ────────────────────────────────────────────────────────

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // Standard backdrop: opacity 1 at highest snap, 0 at dismiss
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.value,
      [snapTranslateYs[snapTranslateYs.length - 1], dismissY],
      [1, 0],
    ),
  }));

  // Keyboard-replacement overlay: opacity 0 at keyboard-height snap (index 0),
  // opacity increases only as the sheet rises above that baseline.
  // This means the overlay is invisible at the resting keyboard-height position
  // and progressively darkens only when the user expands the modal further.
  // Height tracks the sheet's translateY (= distance from top), so the overlay
  // covers from top:0 down to the sheet's top edge exactly, never overlapping
  // the sheet content or the composer below it.
  const kbOverlayStyle = useAnimatedStyle(() => {
    if (snapTranslateYs.length < 2) return { opacity: 0, height: 0 };
    const kbSnapY = snapTranslateYs[0]; // keyboard-height translateY
    const highSnapY = snapTranslateYs[snapTranslateYs.length - 1]; // highest snap
    return {
      opacity: interpolate(
        translateY.value,
        [highSnapY, kbSnapY],
        [0.5, 0],
        Extrapolation.CLAMP,
      ),
      // translateY.value is the sheet's top edge in screen coordinates
      height: Math.max(0, translateY.value),
    };
  });

  if (!open) return null;

  // Determine whether to show standard backdrop (never in keyboard-replacement mode)
  const shouldShowBackdrop = showBackdrop && !isKeyboardReplacement;

  return (
    <Portal>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* Standard backdrop — only for non-keyboard-replacement sheets */}
        {shouldShowBackdrop && (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: theme.dark
                  ? "rgba(0,0,0,0.6)"
                  : "rgba(0,0,0,0.4)",
              },
              backdropStyle,
            ]}
          >
            <View style={StyleSheet.absoluteFill} onTouchEnd={handleClose} />
          </Animated.View>
        )}

        {/* Keyboard-replacement dismiss overlay:
            - Covers only the area ABOVE the sheet (top:0, height = translateY)
            - Visual-only dimming layer (pointerEvents="none")
            - Tap/scroll-to-dismiss is handled by SheetDismissLayer in the
              chat content hierarchy, which can coexist with message long
              presses, scrolling, and swipe-to-reply gestures
            - Opacity is 0 at keyboard-height snap, fades in when sheet expands */}
        {isKeyboardReplacement && (
          <Animated.View
            style={[
              styles.kbOverlay,
              {
                backgroundColor: theme.dark
                  ? "rgba(0,0,0,0.7)"
                  : "rgba(0,0,0,0.5)",
              },
              kbOverlayStyle,
            ]}
            pointerEvents="none"
          />
        )}

        {/* Sheet */}
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              isKeyboardReplacement ? styles.sheetFlat : styles.sheet,
              sheetStyle,
              {
                backgroundColor: surfaceColor ?? theme.colors.surface,
                borderTopLeftRadius: borderRadius,
                borderTopRightRadius: borderRadius,
              },
            ]}
          >
            {/* Drag handle */}
            <View style={styles.handleZone}>
              <View
                style={[
                  styles.handle,
                  {
                    backgroundColor: handleColor ?? theme.colors.outlineVariant,
                  },
                ]}
              />
            </View>

            {children}
          </Animated.View>
        </GestureDetector>
      </View>
    </Portal>
  );
});

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT,
    elevation: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  // Keyboard-replacement sheets: no shadow/elevation to avoid darkening the typing bar
  sheetFlat: {
    position: "absolute",
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT,
    elevation: 0,
  },
  // Overlay that covers only the chat area above the sheet in keyboard-replacement mode.
  // Animated `height` tracks the sheet's translateY (sheet top edge from screen top),
  // so the overlay extends from the screen top down to exactly the sheet's top edge.
  kbOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    // `height` is set dynamically via animated style
  },
  handleZone: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 8,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
  },
});

export { SCREEN_HEIGHT as SHEET_SCREEN_HEIGHT };
export default DraggableBottomSheet;
