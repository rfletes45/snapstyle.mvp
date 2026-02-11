/**
 * DeleteConfirmDialog Component
 *
 * Confirmation dialog before deleting a conversation.
 * Shows appropriate messaging for DMs vs Groups and warns
 * about data loss.
 *
 * @module components/chat/inbox/DeleteConfirmDialog
 */

import { useAppTheme } from "@/store/ThemeContext";
import { warning as hapticWarning } from "@/utils/haptics";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo } from "react";
import {
  Modal,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Button, Text } from "react-native-paper";
import { BorderRadius, Spacing } from "@/constants/theme";

// =============================================================================
// Types
// =============================================================================

export interface DeleteConfirmDialogProps {
  /** Whether the dialog is visible */
  visible: boolean;
  /** Callback to close the dialog */
  onClose: () => void;
  /** Called when delete is confirmed */
  onConfirm: () => void;
  /** Name of the conversation to delete */
  conversationName: string;
  /** Whether this is a group conversation */
  isGroup: boolean;
  /** Whether delete is currently in progress */
  loading?: boolean;
}

// =============================================================================
// Component
// =============================================================================

export const DeleteConfirmDialog = memo(function DeleteConfirmDialog({
  visible,
  onClose,
  onConfirm,
  conversationName,
  isGroup,
  loading = false,
}: DeleteConfirmDialogProps) {
  const { colors } = useAppTheme();

  const handleConfirm = () => {
    hapticWarning();
    onConfirm();
  };

  const title = isGroup ? "Leave and Delete Group?" : "Delete Conversation?";

  const message = isGroup
    ? `Are you sure you want to leave "${conversationName}"? You will lose access to all messages and will need to be re-invited to rejoin.`
    : `Are you sure you want to delete your conversation with "${conversationName}"? This will remove the conversation from your inbox. The other person will still have their copy.`;

  const confirmText = isGroup ? "Leave Group" : "Delete";

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.dialog, { backgroundColor: colors.surface }]}>
              {/* Icon */}
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: colors.error + "20" },
                ]}
              >
                <MaterialCommunityIcons
                  name={isGroup ? "exit-run" : "delete-outline"}
                  size={32}
                  color={colors.error}
                />
              </View>

              {/* Content */}
              <Text style={[styles.title, { color: colors.text }]}>
                {title}
              </Text>
              <Text style={[styles.message, { color: colors.textSecondary }]}>
                {message}
              </Text>

              {/* Warning for groups */}
              {isGroup && (
                <View
                  style={[
                    styles.warning,
                    { backgroundColor: colors.warning + "15" },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="alert-outline"
                    size={18}
                    color={colors.warning}
                  />
                  <Text style={[styles.warningText, { color: colors.warning }]}>
                    This action cannot be undone
                  </Text>
                </View>
              )}

              {/* Actions */}
              <View style={styles.actions}>
                <Button
                  mode="outlined"
                  onPress={onClose}
                  style={styles.button}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={handleConfirm}
                  style={[styles.button, styles.confirmButton]}
                  buttonColor={colors.error}
                  loading={loading}
                  disabled={loading}
                >
                  {confirmText}
                </Button>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  dialog: {
    width: "100%",
    maxWidth: 340,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: "center",
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  message: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  warning: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.lg,
  },
  warningText: {
    fontSize: 13,
    fontWeight: "500",
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.md,
    width: "100%",
    marginTop: Spacing.sm,
  },
  button: {
    flex: 1,
  },
  confirmButton: {
    // Destructive red styling handled via buttonColor prop
  },
});
