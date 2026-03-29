/**
 * useMessageSearch Hook
 *
 * Provides Discord-inspired message search across all conversations.
 * Searches both conversation names AND full message text using SQLite FTS5.
 *
 * Features:
 * - FTS5 full-text search with ranking (replaces LIKE)
 * - Message-level search with conversation context
 * - Conversation-level search (name matching)
 * - Filter by type (DMs/Groups), content type
 * - Date range filters (after / before)
 * - "From person" filter (sender_id)
 * - Debounced query with loading states
 * - Recent searches support
 *
 * @module hooks/useMessageSearch
 */

import { getDatabase } from "@/services/database";
import {
  addRecentSearch,
  clearRecentSearches,
  getInboxSettings,
  updateInboxSettings,
} from "@/services/inboxSettings";
import { useAuth } from "@/store/AuthContext";
import type { InboxConversation } from "@/types/messaging";
import { createLogger } from "@/utils/log";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInboxData } from "./useInboxData";

const log = createLogger("useMessageSearch");

// =============================================================================
// Types
// =============================================================================

export type ScopeFilter = "all" | "dms" | "groups";
export type ContentFilter = "all" | "media" | "links" | "files";

/** @deprecated Use ScopeFilter + ContentFilter instead */
export type SearchFilter = ScopeFilter | ContentFilter;

/** Date range filter for narrowing search results */
export interface DateRangeFilter {
  after?: number; // epoch ms – results after this date
  before?: number; // epoch ms – results before this date
}

/** Person filter for narrowing to a specific sender */
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
  /** For DMs: the other user's UID (needed for navigation) */
  otherUserId: string | null;
  senderName: string | null;
  senderId: string;
  text: string;
  timestamp: number;
  kind: string;
  matchedText: string;
  /** First image attachment thumbnail URL (if any) */
  thumbnailUrl: string | null;
  /** First image attachment full URL (if any) */
  imageUrl: string | null;
}

export interface ConversationSearchResult {
  type: "conversation";
  conversation: InboxConversation;
}

export type SearchResult = MessageSearchResult | ConversationSearchResult;

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

// =============================================================================
// Constants
// =============================================================================

const DEBOUNCE_MS = 250;
const MAX_MESSAGE_RESULTS = 50;
const MAX_CONVERSATION_RESULTS = 10;

/**
 * Escape FTS5 special characters so the user's input is treated as literal text.
 * Wraps each word in double-quotes to prevent FTS5 syntax errors from punctuation.
 */
function sanitizeFtsQuery(raw: string): string {
  // Split into words, wrap each in quotes, join with spaces (implicit AND)
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `"${word.replace(/"/g, '""')}"`)
    .join(" ");
}

// =============================================================================
// Hook
// =============================================================================

