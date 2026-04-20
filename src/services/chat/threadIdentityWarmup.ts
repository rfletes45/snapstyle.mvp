import {
  getGroupBackgroundStateSnapshot,
  resolveGroupBackgroundUrl,
  setSessionGroupBackgroundState,
} from "@/services/chat/groupBackgroundState";
import {
  describeRemoteUrlForLog,
  rememberPreparedGroupChatData,
  traceGroupWallpaper,
} from "@/services/chat/groupWallpaperDebug";
import { prefetchCriticalProfileAssets } from "@/services/cosmeticsAssetCache";
import { getGroup, getGroupMembersForDisplay } from "@/services/groups";
import type { GroupMember } from "@/types/models";
import { createLogger } from "@/utils/log";
import { normalizeRemoteImageUrl } from "@/utils/remoteImageSource";
import { Image, type ImageRef } from "expo-image";

const log = createLogger("threadIdentityWarmup");

const GROUP_MEMBER_CACHE_TTL_MS = 5 * 60 * 1000;

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

// ---------------------------------------------------------------------------
// Background ImageRef retention
// ---------------------------------------------------------------------------
// Image.loadAsync() returns an ImageRef — a strong native reference to the
// decoded bitmap (UIImage / Drawable). As long as a JS reference to the
// ImageRef exists, the native bitmap stays pinned in memory and will NOT be
// evicted by the platform's LRU cache. Passing an ImageRef as <Image source>
// renders the bitmap instantly with zero cache-lookup or decode cost.
//
// Previously, warmRemoteImage discarded the ImageRef (.then(() => {})).
// On the first session open the native memory cache was mostly empty so the
// bitmap survived long enough for <AppImage> to grab it. On later opens the
// cache was full of avatars / chat images and the bitmap was evicted before
// the component mounted, forcing a ~50-200 ms disk re-decode (visible as
// delayed wallpaper pop-in). Retaining the ImageRef eliminates this.
// ---------------------------------------------------------------------------

const bgRefCache = new Map<string, ImageRef>();
const MAX_BG_REFS = 3;

function retainBackgroundRef(normalizedUrl: string, ref: ImageRef): void {
  // Delete-then-set keeps Map insertion order = LRU order.
  bgRefCache.delete(normalizedUrl);
  if (bgRefCache.size >= MAX_BG_REFS) {
    const oldest = bgRefCache.keys().next().value;
    if (oldest !== undefined) bgRefCache.delete(oldest);
  }
  bgRefCache.set(normalizedUrl, ref);
  if (__DEV__) {
    log.info("Retained warmed background ImageRef", {
      data: {
        backgroundKey: describeRemoteUrlForLog(normalizedUrl).key,
        cacheSize: bgRefCache.size,
      },
    });
  }
}

/**
 * Returns a retained ImageRef for the given background URL, if one was
 * previously warmed via warmGroupIdentityAssets / prepareGroupThreadEntry.
 * When non-null, passing this as `<Image source>` renders the bitmap
 * instantly with no cache lookup or disk decode.
 */
export function getCachedBackgroundRef(
  url: string | null | undefined,
): ImageRef | null {
  const normalized = normalizeRemoteImageUrl(url);
  if (!normalized) return null;
  return bgRefCache.get(normalized) ?? null;
}

export function clearCachedBackgroundRef(url: string | null | undefined): void {
  const normalized = normalizeRemoteImageUrl(url);
  if (!normalized) return;
  bgRefCache.delete(normalized);
}

