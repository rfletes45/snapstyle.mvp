/**
 * NativeKeyboard Types
 *
 * Type definitions for the native iOS composer module.
 */

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
  keyboardAppearance?: "default" | "dark" | "light";
  onTextChange?: (event: { nativeEvent: TextChangeEvent }) => void;
  onSelectionChange?: (event: { nativeEvent: SelectionChangeEvent }) => void;
  onSendPress?: (event: { nativeEvent: SendPressEvent }) => void;
  onContentSizeChange?: (event: {
    nativeEvent: ContentSizeChangeEvent;
  }) => void;
  onFocusChange?: (event: { nativeEvent: FocusChangeEvent }) => void;
  style?: any;
}
