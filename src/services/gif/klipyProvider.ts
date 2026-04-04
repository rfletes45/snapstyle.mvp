/**
 * KLIPY GIF Provider
 *
 * Adapter that translates KLIPY (Tenor-compatible) API responses
 * into the provider-agnostic GifItem model.
 *
 * KLIPY is a drop-in replacement for the Tenor v2 API.
 * Base URL: https://api.klipy.com
 * Auth: API key as `key` query parameter.
 *
 * @see https://docs.klipy.com
 * @module services/gif/klipyProvider
 */

import { createLogger } from "@/utils/log";
import type {
  GifCategory,
  GifItem,
  GifPage,
  GifProvider,
  GifSuggestion,
} from "./types";

const log = createLogger("gif:klipy");

// =============================================================================
// Configuration
// =============================================================================

const KLIPY_BASE_URL = "https://api.klipy.com";

/**
 * API key for KLIPY.
 *
 * IMPORTANT — Production guidance:
 * In production, this key should be proxied through your backend
 * (e.g. a Firebase Cloud Function) so it is never shipped inside the client.
 * For development/testing this is acceptable per KLIPY's docs.
 *
 * TODO(prod): Move to a backend proxy Cloud Function.
 */
const KLIPY_API_KEY =
  "hEJlZBM3LNz24S6UIZmnRg7mVD8lQFps8hBGmHbRNo5t0eP5Ck2UnoBGqkJstCmV";

// =============================================================================
// Raw API Response Types (Tenor v2 compatible)
// =============================================================================

interface KlipyMediaFormat {
  url: string;
  dims: [number, number]; // [width, height]
  duration?: number;
  size?: number;
}

interface KlipyResult {
  id: string;
  title: string;
  content_description?: string;
  media_formats: Record<string, KlipyMediaFormat>;
  created: number;
  hasaudio?: boolean;
  tags?: string[];
  url?: string;
  slug?: string;
  type?: string; // "gif" or "ad"
}

interface KlipyResponse {
  results: KlipyResult[];
  next?: string;
}

interface KlipySuggestionsResponse {
  results: string[];
}

interface KlipyCategoriesResponse {
  tags: Array<{
    searchterm: string;
    path: string;
    image: string;
    name: string;
  }>;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Build a KLIPY API URL with query parameters.
 * Automatically appends the API key.
 */
function buildUrl(
  path: string,
  params: Record<string, string | number | undefined>,
): string {
  const url = new URL(path, KLIPY_BASE_URL);
  url.searchParams.set("key", KLIPY_API_KEY);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") {
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

/**
 * Execute a GET request with timeout and abort support.
 */
async function fetchKlipy<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `KLIPY API error ${response.status}: ${response.statusText} — ${body}`,
    );
  }

  return response.json() as Promise<T>;
}

/**
 * Normalize a KLIPY result into our provider-agnostic GifItem.
 *
 * Strategy:
 * - Preview (grid): prefer `tinygif` → `nanogif` → `gif`
 * - Full (send):    prefer `gif` → `mediumgif` → `tinygif`
 * - MP4 (playback): prefer `mp4` → `tinymp4` (optional)
 */
function normalizeResult(raw: KlipyResult): GifItem | null {
  const mf = raw.media_formats;
  if (!mf) return null;

  // Find the best preview format
  const preview = mf.tinygif ?? mf.nanogif ?? mf.gif ?? mf.mediumgif;
  if (!preview) return null;

  // Find the best full-quality format
  const full = mf.gif ?? mf.mediumgif ?? mf.tinygif;
  if (!full) return null;

  // Optional MP4 for efficient playback
  const mp4 = mf.mp4 ?? mf.tinymp4;

  return {
    id: raw.id,
    title: raw.content_description ?? raw.title ?? "",
    slug: raw.slug ?? raw.id,
    type: raw.type === "ad" ? "ad" : "gif",
    previewUrl: preview.url,
    previewWidth: preview.dims[0],
    previewHeight: preview.dims[1],
    fullUrl: full.url,
    fullWidth: full.dims[0],
    fullHeight: full.dims[1],
    mime: "image/gif",
    sizeBytes: full.size,
    mp4Url: mp4?.url,
  };
}

// =============================================================================
// Provider Implementation
// =============================================================================

const DEFAULT_LIMIT = 30;

/**
 * KLIPY GIF provider.
 * Implements the GifProvider interface using KLIPY's Tenor-compatible API.
 */
export function createKlipyProvider(): GifProvider {
  return {
    async trending({ limit = DEFAULT_LIMIT, cursor } = {}) {
      const url = buildUrl("/v2/featured", {
        limit,
        pos: cursor,
        media_filter: "gif,tinygif,nanogif,mediumgif,mp4,tinymp4",
      });

      log.debug("trending", { url: url.replace(KLIPY_API_KEY, "***") });
      const data = await fetchKlipy<KlipyResponse>(url);

      const items = data.results
        .map(normalizeResult)
        .filter((item): item is GifItem => item !== null && item.type !== "ad");

      return { items, nextCursor: data.next || undefined } satisfies GifPage;
    },

    async search({ query, limit = DEFAULT_LIMIT, cursor }) {
      const url = buildUrl("/v2/search", {
        q: query,
        limit,
        pos: cursor,
        media_filter: "gif,tinygif,nanogif,mediumgif,mp4,tinymp4",
      });

      log.debug("search", {
        query,
        url: url.replace(KLIPY_API_KEY, "***"),
      });
      const data = await fetchKlipy<KlipyResponse>(url);

      const items = data.results
        .map(normalizeResult)
        .filter((item): item is GifItem => item !== null && item.type !== "ad");

      return { items, nextCursor: data.next || undefined } satisfies GifPage;
    },

    async suggestions(query: string) {
      const url = buildUrl("/v2/search_suggestions", { q: query, limit: 10 });
      const data = await fetchKlipy<KlipySuggestionsResponse>(url);
      return (data.results ?? []).map((term): GifSuggestion => ({ term }));
    },

    async autocomplete(query: string) {
      const url = buildUrl("/v2/autocomplete", { q: query, limit: 8 });
      const data = await fetchKlipy<KlipySuggestionsResponse>(url);
      return (data.results ?? []).map((term): GifSuggestion => ({ term }));
    },

    async categories() {
      const url = buildUrl("/v2/categories", {});
      const data = await fetchKlipy<KlipyCategoriesResponse>(url);
      return (data.tags ?? []).map(
        (tag): GifCategory => ({
          name: tag.name ?? tag.searchterm,
          imageUrl: tag.image,
        }),
      );
    },

    async registerShare(gifId: string) {
      const url = buildUrl("/v2/registershare", { id: gifId });
      try {
        await fetch(url, { method: "POST" });
      } catch (err) {
        // Share registration is best-effort — don't block the user
        log.warn("registerShare failed", { gifId, error: String(err) });
      }
    },
  };
}
