/**
 * EmojiButton
 *
 * Opens the emoji picker and inserts the selected emoji into the text input.
 * Reuses the existing FullEmojiPicker component (rn-emoji-keyboard).
 * Can be added as an optional toolbar item.
 *
 * When opened, the picker acts as a keyboard replacement: it opens to the
 * same height as the keyboard, and the composer follows it upward.
 *
 * @module components/chat/EmojiButton
 */

import { useComposerSheet } from "@/contexts/ComposerSheetContext";
import * as Haptics from "expo-haptics";
import React, { memo, useCallback, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import { IconButton, useTheme } from "react-native-paper";

import type { DraggableBottomSheetHandle } from "./DraggableBottomSheet";
import { FullEmojiPicker } from "./FullEmojiPicker";

// =============================================================================
// Types
// =============================================================================

export interface EmojiButtonProps {
  /** Called when an emoji is selected. The parent should insert it at cursor. */
  onEmojiSelected: (emoji: string) => void;
  /** Button size in pixels. */
  size?: number;
}

// =============================================================================
// Component
// =============================================================================

function EmojiButtonBase({ onEmojiSelected, size = 24 }: EmojiButtonProps) {
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    activateSheet();
    setPickerOpen(true);
  }, [activateSheet]);

  const handleClose = useCallback(() => {
    setPickerOpen(false);
    deactivateSheet();
  }, [deactivateSheet]);

  const handleEmojiSelected = useCallback(
    (emoji: string) => {
      onEmojiSelected(emoji);
      // Keep picker open so user can select multiple emojis quickly
    },
    [onEmojiSelected],
  );

  return (
    <>
      <IconButton
        icon="emoticon-happy-outline"
        size={size}
        iconColor={theme.colors.onSurfaceVariant}
        onPress={handlePress}
        style={styles.button}
        accessibilityLabel="Open emoji picker"
        accessibilityRole="button"
      />
      <FullEmojiPicker
        ref={sheetRef}
        open={pickerOpen}
        onClose={handleClose}
        onEmojiSelected={handleEmojiSelected}
        keyboardHeight={lastKeyboardHeight}
        sharedTranslateY={sheetTranslateY}
      />
    </>
  );
}

export const EmojiButton = memo(EmojiButtonBase);

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
