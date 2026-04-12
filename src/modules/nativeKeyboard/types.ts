/**
 * NativeKeyboard Types
 *
 * Type definitions for the native iOS composer + custom keyboard module.
 */

export interface KeyboardTheme {
  backgroundColor: string;
  keyColor: string;
  keyTextColor: string;
  specialKeyColor: string;
  specialKeyTextColor: string;
  returnKeyColor: string;
  returnKeyTextColor: string;
}

export interface TextChangeEvent {
  text: string;
  cursorPosition: number;
}

export interface SelectionChangeEvent {
  start: number;
  end: number;
}

export interface SendPressEvent {
  text: string;
}

export interface ContentSizeChangeEvent {
  width: number;
  height: number;
}

export interface FocusChangeEvent {
  isFocused: boolean;
}

export interface NativeComposerViewProps {
  text?: string;
  placeholder?: string;
  placeholderColor?: string;
  textColor?: string;
  selectionColor?: string;
  fontSize?: number;
  editable?: boolean;
  maxLength?: number;
  keyboardTheme?: KeyboardTheme;
  onTextChange?: (event: { nativeEvent: TextChangeEvent }) => void;
  onSelectionChange?: (event: { nativeEvent: SelectionChangeEvent }) => void;
  onSendPress?: (event: { nativeEvent: SendPressEvent }) => void;
  onContentSizeChange?: (event: {
    nativeEvent: ContentSizeChangeEvent;
  }) => void;
  onFocusChange?: (event: { nativeEvent: FocusChangeEvent }) => void;
  style?: any;
}
