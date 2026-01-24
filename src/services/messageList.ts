/**
 * Message List Service (H5)
 *
 * Real-time Firestore subscription for message lists.
 * Orders by serverReceivedAt for authoritative ordering.
 *
 * Features:
 * - Real-time subscription with serverReceivedAt ordering
 * - Cursor-based pagination (load older/newer)
 * - Unread count calculation via watermarks
 * - Mention tracking
 *
 * @module services/messageList
 */

import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  endBefore,
  onSnapshot,
  getDocs,
  getCountFromServer,
  where,
  DocumentSnapshot,
  QueryDocumentSnapshot,
  QueryConstraint,
  Timestamp,
  Query,
  DocumentData,
} from "firebase/firestore";
import { getFirestoreInstance } from "./firebase";

// Lazy initialization - don't call at module load time
const getDb = () => getFirestoreInstance();
import { MessageV2 } from "@/types/messaging";
import { createLogger } from "@/utils/log";

const log = createLogger("messageList");

// =============================================================================
// Types
// =============================================================================

/** Options for message subscription */
interface MessageSubscriptionOptions {
  /** Maximum messages to fetch initially */
  initialLimit?: number;
  /** Callback for messages update */
  onMessages: (messages: MessageV2[]) => void;
  /** Callback for pagination state changes */
  onPaginationState?: (state: MessagePaginationState) => void;
  /** Callback for errors */
  onError?: (error: Error) => void;
  /** Current user ID for filtering hiddenFor */
  currentUid?: string;
}

/** Pagination state */
export interface MessagePaginationState {
  /** First document for backward pagination */
  firstDoc: DocumentSnapshot | null;
  /** Last document for forward pagination */
  lastDoc: DocumentSnapshot | null;
  /** Whether there are more messages before */
  hasMoreBefore: boolean;
  /** Whether there are more messages after (for real-time) */
  hasMoreAfter: boolean;
  /** Total loaded count */
  loadedCount: number;
  /** Loading states */
  isLoadingOlder: boolean;
  isLoadingNewer: boolean;
}

/** Result from pagination load */
export interface PaginationLoadResult {
  messages: MessageV2[];
  hasMore: boolean;
}

// =============================================================================
// Collection References
// =============================================================================

/**
 * Get messages collection for a DM chat
 */
function getDMMessagesCollection(chatId: string) {
  return collection(getDb(), "Chats", chatId, "Messages");
}

/**
 * Get messages collection for a group
 */
function getGroupMessagesCollection(groupId: string) {
  return collection(getDb(), "Groups", groupId, "Messages");
}

/**
 * Get messages collection by scope
 */
function getMessagesCollection(scope: "dm" | "group", conversationId: string) {
  return scope === "dm"
    ? getDMMessagesCollection(conversationId)
    : getGroupMessagesCollection(conversationId);
}

// =============================================================================
// Message Conversion
// =============================================================================

/**
 * Convert Firestore document to MessageV2
 */
function docToMessage(doc: DocumentSnapshot): MessageV2 | null {
  const data = doc.data();
  if (!data) return null;

  // Handle Firestore Timestamps
  const serverReceivedAt =
    data.serverReceivedAt instanceof Timestamp
      ? data.serverReceivedAt.toMillis()
      : data.serverReceivedAt || data.createdAt;

  const createdAt =
    data.createdAt instanceof Timestamp
      ? data.createdAt.toMillis()
      : data.createdAt;

  const editedAt =
    data.editedAt instanceof Timestamp
      ? data.editedAt.toMillis()
      : data.editedAt;

  return {
    id: doc.id,
    scope: data.scope,
    conversationId: data.conversationId,
    senderId: data.senderId,
    senderName: data.senderName,
    senderAvatarConfig: data.senderAvatarConfig,
    kind: data.kind || "text",
    text: data.text || data.content, // Support legacy 'content' field
    createdAt,
    serverReceivedAt,
    editedAt,
    deletedForAll: data.deletedForAll,
    hiddenFor: data.hiddenFor,
    replyTo: data.replyTo,
    attachments: data.attachments,
    mentionUids: data.mentionUids,
    mentionSpans: data.mentionSpans,
    reactionsSummary: data.reactionsSummary,
    linkPreview: data.linkPreview,
    clientId: data.clientId,
    idempotencyKey: data.idempotencyKey,
    // Legacy compatibility
    content: data.content,
    type: data.type,
    read: data.read,
    status: data.status || "sent",
    isLocal: false,
    clientMessageId: data.clientMessageId,
  };
}

