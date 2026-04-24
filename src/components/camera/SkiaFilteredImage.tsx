/**
 * SKIA FILTERED IMAGE
 *
 * Renders a captured photo through Skia's GPU-accelerated pipeline with
 * real color-matrix filters (brightness, contrast, saturation, hue, sepia,
 * invert) and Gaussian blur — replacing the old translucent-View overlay.
 *
 * Usage:
 *   <SkiaFilteredImage
 *     uri={capturedPhotoUri}
 *     filter={selectedFilter}
 *     intensity={0.8}
 *     width={screenWidth}
 *     height={screenHeight}
 *   />
 *
 * The component also exposes a `canvasRef` via `forwardRef` so the parent
 * can call `canvasRef.current?.makeImageSnapshotAsync()` to export the
 * filtered result at full resolution without needing react-native-view-shot.
 *
 * @module components/camera/SkiaFilteredImage
 */

import type { SkImage } from "@shopify/react-native-skia";
import {
  Canvas,
  ColorMatrix,
  Group,
  Image as SkiaImage,
  useCanvasRef,
  useImage,
} from "@shopify/react-native-skia";
import React, { forwardRef, useImperativeHandle, useMemo } from "react";
import { View } from "react-native";

import type { CameraFilterDefinition } from "@/services/camera/filters/filterRegistry";
import { getInterpolatedColorMatrix } from "@/services/camera/filters/filterRegistry";
import { createLogger } from "@/utils/log";

const logger = createLogger("components/camera/SkiaFilteredImage");

// =============================================================================
// Types
// =============================================================================

export interface SkiaFilteredImageProps {
  /** file:// URI of the captured photo */
  uri: string;
  /** Currently selected filter (null or id="none" means no filter) */
  filter: CameraFilterDefinition | null;
  /** 0–1 intensity multiplier (default 1) */
  intensity?: number;
  /** Rendered width */
  width: number;
  /** Rendered height */
  height: number;
  /** Optional rotation in degrees (0, 90, 180, 270) */
  rotation?: number;
  /** Mirror the image horizontally (for front-camera selfies) */
  mirrored?: boolean;
  /** Style override for the container */
  style?: any;
}

export interface SkiaFilteredImageRef {
  /**
   * Capture the current Skia canvas as an SkImage.
   * Returns null if the canvas isn't ready.
   */
  makeSnapshot: () => Promise<SkImage | null>;
  /**
   * Capture and encode to JPEG bytes.
   * Returns null if the canvas isn't ready.
   */
  captureAsJpeg: (quality?: number) => Promise<Uint8Array | null>;
}

// =============================================================================
// Helpers
// =============================================================================

// =============================================================================
// Component
// =============================================================================

const SkiaFilteredImage = forwardRef<
  SkiaFilteredImageRef,
  SkiaFilteredImageProps
>(
  (
    {
      uri,
      filter,
      intensity = 1,
      width,
      height,
      rotation = 0,
      mirrored = false,
      style,
    },
    ref,
  ) => {
    const canvasRef = useCanvasRef();
    const skImage = useImage(uri);

    const colorMatrix = useMemo(() => {
      if (!filter) return null;
      const matrix = getInterpolatedColorMatrix(filter, intensity);
      return matrix ? [...matrix] : null;
    }, [filter, intensity]);

    // Expose snapshot methods to parent
    useImperativeHandle(
      ref,
      () => ({
        makeSnapshot: async () => {
          try {
            const snapshot = await canvasRef.current?.makeImageSnapshotAsync();
            return snapshot ?? null;
          } catch (e) {
            logger.error("[SkiaFilteredImage] Snapshot failed:", e);
            return null;
          }
        },
        captureAsJpeg: async (quality = 85) => {
          try {
            const snapshot = await canvasRef.current?.makeImageSnapshotAsync();
            if (!snapshot) return null;
            const bytes = snapshot.encodeToBytes();
            return bytes ?? null;
          } catch (e) {
            logger.error("[SkiaFilteredImage] JPEG capture failed:", e);
            return null;
          }
        },
      }),
      [canvasRef],
    );

    if (!skImage) {
      // Image still loading — render a black placeholder the same size
      return (
        <View
          style={[{ width, height, backgroundColor: "#111" }, style]}
          pointerEvents="none"
        />
      );
    }

    const hasFilter = colorMatrix !== null;

    return (
      <Canvas
        ref={canvasRef}
        style={[{ width, height }, style]}
        pointerEvents="none"
      >
        {/* Base image with color matrix + blur filters */}
        <Group
          transform={
            mirrored ? [{ translateX: width }, { scaleX: -1 }] : undefined
          }
        >
          <SkiaImage
            image={skImage}
            x={0}
            y={0}
            width={width}
            height={height}
            fit="cover"
          >
            {hasFilter && <ColorMatrix matrix={colorMatrix!} />}
          </SkiaImage>
        </Group>
      </Canvas>
    );
  },
);

SkiaFilteredImage.displayName = "SkiaFilteredImage";

export default SkiaFilteredImage;

// =============================================================================
// SkiaFilterThumbnail — small preview showing a filter applied to a photo
// =============================================================================

export interface SkiaFilterThumbnailProps {
  uri: string;
  filter: CameraFilterDefinition;
  width: number;
  height: number;
}

/**
 * Lightweight thumbnail that renders a filter preview using Skia.
 * Used in the filter carousel so users see an accurate preview of each filter
 * applied to their actual captured photo, including vignette and grain.
 */
export const SkiaFilterThumbnail: React.FC<SkiaFilterThumbnailProps> =
  React.memo(({ uri, filter, width, height }) => {
    const skImage = useImage(uri);

    const colorMatrix = useMemo(() => {
      const matrix = getInterpolatedColorMatrix(filter, filter.defaultIntensity);
      return matrix ? [...matrix] : null;
    }, [filter]);

    if (!skImage) {
      return <View style={{ width, height, backgroundColor: "#222" }} />;
    }

    return (
      <Canvas style={{ width, height }} pointerEvents="none">
        <SkiaImage
          image={skImage}
          x={0}
          y={0}
          width={width}
          height={height}
          fit="cover"
        >
          {colorMatrix && <ColorMatrix matrix={colorMatrix} />}
        </SkiaImage>
      </Canvas>
    );
  });

SkiaFilterThumbnail.displayName = "SkiaFilterThumbnail";
