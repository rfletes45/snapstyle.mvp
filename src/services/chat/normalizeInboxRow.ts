import type {
  InboxConversation,
  InboxEntry,
  MemberStatePrivate,
} from "@/types/messaging";

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
}

/**
 * Canonical unread rule for inbox rows (fan-out and aggregated modes):
 * 1) recent optimistic read wins (temporary override)
 * 2) manual unread marker wins
 * 3) otherwise compare last activity vs private read watermark (+ tolerance)
 * 4) fallback to server-provided unread hint only when private watermark is absent
 */
export function computeUnreadCount(input: ComputeUnreadCountInput): number {
  const {
    lastActivityAt,
    memberState,
    recentlyReadAt,
    unreadHintCount = 0,
    now = Date.now(),
  } = input;

  if (recentlyReadAt && now - recentlyReadAt < RECENTLY_READ_TTL_MS) {
    return 0;
  }

  if (
    memberState.lastMarkedUnreadAt &&
    memberState.lastMarkedUnreadAt > memberState.lastSeenAtPrivate
  ) {
    return 1;
  }

  if (lastActivityAt > memberState.lastSeenAtPrivate + UNREAD_TOLERANCE_MS) {
    return 1;
  }

  // If no private watermark exists yet (cold start/new member doc), respect
  // any server-side unread hint as a best-effort fallback.
  if (!memberState.lastSeenAtPrivate && unreadHintCount > 0) {
    return 1;
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
  lastMessageText?: string | null;
  lastMessageSenderName?: string;
  lastMessageKind?: string;
  lastActivityAt?: number;
  createdAt?: number;
  memberState: MemberStatePrivate;
  recentlyReadAt?: number;
  unreadHintCount?: number;
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
  } = input;

  const unreadCount = computeUnreadCount({
    lastActivityAt,
    memberState,
    recentlyReadAt,
    unreadHintCount,
  });

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
    otherUserId: isDm ? entry.otherUserId : undefined,
    participantCount: entry.memberCount,
    lastMessageText: entry.lastMessagePreview || "",
    lastMessageSenderName: "",
    lastMessageKind: entry.lastMessageKind,
    lastActivityAt,
    createdAt: lastActivityAt,
    memberState,
    recentlyReadAt,
    unreadHintCount: entry.unreadCount || 0,
  });
}

export function sortInboxConversations(
  conversations: InboxConversation[],
): InboxConversation[] {
  return [...conversations].sort((a, b) => {
    const aPinned = a.memberState.pinnedAt ?? 0;
    const bPinned = b.memberState.pinnedAt ?? 0;

    if (aPinned && bPinned) return bPinned - aPinned;
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;

    const aTime = a.lastMessage?.timestamp ?? a.createdAt;
    const bTime = b.lastMessage?.timestamp ?? b.createdAt;
    if (aTime !== bTime) return bTime - aTime;

    return a.id.localeCompare(b.id);
  });
}
