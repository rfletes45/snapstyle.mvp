/**
 * useMessageSearch Hook
 *
 * Discord-inspired message search across all visible conversations.
 * Searches conversation names AND message text using SQLite FTS5 (with a
 * LIKE fallback for runtimes that lack FTS5, e.g. Expo Go).
 *
 * Design notes
 * ────────────
 * The hook exposes a simple public API (query, filters, results, status) and
 * hides a small state machine internally:
 *
 *    idle ──► searching ──► ready (results / empty)
 *                         └► error
 *    (reset / cleared inputs returns to idle)
 *
 * Cancellation uses a monotonic token (`searchTokenRef`). Each time the user
 * changes an input we increment the token; any in-flight search whose token
 * doesn't match the current one is considered stale and silently drops its
 * result. A single watchdog timer guarantees the loading state never wedges
 * for longer than SEARCH_TIMEOUT_MS.
 *
 * Critical stability rule: the effect that schedules searches ONLY depends on
 * user-controlled inputs (query + filters). The conversation roster is read
 * from a ref at query time. This prevents inbox subscription churn (new DMs,
 * new groups, initial sync) from perpetually restarting the debounce timer
 * and trapping the UI in a "Searching…" state.
 *
 * @module hooks/useMessageSearch
 */

import {
  getDatabase,
  getDatabaseOwnerUid,
  isDatabaseRuntimeAvailable,
} from "@/services/database";
import { normalizeMessageFromFirestoreDoc } from "@/services/chat/normalizeMessage";
import { getFirestoreInstance } from "@/services/firebase";
import { fullSyncConversation } from "@/services/sync/syncEngine";
import {
  addRecentSearch,
  clearRecentSearches,
  getInboxSettings,
  updateInboxSettings,
} from "@/services/inboxSettings";
import { useAuth } from "@/store/AuthContext";
import type { InboxConversation, MessageV2 } from "@/types/messaging";
import { createLogger } from "@/utils/log";
import {
  collection,
  getDocs,
  limit as firestoreLimit,
  orderBy,
  query as firestoreQuery,
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const log = createLogger("useMessageSearch");

// =============================================================================
// Public Types
// =============================================================================

export type ScopeFilter = "all" | "dms" | "groups";
export type ContentFilter = "all" | "media" | "links" | "files";

/** Single unified status — replaces the isSearching/hasSearched flag pair. */
export type SearchStatus =
  | "idle"
  | "pending"
  | "executing"
  | "searching"
  | "ready"
  | "error";

export interface DateRangeFilter {
  after?: number;
  before?: number;
}

export interface PersonFilter {
  userId: string;
  displayName: string;
}

export interface MessageSearchResult {
  type: "message";
  messageId: string;
  conversationId: string;
  conversationScope: "dm" | "group";
  conversationName: string;
  conversationAvatar: string | null;
  otherUserId: string | null;
  senderName: string | null;
  senderId: string;
  text: string;
  timestamp: number;
  kind: string;
  matchedText: string;
  thumbnailUrl: string | null;
  imageUrl: string | null;
}

export interface ConversationSearchResult {
  type: "conversation";
  conversation: InboxConversation;
}

export type SearchResult = MessageSearchResult | ConversationSearchResult;

interface UseMessageSearchOptions {
  /** Whether the surrounding inbox has finished its initial load. Optional. */
  inboxReady?: boolean;
}

// =============================================================================
// Internal Types
// =============================================================================

interface SQLiteMessageRow {
  id: string;
  conversation_id: string;
  scope: string;
  sender_id: string;
  sender_name: string | null;
  text: string | null;
  kind: string;
  created_at: number;
  server_received_at: number | null;
  image_url: string | null;
  thumb_url: string | null;
}

interface SearchCriteria {
  trimmedQuery: string;
  scope: ScopeFilter;
  content: ContentFilter;
  dateAfter: number | null;
  dateBefore: number | null;
  person: PersonFilter | null;
}

class SearchStageTimeoutError extends Error {
  constructor(
    readonly stage: string,
    readonly timeoutMs: number,
  ) {
    super(`${stage} timed out after ${timeoutMs}ms`);
    this.name = "SearchStageTimeoutError";
  }
}

// =============================================================================
// Constants
// =============================================================================

const DEBOUNCE_MS = 0;
const SLOW_LOADING_THRESHOLD_MS = 220;
const SEARCH_TIMEOUT_MS = 15000;
const MAX_MESSAGE_RESULTS = 50;
const MAX_CONVERSATION_RESULTS = 10;
const MAX_VISIBLE_CONVERSATION_SQL_PARAMS = 900;
const RECENT_SYNC_TTL_MS = 60_000;
const RECENT_SYNC_MESSAGE_LIMIT = 50;
const MAX_RECENT_SYNC_CONVERSATIONS = 40;
const RECENT_SYNC_CONCURRENCY = 4;
const RECENT_SYNC_BUDGET_MS = 3500;
const RECENT_SYNC_CONVERSATION_BUDGET_MS = 2500;
const BACKGROUND_HYDRATION_DELAY_MS = 250;
const REMOTE_RECENT_SEARCH_CONVERSATIONS = 24;
const REMOTE_RECENT_MESSAGE_LIMIT = 50;
const REMOTE_SEARCH_CONCURRENCY = 4;
const REMOTE_SEARCH_BUDGET_MS = 4500;
const REMOTE_SEARCH_CONVERSATION_BUDGET_MS = 2500;
const LOCAL_SEARCH_BUDGET_MS = 2500;

// =============================================================================
// Pure Helpers
// =============================================================================

/**
 * Wrap each word from the user's input in FTS5-safe quotes.
 * Prevents punctuation (-, :, (, ) …) from being interpreted as FTS operators.
 */
function sanitizeFtsQuery(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `"${word.replace(/"/g, '""')}"`)
    .join(" ");
}

function formatSearchError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "Search failed. Please try again.";
}

function criteriaLogData(criteria: SearchCriteria) {
  const hasActiveQuery = criteria.trimmedQuery.length > 0;
  const hasActiveContentFilter = criteria.content !== "all";
  const hasActiveScopeFilter = criteria.scope !== "all";
  const hasActiveDateFilter =
    criteria.dateAfter != null || criteria.dateBefore != null;
  const hasActivePersonFilter = criteria.person != null;

  return {
    queryLen: criteria.trimmedQuery.length,
    scope: criteria.scope,
    content: criteria.content,
    hasAfter: criteria.dateAfter != null,
    hasBefore: criteria.dateBefore != null,
    hasPerson: criteria.person != null,
    hasActiveQuery,
    hasActiveContentFilter,
    hasActiveScopeFilter,
    hasActiveDateFilter,
    hasActivePersonFilter,
    hasAnyActiveCriteria:
      hasActiveQuery ||
      hasActiveContentFilter ||
      hasActiveScopeFilter ||
      hasActiveDateFilter ||
      hasActivePersonFilter,
  };
}

function withStageTimeout<T>(
  task: () => Promise<T>,
  stage: string,
  timeoutMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      reject(new SearchStageTimeoutError(stage, timeoutMs));
    }, timeoutMs);
  });

  return Promise.race([
    Promise.resolve()
      .then(task)
      .finally(() => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      }),
    timeout,
  ]).finally(() => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  });
}

