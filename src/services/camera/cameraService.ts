/**
 * CAMERA SERVICE
 * Handles photo capture, video recording, compression, and permissions.
 * Uses react-native-vision-camera for native camera access and permission handling.
 */

import { USE_VISION_CAMERA } from "@/constants/featureFlags";
import {
  CameraPermissions,
  CameraSettings,
  CapturedMedia,
  PermissionStatus,
} from "@/types/camera";
import * as FileSystem from "@/utils/fileSystem";
import {
  getImageDimensions,
  manipulateImage,
} from "@/utils/imageManipulation";
import { Camera as ExpoCamera } from "expo-camera";

import { createLogger } from "@/utils/log";
const logger = createLogger("services/camera/cameraService");

// ---------------------------------------------------------------------------
// VisionCamera – loaded dynamically so it doesn't crash inside Expo Go
// ---------------------------------------------------------------------------
let VisionCamera: any = null;
if (USE_VISION_CAMERA) {
  try {
    VisionCamera = require("react-native-vision-camera").Camera;
  } catch {
    logger.warn(
      "[Camera Service] VisionCamera unavailable – falling back to expo-camera",
    );
  }
}

/**
 * Map VisionCamera permission status to our PermissionStatus type.
 * VisionCamera status: 'granted' | 'not-determined' | 'denied' | 'restricted'
 * VisionCamera request result: 'granted' | 'denied'
 */
function mapVCStatus(status: string): PermissionStatus {
  if (status === "granted") return "granted";
  if (status === "denied" || status === "restricted") return "denied";
  return "undetermined";
}

/**
 * Map expo-camera / expo-media-library status string to our PermissionStatus.
 */
function mapExpoStatus(status: string): PermissionStatus {
  if (status === "granted") return "granted";
  if (status === "denied") return "denied";
  return "undetermined";
}

/**
 * ============================================================================
 * PERMISSION MANAGEMENT
 * ============================================================================
 */

/**
 * Request camera permission from user.
 * Routes through VisionCamera or expo-camera depending on USE_VISION_CAMERA.
 */
export async function requestCameraPermission(): Promise<boolean> {
  try {
    if (VisionCamera) {
      const result = await VisionCamera.requestCameraPermission();
      const granted = result === "granted";
      logger.info(
        `[Camera Service] Camera permission (VC) ${granted ? "granted" : "denied"}`,
      );
      return granted;
    }
    // expo-camera path
    const { status } = await ExpoCamera.requestCameraPermissionsAsync();
    const granted = status === "granted";
    logger.info(
      `[Camera Service] Camera permission (expo) ${granted ? "granted" : "denied"}`,
    );
    return granted;
  } catch (error) {
    logger.error(
      "[Camera Service] Failed to request camera permission:",
      error,
    );
    return false;
  }
}

/**
 * Request microphone permission for audio recording.
 * Routes through VisionCamera or expo-camera depending on USE_VISION_CAMERA.
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    if (VisionCamera) {
      const result = await VisionCamera.requestMicrophonePermission();
      const granted = result === "granted";
      logger.info(
        `[Camera Service] Microphone permission (VC) ${granted ? "granted" : "denied"}`,
      );
      return granted;
    }
    // expo-camera path
    const { status } = await ExpoCamera.requestMicrophonePermissionsAsync();
    const granted = status === "granted";
    logger.info(
      `[Camera Service] Microphone permission (expo) ${granted ? "granted" : "denied"}`,
    );
    return granted;
  } catch (error) {
    logger.error(
      "[Camera Service] Failed to request microphone permission:",
      error,
    );
    return false;
  }
}

/**
 * Get current camera permission status without prompting.
 */
export async function getCameraPermissionStatus(): Promise<PermissionStatus> {
  try {
    if (VisionCamera) {
      const status = VisionCamera.getCameraPermissionStatus();
      return mapVCStatus(status);
    }
    const { status } = await ExpoCamera.getCameraPermissionsAsync();
    return mapExpoStatus(status);
  } catch (error) {
    logger.error("[Camera Service] Failed to check camera permission:", error);
    return "undetermined";
  }
}

/**
 * Get all camera-related permissions status
 */
