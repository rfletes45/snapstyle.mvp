/**
 * StickerButton
 *
 * Opens the sticker picker (KLIPY-powered) and calls onStickerSelected
 * when a sticker is chosen. Follows the exact same pattern as GifButton.
 *
 * When opened, the picker acts as a keyboard replacement: it opens to the
 * same height as the keyboard, and the composer follows it upward.
 *
 * Designed for use as a toolbar item in the composer drag toolbar.
 * - 40×40 touch target, 24px icon
 * - Material Community Icons "sticker-emoji" icon
 * - Haptic feedback on press
 *
 * @module components/chat/StickerButton
 */

import { useComposerSheet } from "@/contexts/ComposerSheetContext";
import type { StickerItem } from "@/services/sticker/types";
import * as Haptics from "expo-haptics";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import { IconButton, useTheme } from "react-native-paper";

import type { DraggableBottomSheetHandle } from "./DraggableBottomSheet";
import { StickerPicker } from "./StickerPicker";

// =============================================================================
// Types
// =============================================================================

export interface StickerButtonProps {
  /** Called when a sticker is selected from the picker. */
  onStickerSelected: (sticker: StickerItem) => void;
  /** Button size in pixels. */
  size?: number;
}

// =============================================================================
// Component
// =============================================================================

function StickerButtonBase({
  onStickerSelected,
  size = 24,
}: StickerButtonProps) {
  const theme = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const sheetRef = useRef<DraggableBottomSheetHandle>(null);
  const {
    activateSheet,
    deactivateSheet,
    lastKeyboardHeight,
    sheetTranslateY,
  } = useComposerSheet();

  const pickerOpenRef = useRef(false);
  pickerOpenRef.current = pickerOpen;

  // Clean up composer sheet if this button unmounts while its picker is open.
  useEffect(() => {
    return () => {
      if (pickerOpenRef.current) {
        deactivateSheet();
      }
    };
  }, [deactivateSheet]);

  const handleClose = useCallback(() => {
    setPickerOpen(false);
    deactivateSheet();
  }, [deactivateSheet]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    activateSheet(undefined, handleClose);
    setPickerOpen(true);
  }, [activateSheet, handleClose]);

  const handleStickerSelected = useCallback(
    (sticker: StickerItem) => {
      onStickerSelected(sticker);
      // Picker auto-closes on selection (handled in StickerPicker)
    },
    [onStickerSelected],
  );

  return (
    <>
      <IconButton
        icon="sticker-emoji"
        size={size}
        iconColor={theme.colors.onSurfaceVariant}
        onPress={handlePress}
        style={styles.button}
        accessibilityLabel="Open sticker picker"
        accessibilityRole="button"
      />
      <StickerPicker
        ref={sheetRef}
        open={pickerOpen}
        onClose={handleClose}
        onStickerSelected={handleStickerSelected}
        keyboardHeight={lastKeyboardHeight}
        sharedTranslateY={sheetTranslateY}
      />
    </>
  );
}

export const StickerButton = memo(StickerButtonBase);

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  button: {
    margin: 0,
  },
});
