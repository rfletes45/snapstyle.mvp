/**
 * GifButton
 *
 * Opens the GIF picker (KLIPY-powered) and calls onGifSelected
 * when a GIF is chosen. Follows the exact same pattern as EmojiButton.
 *
 * When opened, the picker acts as a keyboard replacement: it opens to the
 * same height as the keyboard, and the composer follows it upward.
 *
 * Designed for use as a toolbar item in the composer drag toolbar.
 * - 40×40 touch target, 24px icon
 * - Material Community Icons "gif" icon
 * - Haptic feedback on press
 *
 * @module components/chat/GifButton
 */

import { useComposerSheet } from "@/contexts/ComposerSheetContext";
import type { GifItem } from "@/services/gif/types";
import * as Haptics from "expo-haptics";
import React, { memo, useCallback, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import { IconButton, useTheme } from "react-native-paper";

import type { DraggableBottomSheetHandle } from "./DraggableBottomSheet";
import { GifPicker } from "./GifPicker";

// =============================================================================
// Types
// =============================================================================

export interface GifButtonProps {
  /** Called when a GIF is selected from the picker. */
  onGifSelected: (gif: GifItem) => void;
  /** Button size in pixels. */
  size?: number;
}

// =============================================================================
// Component
// =============================================================================

function GifButtonBase({ onGifSelected, size = 24 }: GifButtonProps) {
  const theme = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const sheetRef = useRef<DraggableBottomSheetHandle>(null);
  const {
    activateSheet,
    deactivateSheet,
    lastKeyboardHeight,
    sheetTranslateY,
  } = useComposerSheet();

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    activateSheet();
    setPickerOpen(true);
  }, [activateSheet]);

  const handleClose = useCallback(() => {
    setPickerOpen(false);
    deactivateSheet();
  }, [deactivateSheet]);

  const handleGifSelected = useCallback(
    (gif: GifItem) => {
      onGifSelected(gif);
      // Picker auto-closes on selection (handled in GifPicker)
    },
    [onGifSelected],
  );

  return (
    <>
      <IconButton
        icon="file-gif-box"
        size={size}
        iconColor={theme.colors.onSurfaceVariant}
        onPress={handlePress}
        style={styles.button}
        accessibilityLabel="Open GIF picker"
        accessibilityRole="button"
      />
      <GifPicker
        ref={sheetRef}
        open={pickerOpen}
        onClose={handleClose}
        onGifSelected={handleGifSelected}
        keyboardHeight={lastKeyboardHeight}
        sharedTranslateY={sheetTranslateY}
      />
    </>
  );
}

export const GifButton = memo(GifButtonBase);

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
