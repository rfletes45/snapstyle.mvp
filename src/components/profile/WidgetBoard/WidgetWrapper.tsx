/**
 * Widget Wrapper
 *
 * Renders a single widget with drag, resize, and remove affordances
 * when in customize mode. In view mode, renders the widget content
 * as a plain card; long-pressing enters customize mode.
 *
 * Drag Architecture (teleport-proof):
 * - All positions use animated shared values, NOT static left/top props.
 * - Position is driven via transform translateX/translateY (GPU-composited,
 *   no layout pass) — NOT via left/top layout properties which can be
 *   resolved immediately by the native layout system and bypass springs.
 * - On drag start, the position is frozen (shared values stop syncing).
 * - During drag, visual position = frozen origin + gesture translation.
 * - Other widgets reflow via preview state; the dragged widget is gesture-only.
 * - On drop/cancel, the shared values animate to the committed position.
 * - LinearTransition is NOT used — we manage all animation ourselves.
 *
 * @module components/profile/WidgetBoard/WidgetWrapper
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { memo, useCallback, useMemo, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type WithSpringConfig,
} from "react-native-reanimated";

import { BorderRadius, Spacing } from "@/constants/theme";
import { useColors } from "@/store/ThemeContext";

import { DURATIONS, SPRING_CONFIGS } from "../ProfileAnimations";
import {
  getWidgetPixelSize,
  gridToPixel,
  pixelToGrid,
} from "./BoardLayoutEngine";
import { getWidgetDefinition } from "./WidgetRegistry";
import type { BoardMode, WidgetInstance, WidgetSizeKey } from "./types";
import { CELL_HEIGHT, GRID_GUTTER, SIZE_PRESETS } from "./types";

// =============================================================================
// Types
// =============================================================================

export interface WidgetWrapperProps {
  widget: WidgetInstance;
  boardWidth: number;
  mode: BoardMode;
  /**
   * When true, all editing affordances are disabled:
   * no long-press to customize, no drag, no resize, no remove.
   * Used when rendering another user's profile in viewer mode.
   */
  readOnly?: boolean;
  isDragActive: boolean;
  children: React.ReactNode;
  onDragStart?: (instanceId: string) => void;
  onDragUpdate?: (instanceId: string, gridX: number, gridY: number) => void;
  onDragEnd?: (instanceId: string) => void;
  onDragCancel?: (instanceId: string) => void;
  onResizeUpdate?: (instanceId: string, newSize: WidgetSizeKey) => void;
  onResizeEnd?: (instanceId: string) => void;
  onRemove?: (instanceId: string) => void;
  /** Called in view mode when user long-presses the widget body. */
  onEnterCustomize?: () => void;
}

// =============================================================================
// Constants
// =============================================================================

const DRAG_SCALE = 1.04;
const REMOVE_BUTTON_SIZE = 26;
const RESIZE_HANDLE_SIZE = 28;
const RESIZE_HANDLE_HIT = 16;

/**
 * Board-specific spring configs that ALWAYS animate.
 *
 * Widget position/size springs are functional — they communicate spatial
 * relationships during reflow. Using ReduceMotion.System would resolve them
 * instantly when the device has "reduce motion" enabled, causing the
 * teleport/snap bug. ReduceMotion.Never ensures the spring always runs on
 * the native compositor so displaced widgets visibly slide into place.
 */
const BOARD_SPRINGS = {
  /** Passive reflow: other widgets slide out of the way */
  reflow: {
    damping: 20,
    stiffness: 90,
    mass: 1,
    reduceMotion: ReduceMotion.Never,
  } satisfies WithSpringConfig,
  /** Active widget snapping to committed position after drop */
  snap: {
    damping: 15,
    stiffness: 150,
    mass: 0.5,
    reduceMotion: ReduceMotion.Never,
  } satisfies WithSpringConfig,
};

// =============================================================================
// Component
// =============================================================================