export async function getAllPermissionsStatus(): Promise<CameraPermissions> {
  return {
    camera: await getCameraPermissionStatus(),
    microphone: await getMicrophonePermissionStatus(),
    photoLibrary: await getPhotoLibraryPermissionStatus(),
  };
}

/**
 * Get current microphone permission status without prompting.
 */
export async function getMicrophonePermissionStatus(): Promise<PermissionStatus> {
  try {
    if (VisionCamera) {
      const status = VisionCamera.getMicrophonePermissionStatus();
      return mapVCStatus(status);
    }
    const { status } = await ExpoCamera.getMicrophonePermissionsAsync();
    return mapExpoStatus(status);
  } catch (error) {
    logger.error(
      "[Camera Service] Failed to check microphone permission:",
      error,
    );
    return "undetermined";
  }
}

/**
 * Get current photo library permission status.
 * Uses expo-media-library if available; returns "granted" otherwise since
 * photo library access may not be needed for core camera functionality.
 */
export async function getPhotoLibraryPermissionStatus(): Promise<PermissionStatus> {
  try {
    // Dynamically try expo-media-library if installed
    const mediaLibraryModuleName = "expo-media-library";
    const MediaLibrary = await import(mediaLibraryModuleName).catch(
      () => null,
    );
    if (MediaLibrary) {
      const { status } = await MediaLibrary.getPermissionsAsync();
      return mapExpoStatus(status);
    }
    // If expo-media-library is not installed, assume granted
    // (the app can still save files via FileSystem)
    return "granted";
  } catch (error) {
    logger.error(
      "[Camera Service] Failed to check photo library permission:",
      error,
    );
    return "undetermined";
  }
}

/**
 * ============================================================================
 * PHOTO CAPTURE
 * ============================================================================
 */

/**
 * Capture a photo with the specified settings
 * Target: < 100ms from tap to capture
 */
export async function capturePhoto(
  cameraRef: any,
  settings: CameraSettings,
): Promise<CapturedMedia> {
  if (!cameraRef) {
    throw new Error("Camera reference not initialized");
  }

  try {
    const startTime = Date.now();

    // Trigger auto-focus if enabled
    if (settings.autoFocus) {
      // await cameraRef.autoFocus();
    }

    // Capture photo – use 0.85 quality for speed (final compression at export)
    // For front camera: disable skipProcessing so the camera applies the
    // mirror correction automatically, matching the mirrored live preview.
    // For back camera: keep skipProcessing for speed.
    const isFrontCamera = settings.facing === "front";
    const photo = await cameraRef.takePictureAsync({
      quality: 0.85,
      base64: false,
      skipProcessing: !isFrontCamera,
      mirror: isFrontCamera,
    });

    const captureTime = Date.now() - startTime;
    logger.info(`[Camera Service] Photo captured in ${captureTime}ms`);

    // Read file to get metadata
    const fileInfo = await FileSystem.getInfoAsync(photo.uri);

    const media: CapturedMedia = {
      id: generateMediaId(),
      type: "photo",
      uri: photo.uri,
      timestamp: Date.now(),
      dimensions: {
        width: photo.width,
        height: photo.height,
      },
      fileSize: fileInfo.exists ? (fileInfo.size ?? 0) : 0,
      mimeType: "image/jpeg",
    };

    return media;
  } catch (error) {
    logger.error("[Camera Service] Photo capture failed:", error);
    throw error;
  }
}

/**
 * ============================================================================
 * VIDEO RECORDING
 * ============================================================================
 */

/**
 * Start video recording.
 * Target: < 200ms from long-press to recording start.
 *
 * The camera ref implements recordAsync() which returns a Promise that
 * resolves with `{ uri }` when recording is stopped.  We store this promise
 * externally so stopVideoRecording can await it.
 */

/** Module-level store for the in-flight recording promise. */
let _activeRecordingPromise: Promise<{ uri: string }> | null = null;
let _activeRecordingStartedAt = 0;

const MIN_RECORDING_STOP_DELAY_MS = 450;
const RECORDING_START_CONFIRMATION_TIMEOUT_MS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isCameraNotReadyStopError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("camera is not ready") ||
    message.includes("oncameraready")
  );
}

