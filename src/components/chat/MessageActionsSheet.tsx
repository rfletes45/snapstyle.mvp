/**
 * MessageActionsSheet Component (H7)
 *
 * Bottom sheet for message actions:
 * - Quick reactions (H8)
 * - Reply (triggers reply state)
 * - Edit (own messages within window)
 * - Delete for me
 * - Delete for everyone (sender or admin)
 * - Copy text
 *
 * @module components/chat/MessageActionsSheet
 */

import {
  canDeleteForAll,
  canDeleteForMe,
  canEditMessage,
  deleteMessageForAll,
  deleteMessageForMe,
  editMessage,
} from "@/services/messageActions";
import { toggleReaction } from "@/services/reactions";
import { MessageV2, ReplyToMetadata } from "@/types/messaging";
import React, { useCallback, useState } from "react";
import {
  Alert,
  Clipboard,
  Modal,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Button,
  IconButton,
  Text,
  useTheme,
} from "react-native-paper";
import { BorderRadius, Spacing } from "../../../constants/theme";
import { QuickReactionBar } from "./ReactionBar";

// =============================================================================
// Types
// =============================================================================

interface MessageActionsSheetProps {
  /** Whether the sheet is visible */
  visible: boolean;
  /** The message to act on */
  message: MessageV2 | null;
  /** Current user ID */
  currentUid: string;
  /** Current user's role in group (for delete permissions) */
  userRole?: "owner" | "admin" | "moderator" | "member";
  /** Called when sheet should close */
  onClose: () => void;
  /** Called when reply is selected */
  onReply: (replyTo: ReplyToMetadata) => void;
  /** Called after message is edited */
  onEdited?: (messageId: string, newText: string) => void;
  /** Called after message is deleted */
  onDeleted?: (messageId: string, forAll: boolean) => void;
  /** Called after reaction is added (H8) */
  onReactionAdded?: (emoji: string) => void;
}

// =============================================================================
// Component
// =============================================================================

