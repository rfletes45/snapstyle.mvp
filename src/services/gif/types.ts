/**
 * GIF Provider Types
 *
 * Provider-agnostic types for the GIF integration layer.
 * These types decouple the UI from any specific GIF provider (KLIPY, Tenor, GIPHY, etc.).
 *
 * @module services/gif/types
 */

// =============================================================================
// Core GIF Item (Provider-Agnostic)
// =============================================================================

/**
 * A normalized GIF item produced by any provider.
 * The UI layer should only depend on this shape, never on raw API responses.
 */
export interface GifItem {
  /** Unique identifier from the provider */
  id: string;
  /** Human-readable title or content description */
  title: string;
  /** Provider slug (used for share tracking) */
  slug: string;
  /** Content type identifier (e.g. "gif", "ad") */
  type: "gif" | "ad";

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

  /** Optional MP4 URL (smaller, more efficient for playback) */
  mp4Url?: string;
}

// =============================================================================
// Pagination
// =============================================================================

/**
 * Paginated response from the GIF provider.
 */
export interface GifPage {
  /** GIF items in this page */
  items: GifItem[];
  /** Cursor for the next page (undefined = no more pages) */
  nextCursor?: string;
}

// =============================================================================
// Search Suggestions
// =============================================================================

/**
 * A search suggestion or autocomplete result.
 */
export interface GifSuggestion {
  /** Suggested search term */
  term: string;
}

// =============================================================================
// Category
// =============================================================================

/**
 * A browseable GIF category.
 */
export interface GifCategory {
  /** Category name / search term */
  name: string;
  /** Representative preview GIF URL */
  imageUrl?: string;
}

// =============================================================================
// Provider Interface
// =============================================================================

/**
 * Interface that any GIF provider must implement.
 * Swap providers by implementing this interface.
 */
export interface GifProvider {
  /** Fetch trending GIFs */
  trending(params?: { limit?: number; cursor?: string }): Promise<GifPage>;

  /** Search GIFs by query */
  search(params: {
    query: string;
    limit?: number;
    cursor?: string;
  }): Promise<GifPage>;

  /** Get search suggestions for a completed query */
  suggestions(query: string): Promise<GifSuggestion[]>;

  /** Get autocomplete results for a partial query */
  autocomplete(query: string): Promise<GifSuggestion[]>;

  /** Get browseable categories */
  categories(): Promise<GifCategory[]>;

  /** Register a share event (call after user sends a GIF) */
  registerShare(gifId: string): Promise<void>;
}
