/**
 * Games V4 — usePinnedInvites Hook
 *
 * Subscribes to pinned game invite IDs on a conversation doc,
 * then resolves each invite into a live GameInviteV4 object.
 *
 * Used by the PinnedInviteBar component.
 *
 * ACCEPTED-RISK N5: The cleanup function at the bottom of the
 * inviteIds effect tears down ALL invite subscriptions on every
 * `inviteIds` change, then re-subscribes them. This causes a brief
 * UI flicker when pins change. Cosmetic only — no data loss.
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

  // Track individual invite subscriptions
  const inviteUnsubs = useRef<Record<string, () => void>>({});

  // Subscribe to pinned invite IDs
  useEffect(() => {
    if (!conversationId) {
      setInviteIds([]);
      setLoading(false);
      return;
    }

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

  // Subscribe to individual invite docs when IDs change
  useEffect(() => {
    const currentIds = new Set(inviteIds);
    const existingIds = new Set(Object.keys(inviteUnsubs.current));

    // Unsubscribe from removed IDs
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

    // Subscribe to new IDs
    for (const id of currentIds) {
      if (!existingIds.has(id)) {
        const unsub = subscribeToInvite(
          id,
          (invite) => {
            if (invite) {
              setInviteMap((prev) => ({ ...prev, [id]: invite }));
            } else {
              setInviteMap((prev) => {
                const next = { ...prev };
                delete next[id];
                return next;
              });
            }
          },
          (err) => {
            // Gracefully handle permission-denied (e.g. deleted invite doc)
            // by removing the invite from the map
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

    return () => {
      // Cleanup all invite subscriptions
      Object.values(inviteUnsubs.current).forEach((unsub) => unsub());
      inviteUnsubs.current = {};
    };
  }, [inviteIds]);

  // Build ordered invites array
  const invites = inviteIds
    .map((id) => inviteMap[id])
    .filter((inv): inv is GameInviteV4 => inv != null);

  return { invites, loading, error };
}