/**
 * Filter message for current user (handles hiddenFor)
 */
function shouldShowMessage(message: MessageV2, currentUid?: string): boolean {
  if (!currentUid) return true;
  if (message.hiddenFor?.includes(currentUid)) return false;
  return true;
}

// =============================================================================
// Subscriptions
// =============================================================================

/** Store pagination cursors per conversation */
const paginationCursors = new Map<
  string,
  {
    firstDoc: QueryDocumentSnapshot<DocumentData> | null;
    lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  }
>();

/**
 * Subscribe to DM messages with real-time updates
 *
 * @param chatId - Chat ID
 * @param options - Subscription options
 * @returns Unsubscribe function
 */
export function subscribeToDMMessages(
  chatId: string,
  options: MessageSubscriptionOptions,
): () => void {
  return subscribeToMessages("dm", chatId, options);
}

/**
 * Subscribe to group messages with real-time updates
 *
 * @param groupId - Group ID
 * @param options - Subscription options
 * @returns Unsubscribe function
 */
export function subscribeToGroupMessages(
  groupId: string,
  options: MessageSubscriptionOptions,
): () => void {
  return subscribeToMessages("group", groupId, options);
}

/**
 * Generic message subscription (internal)
 */
function subscribeToMessages(
  scope: "dm" | "group",
  conversationId: string,
  options: MessageSubscriptionOptions,
): () => void {
  const {
    initialLimit = 50,
    onMessages,
    onPaginationState,
    onError,
    currentUid,
  } = options;

  const cursorKey = `${scope}:${conversationId}`;

  log.info("Subscribing to messages", {
    operation: "subscribe",
    data: { scope, conversationId, limit: initialLimit },
  });

  const messagesRef = getMessagesCollection(scope, conversationId);

  // Query: order by serverReceivedAt DESC (newest first), then limit
  // We order DESC to get the N most recent, then reverse for display
  const q = query(
    messagesRef,
    orderBy("serverReceivedAt", "desc"),
    limit(initialLimit),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const messages: MessageV2[] = [];
      let firstDoc: QueryDocumentSnapshot<DocumentData> | null = null;
      let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;

      const docs = snapshot.docs;
      docs.forEach((doc, index) => {
        // Track first and last docs for pagination
        if (index === 0) lastDoc = doc; // Most recent (in DESC order)
        firstDoc = doc; // Oldest in current batch

        const msg = docToMessage(doc);
        if (msg && shouldShowMessage(msg, currentUid)) {
          messages.push(msg);
        }
      });

      // Store cursors for pagination
      paginationCursors.set(cursorKey, { firstDoc, lastDoc });

      // Reverse to get oldest-first for display (chat UI convention)
      messages.reverse();

      // Determine if there are more older messages
      const hasMoreBefore = snapshot.docs.length >= initialLimit;

      onMessages(messages);

      if (onPaginationState) {
        onPaginationState({
          firstDoc,
          lastDoc,
          hasMoreBefore,
          hasMoreAfter: false, // Real-time subscription handles new messages
          loadedCount: messages.length,
          isLoadingOlder: false,
          isLoadingNewer: false,
        });
      }
    },
    (error) => {
      log.error("Messages subscription error", error);
      onError?.(error);
    },
  );
}

/**
 * Load older messages (pagination - scroll up)
 *
 * @param scope - "dm" or "group"
 * @param conversationId - Chat/Group ID
 * @param beforeServerReceivedAt - Load messages before this timestamp
 * @param messageLimit - Number of messages to load
 * @returns Messages and hasMore flag
 */
