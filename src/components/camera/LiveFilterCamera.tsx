/**
 * Stable VisionCamera wrapper.
 *
 * Production filters are rendered as a cheap overlay above the native preview
 * and flattened during still-photo export. True live GPU filters remain behind
 * CAMERA_FILTERS_TRUE_LIVE_PREVIEW and are not required for capture.
 */

import { CAMERA_FILTERS_TRUE_LIVE_PREVIEW } from "@/constants/featureFlags";
import type { CameraFilterDefinition } from "@/services/camera/filters/filterRegistry";
import {
  IDENTITY_COLOR_MATRIX,
  getInterpolatedColorMatrix,
  isNormalCameraFilter,
} from "@/services/camera/filters/filterRegistry";
import { createLogger, isDebugEnabled } from "@/utils/log";
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

export interface LiveFilterCameraProps {
  facing: "front" | "back";
  filter?: CameraFilterDefinition | null;
  filterIntensity?: number;
  flashMode?: "auto" | "on" | "off";
  zoom?: number;
  exposure?: number;
  isActive?: boolean;
  style?: StyleProp<ViewStyle>;
  onInitialized?: () => void;
  onError?: (error: any) => void;
}

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

function areLiveFilterCameraPropsEqual(
  prev: LiveFilterCameraProps,
  next: LiveFilterCameraProps,
): boolean {
  return (
    prev.facing === next.facing &&
    (prev.filter?.id ?? null) === (next.filter?.id ?? null) &&
    prev.filterIntensity === next.filterIntensity &&
    prev.flashMode === next.flashMode &&
    prev.zoom === next.zoom &&
    prev.exposure === next.exposure &&
    prev.isActive === next.isActive &&
    prev.style === next.style &&
    prev.onInitialized === next.onInitialized &&
    prev.onError === next.onError
  );
}

function waitForNextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

const LiveFilterCameraComponent = forwardRef<
  LiveFilterCameraRef,
  LiveFilterCameraProps
>(function LiveFilterCamera(
  {
    facing,
    filter = null,
    filterIntensity = 1,
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
  const [trueLivePreviewFailed, setTrueLivePreviewFailed] = useState(false);
  const propSignatureRef = useRef<string | null>(null);
  const appliedFilterIdRef = useRef("normal");

  const flashModeRef = useRef(flashMode);
  flashModeRef.current = flashMode;

  const trueLivePreviewEnabled =
    CAMERA_FILTERS_TRUE_LIVE_PREVIEW && !trueLivePreviewFailed;
  const filterId = filter?.id ?? "normal";
  const propSignature = `${facing}|${flashMode}|${isActive ? 1 : 0}`;

  useEffect(() => {
    if (!isDebugEnabled("CAMERA_FILTERS")) {
      return;
    }

    if (propSignatureRef.current === null) {
      logger.debug(`[Camera Filters] LiveFilterCamera mount ${propSignature}`);
    } else if (propSignatureRef.current !== propSignature) {
      logger.debug(
        `[Camera Filters] LiveFilterCamera props ${propSignatureRef.current} -> ${propSignature}`,
      );
    }
    propSignatureRef.current = propSignature;
  }, [propSignature]);

  const filterPaint = useMemo(() => {
    const paint = Skia.Paint();
    paint.setColorFilter(Skia.ColorFilter.MakeMatrix([...IDENTITY_COLOR_MATRIX]));
    return paint;
  }, []);

  useEffect(() => {
    if (!trueLivePreviewEnabled) {
      return;
    }

    const matrix =
      filter && !isNormalCameraFilter(filter)
        ? (getInterpolatedColorMatrix(filter, filterIntensity) ??
          IDENTITY_COLOR_MATRIX)
        : IDENTITY_COLOR_MATRIX;

    filterPaint.setColorFilter(Skia.ColorFilter.MakeMatrix([...matrix]));

    if (
      isDebugEnabled("CAMERA_FILTERS") &&
      appliedFilterIdRef.current !== filterId
    ) {
      logger.debug(
        `[Camera Filters] true live filter ${appliedFilterIdRef.current} -> ${filterId}`,
      );
    }
    appliedFilterIdRef.current = filterId;
  }, [filter, filterId, filterIntensity, filterPaint, trueLivePreviewEnabled]);

  const frameProcessor = useSkiaFrameProcessor(
    (frame) => {
      "worklet";
      frame.render(filterPaint);
    },
    [filterPaint],
  );

  const frameProcessorAttached =
    trueLivePreviewEnabled &&
    filter != null &&
    !isNormalCameraFilter(filter);

  useEffect(() => {
    if (!isDebugEnabled("CAMERA_FILTERS")) {
      return;
    }

    logger.debug(
      `[Camera Filters] true live preview ${frameProcessorAttached ? "active" : "inactive"} (${filterId})`,
    );
  }, [filterId, frameProcessorAttached]);

  useImperativeHandle(
    ref,
    () => ({
      async takePictureAsync(options) {
        if (!vcRef.current) throw new Error("Camera not ready");

        const flash = (options?.flash ?? flashModeRef.current ?? "off") as
          | "on"
          | "off"
          | "auto";

        await waitForNextAnimationFrame();
        if (!vcRef.current) throw new Error("Camera not ready");

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

  if (!device) {
    return null;
  }

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
      frameProcessor={frameProcessorAttached ? frameProcessor : undefined}
      onInitialized={() => {
        if (isDebugEnabled("CAMERA_FILTERS")) {
          logger.debug("[Camera Filters] camera initialized");
        }
        onInitialized?.();
      }}
      onError={(err) => {
        if (frameProcessorAttached) {
          setTrueLivePreviewFailed(true);
          logger.warn(
            "[LiveFilterCamera] true live filter preview disabled after camera error",
          );
        }
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
