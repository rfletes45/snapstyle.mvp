import { prefetchCriticalProfileAssets } from "@/services/cosmeticsAssetCache";
import { getGroup, getGroupMembersForDisplay } from "@/services/groups";
import type { GroupMember } from "@/types/models";
import { createLogger } from "@/utils/log";
import { normalizeRemoteImageUrl } from "@/utils/remoteImageSource";
import { Image, type ImageRef } from "expo-image";

const log = createLogger("threadIdentityWarmup");

const GROUP_MEMBER_CACHE_TTL_MS = 5 * 60 * 1000;

const imageRefCache = new Map<string, ImageRef>();
const imageWarmPromises = new Map<string, Promise<ImageRef | null>>();
const groupMemberCache = new Map<
  string,
  { members: GroupMember[]; preparedAt: number }
>();

function normalizeUrls(
  urls: (string | null | undefined)[] | undefined,
): string[] {
  if (!urls) return [];
  return Array.from(
    new Set(
      urls
        .map((url) => normalizeRemoteImageUrl(url) ?? "")
        .filter((url) => url.length > 0),
    ),
  );
}

function isGroupMemberCacheFresh(
  entry: { members: GroupMember[]; preparedAt: number } | undefined,
): entry is { members: GroupMember[]; preparedAt: number } {
  return !!entry && Date.now() - entry.preparedAt <= GROUP_MEMBER_CACHE_TTL_MS;
}

