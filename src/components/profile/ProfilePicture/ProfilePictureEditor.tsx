/**
 * ProfilePictureEditor - Modal for editing profile picture
 *
 * Allows users to:
 * - Upload a new picture from device library
 * - Take a new photo with camera
 * - Remove current picture
 *
 * @module components/profile/ProfilePicture/ProfilePictureEditor
 */

import {
  removeProfilePicture,
  uploadProfilePicture,
} from "@/services/profileService";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
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
import { ProfilePictureWithDecoration } from "./ProfilePictureWithDecoration";


import { createLogger } from "@/utils/log";
const logger = createLogger("components/profile/ProfilePicture/ProfilePictureEditor");
export interface ProfilePictureEditorProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called to close the modal */
  onClose: () => void;
  /** User's ID */
  userId: string;
  /** Current profile picture URL */
  currentPictureUrl: string | null;
  /** Current thumbnail URL */
  currentThumbnailUrl?: string | null;
  /** User's name for fallback */
  name: string;
  /** Current decoration ID */
  decorationId?: string | null;
  /** Called when picture is updated */
  onPictureUpdated?: (url: string, thumbnailUrl: string) => void;
  /** Called when picture is removed */
  onPictureRemoved?: () => void;
  /** Called when user wants to edit decorations */
  onDecorationPress?: () => void;
}

export function ProfilePictureEditor({
  visible,
  onClose,
  userId,
  currentPictureUrl,
  currentThumbnailUrl,
  name,
  decorationId,
  onPictureUpdated,
  onPictureRemoved,
  onDecorationPress,
}: ProfilePictureEditorProps) {
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
  const [loadingMessage, setLoadingMessage] = useState("");

  // Request camera permissions
  const requestCameraPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Camera Permission",
        "We need camera access to take a profile photo.",
        [{ text: "OK" }],
      );
      return false;
    }
    return true;
  };

  // Request media library permissions
  const requestMediaLibraryPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Photo Library Permission",
        "We need access to your photos to select a profile picture.",
        [{ text: "OK" }],
      );
      return false;
    }
    return true;
  };

  // Handle taking a photo with camera
  const handleTakePhoto = useCallback(async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadPhoto(result.assets[0].uri);
      }
    } catch (error) {
      logger.error("Error taking photo:", error);
      Alert.alert("Error", "Failed to take photo. Please try again.");
    }
  }, [userId]);

  // Handle selecting from library
  const handleChooseFromLibrary = useCallback(async () => {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadPhoto(result.assets[0].uri);
      }
    } catch (error) {
      logger.error("Error selecting photo:", error);
      Alert.alert("Error", "Failed to select photo. Please try again.");
    }
  }, [userId]);

  // Upload photo to Firebase
  const uploadPhoto = async (uri: string) => {
    setIsLoading(true);
    setLoadingMessage("Uploading photo...");

    try {
      const { url, thumbnailUrl } = await uploadProfilePicture(userId, uri);
      onPictureUpdated?.(url, thumbnailUrl);
      onClose();
    } catch (error) {
      logger.error("Error uploading photo:", error);
      Alert.alert("Upload Failed", "Failed to upload photo. Please try again.");
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  // Handle removing profile picture
  const handleRemovePicture = useCallback(async () => {
    Alert.alert(
      "Remove Profile Picture",
      "Are you sure you want to remove your profile picture?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setIsLoading(true);
            setLoadingMessage("Removing photo...");

            try {
              await removeProfilePicture(userId);
              onPictureRemoved?.();
              onClose();
            } catch (error) {
              logger.error("Error removing photo:", error);
              Alert.alert("Error", "Failed to remove photo. Please try again.");
            } finally {
              setIsLoading(false);
              setLoadingMessage("");
            }
          },
        },
      ],
    );
  }, [userId, onPictureRemoved, onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={colors.text} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>
            Profile Picture
          </Text>
          <View style={styles.closeButton} />
        </View>

        {/* Current Picture Preview */}
        <View style={styles.previewContainer}>
          <ProfilePictureWithDecoration
            pictureUrl={currentPictureUrl}
            thumbnailUrl={currentThumbnailUrl}
            name={name}
            decorationId={decorationId}
            size={160}
          />
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          {/* Take Photo */}
          <Pressable
            onPress={handleTakePhoto}
            disabled={isLoading}
            style={({ pressed }) => [
              styles.actionButton,
              { backgroundColor: colors.surfaceVariant },
              pressed && styles.actionPressed,
            ]}
          >
            <View
              style={[styles.actionIcon, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="camera" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={[styles.actionTitle, { color: colors.text }]}>
                Take Photo
              </Text>
              <Text
                style={[styles.actionSubtitle, { color: colors.textSecondary }]}
              >
                Use your camera
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>

          {/* Choose from Library */}
          <Pressable
            onPress={handleChooseFromLibrary}
            disabled={isLoading}
            style={({ pressed }) => [
              styles.actionButton,
              { backgroundColor: colors.surfaceVariant },
              pressed && styles.actionPressed,
            ]}
          >
            <View
              style={[
                styles.actionIcon,
                { backgroundColor: colors.secondary || "#8B5CF6" },
              ]}
            >
              <Ionicons name="images" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={[styles.actionTitle, { color: colors.text }]}>
                Choose from Library
              </Text>
              <Text
                style={[styles.actionSubtitle, { color: colors.textSecondary }]}
              >
                Select an existing photo
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>

          {/* Edit Decoration */}
          {onDecorationPress && (
            <Pressable
              onPress={onDecorationPress}
              disabled={isLoading}
              style={({ pressed }) => [
                styles.actionButton,
                { backgroundColor: colors.surfaceVariant },
                pressed && styles.actionPressed,
              ]}
            >
              <View style={[styles.actionIcon, { backgroundColor: "#F59E0B" }]}>
                <Ionicons name="sparkles" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.actionTextContainer}>
                <Text style={[styles.actionTitle, { color: colors.text }]}>
                  Edit Decoration
                </Text>
                <Text
                  style={[
                    styles.actionSubtitle,
                    { color: colors.textSecondary },
                  ]}
                >
                  Add frames and effects (320×320 PNG/GIF)
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.textSecondary}
              />
            </Pressable>
          )}

          {/* Remove Picture (only show if there's a picture) */}
          {currentPictureUrl && (
            <Pressable
              onPress={handleRemovePicture}
              disabled={isLoading}
              style={({ pressed }) => [
                styles.actionButton,
                { backgroundColor: colors.surfaceVariant },
                pressed && styles.actionPressed,
              ]}
            >
              <View
                style={[
                  styles.actionIcon,
                  { backgroundColor: colors.error || "#EF4444" },
                ]}
              >
                <Ionicons name="trash" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.actionTextContainer}>
                <Text
                  style={[
                    styles.actionTitle,
                    { color: colors.error || "#EF4444" },
                  ]}
                >
                  Remove Picture
                </Text>
                <Text
                  style={[
                    styles.actionSubtitle,
                    { color: colors.textSecondary },
                  ]}
                >
                  Use initials instead
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.textSecondary}
              />
            </Pressable>
          )}
        </View>

        {/* Loading overlay */}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <View
              style={[styles.loadingBox, { backgroundColor: colors.surface }]}
            >
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.text }]}>
                {loadingMessage}
              </Text>
            </View>
          </View>
        )}
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
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  previewContainer: {
    alignItems: "center",
    paddingVertical: 32,
  },
  actionsContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    gap: 16,
  },
  actionPressed: {
    opacity: 0.7,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  actionSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingBox: {
    padding: 24,
    borderRadius: 16,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: "500",
  },
});

export default ProfilePictureEditor;