export function MessageActionsSheet({
  visible,
  message,
  currentUid,
  userRole,
  onClose,
  onReply,
  onEdited,
  onDeleted,
  onReactionAdded,
}: MessageActionsSheetProps) {
  const theme = useTheme();

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reactionLoading, setReactionLoading] = useState(false);

  // Reset state when sheet closes
  React.useEffect(() => {
    if (!visible) {
      setIsEditing(false);
      setEditText("");
      setIsSubmitting(false);
      setReactionLoading(false);
    }
  }, [visible]);

  // Set edit text when editing starts
  React.useEffect(() => {
    if (isEditing && message?.text) {
      setEditText(message.text);
    }
  }, [isEditing, message?.text]);

  // H8: Handle quick reaction
  const handleQuickReaction = useCallback(
    async (emoji: string) => {
      if (!message || reactionLoading) return;

      setReactionLoading(true);
      try {
        const result = await toggleReaction({
          scope: message.scope,
          conversationId: message.conversationId,
          messageId: message.id,
          emoji,
          uid: currentUid,
        });

        if (result.success) {
          onReactionAdded?.(emoji);
          onClose();
        } else {
          Alert.alert("Error", result.error || "Failed to add reaction");
        }
      } catch (error) {
        console.error("[MessageActionsSheet] Reaction failed:", error);
        Alert.alert("Error", "Failed to add reaction");
      } finally {
        setReactionLoading(false);
      }
    },
    [message, currentUid, reactionLoading, onReactionAdded, onClose],
  );

  // Permission checks
  const editPermission = message
    ? canEditMessage(message, currentUid)
    : { canEdit: false };
  const deleteAllPermission = message
    ? canDeleteForAll(message, currentUid, userRole)
    : { canDelete: false };
  const deleteMePermission = message
    ? canDeleteForMe(message, currentUid)
    : { canDelete: false };

  // Handlers
  const handleReply = useCallback(() => {
    if (!message) return;

    const replyTo: ReplyToMetadata = {
      messageId: message.id,
      senderId: message.senderId,
      senderName: message.senderName,
      kind: message.kind,
      textSnippet: message.text
        ? message.text.length > 100
          ? message.text.substring(0, 100) + "..."
          : message.text
        : undefined,
      attachmentPreview:
        message.attachments && message.attachments.length > 0
          ? {
              kind: message.attachments[0].kind,
              thumbUrl: message.attachments[0].thumbUrl,
            }
          : undefined,
    };

    onReply(replyTo);
    onClose();
  }, [message, onReply, onClose]);

  const handleCopyText = useCallback(() => {
    if (!message?.text) return;

    if (Platform.OS === "web") {
      navigator.clipboard.writeText(message.text);
    } else {
      Clipboard.setString(message.text);
    }

    onClose();
  }, [message, onClose]);

  const handleStartEdit = useCallback(() => {
    if (!message?.text) return;
    setIsEditing(true);
  }, [message]);

  const handleSubmitEdit = useCallback(async () => {
    if (!message || !editText.trim()) return;

    // Don't submit if text hasn't changed
    if (editText.trim() === message.text) {
      setIsEditing(false);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await editMessage({
        scope: message.scope,
        conversationId: message.conversationId,
        messageId: message.id,
        newText: editText.trim(),
      });

      if (result.success) {
        onEdited?.(message.id, editText.trim());
        onClose();
      } else {
        Alert.alert("Edit Failed", result.error || "Could not edit message");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to edit message");
    } finally {
      setIsSubmitting(false);
    }
  }, [message, editText, onEdited, onClose]);

  const handleDeleteForMe = useCallback(async () => {
    if (!message) return;

    Alert.alert(
      "Delete for Me",
      "This message will be hidden from your view only. Others can still see it.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsSubmitting(true);
            try {
              const result = await deleteMessageForMe(
                {
                  scope: message.scope,
                  conversationId: message.conversationId,
                  messageId: message.id,
                },
                currentUid,
              );

              if (result.success) {
                onDeleted?.(message.id, false);
                onClose();
              } else {
                Alert.alert(
                  "Delete Failed",
                  result.error || "Could not delete message",
                );
              }
            } catch (error) {
              Alert.alert("Error", "Failed to delete message");
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ],
    );
  }, [message, currentUid, onDeleted, onClose]);

  const handleDeleteForAll = useCallback(async () => {
    if (!message) return;

    Alert.alert(
      "Delete for Everyone",
      "This message will be permanently deleted for all participants.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsSubmitting(true);
            try {
              const result = await deleteMessageForAll({
                scope: message.scope,
                conversationId: message.conversationId,
                messageId: message.id,
              });

              if (result.success) {
                onDeleted?.(message.id, true);
                onClose();
              } else {
                Alert.alert(
                  "Delete Failed",
                  result.error || "Could not delete message",
                );
              }
            } catch (error) {
              Alert.alert("Error", "Failed to delete message");
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ],
    );
  }, [message, onDeleted, onClose]);

  if (!message) return null;

  // Edit mode UI
  if (isEditing) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
        <View
          style={[
            styles.editContainer,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <View style={styles.editHeader}>
            <Text variant="titleMedium">Edit Message</Text>
            <IconButton icon="close" onPress={() => setIsEditing(false)} />
          </View>
          <TextInput
            style={[
              styles.editInput,
              {
                backgroundColor: theme.colors.surfaceVariant,
                color: theme.colors.onSurface,
              },
            ]}
            value={editText}
            onChangeText={setEditText}
            multiline
            maxLength={10000}
            autoFocus
            placeholder="Edit your message..."
            placeholderTextColor={theme.colors.onSurfaceVariant}
          />
          <View style={styles.editActions}>
            <Button mode="outlined" onPress={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleSubmitEdit}
              disabled={!editText.trim() || isSubmitting}
              loading={isSubmitting}
            >
              Save
            </Button>
          </View>
        </View>
      </Modal>
    );
  }

  // Action sheet UI
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>
      <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
        {/* Handle bar */}
        <View
          style={[
            styles.handleBar,
            { backgroundColor: theme.colors.outlineVariant },
          ]}
        />

        {/* H8: Quick Reaction Bar */}
        <View style={styles.quickReactionContainer}>
          <QuickReactionBar onSelect={handleQuickReaction} />
          {reactionLoading && (
            <ActivityIndicator
              size="small"
              style={styles.reactionLoading}
              color={theme.colors.primary}
            />
          )}
        </View>

        {/* Message preview */}
        <View style={styles.previewContainer}>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
            numberOfLines={2}
          >
            {message.text || "[Media message]"}
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {/* Reply */}
          <ActionButton
            icon="reply"
            label="Reply"
            onPress={handleReply}
            theme={theme}
          />

          {/* Copy (text messages only) */}
          {message.kind === "text" && message.text && (
            <ActionButton
              icon="content-copy"
              label="Copy"
              onPress={handleCopyText}
              theme={theme}
            />
          )}

          {/* Edit (own messages within window) */}
          {editPermission.canEdit && (
            <ActionButton
              icon="pencil"
              label="Edit"
              onPress={handleStartEdit}
              theme={theme}
            />
          )}

          {/* Delete for me */}
          {deleteMePermission.canDelete && (
            <ActionButton
              icon="eye-off"
              label="Delete for me"
              onPress={handleDeleteForMe}
              theme={theme}
              destructive
            />
          )}

          {/* Delete for everyone */}
          {deleteAllPermission.canDelete && (
            <ActionButton
              icon="delete"
              label="Delete for everyone"
              onPress={handleDeleteForAll}
              theme={theme}
              destructive
            />
          )}
        </View>

        {/* Loading overlay */}
        {isSubmitting && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" />
          </View>
        )}
      </View>
    </Modal>
  );
}

// =============================================================================
// Action Button Component
// =============================================================================

interface ActionButtonProps {
  icon: string;
  label: string;
  onPress: () => void;
  theme: {
    colors: {
      error: string;
      onSurface: string;
    };
  };
  destructive?: boolean;
}

function ActionButton({
  icon,
  label,
  onPress,
  theme,
  destructive,
}: ActionButtonProps) {
  return (
    <TouchableOpacity
      style={styles.actionButton}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <IconButton
        icon={icon}
        size={24}
        iconColor={destructive ? theme.colors.error : theme.colors.onSurface}
        style={styles.actionIcon}
      />
      <Text
        variant="bodyMedium"
        style={{
          color: destructive ? theme.colors.error : theme.colors.onSurface,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingBottom: Spacing.xl + 20, // Safe area
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  quickReactionContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  reactionLoading: {
    marginLeft: Spacing.sm,
  },
  previewContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.1)",
  },
  actions: {
    paddingTop: Spacing.sm,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  actionIcon: {
    margin: 0,
    marginRight: Spacing.sm,
  },
  editContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingBottom: Spacing.xl + 20,
    elevation: 8,
  },
  editHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  editInput: {
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    minHeight: 100,
    maxHeight: 200,
    textAlignVertical: "top",
    fontSize: 16,
  },
  editActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
});

export default MessageActionsSheet;
