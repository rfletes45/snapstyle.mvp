/**
 * Report User Modal — bottom sheet report flow
 */

import { BorderRadius, Spacing } from "@/constants/theme";
import { REPORT_REASON_LABELS } from "@/services/reporting";
import { useColors } from "@/store/ThemeContext";
import type { ReportReason } from "@/types/models";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { IconButton, Text } from "react-native-paper";
import { DraggableBottomSheet } from "./chat/DraggableBottomSheet";

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

const REASON_ICONS: Record<ReportReason, string> = {
  spam: "email-alert-outline",
  harassment: "account-alert-outline",
  inappropriate_content: "image-off-outline",
  fake_account: "account-question-outline",
  other: "dots-horizontal-circle-outline",
};

export default function ReportUserModal({
  visible,
  username,
  onSubmit,
  onCancel,
  loading = false,
}: ReportUserModalProps) {
  const colors = useColors();
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(
    null,
  );
  const [description, setDescription] = useState("");

  // Reset state when sheet opens/closes
  useEffect(() => {
    if (!visible) {
      setSelectedReason(null);
      setDescription("");
    }
  }, [visible]);

  const handleSubmit = () => {
    if (!selectedReason) return;
    onSubmit(selectedReason, description.trim() || undefined);
  };

  return (
    <DraggableBottomSheet
      open={visible}
      onClose={onCancel}
      snapPoints={[0.65]}
      initialSnapIndex={0}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <IconButton
            icon="flag-outline"
            size={24}
            iconColor={colors.error}
            style={styles.headerIcon}
          />
          <Text
            variant="titleMedium"
            style={[styles.title, { color: colors.text }]}
          >
            Report {username}
          </Text>
        </View>

        {/* Reason selection */}
        <Text
          variant="bodySmall"
          style={[styles.sectionLabel, { color: colors.textMuted }]}
        >
          Select a reason
        </Text>
        <View style={styles.reasonList}>
          {REPORT_REASONS.map((reason) => {
            const selected = selectedReason === reason;
            return (
              <TouchableOpacity
                key={reason}
                style={[
                  styles.reasonChip,
                  {
                    backgroundColor: selected
                      ? colors.primaryContainer || colors.primary + "22"
                      : colors.surfaceVariant,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
                activeOpacity={0.7}
                onPress={() => setSelectedReason(reason)}
                disabled={loading}
              >
                <IconButton
                  icon={REASON_ICONS[reason]}
                  size={18}
                  iconColor={selected ? colors.primary : colors.textSecondary}
                  style={styles.chipIcon}
                />
                <Text
                  variant="bodyMedium"
                  style={{
                    color: selected ? colors.primary : colors.text,
                    fontWeight: selected ? "600" : "400",
                  }}
                >
                  {REPORT_REASON_LABELS[reason]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Description */}
        <Text
          variant="bodySmall"
          style={[styles.sectionLabel, { color: colors.textMuted }]}
        >
          Additional details (optional)
        </Text>
        <TextInput
          style={[
            styles.descInput,
            {
              backgroundColor: colors.surfaceVariant,
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
          placeholder="Describe what happened..."
          placeholderTextColor={colors.textMuted}
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={500}
          editable={!loading}
        />

        {/* Disclaimer */}
        <Text
          variant="bodySmall"
          style={[styles.disclaimer, { color: colors.textMuted }]}
        >
          Reports are confidential. We'll review and take appropriate action.
        </Text>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.cancelBtn, { borderColor: colors.border }]}
            onPress={onCancel}
            activeOpacity={0.7}
            disabled={loading}
          >
            <Text variant="labelLarge" style={{ color: colors.text }}>
              Cancel
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.submitBtn,
              {
                backgroundColor:
                  !selectedReason || loading
                    ? colors.surfaceVariant
                    : colors.error,
              },
            ]}
            onPress={handleSubmit}
            activeOpacity={0.7}
            disabled={loading || !selectedReason}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text
                variant="labelLarge"
                style={{
                  color: !selectedReason ? colors.textMuted : "#fff",
                  fontWeight: "600",
                }}
              >
                Submit Report
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </DraggableBottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  headerIcon: {
    margin: 0,
    marginRight: Spacing.xs,
  },
  title: {
    fontWeight: "700",
    fontSize: 18,
  },
  sectionLabel: {
    marginBottom: Spacing.sm,
    paddingHorizontal: 2,
  },
  reasonList: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  reasonChip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingVertical: 4,
    paddingRight: Spacing.md,
  },
  chipIcon: {
    margin: 0,
    marginRight: 2,
  },
  descInput: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 15,
    minHeight: 48,
    maxHeight: 80,
    textAlignVertical: "top",
    marginBottom: Spacing.sm,
  },
  disclaimer: {
    fontStyle: "italic",
    marginBottom: Spacing.lg,
    paddingHorizontal: 2,
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  cancelBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  submitBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
});
