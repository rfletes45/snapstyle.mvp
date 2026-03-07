import type { MessageRequest } from "@/types/messaging";
import type { GroupInvite } from "@/types/models";

export interface FriendRequestForInbox {
  id: string;
  sentAt: number;
}

export type UnifiedInboxRequestItem<
  TFriendRequest extends FriendRequestForInbox = FriendRequestForInbox,
> =
  | {
      id: string;
      kind: "friend_request";
      createdAt: number;
      friendRequest: TFriendRequest;
    }
  | {
      id: string;
      kind: "group_invite";
      createdAt: number;
      groupInvite: GroupInvite;
    }
  | {
      id: string;
      kind: "message_request";
      createdAt: number;
      messageRequest: MessageRequest;
    };

export interface MergeUnifiedInboxRequestsInput<TFriendRequest extends FriendRequestForInbox> {
  friendRequests: TFriendRequest[];
  groupInvites: GroupInvite[];
  messageRequests: MessageRequest[];
}

export function mergeUnifiedInboxRequests<TFriendRequest extends FriendRequestForInbox>(
  input: MergeUnifiedInboxRequestsInput<TFriendRequest>,
): UnifiedInboxRequestItem<TFriendRequest>[] {
  const merged = [
    ...input.friendRequests.map((friendRequest) => ({
      id: friendRequest.id,
      kind: "friend_request" as const,
      createdAt: friendRequest.sentAt,
      friendRequest,
    })),
    ...input.groupInvites.map((groupInvite) => ({
      id: groupInvite.id,
      kind: "group_invite" as const,
      createdAt: groupInvite.createdAt,
      groupInvite,
    })),
    ...input.messageRequests.map((messageRequest) => ({
      id: messageRequest.chatId,
      kind: "message_request" as const,
      createdAt: messageRequest.createdAt,
      messageRequest,
    })),
  ];

  const deduped = new Map<string, UnifiedInboxRequestItem<TFriendRequest>>();
  for (const item of merged) {
    deduped.set(`${item.kind}:${item.id}`, item);
  }

  return Array.from(deduped.values()).sort((a, b) => {
    if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
    return a.id.localeCompare(b.id);
  });
}