function hasAnyFilter(c: SearchCriteria): boolean {
  return (
    c.scope !== "all" ||
    c.content !== "all" ||
    c.dateAfter != null ||
    c.dateBefore != null ||
    c.person != null
  );
}

function isFtsUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return msg.includes("no such table") || msg.includes("fts5");
}

/**
 * Append a WHERE clause that constrains results to visible conversations.
 * For very large inboxes we skip the IN(...) clause to stay under SQLite's
 * 999-host-parameter limit and rely on post-query filtering via the
 * conversation map.
 */
function appendVisibleConversationFilter(
  whereClauses: string[],
  params: (string | number)[],
  conversations: InboxConversation[],
): void {
  if (conversations.length === 0) {
    whereClauses.push("1 = 0");
    return;
  }
  if (conversations.length > MAX_VISIBLE_CONVERSATION_SQL_PARAMS) {
    log.warn("Skipping SQL conversation filter: too many conversations", {
      data: { conversationCount: conversations.length },
    });
    return;
  }
  const ids = conversations.map((conversation) => conversation.id);
  const placeholders = ids.map(() => "?").join(", ");
  whereClauses.push(`m.conversation_id IN (${placeholders})`);
  params.push(...ids);
}

/** Build the shared WHERE clauses + params for both FTS5 and LIKE paths. */
function buildCommonWhere(
  criteria: SearchCriteria,
  conversations: InboxConversation[],
): { whereClauses: string[]; params: (string | number)[] } {
  const whereClauses: string[] = [
    "m.owner_uid = ?",
    "m.deleted_for_all = 0",
  ];
  const params: (string | number)[] = [getDatabaseOwnerUid()];
  appendVisibleConversationFilter(whereClauses, params, conversations);

  switch (criteria.scope) {
    case "dms":
      whereClauses.push("m.scope = 'dm'");
      break;
    case "groups":
      whereClauses.push("m.scope = 'group'");
      break;
  }

  switch (criteria.content) {
    case "media":
      whereClauses.push(
        `(m.kind = 'media' OR EXISTS (
          SELECT 1 FROM attachments a
          WHERE a.owner_uid = m.owner_uid
            AND a.message_id = m.id
            AND a.kind IN ('image', 'video')
        ))`,
      );
      break;
    case "links":
      whereClauses.push(
        "(m.text LIKE '%http://%' OR m.text LIKE '%https://%')",
      );
      break;
    case "files":
      whereClauses.push(
        `(m.kind = 'file' OR EXISTS (
          SELECT 1 FROM attachments a
          WHERE a.owner_uid = m.owner_uid
            AND a.message_id = m.id
            AND a.kind = 'file'
        ))`,
      );
      break;
  }

  if (criteria.dateAfter != null) {
    whereClauses.push("COALESCE(m.server_received_at, m.created_at) >= ?");
    params.push(criteria.dateAfter);
  }
  if (criteria.dateBefore != null) {
    whereClauses.push("COALESCE(m.server_received_at, m.created_at) <= ?");
    params.push(criteria.dateBefore);
  }
  if (criteria.person) {
    whereClauses.push("m.sender_id = ?");
    params.push(criteria.person.userId);
  }

  return { whereClauses, params };
}

function mapRowsToResults(
  rows: SQLiteMessageRow[],
  conversationMap: Map<string, InboxConversation>,
): MessageSearchResult[] {
  const out: MessageSearchResult[] = [];
  for (const row of rows) {
    const conv = conversationMap.get(row.conversation_id);
    if (!conv) continue; // Only surface messages from visible conversations
    out.push({
      type: "message",
      messageId: row.id,
      conversationId: row.conversation_id,
      conversationScope: row.scope as "dm" | "group",
      conversationName: conv.name,
      conversationAvatar: conv.profilePictureUrl || conv.avatarUrl || null,
      otherUserId: conv.otherUserId || null,
      senderName: row.sender_name,
      senderId: row.sender_id,
      text: row.text || "",
      timestamp: row.server_received_at || row.created_at,
      kind: row.kind,
      matchedText: row.text || "",
      thumbnailUrl: row.thumb_url || null,
      imageUrl: row.image_url || null,
    });
  }
  return out;
}

function conversationMatchesScope(
  conversation: InboxConversation,
  scope: ScopeFilter,
): boolean {
  if (scope === "dms") return conversation.type === "dm";
  if (scope === "groups") return conversation.type === "group";
  return true;
}

function getResultKey(result: MessageSearchResult): string {
  return `${result.conversationScope}:${result.conversationId}:${result.messageId}`;
}

function hasDeletedForAll(message: MessageV2): boolean {
  return !!message.deletedForAll;
}

function getMessageTimestamp(message: MessageV2): number {
  return message.serverReceivedAt || message.createdAt || 0;
}

function getFirstImageAttachment(message: MessageV2) {
  return message.attachments?.find(
    (attachment) => attachment.kind === "image" || attachment.kind === "video",
  );
}

function getFirstCaption(message: MessageV2): string {
  return (
    message.attachments?.find((attachment) => attachment.caption?.trim())
      ?.caption ?? ""
  );
}

function getDisplayTextForMessage(message: MessageV2): string {
  const caption = getFirstCaption(message);
  if (message.text?.trim()) return message.text;
  if (caption.trim()) return caption;
  if (message.kind === "media") return "Photo";
  if (message.kind === "file") return "File";
  if (message.kind === "voice") return "Voice message";
  if (message.kind === "animal") return message.animalId || "Animal message";
  return "";
}

function messageMatchesContentFilter(
  message: MessageV2,
  content: ContentFilter,
): boolean {
  if (content === "all") return true;

  const attachments = message.attachments ?? [];
  if (content === "media") {
    return (
      message.kind === "media" ||
      attachments.some(
        (attachment) =>
          attachment.kind === "image" || attachment.kind === "video",
      )
    );
  }

  if (content === "files") {
    return (
      message.kind === "file" ||
      attachments.some((attachment) => attachment.kind === "file")
    );
  }

  const text = getDisplayTextForMessage(message);
  return /https?:\/\//i.test(text);
}

function messageMatchesTextQuery(
  message: MessageV2,
  trimmedQuery: string,
): boolean {
  if (!trimmedQuery) return true;

  const needle = trimmedQuery.toLowerCase();
  const haystacks = [
    message.text,
    message.senderName,
    getFirstCaption(message),
    message.animalId,
  ];

  return haystacks.some((value) => value?.toLowerCase().includes(needle));
}

function messageMatchesCriteria(
  message: MessageV2,
  criteria: SearchCriteria,
  currentUid: string,
): boolean {
  if (hasDeletedForAll(message)) return false;
  if (currentUid && message.hiddenFor?.includes(currentUid)) return false;
  if (criteria.person && message.senderId !== criteria.person.userId) {
    return false;
  }

  const timestamp = getMessageTimestamp(message);
  if (criteria.dateAfter != null && timestamp < criteria.dateAfter) {
    return false;
  }
  if (criteria.dateBefore != null && timestamp > criteria.dateBefore) {
    return false;
  }

  if (!messageMatchesContentFilter(message, criteria.content)) {
    return false;
  }

  return messageMatchesTextQuery(message, criteria.trimmedQuery);
}

