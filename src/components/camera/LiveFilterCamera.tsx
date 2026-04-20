/**
 * LIVE FILTER CAMERA
 *
 * Wraps react-native-vision-camera with an @shopify/react-native-skia
 * Frame Processor that applies the real per-pixel FilterConfig ColorMatrix
 * to every camera frame in real time — pixel-perfect live filter preview.
 *
 * Exposes a ref interface so that existing capture code
 * (CameraService.capturePhoto, startVideoRecording, stopVideoRecording)
 * continues to work unchanged via duck-typing.
 *
 * Uses VisionCamera + Skia Frame Processors to apply the **exact** colour
 * grading pipeline the editor uses, in real time on the GPU, at full
 * frame-rate.
 */

import { filterConfigToColorMatrix } from "@/services/camera/filterService";
import type { FilterConfig } from "@/types/camera";
import { createLogger } from "@/utils/log";
import { Skia } from "@shopify/react-native-skia";
import React, { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import {
  Camera,
  useCameraDevice,
  useSkiaFrameProcessor,
} from "react-native-vision-camera";

const logger = createLogger("components/camera/LiveFilterCamera");

// =============================================================================
// Types
// =============================================================================

export interface LiveFilterCameraProps {
  facing: "front" | "back";
  filter: FilterConfig | null;
  flashMode?: "auto" | "on" | "off";
  /**
   * Normalised 0–1 zoom.
   * Mapped internally to the device's actual zoom range, capped at 8×.
   */
  zoom?: number;
  /** Exposure bias in EV. Passed through directly to VisionCamera. */
  exposure?: number;
  /**
   * Whether the camera session should be active.  Set to `false` when the
   * screen loses focus or the app is backgrounded to release the hardware
   * and avoid GPU work while invisible.
   */
  isActive?: boolean;
  style?: StyleProp<ViewStyle>;
  /**
   * Called once the camera hardware is initialised.
   */
  onInitialized?: () => void;
  /** Called on a camera error. */
  onError?: (error: any) => void;
}

/**
 * Ref interface so the existing capture pipeline in CameraService
 * and useCameraHooks keeps working unchanged.
 */
export interface LiveFilterCameraRef {
  takePictureAsync(options?: {
    quality?: number;
    base64?: boolean;
    skipProcessing?: boolean;
    mirror?: boolean;
    flash?: "on" | "off" | "auto";
  }): Promise<{ uri: string; width: number; height: number }>;
  recordAsync(options?: Record<string, unknown>): Promise<{ uri: string }>;
  stopRecording(): void;
}

// =============================================================================
// Component
// =============================================================================

export const LiveFilterCamera = forwardRef<
  LiveFilterCameraRef,
  LiveFilterCameraProps
>(function LiveFilterCamera(
  {
    facing,
    filter,
    flashMode = "off",
    zoom = 0,
    exposure = 0,
    isActive = true,
    style,
    onInitialized,
    onError,
  },
  ref,
) {
  const device = useCameraDevice(facing === "front" ? "front" : "back");
  const vcRef = useRef<Camera>(null);

  // Keep flash mode in a ref so the imperative handle always reads the
  // latest value without needing re-creation.
  const flashModeRef = useRef(flashMode);
  flashModeRef.current = flashMode;

  // ──────────────────────────────────────────────────────────────────────
  // Skia Paint with the filter's 4×5 ColorMatrix
  //
  // NOTE (2026-04-20 freeze fix): paint creation is memoised by filter.id
  // (not by filter object identity) so that parent re-renders with a new
  // filter object that represents the same filter don't thrash Skia.
  // ──────────────────────────────────────────────────────────────────────
  const filterId = filter?.id ?? null;
  const filterPaint = useMemo(() => {
    if (!filter || filter.id === "none") return undefined;
    const matrix = filterConfigToColorMatrix(filter);
    const paint = Skia.Paint();
    paint.setColorFilter(Skia.ColorFilter.MakeMatrix(matrix));
    return paint;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterId]);

  // ──────────────────────────────────────────────────────────────────────
  // Skia Frame Processor — applies the real filter to every camera frame.
  //
  // NOTE (2026-04-20 TestFlight freeze fix):
  //   Previously the frame processor was ALWAYS attached, even when no
  //   filter was active.  That routed every preview frame through the
  //   Skia GPU pipeline, which on iOS release builds caused ~1-2s
  //   preview lock-ups as the GPU queue backpressured against the
  //   camera session startup (audio + photo + video + Skia compositing).
  //
  //   Fix: create the processor hook unconditionally (hook-rule compliant)
  //   but only attach it to the <Camera> when a filter is actually
  //   active.  In the baseline "no filter" case VisionCamera now uses
  //   its native preview fast path with zero GPU contention.
  // ──────────────────────────────────────────────────────────────────────
  const frameProcessor = useSkiaFrameProcessor(
    (frame) => {
      "worklet";
      if (filterPaint != null) {
        frame.render(filterPaint);
      } else {
        frame.render();
      }
    },
    [filterPaint],
  );
  const hasActiveFilter = filterPaint != null;

  // ──────────────────────────────────────────────────────────────────────
  // Expose ref methods for CameraService compatibility
  // ──────────────────────────────────────────────────────────────────────
  useImperativeHandle(
    ref,
    () => ({
      async takePictureAsync(options) {
        if (!vcRef.current) throw new Error("Camera not ready");
        // Honour explicit flash option (preview capture uses "off");
        // otherwise fall back to the parent's flash mode setting.
        const flash = (options?.flash ?? flashModeRef.current ?? "off") as
          | "on"
          | "off"
          | "auto";
        const result = await vcRef.current.takePhoto({
          flash,
          enableShutterSound: false,
        });
        return {
          uri: `file://${result.path}`,
          width: result.width,
          height: result.height,
        };
      },

      recordAsync(_options) {
        if (!vcRef.current) throw new Error("Camera not ready");
        return new Promise<{ uri: string }>((resolve, reject) => {
          vcRef.current!.startRecording({
            flash: flashModeRef.current === "on" ? "on" : "off",
            onRecordingFinished: (video) =>
              resolve({ uri: `file://${video.path}` }),
            onRecordingError: (error) => reject(error),
          });
        });
      },

      stopRecording() {
        vcRef.current?.stopRecording();
      },
    }),
    [],
  );

  // No device = nothing to render (permissions may still be loading)
  if (!device) return null;

  // Map normalised 0-1 zoom to VisionCamera zoom factor, capped at 8×.
  const maxZoom = Math.min(8, device.maxZoom);
  const vcZoom = device.minZoom + zoom * (maxZoom - device.minZoom);

  return (
    <Camera
      ref={vcRef}
      device={device}
      isActive={isActive}
      photo={true}
      video={true}
      audio={true}
      zoom={vcZoom}
      exposure={exposure}
      torch="off"
      style={style}
      // IMPORTANT: only attach the Skia frame processor when a filter
      // is actually active.  Passing `undefined` here lets VisionCamera
      // use its native preview fast path with zero GPU compositing cost.
      frameProcessor={hasActiveFilter ? frameProcessor : undefined}
      onInitialized={() => {
        logger.info("[LiveFilterCamera] onInitialized");
        onInitialized?.();
      }}
      onError={(err) => {
        logger.error("[LiveFilterCamera] onError:", err);
        onError?.(err);
      }}
    />
  );
});

LiveFilterCamera.displayName = "LiveFilterCamera";
