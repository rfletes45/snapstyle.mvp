/**
 * GameButton
 *
 * Opens the game picker and calls onGameSelected when a game is chosen.
 * Follows the same keyboard-replacement sheet pattern as GifButton and
 * StickerButton: the picker opens to keyboard height and the composer
 * follows it upward via the shared ComposerSheetContext.
 *
 * Designed for use as a toolbar item in the composer drag toolbar.
 * - 40×40 touch target, 24px icon
 * - Material Community Icons "gamepad-variant-outline" icon
 * - Haptic feedback on press
 *
 * @module components/chat/GameButton
 */

import { useComposerSheet } from "@/contexts/ComposerSheetContext";
import { GamePickerModal } from "@/gamesV4/components/GamePickerModal";
import type { GameId } from "@/gamesV4/types";
import * as Haptics from "expo-haptics";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import { IconButton, useTheme } from "react-native-paper";

import type { DraggableBottomSheetHandle } from "./DraggableBottomSheet";

// =============================================================================
// Types
// =============================================================================

export interface GameButtonProps {
  /** Called when a game is selected from the picker. */
  onGameSelected: (gameId: GameId) => void;
  /** Only show multiplayer games. */
  multiplayerOnly?: boolean;
  /** Button size in pixels. */
  size?: number;
}

// =============================================================================
// Component
// =============================================================================

function GameButtonBase({
  onGameSelected,
  multiplayerOnly = false,
  size = 24,
}: GameButtonProps) {
  const theme = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const sheetRef = useRef<DraggableBottomSheetHandle>(null);
  const {
    activateSheet,
    deactivateSheet,
    lastKeyboardHeight,
    sheetTranslateY,
  } = useComposerSheet();

  // Track open state in a ref for unmount cleanup.
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

  const handleGameSelected = useCallback(
    (gameId: GameId) => {
      onGameSelected(gameId);
      // GamePickerModal calls onClose internally after selection
    },
    [onGameSelected],
  );

  return (
    <>
      <IconButton
        icon="gamepad-variant-outline"
        size={size}
        iconColor={theme.colors.onSurfaceVariant}
        onPress={handlePress}
        style={styles.button}
        accessibilityLabel="Open game picker"
        accessibilityRole="button"
      />
      <GamePickerModal
        ref={sheetRef}
        open={pickerOpen}
        onSelect={handleGameSelected}
        onClose={handleClose}
        multiplayerOnly={multiplayerOnly}
        keyboardHeight={lastKeyboardHeight}
        sharedTranslateY={sheetTranslateY}
      />
    </>
  );
}

export const GameButton = memo(GameButtonBase);

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
