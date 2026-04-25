import type {
  InboxConversation,
  InboxEntry,
  MemberStatePrivate,
} from "@/types/messaging";
import { createLogger, isDebugEnabled } from "@/utils/log";

const log = createLogger("normalizeInboxRow");

export const UNREAD_TOLERANCE_MS = 5000;
export const RECENTLY_READ_TTL_MS = 30000;

export type InboxSortTimestampInput =
  | number
  | string
  | Date
  | {
      toMillis?: () => number;
      seconds?: number;
      nanoseconds?: number;
    }
  | null
  | undefined;

export function normalizeInboxTimestamp(
  value: InboxSortTimestampInput,
): number {
  if (value === null || value === undefined) return 0;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (value instanceof Date) {
    const millis = value.getTime();
    return Number.isFinite(millis) ? millis : 0;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return 0;

    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) return numeric;

    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (typeof value.toMillis === "function") {
    const millis = value.toMillis();
    return Number.isFinite(millis) ? millis : 0;
  }

  if (typeof value.seconds === "number") {
    const seconds = value.seconds;
    const nanos =
      typeof value.nanoseconds === "number" ? value.nanoseconds : 0;
    const millis = seconds * 1000 + Math.floor(nanos / 1_000_000);
    return Number.isFinite(millis) ? millis : 0;
  }

  return 0;
}

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
  lastActivityAt?: InboxSortTimestampInput;
  createdAt?: InboxSortTimestampInput;
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
    lastActivityAt,
    createdAt,
    memberState,
    recentlyReadAt,
    unreadHintCount,
    lastMessageSenderId,
    currentUserId,
  } = input;

  const normalizedLastActivityAt = normalizeInboxTimestamp(lastActivityAt);
  const normalizedCreatedAt =
    normalizeInboxTimestamp(createdAt) || normalizedLastActivityAt;

  const unreadCount = computeUnreadCount({
    lastActivityAt: normalizedLastActivityAt,
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
          timestamp: normalizedLastActivityAt,
          type: mapMessageKindToPreviewType(lastMessageKind),
        }
      : null,
    memberState,
    unreadCount,
    hasMentions: false,
    createdAt: normalizedCreatedAt,
    lastActivityAt: normalizedLastActivityAt,
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
  const lastActivityAt = normalizeInboxTimestamp(
    entry.lastActivityAt as InboxSortTimestampInput,
  );

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
 * Normalized sort fields for the inbox comparator.
 */
export interface ConversationSortFields {
  archived: boolean;
  hidden: boolean;
  pinnedAt: number;
  lastActivityAt: number;
  createdAt: number;
  tieBreaker: string;
}

export function normalizeConversationSortFields(
  conversation: InboxConversation,
): ConversationSortFields {
  const memberState = conversation.memberState ?? getDefaultMemberState("");
  const explicitActivityAt = normalizeInboxTimestamp(
    (conversation as InboxConversation & { lastActivityAt?: unknown })
      .lastActivityAt as InboxSortTimestampInput,
  );
  const lastMessageAt = normalizeInboxTimestamp(
    conversation.lastMessage?.timestamp,
  );
  const createdAt = normalizeInboxTimestamp(conversation.createdAt);
  const lastActivityAt = explicitActivityAt || lastMessageAt || createdAt;

  return {
    archived: !!memberState.archived,
    hidden: !!(memberState.deletedAt && memberState.hiddenUntilNewMessage),
    pinnedAt: normalizeInboxTimestamp(memberState.pinnedAt),
    lastActivityAt,
    createdAt,
    tieBreaker: `${conversation.type}:${conversation.id}`,
  };
}

export interface ConversationSortRank extends ConversationSortFields {
  visibilityRank: number;
  pinnedRank: number;
}

export function getConversationSortRank(
  conversation: InboxConversation,
): ConversationSortRank {
  const fields = normalizeConversationSortFields(conversation);
  return {
    ...fields,
    visibilityRank: fields.archived || fields.hidden ? 1 : 0,
    pinnedRank: fields.pinnedAt > 0 ? 0 : 1,
  };
}

export function compareConversationsForInbox(
  a: InboxConversation,
  b: InboxConversation,
): number {
  const aRank = getConversationSortRank(a);
  const bRank = getConversationSortRank(b);

  if (aRank.visibilityRank !== bRank.visibilityRank) {
    return aRank.visibilityRank - bRank.visibilityRank;
  }

  if (aRank.pinnedRank !== bRank.pinnedRank) {
    return aRank.pinnedRank - bRank.pinnedRank;
  }

  if (aRank.pinnedRank === 0 && aRank.pinnedAt !== bRank.pinnedAt) {
    return bRank.pinnedAt - aRank.pinnedAt;
  }

  if (aRank.lastActivityAt !== bRank.lastActivityAt) {
    return bRank.lastActivityAt - aRank.lastActivityAt;
  }

  if (aRank.createdAt !== bRank.createdAt) {
    return bRank.createdAt - aRank.createdAt;
  }

  return aRank.tieBreaker.localeCompare(bRank.tieBreaker);
}

/**
 * Sort conversations with deterministic, stable ordering.
 *
 * Order:
 *  1. Visible conversations before archived/hidden rows when mixed.
 *  2. Pinned conversations first (most-recently-pinned on top).
 *  3. Non-pinned sorted by canonical last activity.
 *  4. Tie-break by type + conversation ID for full determinism.
 */
export function sortInboxConversations(
  conversations: InboxConversation[],
): InboxConversation[] {
  return [...conversations].sort(compareConversationsForInbox);
}
