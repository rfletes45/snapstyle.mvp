/**
 * Sticker Provider Types
 *
 * Provider-agnostic types for the sticker integration layer.
 * Modeled after the GIF types but adapted for KLIPY's Sticker API
 * which uses page-based pagination and nested file formats.
 *
 * @module services/sticker/types
 */

// =============================================================================
// Core Sticker Item (Provider-Agnostic)
// =============================================================================

/**
 * A normalized sticker item produced by any provider.
 * The UI layer should only depend on this shape, never on raw API responses.
 */
export interface StickerItem {
  /** Unique identifier from the provider */
  id: string;
  /** Provider slug (used for share tracking) */
  slug: string;
  /** Human-readable title */
  title: string;
  /** Content type identifier */
  type: "sticker";

  /** Thumbnail URL for grid display (small, fast-loading) */
  previewUrl: string;
  /** Preview width in pixels */
  previewWidth: number;
  /** Preview height in pixels */
  previewHeight: number;

  /** Full-quality URL for sending / viewing */
  fullUrl: string;
  /** Full-quality width in pixels */
  fullWidth: number;
  /** Full-quality height in pixels */
  fullHeight: number;

  /** MIME type for the full-quality asset */
  mime: string;

  /** File size in bytes (full quality), if known */
  sizeBytes?: number;

  /** Base64 blur preview for placeholder */
  blurPreview?: string;
}

// =============================================================================
// Pagination
// =============================================================================

/**
 * Paginated response from the sticker provider.
 * Uses page-based pagination (unlike GIF's cursor-based).
 */
export interface StickerPage {
  /** Sticker items in this page */
  items: StickerItem[];
  /** Next page number (undefined = no more pages) */
  nextPage?: number;
}

// =============================================================================
// Category
// =============================================================================

/**
 * A browseable sticker category.
 */
export interface StickerCategory {
  /** Category name / search term */
  name: string;
  /** Representative preview image URL */
  imageUrl?: string;
}

// =============================================================================
// Provider Interface
// =============================================================================

/**
 * Interface that any sticker provider must implement.
 */
export interface StickerProvider {
  /** Fetch trending stickers */
  trending(params?: { limit?: number; page?: number }): Promise<StickerPage>;

  /** Search stickers by query */
  search(params: {
    query: string;
    limit?: number;
    page?: number;
  }): Promise<StickerPage>;

  /** Get browseable categories */
  categories(): Promise<StickerCategory[]>;

  /** Register a share event (call after user sends a sticker) */
  registerShare(slug: string, query?: string): Promise<void>;
}