export async function loadOlderMessages(
  scope: "dm" | "group",
  conversationId: string,
  beforeServerReceivedAt: number,
  messageLimit: number = 25,
): Promise<PaginationLoadResult> {
  const cursorKey = `${scope}:${conversationId}`;
  const cursors = paginationCursors.get(cursorKey);

  log.info("Loading older messages", {
    operation: "loadOlder",
    data: {
      scope,
      conversationId,
      beforeTimestamp: beforeServerReceivedAt,
      limit: messageLimit,
    },
  });

  // If no cursor, use timestamp-based query
  const messagesRef = getMessagesCollection(scope, conversationId);

  let q: Query<DocumentData>;

  if (cursors?.firstDoc) {
    // Use cursor-based pagination (more efficient)
    q = query(
      messagesRef,
      orderBy("serverReceivedAt", "desc"),
      startAfter(cursors.firstDoc),
      limit(messageLimit),
    );
  } else {
    // Fallback to timestamp-based query
    q = query(
      messagesRef,
      orderBy("serverReceivedAt", "desc"),
      where("serverReceivedAt", "<", beforeServerReceivedAt),
      limit(messageLimit),
    );
  }

  try {
    const snapshot = await getDocs(q);

    const messages: MessageV2[] = [];
    let newFirstDoc: QueryDocumentSnapshot<DocumentData> | null = null;

    snapshot.forEach((doc) => {
      newFirstDoc = doc; // Track oldest doc
      const msg = docToMessage(doc);
      if (msg) messages.push(msg);
    });

    // Update cursor for next pagination
    if (newFirstDoc) {
      const existing = paginationCursors.get(cursorKey);
      paginationCursors.set(cursorKey, {
        firstDoc: newFirstDoc,
        lastDoc: existing?.lastDoc || null,
      });
    }

    // Reverse for display (oldest first)
    messages.reverse();

    const hasMore = snapshot.docs.length >= messageLimit;

    log.info("Loaded older messages", {
      operation: "loadOlder",
      data: { count: messages.length, hasMore },
    });

    return { messages, hasMore };
  } catch (error) {
    log.error("Failed to load older messages", error);
    throw error;
  }
}

/**
 * Load newer messages (for catching up after reconnect)
 *
 * @param scope - "dm" or "group"
 * @param conversationId - Chat/Group ID
 * @param afterServerReceivedAt - Load messages after this timestamp
 * @param messageLimit - Number of messages to load
 * @returns Messages and hasMore flag
 */
export async function loadNewerMessages(
  scope: "dm" | "group",
  conversationId: string,
  afterServerReceivedAt: number,
  messageLimit: number = 25,
): Promise<PaginationLoadResult> {
  log.info("Loading newer messages", {
    operation: "loadNewer",
    data: {
      scope,
      conversationId,
      afterTimestamp: afterServerReceivedAt,
      limit: messageLimit,
    },
  });

  const messagesRef = getMessagesCollection(scope, conversationId);

  // Query messages newer than the given timestamp
  const q = query(
    messagesRef,
    orderBy("serverReceivedAt", "asc"), // ASC to get oldest first after timestamp
    where("serverReceivedAt", ">", afterServerReceivedAt),
    limit(messageLimit),
  );

  try {
    const snapshot = await getDocs(q);

    const messages: MessageV2[] = [];
    snapshot.forEach((doc) => {
      const msg = docToMessage(doc);
      if (msg) messages.push(msg);
    });

    const hasMore = snapshot.docs.length >= messageLimit;

    log.info("Loaded newer messages", {
      operation: "loadNewer",
      data: { count: messages.length, hasMore },
    });

    return { messages, hasMore };
  } catch (error) {
    log.error("Failed to load newer messages", error);
    throw error;
  }
}

// =============================================================================
// Unread Counting
// =============================================================================

/**
 * Count unread messages since watermark
 *
 * Uses Firestore's count aggregation for efficiency.
 *
 * @param scope - "dm" or "group"
 * @param conversationId - Chat/Group ID
 * @param watermark - Last seen timestamp (serverReceivedAt)
 * @param currentUid - Current user ID (to exclude own messages)
 * @returns Unread count
 */
