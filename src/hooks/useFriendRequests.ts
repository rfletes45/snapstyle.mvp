/**
 * useFriendRequests Hook
 *
 * Real-time subscription to pending friend requests for the inbox.
 * Fetches user details for each request and provides accept/decline actions.
 *
 * @module hooks/useFriendRequests
 */

import { getFirestoreInstance } from "@/services/firebase";
import { acceptFriendRequest, declineFriendRequest } from "@/services/friends";
import { getUserProfile } from "@/services/users";
import type { AvatarConfig } from "@/types/models";
import { createLogger } from "@/utils/log";
import {
  collection,
  onSnapshot,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";

const log = createLogger("useFriendRequests");

// =============================================================================
// Types
// =============================================================================

export interface FriendRequestWithUser {
  /** Request ID */
  id: string;
  /** ID of user who sent the request */
  fromUserId: string;
  /** Sender's display info */
  fromUser: {
    displayName: string;
    avatarUrl: string | null;
    avatarConfig: AvatarConfig | null;
    username: string;
  };
  /** When the request was sent (ms) */
  sentAt: number;
  /** Request status */
  status: "pending";
}

export interface UseFriendRequestsResult {
  /** List of pending requests */
  requests: FriendRequestWithUser[];
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Count of pending requests */
  count: number;
  /** Accept a friend request */
  acceptRequest: (requestId: string) => Promise<void>;
  /** Decline a friend request */
  declineRequest: (requestId: string) => Promise<void>;
  /** Refresh requests */
  refresh: () => void;
}

// =============================================================================
// Hook
// =============================================================================

export function useFriendRequests(uid: string): UseFriendRequestsResult {
  const [requests, setRequests] = useState<FriendRequestWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Subscribe to pending friend requests
  useEffect(() => {
    if (!uid) {
      setRequests([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const db = getFirestoreInstance();

    // Query for requests TO the current user that are pending
    const requestsQuery = query(
      collection(db, "FriendRequests"),
      where("to", "==", uid),
      where("status", "==", "pending"),
    );

    const unsubscribe = onSnapshot(
      requestsQuery,
      async (snapshot) => {
        try {
          // Fetch user details for each request
          const requestsWithUsers = await Promise.all(
            snapshot.docs.map(async (doc) => {
              const data = doc.data();
              const fromUserId = data.from as string;

              // Fetch sender's profile
              let fromUser = {
                displayName: "Unknown User",
                avatarUrl: null as string | null,
                avatarConfig: null as AvatarConfig | null,
                username: "",
              };

              try {
                const profile = await getUserProfile(fromUserId);
                if (profile) {
                  fromUser = {
                    displayName: profile.displayName || "Unknown User",
                    avatarUrl: null,
                    avatarConfig: profile.avatarConfig || null,
                    username: profile.username || "",
                  };
                }
              } catch (e) {
                log.warn(`Failed to fetch profile for ${fromUserId}`, {
                  data: { error: e instanceof Error ? e.message : String(e) },
                });
              }

              // Get timestamp
              let sentAt = Date.now();
              if (data.createdAt) {
                sentAt =
                  data.createdAt instanceof Timestamp
                    ? data.createdAt.toMillis()
                    : data.createdAt;
              }

              return {
                id: doc.id,
                fromUserId,
                fromUser,
                sentAt,
                status: "pending" as const,
              };
            }),
          );

          if (cancelled) return;

          // Sort by sent time (newest first)
          requestsWithUsers.sort((a, b) => b.sentAt - a.sentAt);

          setRequests(requestsWithUsers);
          setLoading(false);
          setError(null);
        } catch (e) {
          if (cancelled) return;
          log.error("Error processing friend requests:", e);
          setError(e instanceof Error ? e : new Error("Unknown error"));
          setLoading(false);
        }
      },
      (err) => {
        if (cancelled) return;
        log.error("Friend requests subscription error:", err);
        setError(err);
        setLoading(false);
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [uid, refreshKey]);

  // Accept request handler
  const acceptRequest = useCallback(async (requestId: string) => {
    try {
      await acceptFriendRequest(requestId);
      // Optimistically remove from list (subscription will update)
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (e) {
      log.error("Error accepting friend request:", e);
      throw e;
    }
  }, []);

  // Decline request handler
  const declineRequest = useCallback(async (requestId: string) => {
    try {
      await declineFriendRequest(requestId);
      // Optimistically remove from list (subscription will update)
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (e) {
      log.error("Error declining friend request:", e);
      throw e;
    }
  }, []);

  // Manual refresh
  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return {
    requests,
    loading,
    error,
    count: requests.length,
    acceptRequest,
    declineRequest,
    refresh,
  };
}
