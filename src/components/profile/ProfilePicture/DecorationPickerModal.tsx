/**
 * DecorationPickerModal - Full-screen modal for selecting decorations
 *
 * Provides a complete decoration browsing and selection experience.
 * Shows preview of how decoration will look on the user's profile.
 *
 * @module components/profile/ProfilePicture/DecorationPickerModal
 */

import { equipDecoration, unequipDecoration } from "@/services/profileService";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DecorationPicker } from "./DecorationPicker";
import { ProfilePictureWithDecoration } from "./ProfilePictureWithDecoration";


import { createLogger } from "@/utils/log";
const logger = createLogger("components/profile/ProfilePicture/DecorationPickerModal");
export interface DecorationPickerModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called to close the modal */
  onClose: () => void;
  /** User's ID */
  userId: string;
  /** User's profile picture URL */
  pictureUrl: string | null;
  /** User's name for fallback */
  name: string;
  /** IDs of decorations the user owns */
  ownedDecorationIds: string[];
  /** Currently equipped decoration ID */
  currentDecorationId: string | null;
  /** Called when decoration is changed */
  onDecorationChanged?: (decorationId: string | null) => void;
}

export function DecorationPickerModal({
  visible,
  onClose,
  userId,
  pictureUrl,
  name,
  ownedDecorationIds,
  currentDecorationId,
  onDecorationChanged,
}: DecorationPickerModalProps) {
  const theme = useTheme();
  // Map MD3 colors to simpler names for convenience
  const colors = {
    primary: theme.colors.primary,
    secondary: theme.colors.secondary,
    background: theme.colors.background,
    surface: theme.colors.surface,
    surfaceVariant: theme.colors.surfaceVariant,
    text: theme.colors.onSurface,
    textSecondary: theme.colors.onSurfaceVariant,
    border: theme.colors.outline,
    error: theme.colors.error,
  };
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const [previewDecorationId, setPreviewDecorationId] = useState<string | null>(
    currentDecorationId,
  );

  // Handle selecting a decoration (preview)
  const handleSelectDecoration = useCallback((decorationId: string | null) => {
    setPreviewDecorationId(decorationId);
  }, []);

  // Handle confirming the selection
  const handleConfirm = useCallback(async () => {
    if (previewDecorationId === currentDecorationId) {
      onClose();
      return;
    }

    setIsLoading(true);

    try {
      if (previewDecorationId) {
        await equipDecoration(userId, previewDecorationId);
      } else {
        await unequipDecoration(userId);
      }
      onDecorationChanged?.(previewDecorationId);
      onClose();
    } catch (error) {
      logger.error("Error updating decoration:", error);
      Alert.alert("Error", "Failed to update decoration. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [
    userId,
    previewDecorationId,
    currentDecorationId,
    onDecorationChanged,
    onClose,
  ]);

  // Handle canceling (revert preview)
  const handleCancel = useCallback(() => {
    setPreviewDecorationId(currentDecorationId);
    onClose();
  }, [currentDecorationId, onClose]);

  const hasChanges = previewDecorationId !== currentDecorationId;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCancel}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={handleCancel} style={styles.headerButton}>
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>
              Cancel
            </Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>
            Avatar Decoration
          </Text>
          <Pressable
            onPress={handleConfirm}
            disabled={isLoading || !hasChanges}
            style={styles.headerButton}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text
                style={[
                  styles.saveText,
                  {
                    color: hasChanges ? colors.primary : colors.textSecondary,
                  },
                ]}
              >
                Save
              </Text>
            )}
          </Pressable>
        </View>

        {/* Preview */}
        <View
          style={[
            styles.previewSection,
            { backgroundColor: colors.surfaceVariant },
          ]}
        >
          <ProfilePictureWithDecoration
            pictureUrl={pictureUrl}
            name={name}
            decorationId={previewDecorationId}
            size={120}
          />
          <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>
            Preview
          </Text>
        </View>

        {/* Decoration picker */}
        <View style={styles.pickerContainer}>
          <DecorationPicker
            ownedDecorationIds={ownedDecorationIds}
            equippedDecorationId={previewDecorationId}
            onSelect={handleSelectDecoration}
            isSelecting={isLoading}
          />
        </View>

        {/* Info footer */}
        <View
          style={[
            styles.infoFooter,
            { backgroundColor: colors.surfaceVariant },
          ]}
        >
          <Ionicons
            name="information-circle"
            size={20}
            color={colors.primary}
          />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Earn decorations through achievements, events, or purchase them in
            the shop.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerButton: {
    minWidth: 60,
  },
  cancelText: {
    fontSize: 16,
  },
  saveText: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "right",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  previewSection: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 8,
  },
  previewLabel: {
    fontSize: 14,
    marginTop: 8,
  },
  pickerContainer: {
    flex: 1,
  },
  infoFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});

export default DecorationPickerModal;
