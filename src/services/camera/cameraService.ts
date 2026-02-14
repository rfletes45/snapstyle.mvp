/**
 * CAMERA SERVICE
 * Handles photo capture, video recording, compression, and permissions.
 * Uses expo-camera for cross-platform camera access and permission handling.
 */

import {
  CameraPermissions,
  CameraSettings,
  CapturedMedia,
  PermissionStatus,
} from "@/types/camera";
import { Camera, type CameraView } from "expo-camera";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";

import { createLogger } from "@/utils/log";
const logger = createLogger("services/camera/cameraService");

/**
 * Map expo-camera permission status string to our PermissionStatus type.
 */
function mapExpoStatus(
  status: "granted" | "denied" | "undetermined" | string,
): PermissionStatus {
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
 * Uses expo-camera's `Camera.requestCameraPermissionsAsync()`.
 */
export async function requestCameraPermission(): Promise<boolean> {
  try {
    const { status } = await Camera.requestCameraPermissionsAsync();
    const granted = status === "granted";
    logger.info(
      `[Camera Service] Camera permission ${granted ? "granted" : "denied"}`,
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
 * Uses expo-camera's `Camera.requestMicrophonePermissionsAsync()`.
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    const { status } = await Camera.requestMicrophonePermissionsAsync();
    const granted = status === "granted";
    logger.info(
      `[Camera Service] Microphone permission ${granted ? "granted" : "denied"}`,
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
    const { status } = await Camera.getCameraPermissionsAsync();
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
    const { status } = await Camera.getMicrophonePermissionsAsync();
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
    const MediaLibrary = await import("expo-media-library").catch(() => null);
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
  cameraRef: CameraView | null,
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
    const photo = await cameraRef.takePictureAsync({
      quality: 0.85,
      base64: false,
      skipProcessing: true,
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
 * expo-camera CameraView.recordAsync() returns a Promise that resolves with
 * `{ uri }` when recording is stopped.  We store this promise externally so
 * stopVideoRecording can await it.
 */

/** Module-level store for the in-flight recording promise. */
let _activeRecordingPromise: Promise<{ uri: string }> | null = null;

export async function startVideoRecording(
  cameraRef: CameraView | null,
  settings: CameraSettings,
): Promise<void> {
  if (!cameraRef) {
    throw new Error("Camera reference not initialized");
  }

  try {
    const maxDuration = 60; // seconds

    // recordAsync returns a promise that resolves when recording stops
    _activeRecordingPromise = (cameraRef as any).recordAsync({
      maxDuration,
      // expo-camera v14+ uses 'mute' rather than separate audio settings
      mute: false,
    });

    logger.info("[Camera Service] Video recording started");
  } catch (error) {
    _activeRecordingPromise = null;
    logger.error("[Camera Service] Failed to start recording:", error);
    throw error;
  }
}

/**
 * Stop video recording and return captured media.
 */
export async function stopVideoRecording(
  cameraRef: CameraView | null,
): Promise<CapturedMedia> {
  if (!cameraRef) {
    throw new Error("Camera reference not initialized");
  }

  try {
    // Tell the camera to stop; this causes recordAsync()'s promise to resolve
    (cameraRef as any).stopRecording();

    if (!_activeRecordingPromise) {
      throw new Error("No active recording to stop");
    }

    const videoData = await _activeRecordingPromise;
    _activeRecordingPromise = null;

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
    _activeRecordingPromise = null;
    logger.error("[Camera Service] Failed to stop recording:", error);
    throw error;
  }
}

/**
 * Pause video recording (if supported by the device).
 */
export async function pauseVideoRecording(
  cameraRef: CameraView | null,
): Promise<void> {
  if (!cameraRef) {
    throw new Error("Camera reference not initialized");
  }

  try {
    // expo-camera CameraView does not support pause/resume natively.
    // This is a no-op placeholder; a future native module or expo-av
    // recording pipeline could enable this.
    logger.info(
      "[Camera Service] Pause requested (not supported by expo-camera CameraView)",
    );
  } catch (error) {
    logger.error("[Camera Service] Failed to pause recording:", error);
    throw error;
  }
}

/**
 * Resume video recording (if supported by the device).
 */
export async function resumeVideoRecording(
  cameraRef: CameraView | null,
): Promise<void> {
  if (!cameraRef) {
    throw new Error("Camera reference not initialized");
  }

  try {
    // expo-camera CameraView does not support pause/resume natively.
    logger.info(
      "[Camera Service] Resume requested (not supported by expo-camera CameraView)",
    );
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
    const result = await ImageManipulator.manipulateAsync(sourceUri, [], {
      compress: targetQuality,
      format: ImageManipulator.SaveFormat.JPEG,
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
    const probe = await ImageManipulator.manipulateAsync(sourceUri, [], {
      compress: 1,
      format: ImageManipulator.SaveFormat.JPEG,
    });

    const origW = probe.width;
    const origH = probe.height;
    const scale = Math.min(maxWidth / origW, maxHeight / origH, 1);

    // Only resize if the image is larger than the max
    const actions =
      scale < 1 ? [{ resize: { width: Math.round(origW * scale) } }] : [];

    const result = await ImageManipulator.manipulateAsync(
      sourceUri,
      actions as any,
      {
        compress: 0.8,
        format: ImageManipulator.SaveFormat.JPEG,
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
      const result = await ImageManipulator.manipulateAsync(
        mediaUri,
        [{ resize: { width: size, height: size } }],
        {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
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
