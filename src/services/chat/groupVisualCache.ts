import { normalizeRemoteImageUrl } from "@/utils/remoteImageSource";

export interface GroupVisuals {
  avatarUrl: string | null;
  backgroundUrl: string | null;
  fetchedAt: number;
}

const GROUP_VISUAL_CACHE_TTL_MS = 5 * 60 * 1000;
const groupVisualCache = new Map<string, GroupVisuals>();

export function getCachedGroupVisuals(groupId: string): GroupVisuals | null {
  if (!groupId) return null;
  const cached = groupVisualCache.get(groupId);
  if (!cached) return null;
  if (Date.now() - cached.fetchedAt > GROUP_VISUAL_CACHE_TTL_MS) {
    groupVisualCache.delete(groupId);
    return null;
  }
  return cached;
}

export function setCachedGroupVisuals(
  groupId: string,
  visuals: {
    avatarUrl?: string | null;
    backgroundUrl?: string | null;
    fetchedAt?: number;
  },
): GroupVisuals | null {
  if (!groupId) return null;

  const next: GroupVisuals = {
    avatarUrl: normalizeRemoteImageUrl(visuals.avatarUrl) ?? null,
    backgroundUrl: normalizeRemoteImageUrl(visuals.backgroundUrl) ?? null,
    fetchedAt: visuals.fetchedAt ?? Date.now(),
  };

  groupVisualCache.set(groupId, next);
  return next;
}

export function patchCachedGroupVisuals(
  groupId: string,
  patch: Partial<Pick<GroupVisuals, "avatarUrl" | "backgroundUrl">>,
): GroupVisuals | null {
  if (!groupId) return null;

  const existing = groupVisualCache.get(groupId);
  const next: GroupVisuals = {
    avatarUrl:
      patch.avatarUrl === undefined
        ? (existing?.avatarUrl ?? null)
        : (normalizeRemoteImageUrl(patch.avatarUrl) ?? null),
    backgroundUrl:
      patch.backgroundUrl === undefined
        ? (existing?.backgroundUrl ?? null)
        : (normalizeRemoteImageUrl(patch.backgroundUrl) ?? null),
    fetchedAt: Date.now(),
  };

  groupVisualCache.set(groupId, next);
  return next;
}

export function invalidateGroupVisuals(groupId: string): void {
  if (!groupId) return;
  groupVisualCache.delete(groupId);
}