async function requestNativeStopRecording(cameraRef: any): Promise<void> {
  const stopRecording = cameraRef?.stopRecording;
  if (typeof stopRecording !== "function") {
    throw new Error("Camera ref does not support stopRecording");
  }

  const elapsed = Date.now() - _activeRecordingStartedAt;
  if (elapsed < MIN_RECORDING_STOP_DELAY_MS) {
    await sleep(MIN_RECORDING_STOP_DELAY_MS - elapsed);
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const maybePromise = stopRecording.call(cameraRef);
      if (
        maybePromise &&
        typeof (maybePromise as Promise<void>).then === "function"
      ) {
        await maybePromise;
      }
      return;
    } catch (error) {
      lastError = error;
      if (!isCameraNotReadyStopError(error) || attempt === 2) {
        break;
      }
      await sleep(180 * (attempt + 1));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to stop native recording");
}

async function createConfirmedRecordingPromise(
  cameraRef: any,
  maxDuration: number,
): Promise<{ recordingPromise: Promise<{ uri: string }> }> {
  const recordingPromise = (cameraRef as any).recordAsync({
    maxDuration,
    // 'mute' controls whether audio is recorded
    mute: false,
  });
  if (
    !recordingPromise ||
    typeof (recordingPromise as Promise<{ uri: string }>).then !== "function"
  ) {
    throw new Error("Camera ref did not return a recording promise");
  }

  const activeRecordingPromise = recordingPromise as Promise<{ uri: string }>;

  const startStatus = await Promise.race([
    activeRecordingPromise.then(
      () => "completed" as const,
      (error) => {
        throw error;
      },
    ),
    sleep(RECORDING_START_CONFIRMATION_TIMEOUT_MS).then(
      () => "recording" as const,
    ),
  ]);

  if (startStatus === "completed") {
    throw new Error("Video recording ended before it became active");
  }

  return { recordingPromise: activeRecordingPromise };
}

export function hasActiveVideoRecording(): boolean {
  return _activeRecordingPromise !== null;
}

export async function startVideoRecording(
  cameraRef: any,
  settings: CameraSettings,
): Promise<void> {
  if (!cameraRef) {
    throw new Error("Camera reference not initialized");
  }

  try {
    const maxDuration = 60; // seconds

    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        _activeRecordingStartedAt = Date.now();
        const { recordingPromise } = await createConfirmedRecordingPromise(
          cameraRef,
          maxDuration,
        );
        _activeRecordingPromise = recordingPromise;
        logger.info("[Camera Service] Video recording started");
        return;
      } catch (error) {
        lastError = error;
        _activeRecordingPromise = null;
        _activeRecordingStartedAt = 0;

        if (!isCameraNotReadyStopError(error) || attempt === 2) {
          break;
        }
        await sleep(220 * (attempt + 1));
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("Failed to start recording");
  } catch (error) {
    _activeRecordingPromise = null;
    _activeRecordingStartedAt = 0;
    logger.error("[Camera Service] Failed to start recording:", error);
    throw error;
  }
}

/**
 * Stop video recording and return captured media.
 */
export async function stopVideoRecording(
  cameraRef: any,
): Promise<CapturedMedia> {
  if (!cameraRef) {
    throw new Error("Camera reference not initialized");
  }

  let preserveActiveRecordingForRetry = false;

  try {
    if (!_activeRecordingPromise) {
      throw new Error("No active recording to stop");
    }

    const recordingPromise = _activeRecordingPromise;

    // Tell the camera to stop; this causes recordAsync()'s promise to resolve.
    // Do not clear the active promise if the native stop command itself fails;
    // keeping it lets a subsequent tap retry the stop instead of cascading into
    // "No active recording to stop".
    try {
      await requestNativeStopRecording(cameraRef);
    } catch (error) {
      preserveActiveRecordingForRetry = isCameraNotReadyStopError(error);
      throw error;
    }

    const videoData = await recordingPromise;
    _activeRecordingPromise = null;
    _activeRecordingStartedAt = 0;

    logger.info(`[Camera Service] Video recording stopped: ${videoData.uri}`);

    // Read file metadata
    const fileInfo = await FileSystem.getInfoAsync(videoData.uri);

    const media: CapturedMedia = {
      id: generateMediaId(),
      type: "video",
      uri: videoData.uri,
      timestamp: Date.now(),
      duration: 0, // Duration will be filled by the recording timer in the hook
      dimensions: { width: 1920, height: 1080 },
      fileSize: fileInfo.exists ? (fileInfo.size ?? 0) : 0,
      mimeType: "video/mp4",
    };

    return media;
  } catch (error) {
    if (!preserveActiveRecordingForRetry) {
      _activeRecordingPromise = null;
      _activeRecordingStartedAt = 0;
    }
    logger.error("[Camera Service] Failed to stop recording:", error);
    throw error;
  }
}

/**
 * Pause video recording (if supported by the device).
 */
export async function pauseVideoRecording(cameraRef: any): Promise<void> {
  if (!cameraRef) {
    throw new Error("Camera reference not initialized");
  }

  try {
    if (typeof cameraRef.pauseRecording === "function") {
      await cameraRef.pauseRecording();
      logger.info("[Camera Service] Recording paused");
    } else {
      logger.info("[Camera Service] Pause not supported by this camera ref");
    }
  } catch (error) {
    logger.error("[Camera Service] Failed to pause recording:", error);
    throw error;
  }
}

/**
 * Resume video recording (if supported by the device).
 */
export async function resumeVideoRecording(cameraRef: any): Promise<void> {
  if (!cameraRef) {
    throw new Error("Camera reference not initialized");
  }

  try {
    if (typeof cameraRef.resumeRecording === "function") {
      await cameraRef.resumeRecording();
      logger.info("[Camera Service] Recording resumed");
    } else {
      logger.info("[Camera Service] Resume not supported by this camera ref");
    }
  } catch (error) {
    logger.error("[Camera Service] Failed to resume recording:", error);
    throw error;
  }
}

/**
 * ============================================================================
 * IMAGE COMPRESSION
 * ============================================================================
 */

/**
 * Compress image to reduce file size
 * Target: 60-70% reduction while maintaining quality
 */
export async function compressImage(
  sourceUri: string,
  targetQuality: number = 0.75, // 0.5 to 1.0
): Promise<{ uri: string; width: number; height: number; size: number }> {
  try {
    logger.info(`[Camera Service] Compressing image from ${sourceUri}`);

    // Get original image dimensions
    const result = await manipulateImage(sourceUri, undefined, {
      compress: targetQuality,
    });

    // Get file size
    const fileInfo = await FileSystem.getInfoAsync(result.uri);

    return {
      uri: result.uri,
      width: result.width,
      height: result.height,
      size: fileInfo.exists ? (fileInfo.size ?? 0) : 0,
    };
  } catch (error) {
    logger.error("[Camera Service] Image compression failed:", error);
    throw error;
  }
}

/**
 * Compress image to specific dimensions
 */
export async function compressImageToSize(
  sourceUri: string,
  maxWidth: number = 1080,
  maxHeight: number = 1920,
): Promise<{ uri: string; width: number; height: number; size: number }> {
  try {
    // First get original dimensions to maintain aspect ratio
    const probe = await getImageDimensions(sourceUri);
    const origW = probe.width;
    const origH = probe.height;
    const scale = Math.min(maxWidth / origW, maxHeight / origH, 1);

    const result = await manipulateImage(
      sourceUri,
      scale < 1
        ? (context) => {
            context.resize({ width: Math.round(origW * scale) });
          }
        : undefined,
      {
        compress: 0.8,
      },
    );

    const fileInfo = await FileSystem.getInfoAsync(result.uri);

    return {
      uri: result.uri,
      width: result.width,
      height: result.height,
      size: fileInfo.exists ? (fileInfo.size ?? 0) : 0,
    };
  } catch (error) {
    logger.error("[Camera Service] Image resize compression failed:", error);
    throw error;
  }
}

/**
 * ============================================================================
 * VIDEO COMPRESSION & THUMBNAIL
 * ============================================================================
 */

/**
 * Compress video (requires FFmpeg)
 * Target: Stream encoding on device
 */
export async function compressVideo(
  sourceUri: string,
  targetResolution: "auto" | "720p" | "1080p" | "4k" = "1080p",
): Promise<{ uri: string; duration: number; size: number; bitrate: number }> {
  try {
    logger.info(`[Camera Service] Compressing video to ${targetResolution}`);

    // Delegate to native video processing service
    const { compressVideo: nativeCompress } =
      await import("./nativeVideoProcessing");
    const metadata = await nativeCompress(sourceUri, {
      resolution: targetResolution as "720p" | "1080p" | "4k" | "360p" | "480p",
    });

    return {
      uri: metadata.uri,
      duration: metadata.duration,
      size: metadata.size,
      bitrate: metadata.bitrate,
    };
  } catch (error) {
    logger.error("[Camera Service] Video compression failed:", error);
    throw error;
  }
}

/**
 * Generate thumbnail from media
 */
export async function generateThumbnail(
  mediaUri: string,
  mediaType: "photo" | "video",
  size: number = 200,
): Promise<string> {
  try {
    if (mediaType === "photo") {
      const result = await manipulateImage(
        mediaUri,
        (context) => {
          context.resize({ width: size, height: size });
        },
        {
          compress: 0.7,
        },
      );
      return result.uri;
    } else {
      // Delegate to native video processing for thumbnail
      const { generateVideoThumbnail } =
        await import("./nativeVideoProcessing");
      return generateVideoThumbnail(mediaUri, 0, size);
    }
  } catch (error) {
    logger.error("[Camera Service] Thumbnail generation failed:", error);
    return mediaUri;
  }
}

/**
 * ============================================================================
 * FILE MANAGEMENT
 * ============================================================================
 */

/**
 * Delete media file from device
 */
export async function deleteMediaFile(uri: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
    logger.info(`[Camera Service] Deleted media file: ${uri}`);
  } catch (error) {
    logger.error("[Camera Service] Failed to delete media file:", error);
  }
}

