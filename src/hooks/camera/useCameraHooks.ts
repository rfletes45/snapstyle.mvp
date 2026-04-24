/**
 * CUSTOM HOOKS FOR CAMERA SYSTEM
 * State management and side effects for camera functionality.
 * Uses CameraContext (React Context + useReducer) — NOT Redux.
 */

import * as CameraService from "@/services/camera/cameraService";
import { useCameraState, useEditorState } from "@/store/CameraContext";
import type { CameraSettings, CapturedMedia } from "@/types/camera";
import { useCallback, useEffect, useRef, useState } from "react";

import { createLogger } from "@/utils/log";
const logger = createLogger("hooks/camera/useCameraHooks");
/**
 * ============================================================================
 * CAMERA PERMISSIONS HOOK
 * ============================================================================
 */

/**
 * Manage camera and microphone permissions.
 * Checks status first and only prompts if undetermined.
 * Reports "denied" clearly so the UI can offer an "Open Settings" button.
 */
export function useCameraPermissions() {
  const { isPermissionGranted, setPermissionGranted } = useCameraState();
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    checkAndRequestPermissions();
  }, []);

  const checkAndRequestPermissions = async () => {
    if (isChecking) return;
    setIsChecking(true);
    try {
      setPermissionError(null);

      // First check current status without prompting
      const cameraStatus = await CameraService.getCameraPermissionStatus();
      const micStatus = await CameraService.getMicrophonePermissionStatus();

      // If both already granted, skip prompting
      if (cameraStatus === "granted" && micStatus === "granted") {
        setPermissionGranted(true);
        return;
      }

      // If either was denied (hard deny), show appropriate message
      if (cameraStatus === "denied" || micStatus === "denied") {
        const deniedParts: string[] = [];
        if (cameraStatus === "denied") deniedParts.push("camera");
        if (micStatus === "denied") deniedParts.push("microphone");
        setPermissionError(
          `${deniedParts.join(" and ")} access was denied. Please enable it in Settings.`,
        );
        return;
      }

      // Otherwise request
      const cameraGranted = await CameraService.requestCameraPermission();
      const micGranted = await CameraService.requestMicrophonePermission();

      if (cameraGranted && micGranted) {
        setPermissionGranted(true);
      } else {
        const deniedParts: string[] = [];
        if (!cameraGranted) deniedParts.push("Camera");
        if (!micGranted) deniedParts.push("Microphone");
        setPermissionError(
          `${deniedParts.join(" and ")} permission denied. Please enable in Settings.`,
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to request permissions";
      setPermissionError(errorMessage);
    } finally {
      setIsChecking(false);
    }
  };

  return {
    isPermissionGranted,
    permissionError,
    isChecking,
    requestPermissions: checkAndRequestPermissions,
  };
}

/**
 * ============================================================================
 * CAMERA CONTROLS HOOK
 * ============================================================================
 */

/**
 * Manage camera device and settings
 */
export function useCamera() {
  const { settings, cameraReady, setCameraReady } = useCameraState();
  const cameraRef = useRef<any>(null);
  const [cameraMaxZoom] = useState(8);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const handleCameraReady = useCallback(() => {
    setCameraReady(true);
    setCameraError(null); // Clear any previous mount error
    logger.info("[Camera Hook] Camera ready");
  }, [setCameraReady]);

  const handleCameraError = useCallback((error: any) => {
    logger.error("[Camera Hook] Camera error:", error);
    const message =
      error?.message ?? (typeof error === "string" ? error : "Camera error");
    setCameraError(message);
  }, []);

  const clearError = useCallback(() => setCameraError(null), []);

  return {
    cameraRef,
    cameraReady,
    cameraMaxZoom,
    cameraError,
    clearError,
    settings,
    onCameraReady: handleCameraReady,
    onCameraError: handleCameraError,
  };
}

/**
 * ============================================================================
 * VIDEO RECORDING HOOK
 * ============================================================================
 */

/**
 * Manage video recording state and duration
 */
export function useRecording(cameraRef: React.RefObject<any>) {
  const {
    recordingState,
    settings,
    startRecording: dispatchStart,
    stopRecording: dispatchStop,
    setRecordingDuration,
  } = useCameraState();
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const timerInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Tracks elapsed ms independently to avoid stale-closure reads. */
  const elapsedRef = useRef(0);

  // Sync the ref when recording starts / stops externally
  useEffect(() => {
    if (!recordingState.isRecording) {
      elapsedRef.current = 0;
    }
  }, [recordingState.isRecording]);

  // Update timer every 100ms using the ref so the closure is never stale
  useEffect(() => {
    if (recordingState.isRecording && !recordingState.isPaused) {
      timerInterval.current = setInterval(() => {
        elapsedRef.current += 100;
        setRecordingDuration(elapsedRef.current);
      }, 100);
    } else {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
        timerInterval.current = null;
      }
    }

    return () => {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
        timerInterval.current = null;
      }
    };
  }, [
    recordingState.isRecording,
    recordingState.isPaused,
    setRecordingDuration,
  ]);

  // Cleanup: stop recording on unmount so the camera doesn't hang
  useEffect(() => {
    return () => {
      if (cameraRef.current && recordingState.isRecording) {
        try {
          (cameraRef.current as any).stopRecording?.();
        } catch {
          // Best-effort cleanup
        }
        dispatchStop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRecordingVideo = useCallback(async (): Promise<boolean> => {
    try {
      if (!cameraRef.current) {
        throw new Error("Camera not ready");
      }

      await CameraService.startVideoRecording(cameraRef.current, settings);
      dispatchStart();
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to start recording";
      setRecordingError(errorMessage);
      dispatchStop();
      return false;
    }
  }, [dispatchStart, dispatchStop, cameraRef, settings]);

  const stopRecordingVideo =
    useCallback(async (): Promise<CapturedMedia | null> => {
      try {
        if (!cameraRef.current) {
          throw new Error("Camera not ready");
        }

        const media = await CameraService.stopVideoRecording(cameraRef.current);
        dispatchStop();
        return media;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to stop recording";
        setRecordingError(errorMessage);
        if (!CameraService.hasActiveVideoRecording()) {
          dispatchStop();
        }
        return null;
      }
    }, [dispatchStop, cameraRef]);

  return {
    recordingState,
    recordingError,
    startRecording: startRecordingVideo,
    stopRecording: stopRecordingVideo,
  };
}

/**
 * ============================================================================
 * PHOTO CAPTURE HOOK
 * ============================================================================
 */

/**
 * Handle photo capture
 */
export function usePhotoCapture(cameraRef: React.RefObject<any>) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const capturePhoto = useCallback(
    async (settings: CameraSettings): Promise<CapturedMedia | null> => {
      try {
        setIsCapturing(true);
        setCaptureError(null);

        if (!cameraRef.current) {
          throw new Error("Camera not ready");
        }

        const media = await CameraService.capturePhoto(
          cameraRef.current,
          settings,
        );
        return media;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to capture photo";
        setCaptureError(errorMessage);
        return null;
      } finally {
        setIsCapturing(false);
      }
    },
    [cameraRef],
  );

  return {
    isCapturing,
    captureError,
    capturePhoto,
  };
}

/**
 * ============================================================================
 * EDITOR HOOK
 * ============================================================================
 */

/**
 * Manage editor state (undo/redo, element selection)
 */
export function useEditor() {
  const editorState = useEditorState();

  return {
    editorState: {
      currentSnap: editorState.currentSnap,
      editMode: editorState.editMode,
      overlayElements: editorState.overlayElements,
      selectedElementId: editorState.selectedElementId,
      appliedFilters: editorState.appliedFilters,
      undoStack: editorState.undoStack,
      redoStack: editorState.redoStack,
      zoom: editorState.zoom,
    },
    canUndo: editorState.canUndo,
    canRedo: editorState.canRedo,
    undo: editorState.undo,
    redo: editorState.redo,
    selectElement: editorState.selectElement,
    addElement: editorState.addElement,
    updateElement: editorState.updateElement,
    removeElement: editorState.removeElement,
    applyFilter: editorState.applyFilter,
    removeFilter: editorState.removeFilter,
    clearAllFilters: editorState.clearAllFilters,
    setCurrentSnap: editorState.setCurrentSnap,
    clearCurrentSnap: editorState.clearCurrentSnap,
    setEditMode: editorState.setEditMode,
    resetEditor: editorState.resetEditor,
  };
}

/**
 * ============================================================================
 * MEDIA COMPRESSION HOOK
 * ============================================================================
 */

/**
 * Handle media compression
 */
export function useMediaCompression() {
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionError, setCompressionError] = useState<string | null>(null);

  const compressImage = useCallback(
    async (sourceUri: string, quality: number = 0.75) => {
      try {
        setIsCompressing(true);
        setCompressionError(null);

        const result = await CameraService.compressImage(sourceUri, quality);
        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Compression failed";
        setCompressionError(errorMessage);
        throw error;
      } finally {
        setIsCompressing(false);
      }
    },
    [],
  );

  const compressVideo = useCallback(
    async (
      sourceUri: string,
      quality: "auto" | "720p" | "1080p" | "4k" = "1080p",
    ) => {
      try {
        setIsCompressing(true);
        setCompressionError(null);

        const result = await CameraService.compressVideo(sourceUri, quality);
        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Compression failed";
        setCompressionError(errorMessage);
        throw error;
      } finally {
        setIsCompressing(false);
      }
    },
    [],
  );

  return {
    isCompressing,
    compressionError,
    compressImage,
    compressVideo,
  };
}
