/**
 * KLIPY Sticker Provider
 *
 * Adapter that translates KLIPY Sticker API responses
 * into the provider-agnostic StickerItem model.
 *
 * KLIPY's Sticker API is separate from the GIF (Tenor-compatible) API:
 * - Base path: /api/v1/{app_key}/stickers/...
 * - Auth: app_key embedded in URL path
 * - Pagination: page-based (page, per_page, has_next)
 * - Response format: nested file.{hd|md|sm|xs}.{gif|webp|webm|png}
 * - Requires customer_id parameter
 *
 * @see https://docs.klipy.com/stickers-api
 * @module services/sticker/klipyStickerProvider
 */

import { getAuthInstance } from "@/services/firebase";
import { createLogger } from "@/utils/log";
import type {
  StickerCategory,
  StickerItem,
  StickerPage,
  StickerProvider,
} from "./types";

const log = createLogger("sticker:klipy");

// =============================================================================
// Configuration
// =============================================================================

const KLIPY_BASE_URL = "https://api.klipy.com";

/**
 * KLIPY app key for sticker API.
 * Same key as used for GIF API — KLIPY uses it as app_key in the path.
 *
 * TODO(prod): Move to a backend proxy Cloud Function.
 */
const KLIPY_APP_KEY =
  "hEJlZBM3LNz24S6UIZmnRg7mVD8lQFps8hBGmHbRNo5t0eP5Ck2UnoBGqkJstCmV";

// =============================================================================
// Raw API Response Types (KLIPY Sticker API)
// =============================================================================

interface KlipyStickerFileFormat {
  url: string;
  width: number;
  height: number;
  size: number;
}

interface KlipyStickerFile {
  hd?: Record<string, KlipyStickerFileFormat>;
  md?: Record<string, KlipyStickerFileFormat>;
  sm?: Record<string, KlipyStickerFileFormat>;
  xs?: Record<string, KlipyStickerFileFormat>;
}

interface KlipyStickerResult {
  id: number;
  slug: string;
  title: string;
  file: KlipyStickerFile;
  tags: string[];
  type: string;
  blur_preview?: string;
}

interface KlipyStickerListResponse {
  result: boolean;
  data: {
    data: KlipyStickerResult[];
    current_page: number;
    per_page: number;
    has_next: boolean;
  };
}

interface KlipyStickerCategoriesResponse {
  result: boolean;
  data: {
    locale: string;
    categories: Array<{
      category: string;
      query: string;
      preview_url?: string;
    }>;
  };
}

// =============================================================================
// Helpers
// =============================================================================

function getCustomerId(): string {
  const uid = getAuthInstance().currentUser?.uid;
  return uid ?? "anonymous";
}

/**
 * Build a KLIPY Sticker API URL.
 * The app_key is embedded in the path.
 */
function buildStickerUrl(
  path: string,
  params: Record<string, string | number | undefined>,
): string {
  const url = new URL(`/api/v1/${KLIPY_APP_KEY}${path}`, KLIPY_BASE_URL);
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
async function fetchSticker<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `KLIPY Sticker API error ${response.status}: ${response.statusText} — ${body}`,
    );
  }

  return response.json() as Promise<T>;
}

/**
 * Extract the best format URL from a KLIPY sticker file size bucket.
 * Prefer gif → webp → png (animated formats first).
 */
function pickFormat(
  bucket: Record<string, KlipyStickerFileFormat> | undefined,
): KlipyStickerFileFormat | null {
  if (!bucket) return null;
  return bucket.gif ?? bucket.webp ?? bucket.png ?? null;
}

/**
 * Normalize a KLIPY sticker result into our provider-agnostic StickerItem.
 *
 * Strategy:
 * - Preview (grid): prefer sm → xs → md
 * - Full (send):    prefer hd → md → sm
 */
function normalizeResult(raw: KlipyStickerResult): StickerItem | null {
  const { file } = raw;
  if (!file) return null;

  // Find the best preview format (small, fast-loading)
  const preview =
    pickFormat(file.sm) ?? pickFormat(file.xs) ?? pickFormat(file.md);
  if (!preview) return null;

  // Find the best full-quality format
  const full =
    pickFormat(file.hd) ?? pickFormat(file.md) ?? pickFormat(file.sm);
  if (!full) return null;

  return {
    id: String(raw.id),
    slug: raw.slug,
    title: raw.title ?? "",
    type: "sticker",
    previewUrl: preview.url,
    previewWidth: preview.width,
    previewHeight: preview.height,
    fullUrl: full.url,
    fullWidth: full.width,
    fullHeight: full.height,
    mime: "image/gif",
    sizeBytes: full.size || undefined,
    blurPreview: raw.blur_preview,
  };
}

// =============================================================================
// Provider Implementation
// =============================================================================

const DEFAULT_LIMIT = 30;

/**
 * KLIPY Sticker provider.
 * Implements the StickerProvider interface using KLIPY's Sticker API.
 */
export function createKlipyStickerProvider(): StickerProvider {
  return {
    async trending({ limit = DEFAULT_LIMIT, page } = {}) {
      const url = buildStickerUrl("/stickers/trending", {
        per_page: limit,
        page: page ?? 1,
        customer_id: getCustomerId(),
      });

      log.debug("trending", { url: url.replace(KLIPY_APP_KEY, "***") });
      const response = await fetchSticker<KlipyStickerListResponse>(url);
      const pageData = response.data;

      const items = (pageData.data ?? [])
        .map(normalizeResult)
        .filter((item): item is StickerItem => item !== null);

      return {
        items,
        nextPage: pageData.has_next ? pageData.current_page + 1 : undefined,
      } satisfies StickerPage;
    },

    async search({ query, limit = DEFAULT_LIMIT, page }) {
      const url = buildStickerUrl("/stickers/search", {
        q: query,
        per_page: limit,
        page: page ?? 1,
        customer_id: getCustomerId(),
      });

      log.debug("search", {
        query,
        url: url.replace(KLIPY_APP_KEY, "***"),
      });
      const response = await fetchSticker<KlipyStickerListResponse>(url);
      const pageData = response.data;

      const items = (pageData.data ?? [])
        .map(normalizeResult)
        .filter((item): item is StickerItem => item !== null);

      return {
        items,
        nextPage: pageData.has_next ? pageData.current_page + 1 : undefined,
      } satisfies StickerPage;
    },

    async categories() {
      const url = buildStickerUrl("/stickers/categories", {});
      const response = await fetchSticker<KlipyStickerCategoriesResponse>(url);
      return (response.data.categories ?? []).map(
        (cat): StickerCategory => ({
          name: cat.category,
          imageUrl: cat.preview_url,
        }),
      );
    },

    async registerShare(slug: string, query?: string) {
      const url = buildStickerUrl(`/stickers/share/${slug}`, {});
      try {
        await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            customer_id: getCustomerId(),
            q: query ?? "",
          }),
        });
      } catch (err) {
        // Share registration is best-effort — don't block the user
        log.warn("registerShare failed", { slug, error: String(err) });
      }
    },
  };
}
