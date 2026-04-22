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
  /**
   * Pre-warm the Skia frame processor even when no filter is active.
   *
   * When true, the processor is attached with an identity color matrix so
   * that the one-time native capture-session reconfiguration (which adds a
   * frame-processor output to VisionCamera) happens *now* instead of at
   * the moment the user taps their first real filter.  The parent screen
   * typically flips this to true the instant the user opens the filter
   * picker — the modal slide animation masks any transient hitch, and the
   * subsequent first-filter tap becomes a cheap paint mutation instead of
   * a native pipeline reconfiguration.
   *
   * Leave false during cold camera open to preserve VisionCamera's native
   * preview fast path (critical for iOS release/TestFlight stability).
   */
  keepPipelineWarm?: boolean;
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
    prev.keepPipelineWarm === next.keepPipelineWarm &&
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
    keepPipelineWarm = false,
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
  // IMPORTANT (2026-04-20 TestFlight freeze fix, re-asserted 2026-04-21):
  //   The processor is ONLY attached to the <Camera> when a filter is
  //   actually active.  Attaching it unconditionally routes every preview
  //   frame through the Skia GPU pipeline, which on iOS release/TestFlight
  //   builds causes ~1-2s preview lock-ups (and sometimes permanent
  //   freezes on cold camera open) as the GPU queue backpressures against
  //   the camera session startup (audio + photo + video + Skia compositing).
  //
  //   Filter selection itself does NOT recreate the processor: `filterPaint`
  //   is a single stable Skia Paint created once and mutated in place via
  //   setColorFilter(), and `useSkiaFrameProcessor(..., [filterPaint])` is
  //   memoised on that stable reference.  Switching between two real
  //   filters therefore only swaps the color matrix on the existing paint —
  //   it does not force VisionCamera to reconfigure the live pipeline.
  //
  //   The `isFrameProcessorEnabled` gate only matters during photo capture,
  //   where we briefly detach the processor so VisionCamera can drive a
  //   clean still capture.
  // ──────────────────────────────────────────────────────────────────────
  const frameProcessor = useSkiaFrameProcessor(
    (frame) => {
      "worklet";
      frame.render(filterPaint);
    },
    [filterPaint],
  );
  const hasActiveFilter = filter != null && filter.id !== "none";
  // Attach the processor when (a) a filter is actually rendering, or
  // (b) the parent has told us to pre-warm the pipeline (filter picker
  // opened).  Either way, do NOT attach during the capture-pause window.
  const frameProcessorAttached =
    (hasActiveFilter || keepPipelineWarm) && isFrameProcessorEnabled;

  useEffect(() => {
    const reason = hasActiveFilter
      ? "active-filter"
      : keepPipelineWarm
        ? "warm"
        : "idle";
    logger.warn(
      `[Camera Filter Perf] frame processor ${frameProcessorAttached ? "attached" : "detached"} (${filterId ?? "none"}, ${reason}${!isFrameProcessorEnabled ? ", paused-for-capture" : ""})`,
    );
  }, [
    frameProcessorAttached,
    filterId,
    hasActiveFilter,
    keepPipelineWarm,
    isFrameProcessorEnabled,
  ]);

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
      // Native preview fast path when no filter is active; Skia pipeline
      // only engages when a filter has been explicitly selected.  This is
      // what keeps cold camera open off the GPU-contention critical path
      // in iOS release/TestFlight builds.
      frameProcessor={frameProcessorAttached ? frameProcessor : undefined}
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
