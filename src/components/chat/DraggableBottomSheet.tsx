/**
 * DraggableBottomSheet — A reusable bottom sheet that can be dragged
 * up/down between snap points, with swipe-down-to-dismiss.
 *
 * Uses react-native-gesture-handler + Reanimated for smooth UI-thread gestures.
 */

import React, { useCallback, useEffect, useMemo } from "react";
import { Dimensions, Modal, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useTheme } from "react-native-paper";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const SPRING_CONFIG = {
  damping: 28,
  stiffness: 280,
  mass: 0.8,
  overshootClamping: false,
  restDisplacementThreshold: 0.5,
  restSpeedThreshold: 0.5,
};

// ─── Types ───────────────────────────────────────────────────────────────────

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
  /** Override border radius */
  borderRadius?: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DraggableBottomSheet({
  open,
  onClose,
  snapPoints = [0.5, 0.85],
  initialSnapIndex,
  children,
  showBackdrop = true,
  borderRadius = 20,
}: DraggableBottomSheetProps) {
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

  // Open / close animations
  useEffect(() => {
    if (open) {
      translateY.value = withSpring(snapTranslateYs[startIndex], SPRING_CONFIG);
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
  ]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

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

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.value,
      [snapTranslateYs[snapTranslateYs.length - 1], dismissY],
      [1, 0],
    ),
  }));

  if (!open) return null;

  return (
    <Modal
      visible={open}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      {/* Backdrop */}
      {showBackdrop && (
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

      {/* Sheet */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.sheet,
            sheetStyle,
            {
              backgroundColor: theme.colors.surface,
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
                { backgroundColor: theme.colors.outlineVariant },
              ]}
            />
          </View>

          {children}
        </Animated.View>
      </GestureDetector>
    </Modal>
  );
}

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

export default DraggableBottomSheet;
