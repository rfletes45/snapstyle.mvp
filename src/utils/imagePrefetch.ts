/**
 * imagePrefetch – Utilities to warm the expo-image cache for upcoming screens.
 *
 * Uses `Image.prefetch()` from expo-image which downloads images to
 * both memory and disk caches so they render instantly when displayed.
 *
 * @module utils/imagePrefetch
 */

import { warmIdentityImageUrls } from "@/services/chat/threadIdentityWarmup";
import {
  cancelChatPreloadsForScope,
  chatPreloadQueue,
  type PreloadPriority,
} from "@/services/preload/chatPreloadQueue";
import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

/**
 * Prefetch a batch of image URLs into expo-image's memory+disk cache.
 *
 * Silently swallows errors – prefetching is best-effort.  Duplicate URLs
 * are de-duplicated automatically by expo-image (cache-key = URL).
 *
 * @param urls  Array of remote image URLs to preload.
 * @returns     Promise resolving to `true` if *all* succeeded.
 */
export async function prefetchImages(
  urls: string[],
  options: { priority?: PreloadPriority; scopeToken?: string } = {},
): Promise<boolean> {
  const valid = urls.filter(Boolean);
  if (valid.length === 0) return true;

  try {
    return await chatPreloadQueue.enqueueMany(
      valid.map((url) => ({
        url,
        priority: options.priority,
        scopeToken: options.scopeToken,
      })),
    );
  } catch (err) {
    if (__DEV__) {
      console.warn("[imagePrefetch] batch failed:", err);
    }
    return false;
  }
}

/**
 * Prefetch a single image URL.
 */
export async function prefetchImage(
  url: string,
  options: { priority?: PreloadPriority; scopeToken?: string } = {},
): Promise<boolean> {
  if (!url) return true;
  return prefetchImages([url], options);
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Prefetches the given URLs once when the component mounts (or when the
 * array reference changes).  Safe to pass `undefined` / empty arrays.
 *
 * Usage:
 * ```ts
 * usePrefetch(friends.map(f => f.avatarUrl));
 * ```
 */
export function usePrefetch(
  urls: (string | null | undefined)[] | undefined,
  options: { priority?: PreloadPriority; scopeToken?: string } = {},
) {
  // Serialize to a stable string so we only re-run when URLs actually change.
  const key = urls?.filter(Boolean).join("|") ?? "";
  const prevKey = useRef("");

  useEffect(() => {
    if (!key || key === prevKey.current) return;
    prevKey.current = key;
    const list = key.split("|");
    prefetchImages(list, options);
    return () => {
      if (options.scopeToken) {
        cancelChatPreloadsForScope(options.scopeToken);
      }
    };
  }, [key, options.priority, options.scopeToken]);
}

/**
 * Prefetches profile picture URLs for a list of users.
 *
 * Accepts any objects that may have `photoURL`, `avatarUrl`, or
 * `profilePictureUrl` fields — covers all profile shapes in the codebase.
 */
export function usePrefetchProfileImages(
  users:
    | {
        photoURL?: string | null;
        avatarUrl?: string | null;
        profilePictureUrl?: string | null;
      }[]
    | undefined,
) {
  const urls = users
    ?.map((u) => u.photoURL || u.avatarUrl || u.profilePictureUrl || null)
    .filter(Boolean) as string[] | undefined;

  usePrefetch(urls);

  const key = urls?.join("|") ?? "";
  const prevWarmKey = useRef("");

  useEffect(() => {
    if (!key || key === prevWarmKey.current) return;
    prevWarmKey.current = key;
    void warmIdentityImageUrls(key.split("|"));
  }, [key]);
}

/**
 * Prefetches image attachment URLs for a list of messages.
 *
 * Extracts `imageUrl`, `thumbUrl`, and attachment URLs.
 */
export function usePrefetchChatImages(
  messages:
    | {
        imageUrl?: string | null;
        attachments?: { url?: string; thumbUrl?: string }[];
      }[]
    | undefined,
) {
  const urls: string[] = [];

  messages?.forEach((m) => {
    if (m.imageUrl) urls.push(m.imageUrl);
    m.attachments?.forEach((a) => {
      if (a.thumbUrl) urls.push(a.thumbUrl);
      else if (a.url) urls.push(a.url);
    });
  });

  usePrefetch(urls.length > 0 ? urls : undefined);
}
