/**
 * useTopStreaks — Real-time subscription to the user's top friend streaks.
 *
 * Queries Firestore `Friends` collection and returns the top N friendships
 * sorted by streakCount DESC, enriched with the partner's display name and
 * avatar URL.  Also derives per-streak status (active / at_risk / expired)
 * using the canonical helpers from `streakCosmetics`.
 *
 * This hook is the **single canonical source** for widget-level streak data.
 *
 * @module hooks/useTopStreaks
 */

import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";

import { getFirestoreInstance } from "@/services/firebase";
import { getUserProfileByUid } from "@/services/friends";
import {
  deriveStreakStatus,
  nextMilestone,
  type StreakStatus,
} from "@/services/streakCosmetics";
import type { Friend } from "@/types/models";

import { createLogger } from "@/utils/log";
const logger = createLogger("hooks/useTopStreaks");

// ─── Public types ─────────────────────────────────────────────────────────────

export interface StreakSummary {
  /** Friendship doc ID. */
  friendshipId: string;
  /** The other user's UID. */
  partnerUid: string;
  /** Partner display name (fetched). */
  partnerName: string;
  /** Partner avatar URL if available. */
  partnerPictureUrl: string | null;
  /** Partner avatar decoration ID if available. */
  partnerDecorationId: string | null;
  /** Current streak count (from Firestore). */
  streakCount: number;
  /** All-time best streak for this friendship. */
  bestStreak: number;
  /** Derived display status. */
  status: StreakStatus;
  /** Next milestone to reach. */
  nextMilestone: number | null;
  /** Whether grace was recently used (protection). */
  graceUsed: boolean;
}

export interface TopStreaksResult {
  /** Top N streak summaries, sorted by streakCount DESC. */
  streaks: StreakSummary[];
  /** Total number of friendships with active streaks (count > 0). */
  activeStreakCount: number;
  /** The single highest current streak count across all friends. */
  topStreakCount: number;
  /** Whether the initial load is still in progress. */
  loading: boolean;
  /** Error message if the subscription failed. */
  error: string | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const MAX_STREAKS = 5;

export function useTopStreaks(uid: string | undefined): TopStreaksResult {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [profiles, setProfiles] = useState<
    Map<
      string,
      { name: string; pictureUrl: string | null; decorationId: string | null }
    >
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Real-time Friends subscription ──────────────────────────────────
  useEffect(() => {
    if (!uid) {
      setFriends([]);
      setLoading(false);
      return;
    }

    const db = getFirestoreInstance();
    const q = query(
      collection(db, "Friends"),
      where("users", "array-contains", uid),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs: Friend[] = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Friend[];
        setFriends(docs);
        setLoading(false);
        setError(null);
      },
      (err) => {
        logger.error("Friends snapshot error:", err);
        setError("Could not load streaks");
        setLoading(false);
      },
    );

    return unsub;
  }, [uid]);

  // ── Enrich top streaks with profile data ────────────────────────────
  const topFriends = useMemo(() => {
    if (!uid) return [];
    return [...friends]
      .filter((f) => f.streakCount > 0)
      .sort((a, b) => b.streakCount - a.streakCount)
      .slice(0, MAX_STREAKS);
  }, [friends, uid]);

  useEffect(() => {
    if (!uid || topFriends.length === 0) return;

    let cancelled = false;

    async function enrich() {
      const entries: Array<
        [
          string,
          {
            name: string;
            pictureUrl: string | null;
            decorationId: string | null;
          },
        ]
      > = [];

      await Promise.all(
        topFriends.map(async (f) => {
          const partnerUid = f.users[0] === uid ? f.users[1] : f.users[0];
          // Skip if already cached
          if (profiles.has(partnerUid)) return;
          try {
            const p = await getUserProfileByUid(partnerUid);
            if (p && !cancelled) {
              entries.push([
                partnerUid,
                {
                  name: p.displayName ?? p.username ?? "Friend",
                  pictureUrl: p.profilePicture?.url ?? null,
                  decorationId: p.avatarDecoration?.equippedId ?? null,
                },
              ]);
            }
          } catch {
            // Non-critical - fall back to "Friend"
          }
        }),
      );

      if (!cancelled && entries.length > 0) {
        setProfiles((prev) => {
          const next = new Map(prev);
          for (const [k, v] of entries) next.set(k, v);
          return next;
        });
      }
    }

    enrich();
    return () => {
      cancelled = true;
    };
    // profiles intentionally omitted to avoid infinite loop — we only
    // enrich on topFriends changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, topFriends]);

  // ── Derive summaries ────────────────────────────────────────────────
  const result = useMemo<TopStreaksResult>(() => {
    if (!uid) {
      return {
        streaks: [],
        activeStreakCount: 0,
        topStreakCount: 0,
        loading,
        error,
      };
    }

    const today = new Date().toISOString().slice(0, 10);
    const activeCount = friends.filter((f) => f.streakCount > 0).length;

    const streaks: StreakSummary[] = topFriends.map((f) => {
      const partnerUid = f.users[0] === uid ? f.users[1] : f.users[0];
      const isUid1 = f.users[0] === uid;
      const lastSentSelf =
        (isUid1 ? f.lastSentDay_uid1 : f.lastSentDay_uid2) ?? "";
      const lastSentOther =
        (isUid1 ? f.lastSentDay_uid2 : f.lastSentDay_uid1) ?? "";

      const { status } = deriveStreakStatus(
        f.streakCount,
        f.streakUpdatedDay,
        lastSentSelf,
        lastSentOther,
      );

      const cached = profiles.get(partnerUid);

      const graceUsed =
        !!f.streakGraceUsedAt && daysBetween(f.streakGraceUsedAt, today) <= 7;

      return {
        friendshipId: f.id,
        partnerUid,
        partnerName: cached?.name ?? "Friend",
        partnerPictureUrl: cached?.pictureUrl ?? null,
        partnerDecorationId: cached?.decorationId ?? null,
        streakCount: f.streakCount,
        bestStreak: f.streakBestCount ?? f.streakCount,
        status,
        nextMilestone: nextMilestone(f.streakCount),
        graceUsed,
      };
    });

    return {
      streaks,
      activeStreakCount: activeCount,
      topStreakCount: streaks[0]?.streakCount ?? 0,
      loading,
      error,
    };
  }, [uid, friends, topFriends, profiles, loading, error]);

  return result;
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function daysBetween(a: string, b: string): number {
  const msA = Date.parse(a + "T00:00:00Z");
  const msB = Date.parse(b + "T00:00:00Z");
  return Math.round(Math.abs(msB - msA) / 86_400_000);
}
