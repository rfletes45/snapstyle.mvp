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
import React, {
  memo,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { StyleSheet, View } from "react-native";
import { IconButton, useTheme } from "react-native-paper";

import type { DraggableBottomSheetHandle } from "./DraggableBottomSheet";
import { ButtonLoadingOverlay } from "./PickerLoadingFallback";
import {
  getEmojiPickerImport,
  getResolvedEmojiPicker,
  preloadPickerById,
  usePickerPreloadStatus,
} from "./pickerPreload";

const LazyFullEmojiPicker = React.lazy(() => getEmojiPickerImport());

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
  const preloadStatus = usePickerPreloadStatus("emoji");

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
    pickerOpenRef.current = false;
    setPickerOpen(false);
    deactivateSheet();
  }, [deactivateSheet]);

  const handlePress = useCallback(() => {
    if (pickerOpenRef.current) return;
    pickerOpenRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    void preloadPickerById("emoji")?.catch(() => {});
    activateSheet(undefined, handleClose);
    setPickerOpen(true);
  }, [activateSheet, handleClose]);

  useEffect(() => {
    if (pickerOpen && preloadStatus.status === "failed") {
      handleClose();
    }
  }, [handleClose, pickerOpen, preloadStatus.status]);

  const handleEmojiSelected = useCallback(
    (emoji: string) => {
      onEmojiSelected(emoji);
      // Keep picker open so user can select multiple emojis quickly
    },
    [onEmojiSelected],
  );

  const ResolvedPicker = pickerOpen ? getResolvedEmojiPicker() : null;
  const isLoading =
    pickerOpen && !ResolvedPicker && preloadStatus.status !== "failed";

  return (
    <>
      <View>
        <IconButton
          icon="emoticon-happy-outline"
          size={size}
          iconColor={theme.colors.onSurfaceVariant}
          onPress={handlePress}
          style={styles.button}
          accessibilityLabel="Open emoji picker"
          accessibilityRole="button"
        />
        {isLoading && <ButtonLoadingOverlay />}
      </View>
      {pickerOpen &&
        (ResolvedPicker ? (
          <ResolvedPicker
            ref={sheetRef}
            open={pickerOpen}
            onClose={handleClose}
            onEmojiSelected={handleEmojiSelected}
            keyboardHeight={lastKeyboardHeight}
            sharedTranslateY={sheetTranslateY}
          />
        ) : preloadStatus.status !== "failed" ? (
          <Suspense fallback={null}>
            <LazyFullEmojiPicker
              ref={sheetRef}
              open={pickerOpen}
              onClose={handleClose}
              onEmojiSelected={handleEmojiSelected}
              keyboardHeight={lastKeyboardHeight}
              sharedTranslateY={sheetTranslateY}
            />
          </Suspense>
        ) : null)}
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
