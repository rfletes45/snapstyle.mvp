/**
 * CardWidthTracker - Shared width measurement + notification system
 * for adaptive grouped-card snapping in stacked message renderers.
 *
 * Each message card reports its measured width and same-group neighbors.
 * The tracker then resolves deterministic snapped widths for the connected
 * sender group so both DM and group stacked renderers can derive the same
 * final shape rules from the same data.
 *
 * ## Notification coalescing
 *
 * All subscriber notifications are coalesced via a microtask queue
 * (`setTimeout(0)`).  Multiple report() and setGroupNeighbors() calls
 * within the same JS turn are merged into a single batch of subscriber
 * notifications.  This prevents O(N²) cascade storms during pagination
 * batches where many cards report widths and register neighbors in
 * quick succession.
 *
 * The hook (`useGroupedCardLayout`) further guards against redundant
 * re-renders via a snapshot comparison function that only applies a
 * state update when width-relevant fields actually changed.
 *
 * ## Width cache
 *
 * Measured widths are also stored in a static **cross-instance cache**
 * keyed by message ID. When a new CardWidthTracker is created (e.g. on
 * conversation re-open), it can pre-seed node widths from the cache,
 * eliminating the onLayout → measure → re-render cycle for messages
 * the user has already seen.
 */

import {
  normalizeGroupedCardWidth,
  resolveGroupedCardSnappedWidth,
} from "@/components/chat/groupedCardLayout";

interface CardWidthNode {
  width?: number;
  prevId?: string;
  nextId?: string;
}

export interface CardWidthSnapshot {
  rawWidth?: number;
  snappedWidth?: number;
  prevSnappedWidth?: number;
  nextSnappedWidth?: number;
  prevMessageId?: string;
  nextMessageId?: string;
}

const EMPTY_SNAPSHOT: CardWidthSnapshot = Object.freeze({});

// ── Cross-instance width cache ─────────────────────────────────────────
// Persists measured widths across CardWidthTracker instances so that
// re-opening a conversation (which creates a fresh tracker) can pre-seed
// known widths instead of waiting for onLayout to fire again.
const WIDTH_CACHE = new Map<string, number>();
const WIDTH_CACHE_MAX_SIZE = 5000;

function cacheWidth(id: string, width: number): void {
  WIDTH_CACHE.set(id, width);
  // Simple size cap — evict oldest entries when cache grows too large.
  // Map iteration order is insertion order, so deleting the first entry
  // acts as a FIFO eviction.
  if (WIDTH_CACHE.size > WIDTH_CACHE_MAX_SIZE) {
    const firstKey = WIDTH_CACHE.keys().next().value;
    if (firstKey !== undefined) WIDTH_CACHE.delete(firstKey);
  }
}

/** Read a previously cached width for a message ID (cross-instance). */
export function getCachedWidth(id: string): number | undefined {
  return WIDTH_CACHE.get(id);
}

export class CardWidthTracker {
  private nodes = new Map<string, CardWidthNode>();
  private listeners = new Map<
    string,
    Set<(snapshot: CardWidthSnapshot) => void>
  >();

  // ── Notification coalescing ──────────────────────────────────────────
  private pendingNotifyIds = new Set<string>();
  private flushScheduled = false;

  private ensureNode(id: string): CardWidthNode {
    let node = this.nodes.get(id);
    if (!node) {
      // Pre-seed from cross-instance cache if available
      const cached = WIDTH_CACHE.get(id);
      node = { width: cached };
      this.nodes.set(id, node);
    }
    return node;
  }

  /**
   * Store a measured width and notify the affected sender-group.
   *
   * All notifications go through the coalesced async queue (setTimeout(0)).
   * Multiple report() calls within the same JS turn (e.g. a pagination batch
   * where many onLayout events fire close together) are merged into a single
   * flush, preventing the O(N²) cascade that would occur if each report
   * synchronously notified all group members.
   */
  report(id: string, width: number): void {
    const rounded = normalizeGroupedCardWidth(width);
    const node = this.ensureNode(id);
    if (node.width === rounded) return;

    node.width = rounded;

    // Persist to cross-instance cache
    cacheWidth(id, rounded);

    // Clear estimated flag — this is now a real measurement
    this.estimatedIds.delete(id);

    this.enqueueGroupNotify(id);
  }

