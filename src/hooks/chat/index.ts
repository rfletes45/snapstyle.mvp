/**
 * Chat Hooks Index
 *
 * Exports all hooks for chat keyboard management, scroll detection,
 * and autoscroll behavior.
 *
 * @module hooks/chat
 */

// Keyboard tracking and animation
export {
  useChatKeyboard,
  type ChatKeyboardConfig,
  type ChatKeyboardState,
} from "./useChatKeyboard";

// Scroll position detection
export {
  estimateMessageCountFromOffset,
  useAtBottom,
  type AtBottomConfig,
  type AtBottomState,
} from "./useAtBottom";

// New message autoscroll rules
export {
  useNewMessageAutoscroll,
  type AutoscrollConfig,
  type AutoscrollState,
} from "./useNewMessageAutoscroll";
