/**
 * CardWidthTracker - Shared width measurement + notification system
 * for adaptive grouped-card snapping in stacked message renderers.
 *
 * Each message card reports its measured width and same-group neighbors.
 * The tracker then resolves deterministic snapped widths for the connected
 * sender group so both DM and group stacked renderers can derive the same
 * final shape rules from the same data.
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

export class CardWidthTracker {
  private nodes = new Map<string, CardWidthNode>();
  private listeners = new Map<
    string,
    Set<(snapshot: CardWidthSnapshot) => void>
  >();

  private ensureNode(id: string): CardWidthNode {
    let node = this.nodes.get(id);
    if (!node) {
      node = {};
      this.nodes.set(id, node);
    }
    return node;
  }

  /** Store a measured width and notify the affected sender-group. */
  report(id: string, width: number): void {
    const rounded = normalizeGroupedCardWidth(width);
    const node = this.ensureNode(id);
    if (node.width === rounded) return;

    node.width = rounded;
    this.notifyGroup(id);
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
    this.notifyIds(affectedIds);
  }

  /** Read a previously measured raw width (undefined if not yet measured). */
  getWidth(id: string): number | undefined {
    return this.nodes.get(id)?.width;
  }

  /** Read the current snapped-width snapshot for a message. */
  getSnapshot(id: string): CardWidthSnapshot {
    const node = this.nodes.get(id);
    if (!node) {
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
    this.notifyIds(this.listeners.keys());
  }

  private resolveSnappedWidth(id: string): number | undefined {
    return resolveGroupedCardSnappedWidth({
      messageId: id,
      getWidth: (messageId) => this.nodes.get(messageId)?.width,
      getPrevMessageId: (messageId) => this.nodes.get(messageId)?.prevId,
      getNextMessageId: (messageId) => this.nodes.get(messageId)?.nextId,
    });
  }

  private collectGroupIds(startId: string | undefined, seen: Set<string>): void {
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

  private notifyGroup(id: string): void {
    const affectedIds = new Set<string>();
    this.collectGroupIds(id, affectedIds);
    if (affectedIds.size === 0) {
      affectedIds.add(id);
    }
    this.notifyIds(affectedIds);
  }

  private notifyIds(ids: Iterable<string>): void {
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