  /**
   * Pre-seed an estimated width for a message that hasn't been measured yet.
   *
   * Unlike report(), seed() does NOT overwrite an existing measured width
   * (from either this instance or the cross-instance cache). It only fills
   * in the gap for cold-cache rows that would otherwise render with
   * undefined widths and flat right-edge corners.
   *
   * Estimated widths participate in snap cluster resolution and corner
   * rounding, so cold-mounted rows start closer to their final shape.
   * When onLayout fires later, report() overwrites the estimate with the
   * real measurement and notifies subscribers of any correction.
   */
  seed(id: string, estimatedWidth: number): void {
    // Don't overwrite real measurements
    if (WIDTH_CACHE.has(id)) return;
    const existing = this.nodes.get(id);
    if (existing?.width !== undefined) return;

    const rounded = normalizeGroupedCardWidth(estimatedWidth);
    const node = this.ensureNode(id);
    node.width = rounded;
    this.estimatedIds.add(id);
    // Do NOT cache in WIDTH_CACHE — estimates should not persist across instances
  }

  /**
   * Bulk pre-seed estimated widths for a batch of messages.
   * Calls seed() for each entry, then triggers a single coalesced
   * notification for all affected groups.
   */
  seedBatch(entries: { id: string; estimatedWidth: number }[]): void {
    let anySeeded = false;
    for (const entry of entries) {
      const before = this.nodes.get(entry.id)?.width;
      this.seed(entry.id, entry.estimatedWidth);
      if (this.nodes.get(entry.id)?.width !== before) {
        anySeeded = true;
        this.pendingNotifyIds.add(entry.id);
      }
    }
    if (anySeeded) {
      this.scheduleFlush();
    }
  }

  /** Check whether a stored width is an estimate (not yet measured). */
  isEstimated(id: string): boolean {
    return this.estimatedIds.has(id);
  }

  /** Track which nodes hold estimated (not measured) widths. */
  private estimatedIds = new Set<string>();

  /** Keep same-group adjacency in sync so snapped widths can be resolved. */
  setGroupNeighbors(id: string, prevId?: string, nextId?: string): void {
    const node = this.ensureNode(id);
    const oldPrevId = node.prevId;
    const oldNextId = node.nextId;

    if (oldPrevId === prevId && oldNextId === nextId) {
      return;
    }

    const affectedIds = new Set<string>();
    this.collectGroupIds(id, affectedIds);

    if (oldPrevId && oldPrevId !== prevId) {
      const oldPrevNode = this.nodes.get(oldPrevId);
      if (oldPrevNode?.nextId === id) {
        oldPrevNode.nextId = undefined;
      }
      this.collectGroupIds(oldPrevId, affectedIds);
    }

    if (oldNextId && oldNextId !== nextId) {
      const oldNextNode = this.nodes.get(oldNextId);
      if (oldNextNode?.prevId === id) {
        oldNextNode.prevId = undefined;
      }
      this.collectGroupIds(oldNextId, affectedIds);
    }

    node.prevId = prevId;
    node.nextId = nextId;

    if (prevId) {
      const prevNode = this.ensureNode(prevId);
      if (prevNode.nextId !== id) {
        prevNode.nextId = id;
      }
      this.collectGroupIds(prevId, affectedIds);
    }

    if (nextId) {
      const nextNode = this.ensureNode(nextId);
      if (nextNode.prevId !== id) {
        nextNode.prevId = id;
      }
      this.collectGroupIds(nextId, affectedIds);
    }

    this.collectGroupIds(id, affectedIds);

    // Route through coalescing queue instead of immediate notification
    for (const aid of affectedIds) {
      this.pendingNotifyIds.add(aid);
    }
    this.scheduleFlush();
  }

  /** Read a previously measured raw width (undefined if not yet measured). */
  getWidth(id: string): number | undefined {
    return this.nodes.get(id)?.width;
  }

