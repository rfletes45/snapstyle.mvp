/**
 * SketchToolbar — Drawing tools for the drawer in Sketch Party
 *
 * Pen/eraser toggle, color palette, brush width, undo, clear.
 * Only rendered for the active drawer; hidden for guessers/spectators.
 */

import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { IconButton, useTheme } from "react-native-paper";

// =============================================================================
// Constants
// =============================================================================

const COLOR_PALETTE = [
  "#000000",
  "#FFFFFF",
  "#808080",
  "#C0C0C0",
  "#FF0000",
  "#FF6600",
  "#FFCC00",
  "#FFFF00",
  "#00CC00",
  "#009900",
  "#00CCFF",
  "#0066FF",
  "#0000CC",
  "#6600CC",
  "#CC00CC",
  "#FF66CC",
  "#8B4513",
  "#FF9966",
];

const BRUSH_SIZES = [2, 4, 8, 12, 18, 24];

// =============================================================================
// Types
// =============================================================================

export interface SketchToolbarProps {
  selectedColor: string;
  onColorChange: (color: string) => void;
  brushWidth: number;
  onBrushWidthChange: (width: number) => void;
  isEraser: boolean;
  onEraserToggle: () => void;
  onUndo: () => void;
  onClear: () => void;
}

// =============================================================================
// Component
// =============================================================================

export function SketchToolbar({
  selectedColor,
  onColorChange,
  brushWidth,
  onBrushWidthChange,
  isEraser,
  onEraserToggle,
  onUndo,
  onClear,
}: SketchToolbarProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.surfaceVariant },
      ]}
    >
      {/* Row 1: Colors */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.colorRow}
      >
        {COLOR_PALETTE.map((color) => (
          <Pressable
            key={color}
            onPress={() => onColorChange(color)}
            style={[
              styles.colorSwatch,
              { backgroundColor: color },
              color === "#FFFFFF" && styles.whiteSwatchBorder,
              selectedColor === color && !isEraser && styles.selectedSwatch,
            ]}
          />
        ))}
      </ScrollView>

      {/* Row 2: Tools + brush sizes */}
      <View style={styles.toolRow}>
        {/* Pen / Eraser */}
        <IconButton
          icon="pencil"
          size={20}
          mode={!isEraser ? "contained" : "outlined"}
          onPress={() => {
            if (isEraser) onEraserToggle();
          }}
        />
        <IconButton
          icon="eraser"
          size={20}
          mode={isEraser ? "contained" : "outlined"}
          onPress={() => {
            if (!isEraser) onEraserToggle();
          }}
        />

        <View style={styles.separator} />

        {/* Brush sizes */}
        {BRUSH_SIZES.map((size) => (
          <Pressable
            key={size}
            onPress={() => onBrushWidthChange(size)}
            style={[
              styles.sizeButton,
              brushWidth === size && {
                backgroundColor: theme.colors.primaryContainer,
              },
            ]}
          >
            <View
              style={[
                styles.sizeDot,
                {
                  width: Math.max(4, size * 1.5),
                  height: Math.max(4, size * 1.5),
                  borderRadius: Math.max(2, size * 0.75),
                  backgroundColor: theme.colors.onSurface,
                },
              ]}
            />
          </Pressable>
        ))}

        <View style={styles.separator} />

        {/* Undo + Clear */}
        <IconButton icon="undo" size={20} onPress={onUndo} />
        <IconButton icon="delete-outline" size={20} onPress={onClear} />
      </View>
    </View>
  );
}

// Re-export palette for external use (e.g., default color)
export { BRUSH_SIZES, COLOR_PALETTE };

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 8,
    gap: 2,
  },
  colorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  whiteSwatchBorder: {
    borderColor: "#CCCCCC",
  },
  selectedSwatch: {
    borderWidth: 2,
    borderColor: "#0066FF",
  },
  toolRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  separator: {
    width: 1,
    height: 24,
    backgroundColor: "#CCCCCC",
    marginHorizontal: 6,
  },
  sizeButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 16,
    marginHorizontal: 1,
  },
  sizeDot: {
    backgroundColor: "#000000",
  },
});
