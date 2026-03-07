import { useFriendRequests, type FriendRequestWithUser } from "@/hooks/useFriendRequests";
import { useMessageRequests } from "@/hooks/useMessageRequests";
import {
  acceptGroupInvite,
  declineGroupInvite,
  getPendingInvites,
  subscribeToPendingInvites,
} from "@/services/groups";
import type { MessageRequest } from "@/types/messaging";
import type { GroupInvite } from "@/types/models";
import { createLogger } from "@/utils/log";
import {
  mergeUnifiedInboxRequests,
  type UnifiedInboxRequestItem,
} from "@/services/chat/unifiedInboxRequests";
import { useCallback, useEffect, useMemo, useState } from "react";

const log = createLogger("useUnifiedInboxRequests");

export interface UnifiedInboxRequestsResult {
  items: UnifiedInboxRequestItem<FriendRequestWithUser>[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  friendRequests: FriendRequestWithUser[];
  groupInvites: GroupInvite[];
  messageRequests: MessageRequest[];
  acceptFriendRequest: (requestId: string) => Promise<void>;
  declineFriendRequest: (requestId: string) => Promise<void>;
  acceptGroupInviteRequest: (invite: GroupInvite) => Promise<void>;
  declineGroupInviteRequest: (invite: GroupInvite) => Promise<void>;
  acceptMessageRequest: (chatId: string) => Promise<void>;
  declineMessageRequest: (chatId: string, blockRequester?: boolean) => Promise<void>;
}

export function useUnifiedInboxRequests(uid: string): UnifiedInboxRequestsResult {
  const {
    requests: friendRequests,
    loading: friendLoading,
    error: friendError,
    acceptRequest: acceptFriendRequest,
    declineRequest: declineFriendRequest,
    refresh: refreshFriendRequests,
  } = useFriendRequests(uid);
  const {
    requests: messageRequests,
    loading: messageLoading,
    error: messageError,
    accept: acceptMessageRequest,
    decline: declineMessageRequest,
    refresh: refreshMessageRequests,
  } = useMessageRequests(uid);

  const [groupInvites, setGroupInvites] = useState<GroupInvite[]>([]);
  const [groupLoading, setGroupLoading] = useState(true);
  const [groupError, setGroupError] = useState<Error | null>(null);

  useEffect(() => {
    if (!uid) {
      setGroupInvites([]);
      setGroupLoading(false);
      return;
    }

    setGroupLoading(true);
    const unsubscribe = subscribeToPendingInvites(uid, (invites) => {
      setGroupInvites(invites);
      setGroupLoading(false);
      setGroupError(null);
    });

    return unsubscribe;
  }, [uid]);

  const refresh = useCallback(async () => {
    refreshFriendRequests();
    refreshMessageRequests();
    if (!uid) return;

    try {
      const invites = await getPendingInvites(uid);
      setGroupInvites(invites);
      setGroupError(null);
    } catch (error) {
      log.error("Failed to refresh pending group invites", {
        data: { uid, error },
      });
      setGroupError(error as Error);
    }
  }, [refreshFriendRequests, refreshMessageRequests, uid]);

  const acceptGroupInviteRequest = useCallback(
    async (invite: GroupInvite) => {
      if (!uid) return;
      await acceptGroupInvite(invite.id, uid);
      setGroupInvites((prev) => prev.filter((item) => item.id !== invite.id));
    },
    [uid],
  );

  const declineGroupInviteRequest = useCallback(
    async (invite: GroupInvite) => {
      if (!uid) return;
      await declineGroupInvite(invite.id, uid);
      setGroupInvites((prev) => prev.filter((item) => item.id !== invite.id));
    },
    [uid],
  );

  const items = useMemo(
    () =>
      mergeUnifiedInboxRequests({
        friendRequests,
        groupInvites,
        messageRequests,
      }),
    [friendRequests, groupInvites, messageRequests],
  );

  const loading = friendLoading || messageLoading || groupLoading;
  const error = friendError || messageError || groupError;

  return {
    items,
    loading,
    error,
    refresh,
    friendRequests,
    groupInvites,
    messageRequests,
    acceptFriendRequest,
    declineFriendRequest,
    acceptGroupInviteRequest,
    declineGroupInviteRequest,
    acceptMessageRequest,
    declineMessageRequest,
  };
}
