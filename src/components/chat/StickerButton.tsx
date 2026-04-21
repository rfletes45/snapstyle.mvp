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
import { chatPerf } from "@/utils/chatPerf";
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
  getResolvedStickerPicker,
  getStickerPickerImport,
  preloadPickerById,
  usePickerPreloadStatus,
} from "./pickerPreload";

const LazyStickerPicker = React.lazy(() => getStickerPickerImport());

// =============================================================================
// Types
// =============================================================================

export interface StickerButtonProps {
  /** Called when a sticker is selected from the picker. */
  onStickerSelected: (sticker: StickerItem) => void;
  /** Button size in pixels. */
  size?: number;
  /** Keep the picker tree warm-mounted after chat entry settles. */
  warmMountEnabled?: boolean;
}

// =============================================================================
// Component
// =============================================================================

function StickerButtonBase({
  onStickerSelected,
  size = 24,
  warmMountEnabled = false,
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
  const preloadStatus = usePickerPreloadStatus("sticker");

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
    chatPerf.mark("picker-open:sticker");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    void preloadPickerById("sticker")?.catch(() => {});
    activateSheet(undefined, handleClose);
    setPickerOpen(true);
  }, [activateSheet, handleClose]);

  useEffect(() => {
    if (pickerOpen && preloadStatus.status === "failed") {
      handleClose();
    }
  }, [handleClose, pickerOpen, preloadStatus.status]);

  const handleStickerSelected = useCallback(
    (sticker: StickerItem) => {
      onStickerSelected(sticker);
      // Picker auto-closes on selection (handled in StickerPicker)
    },
    [onStickerSelected],
  );

  const shouldKeepMounted = warmMountEnabled || pickerOpen;
  const ResolvedPicker = shouldKeepMounted ? getResolvedStickerPicker() : null;
  const isLoading =
    pickerOpen && !ResolvedPicker && preloadStatus.status !== "failed";

  return (
    <>
      <View>
        <IconButton
          icon="sticker-emoji"
          size={size}
          iconColor={theme.colors.onSurfaceVariant}
          onPress={handlePress}
          style={styles.button}
          accessibilityLabel="Open sticker picker"
          accessibilityRole="button"
        />
        {isLoading && <ButtonLoadingOverlay />}
      </View>
      {shouldKeepMounted &&
        (ResolvedPicker ? (
          <ResolvedPicker
            ref={sheetRef}
            open={pickerOpen}
            onClose={handleClose}
            onStickerSelected={handleStickerSelected}
            keyboardHeight={lastKeyboardHeight}
            sharedTranslateY={sheetTranslateY}
            warmupEnabled={warmMountEnabled}
          />
        ) : pickerOpen && preloadStatus.status !== "failed" ? (
          <Suspense fallback={null}>
            <LazyStickerPicker
              ref={sheetRef}
              open={pickerOpen}
              onClose={handleClose}
              onStickerSelected={handleStickerSelected}
              keyboardHeight={lastKeyboardHeight}
              sharedTranslateY={sheetTranslateY}
              warmupEnabled={warmMountEnabled}
            />
          </Suspense>
        ) : null)}
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