async function warmRemoteImage(url: string): Promise<ImageRef | null> {
  const cached = imageRefCache.get(url);
  if (cached) return cached;

  const existingPromise = imageWarmPromises.get(url);
  if (existingPromise) return existingPromise;

  const nextPromise = Image.loadAsync(url)
    .then((ref) => {
      imageRefCache.set(url, ref);
      return ref;
    })
    .catch((error) => {
      if (__DEV__) {
        log.debug("Failed to warm remote identity image", {
          data: {
            url: url.slice(0, 120),
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
      return null;
    })
    .finally(() => {
      imageWarmPromises.delete(url);
    });

  imageWarmPromises.set(url, nextPromise);
  return nextPromise;
}

export async function warmIdentityImageUrls(
  urls: (string | null | undefined)[] | undefined,
): Promise<void> {
  const normalized = normalizeUrls(urls);
  if (normalized.length === 0) return;

  await Promise.all(normalized.map((url) => warmRemoteImage(url)));
}

export async function warmIdentityDecorations(
  decorationIds: (string | null | undefined)[] | undefined,
): Promise<void> {
  const ids = Array.from(
    new Set(
      (decorationIds ?? [])
        .map((id) => (typeof id === "string" ? id.trim() : ""))
        .filter((id) => id.length > 0),
    ),
  );

  if (ids.length === 0) return;

  await Promise.all(
    ids.map((decorationId) =>
      prefetchCriticalProfileAssets({ decorationId }).catch((error) => {
        if (__DEV__) {
          log.debug("Failed to warm decoration asset", {
            data: {
              decorationId,
              error: error instanceof Error ? error.message : String(error),
            },
          });
        }
      }),
    ),
  );
}

export async function prepareDmThreadEntry(params: {
  avatarUrl?: string | null;
  decorationId?: string | null;
}): Promise<void> {
  await Promise.all([
    warmIdentityImageUrls([params.avatarUrl]),
    warmIdentityDecorations([params.decorationId]),
  ]);
}

export function cachePreparedGroupMembers(
  groupId: string,
  members: GroupMember[],
): void {
  if (!groupId) return;
  groupMemberCache.set(groupId, {
    members,
    preparedAt: Date.now(),
  });
}

export function getPreparedGroupMembers(groupId: string): GroupMember[] | null {
  if (!groupId) return null;
  const cached = groupMemberCache.get(groupId);
  if (!isGroupMemberCacheFresh(cached)) return null;
  return cached.members;
}

export async function warmGroupIdentityAssets(params: {
  groupAvatarUrl?: string | null;
  backgroundUrl?: string | null;
  members?: GroupMember[];
}): Promise<void> {
  await Promise.all([
    warmIdentityImageUrls([
      params.groupAvatarUrl,
      params.backgroundUrl,
      ...(params.members?.map((member) => member.profilePictureUrl) ?? []),
    ]),
    warmIdentityDecorations(
      params.members?.map((member) => member.decorationId) ?? [],
    ),
  ]);
}

export async function prepareGroupThreadEntry(
  groupId: string,
  params?: {
    groupAvatarUrl?: string | null;
    backgroundUrl?: string | null;
  },
): Promise<GroupMember[]> {
  const cached = groupMemberCache.get(groupId);
  if (isGroupMemberCacheFresh(cached)) {
    await warmGroupIdentityAssets({
      groupAvatarUrl: params?.groupAvatarUrl,
      backgroundUrl: params?.backgroundUrl,
      members: cached.members,
    });
    return cached.members;
  }

  const members = await getGroupMembersForDisplay(groupId);
  cachePreparedGroupMembers(groupId, members);
  await warmGroupIdentityAssets({
    groupAvatarUrl: params?.groupAvatarUrl,
    backgroundUrl: params?.backgroundUrl,
    members,
  });
  return members;
}

// ---------------------------------------------------------------------------
// Centralized group-chat navigation preparation
// ---------------------------------------------------------------------------

/**
 * Params returned by `prepareGroupChatNavigation` to be spread into
 * `navigation.navigate("GroupChat", ...)`.
 */
export interface GroupChatNavParams {
  groupId: string;
  groupName?: string;
  targetMessageId?: string;
  jumpRequestId?: string;
  initialGroupData?: {
    name: string;
    avatarUrl: string | null;
    backgroundUrl: string | null;
  };
}

/**
 * Centralised helper that fetches group metadata (if not already known),
 * warms the image cache for avatar + background, and returns the complete
 * set of navigation params for GroupChatScreen.
 *
 * Callers should `await` this before calling `navigation.navigate`.
 * If the group doc fetch fails, the function still returns valid params
 * so navigation can proceed (background will load via Firestore fallback).
 */
export async function prepareGroupChatNavigation(params: {
  groupId: string;
  groupName?: string;
  groupAvatarUrl?: string | null;
  backgroundUrl?: string | null;
  targetMessageId?: string;
  jumpRequestId?: string;
}): Promise<GroupChatNavParams> {
  let { groupName, groupAvatarUrl, backgroundUrl } = params;

  // If background URL is unknown, do a lightweight group-doc fetch
  if (backgroundUrl === undefined || backgroundUrl === null) {
    try {
      const group = await getGroup(params.groupId);
      if (group) {
        groupName = groupName || group.name;
        groupAvatarUrl = groupAvatarUrl ?? group.avatarUrl ?? null;
        backgroundUrl = group.backgroundUrl ?? null;
      }
    } catch (err) {
      log.debug("prepareGroupChatNavigation: group fetch failed, proceeding", {
        data: { groupId: params.groupId },
      });
    }
  }

  // Warm images (avatar + background + member avatars) in parallel
  try {
    await prepareGroupThreadEntry(params.groupId, {
      groupAvatarUrl: groupAvatarUrl ?? null,
      backgroundUrl: backgroundUrl ?? null,
    });
  } catch (err) {
    log.debug("prepareGroupChatNavigation: warmup failed, proceeding", {
      data: { groupId: params.groupId },
    });
  }

  return {
    groupId: params.groupId,
    groupName,
    ...(params.targetMessageId && {
      targetMessageId: params.targetMessageId,
    }),
    ...(params.jumpRequestId && { jumpRequestId: params.jumpRequestId }),
    initialGroupData: {
      name: groupName || "",
      avatarUrl: groupAvatarUrl ?? null,
      backgroundUrl: backgroundUrl ?? null,
    },
  };
}
