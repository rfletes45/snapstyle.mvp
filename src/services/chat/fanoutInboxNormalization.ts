import { normalizeConversationRow } from "@/services/chat/normalizeInboxRow";
import type { InboxConversation, MemberStatePrivate } from "@/types/messaging";

export interface FanoutDMConversationInput {
  chatId: string;
  profile: {
    displayName: string;
    avatarUrl: string | null;
    avatarConfig?: unknown;
    profilePictureUrl: string | null;
    decorationId: string | null;
  };
  otherUserId: string;
  memberState: MemberStatePrivate;
  chatData: {
    lastMessageText?: string;
    lastMessageType?: string;
    lastMessageAt?: number;
    createdAt?: number;
    lastMessageSenderId?: string;
  };
  recentlyReadAt?: number;
  currentUserId?: string;
}

export function normalizeFanoutDMConversation(
  input: FanoutDMConversationInput,
): InboxConversation {
  return normalizeConversationRow({
    id: input.chatId,
    type: "dm",
    name: input.profile.displayName,
    avatarUrl: input.profile.avatarUrl,
    avatarConfig: input.profile
      .avatarConfig as InboxConversation["avatarConfig"],
    profilePictureUrl: input.profile.profilePictureUrl,
    decorationId: input.profile.decorationId,
    otherUserId: input.otherUserId,
    lastMessageText: input.chatData.lastMessageText,
    lastMessageSenderName: "",
    lastMessageKind: input.chatData.lastMessageType,
    lastActivityAt: input.chatData.lastMessageAt ?? 0,
    createdAt: input.chatData.createdAt ?? input.chatData.lastMessageAt ?? 0,
    memberState: input.memberState,
    recentlyReadAt: input.recentlyReadAt,
    lastMessageSenderId: input.chatData.lastMessageSenderId,
    currentUserId: input.currentUserId,
  });
}

export interface FanoutGroupConversationInput {
  groupId: string;
  groupData: {
    name?: string;
    avatarUrl?: string | null;
    memberIds?: string[];
    lastMessageText?: string;
    lastMessageSenderName?: string;
    lastMessageType?: string;
    lastMessageAt?: number;
    createdAt?: number;
    memberCount?: number;
    lastMessageSenderId?: string;
    backgroundUrl?: string | null;
  };
  memberState: MemberStatePrivate;
  recentlyReadAt?: number;
  currentUserId?: string;
}

export function normalizeFanoutGroupConversation(
  input: FanoutGroupConversationInput,
): InboxConversation {
  return normalizeConversationRow({
    id: input.groupId,
    type: "group",
    name: input.groupData.name || "Unnamed Group",
    avatarUrl: input.groupData.avatarUrl || null,
    avatarIds: input.groupData.memberIds?.slice(0, 4),
    lastMessageText: input.groupData.lastMessageText,
    lastMessageSenderName: input.groupData.lastMessageSenderName || "",
    lastMessageKind: input.groupData.lastMessageType,
    lastActivityAt: input.groupData.lastMessageAt ?? 0,
    createdAt: input.groupData.createdAt ?? input.groupData.lastMessageAt ?? 0,
    memberState: input.memberState,
    recentlyReadAt: input.recentlyReadAt,
    participantCount:
      input.groupData.memberCount || input.groupData.memberIds?.length || 0,
    backgroundUrl: input.groupData.backgroundUrl ?? null,
    lastMessageSenderId: input.groupData.lastMessageSenderId,
    currentUserId: input.currentUserId,
  });
}
