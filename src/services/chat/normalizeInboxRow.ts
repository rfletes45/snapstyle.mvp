import type {
  InboxConversation,
  InboxEntry,
  MemberStatePrivate,
} from "@/types/messaging";
import { createLogger, isDebugEnabled } from "@/utils/log";

const log = createLogger("normalizeInboxRow");

export const UNREAD_TOLERANCE_MS = 5000;
export const RECENTLY_READ_TTL_MS = 30000;

export function getDefaultMemberState(uid: string): MemberStatePrivate {
  return {
    uid,
    lastSeenAtPrivate: 0,
    archived: false,
    notifyLevel: "all",
  };
}

export function mapMessageKindToPreviewType(
  kind?: string,
): NonNullable<InboxConversation["lastMessage"]>["type"] {
  switch (kind) {
    case "media":
      return "image";
    case "voice":
      return "voice";
    case "file":
      return "attachment";
    default:
      return "text";
  }
}

export interface ComputeUnreadCountInput {
  lastActivityAt: number;
  memberState: MemberStatePrivate;
  recentlyReadAt?: number;
  unreadHintCount?: number;
  now?: number;
  /** UID of the user who sent the last message in this conversation. */
  lastMessageSenderId?: string;
  /** UID of the currently-authenticated user. */
  currentUserId?: string;
}

/**
 * Canonical unread rule for inbox rows (fan-out and aggregated modes):
 * 1) recent optimistic read wins (temporary override)
 * 2) manual unread marker wins
 * 3) otherwise compare last activity vs private read watermark (+ tolerance)
 * 4) fallback to server-provided unread hint only when private watermark is absent
 *
 * When the conversation IS unread, returns the server-provided
 * `unreadHintCount` so badges display the true message count.
 * Falls back to 1 when no server count is available (fan-out mode).
 */
export function computeUnreadCount(input: ComputeUnreadCountInput): number {
  const {
    lastActivityAt,
    memberState,
    recentlyReadAt,
    unreadHintCount = 0,
    now = Date.now(),
    lastMessageSenderId,
    currentUserId,
  } = input;

  // Prefer the server-provided count when we know the conversation is unread.
  // In fan-out mode (no server inbox doc) unreadHintCount is 0 → fall back to 1.
  const countWhenUnread = unreadHintCount > 0 ? unreadHintCount : 1;

  // The sender's own messages should never produce an unread badge.
  if (
    currentUserId &&
    lastMessageSenderId &&
    lastMessageSenderId === currentUserId
  ) {
    return 0;
  }

  if (recentlyReadAt && now - recentlyReadAt < RECENTLY_READ_TTL_MS) {
    return 0;
  }

  if (
    memberState.lastMarkedUnreadAt &&
    memberState.lastMarkedUnreadAt > memberState.lastSeenAtPrivate
  ) {
    return countWhenUnread;
  }

  if (lastActivityAt > memberState.lastSeenAtPrivate + UNREAD_TOLERANCE_MS) {
    return countWhenUnread;
  }

  // If no private watermark exists yet (cold start/new member doc), respect
  // any server-side unread hint as a best-effort fallback.
  if (!memberState.lastSeenAtPrivate && unreadHintCount > 0) {
    return countWhenUnread;
  }

  return 0;
}

export interface NormalizeConversationInput {
  id: string;
  type: "dm" | "group";
  name: string;
  avatarUrl?: string | null;
  avatarConfig?: InboxConversation["avatarConfig"];
  profilePictureUrl?: string | null;
  decorationId?: string | null;
  otherUserId?: string;
  avatarIds?: string[];
  participantCount?: number;
  backgroundUrl?: string | null;
  lastMessageText?: string | null;
  lastMessageSenderName?: string;
  lastMessageKind?: string;
  lastActivityAt?: number;
  createdAt?: number;
  memberState: MemberStatePrivate;
  recentlyReadAt?: number;
  unreadHintCount?: number;
  /** UID of the user who sent the last message (for sender-exclusion). */
  lastMessageSenderId?: string;
  /** UID of the currently-authenticated user. */
  currentUserId?: string;
}

