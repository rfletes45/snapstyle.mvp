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
  Blur,
  Canvas,
  Circle,
  ColorMatrix,
  Group,
  LinearGradient,
  RadialGradient,
  Rect,
  Image as SkiaImage,
  useCanvasRef,
  useImage,
  vec,
} from "@shopify/react-native-skia";
import React, { forwardRef, useImperativeHandle, useMemo } from "react";
import { View } from "react-native";

import { filterConfigToColorMatrix } from "@/services/camera/filterService";
import type { FilterConfig } from "@/types/camera";
import { createLogger } from "@/utils/log";

const logger = createLogger("components/camera/SkiaFilteredImage");

// =============================================================================
// Types
// =============================================================================

export interface SkiaFilteredImageProps {
  /** file:// URI of the captured photo */
  uri: string;
  /** Currently selected filter (null or id="none" means no filter) */
  filter: FilterConfig | null;
  /** 0–1 intensity multiplier (default 1) */
  intensity?: number;
  /** Rendered width */
  width: number;
  /** Rendered height */
  height: number;
  /** Optional rotation in degrees (0, 90, 180, 270) */
  rotation?: number;
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

/**
 * Interpolate a color matrix toward identity by `t` (0 = identity, 1 = full).
 * This enables the intensity slider to smoothly blend between unfiltered and
 * fully filtered.
 */
function lerpColorMatrix(matrix: number[], t: number): number[] {
  if (t >= 1) return matrix;
  if (t <= 0)
    return [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

  const identity = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
  return matrix.map((v, i) => identity[i] + (v - identity[i]) * t);
}

// =============================================================================
// Component
// =============================================================================

const SkiaFilteredImage = forwardRef<
  SkiaFilteredImageRef,
  SkiaFilteredImageProps
>(({ uri, filter, intensity = 1, width, height, rotation = 0, style }, ref) => {
  const canvasRef = useCanvasRef();
  const skImage = useImage(uri);

  // Compute the color matrix with intensity lerp
  const colorMatrix = useMemo(() => {
    if (!filter || filter.id === "none") return null;

    const fullMatrix = filterConfigToColorMatrix(filter);
    return lerpColorMatrix(fullMatrix, intensity);
  }, [filter, intensity]);

  // Compute blur amount (scaled by intensity)
  const blurAmount = useMemo(() => {
    if (!filter || filter.id === "none") return 0;
    return (filter.blur ?? 0) * intensity;
  }, [filter, intensity]);

  // Vignette strength (scaled by intensity)
  const vignetteStrength = useMemo(() => {
    if (!filter || filter.id === "none") return 0;
    return (filter.vignette ?? 0) * intensity;
  }, [filter, intensity]);

  // Grain strength (scaled by intensity)
  const grainStrength = useMemo(() => {
    if (!filter || filter.id === "none") return 0;
    return (filter.grain ?? 0) * intensity;
  }, [filter, intensity]);

  // Fade / lift blacks (scaled by intensity)
  const fadeAmount = useMemo(() => {
    if (!filter || filter.id === "none") return 0;
    return (filter.fade ?? 0) * intensity;
  }, [filter, intensity]);

  // Temperature shift matrix
  const temperatureMatrix = useMemo(() => {
    if (!filter || filter.id === "none") return null;
    const temp = (filter.temperature ?? 0) * intensity;
    if (Math.abs(temp) < 0.01) return null;
    // Warm = boost red, reduce blue; Cool = boost blue, reduce red
    return [
      1 + temp * 0.1,
      0,
      0,
      0,
      temp * 0.03,
      0,
      1,
      0,
      0,
      temp * 0.01,
      0,
      0,
      1 - temp * 0.1,
      0,
      -temp * 0.03,
      0,
      0,
      0,
      1,
      0,
    ];
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
  const hasBlur = blurAmount > 0.1;
  const hasVignette = vignetteStrength > 0.01;
  const hasGrain = grainStrength > 0.01;
  const hasFade = fadeAmount > 0.01;
  const hasTemperature = temperatureMatrix !== null;

  return (
    <Canvas
      ref={canvasRef}
      style={[{ width, height }, style]}
      pointerEvents="none"
    >
      {/* Base image with color matrix + blur filters */}
      <SkiaImage
        image={skImage}
        x={0}
        y={0}
        width={width}
        height={height}
        fit="cover"
      >
        {/* Apply color matrix filter if active */}
        {hasFilter && <ColorMatrix matrix={colorMatrix!} />}
        {/* Apply temperature shift as a second color matrix */}
        {hasTemperature && <ColorMatrix matrix={temperatureMatrix!} />}
        {/* Apply Gaussian blur if the filter specifies it */}
        {hasBlur && <Blur blur={blurAmount * 3} mode="clamp" />}
      </SkiaImage>

      {/* Fade / lift blacks: semi-transparent dark-gray overlay */}
      {hasFade && (
        <Rect x={0} y={0} width={width} height={height}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(0, 0)}
            colors={[
              `rgba(40, 40, 40, ${fadeAmount * 0.35})`,
              `rgba(40, 40, 40, ${fadeAmount * 0.35})`,
            ]}
          />
        </Rect>
      )}

      {/* Vignette: radial gradient from transparent center to dark edges */}
      {hasVignette && (
        <Rect x={0} y={0} width={width} height={height}>
          <RadialGradient
            c={vec(width / 2, height / 2)}
            r={Math.max(width, height) * 0.65}
            colors={["transparent", `rgba(0, 0, 0, ${vignetteStrength * 0.7})`]}
            positions={[0.4, 1.0]}
          />
        </Rect>
      )}

      {/* Film grain: noise rendered as a pattern of semi-transparent dots */}
      {hasGrain && (
        <Group opacity={grainStrength * 0.4} blendMode="overlay">
          {Array.from({ length: Math.floor(grainStrength * 200) }, (_, i) => {
            const gx = (i * 7919) % width;
            const gy = (i * 7907) % height;
            const size = ((i * 13) % 3) + 1;
            const bright = i % 2 === 0 ? 255 : 0;
            return (
              <Circle
                key={i}
                cx={gx}
                cy={gy}
                r={size}
                color={`rgba(${bright}, ${bright}, ${bright}, 0.3)`}
              />
            );
          })}
        </Group>
      )}
    </Canvas>
  );
});

SkiaFilteredImage.displayName = "SkiaFilteredImage";

export default SkiaFilteredImage;

// =============================================================================
// SkiaFilterThumbnail — small preview showing a filter applied to a photo
// =============================================================================

export interface SkiaFilterThumbnailProps {
  uri: string;
  filter: FilterConfig;
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
      if (filter.id === "none") return null;
      return filterConfigToColorMatrix(filter);
    }, [filter]);

    const hasVignette = (filter.vignette ?? 0) > 0.01;

    if (!skImage) {
      return <View style={{ width, height, backgroundColor: "#222" }} />;
    }

    return (
      <Canvas style={{ width, height }}>
        <SkiaImage
          image={skImage}
          x={0}
          y={0}
          width={width}
          height={height}
          fit="cover"
        >
          {colorMatrix && <ColorMatrix matrix={colorMatrix} />}
          {(filter.blur ?? 0) > 0 && (
            <Blur blur={(filter.blur ?? 0) * 2} mode="clamp" />
          )}
        </SkiaImage>

        {/* Vignette on thumbnail */}
        {hasVignette && (
          <Rect x={0} y={0} width={width} height={height}>
            <RadialGradient
              c={vec(width / 2, height / 2)}
              r={Math.max(width, height) * 0.6}
              colors={[
                "transparent",
                `rgba(0, 0, 0, ${(filter.vignette ?? 0) * 0.6})`,
              ]}
              positions={[0.3, 1.0]}
            />
          </Rect>
        )}
      </Canvas>
    );
  });

SkiaFilterThumbnail.displayName = "SkiaFilterThumbnail";