function mapRemoteMessageToResult(
  message: MessageV2,
  conversation: InboxConversation,
): MessageSearchResult {
  const imageAttachment = getFirstImageAttachment(message);
  const text = getDisplayTextForMessage(message);

  return {
    type: "message",
    messageId: message.id,
    conversationId: conversation.id,
    conversationScope: conversation.type,
    conversationName: conversation.name,
    conversationAvatar:
      conversation.profilePictureUrl || conversation.avatarUrl || null,
    otherUserId: conversation.otherUserId || null,
    senderName: message.senderName || null,
    senderId: message.senderId,
    text,
    timestamp: getMessageTimestamp(message),
    kind: message.kind,
    matchedText: text,
    thumbnailUrl: imageAttachment?.thumbUrl || imageAttachment?.url || null,
    imageUrl: imageAttachment?.url || null,
  };
}

function mergeMessageResults(
  localResults: MessageSearchResult[],
  remoteResults: MessageSearchResult[],
): MessageSearchResult[] {
  const seen = new Set<string>();
  const merged: MessageSearchResult[] = [];

  for (const result of [...localResults, ...remoteResults]) {
    const key = getResultKey(result);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(result);
  }

  return merged
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_MESSAGE_RESULTS);
}

function mergeSearchResults(
  existingResults: SearchResult[],
  remoteMessageResults: MessageSearchResult[],
): SearchResult[] {
  if (remoteMessageResults.length === 0) return existingResults;

  const conversationResults = existingResults.filter(
    (result): result is ConversationSearchResult =>
      result.type === "conversation",
  );
  const existingMessageResults = existingResults.filter(
    (result): result is MessageSearchResult => result.type === "message",
  );

  return [
    ...conversationResults.slice(0, MAX_CONVERSATION_RESULTS),
    ...mergeMessageResults(existingMessageResults, remoteMessageResults),
  ];
}

async function fetchRemoteRecentMessages(
  conversation: InboxConversation,
): Promise<MessageV2[]> {
  const firestore = getFirestoreInstance();
  const messagesRef =
    conversation.type === "dm"
      ? collection(firestore, "Chats", conversation.id, "Messages")
      : collection(firestore, "Groups", conversation.id, "Messages");

  const runQuery = async (
    orderField: "createdAt" | "serverReceivedAt" | "timestamp" | "sentAt",
  ) => {
    const snap = await getDocs(
      firestoreQuery(
        messagesRef,
        orderBy(orderField, "desc"),
        firestoreLimit(REMOTE_RECENT_MESSAGE_LIMIT),
      ),
    );

    return snap.docs.map((docSnap) =>
      normalizeMessageFromFirestoreDoc({
        id: docSnap.id,
        data: docSnap.data() as Record<string, unknown>,
        scopeHint: conversation.type,
        conversationIdHint: conversation.id,
      }),
    );
  };

  const orderFields = [
    "createdAt",
    "serverReceivedAt",
    "timestamp",
    "sentAt",
  ] as const;
  let lastError: unknown = null;

  for (const orderField of orderFields) {
    try {
      const messages = await runQuery(orderField);
      log.debug("remote search: messages fetched", {
        data: {
          conversationId: conversation.id,
          scope: conversation.type,
          orderField,
          messageCount: messages.length,
        },
      });
      if (
        messages.length > 0 ||
        orderField === orderFields[orderFields.length - 1]
      ) {
        return messages;
      }
    } catch (error) {
      lastError = error;
      log.warn("remote search: ordered query failed", {
        data: {
          conversationId: conversation.id,
          scope: conversation.type,
          orderField,
          error,
        },
      });
    }
  }

  throw lastError ?? new Error("Remote message query failed");
}

async function queryRemoteRecentMessages(
  criteria: SearchCriteria,
  conversations: InboxConversation[],
  currentUid: string,
  isStale: () => boolean,
  existingKeys: Set<string>,
): Promise<MessageSearchResult[]> {
  const candidates = conversations
    .filter((conversation) =>
      conversationMatchesScope(conversation, criteria.scope),
    )
    .slice(0, REMOTE_RECENT_SEARCH_CONVERSATIONS);

  if (candidates.length === 0) {
    log.debug("remote search: skipped", {
      data: {
        reason: "no-candidates",
        conversationCount: conversations.length,
        ...criteriaLogData(criteria),
      },
    });
    return [];
  }

  log.debug("remote search: start", {
    data: {
      candidateCount: candidates.length,
      existingCount: existingKeys.size,
      ...criteriaLogData(criteria),
    },
  });

  const results: MessageSearchResult[] = [];
  let cursor = 0;
  let scanned = 0;
  let completed = 0;
  let emptyConversations = 0;
  let failed = 0;
  let timedOutConversations = 0;
  let budgetExpired = false;
  const startedAt = Date.now();
  const workerCount = Math.min(REMOTE_SEARCH_CONCURRENCY, candidates.length);

  const worker = async (workerIndex: number) => {
    while (!isStale() && !budgetExpired) {
      const index = cursor;
      const conversation = candidates[cursor++];
      if (!conversation) return;
      const conversationStartedAt = Date.now();

      try {
        log.debug("remote search: conversation start", {
          data: {
            workerIndex,
            index,
            conversationId: conversation.id,
            scope: conversation.type,
          },
        });
        const messages = await withStageTimeout(
          () => fetchRemoteRecentMessages(conversation),
          `remote search ${conversation.type}:${conversation.id}`,
          REMOTE_SEARCH_CONVERSATION_BUDGET_MS,
        );
        if (isStale() || budgetExpired) {
          log.debug("remote search: conversation result discarded", {
            data: {
              workerIndex,
              index,
              conversationId: conversation.id,
              scope: conversation.type,
              stale: isStale(),
              budgetExpired,
            },
          });
          return;
        }
        scanned += messages.length;
        if (messages.length === 0) {
          emptyConversations++;
          log.debug("remote search: conversation empty", {
            data: {
              workerIndex,
              index,
              conversationId: conversation.id,
              scope: conversation.type,
              durationMs: Date.now() - conversationStartedAt,
            },
          });
        }

        let matchedInConversation = 0;
        for (const message of messages) {
          if (!messageMatchesCriteria(message, criteria, currentUid)) continue;
          const result = mapRemoteMessageToResult(message, conversation);
          const key = getResultKey(result);
          if (existingKeys.has(key)) continue;
          existingKeys.add(key);
          results.push(result);
          matchedInConversation++;
          if (results.length >= MAX_MESSAGE_RESULTS) {
            budgetExpired = true;
            break;
          }
        }
        completed++;
        log.debug("remote search: conversation complete", {
          data: {
            workerIndex,
            index,
            conversationId: conversation.id,
            scope: conversation.type,
            scanned: messages.length,
            matchedInConversation,
            matchedSoFar: results.length,
            settledCount: completed + failed,
            durationMs: Date.now() - conversationStartedAt,
          },
        });
      } catch (error) {
        failed++;
        if (error instanceof SearchStageTimeoutError) {
          timedOutConversations++;
        }
        log.warn("remote search: conversation query failed", {
          data: {
            workerIndex,
            index,
            conversationId: conversation.id,
            scope: conversation.type,
            timedOut: error instanceof SearchStageTimeoutError,
            settledCount: completed + failed,
            durationMs: Date.now() - conversationStartedAt,
            error,
          },
        });
      }
    }
  };

  let timedOut = false;
  log.debug("remote search: fanout start", {
    data: {
      workerCount,
      candidateCount: candidates.length,
      budgetMs: REMOTE_SEARCH_BUDGET_MS,
      perConversationBudgetMs: REMOTE_SEARCH_CONVERSATION_BUDGET_MS,
      ...criteriaLogData(criteria),
    },
  });

  try {
    await withStageTimeout(
      () =>
        Promise.all(
          Array.from({ length: workerCount }, (_, workerIndex) =>
            worker(workerIndex),
          ),
        ).then(() => undefined),
      "remote search fanout",
      REMOTE_SEARCH_BUDGET_MS,
    );
  } catch (error) {
    timedOut = error instanceof SearchStageTimeoutError;
    budgetExpired = true;
    log.warn("remote search: fanout stopped", {
      data: {
        timedOut,
        stale: isStale(),
        settledCount: completed + failed,
        completed,
        failed,
        error,
      },
    });
  }

  log.debug("remote search: complete", {
    data: {
      resultCount: results.length,
      scanned,
      completed,
      emptyConversations,
      failed,
      timedOutConversations,
      timedOut,
      stale: isStale(),
      durationMs: Date.now() - startedAt,
    },
  });

  return results;
}