export function normalizeConversationRow(
  input: NormalizeConversationInput,
): InboxConversation {
  const {
    id,
    type,
    name,
    avatarUrl = null,
    avatarConfig,
    profilePictureUrl,
    decorationId,
    otherUserId,
    avatarIds,
    participantCount,
    lastMessageText,
    lastMessageSenderName,
    lastMessageKind,
    lastActivityAt = 0,
    createdAt = lastActivityAt || 0,
    memberState,
    recentlyReadAt,
    unreadHintCount,
    lastMessageSenderId,
    currentUserId,
  } = input;

  const unreadCount = computeUnreadCount({
    lastActivityAt,
    memberState,
    recentlyReadAt,
    unreadHintCount,
    lastMessageSenderId,
    currentUserId,
  });

  if (unreadCount > 0 && isDebugEnabled("CHAT")) {
    log.debug("unread row", {
      data: { id, unreadCount, unreadHintCount: unreadHintCount ?? 0 },
    });
  }

  return {
    id,
    type,
    name,
    avatarUrl,
    avatarConfig,
    profilePictureUrl,
    decorationId,
    otherUserId,
    avatarIds,
    backgroundUrl: input.backgroundUrl ?? null,
    lastMessage: lastMessageText
      ? {
          text: lastMessageText,
          senderName: lastMessageSenderName || "",
          timestamp: lastActivityAt,
          type: mapMessageKindToPreviewType(lastMessageKind),
        }
      : null,
    memberState,
    unreadCount,
    hasMentions: false,
    createdAt,
    participantCount,
  };
}

export function normalizeConversationFromInboxEntry(
  entry: InboxEntry,
  memberState: MemberStatePrivate,
  recentlyReadAt?: number,
  currentUserId?: string,
): InboxConversation {
  const isDm = entry.scope === "dm";
  const lastActivityAt =
    typeof entry.lastActivityAt === "number" ? entry.lastActivityAt : 0;

  return normalizeConversationRow({
    id: entry.conversationId,
    type: isDm ? "dm" : "group",
    name: isDm
      ? entry.otherUserName || "Chat"
      : entry.groupName || "Group Chat",
    avatarUrl: null,
    backgroundUrl: entry.backgroundUrl ?? null,
    otherUserId: isDm ? entry.otherUserId : undefined,
    participantCount: entry.memberCount,
    lastMessageText: entry.lastMessagePreview || "",
    lastMessageSenderName: entry.lastSenderName || "",
    lastMessageKind: entry.lastMessageKind,
    lastActivityAt,
    createdAt: lastActivityAt,
    memberState,
    recentlyReadAt,
    unreadHintCount: entry.unreadCount || 0,
    lastMessageSenderId: entry.lastSenderId,
    currentUserId,
  });
}

/**
 * Sort conversations with deterministic, stable ordering.
 *
 * Order:
 *  1. Pinned conversations first (most-recently-pinned on top).
 *  2. Non-pinned sorted by most-recent activity (lastMessage or createdAt).
 *  3. Tie-break by conversation ID for full determinism.
 *
 * The sort key for each conversation is computed from fields that are set
 * once during normalization and never change until the next snapshot, so
 * the order is stable across re-renders as long as the underlying data
 * has not changed.
 */
export function sortInboxConversations(
  conversations: InboxConversation[],
): InboxConversation[] {
  return [...conversations].sort((a, b) => {
    const aPinned = a.memberState.pinnedAt ?? 0;
    const bPinned = b.memberState.pinnedAt ?? 0;

    if (aPinned && bPinned) return bPinned - aPinned;
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;

    const aTime = a.lastMessage?.timestamp ?? a.createdAt ?? 0;
    const bTime = b.lastMessage?.timestamp ?? b.createdAt ?? 0;
    if (aTime !== bTime) return bTime - aTime;

    return a.id.localeCompare(b.id);
  });
}
