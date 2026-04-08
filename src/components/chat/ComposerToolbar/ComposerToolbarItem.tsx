/**
 * ComposerToolbarItem
 *
 * Renders a single draggable toolbar slot in the composer bar.
 *
 * In normal mode: renders its child content with full touch interactivity.
 * In edit mode: disables child touch, shows a dashed outline and delete
 * badge, and enables horizontal pan gesture for drag-and-drop reordering.
 *
 * ## Animation Architecture
 *
 * Uses a frozen-origin + gesture-offset pattern modeled after
 * WidgetWrapper.tsx. Two independent animated axes:
 *
 * | Axis           | Driver                       | Used by            |
 * |----------------|------------------------------|--------------------||
 * | `translateX`   | Pan gesture (UI thread)      | Dragged item       |
 * | `reflowOffset` | Preview / settle springs     | Non-dragged items  |
 *
 * Both feed into a single `useAnimatedStyle` that sums them into
 * `transform: [{ translateX: totalX }, { scale }]`.
 *
 * ### Gesture lifecycle
 * - `onStart`  — scales up (1.08×), raises z-index, fires haptic.
 * - `onUpdate` — sets `translateX` directly, forwards `translationX`
 *   to the Row for target-slot computation.
 * - `onEnd`    — does **not** touch `translateX`; delegates to the
 *   settle effect so the React re-render can compute the correct
 *   offset from old → new layout position.
 * - `onFinalize` — springs `translateX` to 0 only if the gesture was
 *   cancelled (not ended normally).
 *
 * ### Settle animation (on drop)
 * A `useLayoutEffect` detects the `isDragging` true → false transition.
 * For the dragged item it snaps `translateX` to the settle offset
 * (gap between visual drag position and new layout position), then
 * springs to 0. For non-dragged items it does the same via
 * `reflowOffset`, bridging the gap between their pre-reorder visual
 * position and post-reorder layout position.
 *
 * ### Spring constants
 * | Name            | Use                            | Feel             |
 * |-----------------|--------------------------------|------------------|
 * | `SPRING_CONFIG` | Scale return on drag end       | Soft, natural    |
 * | `SNAP_SPRING`   | Dragged item settle to slot    | Crisp, quick     |
 * | `REFLOW_SPRING` | Non-dragged items sliding      | Gentle, weighted |
 *
 * @module components/chat/ComposerToolbar/ComposerToolbarItem
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type WithSpringConfig,
} from "react-native-reanimated";

import { useColors } from "@/store/ThemeContext";

import type { ComposerToolbarItemId } from "./types";
import { TOOLBAR_BUTTON_SIZE } from "./types";

// =============================================================================
// Constants
// =============================================================================

const DELETE_BADGE_SIZE = 20;

/** General-purpose scale spring — soft return for scale animations. */
const SPRING_CONFIG: WithSpringConfig = {
  damping: 18,
  stiffness: 120,
  mass: 0.8,
  reduceMotion: ReduceMotion.Never,
};

/** Snap spring — crisp settle for the dragged item arriving at its slot. */
const SNAP_SPRING: WithSpringConfig = {
  damping: 15,
  stiffness: 150,
  mass: 0.5,
  reduceMotion: ReduceMotion.Never,
};

/** Passive reflow spring — matches WidgetWrapper BOARD_SPRINGS.reflow */
const REFLOW_SPRING: WithSpringConfig = {
  damping: 20,
  stiffness: 90,
  mass: 1,
  reduceMotion: ReduceMotion.Never,
};

// =============================================================================
// Types
// =============================================================================

