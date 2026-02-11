/**
 * Link Preview Cloud Function
 *
 * Fetches OpenGraph metadata from URLs server-side.
 * Results are cached in Firestore for 24 hours.
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

const db = admin.firestore();

// ============================================
// TYPES
// ============================================

interface LinkPreviewData {
  url: string;
  canonicalUrl?: string;
  title?: string;
  description?: string;
  siteName?: string;
  imageUrl?: string;
  fetchedAt: number;
  expiresAt: number;
}

interface FetchPreviewParams {
  url: string;
}

interface FetchPreviewResponse {
  success: boolean;
  preview?: LinkPreviewData;
  error?: string;
  cached?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

/** Cache TTL: 24 hours */
const LINK_PREVIEW_TTL_MS = 24 * 60 * 60 * 1000;

/** Max URL length */
const MAX_URL_LENGTH = 2048;

/** Domains to block */
const BLOCKED_DOMAINS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "10.0.0.0",
  "192.168.",
  "172.16.",
]);

/** Request timeout in ms */
const FETCH_TIMEOUT_MS = 8000;

// ============================================
// HELPERS
// ============================================

/**
 * Check if a domain is blocked (local/internal)
 */
function isBlockedDomain(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  for (const blocked of BLOCKED_DOMAINS) {
    if (lower === blocked || lower.startsWith(blocked)) {
      return true;
    }
  }
  return false;
}

/**
 * Extract OpenGraph meta tags from HTML
 */
function extractOgTags(html: string): Record<string, string> {
  const tags: Record<string, string> = {};

  // Match <meta property="og:xxx" content="yyy">
  const ogRegex =
    /<meta\s+(?:[^>]*?\s+)?property=["']og:([^"']+)["']\s+(?:[^>]*?\s+)?content=["']([^"']*)["']/gi;
  let match;
  while ((match = ogRegex.exec(html)) !== null) {
    tags[match[1]] = match[2];
  }

  // Also match reverse order: content before property
  const ogRegex2 =
    /<meta\s+(?:[^>]*?\s+)?content=["']([^"']*)["']\s+(?:[^>]*?\s+)?property=["']og:([^"']+)["']/gi;
  while ((match = ogRegex2.exec(html)) !== null) {
    tags[match[2]] = match[1];
  }

  // Fallback to regular meta tags
  if (!tags.title) {
    const titleMatch = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
    if (titleMatch) tags.title = titleMatch[1];
  }

  if (!tags.description) {
    const descMatch =
      /<meta\s+(?:[^>]*?\s+)?name=["']description["']\s+(?:[^>]*?\s+)?content=["']([^"']*)["']/i.exec(
        html,
      );
    if (descMatch) tags.description = descMatch[1];
  }

  return tags;
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/**
 * Generate cache key from URL
 */
function getCacheKey(url: string): string {
  // Simple hash: use base64 of URL
  return Buffer.from(url).toString("base64").substring(0, 64);
}

// ============================================
// EXPORTED FUNCTION
// ============================================

/**
 * Fetch link preview - Callable Cloud Function
 *
 * Fetches OpenGraph metadata from a URL server-side.
 * Results are cached in Firestore for 24 hours.
 *
 * @param url - URL to fetch preview for
 * @returns Link preview data or error
 */
export const fetchLinkPreviewFunction = functions.https.onCall(
  async (data: FetchPreviewParams, context): Promise<FetchPreviewResponse> => {
    // Require authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in to fetch link previews",
      );
    }

    const { url } = data;

    // Validate URL
    if (!url || typeof url !== "string") {
      return { success: false, error: "Invalid URL" };
    }

    if (url.length > MAX_URL_LENGTH) {
      return { success: false, error: "URL too long" };
    }

    // Parse and validate URL
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { success: false, error: "Invalid URL format" };
    }

    // Only allow HTTP/HTTPS
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { success: false, error: "Only HTTP/HTTPS URLs are supported" };
    }

    // Block internal/local domains
    if (isBlockedDomain(parsed.hostname)) {
      return { success: false, error: "URL not allowed" };
    }

    const cacheKey = getCacheKey(url);
    const cacheRef = db.collection("LinkPreviews").doc(cacheKey);

    // Check cache first
    try {
      const cached = await cacheRef.get();
      if (cached.exists) {
        const data = cached.data() as LinkPreviewData;
        // Check if not expired
        if (data.expiresAt > Date.now()) {
          console.log(`✅ [fetchLinkPreview] Cache hit for: ${url}`);
          return { success: true, preview: data, cached: true };
        }
      }
    } catch (error) {
      console.warn("[fetchLinkPreview] Cache lookup failed:", error);
    }

    // Fetch the URL
    console.log(`🔵 [fetchLinkPreview] Fetching: ${url}`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; VibeBot/1.0; +https://vibeapp.com)",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: controller.signal,
        redirect: "follow",
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[fetchLinkPreview] HTTP ${response.status} for: ${url}`);
        return {
          success: false,
          error: `Failed to fetch URL (HTTP ${response.status})`,
        };
      }

      // Only process HTML content
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/html")) {
        return { success: false, error: "URL is not an HTML page" };
      }

      // Read response (limit to 1MB)
      const text = await response.text();
      const html = text.substring(0, 1024 * 1024);

      // Extract OG tags
      const tags = extractOgTags(html);

      const now = Date.now();
      const preview: LinkPreviewData = {
        url,
        canonicalUrl: tags.url || response.url,
        title: tags.title
          ? decodeHtmlEntities(tags.title).substring(0, 200)
          : undefined,
        description: tags.description
          ? decodeHtmlEntities(tags.description).substring(0, 500)
          : undefined,
        siteName: tags.site_name
          ? decodeHtmlEntities(tags.site_name).substring(0, 100)
          : undefined,
        imageUrl: tags.image,
        fetchedAt: now,
        expiresAt: now + LINK_PREVIEW_TTL_MS,
      };

      // Save to cache
      try {
        await cacheRef.set(preview);
        console.log(`✅ [fetchLinkPreview] Cached preview for: ${url}`);
      } catch (error) {
        console.warn("[fetchLinkPreview] Failed to cache:", error);
      }

      return { success: true, preview };
    } catch (error: any) {
      console.error(`❌ [fetchLinkPreview] Error fetching ${url}:`, error);

      if (error.name === "AbortError") {
        return { success: false, error: "Request timed out" };
      }

      return {
        success: false,
        error: error.message || "Failed to fetch URL",
      };
    }
  },
);
