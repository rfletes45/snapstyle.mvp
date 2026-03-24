/**
 * ThemedTextInput - Centralized themed TextInput wrapper
 *
 * Provides consistent theme-aware styling for all text inputs:
 * - Colors adapt to current theme (light/dark/custom)
 * - iOS keyboard appearance follows theme
 * - Placeholder, cursor, and selection colors match theme
 *
 * @module components/ui/ThemedTextInput
 */

import { useAppTheme } from "@/store/ThemeContext";
import React, { forwardRef } from "react";
import { Platform, TextInput, TextInputProps } from "react-native";

export interface ThemedTextInputProps extends TextInputProps {
  /** Override theme-derived text color */
  themeTextColor?: string;
  /** Override theme-derived placeholder color */
  themePlaceholderColor?: string;
}

/**
 * A TextInput that automatically applies theme-aware colors.
 *
 * Handles:
 * - Text color from theme
 * - Placeholder color from theme
 * - iOS keyboardAppearance (dark/light) synced to theme
 * - Selection/cursor color from theme primary
 */
export const ThemedTextInput = forwardRef<TextInput, ThemedTextInputProps>(
  function ThemedTextInput(
    { style, themeTextColor, themePlaceholderColor, ...props },
    ref,
  ) {
    const { colors, isDark } = useAppTheme();

    const textColor = themeTextColor ?? colors.inputText ?? colors.text;
    const placeholderColor =
      themePlaceholderColor ?? colors.inputPlaceholder ?? colors.textMuted;

    return (
      <TextInput
        ref={ref}
        placeholderTextColor={props.placeholderTextColor ?? placeholderColor}
        selectionColor={props.selectionColor ?? colors.primary}
        keyboardAppearance={
          props.keyboardAppearance ??
          (Platform.OS === "ios" ? (isDark ? "dark" : "light") : undefined)
        }
        style={[{ color: textColor }, style]}
        {...props}
      />
    );
  },
);

export default ThemedTextInput;
