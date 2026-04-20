/**
 * NativeComposerInput
 *
 * Drop-in replacement for the TextInput used in ChatComposer on iOS.
 * Wraps the NativeComposerView (native UITextView with Apple's system keyboard)
 * and exposes the same interface that ChatComposer expects.
 *
 * On Android or when the native view is unavailable, this renders the
 * standard React Native TextInput as a fallback.
 */

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
  TextStyle,
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
  /** Called when the main composer input gains focus. */
  onFocus?: () => void;
  placeholder?: string;
  placeholderTextColor?: string;
  selectionColor?: string;
  editable?: boolean;
  maxLength?: number;
  multiline?: boolean;
  style?: StyleProp<TextStyle>;
  /** Additional TextInput props for the fallback path (Android) */
  textInputProps?: Partial<TextInputProps>;
  /** Whether to use native keyboard (iOS only). Pass false to force standard TextInput. */
  useNativeKeyboard?: boolean;
}

/**
 * Renders a native UITextView with Apple's system keyboard on iOS,
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
      onFocus,
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

    const handleNativeFocusChange = useCallback(
      (event: any) => {
        const focused = event.nativeEvent?.isFocused ?? false;
        setIsFocused(focused);
        if (focused) onFocus?.();
      },
      [onFocus],
    );

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
          keyboardAppearance={isDark ? "dark" : "light"}
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
        onFocus={onFocus}
        {...textInputProps}
      />
    );
  },
);

export default NativeComposerInput;