export interface ComposerToolbarItemProps {
  /** The item identifier. */
  itemId: ComposerToolbarItemId;
  /** Zero-based position index. */
  position: number;
  /** Whether the toolbar is in edit mode. */
  isEditing: boolean;
  /** Whether this specific item is currently being dragged. */
  isDragging: boolean;
  /** Whether this item can be removed. */
  canRemove: boolean;
  /** Whether this is the message bar (special sizing). */
  isMessageBar: boolean;
  /** Flex weight (only used for message bar). */
  flexWeight?: number;
  /** Width of a single slot in pixels (computed by row). */
  slotWidth: number;
  /** Pixel offset for preview animation (non-dragged items slide aside). */
  previewOffset?: number;
  /** Pixel offset for settle animation (smooth transition to new position). */
  settleOffset?: number;
  /** Called when drag starts. */
  onDragStart?: (itemId: ComposerToolbarItemId) => void;
  /** Called during drag with current translationX (for dwell detection). */
  onDragUpdate?: (itemId: ComposerToolbarItemId, translationX: number) => void;
  /** Called when drag ends — includes final translationX for position calculation. */
  onDragEnd?: (itemId: ComposerToolbarItemId, translationX: number) => void;
  /** Called when the delete badge is tapped. */
  onRemove?: (itemId: ComposerToolbarItemId) => void;
  /** Called on long-press in non-edit mode (enters edit mode). */
  onLongPress?: () => void;
  /** The actual content to render inside the slot. */
  children: React.ReactNode;
}

// =============================================================================
// Component
// =============================================================================

