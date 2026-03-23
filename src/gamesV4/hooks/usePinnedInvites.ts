/**
 * Games V4 - usePinnedInvites Hook
 *
 * Subscribes to pinned game invite IDs on a conversation doc,
 * then resolves each invite into a live GameInviteV4 object.
 *
 * Listener ownership is incremental:
 * - add listeners only for newly pinned IDs
 * - remove listeners only for IDs that disappeared
 * - clear everything only when the conversation changes or the hook unmounts
 *
 * @module gamesV4/hooks/usePinnedInvites
 */

import {
  subscribeToInvite,
  subscribeToPinnedInviteIds,
} from "@/gamesV4/services/gameServiceV4";
import type { GameInviteV4 } from "@/gamesV4/types";
import { useEffect, useRef, useState } from "react";

interface UsePinnedInvitesResult {
  /** Live pinned invites, ordered by pin order (newest last). */
  invites: GameInviteV4[];
  /** Whether we're loading the initial data. */
  loading: boolean;
  /** Error if subscription failed. */
  error: Error | null;
}

export function usePinnedInvites(
  conversationId: string | undefined,
  scope: "dm" | "group",
): UsePinnedInvitesResult {
  const [inviteIds, setInviteIds] = useState<string[]>([]);
  const [inviteMap, setInviteMap] = useState<Record<string, GameInviteV4>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const inviteUnsubs = useRef<Record<string, () => void>>({});
  const conversationKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const nextKey = conversationId ? `${scope}:${conversationId}` : null;
    if (
      conversationKeyRef.current !== null &&
      conversationKeyRef.current !== nextKey
    ) {
      Object.values(inviteUnsubs.current).forEach((unsub) => unsub());
      inviteUnsubs.current = {};
      setInviteIds([]);
      setInviteMap({});
      setError(null);
      setLoading(nextKey !== null);
    }
    conversationKeyRef.current = nextKey;
  }, [conversationId, scope]);

  useEffect(() => {
    if (!conversationId) {
      setInviteIds([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsub = subscribeToPinnedInviteIds(
      conversationId,
      scope,
      (ids) => {
        setInviteIds(ids);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    return unsub;
  }, [conversationId, scope]);

  useEffect(() => {
    const currentIds = new Set(inviteIds);
    const existingIds = new Set(Object.keys(inviteUnsubs.current));

    for (const id of existingIds) {
      if (!currentIds.has(id)) {
        inviteUnsubs.current[id]?.();
        delete inviteUnsubs.current[id];
        setInviteMap((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    }

    for (const id of currentIds) {
      if (!existingIds.has(id)) {
        const unsub = subscribeToInvite(
          id,
          (invite) => {
            if (invite) {
              setInviteMap((prev) => ({ ...prev, [id]: invite }));
              return;
            }

            setInviteMap((prev) => {
              const next = { ...prev };
              delete next[id];
              return next;
            });
          },
          () => {
            // Gracefully handle deleted or no-longer-readable invite docs by
            // removing them from the resolved map while keeping other pins live.
            setInviteMap((prev) => {
              const next = { ...prev };
              delete next[id];
              return next;
            });
          },
        );
        inviteUnsubs.current[id] = unsub;
      }
    }
  }, [inviteIds]);

  useEffect(() => {
    return () => {
      Object.values(inviteUnsubs.current).forEach((unsub) => unsub());
      inviteUnsubs.current = {};
    };
  }, []);

  const invites = inviteIds
    .map((id) => inviteMap[id])
    .filter((inv): inv is GameInviteV4 => inv != null);

  return { invites, loading, error };
}
