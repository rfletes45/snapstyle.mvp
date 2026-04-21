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
import React, {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { StyleProp, ViewStyle } from "react-native";
import {
  Camera,
  useCameraDevice,
  useSkiaFrameProcessor,
} from "react-native-vision-camera";

const logger = createLogger("components/camera/LiveFilterCamera");

const IDENTITY_COLOR_MATRIX = [
  1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0,
];

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

function nowMs(): number {
  const perfNow = globalThis.performance?.now;
  return typeof perfNow === "function"
    ? perfNow.call(globalThis.performance)
    : Date.now();
}

function waitForNextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function areLiveFilterCameraPropsEqual(
  prev: LiveFilterCameraProps,
  next: LiveFilterCameraProps,
): boolean {
  return (
    prev.facing === next.facing &&
    (prev.filter?.id ?? null) === (next.filter?.id ?? null) &&
    prev.flashMode === next.flashMode &&
    prev.zoom === next.zoom &&
    prev.exposure === next.exposure &&
    prev.isActive === next.isActive &&
    prev.style === next.style &&
    prev.onInitialized === next.onInitialized &&
    prev.onError === next.onError
  );
}

// =============================================================================
// Component
// =============================================================================

const LiveFilterCameraComponent = forwardRef<
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
  const isMountedRef = useRef(true);
  const [isFrameProcessorEnabled, setIsFrameProcessorEnabled] = useState(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Keep flash mode in a ref so the imperative handle always reads the
  // latest value without needing re-creation.
  const flashModeRef = useRef(flashMode);
  flashModeRef.current = flashMode;

  const propSignatureRef = useRef<string | null>(null);
  const appliedFilterIdRef = useRef("none");
  const filterId = filter?.id ?? null;
  const propSignature = `${facing}|${flashMode}|${isActive ? 1 : 0}|${filterId ?? "none"}`;

  useEffect(() => {
    if (propSignatureRef.current === null) {
      logger.warn(
        `[Camera Filter Perf] LiveFilterCamera mount ${propSignature}`,
      );
    } else if (propSignatureRef.current !== propSignature) {
      logger.warn(
        `[Camera Filter Perf] LiveFilterCamera props ${propSignatureRef.current} -> ${propSignature}`,
      );
    }
    propSignatureRef.current = propSignature;
  }, [propSignature]);

  // Keep one Paint object for the whole camera session so filter taps only
  // mutate the active matrix instead of rebuilding the live frame pipeline.
  const filterPaint = useMemo(() => {
    const paint = Skia.Paint();
    paint.setColorFilter(Skia.ColorFilter.MakeMatrix(IDENTITY_COLOR_MATRIX));
    return paint;
  }, []);

  useEffect(() => {
    const nextFilterId = filterId ?? "none";
    const startedAt = nowMs();
    const matrix =
      filter && filter.id !== "none"
        ? filterConfigToColorMatrix(filter)
        : IDENTITY_COLOR_MATRIX;

    filterPaint.setColorFilter(Skia.ColorFilter.MakeMatrix(matrix));

    const updateDuration = nowMs() - startedAt;
    const previousFilterId = appliedFilterIdRef.current;

    if (previousFilterId !== nextFilterId || updateDuration > 4) {
      logger.warn(
        `[Camera Filter Perf] live filter ${previousFilterId} -> ${nextFilterId}${updateDuration > 4 ? ` in ${updateDuration.toFixed(1)}ms` : ""}`,
      );
    }

    appliedFilterIdRef.current = nextFilterId;
  }, [filter, filterId, filterPaint]);

  // ──────────────────────────────────────────────────────────────────────
  // Skia Frame Processor — applies the real filter to every camera frame.
  //
  // Keep the processor attached for the full session so filter selection only
  // updates the paint matrix and does not force VisionCamera to reconfigure
  // its live preview/output pipeline mid-session.
  // ──────────────────────────────────────────────────────────────────────
  const frameProcessor = useSkiaFrameProcessor(
    (frame) => {
      "worklet";
      frame.render(filterPaint);
    },
    [filterPaint],
  );

  useEffect(() => {
    logger.warn(
      `[Camera Filter Perf] frame processor ${isFrameProcessorEnabled ? "attached" : "detached"} (stable pipeline)`,
    );
  }, [isFrameProcessorEnabled]);

  // ──────────────────────────────────────────────────────────────────────
  // Expose ref methods for CameraService compatibility
  // ──────────────────────────────────────────────────────────────────────
  useImperativeHandle(
    ref,
    () => ({
      async takePictureAsync(options) {
        if (!vcRef.current) throw new Error("Camera not ready");
        logger.warn(
          "[Camera Filter Perf] pausing frame processor for photo capture",
        );
        setIsFrameProcessorEnabled(false);
        await waitForNextAnimationFrame();
        await waitForNextAnimationFrame();
        if (!vcRef.current) throw new Error("Camera not ready");
        // Honour explicit flash option (preview capture uses "off");
        // otherwise fall back to the parent's flash mode setting.
        const flash = (options?.flash ?? flashModeRef.current ?? "off") as
          | "on"
          | "off"
          | "auto";
        try {
          const result = await vcRef.current.takePhoto({
            flash,
            enableShutterSound: false,
          });
          return {
            uri: `file://${result.path}`,
            width: result.width,
            height: result.height,
          };
        } finally {
          if (isMountedRef.current) {
            logger.warn(
              "[Camera Filter Perf] resuming frame processor after photo capture",
            );
            setIsFrameProcessorEnabled(true);
          }
        }
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
      frameProcessor={isFrameProcessorEnabled ? frameProcessor : undefined}
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

export const LiveFilterCamera = memo(
  LiveFilterCameraComponent,
  areLiveFilterCameraPropsEqual,
);

LiveFilterCamera.displayName = "LiveFilterCamera";