// =============================================================================
// Hook
// =============================================================================

export function useMessageSearch(
  allConversations: InboxConversation[] = [],
  options: UseMessageSearchOptions = {},
) {
  const { inboxReady = true } = options;
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid ?? "";

  // ── Inputs (user-controlled) ─────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [contentFilter, setContentFilter] = useState<ContentFilter>("all");
  const [dateRange, setDateRange] = useState<DateRangeFilter>({});
  const [personFilter, setPersonFilter] = useState<PersonFilter | null>(null);

  // ── Outputs ──────────────────────────────────────────────────────────────
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [commitRevision, setCommitRevision] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // ── Scheduling / cancellation primitives ─────────────────────────────────
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceSequenceRef = useRef(0);
  const pendingDebounceRef = useRef<{
    id: number;
    token: number;
    targetFireAt: number;
    criteria: SearchCriteria;
  } | null>(null);
  const watchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slowLoadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  /**
   * Monotonic search token. Incremented every time the user's inputs change
   * or the search is reset. Only the holder of the latest token is allowed
   * to commit results / clear loading.
   */
  const searchTokenRef = useRef(0);
  const commitRevisionRef = useRef(0);
  const recentSyncRef = useRef<Map<string, number>>(new Map());

  // ── Latest-roster refs (NOT effect deps; read at query time) ─────────────
  const allConversationsRef = useRef(allConversations);
  allConversationsRef.current = allConversations;

  const conversationMap = useMemo(() => {
    const map = new Map<string, InboxConversation>();
    for (const c of allConversations) map.set(c.id, c);
    return map;
  }, [allConversations]);

  const conversationMapRef = useRef(conversationMap);
  conversationMapRef.current = conversationMap;

  const inboxReadyRef = useRef(inboxReady);
  inboxReadyRef.current = inboxReady;

  // Primitive projections of complex filter state — stable equality keeps the
  // scheduling effect from re-firing when a consumer passes a fresh object
  // with identical content (e.g. `setDateRange({})`).
  const dateAfter = dateRange.after ?? null;
  const dateBefore = dateRange.before ?? null;
  const personId = personFilter?.userId ?? null;
  const personDisplayName = personFilter?.displayName ?? "";

  // =========================================================================
  // Timer helpers
  // =========================================================================

  const clearDebounce = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    pendingDebounceRef.current = null;
  }, []);

  const clearWatchdog = useCallback(() => {
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
  }, []);

  const clearSlowLoading = useCallback(() => {
    if (slowLoadingTimerRef.current) {
      clearTimeout(slowLoadingTimerRef.current);
      slowLoadingTimerRef.current = null;
    }
  }, []);

  const clearHydrationTimer = useCallback(() => {
    if (hydrationTimerRef.current) {
      clearTimeout(hydrationTimerRef.current);
      hydrationTimerRef.current = null;
    }
  }, []);

  const bumpCommitRevision = useCallback(
    (
      source: string,
      criteria?: SearchCriteria,
      extra?: Record<string, unknown>,
    ) => {
      const nextRevision = commitRevisionRef.current + 1;
      commitRevisionRef.current = nextRevision;
      setCommitRevision(nextRevision);
      log.debug("search: ui revision", {
        data: {
          revision: nextRevision,
          source,
          ...(criteria ? criteriaLogData(criteria) : {}),
          ...extra,
        },
      });
    },
    [],
  );

  const armSearchWatchdog = useCallback(
    (criteria: SearchCriteria, token: number, source: string) => {
      clearWatchdog();
      log.debug("watchdog armed", {
        data: {
          token,
          source,
          timeoutMs: SEARCH_TIMEOUT_MS,
          ...criteriaLogData(criteria),
        },
      });
      watchdogTimerRef.current = setTimeout(() => {
        if (token !== searchTokenRef.current) return;
        log.error("watchdog: search timed out", {
          data: {
            token,
            source,
            ...criteriaLogData(criteria),
          },
        });
        // Orphan the in-flight search (if any) by bumping the token.
        searchTokenRef.current += 1;
        clearDebounce();
        clearSlowLoading();
        watchdogTimerRef.current = null;
        setResults([]);
        setError("Search timed out. Try narrowing your search or filters.");
        setStatus("error");
        bumpCommitRevision("watchdog-error", criteria, { token, source });
      }, SEARCH_TIMEOUT_MS);
    },
    [bumpCommitRevision, clearDebounce, clearSlowLoading, clearWatchdog],
  );

  const armSlowLoading = useCallback(
    (criteria: SearchCriteria, token: number, source: string) => {
      clearSlowLoading();
      log.debug("slow-loading threshold armed", {
        data: {
          token,
          source,
          thresholdMs: SLOW_LOADING_THRESHOLD_MS,
          ...criteriaLogData(criteria),
        },
      });
      slowLoadingTimerRef.current = setTimeout(() => {
        slowLoadingTimerRef.current = null;
        if (token !== searchTokenRef.current) {
          log.debug("slow-loading skipped: stale token", {
            data: { token, currentToken: searchTokenRef.current },
          });
          return;
        }
        log.debug("slow-loading threshold crossed", {
          data: {
            token,
            source,
            ...criteriaLogData(criteria),
          },
        });
        setStatus("searching");
        bumpCommitRevision("slow-loading-shown", criteria, { token, source });
      }, SLOW_LOADING_THRESHOLD_MS);
    },
    [bumpCommitRevision, clearSlowLoading],
  );

  // =========================================================================
  // Recent searches (persisted in inbox settings)
  // =========================================================================

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    getInboxSettings(uid)
      .then((settings) => {
        if (!cancelled) setRecentSearches(settings.recentSearches || []);
      })
      .catch((err) => {
        log.warn("failed to load recent searches", { data: { error: err } });
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const saveRecentSearch = useCallback(
    async (term: string) => {
      const trimmed = term.trim();
      if (!uid || !trimmed) return;
      try {
        await addRecentSearch(uid, trimmed);
      } catch (err) {
        log.warn("failed to persist recent search", { data: { error: err } });
      }
      setRecentSearches((prev) =>
        [trimmed, ...prev.filter((s) => s !== trimmed)].slice(0, 10),
      );
    },
    [uid],
  );

  const removeRecentSearchItem = useCallback(
    async (term: string) => {
      setRecentSearches((prev) => {
        const updated = prev.filter((s) => s !== term);
        if (uid) {
          updateInboxSettings(uid, { recentSearches: updated }).catch((err) => {
            log.warn("failed to remove recent search", {
              data: { error: err },
            });
          });
        }
        return updated;
      });
    },
    [uid],
  );

  const clearAllRecentSearches = useCallback(async () => {
    setRecentSearches([]);
    if (uid) {
      try {
        await clearRecentSearches(uid);
      } catch (err) {
        log.warn("failed to clear recent searches", { data: { error: err } });
      }
    }
  }, [uid]);

  const hydrateRecentMessagesForSearch = useCallback(
    async (
      criteria: SearchCriteria,
      conversations: InboxConversation[],
      isStale: () => boolean,
      token: number,
    ) => {
      if (!isDatabaseRuntimeAvailable()) {
        log.debug("search hydration: skipped", {
          data: {
            token,
            reason: "database-unavailable",
            ...criteriaLogData(criteria),
          },
        });
        return;
      }

      const now = Date.now();
      const candidates = conversations
        .filter((conversation) =>
          conversationMatchesScope(conversation, criteria.scope),
        )
        .slice(0, MAX_RECENT_SYNC_CONVERSATIONS)
        .filter((conversation) => {
          const key = `${conversation.type}:${conversation.id}`;
          const lastSyncedAt = recentSyncRef.current.get(key) ?? 0;
          return now - lastSyncedAt > RECENT_SYNC_TTL_MS;
        });

      if (candidates.length === 0) {
        log.debug("search hydration: skipped", {
          data: {
            token,
            reason: "no-candidates",
            conversationCount: conversations.length,
            ...criteriaLogData(criteria),
          },
        });
        return;
      }

      log.debug("search hydration: start", {
        data: {
          token,
          candidateCount: candidates.length,
          concurrency: Math.min(RECENT_SYNC_CONCURRENCY, candidates.length),
          budgetMs: RECENT_SYNC_BUDGET_MS,
          perConversationBudgetMs: RECENT_SYNC_CONVERSATION_BUDGET_MS,
          ...criteriaLogData(criteria),
        },
      });

      let cursor = 0;
      let synced = 0;
      let failed = 0;
      let timedOutConversations = 0;
      const startedAt = Date.now();
      let budgetExpired = false;
      const workerCount = Math.min(RECENT_SYNC_CONCURRENCY, candidates.length);

      const worker = async (workerIndex: number) => {
        while (!isStale() && !budgetExpired) {
          const index = cursor;
          const conversation = candidates[cursor++];
          if (!conversation) return;
          const key = `${conversation.type}:${conversation.id}`;
          const conversationStartedAt = Date.now();

          log.debug("search hydration: conversation start", {
            data: {
              token,
              workerIndex,
              index,
              conversationId: conversation.id,
              scope: conversation.type,
            },
          });

          try {
            const pulled = await withStageTimeout(
              () =>
                fullSyncConversation(
                  conversation.type,
                  conversation.id,
                  RECENT_SYNC_MESSAGE_LIMIT,
                ),
              `search hydration ${conversation.type}:${conversation.id}`,
              RECENT_SYNC_CONVERSATION_BUDGET_MS,
            );
            recentSyncRef.current.set(key, Date.now());
            synced++;
            log.debug("search hydration: conversation complete", {
              data: {
                token,
                workerIndex,
                index,
                conversationId: conversation.id,
                scope: conversation.type,
                pulled,
                durationMs: Date.now() - conversationStartedAt,
              },
            });
          } catch (error) {
            failed++;
            if (error instanceof SearchStageTimeoutError) {
              timedOutConversations++;
            }
            log.warn("search hydration: conversation sync failed", {
              data: {
                token,
                workerIndex,
                index,
                conversationId: conversation.id,
                scope: conversation.type,
                timedOut: error instanceof SearchStageTimeoutError,
                durationMs: Date.now() - conversationStartedAt,
                error,
              },
            });
          }
        }
      };

      let timedOut = false;
      log.debug("search hydration: fanout start", {
        data: {
          token,
          workerCount,
          candidateCount: candidates.length,
        },
      });

      try {
        await withStageTimeout(
          () =>
            Promise.all(
              Array.from({ length: workerCount }, (_, workerIndex) =>
                worker(workerIndex),
              ),
            ).then(() => undefined),
          "search hydration fanout",
          RECENT_SYNC_BUDGET_MS,
        );
      } catch (error) {
        timedOut = error instanceof SearchStageTimeoutError;
        budgetExpired = true;
        log.warn("search hydration: fanout stopped", {
          data: {
            token,
            timedOut,
            error,
          },
        });
      }

      log.debug("search hydration: complete", {
        data: {
          token,
          synced,
          failed,
          timedOutConversations,
          timedOut,
          stale: isStale(),
          durationMs: Date.now() - startedAt,
        },
      });
    },
    [],
  );

  const scheduleBackgroundHydration = useCallback(
    (
      criteria: SearchCriteria,
      conversations: InboxConversation[],
      token: number,
    ) => {
      clearHydrationTimer();

      if (!isDatabaseRuntimeAvailable()) {
        log.debug("search hydration: background skipped", {
          data: {
            token,
            reason: "database-unavailable",
            ...criteriaLogData(criteria),
          },
        });
        return;
      }

      const snapshot = conversations.slice(0, MAX_RECENT_SYNC_CONVERSATIONS);
      log.debug("search hydration: background scheduled", {
        data: {
          token,
          delayMs: BACKGROUND_HYDRATION_DELAY_MS,
          conversationCount: snapshot.length,
          ...criteriaLogData(criteria),
        },
      });

      hydrationTimerRef.current = setTimeout(() => {
        hydrationTimerRef.current = null;
        if (token !== searchTokenRef.current) {
          log.debug("search hydration: background skipped", {
            data: {
              token,
              currentToken: searchTokenRef.current,
              reason: "stale-before-start",
            },
          });
          return;
        }

        void hydrateRecentMessagesForSearch(
          criteria,
          snapshot,
          () => token !== searchTokenRef.current,
          token,
        ).catch((error) => {
          log.warn("search hydration: background failed", {
            data: {
              token,
              error,
            },
          });
        });
      }, BACKGROUND_HYDRATION_DELAY_MS);
    },
    [clearHydrationTimer, hydrateRecentMessagesForSearch],
  );

  const scheduleRemoteMessageMerge = useCallback(
    (
      criteria: SearchCriteria,
      conversations: InboxConversation[],
      token: number,
      existingKeys: Set<string>,
    ) => {
      log.debug("remote search: background merge scheduled", {
        data: {
          token,
          existingMessageKeyCount: existingKeys.size,
          conversationCount: conversations.length,
          ...criteriaLogData(criteria),
        },
      });

      void queryRemoteRecentMessages(
        criteria,
        conversations,
        uid,
        () => token !== searchTokenRef.current,
        existingKeys,
      )
        .then((remoteMessageResults) => {
          if (token !== searchTokenRef.current) {
            log.debug("remote search: background merge discarded", {
              data: {
                token,
                currentToken: searchTokenRef.current,
                remoteMessageResultCount: remoteMessageResults.length,
              },
            });
            return;
          }

          if (remoteMessageResults.length === 0) {
            log.debug("remote search: background merge empty", {
              data: { token },
            });
            return;
          }

          setResults((prev) => {
            const next = mergeSearchResults(prev, remoteMessageResults);
            log.debug("remote search: background merge committed", {
              data: {
                token,
                previousResultCount: prev.length,
                remoteMessageResultCount: remoteMessageResults.length,
                nextResultCount: next.length,
              },
            });
            return next;
          });
          bumpCommitRevision("remote-background-merge", criteria, {
            token,
            remoteMessageResultCount: remoteMessageResults.length,
          });
        })
        .catch((error) => {
          log.warn("remote search: background merge failed", {
            data: {
              token,
              error,
            },
          });
        });
    },
    [bumpCommitRevision, uid],
  );

  // =========================================================================
  // Core search execution
  //
  // Stable identity: captures nothing from React state/props — reads the
  // latest conversation roster via refs. This lets the scheduling effect
  // remain free of expensive dependencies.
  // =========================================================================

  const performSearch = useCallback(
    async (criteria: SearchCriteria, token: number) => {
      const startedAt = Date.now();
      const conversations = allConversationsRef.current;
      const convMap = conversationMapRef.current;
      const isStale = () => token !== searchTokenRef.current;

      if (isStale()) {
        log.debug("search: stale before start", { data: { token } });
        return;
      }

      log.debug("search: start", {
        data: {
          token,
          conversationCount: conversations.length,
          dmCount: conversations.filter((c) => c.type === "dm").length,
          groupCount: conversations.filter((c) => c.type === "group").length,
          inboxReady: inboxReadyRef.current,
          databaseRuntimeAvailable: isDatabaseRuntimeAvailable(),
          ...criteriaLogData(criteria),
        },
      });

      log.debug("search: metadata ready", {
        data: {
          token,
          conversationCount: conversations.length,
          mapSize: convMap.size,
          scopedConversationCount: conversations.filter((conversation) =>
            conversationMatchesScope(conversation, criteria.scope),
          ).length,
        },
      });

      try {
        const allResults: SearchResult[] = [];

        // ── 1. Conversation-name matches (only for a pure text query) ─────
        if (
          criteria.trimmedQuery &&
          criteria.person == null &&
          criteria.dateAfter == null &&
          criteria.dateBefore == null &&
          criteria.content === "all"
        ) {
          const needle = criteria.trimmedQuery.toLowerCase();
          for (const c of conversations) {
            if (!c.name.toLowerCase().includes(needle)) continue;
            if (criteria.scope === "dms" && c.type !== "dm") continue;
            if (criteria.scope === "groups" && c.type !== "group") continue;
            allResults.push({ type: "conversation", conversation: c });
            if (allResults.length >= MAX_CONVERSATION_RESULTS) break;
          }
        }

        if (isStale()) {
          log.debug("search: stale before message search", { data: { token } });
          return;
        }

        log.debug("search hydration: critical path bypassed", {
          data: {
            token,
            reason: "background-cache-warm-only",
            ...criteriaLogData(criteria),
          },
        });

        // ── 2. Message-level search (FTS5, with LIKE fallback) ────────────
        let messageRows: SQLiteMessageRow[] = [];
        try {
          const localStartedAt = Date.now();
          log.debug("local search: start", {
            data: {
              token,
              conversationCount: conversations.length,
              timeoutMs: LOCAL_SEARCH_BUDGET_MS,
              ...criteriaLogData(criteria),
            },
          });
          messageRows = await withStageTimeout(
            () => queryMessages(criteria, conversations),
            "local message search",
            LOCAL_SEARCH_BUDGET_MS,
          );
          log.debug("local search: complete", {
            data: {
              token,
              rowCount: messageRows.length,
              durationMs: Date.now() - localStartedAt,
            },
          });
        } catch (localSearchError) {
          log.warn("local message search failed; trying remote fallback", {
            data: {
              token,
              timedOut: localSearchError instanceof SearchStageTimeoutError,
              ...criteriaLogData(criteria),
              error: localSearchError,
            },
          });
        }

        if (isStale()) {
          log.debug("search: stale after local search", { data: { token } });
          return;
        }

        const localMessageResults = mapRowsToResults(messageRows, convMap);
        log.debug("local search: mapped", {
          data: {
            token,
            rowCount: messageRows.length,
            mappedCount: localMessageResults.length,
            droppedForMissingConversation:
              messageRows.length - localMessageResults.length,
          },
        });
        const existingKeys = new Set(localMessageResults.map(getResultKey));

        const localReadyResults: SearchResult[] = [
          ...allResults,
          ...localMessageResults,
        ];

        if (isStale()) {
          log.debug("search: local commit skipped due stale token", {
            data: { token },
          });
          return;
        }

        clearWatchdog();
        clearSlowLoading();
        setResults(localReadyResults);
        setError(null);
        setStatus("ready");
        bumpCommitRevision(
          localReadyResults.length > 0 ? "local-ready" : "local-empty",
          criteria,
          {
            token,
            resultCount: localReadyResults.length,
            localMessageResultCount: localMessageResults.length,
          },
        );
        log.debug(
          localReadyResults.length > 0
            ? "search: local state committed"
            : "search: local empty state committed",
          {
            data: {
              token,
              status: "ready",
              branch: localReadyResults.length > 0 ? "results" : "empty",
              resultCount: localReadyResults.length,
              conversationResultCount: allResults.length,
              localMessageResultCount: localMessageResults.length,
              remoteDeferred: localMessageResults.length < MAX_MESSAGE_RESULTS,
              durationMs: Date.now() - startedAt,
              ...criteriaLogData(criteria),
            },
          },
        );

        if (localMessageResults.length < MAX_MESSAGE_RESULTS) {
          scheduleRemoteMessageMerge(
            criteria,
            conversations,
            token,
            existingKeys,
          );
        }

        log.debug("search: complete", {
          data: {
            token,
            source: "local-first",
            branch: localReadyResults.length > 0 ? "results" : "empty",
            resultCount: localReadyResults.length,
            messageResultCount: localMessageResults.length,
            localMessageResultCount: localMessageResults.length,
            remoteMessageResultCount: 0,
            conversationResultCount: allResults.length,
            durationMs: Date.now() - startedAt,
            ...criteriaLogData(criteria),
          },
        });
        log.debug("search: state committed", {
          data: {
            token,
            status: "ready",
            resultCount: localReadyResults.length,
          },
        });
        scheduleBackgroundHydration(criteria, conversations, token);
        return;
      } catch (searchError) {
        if (isStale()) {
          log.debug("search: error in stale search, ignoring", {
            data: { token },
          });
          return;
        }
        clearWatchdog();
        clearSlowLoading();
        log.error("search failed", {
          data: {
            token,
            durationMs: Date.now() - startedAt,
            error: searchError,
          },
        });
        setResults([]);
        setError(formatSearchError(searchError));
        setStatus("error");
        bumpCommitRevision("search-error", criteria, { token });
        log.debug("search: state committed", {
          data: {
            token,
            status: "error",
          },
        });
      }
    },
    [
      clearWatchdog,
      clearSlowLoading,
      bumpCommitRevision,
      scheduleBackgroundHydration,
      scheduleRemoteMessageMerge,
    ],
  );

  const performSearchRef = useRef(performSearch);
  performSearchRef.current = performSearch;

  // =========================================================================
  // Scheduling
  //
  // Re-fires ONLY when the user-controlled inputs change. The conversation
  // roster is intentionally NOT a dependency — roster churn from inbox
  // subscriptions used to perpetually restart the debounce timer, trapping
  // the UI in a "Searching…" state. Searches read the current roster via
  // ref at query time.
  // =========================================================================

  useEffect(() => {
    clearDebounce();
    clearWatchdog();
    clearSlowLoading();
    clearHydrationTimer();

    const trimmed = query.trim();
    const criteria: SearchCriteria = {
      trimmedQuery: trimmed,
      scope: scopeFilter,
      content: contentFilter,
      dateAfter,
      dateBefore,
      person: personId
        ? { userId: personId, displayName: personDisplayName }
        : null,
    };

    const hasAnyInput = trimmed.length > 0 || hasAnyFilter(criteria);

    if (!hasAnyInput) {
      // Return to idle cleanly. Bump the token so any in-flight search is
      // silently orphaned.
      searchTokenRef.current += 1;
      log.debug("schedule: idle", {
        data: {
          reason: "no-input",
          token: searchTokenRef.current,
          ...criteriaLogData(criteria),
        },
      });
      setResults([]);
      setError(null);
      setStatus("idle");
      bumpCommitRevision("idle-no-input", criteria, {
        token: searchTokenRef.current,
      });
      return;
    }

    // Allocate a token for this scheduling attempt.
    const token = searchTokenRef.current + 1;
    searchTokenRef.current = token;

    log.debug("schedule", {
      data: {
        token,
        debounceMs: trimmed.length > 0 ? DEBOUNCE_MS : 0,
        inboxReady: inboxReadyRef.current,
        conversationCount: allConversationsRef.current.length,
        ...criteriaLogData(criteria),
      },
    });

    setError(null);
    setStatus("pending");
    bumpCommitRevision("search-pending", criteria, {
      token,
      debounceMs: trimmed.length > 0 ? DEBOUNCE_MS : 0,
    });

    const dispatchSearch = () => {
      debounceTimerRef.current = null;
      pendingDebounceRef.current = null;
      if (token !== searchTokenRef.current) {
        log.debug("debounce fire ignored: stale token", {
          data: {
            token,
            currentToken: searchTokenRef.current,
          },
        });
        return;
      }
      log.debug("debounce fire", {
        data: {
          token,
          immediate: trimmed.length === 0 || DEBOUNCE_MS === 0,
          reason:
            trimmed.length > 0 && DEBOUNCE_MS === 0
              ? "typed-search-immediate"
              : "timer-fired",
          firedAt: Date.now(),
          ...criteriaLogData(criteria),
        },
      });
      setStatus("executing");
      bumpCommitRevision("searching-start", criteria, { token });
      armSlowLoading(criteria, token, "search-execution");
      armSearchWatchdog(criteria, token, "search-execution");
      void performSearchRef.current(criteria, token);
    };

    // Text input is debounced. Filter-only browse shortcuts should feel
    // immediate and should not depend on a delayed timer before collection
    // begins.
    if (trimmed.length === 0 || DEBOUNCE_MS === 0) {
      if (trimmed.length > 0) {
        log.debug("debounce skipped: immediate typed search", {
          data: {
            token,
            debounceMs: DEBOUNCE_MS,
            ...criteriaLogData(criteria),
          },
        });
      }
      dispatchSearch();
    } else {
      const debounceId = debounceSequenceRef.current + 1;
      debounceSequenceRef.current = debounceId;
      const targetFireAt = Date.now() + DEBOUNCE_MS;
      pendingDebounceRef.current = {
        id: debounceId,
        token,
        targetFireAt,
        criteria,
      };
      log.debug("debounce arm", {
        data: {
          token,
          debounceId,
          delayMs: DEBOUNCE_MS,
          targetFireAt,
          ...criteriaLogData(criteria),
        },
      });
      debounceTimerRef.current = setTimeout(dispatchSearch, DEBOUNCE_MS);
    }

    return () => {
      // Cleanup on input change / unmount: cancel pending timers. We do NOT
      // mutate the token here — the next effect run (if any) will allocate
      // a fresh one. Any in-flight performSearch will self-orphan when the
      // next run bumps the token; if there is no next run (unmount), the
      // stale result is simply discarded because the component is gone.
      log.debug("schedule cleanup", {
        data: {
          token,
          reason: "effect-cleanup-before-next-schedule-or-unmount",
          hadPendingDebounce: debounceTimerRef.current != null,
          hadWatchdog: watchdogTimerRef.current != null,
          hadSlowLoading: slowLoadingTimerRef.current != null,
          pendingDebounceId: pendingDebounceRef.current?.id ?? null,
          pendingDebounceTargetFireAt:
            pendingDebounceRef.current?.targetFireAt ?? null,
          ...criteriaLogData(criteria),
          nextToken: searchTokenRef.current,
        },
      });
      clearDebounce();
      clearWatchdog();
      clearSlowLoading();
      clearHydrationTimer();
    };
  }, [
    query,
    scopeFilter,
    contentFilter,
    dateAfter,
    dateBefore,
    personId,
    personDisplayName,
    clearDebounce,
    clearWatchdog,
    clearSlowLoading,
    clearHydrationTimer,
    bumpCommitRevision,
    armSlowLoading,
    armSearchWatchdog,
  ]);

  // =========================================================================
  // Auto-refresh when the inbox transitions from "empty" to "populated".
  //
  // If the user opens the search sheet before useInboxData finishes loading
  // and types immediately, the first search will run against an empty
  // roster and show an empty state. Once the roster populates we silently
  // re-run the search so the user sees real results without having to
  // re-type.
  // =========================================================================

  const prevConversationCountRef = useRef(allConversations.length);
  useEffect(() => {
    const prev = prevConversationCountRef.current;
    const curr = allConversations.length;
    prevConversationCountRef.current = curr;

    if (prev !== 0 || curr === 0) return; // only fire on 0 → >0
    if (status === "idle") return; // nothing to refresh
    if (!inboxReady) return;

    const trimmed = query.trim();
    const criteria: SearchCriteria = {
      trimmedQuery: trimmed,
      scope: scopeFilter,
      content: contentFilter,
      dateAfter,
      dateBefore,
      person: personId
        ? { userId: personId, displayName: personDisplayName }
        : null,
    };
    if (trimmed.length === 0 && !hasAnyFilter(criteria)) return;

    const token = searchTokenRef.current + 1;
    searchTokenRef.current = token;

    log.debug("auto-refresh on roster ready", {
      data: {
        token,
        conversationCount: curr,
        ...criteriaLogData(criteria),
      },
    });
    setError(null);
    setStatus("executing");
    bumpCommitRevision("auto-refresh-executing", criteria, { token });
    armSlowLoading(criteria, token, "auto-refresh");
    armSearchWatchdog(criteria, token, "auto-refresh");
    void performSearchRef.current(criteria, token);
  }, [
    allConversations.length,
    inboxReady,
    status,
    query,
    scopeFilter,
    contentFilter,
    dateAfter,
    dateBefore,
    personId,
    personDisplayName,
    bumpCommitRevision,
    armSlowLoading,
    armSearchWatchdog,
  ]);

  // =========================================================================
  // Unmount cleanup
  // =========================================================================

  useEffect(() => {
    return () => {
      clearDebounce();
      clearWatchdog();
      clearSlowLoading();
      clearHydrationTimer();
      // Orphan any in-flight search so its commit is dropped.
      searchTokenRef.current += 1;
    };
  }, [clearDebounce, clearWatchdog, clearSlowLoading, clearHydrationTimer]);

  // =========================================================================
  // Reset — called on modal close
  // =========================================================================

  const resetSearch = useCallback(() => {
    const criteria: SearchCriteria = {
      trimmedQuery: query.trim(),
      scope: scopeFilter,
      content: contentFilter,
      dateAfter,
      dateBefore,
      person: personId
        ? { userId: personId, displayName: "" }
        : null,
    };
    log.debug("reset", {
      data: {
        status,
        hadPendingDebounce: debounceTimerRef.current != null,
        hadWatchdog: watchdogTimerRef.current != null,
        hadSlowLoading: slowLoadingTimerRef.current != null,
        pendingDebounceId: pendingDebounceRef.current?.id ?? null,
        ...criteriaLogData(criteria),
      },
    });
    clearDebounce();
    clearWatchdog();
    clearSlowLoading();
    clearHydrationTimer();
    searchTokenRef.current += 1;
    setQuery("");
    setScopeFilter("all");
    setContentFilter("all");
    setDateRange({});
    setPersonFilter(null);
    setResults([]);
    setError(null);
    setStatus("idle");
    bumpCommitRevision("reset", criteria);
  }, [
    bumpCommitRevision,
    clearDebounce,
    clearWatchdog,
    clearSlowLoading,
    clearHydrationTimer,
    contentFilter,
    dateAfter,
    dateBefore,
    personId,
    query,
    scopeFilter,
    status,
  ]);

  // =========================================================================
  // Public API
  // =========================================================================

  const isSearching = status === "searching";
  const hasSearched = status === "ready" || status === "error";

  return {
    query,
    setQuery,
    scopeFilter,
    setScopeFilter,
    contentFilter,
    setContentFilter,
    dateRange,
    setDateRange,
    personFilter,
    setPersonFilter,
    results,
    status,
    commitRevision,
    /** @deprecated prefer `status === "searching"` */
    isSearching,
    /** @deprecated prefer `status === "ready" || status === "error"` */
    hasSearched,
    error,
    recentSearches,
    saveRecentSearch,
    removeRecentSearchItem,
    clearAllRecentSearches,
    resetSearch,
  };
}

// =============================================================================
// DB Query (FTS5 + LIKE fallback)
// =============================================================================

async function queryMessages(
  criteria: SearchCriteria,
  conversations: InboxConversation[],
): Promise<SQLiteMessageRow[]> {
  const db = getDatabase();
  log.debug("local search: query path selected", {
    data: {
      path: criteria.trimmedQuery ? "fts5-with-like-fallback" : "filter-like",
      conversationCount: conversations.length,
      ...criteriaLogData(criteria),
    },
  });

  // FTS5 path (used when a text query is present; falls back on failure).
  if (criteria.trimmedQuery) {
    try {
      const ftsRows = await runFtsQuery(db, criteria, conversations);
      if (ftsRows.length > 0) {
        return ftsRows;
      }
      log.debug("FTS5 returned no rows, trying LIKE fallback", {
        data: {
          queryLen: criteria.trimmedQuery.length,
          scope: criteria.scope,
          content: criteria.content,
        },
      });
    } catch (err) {
      if (!isFtsUnavailableError(err)) throw err;
      log.warn("FTS5 unavailable, falling back to LIKE search", {
        data: { error: err },
      });
    }
    return runLikeQuery(db, criteria, conversations);
  }

  // Filter-only path — no text, no FTS needed.
  return runLikeQuery(db, criteria, conversations);
}

const SELECT_BODY = `
  SELECT m.id, m.conversation_id, m.scope, m.sender_id, m.sender_name,
         COALESCE(
           m.text,
           (SELECT a.caption FROM attachments a
              WHERE a.owner_uid = m.owner_uid
                AND a.message_id = m.id
                AND a.caption IS NOT NULL AND a.caption != ''
              LIMIT 1)
         ) AS text,
         m.kind, m.created_at, m.server_received_at,
         (SELECT a.thumb_remote_url FROM attachments a
            WHERE a.owner_uid = m.owner_uid AND a.message_id = m.id AND a.kind IN ('image', 'video') LIMIT 1) AS thumb_url,
         (SELECT a.remote_url       FROM attachments a
            WHERE a.owner_uid = m.owner_uid AND a.message_id = m.id AND a.kind IN ('image', 'video') LIMIT 1) AS image_url
`;

async function runFtsQuery(
  db: ReturnType<typeof getDatabase>,
  criteria: SearchCriteria,
  conversations: InboxConversation[],
): Promise<SQLiteMessageRow[]> {
  const { whereClauses, params } = buildCommonWhere(criteria, conversations);
  const ftsQuery = sanitizeFtsQuery(criteria.trimmedQuery);

  const sql = `${SELECT_BODY}
     FROM messages m
     JOIN messages_fts fts
       ON fts.rowid = m.rowid AND fts.messages_fts MATCH ?
     WHERE ${whereClauses.join(" AND ")}
     ORDER BY fts.rank, COALESCE(m.server_received_at, m.created_at) DESC
     LIMIT ?`;

  return db.getAllAsync<SQLiteMessageRow>(sql, [
    ftsQuery,
    ...params,
    MAX_MESSAGE_RESULTS,
  ]);
}

async function runLikeQuery(
  db: ReturnType<typeof getDatabase>,
  criteria: SearchCriteria,
  conversations: InboxConversation[],
): Promise<SQLiteMessageRow[]> {
  const { whereClauses, params } = buildCommonWhere(criteria, conversations);
  if (criteria.trimmedQuery) {
    whereClauses.push(
      `(m.text LIKE ? OR EXISTS (
        SELECT 1 FROM attachments a
        WHERE a.owner_uid = m.owner_uid AND a.message_id = m.id AND a.caption LIKE ?
      ))`,
    );
    const likeQuery = `%${criteria.trimmedQuery}%`;
    params.push(likeQuery, likeQuery);
  }

  const sql = `${SELECT_BODY}
     FROM messages m
     WHERE ${whereClauses.join(" AND ")}
     ORDER BY COALESCE(m.server_received_at, m.created_at) DESC
     LIMIT ?`;

  return db.getAllAsync<SQLiteMessageRow>(sql, [
    ...params,
    MAX_MESSAGE_RESULTS,
  ]);
}
