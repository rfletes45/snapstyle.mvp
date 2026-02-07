/**
 * useAttachmentPicker Hook
 *
 * Manages attachment selection, preview, and upload for chat messages.
 *
 * Features:
 * - Multi-image selection from gallery
 * - Camera capture
 * - Upload progress tracking
 * - Attachment removal
 *
 * @module hooks/useAttachmentPicker
 */

import {
  LocalAttachment,
  UploadProgressCallback,
  generateAttachmentId,
  getFileSize,
  getMimeType,
  uploadMultipleAttachments,
} from "@/services/storage";
import { AttachmentKind, AttachmentV2 } from "@/types/messaging";
import { createLogger } from "@/utils/log";
import {
  captureImageFromWebcam,
  pickImageFromWeb,
} from "@/utils/webImagePicker";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Platform } from "react-native";

const log = createLogger("useAttachmentPicker");

// =============================================================================
// Types
// =============================================================================

export interface AttachmentUploadProgress {
  [attachmentId: string]: {
    progress: number; // 0-1
    status: "pending" | "uploading" | "complete" | "error";
    error?: string;
  };
}

export interface UseAttachmentPickerOptions {
  /** Maximum number of attachments allowed */
  maxAttachments?: number;
  /** Maximum file size in bytes (default 10MB) */
  maxFileSize?: number;
  /** Allowed attachment types */
  allowedTypes?: AttachmentKind[];
  /** Callback when attachments change */
  onAttachmentsChange?: (attachments: LocalAttachment[]) => void;
  /** Route params from navigation (to receive captured image from Camera) */
  routeParams?: Record<string, any>;
  /** The route name for the calling screen (used to return from Camera) */
  returnRoute?: string;
  /** Data to pass back when returning from Camera (e.g. groupId, chatId) */
  returnData?: Record<string, any>;
}