/**
 * Save media to persistent storage
 */
export async function saveMediaToLibrary(
  sourceUri: string,
  filename: string,
): Promise<string> {
  try {
    const destinationUri = `${FileSystem.documentDirectory}media/${filename}`;

    // Create directory if not exists
    const dirInfo = await FileSystem.getInfoAsync(
      FileSystem.documentDirectory + "media/",
    );
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(
        FileSystem.documentDirectory + "media/",
        {
          intermediates: true,
        },
      );
    }

    // Copy file
    await FileSystem.copyAsync({
      from: sourceUri,
      to: destinationUri,
    });

    return destinationUri;
  } catch (error) {
    logger.error("[Camera Service] Failed to save media to library:", error);
    throw error;
  }
}

/**
 * Get available storage space
 */
export async function getAvailableStorageSpace(): Promise<number> {
  try {
    const freeBytes = await FileSystem.getFreeDiskStorageAsync();
    return freeBytes;
  } catch (error) {
    logger.error("[Camera Service] Failed to get storage info:", error);
    return 0;
  }
}

/**
 * ============================================================================
 * UTILITY FUNCTIONS
 * ============================================================================
 */

/**
 * Generate unique media ID
 */
function generateMediaId(): string {
  return `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Map VideoQuality to RNCamera quality constant
 */
function getRNVideoQuality(quality: "auto" | "720p" | "1080p" | "4k"): string {
  const qualityMap: Record<string, string> = {
    auto: "auto",
    "720p": "low",
    "1080p": "medium",
    "4k": "high",
  };
  return qualityMap[quality] || "medium";
}

/**
 * Get video bitrate for quality level
 */
function getVideoBitrate(quality: "auto" | "720p" | "1080p" | "4k"): number {
  const bitrateMap: Record<string, number> = {
    auto: 3000000, // 3 Mbps
    "720p": 3000000, // 3 Mbps
    "1080p": 5000000, // 5 Mbps
    "4k": 12000000, // 12 Mbps
  };
  return bitrateMap[quality] || 5000000;
}

/**
 * Calculate compression ratio
 */
export function calculateCompressionRatio(
  originalSize: number,
  compressedSize: number,
): number {
  if (originalSize === 0) return 0;
  return Math.round(((originalSize - compressedSize) / originalSize) * 100);
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

/**
 * Validate media file
 */
export function isValidMediaFile(uri: string): boolean {
  const validExtensions = [".jpg", ".jpeg", ".png", ".webp", ".mp4", ".mov"];
  return validExtensions.some((ext) => uri.toLowerCase().endsWith(ext));
}
