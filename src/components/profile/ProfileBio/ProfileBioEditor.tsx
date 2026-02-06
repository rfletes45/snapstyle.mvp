/**
 * ProfileBioEditor Component
 *
 * Modal for editing user's bio text.
 * Includes character counter and validation.
 *
 * @module components/profile/ProfileBio/ProfileBioEditor
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { updateBio } from "@/services/profileService";
import type { ProfileBio } from "@/types/userProfile";

// =============================================================================
// Types
// =============================================================================

export interface ProfileBioEditorProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Current user's ID */
  userId: string;
  /** Current bio data */
  currentBio?: ProfileBio | null;
  /** Handler for closing the modal */
  onClose: () => void;
  /** Handler called after successful save */
  onBioUpdated?: (newBio: ProfileBio) => void;
}

// =============================================================================
// Constants
// =============================================================================

const MAX_BIO_LENGTH = 200;

// =============================================================================
// Component
// =============================================================================

function ProfileBioEditorBase({
  visible,
  userId,
  currentBio,
  onClose,
  onBioUpdated,
}: ProfileBioEditorProps) {
  const theme = useTheme();
  const colors = {
    background: theme.colors.background,
    surface: theme.colors.surface,
    surfaceVariant: theme.colors.surfaceVariant,
    text: theme.colors.onSurface,
    textSecondary: theme.colors.onSurfaceVariant,
    primary: theme.colors.primary,
    error: theme.colors.error,
    border: theme.colors.outline,
  };
  const insets = useSafeAreaInsets();

  const [bioText, setBioText] = useState(currentBio?.text || "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const charactersRemaining = MAX_BIO_LENGTH - bioText.length;
  const isOverLimit = charactersRemaining < 0;
  const hasChanges = bioText !== (currentBio?.text || "");

  // Reset state when modal opens
  const handleShow = useCallback(() => {
    setBioText(currentBio?.text || "");
    setError(null);
  }, [currentBio]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (isOverLimit || !hasChanges) return;

    setIsLoading(true);
    setError(null);

    try {
      await updateBio(userId, bioText.trim());

      const newBio: ProfileBio = {
        text: bioText.trim(),
        updatedAt: Date.now(),
      };

      onBioUpdated?.(newBio);
      onClose();
    } catch (err: any) {
      console.error("Error updating bio:", err);
      setError(err.message || "Failed to update bio");
    } finally {
      setIsLoading(false);
    }
  }, [userId, bioText, isOverLimit, hasChanges, onBioUpdated, onClose]);

  // Handle clear
  const handleClear = useCallback(() => {
    setBioText("");
  }, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      onShow={handleShow}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.surface,
              paddingTop: insets.top || 16,
            },
          ]}
        >
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Text style={[styles.headerButtonText, { color: colors.primary }]}>
              Cancel
            </Text>
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Edit Bio
          </Text>

          <TouchableOpacity
            onPress={handleSave}
            disabled={isLoading || isOverLimit || !hasChanges}
            style={styles.headerButton}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text
                style={[
                  styles.headerButtonText,
                  {
                    color:
                      isOverLimit || !hasChanges
                        ? colors.textSecondary
                        : colors.primary,
                    fontWeight: "600",
                  },
                ]}
              >
                Save
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Text Input */}
          <TextInput
            value={bioText}
            onChangeText={setBioText}
            placeholder="Write something about yourself..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={6}
            maxLength={MAX_BIO_LENGTH + 10} // Allow slight overage for feedback
            style={[
              styles.textInput,
              {
                backgroundColor: colors.surfaceVariant,
                color: colors.text,
              },
            ]}
            contentStyle={styles.textInputContent}
            outlineStyle={styles.textInputOutline}
            mode="outlined"
            outlineColor={isOverLimit ? colors.error : colors.border}
            activeOutlineColor={isOverLimit ? colors.error : colors.primary}
          />

          {/* Character Counter */}
          <View style={styles.counterRow}>
            <Text
              style={[
                styles.counterText,
                { color: isOverLimit ? colors.error : colors.textSecondary },
              ]}
            >
              {charactersRemaining} characters remaining
            </Text>

            {bioText.length > 0 && (
              <TouchableOpacity onPress={handleClear}>
                <Text style={[styles.clearText, { color: colors.primary }]}>
                  Clear
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Error Message */}
          {error && (
            <View
              style={[
                styles.errorContainer,
                { backgroundColor: `${colors.error}20` },
              ]}
            >
              <MaterialCommunityIcons
                name="alert-circle"
                size={18}
                color={colors.error}
              />
              <Text style={[styles.errorText, { color: colors.error }]}>
                {error}
              </Text>
            </View>
          )}

          {/* Tips */}
          <View
            style={[
              styles.tipsContainer,
              { backgroundColor: colors.surfaceVariant },
            ]}
          >
            <Text style={[styles.tipsTitle, { color: colors.text }]}>
              Tips for a great bio:
            </Text>
            <Text style={[styles.tipsText, { color: colors.textSecondary }]}>
              • Keep it short and memorable
            </Text>
            <Text style={[styles.tipsText, { color: colors.textSecondary }]}>
              • Share your interests or hobbies
            </Text>
            <Text style={[styles.tipsText, { color: colors.textSecondary }]}>
              • Add some personality with emojis ✨
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  headerButton: {
    minWidth: 60,
    alignItems: "center",
  },
  headerButtonText: {
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  textInput: {
    fontSize: 16,
    minHeight: 120,
  },
  textInputContent: {
    paddingTop: 12,
  },
  textInputOutline: {
    borderRadius: 12,
  },
  counterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingHorizontal: 4,
  },
  counterText: {
    fontSize: 13,
  },
  clearText: {
    fontSize: 13,
    fontWeight: "500",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
  },
  tipsContainer: {
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
  },
  tipsTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8,
  },
  tipsText: {
    fontSize: 14,
    lineHeight: 22,
  },
});

// =============================================================================
// Export
// =============================================================================

export const ProfileBioEditor = memo(ProfileBioEditorBase);
