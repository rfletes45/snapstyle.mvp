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

const log = createLogger("useMessageSearch");

// =============================================================================
// Types
// =============================================================================

export type ScopeFilter = "all" | "dms" | "groups";
export type ContentFilter = "all" | "media" | "links" | "files";

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
const SEARCH_TIMEOUT_MS = 8000;
const MAX_MESSAGE_RESULTS = 50;
const MAX_CONVERSATION_RESULTS = 10;
const MAX_VISIBLE_CONVERSATION_SQL_PARAMS = 900;

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

function formatSearchError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  return "Search failed. Please try again.";
}

function appendVisibleConversationFilter(
  whereClauses: string[],
  params: (string | number)[],
  conversations: InboxConversation[],
): void {
  if (conversations.length === 0) {
    whereClauses.push("1 = 0");
    return;
  }

  // Keep the SQLite bind count under conservative mobile/runtime limits.
  // Very large inboxes fall back to post-query visibility filtering below.
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

// =============================================================================
// Hook
// =============================================================================

export function useMessageSearch(allConversations: InboxConversation[] = []) {
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid ?? "";

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
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Search version counter. Each new search/reset gets a unique token. Only
  // the current token can commit results or clear loading.
  const searchVersionRef = useRef(0);

  // Build a lookup map for conversation metadata
  const conversationMap = useMemo(() => {
    const map = new Map<string, InboxConversation>();
    for (const c of allConversations) {
      map.set(c.id, c);
    }
    return map;
  }, [allConversations]);

  const conversationRosterKey = useMemo(
    () =>
      allConversations
        .map((c) => `${c.type}:${c.id}`)
        .sort()
        .join("|"),
    [allConversations],
  );

  // Stable refs for search data.
  // performSearch reads these via refs so its identity stays stable across
  // inbox snapshot changes.
  const allConversationsRef = useRef(allConversations);
  allConversationsRef.current = allConversations;
  const conversationMapRef = useRef(conversationMap);
  conversationMapRef.current = conversationMap;

  // Stable primitive deps for the debounce effect.
  // Objects (dateRange, personFilter) in useEffect dependency arrays cause
  // spurious re-fires because React uses Object.is() (reference equality).
  // Every setDateRange({}) or setPersonFilter({...}) creates a new object
  // even when the content is identical, re-triggering the effect, cancelling
  // the pending debounce timer, and trapping isSearching=true.
  // Extracting scalar primitives eliminates this class of bug entirely.
  const dateAfter = dateRange.after ?? null;
  const dateBefore = dateRange.before ?? null;
  const personId = personFilter?.userId ?? null;
  const personDisplayName = personFilter?.displayName ?? "";

  // Load recent searches on mount
  useEffect(() => {
    if (!uid) return;
    getInboxSettings(uid).then((settings) => {
      setRecentSearches(settings.recentSearches || []);
    });
  }, [uid]);

  useEffect(() => {
    log.debug("conversation data updated", {
      data: { conversationCount: allConversations.length },
    });
  }, [allConversations.length]);

  useEffect(() => {
    log.debug("search inputs changed", {
      data: {
        queryLen: query.trim().length,
        scope: scopeFilter,
        content: contentFilter,
        dateAfter,
        dateBefore,
        personId,
      },
    });
  }, [query, scopeFilter, contentFilter, dateAfter, dateBefore, personId]);

  useEffect(() => {
    log.debug("search state changed", {
      data: {
        isSearching,
        hasSearched,
        resultCount: results.length,
        hasError: !!error,
      },
    });
  }, [isSearching, hasSearched, results.length, error]);

  // =========================================================================
  // Search Logic
  // =========================================================================

  const performSearch = useCallback(
    async (
      searchQuery: string,
      activeScope: ScopeFilter,
      activeContent: ContentFilter,
      activeDateRange: DateRangeFilter,
      activePersonFilter: PersonFilter | null,
      version: number,
    ) => {
      const startedAtMs = Date.now();
      const trimmed = searchQuery.trim();
      const hasFilters =
        activeScope !== "all" ||
        activeContent !== "all" ||
        activeDateRange.after != null ||
        activeDateRange.before != null ||
        !!activePersonFilter;

      if (!trimmed && !hasFilters) {
        setResults([]);
        setHasSearched(false);
        setError(null);
        setIsSearching(false);
        return;
      }

      // Read conversation data from refs so this callback's identity is stable
      const currentConversations = allConversationsRef.current;
      const currentConversationMap = conversationMapRef.current;

      if (version !== searchVersionRef.current) {
        log.debug("performSearch: stale before start", {
          data: { version, current: searchVersionRef.current },
        });
        return;
      }

      log.debug("performSearch: start", {
        data: {
          version,
          startedAtMs,
          queryLen: trimmed.length,
          scope: activeScope,
          content: activeContent,
          hasAfter: activeDateRange.after != null,
          hasBefore: activeDateRange.before != null,
          hasPerson: !!activePersonFilter,
          conversationCount: currentConversations.length,
        },
      });

      try {
        const allResults: SearchResult[] = [];

        // ----- 1. Conversation name matches -----
        // (only when text is present and no person/date filters)
        if (
          trimmed &&
          !activePersonFilter &&
          activeDateRange.after == null &&
          activeDateRange.before == null &&
          activeContent === "all"
        ) {
          const normalizedQuery = trimmed.toLowerCase();
          const matchedConversations = currentConversations.filter((c) => {
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

        // Stale-version check before expensive SQLite query
        if (version !== searchVersionRef.current) {
          log.debug("performSearch: stale before query", {
            data: { version, current: searchVersionRef.current },
          });
          return; // newer search owns isSearching; do not clear it
        }

        // ----- 2. Message-level search from SQLite (FTS5 or filter-only) -----
        try {
          const db = getDatabase();

          const whereClauses: string[] = ["m.deleted_for_all = 0"];
          const params: (string | number)[] = [];
          appendVisibleConversationFilter(
            whereClauses,
            params,
            currentConversations,
          );

          // FTS5 match via JOIN (only when text query is present)
          let ftsJoin = "";
          let orderBy =
            "ORDER BY COALESCE(m.server_received_at, m.created_at) DESC";

          if (trimmed) {
            const ftsQuery = sanitizeFtsQuery(trimmed);
            ftsJoin = "JOIN messages_fts ON messages_fts.rowid = m.rowid";
            whereClauses.push("messages_fts MATCH ?");
            params.push(ftsQuery);
            orderBy =
              "ORDER BY bm25(messages_fts), COALESCE(m.server_received_at, m.created_at) DESC";
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
          if (activeDateRange.after != null) {
            whereClauses.push(
              "COALESCE(m.server_received_at, m.created_at) >= ?",
            );
            params.push(activeDateRange.after);
          }
          if (activeDateRange.before != null) {
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

          const messageRows = await db.getAllAsync<SQLiteMessageRow>(
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

          // Stale-version check after async query
          if (version !== searchVersionRef.current) {
            log.debug("performSearch: stale after query", {
              data: { version, current: searchVersionRef.current },
            });
            return;
          }

          for (const row of messageRows) {
            const conv = currentConversationMap.get(row.conversation_id);
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
              const whereClauses: string[] = ["m.deleted_for_all = 0"];
              const params: (string | number)[] = [];
              appendVisibleConversationFilter(
                whereClauses,
                params,
                currentConversations,
              );
              if (trimmed) {
                whereClauses.push("m.text LIKE ?");
                params.push(`%${trimmed}%`);
              }

              // Scope filter
              switch (activeScope) {
                case "dms":
                  whereClauses.push("m.scope = 'dm'");
                  break;
                case "groups":
                  whereClauses.push("m.scope = 'group'");
                  break;
              }

              // Content filter
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

              if (activeDateRange.after != null) {
                whereClauses.push(
                  "COALESCE(m.server_received_at, m.created_at) >= ?",
                );
                params.push(activeDateRange.after);
              }
              if (activeDateRange.before != null) {
                whereClauses.push(
                  "COALESCE(m.server_received_at, m.created_at) <= ?",
                );
                params.push(activeDateRange.before);
              }
              if (activePersonFilter) {
                whereClauses.push("m.sender_id = ?");
                params.push(activePersonFilter.userId);
              }

              const whereSQL = whereClauses.join(" AND ");

              // Stale-version check before fallback query
              if (version !== searchVersionRef.current) {
                log.debug("performSearch: stale before fallback query");
                return;
              }

              const messageRows = await db.getAllAsync<SQLiteMessageRow>(
                `SELECT m.id, m.conversation_id, m.scope, m.sender_id, m.sender_name, 
                        m.text, m.kind, m.created_at, m.server_received_at,
                        (SELECT a.thumb_remote_url FROM attachments a WHERE a.message_id = m.id AND a.kind = 'image' LIMIT 1) AS thumb_url,
                        (SELECT a.remote_url FROM attachments a WHERE a.message_id = m.id AND a.kind = 'image' LIMIT 1) AS image_url
                 FROM messages m
                 WHERE ${whereSQL}
                 ORDER BY COALESCE(m.server_received_at, m.created_at) DESC
                 LIMIT ?`,
                [...params, MAX_MESSAGE_RESULTS],
              );

              // Stale-version check after fallback query
              if (version !== searchVersionRef.current) {
                log.debug("performSearch: stale after fallback query");
                return;
              }

              for (const row of messageRows) {
                const conv = currentConversationMap.get(row.conversation_id);
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
            } catch (fallbackError) {
              log.error("LIKE fallback also failed", {
                data: { error: fallbackError },
              });
              throw fallbackError;
            }
          } else {
            log.error("SQLite message search failed", {
              data: { error: dbError },
            });
            throw dbError;
          }
        }

        // Final stale-version check before committing results
        if (version !== searchVersionRef.current) {
          log.debug("performSearch: stale before commit", {
            data: { version, current: searchVersionRef.current },
          });
          return;
        }

        if (watchdogRef.current) {
          clearTimeout(watchdogRef.current);
          watchdogRef.current = null;
        }

        log.debug("performSearch: complete", {
          data: {
            version,
            resultCount: allResults.length,
            durationMs: Date.now() - startedAtMs,
          },
        });
        setResults(allResults);
        setHasSearched(true);
        setError(null);
        setIsSearching(false);
      } catch (searchError) {
        // Only update state if this is still the current search
        if (version === searchVersionRef.current) {
          if (watchdogRef.current) {
            clearTimeout(watchdogRef.current);
            watchdogRef.current = null;
          }
          log.error("Search failed", {
            data: {
              version,
              durationMs: Date.now() - startedAtMs,
              error: searchError,
            },
          });
          setResults([]);
          setHasSearched(true);
          setError(formatSearchError(searchError));
          setIsSearching(false);
        } else {
          log.debug("performSearch: error in stale search, ignoring", {
            data: { version, current: searchVersionRef.current },
          });
        }
      }
    },
    [], // Stable: reads conversation data from refs, not closure
  );

  // Debounced search trigger. Only re-fires when filters/query change.
  // Inputs are tracked as primitives so identical date/person objects do not
  // create spurious restarts, and each scheduled search owns a version token.
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }

    const hasFilters =
      scopeFilter !== "all" ||
      contentFilter !== "all" ||
      dateAfter != null ||
      dateBefore != null ||
      !!personId;

    if (!query.trim() && !hasFilters) {
      searchVersionRef.current += 1;
      setResults([]);
      setHasSearched(false);
      setError(null);
      setIsSearching(false);
      log.debug("search effect: cleared (no query, no filters)", {
        data: { version: searchVersionRef.current },
      });
      return;
    }

    const version = searchVersionRef.current + 1;
    searchVersionRef.current = version;

    log.debug("search effect: scheduling search", {
      data: {
        version,
        queryLen: query.trim().length,
        scope: scopeFilter,
        content: contentFilter,
        hasAfter: dateAfter != null,
        hasBefore: dateBefore != null,
        hasPerson: !!personId,
        conversationCount: allConversationsRef.current.length,
        conversationRosterKeyLength: conversationRosterKey.length,
      },
    });

    setError(null);
    setIsSearching(true);

    watchdogRef.current = setTimeout(() => {
      if (version !== searchVersionRef.current) {
        return;
      }

      log.error("search effect: watchdog timeout", {
        data: {
          version,
          queryLen: query.trim().length,
          scope: scopeFilter,
          content: contentFilter,
          hasAfter: dateAfter != null,
          hasBefore: dateBefore != null,
          hasPerson: !!personId,
        },
      });

      searchVersionRef.current += 1;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      watchdogRef.current = null;
      setResults([]);
      setHasSearched(true);
      setError("Search timed out. Try narrowing your search or filters.");
      setIsSearching(false);
    }, SEARCH_TIMEOUT_MS);

    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      log.debug("search effect: debounce fired", { data: { version } });
      const activeDateRange: DateRangeFilter = {};
      if (dateAfter != null) activeDateRange.after = dateAfter;
      if (dateBefore != null) activeDateRange.before = dateBefore;
      const activePersonFilter = personId
        ? { userId: personId, displayName: personDisplayName }
        : null;
      void performSearch(
        query,
        scopeFilter,
        contentFilter,
        activeDateRange,
        activePersonFilter,
        version,
      );
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        log.debug("search effect: debounce cancelled", {
          data: { version },
        });
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (watchdogRef.current) {
        clearTimeout(watchdogRef.current);
        watchdogRef.current = null;
      }
    };
  }, [
    query,
    scopeFilter,
    contentFilter,
    dateAfter,
    dateBefore,
    personId,
    personDisplayName,
    conversationRosterKey,
    performSearch,
  ]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (watchdogRef.current) {
        clearTimeout(watchdogRef.current);
      }
    };
  }, []);

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
    log.debug("resetSearch: clearing all state");
    searchVersionRef.current += 1;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
    setQuery("");
    setScopeFilter("all");
    setContentFilter("all");
    setDateRange({});
    setPersonFilter(null);
    setResults([]);
    setHasSearched(false);
    setError(null);
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
    error,
    recentSearches,
    saveRecentSearch,
    removeRecentSearchItem,
    clearAllRecentSearches,
    resetSearch,
  };
}
