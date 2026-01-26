/**
 * Block User Modal
 */

import React, { useState } from "react";
import { StyleSheet } from "react-native";
import { Button, Dialog, Portal, Text, TextInput } from "react-native-paper";

interface BlockUserModalProps {
  visible: boolean;
  username: string;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function BlockUserModal({
  visible,
  username,
  onConfirm,
  onCancel,
  loading = false,
}: BlockUserModalProps) {
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    onConfirm(reason.trim() || undefined);
    setReason("");
  };

  const handleCancel = () => {
    setReason("");
    onCancel();
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={handleCancel}>
        <Dialog.Title>Block {username}?</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium" style={styles.warningText}>
            When you block someone:
          </Text>
          <Text variant="bodySmall" style={styles.bulletPoint}>
            • They won't be able to send you messages
          </Text>
          <Text variant="bodySmall" style={styles.bulletPoint}>
            • They won't be able to send friend requests
          </Text>
          <Text variant="bodySmall" style={styles.bulletPoint}>
            • Your friendship will be removed
          </Text>
          <Text variant="bodySmall" style={styles.bulletPoint}>
            • They won't be notified
          </Text>

          <Text variant="bodyMedium" style={styles.reasonLabel}>
            Reason (optional):
          </Text>
          <TextInput
            mode="outlined"
            placeholder="Why are you blocking this user?"
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={2}
            style={styles.reasonInput}
          />
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={handleCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            onPress={handleConfirm}
            loading={loading}
            disabled={loading}
            textColor="#d32f2f"
          >
            Block
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  warningText: {
    marginBottom: 8,
    fontWeight: "600",
  },
  bulletPoint: {
    marginLeft: 8,
    marginBottom: 4,
    opacity: 0.8,
  },
  reasonLabel: {
    marginTop: 16,
    marginBottom: 8,
  },
  reasonInput: {
    backgroundColor: "#fff",
  },
});
