/**
 * ColorPicker — Wild card color selection overlay
 *
 * Appears when the player plays a Wild or Wild Draw Four.
 * Four color buttons arranged in a 2×2 grid over a backdrop.
 * Tap a color to confirm the choice, or tap outside / X to cancel.
 */

import { Canvas, RoundedRect, Shadow } from "@shopify/react-native-skia";
import React, { useCallback } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { CARD_COLORS } from "@/games/crazyCards/CrazyCardsConfig";
import type { CrazyCardColor } from "@/types/turnBased";
import type { ColorPickerProps } from "./CrazyCardsTypes";

// =============================================================================
// Constants
// =============================================================================

const BUTTON_SIZE = 72;
const BUTTON_RADIUS = 16;
const GRID_GAP = 16;

const CHOOSABLE_COLORS: { color: CrazyCardColor; label: string }[] = [
  { color: "red", label: "Red" },
  { color: "blue", label: "Blue" },
  { color: "green", label: "Green" },
  { color: "yellow", label: "Yellow" },
];

// =============================================================================
// ColorButton
// =============================================================================

const ColorButton = React.memo(function ColorButton({
  color,
  label,
  onPress,
}: {
  color: CrazyCardColor;
  label: string;
  onPress: (c: CrazyCardColor) => void;
}) {
  const bgColor = CARD_COLORS[color];

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => onPress(color)}
      style={styles.colorButton}
    >
      <Canvas style={{ width: BUTTON_SIZE, height: BUTTON_SIZE }}>
        <RoundedRect
          x={0}
          y={0}
          width={BUTTON_SIZE}
          height={BUTTON_SIZE}
          r={BUTTON_RADIUS}
          color={bgColor}
        >
          <Shadow dx={0} dy={2} blur={8} color="rgba(0,0,0,0.35)" />
        </RoundedRect>
      </Canvas>
      <View style={styles.colorButtonOverlay}>
        <Text
          style={[
            styles.colorLabel,
            { color: color === "yellow" ? "#1B1E2B" : "#FFF" },
          ]}
        >
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

// =============================================================================
// Main ColorPicker Component
// =============================================================================

export const ColorPicker = React.memo(function ColorPicker({
  visible,
  onColorChosen,
  onCancel,
}: ColorPickerProps) {
  const handleChoose = useCallback(
    (c: CrazyCardColor) => {
      onColorChosen(c);
    },
    [onColorChosen],
  );

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={styles.pickerContainer}
        >
          {/* Prevent backdrop tap from closing when tapping inside */}
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Text style={styles.title}>Choose a Color</Text>

            <View style={styles.grid}>
              {CHOOSABLE_COLORS.map(({ color, label }) => (
                <ColorButton
                  key={color}
                  color={color}
                  label={label}
                  onPress={handleChoose}
                />
              ))}
            </View>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  pickerContainer: {
    backgroundColor: "#1B1E2B",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 20,
    textAlign: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: GRID_GAP,
    maxWidth: BUTTON_SIZE * 2 + GRID_GAP,
  },
  colorButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    position: "relative",
  },
  colorButtonOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  colorLabel: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  cancelButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  cancelText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default ColorPicker;
