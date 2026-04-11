/**
 * Conversation Display Mode — Type Definitions & Layout Tokens
 *
 * Defines the two presentation modes for chat messages:
 * - `bubbles` — Classic opposing-side message bubbles (default)
 * - `stacked` — Dense left-aligned conversation view (Discord/Snapchat style)
 *
 * The display mode is a viewer-side preference only. It never changes the
 * underlying message data or how other users see the conversation.
 */

// ---------------------------------------------------------------------------
// Core Type
// ---------------------------------------------------------------------------

export type ConversationDisplayMode = "bubbles" | "stacked";

export const DEFAULT_DISPLAY_MODE: ConversationDisplayMode = "bubbles";

// ---------------------------------------------------------------------------
// Message View-Model (mode-agnostic signals for renderers)
// ---------------------------------------------------------------------------

export interface MessageViewModel {
  /** Is this message from the current user? */
  isMine: boolean;
  /** Is this a group chat (vs DM)? */
  isGroupChat: boolean;
  /** Is this message grouped with the one visually above it? (same sender, close time) */
  isGroupedWithPrevious: boolean;
  /** Is this message grouped with the one visually below it? */
  isGroupedWithNext: boolean;
  /** True for the first message in a sender-group (show avatar + name) */
  isGroupStart: boolean;
  /** True for the last message in a sender-group (show timestamp, status) */
  isGroupEnd: boolean;
  /** Should the sender avatar be shown? */
  showAvatar: boolean;
  /** Should the sender display name be shown? */
  showDisplayName: boolean;
  /** Should the timestamp row be shown? */
  showTimestamp: boolean;
  /** Is this a system message? */
  isSystemMessage: boolean;
  /** Does this message have reactions? */
  hasReactions: boolean;
  /** Does this message have a reply preview? */
  hasReplyPreview: boolean;
  /** Does this message have a thread indicator? */
  hasThread: boolean;
}

// ---------------------------------------------------------------------------
// Layout Tokens — mode-specific spacing/sizing configuration
// ---------------------------------------------------------------------------

export interface ChatLayoutTokens {
  /** Vertical gap between messages in different sender-groups */
  groupGap: number;
  /** Vertical gap between messages within the same sender-group */
  withinGroupGap: number;
  /** Maximum width of message content as a fraction of screen width */
  maxContentWidthPct: string;
  /** Horizontal padding inside message bubble (bubble mode only) */
  bubblePaddingH: number;
  /** Vertical padding inside message bubble (bubble mode only) */
  bubblePaddingV: number;
  /** Border radius for message bubble (bubble mode only) */
  bubbleRadius: number;
  /** Reduced corner radius for group-internal messages (bubble mode only) */
  bubbleGroupedRadius: number;
  /** Space between avatar and message body */
  avatarGap: number;
  /** Avatar size in pixels */
  avatarSize: number;
  /** Vertical space above author header (name line) */
  authorHeaderTopGap: number;
  /** Space below reaction pills row */
  reactionRowGap: number;
  /** Space above reply-preview card */
  replyPreviewGap: number;
  /** Horizontal inset from screen edge */
  screenEdgeInset: number;
  /** Timestamp font size */
  timestampFontSize: number;
  /** Author name font size */
  authorNameFontSize: number;
  /** Message text font size */
  messageFontSize: number;
  /** Message text line height */
  messageLineHeight: number;
}

/** Layout tokens for bubble mode (matches current design) */
export const BUBBLE_LAYOUT: ChatLayoutTokens = {
  groupGap: 14,
  withinGroupGap: 2,
  maxContentWidthPct: "80%",
  bubblePaddingH: 10,
  bubblePaddingV: 10,
  bubbleRadius: 20,
  bubbleGroupedRadius: 20,
  avatarGap: 8,
  avatarSize: 28,
  authorHeaderTopGap: 0,
  reactionRowGap: 4,
  replyPreviewGap: 4,
  screenEdgeInset: 0,
  timestampFontSize: 10,
  authorNameFontSize: 12,
  messageFontSize: 17,
  messageLineHeight: 26,
};

// ---------------------------------------------------------------------------
// Stacked / Feed Layout Tokens (Discord-style dense feed)
// ---------------------------------------------------------------------------

/**
 * Feed-specific layout tokens for the stacked (Discord-style) renderer.
 * These define the fixed gutter/content-column grid system.
 */
export interface FeedLayoutTokens {
  /** Horizontal inset from screen edge */
  screenEdgeInset: number;
  /** Width of the left gutter area (reserved for avatars) */
  gutterWidth: number;
  /** Gap between gutter and content column */
  gutterGap: number;
  /** Total left indent for content = screenEdgeInset + gutterWidth + gutterGap */
  contentIndent: number;
  /** Avatar diameter at group start */
  avatarSize: number;
  /** Vertical gap between sender groups */
  groupGap: number;
  /** Vertical gap between messages within a group */
  withinGroupGap: number;
  /** Vertical padding on each feed row (self-message tint extends here) */
  rowPaddingV: number;
  /** Horizontal padding on each feed row */
  rowPaddingH: number;
  /** Border radius for media cards */
  mediaRadius: number;
  /** Max image width in pixels */
  imageMaxWidth: number;
  /** Max image height in pixels */
  imageMaxHeight: number;
  /** Min image width in pixels */
  imageMinWidth: number;
  /** Author name font size */
  authorNameFontSize: number;
  /** Timestamp font size */
  timestampFontSize: number;
  /** Message text font size */
  messageFontSize: number;
  /** Message text line height */
  messageLineHeight: number;
  /** Space between reaction row and message body */
  reactionRowGap: number;
  /** Space between reply preview and message body */
  replyPreviewGap: number;
  /** Opacity of the self-message row tint */
  selfTintOpacity: number;
  /** Width of the self-message left accent border */
  selfAccentWidth: number;
}

