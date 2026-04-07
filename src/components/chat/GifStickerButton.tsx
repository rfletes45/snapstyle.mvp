/**
 * GifStickerButton
 *
 * Combined GIF + Sticker toolbar button. Opens the GifStickerPicker
 * modal with a tabbed interface for browsing both GIFs and Stickers
 * in a single entry point.
 *
 * Follows the same pattern as GifButton and StickerButton:
 * - 40×40 touch target, 24px icon
 * - Keyboard-replacement coordination via useComposerSheet()
 * - Imperative sheet ref for controlling picker
 * - Lifecycle cleanup on unmount
 *
 * @module components/chat/GifStickerButton
 */

import { useComposerSheet } from "@/contexts/ComposerSheetContext";
import type { GifItem } from "@/services/gif/types";
import type { StickerItem } from "@/services/sticker/types";
import * as Haptics from "expo-haptics";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import { IconButton, useTheme } from "react-native-paper";

import type { DraggableBottomSheetHandle } from "./DraggableBottomSheet";
import { GifStickerPicker } from "./GifStickerPicker";

// =============================================================================
// Types
// =============================================================================

export interface GifStickerButtonProps {
  /** Called when a GIF is selected from the picker. */
  onGifSelected: (gif: GifItem) => void;
  /** Called when a sticker is selected from the picker. */
  onStickerSelected: (sticker: StickerItem) => void;
  /** Button size in pixels. */
  size?: number;
}

// =============================================================================
// Component
// =============================================================================

function GifStickerButtonBase({
  onGifSelected,
  onStickerSelected,
  size = 24,
}: GifStickerButtonProps) {
  const theme = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const sheetRef = useRef<DraggableBottomSheetHandle>(null);
  const {
    activateSheet,
    deactivateSheet,
    lastKeyboardHeight,
    sheetTranslateY,
  } = useComposerSheet();

  // Track open state in a ref so the unmount cleanup can access it
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

  const handleGifSelected = useCallback(
    (gif: GifItem) => {
      onGifSelected(gif);
    },
    [onGifSelected],
  );

  const handleStickerSelected = useCallback(
    (sticker: StickerItem) => {
      onStickerSelected(sticker);
    },
    [onStickerSelected],
  );

  return (
    <>
      <IconButton
        icon="image-multiple"
        size={size}
        iconColor={theme.colors.onSurfaceVariant}
        onPress={handlePress}
        style={styles.button}
        accessibilityLabel="Open GIF and Sticker picker"
        accessibilityRole="button"
      />
      <GifStickerPicker
        ref={sheetRef}
        open={pickerOpen}
        onClose={handleClose}
        onGifSelected={handleGifSelected}
        onStickerSelected={handleStickerSelected}
        keyboardHeight={lastKeyboardHeight}
        sharedTranslateY={sheetTranslateY}
      />
    </>
  );
}

export const GifStickerButton = memo(GifStickerButtonBase);

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
