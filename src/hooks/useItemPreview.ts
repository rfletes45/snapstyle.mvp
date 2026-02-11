/**
 * Item Preview Hook
 *
 * Manages the item preview state including 3D rotation,
 * color variations, and try-on functionality.
 *
 * Features:
 * - Gesture-based rotation
 * - Color/variation selection
 * - Zoom controls
 * - Animation states
 * - Preview history
 *
 * @see docs/SHOP_OVERHAUL_PLAN.md Section 10.6
 */

import { useCallback, useMemo, useRef, useState } from "react";
import {
  Animated,
  GestureResponderEvent,
  PanResponder,
  PanResponderGestureState,
} from "react-native";
import type { PointsShopItem } from "@/types/shop";

// =============================================================================
// Types
// =============================================================================

export interface ItemPreviewState {
  isOpen: boolean;
  item: PointsShopItem | null;
  selectedVariation: ItemVariation | null;
  rotation: { x: number; y: number };
  zoom: number;
  isAnimating: boolean;
}

export interface ItemVariation {
  id: string;
  name: string;
  colorHex?: string;
  imagePath?: string;
  previewPaths?: string[];
}

export interface UseItemPreviewReturn {
  // State
  state: ItemPreviewState;
  isOpen: boolean;
  item: PointsShopItem | null;
  selectedVariation: ItemVariation | null;
  rotation: { x: number; y: number };
  zoom: number;
  isAnimating: boolean;

  // Animated values
  rotationX: Animated.Value;
  rotationY: Animated.Value;
  scale: Animated.Value;
  opacity: Animated.Value;

  // Actions
  openPreview: (item: PointsShopItem) => void;
  closePreview: () => void;
  selectVariation: (variation: ItemVariation) => void;
  resetRotation: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  setZoom: (zoom: number) => void;

  // Gesture handling
  panResponder: ReturnType<typeof PanResponder.create>;

  // Preview history
  previewHistory: PointsShopItem[];
  clearHistory: () => void;
}

// =============================================================================
// Constants
// =============================================================================

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.25;
const ROTATION_SENSITIVITY = 0.5;
const MAX_PREVIEW_HISTORY = 10;

// =============================================================================
// Hook Implementation
// =============================================================================

