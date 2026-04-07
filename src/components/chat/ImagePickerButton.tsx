/**
 * ImagePickerButton
 *
 * Composer toolbar button that opens the user's photo library for
 * selecting and sending images. Reuses the existing expo-image-picker
 * integration and permission-handling patterns.
 *
 * When tapped, requests photo library permissions and launches the
 * system image picker. Selected images are handed to the onImagesPicked
 * callback for immediate send (matching the camera long-press behavior).
 *
 * The button handles:
 * - Permission requests (with denied-state alert)
 * - Single or multi-image selection
 * - Cancelled selection (no-op, no error)
 * - Platform routing (web file picker vs native image picker)
 *
 * Designed for use as a toolbar item in the composer drag toolbar.
 * - 40×40 touch target, 24px icon
 * - Material Community Icons "image-outline"
 * - Haptic feedback on press
 *
 * @module components/chat/ImagePickerButton
 */

import { createLogger } from "@/utils/log";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import React, { memo, useCallback } from "react";
import { Alert, Platform, StyleSheet } from "react-native";
import { IconButton, useTheme } from "react-native-paper";

const log = createLogger("ImagePickerButton");

// =============================================================================
// Types
// =============================================================================

export interface ImagePickerButtonProps {
  /** Called with selected image URIs for immediate send. */
  onImagesPicked: (imageUris: string[]) => void;
  /** Whether the button is disabled (e.g. during send, max attachments). */
  disabled?: boolean;
  /** Maximum number of images to select. Defaults to 10. */
  maxImages?: number;
  /** Button size in pixels. */
  size?: number;
}

// =============================================================================
// Component
// =============================================================================

function ImagePickerButtonBase({
  onImagesPicked,
  disabled = false,
  maxImages = 10,
  size = 24,
}: ImagePickerButtonProps) {
  const theme = useTheme();

  const handlePress = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    try {
      // Web platform: launch file picker directly (no permissions needed)
      if (Platform.OS === "web") {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsMultipleSelection: true,
          selectionLimit: maxImages,
          quality: 1,
          exif: false,
        });

        if (result.canceled || !result.assets || result.assets.length === 0) {
          log.debug("Image selection cancelled (web)");
          return;
        }

        const uris = result.assets.map((a) => a.uri);
        log.debug(`Selected ${uris.length} image(s) from web picker`);
        onImagesPicked(uris);
        return;
      }

      // Native platforms: request permissions first
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Photo library access is needed to select images. You can enable it in Settings.",
          [{ text: "OK" }],
        );
        return;
      }

      // Launch native image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: maxImages,
        quality: 1,
        exif: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        log.debug("Image selection cancelled");
        return;
      }

      const uris = result.assets.map((a) => a.uri);
      log.debug(`Selected ${uris.length} image(s) from gallery`);
      onImagesPicked(uris);
    } catch (error) {
      log.error("Image picker error", error);
      Alert.alert("Error", "Failed to open photo library. Please try again.");
    }
  }, [onImagesPicked, maxImages]);

  return (
    <IconButton
      icon="image-outline"
      size={size}
      iconColor={theme.colors.onSurfaceVariant}
      onPress={handlePress}
      disabled={disabled}
      style={styles.button}
      accessibilityLabel="Pick photos from library"
      accessibilityRole="button"
    />
  );
}

export const ImagePickerButton = memo(ImagePickerButtonBase);

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  button: {
    margin: 0,
    width: 40,
    height: 40,
  },
});