export function useMessageSearch() {
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid ?? "";
  const { allConversations } = useInboxData(uid);

  // State
  const [query, setQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [contentFilter, setContentFilter] = useState<ContentFilter>("all");
  const [dateRange, setDateRange] = useState<DateRangeFilter>({});
  const [personFilter, setPersonFilter] = useState<PersonFilter | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef(false);

  // Build a lookup map for conversation metadata
  const conversationMap = useMemo(() => {
    const map = new Map<string, InboxConversation>();
    for (const c of allConversations) {
      map.set(c.id, c);
    }
    return map;
  }, [allConversations]);

  // Load recent searches on mount
  useEffect(() => {
    if (!uid) return;
    getInboxSettings(uid).then((settings) => {
      setRecentSearches(settings.recentSearches || []);
    });
  }, [uid]);

  // =========================================================================
  // Search Logic
  // =========================================================================

  const performSearch = useCallback(
    (
      searchQuery: string,
      activeScope: ScopeFilter,
      activeContent: ContentFilter,
      activeDateRange: DateRangeFilter,
      activePersonFilter: PersonFilter | null,
    ) => {
      const trimmed = searchQuery.trim();
      const hasFilters =
        activeScope !== "all" ||
        activeContent !== "all" ||
        !!activeDateRange.after ||
        !!activeDateRange.before ||
        !!activePersonFilter;

      if (!trimmed && !hasFilters) {
        setResults([]);
        setHasSearched(false);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      abortRef.current = false;

      try {
        const allResults: SearchResult[] = [];

        // ----- 1. Conversation name matches -----
        // (only when text is present and no person/date filters)
        if (
          trimmed &&
          !activePersonFilter &&
          !activeDateRange.after &&
          !activeDateRange.before &&
          activeContent === "all"
        ) {
          const normalizedQuery = trimmed.toLowerCase();
          const matchedConversations = allConversations.filter((c) => {
            const nameMatch = c.name.toLowerCase().includes(normalizedQuery);
            if (!nameMatch) return false;

            switch (activeScope) {
              case "dms":
                return c.type === "dm";
              case "groups":
                return c.type === "group";
              default:
                return true;
            }
          });

          for (const c of matchedConversations.slice(
            0,
            MAX_CONVERSATION_RESULTS,
          )) {
            allResults.push({ type: "conversation", conversation: c });
          }
        }

        // ----- 2. Message-level search from SQLite (FTS5 or filter-only) -----
        try {
          const db = getDatabase();

          const whereClauses: string[] = ["m.deleted_for_all = 0"];
          const params: (string | number)[] = [];

          // FTS5 match via JOIN (only when text query is present)
          let ftsJoin = "";
          let orderBy =
            "ORDER BY COALESCE(m.server_received_at, m.created_at) DESC";

          if (trimmed) {
            const ftsQuery = sanitizeFtsQuery(trimmed);
            ftsJoin =
              "JOIN messages_fts fts ON fts.rowid = m.rowid AND fts.messages_fts MATCH ?";
            params.push(ftsQuery);
            orderBy =
              "ORDER BY fts.rank, COALESCE(m.server_received_at, m.created_at) DESC";
          }

          // Scope filter (DMs / Groups) — independent of content filter
          switch (activeScope) {
            case "dms":
              whereClauses.push("m.scope = 'dm'");
              break;
            case "groups":
              whereClauses.push("m.scope = 'group'");
              break;
          }

          // Content filter (Media / Links / Files) — independent of scope
          switch (activeContent) {
            case "media":
              whereClauses.push("m.kind = 'media'");
              break;
            case "links":
              whereClauses.push(
                "(m.text LIKE '%http://%' OR m.text LIKE '%https://%')",
              );
              break;
            case "files":
              whereClauses.push("m.kind = 'file'");
              break;
          }

          // Date range filters
          if (activeDateRange.after) {
            whereClauses.push(
              "COALESCE(m.server_received_at, m.created_at) >= ?",
            );
            params.push(activeDateRange.after);
          }
          if (activeDateRange.before) {
            whereClauses.push(
              "COALESCE(m.server_received_at, m.created_at) <= ?",
            );
            params.push(activeDateRange.before);
          }

          // Person filter
          if (activePersonFilter) {
            whereClauses.push("m.sender_id = ?");
            params.push(activePersonFilter.userId);
          }

          const whereSQL = whereClauses.join(" AND ");

          const messageRows = db.getAllSync<SQLiteMessageRow>(
            `SELECT m.id, m.conversation_id, m.scope, m.sender_id, m.sender_name, 
                    m.text, m.kind, m.created_at, m.server_received_at,
                    (SELECT a.thumb_remote_url FROM attachments a WHERE a.message_id = m.id AND a.kind = 'image' LIMIT 1) AS thumb_url,
                    (SELECT a.remote_url FROM attachments a WHERE a.message_id = m.id AND a.kind = 'image' LIMIT 1) AS image_url
             FROM messages m
             ${ftsJoin}
             WHERE ${whereSQL}
             ${orderBy}
             LIMIT ?`,
            [...params, MAX_MESSAGE_RESULTS],
          );

          if (abortRef.current) return;

          for (const row of messageRows) {
            const conv = conversationMap.get(row.conversation_id);
            // Only include messages from visible conversations
            if (!conv) continue;

            allResults.push({
              type: "message",
              messageId: row.id,
              conversationId: row.conversation_id,
              conversationScope: row.scope as "dm" | "group",
              conversationName: conv.name,
              conversationAvatar:
                conv.profilePictureUrl || conv.avatarUrl || null,
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
        } catch (dbError: any) {
          // Fallback to LIKE if FTS5 is not available (e.g., Expo Go)
          if (
            dbError?.message?.includes("no such table") ||
            dbError?.message?.includes("fts5")
          ) {
            log.warn("FTS5 not available, falling back to LIKE search", {
              data: { error: dbError },
            });
            try {
              const db = getDatabase();
              let filterClause = "m.deleted_for_all = 0";
              const params: (string | number)[] = [];
              if (trimmed) {
                filterClause = `m.text LIKE ? AND ${filterClause}`;
                params.push(`%${trimmed}%`);
              }

              // Scope filter
              switch (activeScope) {
                case "dms":
                  filterClause += " AND m.scope = 'dm'";
                  break;
                case "groups":
                  filterClause += " AND m.scope = 'group'";
                  break;
              }

              // Content filter
              switch (activeContent) {
                case "media":
                  filterClause += " AND m.kind = 'media'";
                  break;
                case "links":
                  filterClause +=
                    " AND (m.text LIKE '%http://%' OR m.text LIKE '%https://%')";
                  break;
                case "files":
                  filterClause += " AND m.kind = 'file'";
                  break;
              }

              if (activeDateRange.after) {
                filterClause +=
                  " AND COALESCE(m.server_received_at, m.created_at) >= ?";
                params.push(activeDateRange.after);
              }
              if (activeDateRange.before) {
                filterClause +=
                  " AND COALESCE(m.server_received_at, m.created_at) <= ?";
                params.push(activeDateRange.before);
              }
              if (activePersonFilter) {
                filterClause += " AND m.sender_id = ?";
                params.push(activePersonFilter.userId);
              }

              const messageRows = db.getAllSync<SQLiteMessageRow>(
                `SELECT m.id, m.conversation_id, m.scope, m.sender_id, m.sender_name, 
                        m.text, m.kind, m.created_at, m.server_received_at,
                        (SELECT a.thumb_remote_url FROM attachments a WHERE a.message_id = m.id AND a.kind = 'image' LIMIT 1) AS thumb_url,
                        (SELECT a.remote_url FROM attachments a WHERE a.message_id = m.id AND a.kind = 'image' LIMIT 1) AS image_url
                 FROM messages m
                 WHERE ${filterClause}
                 ORDER BY COALESCE(m.server_received_at, m.created_at) DESC
                 LIMIT ?`,
                [...params, MAX_MESSAGE_RESULTS],
              );

              if (!abortRef.current) {
                for (const row of messageRows) {
                  const conv = conversationMap.get(row.conversation_id);
                  if (!conv) continue;
                  allResults.push({
                    type: "message",
                    messageId: row.id,
                    conversationId: row.conversation_id,
                    conversationScope: row.scope as "dm" | "group",
                    conversationName: conv.name,
                    conversationAvatar:
                      conv.profilePictureUrl || conv.avatarUrl || null,
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
              }
            } catch (fallbackError) {
              log.warn("LIKE fallback also failed", {
                data: { error: fallbackError },
              });
            }
          } else {
            log.warn(
              "SQLite message search failed, falling back to conversation-only",
              { data: { error: dbError } },
            );
          }
        }

        if (!abortRef.current) {
          setResults(allResults);
          setHasSearched(true);
          setIsSearching(false);
        }
      } catch (error) {
        log.error("Search failed", { data: { error } });
        if (!abortRef.current) {
          setResults([]);
          setHasSearched(true);
          setIsSearching(false);
        }
      }
    },
    [allConversations, conversationMap],
  );

  // Debounced search trigger
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const hasFilters =
      scopeFilter !== "all" ||
      contentFilter !== "all" ||
      !!dateRange.after ||
      !!dateRange.before ||
      !!personFilter;

    if (!query.trim() && !hasFilters) {
      setResults([]);
      setHasSearched(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    debounceRef.current = setTimeout(() => {
      performSearch(query, scopeFilter, contentFilter, dateRange, personFilter);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [
    query,
    scopeFilter,
    contentFilter,
    dateRange,
    personFilter,
    performSearch,
  ]);

  // =========================================================================
  // Recent Searches
  // =========================================================================

  const saveRecentSearch = useCallback(
    async (term: string) => {
      if (!uid || !term.trim()) return;
      const trimmed = term.trim();

      await addRecentSearch(uid, trimmed);
      setRecentSearches((prev) => {
        const updated = [trimmed, ...prev.filter((s) => s !== trimmed)];
        return updated.slice(0, 10);
      });
    },
    [uid],
  );

  const removeRecentSearchItem = useCallback(
    async (term: string) => {
      const updated = recentSearches.filter((s) => s !== term);
      setRecentSearches(updated);
      if (uid) {
        await updateInboxSettings(uid, { recentSearches: updated });
      }
    },
    [uid, recentSearches],
  );

  const clearAllRecentSearches = useCallback(async () => {
    setRecentSearches([]);
    if (uid) {
      await clearRecentSearches(uid);
    }
  }, [uid]);

  // =========================================================================
  // Reset
  // =========================================================================

  const resetSearch = useCallback(() => {
    abortRef.current = true;
    setQuery("");
    setScopeFilter("all");
    setContentFilter("all");
    setDateRange({});
    setPersonFilter(null);
    setResults([]);
    setHasSearched(false);
    setIsSearching(false);
  }, []);

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
    isSearching,
    hasSearched,
    recentSearches,
    saveRecentSearch,
    removeRecentSearchItem,
    clearAllRecentSearches,
    resetSearch,
    allConversations,
  };
}