export interface UseAttachmentPickerReturn {
  /** Currently selected local attachments */
  attachments: LocalAttachment[];
  /** Upload progress for each attachment */
  uploadProgress: AttachmentUploadProgress;
  /** Whether an upload is in progress */
  isUploading: boolean;
  /** Total upload progress (0-1) */
  totalProgress: number;
  /** Whether max attachments reached */
  isMaxReached: boolean;
  /** Number of remaining slots */
  remainingSlots: number;
  /** Pick images from gallery */
  pickFromGallery: () => Promise<void>;
  /** Capture from camera */
  captureFromCamera: () => Promise<void>;
  /** Remove an attachment by ID */
  removeAttachment: (id: string) => void;
  /** Clear all attachments */
  clearAttachments: () => void;
  /** Upload all attachments and return results */
  uploadAttachments: (basePath: string) => Promise<{
    successful: AttachmentV2[];
    failed: { id: string; error: string }[];
  }>;
  /** Add a caption to an attachment */
  setCaption: (id: string, caption: string) => void;
  /** Toggle view-once for an attachment */
  toggleViewOnce: (id: string) => void;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MAX_ATTACHMENTS = 10;
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_ALLOWED_TYPES: AttachmentKind[] = ["image"];

// =============================================================================
// Hook Implementation
// =============================================================================

export function useAttachmentPicker(
  options: UseAttachmentPickerOptions = {},
): UseAttachmentPickerReturn {
  const {
    maxAttachments = DEFAULT_MAX_ATTACHMENTS,
    maxFileSize = DEFAULT_MAX_FILE_SIZE,
    allowedTypes = DEFAULT_ALLOWED_TYPES,
    onAttachmentsChange,
    routeParams,
    returnRoute,
    returnData,
  } = options;

  const navigation = useNavigation<any>();

  // ==========================================================================
  // State
  // ==========================================================================

  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [uploadProgress, setUploadProgress] =
    useState<AttachmentUploadProgress>({});
  const [isUploading, setIsUploading] = useState(false);

  // ==========================================================================
  // Handle captured image returned from CameraScreen
  // ==========================================================================

  useEffect(() => {
    if (routeParams?.capturedImageUri) {
      log.debug(
        "Received captured image from Camera:",
        routeParams.capturedImageUri,
      );
      (async () => {
        try {
          const attachment = await createLocalAttachment(
            routeParams.capturedImageUri,
            "image",
          );
          if (attachment) {
            updateAttachments([...attachments, attachment]);
          }
        } catch (error) {
          log.error("Failed to process captured image", error);
        }
      })();
    }
  }, [routeParams?.capturedImageUri]);

  // ==========================================================================
  // Computed Values
  // ==========================================================================

  const isMaxReached = attachments.length >= maxAttachments;
  const remainingSlots = Math.max(0, maxAttachments - attachments.length);

  const totalProgress = useMemo(() => {
    const ids = Object.keys(uploadProgress);
    if (ids.length === 0) return 0;

    const total = ids.reduce((sum, id) => sum + uploadProgress[id].progress, 0);
    return total / ids.length;
  }, [uploadProgress]);

  // ==========================================================================
  // Helper Functions
  // ==========================================================================

  const updateAttachments = useCallback(
    (newAttachments: LocalAttachment[]) => {
      setAttachments(newAttachments);
      onAttachmentsChange?.(newAttachments);
    },
    [onAttachmentsChange],
  );

  const createLocalAttachment = useCallback(
    async (
      uri: string,
      kind: AttachmentKind,
    ): Promise<LocalAttachment | null> => {
      try {
        const id = generateAttachmentId();
        const mime = getMimeType(uri, kind);
        const sizeBytes = await getFileSize(uri);

        // Check file size
        if (sizeBytes > maxFileSize) {
          Alert.alert(
            "File Too Large",
            `Maximum file size is ${Math.round(maxFileSize / (1024 * 1024))}MB`,
          );
          return null;
        }

        return {
          id,
          uri,
          kind,
          mime,
          sizeBytes,
        };
      } catch (error) {
        log.error("Failed to create local attachment", error);
        return null;
      }
    },
    [maxFileSize],
  );

  // ==========================================================================
  // Gallery Picker
  // ==========================================================================

  const pickFromGallery = useCallback(async () => {
    if (isMaxReached) {
      Alert.alert(
        "Maximum Reached",
        `You can only attach up to ${maxAttachments} files`,
      );
      return;
    }

    try {
      // Web platform: use custom file picker
      if (Platform.OS === "web") {
        log.debug("Using web file picker");
        const imageUri = await pickImageFromWeb();
        if (imageUri) {
          const attachment = await createLocalAttachment(imageUri, "image");
          if (attachment) {
            updateAttachments([...attachments, attachment]);
          }
        }
        return;
      }

      // Native platforms: Request permissions
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Photo library access is required to select images",
        );
        return;
      }

      // Launch picker with multi-selection
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
        quality: 1,
        exif: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        log.debug("Gallery selection cancelled");
        return;
      }

      log.debug(`Selected ${result.assets.length} images from gallery`);

      // Create local attachments
      const newAttachments: LocalAttachment[] = [];
      for (const asset of result.assets) {
        const attachment = await createLocalAttachment(asset.uri, "image");
        if (attachment) {
          attachment.width = asset.width;
          attachment.height = asset.height;
          newAttachments.push(attachment);
        }
      }

      if (newAttachments.length > 0) {
        updateAttachments([...attachments, ...newAttachments]);
      }
    } catch (error) {
      log.error("Gallery picker error", error);
      Alert.alert("Error", "Failed to select images");
    }
  }, [
    isMaxReached,
    maxAttachments,
    remainingSlots,
    attachments,
    createLocalAttachment,
    updateAttachments,
  ]);

  // ==========================================================================
  // Camera Capture
  // ==========================================================================

  const captureFromCamera = useCallback(async () => {
    if (isMaxReached) {
      Alert.alert(
        "Maximum Reached",
        `You can only attach up to ${maxAttachments} files`,
      );
      return;
    }

    try {
      // Web platform: use webcam capture (falls back to file picker if not available)
      if (Platform.OS === "web") {
        log.debug("Using web camera capture");
        const imageUri = await captureImageFromWebcam();
        if (imageUri) {
          const attachment = await createLocalAttachment(imageUri, "image");
          if (attachment) {
            updateAttachments([...attachments, attachment]);
          }
        }
        return;
      }

      // Native platforms: navigate to built-in Camera screen
      log.debug("Navigating to Camera screen (chat mode)");
      navigation.navigate("Camera", {
        mode: "chat",
        returnRoute: returnRoute || "GroupChat",
        returnData: returnData || {},
      });
    } catch (error) {
      log.error("Camera capture error", error);
      Alert.alert("Error", "Failed to capture photo");
    }
  }, [
    isMaxReached,
    maxAttachments,
    attachments,
    createLocalAttachment,
    updateAttachments,
    navigation,
    returnRoute,
    returnData,
  ]);

  // ==========================================================================
  // Attachment Management
  // ==========================================================================

  const removeAttachment = useCallback(
    (id: string) => {
      const filtered = attachments.filter((a) => a.id !== id);
      updateAttachments(filtered);

      // Clear progress for removed attachment
      setUploadProgress((prev) => {
        const { [id]: removed, ...rest } = prev;
        return rest;
      });
    },
    [attachments, updateAttachments],
  );

  const clearAttachments = useCallback(() => {
    updateAttachments([]);
    setUploadProgress({});
  }, [updateAttachments]);

  const setCaption = useCallback(
    (id: string, caption: string) => {
      const updated = attachments.map((a) =>
        a.id === id ? { ...a, caption } : a,
      );
      updateAttachments(updated);
    },
    [attachments, updateAttachments],
  );

  const toggleViewOnce = useCallback(
    (id: string) => {
      const updated = attachments.map((a) =>
        a.id === id ? { ...a, viewOnce: !a.viewOnce } : a,
      );
      updateAttachments(updated);
    },
    [attachments, updateAttachments],
  );

  // ==========================================================================
  // Upload
  // ==========================================================================

  const uploadAttachments = useCallback(
    async (
      basePath: string,
    ): Promise<{
      successful: AttachmentV2[];
      failed: { id: string; error: string }[];
    }> => {
      if (attachments.length === 0) {
        return { successful: [], failed: [] };
      }

      setIsUploading(true);

      // Initialize progress for all attachments
      const initialProgress: AttachmentUploadProgress = {};
      for (const att of attachments) {
        initialProgress[att.id] = { progress: 0, status: "pending" };
      }
      setUploadProgress(initialProgress);

      // Progress callback
      const onProgress: UploadProgressCallback = (
        id,
        progress,
        status,
        error,
      ) => {
        setUploadProgress((prev) => ({
          ...prev,
          [id]: { progress, status, error },
        }));
      };

      try {
        const result = await uploadMultipleAttachments(
          attachments,
          basePath,
          onProgress,
        );

        // Clear attachments on success
        if (result.failed.length === 0) {
          clearAttachments();
        }

        return result;
      } finally {
        setIsUploading(false);
      }
    },
    [attachments, clearAttachments],
  );

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    attachments,
    uploadProgress,
    isUploading,
    totalProgress,
    isMaxReached,
    remainingSlots,
    pickFromGallery,
    captureFromCamera,
    removeAttachment,
    clearAttachments,
    uploadAttachments,
    setCaption,
    toggleViewOnce,
  };
}

export default useAttachmentPicker;
