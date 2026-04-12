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
 * Subscriber notifications use a two-tier strategy:
 *
 * 1. **First report** (a node's width changes from `undefined` to a value):
 *    The affected group is notified **synchronously** so the renderer can
 *    transition from hidden (opacity: 0) to visible on the same frame as
 *    the `onLayout` event — no extra frame of delay.
 *
 * 2. **Subsequent updates** (width refines or neighbors change):
 *    Notifications are coalesced via a microtask queue (`setTimeout(0)`).
 *    This prevents cascading re-renders during pagination batches where
 *    many cards report / register neighbors in quick succession.
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
   * First-time measurements (width going from undefined → value) trigger
   * **synchronous** notification so the opacity gate can reveal the card
   * on the same frame as onLayout. Subsequent width changes use the
   * coalesced (async) path to prevent cascade storms.
   */
  report(id: string, width: number): void {
    const rounded = normalizeGroupedCardWidth(width);
    const node = this.ensureNode(id);
    if (node.width === rounded) return;

    const wasFirstMeasurement = node.width === undefined;
    node.width = rounded;

    // Persist to cross-instance cache
    cacheWidth(id, rounded);

    if (wasFirstMeasurement) {
      // Synchronous path: collect the group and notify immediately so the
      // renderer can flip opacity: 0 → 1 on the same frame.
      const affectedIds = new Set<string>();
      this.collectGroupIds(id, affectedIds);
      if (affectedIds.size === 0) affectedIds.add(id);

      // Also drain any pending async notifications for these IDs so they
      // don't fire again on the next setTimeout tick.
      for (const aid of affectedIds) {
        this.pendingNotifyIds.delete(aid);
      }
      this.flushNow(affectedIds);
    } else {
      this.enqueueGroupNotify(id);
    }
  }

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
      // instead of returning undefined and keeping the card at opacity 0.
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
