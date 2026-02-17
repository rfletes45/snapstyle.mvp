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
import { Skia } from "@shopify/react-native-skia";
import React, { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import {
  Camera,
  useCameraDevice,
  useSkiaFrameProcessor,
} from "react-native-vision-camera";

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
  // ──────────────────────────────────────────────────────────────────────
  const filterPaint = useMemo(() => {
    if (!filter || filter.id === "none") return undefined;
    const matrix = filterConfigToColorMatrix(filter);
    const paint = Skia.Paint();
    paint.setColorFilter(Skia.ColorFilter.MakeMatrix(matrix));
    return paint;
  }, [filter]);

  // ──────────────────────────────────────────────────────────────────────
  // Skia Frame Processor — applies the real filter to every camera frame
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
      isActive={true}
      photo={true}
      video={true}
      audio={true}
      zoom={vcZoom}
      exposure={exposure}
      torch="off"
      style={style}
      frameProcessor={frameProcessor}
      onInitialized={onInitialized}
      onError={onError}
    />
  );
});

LiveFilterCamera.displayName = "LiveFilterCamera";
