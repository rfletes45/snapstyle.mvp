/**
 * Block User Modal — bottom sheet confirmation
 */

import { BorderRadius, Spacing } from "@/constants/theme";
import { useColors } from "@/store/ThemeContext";
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

interface BlockUserModalProps {
  visible: boolean;
  username: string;
  onConfirm: (reason?: string) => void | Promise<void>;
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
  const colors = useColors();
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);

  // Reset state when sheet opens/closes
  useEffect(() => {
    if (!visible) {
      setReason("");
      setConfirming(false);
    }
  }, [visible]);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm(reason.trim() || undefined);
    } finally {
      setConfirming(false);
    }
  };

  const isLoading = loading || confirming;

  return (
    <DraggableBottomSheet
      open={visible}
      onClose={onCancel}
      snapPoints={[0.52]}
      initialSnapIndex={0}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <IconButton
            icon="block-helper"
            size={24}
            iconColor={colors.error}
            style={styles.headerIcon}
          />
          <Text
            variant="titleMedium"
            style={[styles.title, { color: colors.text }]}
          >
            Block {username}?
          </Text>
        </View>

        {/* Info bullets */}
        <View
          style={[styles.infoCard, { backgroundColor: colors.surfaceVariant }]}
        >
          {INFO_ITEMS.map((item, i) => (
            <View key={i} style={styles.bulletRow}>
              <IconButton
                icon={item.icon}
                size={18}
                iconColor={colors.textSecondary}
                style={styles.bulletIcon}
              />
              <Text
                variant="bodyMedium"
                style={[styles.bulletText, { color: colors.textSecondary }]}
              >
                {item.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Optional reason */}
        <Text
          variant="bodySmall"
          style={[styles.reasonLabel, { color: colors.textMuted }]}
        >
          Reason (optional)
        </Text>
        <TextInput
          style={[
            styles.reasonInput,
            {
              backgroundColor: colors.surfaceVariant,
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
          placeholder="Why are you blocking this user?"
          placeholderTextColor={colors.textMuted}
          value={reason}
          onChangeText={setReason}
          multiline
          maxLength={200}
          editable={!isLoading}
        />

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.cancelBtn, { borderColor: colors.border }]}
            onPress={onCancel}
            activeOpacity={0.7}
            disabled={isLoading}
          >
            <Text variant="labelLarge" style={{ color: colors.text }}>
              Cancel
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.blockBtn,
              { backgroundColor: colors.error, opacity: isLoading ? 0.6 : 1 },
            ]}
            onPress={handleConfirm}
            activeOpacity={0.7}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text variant="labelLarge" style={styles.blockBtnText}>
                Block
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </DraggableBottomSheet>
  );
}

const INFO_ITEMS = [
  { icon: "message-off-outline", label: "They can't send you messages" },
  { icon: "account-remove-outline", label: "Your friendship will be removed" },
  { icon: "account-plus-outline", label: "They can't send friend requests" },
  { icon: "bell-off-outline", label: "They won't be notified" },
];

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
  infoCard: {
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
  },
  bulletIcon: {
    margin: 0,
    marginRight: Spacing.xs,
  },
  bulletText: {
    flex: 1,
  },
  reasonLabel: {
    marginBottom: Spacing.xs,
    paddingHorizontal: 2,
  },
  reasonInput: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 15,
    minHeight: 48,
    maxHeight: 80,
    textAlignVertical: "top",
    marginBottom: Spacing.lg,
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
  blockBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  blockBtnText: {
    color: "#fff",
    fontWeight: "600",
  },
});
