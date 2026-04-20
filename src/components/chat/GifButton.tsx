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
  getGifPickerImport,
  getResolvedGifPicker,
  preloadPickerById,
  usePickerPreloadStatus,
} from "./pickerPreload";

const LazyGifPicker = React.lazy(() => getGifPickerImport());

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
  const preloadStatus = usePickerPreloadStatus("gif");

  // Track open state in a ref so the unmount cleanup can access it
  // without adding pickerOpen to the effect's dependency array.
  const pickerOpenRef = useRef(false);
  pickerOpenRef.current = pickerOpen;

  // If this button unmounts while its picker is open (e.g. toolbar item
  // removed during edit mode), clean up the composer sheet so the
  // composer doesn't get stuck in the raised position.
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
    void preloadPickerById("gif")?.catch(() => {});
    activateSheet(undefined, handleClose);
    setPickerOpen(true);
  }, [activateSheet, handleClose]);

  useEffect(() => {
    if (pickerOpen && preloadStatus.status === "failed") {
      handleClose();
    }
  }, [handleClose, pickerOpen, preloadStatus.status]);

  const handleGifSelected = useCallback(
    (gif: GifItem) => {
      onGifSelected(gif);
      // Picker auto-closes on selection (handled in GifPicker)
    },
    [onGifSelected],
  );

  // Bypass React.lazy + Suspense when the preloaded import has resolved.
  // React.lazy always suspends for at least one microtask even when the
  // promise is settled, producing a 1-frame fallback flash. Reading the
  // resolved ref synchronously eliminates that flash entirely.
  const ResolvedPicker = pickerOpen ? getResolvedGifPicker() : null;
  const isLoading =
    pickerOpen && !ResolvedPicker && preloadStatus.status !== "failed";

  return (
    <>
      <View>
        <IconButton
          icon="file-gif-box"
          size={size}
          iconColor={theme.colors.onSurfaceVariant}
          onPress={handlePress}
          style={styles.button}
          accessibilityLabel="Open GIF picker"
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
            onGifSelected={handleGifSelected}
            keyboardHeight={lastKeyboardHeight}
            sharedTranslateY={sheetTranslateY}
          />
        ) : preloadStatus.status !== "failed" ? (
          <Suspense fallback={null}>
            <LazyGifPicker
              ref={sheetRef}
              open={pickerOpen}
              onClose={handleClose}
              onGifSelected={handleGifSelected}
              keyboardHeight={lastKeyboardHeight}
              sharedTranslateY={sheetTranslateY}
            />
          </Suspense>
        ) : null)}
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