export async function countUnreadSince(
  scope: "dm" | "group",
  conversationId: string,
  watermark: number,
  currentUid?: string,
): Promise<number> {
  log.debug("Counting unreads", {
    operation: "countUnread",
    data: { scope, conversationId, watermark },
  });

  const messagesRef = getMessagesCollection(scope, conversationId);

  // Query: messages with serverReceivedAt > watermark
  // Note: We could also filter by senderId != currentUid, but that requires composite index
  const q = query(messagesRef, where("serverReceivedAt", ">", watermark));

  try {
    // Use count aggregation (more efficient than fetching all docs)
    const countSnapshot = await getCountFromServer(q);
    const count = countSnapshot.data().count;

    log.debug("Unread count result", {
      operation: "countUnread",
      data: { count },
    });

    return count;
  } catch (error) {
    // Fallback: if count aggregation fails, estimate from query
    log.warn("Count aggregation failed, using fallback", {
      operation: "countUnread",
    });

    try {
      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (fallbackError) {
      log.error("Failed to count unreads", fallbackError);
      return 0;
    }
  }
}

/**
 * Estimate unread count without querying (for UI badges)
 *
 * Compares conversation's lastMessageAt with user's watermark.
 *
 * @param lastMessageAt - Conversation's last message timestamp
 * @param watermark - User's last seen timestamp
 * @returns true if there are unreads, false otherwise
 */
export function hasUnreadMessages(
  lastMessageAt: number,
  watermark: number,
): boolean {
  return lastMessageAt > watermark;
}

/**
 * Get unread message IDs for mention highlighting
 *
 * @param scope - "dm" or "group"
 * @param conversationId - Chat/Group ID
 * @param uid - Current user ID
 * @param watermark - Last seen timestamp
 * @returns Array of message IDs that mention the user and are unread
 */
export async function getUnreadMentions(
  scope: "dm" | "group",
  conversationId: string,
  uid: string,
  watermark: number,
): Promise<string[]> {
  log.debug("Getting unread mentions", {
    operation: "getUnreadMentions",
    data: { scope, conversationId, watermark },
  });

  const messagesRef = getMessagesCollection(scope, conversationId);

  // Query: messages where mentionUids contains uid AND serverReceivedAt > watermark
  // Note: This requires a composite index on (mentionUids, serverReceivedAt)
  const q = query(
    messagesRef,
    where("mentionUids", "array-contains", uid),
    where("serverReceivedAt", ">", watermark),
  );

  try {
    const snapshot = await getDocs(q);
    const messageIds = snapshot.docs.map((doc) => doc.id);

    log.debug("Found unread mentions", {
      operation: "getUnreadMentions",
      data: { count: messageIds.length },
    });

    return messageIds;
  } catch (error) {
    log.error("Failed to get unread mentions", error);
    return [];
  }
}

/**
 * Count unread mentions for badge display
 *
 * @param scope - "dm" or "group"
 * @param conversationId - Chat/Group ID
 * @param uid - Current user ID
 * @param watermark - Last seen timestamp
 * @returns Count of unread mentions
 */
export async function countUnreadMentions(
  scope: "dm" | "group",
  conversationId: string,
  uid: string,
  watermark: number,
): Promise<number> {
  const messagesRef = getMessagesCollection(scope, conversationId);

  const q = query(
    messagesRef,
    where("mentionUids", "array-contains", uid),
    where("serverReceivedAt", ">", watermark),
  );

  try {
    const countSnapshot = await getCountFromServer(q);
    return countSnapshot.data().count;
  } catch (error) {
    log.error("Failed to count unread mentions", error);
    return 0;
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Reset pagination cursors for a conversation
 *
 * Call this when leaving a chat screen or re-initializing.
 */
export function resetPaginationCursor(
  scope: "dm" | "group",
  conversationId: string,
): void {
  const cursorKey = `${scope}:${conversationId}`;
  paginationCursors.delete(cursorKey);
  log.debug("Reset pagination cursor", { operation: "resetCursor" });
}

/**
 * Clear all pagination cursors
 */
export function clearAllPaginationCursors(): void {
  paginationCursors.clear();
  log.debug("Cleared all pagination cursors", { operation: "clearCursors" });
}

/**
 * Get a single message by ID
 *
 * @param scope - "dm" or "group"
 * @param conversationId - Chat/Group ID
 * @param messageId - Message ID
 * @returns Message or null if not found
 */
export async function getMessage(
  scope: "dm" | "group",
  conversationId: string,
  messageId: string,
): Promise<MessageV2 | null> {
  const { doc: docRef, getDoc } = await import("firebase/firestore");

  const collectionPath = scope === "dm" ? "Chats" : "Groups";
  const messageRef = docRef(
    getDb(),
    collectionPath,
    conversationId,
    "Messages",
    messageId,
  );

  try {
    const snapshot = await getDoc(messageRef);
    if (!snapshot.exists()) return null;
    return docToMessage(snapshot);
  } catch (error) {
    log.error("Failed to get message", error);
    return null;
  }
}

/**
 * Search messages in a conversation
 *
 * Note: Full-text search requires external service (Algolia/Typesense).
 * This is a basic prefix search on text field.
 *
 * @param scope - "dm" or "group"
 * @param conversationId - Chat/Group ID
 * @param searchText - Text to search for
 * @param limitCount - Maximum results
 * @returns Matching messages
 */
export async function searchMessages(
  scope: "dm" | "group",
  conversationId: string,
  searchText: string,
  limitCount: number = 20,
): Promise<MessageV2[]> {
  // Firestore doesn't support full-text search
  // This is a placeholder that would need to be replaced with
  // Algolia, Typesense, or similar search service

  log.warn("searchMessages: Full-text search not implemented", {
    operation: "search",
    data: { searchText },
  });

  // For now, just return empty array
  // In production, integrate with search service
  return [];
}