function WidgetWrapperBase({
  widget,
  boardWidth,
  mode,
  readOnly = false,
  isDragActive,
  children,
  onDragStart,
  onDragUpdate,
  onDragEnd,
  onDragCancel,
  onResizeUpdate,
  onResizeEnd,
  onRemove,
  onEnterCustomize,
}: WidgetWrapperProps) {
  const colors = useColors();
  const definition = getWidgetDefinition(widget.widgetType);
  const isCustomizing = mode === "customize";
  const canRemove = definition?.canRemove ?? false;
  const canResize = definition?.canResize;

  // ── Pixel Dimensions (from current grid position) ─────────────────────

  const pixelSize = useMemo(
    () => getWidgetPixelSize(widget.size, boardWidth),
    [widget.size, boardWidth],
  );

  const pixelPos = useMemo(
    () => gridToPixel(widget.x, widget.y, boardWidth),
    [widget.x, widget.y, boardWidth],
  );

  // ── Animated Shared Values ────────────────────────────────────────────
  // Position is ALWAYS driven by shared values — never by static left/top.
  // This prevents teleporting: during drag the values are frozen, during
  // normal operation they spring to the committed grid position.

  const animLeft = useSharedValue(pixelPos.x);
  const animTop = useSharedValue(pixelPos.y);
  const animWidth = useSharedValue(pixelSize.width);
  const animHeight = useSharedValue(pixelSize.height);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const zIndex = useSharedValue(1);
  const shadowOpacity = useSharedValue(0);
  const editOpacity = useSharedValue(isCustomizing ? 1 : 0);

  // Track drag state transitions to handle snap animations
  const prevDragActiveRef = useRef(false);
  // Stable pickup origin — captured at drag start, used for hover computation
  const pickupOriginRef = useRef({ x: 0, y: 0 });

  // ── Position/Size Sync ────────────────────────────────────────────────
  // When NOT dragging, spring-animate to the latest committed position.
  // When drag just ended, snap from visual drag position to committed position.
  // When dragging, do NOT update — position is gesture-driven.

  React.useEffect(() => {
    if (isDragActive) {
      // Drag ongoing — freeze position; gesture controls visual offset
      prevDragActiveRef.current = true;
      return;
    }

    if (prevDragActiveRef.current) {
      // Drag just ended — compute visual position and spring to committed pos
      prevDragActiveRef.current = false;
      // Capture current visual position into animLeft/animTop
      animLeft.value = animLeft.value + translateX.value;
      animTop.value = animTop.value + translateY.value;
      // Reset raw translation immediately (position is now in animLeft/animTop)
      translateX.value = 0;
      translateY.value = 0;
      // Spring to committed grid position
      animLeft.value = withSpring(pixelPos.x, BOARD_SPRINGS.snap);
      animTop.value = withSpring(pixelPos.y, BOARD_SPRINGS.snap);
      scale.value = withSpring(1, SPRING_CONFIGS.snappy);
      zIndex.value = 1;
      shadowOpacity.value = withTiming(0, { duration: DURATIONS.fast });
    } else {
      // Normal non-drag update (e.g. other widget reflowed around this one)
      // Uses reflow spring so displaced widgets visibly slide into place
      // instead of appearing to teleport.
      animLeft.value = withSpring(pixelPos.x, BOARD_SPRINGS.reflow);
      animTop.value = withSpring(pixelPos.y, BOARD_SPRINGS.reflow);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragActive, pixelPos.x, pixelPos.y]);

  // Animate size changes (resize)
  React.useEffect(() => {
    // Use snap spring for the actively-resized widget; reflow spring for
    // other widgets that get displaced.
    const config = isDragActive ? BOARD_SPRINGS.snap : BOARD_SPRINGS.reflow;
    animWidth.value = withSpring(pixelSize.width, config);
    animHeight.value = withSpring(pixelSize.height, config);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixelSize.width, pixelSize.height, isDragActive]);

  // Animate edit controls visibility
  React.useEffect(() => {
    editOpacity.value = withTiming(isCustomizing ? 1 : 0, {
      duration: DURATIONS.normal,
    });
  }, [isCustomizing, editOpacity]);

  // ── Drag Gesture ──────────────────────────────────────────────────────

  const triggerLightHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleDragStart = useCallback(() => {
    // Capture stable pickup origin — used for all hover computations
    pickupOriginRef.current = { x: pixelPos.x, y: pixelPos.y };
    onDragStart?.(widget.instanceId);
  }, [onDragStart, widget.instanceId, pixelPos.x, pixelPos.y]);

  const handleDragUpdate = useCallback(
    (rawTranslationX: number, rawTranslationY: number) => {
      // Compute hover target from stable pickup origin + raw gesture translation
      const hoverPixelX = pickupOriginRef.current.x + rawTranslationX;
      const hoverPixelY = pickupOriginRef.current.y + rawTranslationY;
      const slot = pixelToGrid(hoverPixelX, hoverPixelY, boardWidth);
      onDragUpdate?.(widget.instanceId, slot.col, slot.row);
    },
    [onDragUpdate, widget.instanceId, boardWidth],
  );

  const handleDragEnd = useCallback(() => {
    onDragEnd?.(widget.instanceId);
  }, [onDragEnd, widget.instanceId]);

  const handleDragCancel = useCallback(() => {
    onDragCancel?.(widget.instanceId);
  }, [onDragCancel, widget.instanceId]);

  const panGesture = useMemo(() => {
    return Gesture.Pan()
      .enabled(isCustomizing)
      .activateAfterLongPress(200)
      .onStart(() => {
        "worklet";
        scale.value = withSpring(DRAG_SCALE, SPRING_CONFIGS.snappy);
        zIndex.value = 100;
        shadowOpacity.value = withTiming(0.25, { duration: DURATIONS.fast });
        runOnJS(triggerLightHaptic)();
        runOnJS(handleDragStart)();
      })
      .onUpdate((e) => {
        "worklet";
        // Set raw gesture translation — visual position = frozen animLeft/animTop + translate
        translateX.value = e.translationX;
        translateY.value = e.translationY;
        // Compute hover target on JS thread using stable pickup origin
        runOnJS(handleDragUpdate)(e.translationX, e.translationY);
      })
      .onEnd(() => {
        "worklet";
        // Don't reset translate here — the useEffect snap handles it
        // when isDragActive transitions to false after commitPreview
        runOnJS(handleDragEnd)();
        runOnJS(triggerLightHaptic)();
      })
      .onFinalize((_, success) => {
        "worklet";
        if (!success) {
          runOnJS(handleDragCancel)();
        }
      });
  }, [
    isCustomizing,
    widget.pinned,
    translateX,
    translateY,
    scale,
    zIndex,
    shadowOpacity,
    triggerLightHaptic,
    handleDragStart,
    handleDragUpdate,
    handleDragEnd,
    handleDragCancel,
  ]);

  // ── Resize Gesture (bottom-right corner handle) ───────────────────────

  const currentSizeRef = useRef(widget.size);
  currentSizeRef.current = widget.size;

  const triggerMediumHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleResizeStep = useCallback(
    (newSize: WidgetSizeKey) => {
      if (newSize !== currentSizeRef.current) {
        currentSizeRef.current = newSize;
        onResizeUpdate?.(widget.instanceId, newSize);
      }
    },
    [onResizeUpdate, widget.instanceId],
  );

  const handleResizeEnd = useCallback(() => {
    onResizeEnd?.(widget.instanceId);
  }, [onResizeEnd, widget.instanceId]);

  const computeResizeSize = useCallback(
    (deltaX: number, deltaY: number): WidgetSizeKey | null => {
      if (!definition) return null;
      const supported = definition.supportedSizes;
      if (supported.length <= 1) return null;

      const currentSpan = SIZE_PRESETS[widget.size];
      const cellW = (boardWidth - 3 * GRID_GUTTER) / 4;
      const stepX = cellW + GRID_GUTTER;
      const stepY = CELL_HEIGHT + GRID_GUTTER;

      const targetW = currentSpan.w + Math.round(deltaX / stepX);
      const targetH = currentSpan.h + Math.round(deltaY / stepY);

      let bestSize: WidgetSizeKey = widget.size;
      let bestDist = Infinity;

      for (const sizeKey of supported) {
        const span = SIZE_PRESETS[sizeKey];
        const dist =
          Math.abs(span.w - targetW) * 2 + Math.abs(span.h - targetH);
        if (dist < bestDist) {
          bestDist = dist;
          bestSize = sizeKey;
        }
      }

      return bestSize;
    },
    [definition, widget.size, boardWidth],
  );

  const handleResizeGestureUpdate = useCallback(
    (deltaX: number, deltaY: number) => {
      const newSize = computeResizeSize(deltaX, deltaY);
      if (newSize && newSize !== currentSizeRef.current) {
        handleResizeStep(newSize);
        triggerMediumHaptic();
      }
    },
    [computeResizeSize, handleResizeStep, triggerMediumHaptic],
  );

  const resizeGesture = useMemo(() => {
    if (!canResize) {
      return Gesture.Pan().enabled(false);
    }
    return Gesture.Pan()
      .enabled(isCustomizing)
      .onStart(() => {
        "worklet";
        runOnJS(handleDragStart)();
        runOnJS(triggerLightHaptic)();
      })
      .onUpdate((e) => {
        "worklet";
        runOnJS(handleResizeGestureUpdate)(e.translationX, e.translationY);
      })
      .onEnd(() => {
        "worklet";
        runOnJS(handleResizeEnd)();
        runOnJS(triggerLightHaptic)();
      })
      .onFinalize((_, success) => {
        "worklet";
        if (!success) {
          runOnJS(handleDragCancel)();
        }
      });
  }, [
    canResize,
    isCustomizing,
    handleDragStart,
    handleResizeGestureUpdate,
    handleResizeEnd,
    handleDragCancel,
    triggerLightHaptic,
  ]);

  // ── Animated Styles ───────────────────────────────────────────────────
  // Position is driven entirely through transform (GPU-composited) instead
  // of left/top (layout properties). React Native's layout system can
  // resolve left/top changes synchronously and skip spring animations.
  // Using translateX/translateY in transform guarantees the spring runs
  // on the native compositor without triggering layout recalculation.

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: animLeft.value + translateX.value },
      { translateY: animTop.value + translateY.value },
      { scale: scale.value },
    ],
    width: animWidth.value,
    height: animHeight.value,
    zIndex: zIndex.value,
    shadowOpacity: shadowOpacity.value,
  }));

  const editControlsStyle = useAnimatedStyle(() => ({
    opacity: editOpacity.value,
    pointerEvents: editOpacity.value > 0.5 ? "auto" : "none",
  }));

  // ── View-mode long press to enter edit mode ───────────────────────────
  // Uses RNGH Gesture.LongPress instead of a Pressable wrapper.
  // This is critical: child TouchableOpacity elements (inside FriendsCard,
  // BadgesCard, etc.) claim the RN responder and block Pressable.onLongPress.
  // RNGH gestures operate at the native level above the JS responder system,
  // so the long-press fires even over interactive children.

  const handleLongPressEnterEdit = useCallback(() => {
    if (!isCustomizing && onEnterCustomize) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onEnterCustomize();
    }
  }, [isCustomizing, onEnterCustomize]);

  const longPressGesture = useMemo(() => {
    return Gesture.LongPress()
      .enabled(!readOnly && !isCustomizing && !!onEnterCustomize)
      .minDuration(400)
      .onStart(() => {
        "worklet";
        runOnJS(handleLongPressEnterEdit)();
      });
  }, [readOnly, isCustomizing, onEnterCustomize, handleLongPressEnterEdit]);

  // Compose gestures: long-press (view mode) and pan (customize mode).
  // They are mutually exclusive by their .enabled() guards, so Exclusive()
  // simply picks whichever is active.
  const composedGesture = useMemo(() => {
    return Gesture.Exclusive(longPressGesture, panGesture);
  }, [longPressGesture, panGesture]);

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View
        style={[
          styles.wrapper,
          { position: "absolute", left: 0, top: 0, shadowColor: "#000" },
          animatedStyle,
        ]}
      >
        {/* Widget Content — plain View; long-press handled by RNGH above */}
        <View
          style={[
            styles.content,
            {
              backgroundColor: colors.surface,
              borderColor: isCustomizing
                ? colors.primary + "40"
                : colors.outline + "30",
              borderWidth: isCustomizing ? 1.5 : 1,
            },
          ]}
        >
          {children}
        </View>

        {/* Edit Controls Overlay */}
        {isCustomizing && (
          <Animated.View
            style={[styles.editOverlay, editControlsStyle]}
            pointerEvents={isCustomizing ? "box-none" : "none"}
          >
            {/* Remove Button */}
            {canRemove && (
              <Pressable
                style={[styles.removeButton, { backgroundColor: colors.error }]}
                onPress={() => onRemove?.(widget.instanceId)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons name="minus" size={16} color="#fff" />
              </Pressable>
            )}

            {/* Drag Handle Indicator */}
            <View style={styles.dragHandle}>
              <View
                style={[
                  styles.dragHandleBar,
                  { backgroundColor: colors.textSecondary + "60" },
                ]}
              />
            </View>

            {/* Resize Handle (bottom-right corner) */}
            {canResize && (
              <GestureDetector gesture={resizeGesture}>
                <Animated.View
                  style={[
                    styles.resizeHandle,
                    { backgroundColor: colors.primary + "20" },
                  ]}
                  hitSlop={RESIZE_HANDLE_HIT}
                >
                  <MaterialCommunityIcons
                    name="resize-bottom-right"
                    size={16}
                    color={colors.primary}
                  />
                </Animated.View>
              </GestureDetector>
            )}
          </Animated.View>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

export const WidgetWrapper = memo(WidgetWrapperBase, (prev, next) => {
  return (
    prev.widget.instanceId === next.widget.instanceId &&
    prev.widget.size === next.widget.size &&
    prev.widget.x === next.widget.x &&
    prev.widget.y === next.widget.y &&
    prev.widget.visible === next.widget.visible &&
    prev.widget.pinned === next.widget.pinned &&
    prev.boardWidth === next.boardWidth &&
    prev.mode === next.mode &&
    prev.readOnly === next.readOnly &&
    prev.isDragActive === next.isDragActive &&
    prev.children === next.children &&
    prev.onDragStart === next.onDragStart &&
    prev.onDragUpdate === next.onDragUpdate &&
    prev.onDragEnd === next.onDragEnd &&
    prev.onDragCancel === next.onDragCancel &&
    prev.onResizeUpdate === next.onResizeUpdate &&
    prev.onResizeEnd === next.onResizeEnd &&
    prev.onRemove === next.onRemove &&
    prev.onEnterCustomize === next.onEnterCustomize
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  wrapper: {
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 0,
  },
  content: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  editOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BorderRadius.lg,
  },
  removeButton: {
    position: "absolute",
    top: Spacing.xs,
    left: Spacing.xs,
    width: REMOVE_BUTTON_SIZE,
    height: REMOVE_BUTTON_SIZE,
    borderRadius: REMOVE_BUTTON_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  dragHandle: {
    position: "absolute",
    top: Spacing.xs,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  dragHandleBar: {
    width: 32,
    height: 4,
    borderRadius: 2,
  },
  resizeHandle: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: RESIZE_HANDLE_SIZE,
    height: RESIZE_HANDLE_SIZE,
    borderTopLeftRadius: BorderRadius.md,
    borderBottomRightRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
});
