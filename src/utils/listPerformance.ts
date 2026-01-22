/**
 * List Performance Configuration
 * Vibe Design System - Optimized FlatList defaults
 *
 * Apply these props to FlatList/SectionList components for better performance.
 */

/**
 * Standard list performance props
 * Good for most lists (chats, connections, moments feed)
 */
export const LIST_PERFORMANCE_PROPS = {
  /** Number of items to render outside visible area (above + below) */
  windowSize: 10,
  /** Initial items to render (affects first paint) */
  initialNumToRender: 10,
  /** Max items to render per batch */
  maxToRenderPerBatch: 5,
  /** Delay between batches in ms */
  updateCellsBatchingPeriod: 50,
  /** Remove items far from viewport */
  removeClippedSubviews: true,
} as const;

/**
 * Compact list performance props
 * For smaller lists or lists with smaller items
 */
export const LIST_PERFORMANCE_COMPACT = {
  windowSize: 15,
  initialNumToRender: 15,
  maxToRenderPerBatch: 10,
  updateCellsBatchingPeriod: 30,
  removeClippedSubviews: true,
} as const;

/**
 * Heavy list performance props
 * For lists with expensive items (images, complex layouts)
 */
export const LIST_PERFORMANCE_HEAVY = {
  windowSize: 5,
  initialNumToRender: 5,
  maxToRenderPerBatch: 3,
  updateCellsBatchingPeriod: 100,
  removeClippedSubviews: true,
} as const;

/**
 * Horizontal list performance props
 * For horizontal scrolling lists (moment thumbnails, etc.)
 */
export const LIST_PERFORMANCE_HORIZONTAL = {
  windowSize: 5,
  initialNumToRender: 5,
  maxToRenderPerBatch: 3,
  updateCellsBatchingPeriod: 50,
  removeClippedSubviews: false, // Horizontal lists sometimes have issues with this
  horizontal: true,
  showsHorizontalScrollIndicator: false,
} as const;

/**
 * Key extractor helper
 * Creates a stable keyExtractor function for items with id property
 */
export function createKeyExtractor<T extends { id: string }>(
  prefix?: string,
): (item: T, index: number) => string {
  return (item, index) => (prefix ? `${prefix}-${item.id}` : item.id);
}

/**
 * Index-based key extractor
 * For lists without stable IDs (use sparingly)
 */
export function indexKeyExtractor(prefix: string) {
  return (_item: any, index: number) => `${prefix}-${index}`;
}
