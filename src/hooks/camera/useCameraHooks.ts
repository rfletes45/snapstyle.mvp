/**
 * CUSTOM HOOKS FOR CAMERA SYSTEM
 * State management and side effects for camera functionality.
 * Uses CameraContext (React Context + useReducer) — NOT Redux.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import * as CameraService from "../../services/camera/cameraService";
import * as SnapService from "../../services/camera/snapService";
import { useAuth } from "../../store/AuthContext";
import {
  useCameraState,
  useEditorState,
  useSnapState,
} from "../../store/CameraContext";
import type { CameraSettings, CapturedMedia, Snap } from "../../types/camera";

/**
 * ============================================================================
 * CAMERA PERMISSIONS HOOK
 * ============================================================================
 */

/**
 * Manage camera and microphone permissions
 */
export function useCameraPermissions() {
  const { isPermissionGranted, setPermissionGranted } = useCameraState();
  const [permissionError, setPermissionError] = useState<string | null>(null);

  useEffect(() => {
    checkAndRequestPermissions();
  }, []);

  const checkAndRequestPermissions = async () => {
    try {
      const cameraGranted = await CameraService.requestCameraPermission();
      const micGranted = await CameraService.requestMicrophonePermission();

      if (cameraGranted && micGranted) {
        setPermissionGranted(true);
      } else {
        setPermissionError("Camera and microphone permissions required");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to request permissions";
      setPermissionError(errorMessage);
    }
  };

  return {
    isPermissionGranted,
    permissionError,
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
    console.log("[Camera Hook] Camera ready");
  }, [setCameraReady]);

  const handleCameraError = useCallback((error: any) => {
    console.error("[Camera Hook] Camera error:", error);
    setCameraError(error?.message ?? String(error));
  }, []);

  return {
    cameraRef,
    cameraReady,
    cameraMaxZoom,
    cameraError,
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

  // Update timer every 100ms
  useEffect(() => {
    if (recordingState.isRecording && !recordingState.isPaused) {
      timerInterval.current = setInterval(() => {
        setRecordingDuration(recordingState.duration + 100);
      }, 100);
    } else {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
    }

    return () => {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
    };
  }, [
    recordingState.isRecording,
    recordingState.isPaused,
    recordingState.duration,
    setRecordingDuration,
  ]);

  const startRecordingVideo = useCallback(async () => {
    try {
      if (!cameraRef.current) {
        throw new Error("Camera not ready");
      }

      dispatchStart();
      await CameraService.startVideoRecording(cameraRef.current, settings);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to start recording";
      setRecordingError(errorMessage);
      dispatchStop();
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
 * SNAP UPLOAD HOOK
 * ============================================================================
 */

/**
 * Manage snap upload process
 */
export function useSnapUpload() {
  const { currentFirebaseUser } = useAuth();
  const {
    uploading,
    uploadProgress,
    startUpload,
    setUploadProgress,
    uploadSuccess,
    uploadError,
  } = useSnapState();
  const [localUploadError, setLocalUploadError] = useState<string | null>(null);

  const uploadSnap = useCallback(
    async (snap: Snap, mediaFile: File | Blob) => {
      try {
        setLocalUploadError(null);
        startUpload();

        if (!currentFirebaseUser?.uid) {
          throw new Error("User not authenticated");
        }

        const snapId = await SnapService.uploadSnap(
          snap,
          mediaFile,
          currentFirebaseUser.uid,
          (progress: number) => {
            setUploadProgress(progress);
          },
        );

        uploadSuccess({ ...snap, id: snapId });
        return snapId;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Upload failed";
        setLocalUploadError(errorMessage);
        uploadError(errorMessage);
        throw error;
      }
    },
    [
      currentFirebaseUser,
      startUpload,
      setUploadProgress,
      uploadSuccess,
      uploadError,
    ],
  );

  return {
    uploading,
    uploadProgress,
    uploadError: localUploadError,
    uploadSnap,
  };
}

/**
 * ============================================================================
 * FACE DETECTION HOOK
 * ============================================================================
 */

/**
 * Manage face detection
 */
export function useFaceDetection() {
  const [faces, setFaces] = useState<any[]>([]);
  const [detectionError, setDetectionError] = useState<string | null>(null);
  const detectionInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const startFaceDetection = useCallback(
    (_callback: (detectedFaces: any[]) => void) => {
      // Will use expo-face-detector via nativeFaceDetection service
      console.log("[FaceDetection] Starting face detection");
    },
    [],
  );

  const stopFaceDetection = useCallback(() => {
    if (detectionInterval.current) {
      clearInterval(detectionInterval.current);
    }
  }, []);

  return {
    faces,
    detectionError,
    startFaceDetection,
    stopFaceDetection,
  };
}

/**
 * ============================================================================
 * DRAFT MANAGEMENT HOOK
 * ============================================================================
 */

/**
 * Manage snap drafts
 */
export function useSnapDrafts() {
  const { currentFirebaseUser } = useAuth();
  const [drafts, setDrafts] = useState<any[]>([]);
  const [draftError, setDraftError] = useState<string | null>(null);

  useEffect(() => {
    if (currentFirebaseUser?.uid) {
      loadDrafts();
    }
  }, [currentFirebaseUser?.uid]);

  const loadDrafts = async () => {
    try {
      if (!currentFirebaseUser?.uid) return;
      const userDrafts = await SnapService.getUserDrafts(
        currentFirebaseUser.uid,
      );
      setDrafts(userDrafts);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to load drafts";
      setDraftError(errorMessage);
    }
  };

  const saveDraft = async (snap: Partial<Snap>) => {
    try {
      if (!currentFirebaseUser?.uid) throw new Error("User not authenticated");
      const draftId = await SnapService.createDraft(
        snap,
        currentFirebaseUser.uid,
      );
      await loadDrafts();
      return draftId;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save draft";
      setDraftError(errorMessage);
      throw error;
    }
  };

  const deleteDraft = async (draftId: string) => {
    try {
      if (!currentFirebaseUser?.uid) throw new Error("User not authenticated");
      await SnapService.deleteDraft(currentFirebaseUser.uid, draftId);
      await loadDrafts();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to delete draft";
      setDraftError(errorMessage);
      throw error;
    }
  };

  return {
    drafts,
    draftError,
    saveDraft,
    deleteDraft,
    refreshDrafts: loadDrafts,
  };
}

/**
 * ============================================================================
 * SNAP SHARING HOOK
 * ============================================================================
 */

/**
 * Manage snap sharing and recipients
 */
export function useSnapSharing() {
  const {
    selectedRecipients,
    shareToStory,
    caption,
    allowReplies,
    allowReactions,
    addRecipient,
    removeRecipient,
    setShareToStory,
    setCaption,
    setAllowReplies,
    setAllowReactions,
  } = useSnapState();

  return {
    selectedRecipients,
    shareToStory,
    caption,
    allowReplies,
    allowReactions,
    addRecipient,
    removeRecipient,
    setShareToStory,
    setCaption,
    setAllowReplies,
    setAllowReactions,
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