  /** Read the current snapped-width snapshot for a message. */
  getSnapshot(id: string): CardWidthSnapshot {
    const node = this.nodes.get(id);
    if (!node) {
      // Try pre-seeding from cache before returning empty
      const cached = WIDTH_CACHE.get(id);
      if (cached !== undefined) {
        const seeded = this.ensureNode(id);
        return {
          rawWidth: seeded.width,
          snappedWidth:
            seeded.width !== undefined
              ? this.resolveSnappedWidth(id)
              : undefined,
        };
      }
      return EMPTY_SNAPSHOT;
    }

    return {
      rawWidth: node.width,
      snappedWidth:
        node.width !== undefined ? this.resolveSnappedWidth(id) : undefined,
      prevSnappedWidth: node.prevId
        ? this.resolveSnappedWidth(node.prevId)
        : undefined,
      nextSnappedWidth: node.nextId
        ? this.resolveSnappedWidth(node.nextId)
        : undefined,
      prevMessageId: node.prevId,
      nextMessageId: node.nextId,
    };
  }

  /** Subscribe to snapshot changes for a specific message ID. */
  subscribe(
    id: string,
    callback: (snapshot: CardWidthSnapshot) => void,
  ): () => void {
    if (!this.listeners.has(id)) {
      this.listeners.set(id, new Set());
    }

    this.listeners.get(id)!.add(callback);
    return () => {
      this.listeners.get(id)?.delete(callback);
    };
  }

  /** Clear all stored widths and links without orphaning mounted subscribers. */
  clear(): void {
    this.nodes.clear();
    // Clear fires synchronously so subscribers see the reset immediately
    this.flushNow(this.listeners.keys());
  }

  private resolveSnappedWidth(id: string): number | undefined {
    return resolveGroupedCardSnappedWidth({
      messageId: id,
      // Fall back to the cross-instance width cache when a node doesn't
      // exist in this tracker instance (e.g. neighbor was virtualized out).
      // This lets remounted cells resolve neighbor widths immediately
      // instead of needing a second onLayout pass.
      getWidth: (messageId) =>
        this.nodes.get(messageId)?.width ?? WIDTH_CACHE.get(messageId),
      getPrevMessageId: (messageId) => this.nodes.get(messageId)?.prevId,
      getNextMessageId: (messageId) => this.nodes.get(messageId)?.nextId,
    });
  }

  private collectGroupIds(
    startId: string | undefined,
    seen: Set<string>,
  ): void {
    if (!startId) {
      return;
    }

    const stack = [startId];
    while (stack.length > 0) {
      const id = stack.pop();
      if (!id || seen.has(id)) {
        continue;
      }

      seen.add(id);
      const node = this.nodes.get(id);
      if (!node) {
        continue;
      }

      if (node.prevId) {
        stack.push(node.prevId);
      }
      if (node.nextId) {
        stack.push(node.nextId);
      }
    }
  }

  /**
   * Collect all group members for `id` and add them to the coalescing queue.
   * The actual subscriber notification happens on the next flush.
   */
  private enqueueGroupNotify(id: string): void {
    const affectedIds = new Set<string>();
    this.collectGroupIds(id, affectedIds);
    if (affectedIds.size === 0) {
      affectedIds.add(id);
    }
    for (const aid of affectedIds) {
      this.pendingNotifyIds.add(aid);
    }
    this.scheduleFlush();
  }

  /**
   * Schedule a coalesced flush of all pending notifications.
   * Uses setTimeout(0) so that all synchronous report() / setGroupNeighbors()
   * calls within the current JS turn are collected before any subscriber
   * callback fires.  This eliminates the N×N cascading re-render storm that
   * occurred when pagination inserted many grouped cards at once.
   */
  private scheduleFlush(): void {
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    setTimeout(() => {
      this.flushScheduled = false;
      if (this.pendingNotifyIds.size === 0) return;
      const ids = this.pendingNotifyIds;
      this.pendingNotifyIds = new Set();
      this.flushNow(ids);
    }, 0);
  }

  /** Synchronously notify subscribers for the given IDs. */
  private flushNow(ids: Iterable<string>): void {
    for (const id of ids) {
      const callbacks = this.listeners.get(id);
      if (!callbacks || callbacks.size === 0) {
        continue;
      }

      const snapshot = this.getSnapshot(id);
      callbacks.forEach((callback) => callback(snapshot));
    }
  }
}
