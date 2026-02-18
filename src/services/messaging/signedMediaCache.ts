/**
 * Signed Media URL Cache (Segment 3C — client side)
 *
 * When CHAT_SIGNED_MEDIA_URLS is enabled, attachment rendering uses
 * short-lived signed URLs minted via the `mintChatMediaUrl` callable.
 *
 * This module provides:
 *  - An in-memory cache keyed by storage path + variant
 *  - Automatic re-minting before expiry
 *  - A React hook for easy consumption in components
 *
 * @module services/messaging/signedMediaCache
 */

import { CHAT_FEATURES } from "@/constants/featureFlags";
import { SignedMediaUrlResult } from "@/types/messaging";
import { createLogger } from "@/utils/log";
import { getFunctions, httpsCallable } from "firebase/functions";

const log = createLogger("signedMediaCache");

// =============================================================================
// Callable reference (lazy-initialised)
// =============================================================================

let mintCallable: ReturnType<typeof httpsCallable> | null = null;

function getMintCallable() {
  if (!mintCallable) {
    const functions = getFunctions();
    mintCallable = httpsCallable(functions, "mintChatMediaUrl");
  }
  return mintCallable;
}

// =============================================================================
// In-memory cache
// =============================================================================

interface CacheEntry {
  url: string;
  expiresAt: number; // ms since epoch
  /** In-flight promise so we de-dupe concurrent calls for the same path */
  pending?: Promise<string>;
}

/** Cache map keyed by `${path}::${variant}` */
const cache = new Map<string, CacheEntry>();

/** Buffer before actual expiry to trigger re-mint (30 s) */
const EXPIRY_BUFFER_MS = 30_000;

function cacheKey(path: string, variant?: string): string {
  return variant ? `${path}::${variant}` : path;
}

// =============================================================================
// Public API
// =============================================================================

export interface GetSignedUrlOptions {
  /** Conversation scope */
  scope: "dm" | "group";
  /** Conversation document ID */
  conversationId: string;
  /** Message document ID (for membership validation on server) */
  messageId: string;
  /** Storage path of the object */
  path: string;
  /** Optional variant (e.g. "thumb") */
  variant?: string;
}

/**
 * Get a signed URL for a chat media object.
 *
 * Returns from cache if still valid, otherwise calls the Cloud Function.
 * De-duplicates concurrent requests for the same path.
 *
 * When CHAT_SIGNED_MEDIA_URLS is **off**, returns `null` — callers
 * should fall back to the legacy `url` field on the attachment.
 */
export async function getSignedMediaUrl(
  opts: GetSignedUrlOptions,
): Promise<string | null> {
  if (!CHAT_FEATURES.CHAT_SIGNED_MEDIA_URLS) return null;

  const key = cacheKey(opts.path, opts.variant);
  const now = Date.now();

  // 1. Check cache
  const cached = cache.get(key);
  if (cached && cached.expiresAt - EXPIRY_BUFFER_MS > now) {
    return cached.url;
  }

  // 2. If there's already an in-flight request, await it
  if (cached?.pending) {
    try {
      return await cached.pending;
    } catch {
      // Fall through to re-mint
    }
  }

  // 3. Mint a new signed URL
  const pending = mintSignedUrl(opts);

  // Store the pending promise so concurrent callers de-dupe
  cache.set(key, {
    url: cached?.url ?? "",
    expiresAt: cached?.expiresAt ?? 0,
    pending,
  });

  try {
    const url = await pending;
    return url;
  } catch (err) {
    log.error("Failed to mint signed URL", {
      operation: "getSignedMediaUrl",
      data: { path: opts.path, error: err },
    });
    // Return stale cached URL if available, otherwise null
    return cached?.url || null;
  }
}

/**
 * Invalidate cached entry for a given path (e.g. on error).
 */
export function invalidateSignedUrl(path: string, variant?: string): void {
  cache.delete(cacheKey(path, variant));
}

/**
 * Clear the entire cache (e.g. on sign-out).
 */
export function clearSignedMediaCache(): void {
  cache.clear();
}

// =============================================================================
// Internal
// =============================================================================

async function mintSignedUrl(opts: GetSignedUrlOptions): Promise<string> {
  const callable = getMintCallable();
  const result = await callable({
    scope: opts.scope,
    conversationId: opts.conversationId,
    messageId: opts.messageId,
    path: opts.path,
    variant: opts.variant,
  });

  const data = result.data as SignedMediaUrlResult;

  if (!data?.url || !data?.expiresAt) {
    throw new Error("Invalid response from mintChatMediaUrl");
  }

  const key = cacheKey(opts.path, opts.variant);
  cache.set(key, {
    url: data.url,
    expiresAt: data.expiresAt,
    // Clear pending
  });

  log.debug("Minted signed URL", {
    operation: "mintSignedUrl",
    data: {
      path: opts.path,
      expiresIn: Math.round((data.expiresAt - Date.now()) / 1000) + "s",
    },
  });

  return data.url;
}
