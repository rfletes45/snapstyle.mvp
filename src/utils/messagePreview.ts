/**
 * Shared Message Preview Text Utility
 *
 * Single source of truth for generating preview text from message metadata.
 * Used in:
 * - ReplyPreviewBar (compose-time reply preview)
 * - ReplyBubbleNew (inline reply bubble in message list)
 * - Firebase backend messaging.ts (stored in Firestore)
 *
 * @module utils/messagePreview
 */

import type { MessageKind, ReplyToMetadata } from "@/types/messaging";

// =============================================================================
// Preview Text
// =============================================================================

/**
 * Get display text for a reply preview based on message kind and text.
 *
 * @param replyTo - Reply metadata containing kind and textSnippet
 * @param maxLength - Maximum length before truncation (default: 100)
 * @returns Human-readable preview string
 */
export function getPreviewText(
  replyTo: Pick<ReplyToMetadata, "kind" | "textSnippet">,
  maxLength: number = 100,
): string {
  if (replyTo.textSnippet) {
    const text = replyTo.textSnippet;
    return text.length > maxLength ? text.substring(0, maxLength) + "…" : text;
  }

  return getKindLabel(replyTo.kind);
}

/**
 * Get a human-readable label for a message kind.
 *
 * @param kind - The message kind
 * @returns Label string (e.g. "Photo", "Voice message")
 */
export function getKindLabel(kind: MessageKind | string): string {
  switch (kind) {
    case "text":
      return "Message";
    case "media":
      return "Photo";
    case "voice":
      return "Voice message";
    case "file":
      return "File";
    case "system":
      return "System message";
    case "scorecard":
      return "Game result";
    case "game_invite":
      return "Game invite";
    default:
      return "Message";
  }
}

// =============================================================================
// Kind Icon (Material Community Icons names)
// =============================================================================

/**
 * Get a Material Community Icon name for a message kind.
 * Used by ReplyPreviewBar.
 *
 * @param kind - The message kind
 * @returns Icon name string
 */
export function getKindIconMCI(kind: MessageKind | string): string {
  switch (kind) {
    case "text":
      return "message-text";
    case "media":
      return "image";
    case "voice":
      return "microphone";
    case "file":
      return "file";
    case "system":
      return "information";
    case "scorecard":
      return "trophy";
    case "game_invite":
      return "gamepad-variant";
    default:
      return "message-text";
  }
}

// =============================================================================
// Kind Icon (Ionicons names)
// =============================================================================

/**
 * Get an Ionicons icon name for a message kind.
 * Used by ReplyBubbleNew.
 *
 * @param kind - The message kind
 * @returns Ionicons glyph name string
 */
export function getKindIconIonicons(kind: MessageKind | string): string {
  switch (kind) {
    case "media":
      return "image-outline";
    case "voice":
      return "mic-outline";
    case "file":
      return "document-outline";
    case "system":
      return "information-circle-outline";
    case "scorecard":
      return "trophy-outline";
    case "game_invite":
      return "game-controller-outline";
    default:
      return "chatbubble-outline";
  }
}
