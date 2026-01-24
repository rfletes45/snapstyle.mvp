/**
 * AttachmentTray Component
 * Phase H10: Multi-Attachment Support
 *
 * Displays pending attachments above the chat composer with:
 * - Thumbnail previews
 * - Remove buttons
 * - Upload progress indicators
 * - Caption input
 *
 * @module components/chat/AttachmentTray
 */

import { AttachmentUploadProgress } from "@/hooks/useAttachmentPicker";
import { LocalAttachment } from "@/services/storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useCallback } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "react-native-paper";

// =============================================================================
// Types
// =============================================================================

export interface AttachmentTrayProps {
  /** List of pending attachments */
  attachments: LocalAttachment[];
  /** Upload progress for each attachment */
  uploadProgress?: AttachmentUploadProgress;
  /** Whether uploading is in progress */
  isUploading?: boolean;
  /** Called when remove button is pressed */
  onRemove: (id: string) => void;
  /** Called when add button is pressed */
  onAdd?: () => void;
  /** Maximum attachments allowed */
  maxAttachments?: number;
}

// =============================================================================
// Constants
// =============================================================================

const THUMBNAIL_SIZE = 80;
const DEFAULT_MAX_ATTACHMENTS = 10;

// =============================================================================
// Sub-Components
// =============================================================================

interface AttachmentThumbnailProps {
  attachment: LocalAttachment;
  progress?: { progress: number; status: string; error?: string };
  onRemove: () => void;
  disabled?: boolean;
}

const AttachmentThumbnail = memo(function AttachmentThumbnail({
  attachment,
  progress,
  onRemove,
  disabled,
}: AttachmentThumbnailProps) {
  const theme = useTheme();

  const isUploading = progress?.status === "uploading";
  const isError = progress?.status === "error";
  const isComplete = progress?.status === "complete";
  const uploadPercent = Math.round((progress?.progress || 0) * 100);

  return (
    <View style={styles.thumbnailContainer}>
      {/* Image */}
      <Image
        source={{ uri: attachment.uri }}
        style={[
          styles.thumbnail,
          isUploading && styles.thumbnailUploading,
          isError && styles.thumbnailError,
        ]}
        resizeMode="cover"
      />

      {/* Upload overlay */}
      {isUploading && (
        <View style={styles.uploadOverlay}>
          <ActivityIndicator size="small" color="#FFF" />
          <Text style={styles.uploadPercent}>{uploadPercent}%</Text>
        </View>
      )}

      {/* Error overlay */}
      {isError && (
        <View style={[styles.uploadOverlay, styles.errorOverlay]}>
          <MaterialCommunityIcons name="alert-circle" size={24} color="#FFF" />
        </View>
      )}

      {/* Complete checkmark */}
      {isComplete && (
        <View
          style={[
            styles.completeIcon,
            { backgroundColor: theme.colors.primary },
          ]}
        >
          <MaterialCommunityIcons name="check" size={12} color="#FFF" />
        </View>
      )}

      {/* Remove button */}
      {!disabled && !isUploading && (
        <TouchableOpacity
          style={[styles.removeButton, { backgroundColor: theme.colors.error }]}
          onPress={onRemove}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <MaterialCommunityIcons name="close" size={14} color="#FFF" />
        </TouchableOpacity>
      )}

      {/* View-once indicator */}
      {attachment.viewOnce && (
        <View
          style={[
            styles.viewOnceIndicator,
            { backgroundColor: theme.colors.tertiary },
          ]}
        >
          <MaterialCommunityIcons name="eye-off" size={12} color="#FFF" />
        </View>
      )}
    </View>
  );
});

// =============================================================================
// Main Component
// =============================================================================

export const AttachmentTray = memo(function AttachmentTray({
  attachments,
  uploadProgress,
  isUploading = false,
  onRemove,
  onAdd,
  maxAttachments = DEFAULT_MAX_ATTACHMENTS,
}: AttachmentTrayProps) {
  const theme = useTheme();

  const canAddMore = attachments.length < maxAttachments && !isUploading;

  const handleRemove = useCallback(
    (id: string) => {
      onRemove(id);
    },
    [onRemove],
  );

  if (attachments.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {attachments.map((attachment) => (
          <AttachmentThumbnail
            key={attachment.id}
            attachment={attachment}
            progress={uploadProgress?.[attachment.id]}
            onRemove={() => handleRemove(attachment.id)}
            disabled={isUploading}
          />
        ))}

        {/* Add more button */}
        {canAddMore && onAdd && (
          <TouchableOpacity
            style={[styles.addButton, { borderColor: theme.colors.outline }]}
            onPress={onAdd}
          >
            <MaterialCommunityIcons
              name="plus"
              size={24}
              color={theme.colors.onSurfaceVariant}
            />
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Attachment count */}
      <View style={styles.countContainer}>
        <Text
          style={[styles.countText, { color: theme.colors.onSurfaceVariant }]}
        >
          {attachments.length}/{maxAttachments}
        </Text>
      </View>
    </View>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  thumbnailContainer: {
    position: "relative",
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: 8,
    overflow: "hidden",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },
  thumbnailUploading: {
    opacity: 0.6,
  },
  thumbnailError: {
    opacity: 0.4,
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  errorOverlay: {
    backgroundColor: "rgba(255,0,0,0.5)",
  },
  uploadPercent: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
  removeButton: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  completeIcon: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  viewOnceIndicator: {
    position: "absolute",
    bottom: 4,
    left: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  addButton: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  countContainer: {
    position: "absolute",
    top: 8,
    right: 12,
  },
  countText: {
    fontSize: 11,
    fontWeight: "500",
  },
});

export default AttachmentTray;