export const FEED_LAYOUT: FeedLayoutTokens = {
  screenEdgeInset: 0,
  gutterWidth: 40,
  gutterGap: 14,
  contentIndent: 54, // 0 + 40 + 14
  avatarSize: 40,
  groupGap: 14,
  withinGroupGap: 2,
  rowPaddingV: 2,
  rowPaddingH: 8,
  mediaRadius: 8,
  imageMaxWidth: 260,
  imageMaxHeight: 300,
  imageMinWidth: 140,
  authorNameFontSize: 16,
  timestampFontSize: 12.5,
  messageFontSize: 16,
  messageLineHeight: 22.5,
  reactionRowGap: 2,
  replyPreviewGap: 4,
  selfTintOpacity: 0,
  selfAccentWidth: 0,
};

/** Layout tokens for stacked mode (legacy interface compat — new code should use FEED_LAYOUT) */
export const STACKED_LAYOUT: ChatLayoutTokens = {
  groupGap: FEED_LAYOUT.groupGap,
  withinGroupGap: FEED_LAYOUT.withinGroupGap,
  maxContentWidthPct: "100%",
  bubblePaddingH: 0,
  bubblePaddingV: 0,
  bubbleRadius: 0,
  bubbleGroupedRadius: 0,
  avatarGap: FEED_LAYOUT.gutterGap,
  avatarSize: FEED_LAYOUT.avatarSize,
  authorHeaderTopGap: 0,
  reactionRowGap: FEED_LAYOUT.reactionRowGap,
  replyPreviewGap: FEED_LAYOUT.replyPreviewGap,
  screenEdgeInset: FEED_LAYOUT.screenEdgeInset,
  timestampFontSize: FEED_LAYOUT.timestampFontSize,
  authorNameFontSize: FEED_LAYOUT.authorNameFontSize,
  messageFontSize: FEED_LAYOUT.messageFontSize,
  messageLineHeight: FEED_LAYOUT.messageLineHeight,
};

/** Get the layout tokens for a given display mode */
export function getLayoutTokens(
  mode: ConversationDisplayMode,
): ChatLayoutTokens {
  return mode === "stacked" ? STACKED_LAYOUT : BUBBLE_LAYOUT;
}

/** Convert hex color to "r, g, b" string for rgba() usage */
export function hexToRgb(hex: string): string {
  const cleaned = hex.replace("#", "");
  if (cleaned.length < 6) return "128, 128, 128";
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return "128, 128, 128";
  return `${r}, ${g}, ${b}`;
}

// ---------------------------------------------------------------------------
// View-Model Builder
// ---------------------------------------------------------------------------

export interface BuildViewModelParams {
  isMine: boolean;
  isGroupChat: boolean;
  isGroupedWithPrevious: boolean;
  isGroupedWithNext: boolean;
  isSystemMessage: boolean;
  hasReactions: boolean;
  hasReplyPreview: boolean;
  hasThread: boolean;
  displayMode: ConversationDisplayMode;
}

/**
 * Build a MessageViewModel from raw grouping signals.
 * Both renderers consume this to decide what to show.
 */
export function buildMessageViewModel(
  p: BuildViewModelParams,
): MessageViewModel {
  const isGroupStart = !p.isGroupedWithPrevious;
  const isGroupEnd = !p.isGroupedWithNext;

  // Avatar rules
  let showAvatar = false;
  if (p.displayMode === "stacked") {
    // Feed mode: always show avatar at group start for all senders
    showAvatar = isGroupStart;
  }
  // Bubble mode: no inline avatar (current design has no inline avatars)

  // Display name rules
  let showDisplayName = false;
  if (p.displayMode === "stacked") {
    // Stacked: show name at group start (always in groups, and for self with "You")
    showDisplayName = isGroupStart;
  } else {
    // Bubble: show name at group start in group chats for received messages
    showDisplayName = isGroupStart && p.isGroupChat && !p.isMine;
  }

  return {
    isMine: p.isMine,
    isGroupChat: p.isGroupChat,
    isGroupedWithPrevious: p.isGroupedWithPrevious,
    isGroupedWithNext: p.isGroupedWithNext,
    isGroupStart,
    isGroupEnd,
    showAvatar,
    showDisplayName,
    showTimestamp: isGroupEnd,
    isSystemMessage: p.isSystemMessage,
    hasReactions: p.hasReactions,
    hasReplyPreview: p.hasReplyPreview,
    hasThread: p.hasThread,
  };
}