function ComposerToolbarItemBase({
  itemId,
  isEditing,
  isDragging,
  canRemove,
  isMessageBar,
  flexWeight,
  slotWidth,
  previewOffset = 0,
  settleOffset,
  onDragStart,
  onDragUpdate,
  onDragEnd,
  onRemove,
  onLongPress,
  children,
}: ComposerToolbarItemProps) {
  const colors = useColors();

  // Shared values for animation
  const translateX = useSharedValue(0);
  const reflowOffset = useSharedValue(0);
  const scale = useSharedValue(1);
  const zIndex = useSharedValue(0);
  const gestureEnded = useSharedValue(false);

  // Track isDragging transitions for settle animation
  const wasDraggingRef = useRef(false);

  // ── Preview offset animation (non-dragged items) ──────────────────────
  // When the dragged item hovers over a new slot, the Row computes pixel
  // offsets for all other items. This effect spring-animates to the new
  // offset, matching WidgetWrapper's BOARD_SPRINGS.reflow pattern.
  useEffect(() => {
    if (isDragging) return; // dragged item uses translateX, not reflow
    reflowOffset.value = withSpring(previewOffset, REFLOW_SPRING);
  }, [previewOffset, isDragging, reflowOffset]);

  // ── Settle animation (smooth transition after reorder) ────────────────
  // For the dragged item: snaps translateX to the settle offset (difference
  // between visual drag position and new layout position), then springs to 0.
  // For non-dragged items: snaps reflowOffset to the settle offset (maintains
  // visual continuity after layout change), then springs to 0.
  useLayoutEffect(() => {
    if (wasDraggingRef.current && !isDragging) {
      // Dragged item just dropped
      if (settleOffset != null) {
        translateX.value = settleOffset;
      }
      translateX.value = withSpring(0, SNAP_SPRING);
    } else if (!isDragging && !wasDraggingRef.current && settleOffset != null) {
      // Non-dragged item received settle offset (reorder happened)
      reflowOffset.value = settleOffset;
      reflowOffset.value = withSpring(0, REFLOW_SPRING);
    }
    wasDraggingRef.current = isDragging;
  }, [isDragging, settleOffset, translateX, reflowOffset]);

  // ── Haptic triggers (must run on JS thread) ───────────────────────────
  const triggerDragStartHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDragStart?.(itemId);
  }, [itemId, onDragStart]);

  const triggerDragUpdate = useCallback(
    (tx: number) => {
      onDragUpdate?.(itemId, tx);
    },
    [itemId, onDragUpdate],
  );

  const triggerDragEnd = useCallback(
    (tx: number) => {
      onDragEnd?.(itemId, tx);
    },
    [itemId, onDragEnd],
  );

  // ── Pan gesture for dragging (edit mode only) ─────────────────────────
  const panGesture = Gesture.Pan()
    .enabled(isEditing)
    .activeOffsetX([-10, 10])
    .onStart(() => {
      "worklet";
      gestureEnded.value = false;
      scale.value = withSpring(1.08, SNAP_SPRING);
      zIndex.value = 100;
      scheduleOnRN(triggerDragStartHaptic);
    })
    .onUpdate((e) => {
      "worklet";
      translateX.value = e.translationX;
      scheduleOnRN(triggerDragUpdate, e.translationX);
    })
    .onEnd((e) => {
      "worklet";
      gestureEnded.value = true;
      // Don't change translateX — the React settle effect handles
      // smooth animation from the visual drag position to the new slot.
      scale.value = withSpring(1, SPRING_CONFIG);
      zIndex.value = 0;
      scheduleOnRN(triggerDragEnd, e.translationX);
    })
    .onFinalize(() => {
      "worklet";
      if (!gestureEnded.value) {
        // Gesture was cancelled — spring back to origin
        translateX.value = withSpring(0, SNAP_SPRING);
      }
      scale.value = withSpring(1, SPRING_CONFIG);
      zIndex.value = 0;
    });

  // ── Long press gesture for entering edit mode ─────────────────────────
  const longPressGesture = Gesture.LongPress()
    .enabled(!isEditing)
    .minDuration(500)
    .onStart(() => {
      "worklet";
      if (onLongPress) {
        scheduleOnRN(onLongPress);
      }
    });

  // Compose gestures: long press OR pan
  const composedGesture = Gesture.Race(panGesture, longPressGesture);

  // ── Animated style ────────────────────────────────────────────────────
  const animatedStyle = useAnimatedStyle(() => {
    // Dragged items: translateX from gesture + scale
    // Non-dragged items: reflowOffset from preview
    const totalX = translateX.value + reflowOffset.value;
    return {
      transform: [{ translateX: totalX }, { scale: scale.value }],
      zIndex: zIndex.value,
    };
  });

  // ── Edit mode wobble ──────────────────────────────────────────────────
  const editOverlayStyle = useAnimatedStyle(() => ({
    opacity: isEditing ? 1 : 0,
  }));

  // ── Remove handler ────────────────────────────────────────────────────
  const handleRemove = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onRemove?.(itemId);
  }, [itemId, onRemove]);

  // ── Container sizing ──────────────────────────────────────────────────
  const containerStyle = isMessageBar
    ? { flex: flexWeight ?? 1 }
    : { width: slotWidth };

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[styles.container, containerStyle, animatedStyle]}>
        {/* Content — disable interactions in edit mode */}
        <View
          pointerEvents={isEditing ? "none" : "auto"}
          style={styles.childrenWrapper}
        >
          {children}
        </View>

        {/* Edit mode overlay: delete badge */}
        {isEditing && canRemove && (
          <Animated.View style={[styles.deleteBadgeWrapper, editOverlayStyle]}>
            <Pressable
              style={[styles.deleteBadge, { backgroundColor: colors.error }]}
              onPress={handleRemove}
              hitSlop={8}
              accessibilityLabel="Remove from toolbar"
              accessibilityRole="button"
            >
              <MaterialCommunityIcons name="close" size={14} color="#FFF" />
            </Pressable>
          </Animated.View>
        )}

        {/* Edit mode outline */}
        {isEditing && (
          <Animated.View
            style={[
              styles.editOutline,
              {
                borderColor: isDragging
                  ? colors.primary
                  : colors.surfaceVariant,
              },
            ]}
            pointerEvents="none"
          />
        )}
      </Animated.View>
    </GestureDetector>
  );
}

export const ComposerToolbarItem = memo(ComposerToolbarItemBase);

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
    minHeight: TOOLBAR_BUTTON_SIZE,
    position: "relative",
  },
  childrenWrapper: {
    flex: 1,
    alignSelf: "stretch",
    justifyContent: "center",
  },
  deleteBadgeWrapper: {
    position: "absolute",
    top: -6,
    right: -6,
    zIndex: 10,
  },
  deleteBadge: {
    width: DELETE_BADGE_SIZE,
    height: DELETE_BADGE_SIZE,
    borderRadius: DELETE_BADGE_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
  },
  editOutline: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1.5,
    borderRadius: 10,
    borderStyle: "dashed",
  },
});
