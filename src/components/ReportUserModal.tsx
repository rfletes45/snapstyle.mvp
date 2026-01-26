/**
 * Report User Modal
 */

import { REPORT_REASON_LABELS } from "@/services/reporting";
import type { ReportReason } from "@/types/models";
import React, { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import {
  Button,
  Dialog,
  Portal,
  RadioButton,
  Text,
  TextInput,
} from "react-native-paper";

interface ReportUserModalProps {
  visible: boolean;
  username: string;
  onSubmit: (reason: ReportReason, description?: string) => void;
  onCancel: () => void;
  loading?: boolean;
}

const REPORT_REASONS: ReportReason[] = [
  "spam",
  "harassment",
  "inappropriate_content",
  "fake_account",
  "other",
];

export default function ReportUserModal({
  visible,
  username,
  onSubmit,
  onCancel,
  loading = false,
}: ReportUserModalProps) {
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(
    null,
  );
  const [description, setDescription] = useState("");

  const handleSubmit = () => {
    if (!selectedReason) return;
    onSubmit(selectedReason, description.trim() || undefined);
    // Reset state
    setSelectedReason(null);
    setDescription("");
  };

  const handleCancel = () => {
    setSelectedReason(null);
    setDescription("");
    onCancel();
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={handleCancel} style={styles.dialog}>
        <Dialog.Title>Report {username}</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView>
            <Text variant="bodyMedium" style={styles.subtitle}>
              Why are you reporting this user?
            </Text>

            <RadioButton.Group
              onValueChange={(value) =>
                setSelectedReason(value as ReportReason)
              }
              value={selectedReason || ""}
            >
              {REPORT_REASONS.map((reason) => (
                <RadioButton.Item
                  key={reason}
                  label={REPORT_REASON_LABELS[reason]}
                  value={reason}
                  style={styles.radioItem}
                  labelStyle={styles.radioLabel}
                />
              ))}
            </RadioButton.Group>

            <Text variant="bodyMedium" style={styles.descriptionLabel}>
              Additional details (optional):
            </Text>
            <TextInput
              mode="outlined"
              placeholder="Describe what happened..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              style={styles.descriptionInput}
            />

            <Text variant="bodySmall" style={styles.disclaimer}>
              Your report is confidential. We'll review it and take appropriate
              action. False reports may result in action against your account.
            </Text>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={handleCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            onPress={handleSubmit}
            loading={loading}
            disabled={loading || !selectedReason}
            textColor="#d32f2f"
          >
            Submit Report
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    maxHeight: "80%",
  },
  scrollArea: {
    paddingHorizontal: 0,
  },
  subtitle: {
    marginBottom: 12,
    paddingHorizontal: 24,
  },
  radioItem: {
    paddingVertical: 4,
  },
  radioLabel: {
    fontSize: 14,
  },
  descriptionLabel: {
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 24,
  },
  descriptionInput: {
    marginHorizontal: 24,
    backgroundColor: "#fff",
  },
  disclaimer: {
    marginTop: 16,
    marginHorizontal: 24,
    opacity: 0.6,
    fontStyle: "italic",
  },
});