async function warmRemoteImage(url: string): Promise<ImageRef | null> {
  const existingPromise = imageWarmPromises.get(url);
  if (existingPromise) {
    if (__DEV__) {
      log.info("Reusing in-flight remote image warm", {
        data: { backgroundKey: describeRemoteUrlForLog(url).key },
      });
    }
    return existingPromise;
  }

  if (__DEV__) {
    log.info("Starting remote image warm", {
      data: { backgroundKey: describeRemoteUrlForLog(url).key },
    });
  }

  const nextPromise: Promise<ImageRef | null> = Image.loadAsync(url)
    .then((ref) => {
      if (__DEV__) {
        log.info("Resolved remote image warm", {
          data: { backgroundKey: describeRemoteUrlForLog(url).key },
        });
      }
      return ref;
    })
    .catch((error): null => {
      if (__DEV__) {
        log.debug("Failed to warm remote identity image", {
          data: {
            backgroundKey: describeRemoteUrlForLog(url).key,
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
  groupId?: string;
  groupAvatarUrl?: string | null;
  backgroundUrl?: string | null;
  members?: GroupMember[];
}): Promise<void> {
  // Start the background warm separately so we can capture the ImageRef for
  // retention as soon as IT resolves, independent of the slower member-avatar
  // and decoration warmup. warmRemoteImage deduplicates via imageWarmPromises,
  // so the call inside warmIdentityImageUrls for the same URL returns this
  // exact promise — no double Image.loadAsync.
  const resolvedBackgroundUrl = params.groupId
    ? resolveGroupBackgroundUrl(params.groupId, params.backgroundUrl, {
        source: "warm-group-identity-assets",
        candidateAuthority: "helper",
      })
    : normalizeRemoteImageUrl(params.backgroundUrl);
  const bgNormalized = normalizeRemoteImageUrl(resolvedBackgroundUrl);
  if (__DEV__ && params.groupId) {
    traceGroupWallpaper(params.groupId, "warm-group-assets-start", {
      avatarKey: describeRemoteUrlForLog(params.groupAvatarUrl).key,
      backgroundKey: describeRemoteUrlForLog(bgNormalized).key,
      memberCount: params.members?.length ?? 0,
    });
  }
  const bgRefPromise = bgNormalized
    ? warmRemoteImage(bgNormalized).then((ref) => {
        if (ref) retainBackgroundRef(bgNormalized, ref);
        if (__DEV__ && params.groupId) {
          traceGroupWallpaper(
            params.groupId,
            "warm-group-assets-background-ready",
            {
              backgroundKey: describeRemoteUrlForLog(bgNormalized).key,
              retained: !!ref,
            },
          );
        }
      })
    : null;

  await Promise.all([
    warmIdentityImageUrls([
      params.groupAvatarUrl,
      resolvedBackgroundUrl,
      ...(params.members?.map((member) => member.profilePictureUrl) ?? []),
    ]),
    bgRefPromise,
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
  const hasBackgroundParam =
    !!params && Object.prototype.hasOwnProperty.call(params, "backgroundUrl");
  const resolvedBackgroundUrl = hasBackgroundParam
    ? resolveGroupBackgroundUrl(groupId, params?.backgroundUrl, {
        source: "prepare-group-thread-entry",
        candidateAuthority: "helper",
      })
    : undefined;

  rememberPreparedGroupChatData(
    groupId,
    {
      avatarUrl:
        params?.groupAvatarUrl === undefined
          ? undefined
          : params.groupAvatarUrl,
      backgroundUrl: hasBackgroundParam ? resolvedBackgroundUrl : undefined,
    },
    "prepare-group-thread-entry",
  );

  if (__DEV__) {
    traceGroupWallpaper(groupId, "prepare-group-thread-entry-start", {
      cachedMembers: !!getPreparedGroupMembers(groupId)?.length,
      avatarKey: describeRemoteUrlForLog(params?.groupAvatarUrl).key,
      backgroundKey: describeRemoteUrlForLog(resolvedBackgroundUrl).key,
    });
  }

  const cached = groupMemberCache.get(groupId);
  if (isGroupMemberCacheFresh(cached)) {
    await warmGroupIdentityAssets({
      groupId,
      groupAvatarUrl: params?.groupAvatarUrl,
      backgroundUrl: resolvedBackgroundUrl,
      members: cached.members,
    });
    if (__DEV__) {
      traceGroupWallpaper(groupId, "prepare-group-thread-entry-finish", {
        memberSource: "cache",
        memberCount: cached.members.length,
      });
    }
    return cached.members;
  }

  // Start warming critical assets (background + group avatar) immediately,
  // in parallel with the member fetch, so the background image reaches
  // expo-image's memory cache as early as possible.
  // Retain the background ImageRef as soon as it resolves — this is the
  // earliest possible moment to pin the decoded bitmap in native memory.
  const bgNormalized = normalizeRemoteImageUrl(resolvedBackgroundUrl);
  const bgRetainPromise = bgNormalized
    ? warmRemoteImage(bgNormalized).then((ref) => {
        if (ref) retainBackgroundRef(bgNormalized, ref);
        if (__DEV__) {
          traceGroupWallpaper(
            groupId,
            "prepare-group-thread-entry-background-ready",
            {
              backgroundKey: describeRemoteUrlForLog(bgNormalized).key,
              retained: !!ref,
            },
          );
        }
      })
    : null;
  const criticalWarm = Promise.all([
    bgRetainPromise,
    warmIdentityImageUrls([params?.groupAvatarUrl]),
  ]);

  const members = await getGroupMembersForDisplay(groupId);
  cachePreparedGroupMembers(groupId, members);
  if (__DEV__) {
    traceGroupWallpaper(groupId, "prepare-group-thread-entry-members-fetched", {
      memberCount: members.length,
    });
  }

  // Warm remaining member identity assets + await the critical warmup.
  // warmRemoteImage deduplicates, so double-warming background/avatar is free.
  await Promise.all([
    criticalWarm,
    warmGroupIdentityAssets({
      groupId,
      groupAvatarUrl: params?.groupAvatarUrl,
      backgroundUrl: resolvedBackgroundUrl,
      members,
    }),
  ]);
  if (__DEV__) {
    traceGroupWallpaper(groupId, "prepare-group-thread-entry-finish", {
      memberSource: "network",
      memberCount: members.length,
    });
  }
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
    backgroundTrusted: boolean;
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
  const hadBackgroundParam = Object.prototype.hasOwnProperty.call(
    params,
    "backgroundUrl",
  );
  const trustedBackgroundState = getGroupBackgroundStateSnapshot(
    params.groupId,
  );
  let { groupName, groupAvatarUrl } = params;
  let hasTrustedBackgroundSnapshot = !!trustedBackgroundState;
  let backgroundUrl = trustedBackgroundState
    ? trustedBackgroundState.backgroundUrl
    : hadBackgroundParam
      ? resolveGroupBackgroundUrl(params.groupId, params.backgroundUrl, {
          source: "prepare-group-chat-navigation-input",
          candidateAuthority: "helper",
        })
      : null;

  rememberPreparedGroupChatData(
    params.groupId,
    {
      name: groupName,
      avatarUrl:
        groupAvatarUrl === undefined ? undefined : (groupAvatarUrl ?? null),
      backgroundUrl:
        backgroundUrl === undefined ? undefined : (backgroundUrl ?? null),
    },
    "prepare-group-chat-navigation-input",
  );

  if (__DEV__) {
    traceGroupWallpaper(params.groupId, "prepare-group-chat-navigation-start", {
      avatarKey: describeRemoteUrlForLog(groupAvatarUrl).key,
      backgroundKey: describeRemoteUrlForLog(backgroundUrl).key,
      backgroundTrusted: hasTrustedBackgroundSnapshot,
      hasBackgroundUrl: backgroundUrl !== undefined && backgroundUrl !== null,
      targetMessageId: !!params.targetMessageId,
      jumpRequestId: !!params.jumpRequestId,
    });
  }

  // If background URL is unknown, do a lightweight group-doc fetch
  if (!hasTrustedBackgroundSnapshot && backgroundUrl == null) {
    try {
      const group = await getGroup(params.groupId);
      if (group) {
        groupName = groupName || group.name;
        groupAvatarUrl = groupAvatarUrl ?? group.avatarUrl ?? null;
        backgroundUrl = normalizeRemoteImageUrl(group.backgroundUrl) ?? null;
        hasTrustedBackgroundSnapshot = true;
        setSessionGroupBackgroundState({
          groupId: params.groupId,
          backgroundUrl,
          source: "prepare-group-chat-navigation-fetch",
          authority: "authoritative",
        });
        rememberPreparedGroupChatData(
          params.groupId,
          {
            name: groupName,
            avatarUrl: groupAvatarUrl ?? null,
            backgroundUrl: backgroundUrl ?? null,
          },
          "prepare-group-chat-navigation-fetch",
        );
        if (__DEV__) {
          traceGroupWallpaper(
            params.groupId,
            "prepare-group-chat-navigation-fetched-group",
            {
              avatarKey: describeRemoteUrlForLog(groupAvatarUrl).key,
              backgroundKey: describeRemoteUrlForLog(backgroundUrl).key,
            },
          );
        }
      }
    } catch {
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
  } catch {
    log.debug("prepareGroupChatNavigation: warmup failed, proceeding", {
      data: { groupId: params.groupId },
    });
  }

  rememberPreparedGroupChatData(
    params.groupId,
    {
      name: groupName,
      avatarUrl: groupAvatarUrl ?? null,
      backgroundUrl: backgroundUrl ?? null,
    },
    "prepare-group-chat-navigation-final",
  );

  if (__DEV__) {
    traceGroupWallpaper(
      params.groupId,
      "prepare-group-chat-navigation-finish",
      {
        avatarKey: describeRemoteUrlForLog(groupAvatarUrl).key,
        backgroundKey: describeRemoteUrlForLog(backgroundUrl).key,
      },
    );
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
      backgroundTrusted: hasTrustedBackgroundSnapshot,
    },
  };
}
