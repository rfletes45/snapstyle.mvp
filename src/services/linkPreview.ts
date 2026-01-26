/**
 * Link Preview Service
 *
 * Generates and caches link previews for URLs in messages.
 * Uses a Cloud Function for server-side fetching.
 *
 * @module services/linkPreview
 */

import { LinkPreviewV2 } from "@/types/messaging";
import { createLogger } from "@/utils/log";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getAppInstance } from "./firebase";

const log = createLogger("linkPreview");

// =============================================================================
// Types
// =============================================================================

interface FetchPreviewParams {
  url: string;
}

interface FetchPreviewResponse {
  success: boolean;
  preview?: LinkPreviewV2;
  error?: string;
  cached?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

/** URL regex for detecting links */
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

/** Domains to skip preview generation */
const SKIP_DOMAINS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

/** Max URLs to preview per message */
const MAX_PREVIEWS_PER_MESSAGE = 3;

/** Cache TTL in milliseconds (24 hours) */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// =============================================================================
// In-memory Cache
// =============================================================================

interface CachedPreview {
  preview: LinkPreviewV2 | null;
  fetchedAt: number;
  error?: string;
}

const previewCache = new Map<string, CachedPreview>();

// =============================================================================
// Firebase Functions Instance
// =============================================================================

let functionsInstance: ReturnType<typeof getFunctions> | null = null;

function getFunctionsInstance() {
  if (!functionsInstance) {
    const app = getAppInstance();
    functionsInstance = getFunctions(app);
  }
  return functionsInstance;
}

// =============================================================================
// URL Detection
// =============================================================================

/**
 * Extract URLs from text
 */
export function extractUrls(text: string): string[] {
  if (!text) return [];

  const matches = text.match(URL_REGEX) || [];

  // Filter and dedupe
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const url of matches) {
    // Normalize URL
    const normalized = url.toLowerCase();

    // Skip if already seen
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    // Skip certain domains
    try {
      const parsed = new URL(url);
      if (SKIP_DOMAINS.has(parsed.hostname)) continue;
    } catch {
      continue;
    }

    urls.push(url);

    // Limit number of URLs
    if (urls.length >= MAX_PREVIEWS_PER_MESSAGE) break;
  }

  return urls;
}

/**
 * Check if text contains any URLs
 */
export function hasUrls(text: string): boolean {
  if (!text) return false;
  return URL_REGEX.test(text);
}

// =============================================================================
// Preview Fetching
// =============================================================================

/**
 * Fetch link preview from server via Cloud Function
 *
 * @param url - URL to fetch preview for
 * @returns Link preview data or null if failed
 */
export async function fetchPreview(url: string): Promise<LinkPreviewV2 | null> {
  // Check local cache first
  const cached = previewCache.get(url);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    log.debug("Using cached preview", { operation: "fetchPreview" });
    return cached.preview;
  }

  log.info("Fetching preview from server", { operation: "fetchPreview" });

  try {
    const callable = httpsCallable<FetchPreviewParams, FetchPreviewResponse>(
      getFunctionsInstance(),
      "fetchLinkPreview",
    );

    const result = await callable({ url });
    const response = result.data;

    if (response.success && response.preview) {
      const preview: LinkPreviewV2 = {
        url: response.preview.url,
        canonicalUrl: response.preview.canonicalUrl,
        title: response.preview.title,
        description: response.preview.description,
        siteName: response.preview.siteName,
        imageUrl: response.preview.imageUrl,
        fetchedAt: response.preview.fetchedAt || Date.now(),
        expiresAt: response.preview.expiresAt,
      };

      // Cache locally
      previewCache.set(url, {
        preview,
        fetchedAt: Date.now(),
      });

      log.info("Preview fetched successfully", {
        operation: "fetchPreview",
        data: { cached: response.cached },
      });

      return preview;
    } else {
      log.warn("Preview fetch failed", {
        operation: "fetchPreview",
        data: { error: response.error },
      });

      // Cache the failure to avoid repeated requests
      previewCache.set(url, {
        preview: null,
        fetchedAt: Date.now(),
        error: response.error,
      });

      return null;
    }
  } catch (error) {
    log.error("Failed to fetch preview", error);

    // Cache the failure
    previewCache.set(url, {
      preview: null,
      fetchedAt: Date.now(),
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return null;
  }
}

/**
 * Fetch previews for all URLs in text
 *
 * @param text - Text to extract URLs from
 * @returns Array of link previews
 *
 * TODO: Implement in H9
 */
export async function fetchPreviewsForText(
  text: string,
): Promise<LinkPreviewV2[]> {
  const urls = extractUrls(text);
  if (urls.length === 0) return [];

  log.info("Fetching previews for URLs", {
    operation: "fetchPreviews",
    data: { count: urls.length },
  });

  const previews: LinkPreviewV2[] = [];

  for (const url of urls) {
    try {
      const preview = await fetchPreview(url);
      if (preview) {
        previews.push(preview);
      }
    } catch (error) {
      log.error("Failed to fetch preview", error);
    }
  }

  return previews;
}

// =============================================================================
// Cache Management
// =============================================================================

/**
 * Get cached preview
 */
export function getCachedPreview(url: string): LinkPreviewV2 | null {
  const cached = previewCache.get(url);
  if (!cached) return null;

  // Check if expired
  if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) {
    previewCache.delete(url);
    return null;
  }

  return cached.preview;
}

/**
 * Clear preview cache
 */
export function clearCache(): void {
  previewCache.clear();
  log.info("Link preview cache cleared");
}

/**
 * Remove expired entries from cache
 */
export function pruneCache(): number {
  const now = Date.now();
  let pruned = 0;

  for (const [url, cached] of previewCache.entries()) {
    if (now - cached.fetchedAt > CACHE_TTL_MS) {
      previewCache.delete(url);
      pruned++;
    }
  }

  if (pruned > 0) {
    log.debug("Pruned expired cache entries", {
      operation: "pruneCache",
      data: { count: pruned },
    });
  }

  return pruned;
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; oldestAge: number | null } {
  let oldestAge: number | null = null;
  const now = Date.now();

  for (const cached of previewCache.values()) {
    const age = now - cached.fetchedAt;
    if (oldestAge === null || age > oldestAge) {
      oldestAge = age;
    }
  }

  return {
    size: previewCache.size,
    oldestAge,
  };
}

// =============================================================================
// Preview Rendering Helpers
// =============================================================================

/**
 * Check if preview has enough data to display
 */
export function isDisplayablePreview(preview: LinkPreviewV2): boolean {
  return !!(preview.title || preview.description || preview.imageUrl);
}

/**
 * Get domain from URL for display
 */
export function getDomainFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Truncate text for preview display
 */
export function truncatePreviewText(
  text: string,
  maxLength: number = 150,
): string {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}
