/**
 * NativeComposerInput
 *
 * Drop-in replacement for the TextInput used in ChatComposer on iOS.
 * Wraps the NativeComposerView (UITextView + custom inputView keyboard)
 * and exposes the same interface that ChatComposer expects.
 *
 * On Android or when the native view is unavailable, this renders the
 * standard React Native TextInput as a fallback.
 */

import type { KeyboardTheme } from "@/modules/nativeKeyboard";
import {
  isNativeComposerAvailable,
  blur as nativeBlur,
  clear as nativeClear,
  NativeComposerView,
  focus as nativeFocus,
} from "@/modules/nativeKeyboard";
import { useAppTheme } from "@/store/ThemeContext";
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  NativeSyntheticEvent,
  Platform,
  StyleProp,
  TextInput,
  TextInputProps,
  TextInputSelectionChangeEventData,
  ViewStyle,
} from "react-native";

export interface NativeComposerInputRef {
  focus: () => void;
  blur: () => void;
  clear: () => void;
  isFocused: () => boolean;
}

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  onSelectionChange?: (
    e: NativeSyntheticEvent<TextInputSelectionChangeEventData>,
  ) => void;
  onSubmitEditing?: () => void;
  placeholder?: string;
  placeholderTextColor?: string;
  selectionColor?: string;
  editable?: boolean;
  maxLength?: number;
  multiline?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Additional TextInput props for the fallback path (Android) */
  textInputProps?: Partial<TextInputProps>;
  /** Whether to use native keyboard (iOS only). Pass false to force standard TextInput. */
  useNativeKeyboard?: boolean;
}

/**
 * Renders a native UITextView with custom keyboard on iOS,
 * or a standard TextInput on Android. Provides a unified ref
 * interface for focus/blur/clear.
 */
export const NativeComposerInput = forwardRef<NativeComposerInputRef, Props>(
  function NativeComposerInput(props, ref) {
    const {
      value,
      onChangeText,
      onSelectionChange,
      onSubmitEditing,
      placeholder,
      placeholderTextColor,
      selectionColor,
      editable = true,
      maxLength,
      style,
      textInputProps,
      useNativeKeyboard = true,
    } = props;

    const { colors, isDark } = useAppTheme();
    const [isFocused, setIsFocused] = useState(false);
    const fallbackRef = useRef<TextInput | null>(null);

    const useNative =
      Platform.OS === "ios" && isNativeComposerAvailable && useNativeKeyboard;

    // Build keyboard theme from current app theme
    const keyboardTheme = useMemo<KeyboardTheme>(() => {
      const kbSurface =
        colors.keyboardSurface ?? (isDark ? colors.background : colors.surface);
      return {
        backgroundColor: kbSurface,
        keyColor: isDark ? lighten(kbSurface, 0.15) : "#FFFFFF",
        keyTextColor: colors.text,
        specialKeyColor: isDark
          ? lighten(kbSurface, 0.08)
          : darken(kbSurface, 0.08),
        specialKeyTextColor: colors.text,
        returnKeyColor: colors.primary,
        returnKeyTextColor: colors.onPrimary ?? "#FFFFFF",
      };
    }, [colors, isDark]);

    // Expose imperative handle
    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          if (useNative) {
            nativeFocus();
          } else {
            fallbackRef.current?.focus();
          }
        },
        blur: () => {
          if (useNative) {
            nativeBlur();
          } else {
            fallbackRef.current?.blur();
          }
        },
        clear: () => {
          if (useNative) {
            nativeClear();
          } else {
            fallbackRef.current?.clear();
          }
        },
        isFocused: () => isFocused,
      }),
      [useNative, isFocused],
    );

    // ──── Native Path (iOS) ────────────────────────────────────────────

    const handleNativeTextChange = useCallback(
      (event: any) => {
        const text = event.nativeEvent?.text ?? "";
        onChangeText(text);
      },
      [onChangeText],
    );

    const handleNativeSelectionChange = useCallback(
      (event: any) => {
        if (!onSelectionChange) return;
        const { start, end } = event.nativeEvent ?? {};
        // Construct a compatible selection event
        onSelectionChange({
          nativeEvent: { selection: { start, end } },
        } as any);
      },
      [onSelectionChange],
    );

    const handleNativeSendPress = useCallback(
      (_event: any) => {
        onSubmitEditing?.();
      },
      [onSubmitEditing],
    );

    const handleNativeFocusChange = useCallback((event: any) => {
      setIsFocused(event.nativeEvent?.isFocused ?? false);
    }, []);

    const handleNativeContentSizeChange = useCallback((event: any) => {
      // Content size changes are handled natively via intrinsicContentSize.
      // This callback is available if consumers need the raw values.
    }, []);

    if (useNative) {
      return (
        <NativeComposerView
          style={style}
          text={value}
          placeholder={placeholder}
          placeholderColor={placeholderTextColor}
          textColor={(style as any)?.color ?? colors.inputText ?? colors.text}
          selectionColor={selectionColor ?? colors.primary}
          fontSize={16}
          editable={editable}
          maxLength={maxLength ?? 0}
          keyboardTheme={keyboardTheme}
          onTextChange={handleNativeTextChange}
          onSelectionChange={handleNativeSelectionChange}
          onSendPress={handleNativeSendPress}
          onFocusChange={handleNativeFocusChange}
          onContentSizeChange={handleNativeContentSizeChange}
        />
      );
    }

    // ──── Fallback Path (Android / unavailable) ────────────────────────

    return (
      <TextInput
        ref={fallbackRef}
        style={style}
        value={value}
        onChangeText={onChangeText}
        onSelectionChange={onSelectionChange}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        selectionColor={selectionColor}
        editable={editable}
        maxLength={maxLength}
        multiline
        keyboardAppearance={isDark ? "dark" : "light"}
        returnKeyType="send"
        submitBehavior="submit"
        onSubmitEditing={onSubmitEditing ? () => onSubmitEditing() : undefined}
        {...textInputProps}
      />
    );
  },
);

// ──── Color Helpers ──────────────────────────────────────────────────────────

function lighten(hex: string, amount: number): string {
  return adjustColor(hex, amount);
}

function darken(hex: string, amount: number): string {
  return adjustColor(hex, -amount);
}

function adjustColor(hex: string, amount: number): string {
  let c = hex.replace("#", "");
  if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  const num = parseInt(c, 16);
  if (isNaN(num)) return hex;
  const r = Math.min(
    255,
    Math.max(0, ((num >> 16) & 0xff) + Math.round(255 * amount)),
  );
  const g = Math.min(
    255,
    Math.max(0, ((num >> 8) & 0xff) + Math.round(255 * amount)),
  );
  const b = Math.min(255, Math.max(0, (num & 0xff) + Math.round(255 * amount)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export default NativeComposerInput;