export function useItemPreview(): UseItemPreviewReturn {
  // State
  const [isOpen, setIsOpen] = useState(false);
  const [item, setItem] = useState<PointsShopItem | null>(null);
  const [selectedVariation, setSelectedVariation] =
    useState<ItemVariation | null>(null);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [zoom, setZoomState] = useState(1);
  const [isAnimating, setIsAnimating] = useState(false);
  const [previewHistory, setPreviewHistory] = useState<PointsShopItem[]>([]);

  // Animated values
  const rotationX = useRef(new Animated.Value(0)).current;
  const rotationY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // Refs for gesture handling
  const lastRotation = useRef({ x: 0, y: 0 });

  // =============================================================================
  // Pan Responder for Rotation Gestures
  // =============================================================================

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          lastRotation.current = { ...rotation };
        },
        onPanResponderMove: (
          _event: GestureResponderEvent,
          gestureState: PanResponderGestureState,
        ) => {
          const newRotationX =
            lastRotation.current.x + gestureState.dy * ROTATION_SENSITIVITY;
          const newRotationY =
            lastRotation.current.y + gestureState.dx * ROTATION_SENSITIVITY;

          // Clamp X rotation
          const clampedX = Math.max(-90, Math.min(90, newRotationX));

          setRotation({ x: clampedX, y: newRotationY });
          rotationX.setValue(clampedX);
          rotationY.setValue(newRotationY);
        },
        onPanResponderRelease: () => {
          // Optional: Add momentum/spring animation
        },
      }),
    [rotation, rotationX, rotationY],
  );

  // =============================================================================
  // Actions
  // =============================================================================

  const openPreview = useCallback(
    (newItem: PointsShopItem) => {
      setItem(newItem);
      setSelectedVariation(null);
      setRotation({ x: 0, y: 0 });
      setZoomState(1);
      setIsAnimating(true);

      // Reset animated values
      rotationX.setValue(0);
      rotationY.setValue(0);
      scale.setValue(1);

      // Animate in
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setIsAnimating(false);
      });

      setIsOpen(true);

      // Add to history
      setPreviewHistory((prev) => {
        const filtered = prev.filter((i) => i.id !== newItem.id);
        const updated = [newItem, ...filtered];
        return updated.slice(0, MAX_PREVIEW_HISTORY);
      });
    },
    [opacity, rotationX, rotationY, scale],
  );

  const closePreview = useCallback(() => {
    setIsAnimating(true);

    Animated.timing(opacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setIsOpen(false);
      setItem(null);
      setSelectedVariation(null);
      setIsAnimating(false);
    });
  }, [opacity]);

  const selectVariation = useCallback(
    (variation: ItemVariation) => {
      setSelectedVariation(variation);

      // Optional: Animate transition between variations
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [scale],
  );

  const resetRotation = useCallback(() => {
    setIsAnimating(true);

    Animated.parallel([
      Animated.spring(rotationX, {
        toValue: 0,
        useNativeDriver: true,
        friction: 5,
      }),
      Animated.spring(rotationY, {
        toValue: 0,
        useNativeDriver: true,
        friction: 5,
      }),
    ]).start(() => {
      setRotation({ x: 0, y: 0 });
      setIsAnimating(false);
    });
  }, [rotationX, rotationY]);

  const zoomIn = useCallback(() => {
    const newZoom = Math.min(MAX_ZOOM, zoom + ZOOM_STEP);
    setZoomState(newZoom);

    Animated.spring(scale, {
      toValue: newZoom,
      useNativeDriver: true,
      friction: 5,
    }).start();
  }, [zoom, scale]);

  const zoomOut = useCallback(() => {
    const newZoom = Math.max(MIN_ZOOM, zoom - ZOOM_STEP);
    setZoomState(newZoom);

    Animated.spring(scale, {
      toValue: newZoom,
      useNativeDriver: true,
      friction: 5,
    }).start();
  }, [zoom, scale]);

  const resetZoom = useCallback(() => {
    setZoomState(1);

    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 5,
    }).start();
  }, [scale]);

  const setZoom = useCallback(
    (newZoom: number) => {
      const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
      setZoomState(clamped);

      Animated.spring(scale, {
        toValue: clamped,
        useNativeDriver: true,
        friction: 5,
      }).start();
    },
    [scale],
  );

  const clearHistory = useCallback(() => {
    setPreviewHistory([]);
  }, []);

  // =============================================================================
  // Memoized State
  // =============================================================================

  const state: ItemPreviewState = useMemo(
    () => ({
      isOpen,
      item,
      selectedVariation,
      rotation,
      zoom,
      isAnimating,
    }),
    [isOpen, item, selectedVariation, rotation, zoom, isAnimating],
  );

  // =============================================================================
  // Return
  // =============================================================================

  return {
    // State
    state,
    isOpen,
    item,
    selectedVariation,
    rotation,
    zoom,
    isAnimating,

    // Animated values
    rotationX,
    rotationY,
    scale,
    opacity,

    // Actions
    openPreview,
    closePreview,
    selectVariation,
    resetRotation,
    zoomIn,
    zoomOut,
    resetZoom,
    setZoom,

    // Gesture handling
    panResponder,

    // Preview history
    previewHistory,
    clearHistory,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get rotation transform string for animated styles
 */
export function getRotationTransform(
  rotationX: Animated.Value,
  rotationY: Animated.Value,
): Animated.AnimatedProps<any>["style"]["transform"] {
  return [
    {
      rotateX: rotationX.interpolate({
        inputRange: [-90, 90],
        outputRange: ["-90deg", "90deg"],
      }),
    },
    {
      rotateY: rotationY.interpolate({
        inputRange: [-180, 180],
        outputRange: ["-180deg", "180deg"],
      }),
    },
  ];
}

/**
 * Calculate perspective based on rotation
 */
export function getPerspective(rotation: { x: number; y: number }): number {
  const maxRotation = Math.max(Math.abs(rotation.x), Math.abs(rotation.y));
  // Increase perspective as rotation increases
  return 800 + maxRotation * 5;
}

/**
 * Get preview image URL for variation
 */
export function getPreviewImageUrl(
  item: PointsShopItem,
  variation?: ItemVariation | null,
): string {
  if (variation?.imagePath) {
    return variation.imagePath;
  }
  return item.imagePath;
}
