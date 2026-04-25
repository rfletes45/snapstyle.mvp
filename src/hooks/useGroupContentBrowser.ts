/**
 * useGroupContentBrowser Hook
 *
 * Queries group-specific content from the local SQLite database.
 * Supports tabbed browsing (Media, Messages, Links) with search,
 * pagination, and efficient loading.
 *
 * All queries are scoped to a single group's conversation_id.
 *
 * @module hooks/useGroupContentBrowser
 */

import { getDatabase, getDatabaseOwnerUid } from "@/services/database";
import { parseDateQuery, type DateRange } from "@/utils/dateSearchParser";
import { createLogger } from "@/utils/log";
import { useCallback, useEffect, useRef, useState } from "react";

const log = createLogger("useGroupContentBrowser");

// =============================================================================
// Types
// =============================================================================

export type ContentTab = "media" | "messages" | "links";

export interface MediaItem {
  messageId: string;
  attachmentId: string;
  kind: "image" | "video" | "audio" | "file";
  remoteUrl: string | null;
  thumbUrl: string | null;
  localUri: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  senderName: string | null;
  senderId: string;
  timestamp: number;
  caption: string | null;
}

export interface MessageItem {
  messageId: string;
  senderId: string;
  senderName: string | null;
  text: string;
  kind: string;
  timestamp: number;
  thumbUrl: string | null;
}

export interface LinkItem {
  messageId: string;
  senderId: string;
  senderName: string | null;
  text: string;
  timestamp: number;
  url: string;
}

// =============================================================================
// Constants
// =============================================================================

const PAGE_SIZE = 40;

/**
 * Extract the first URL from a text string.
 */
function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
}

/**
 * Escape FTS5 special characters for safe search.
 */
function sanitizeFtsQuery(raw: string): string {
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

export function useGroupContentBrowser(groupId: string) {
  const [activeTab, setActiveTab] = useState<ContentTab>("media");
  const [searchQuery, setSearchQuery] = useState("");
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [messageItems, setMessageItems] = useState<MessageItem[]>([]);
  const [linkItems, setLinkItems] = useState<LinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Reset and reload when tab or search changes
  useEffect(() => {
    setLoading(true);
    setHasMore(true);

    const timeout = setTimeout(
      () => {
        loadContent(true);
      },
      searchQuery ? 250 : 0,
    ); // debounce search

    return () => clearTimeout(timeout);
  }, [activeTab, searchQuery, groupId]);

  const loadContent = useCallback(
    (reset = false) => {
      try {
        const db = getDatabase();
        const items = reset
          ? []
          : activeTab === "media"
            ? mediaItems
            : activeTab === "messages"
              ? messageItems
              : linkItems;
        const offset = reset ? 0 : items.length;
        const trimmedQuery = searchQuery.trim();

        // Parse date query for date-based filtering
        const dateRange = trimmedQuery ? parseDateQuery(trimmedQuery) : null;

        if (activeTab === "media") {
          const rows = queryMedia(
            db,
            groupId,
            trimmedQuery,
            dateRange,
            offset,
            PAGE_SIZE,
          );
          if (!mountedRef.current) return;
          const mapped = rows.map(mapMediaRow);
          setMediaItems(reset ? mapped : [...mediaItems, ...mapped]);
          setHasMore(rows.length >= PAGE_SIZE);
        } else if (activeTab === "messages") {
          const rows = queryMessages(
            db,
            groupId,
            trimmedQuery,
            dateRange,
            offset,
            PAGE_SIZE,
          );
          if (!mountedRef.current) return;
          const mapped = rows.map(mapMessageRow);
          setMessageItems(reset ? mapped : [...messageItems, ...mapped]);
          setHasMore(rows.length >= PAGE_SIZE);
        } else {
          const rows = queryLinks(
            db,
            groupId,
            trimmedQuery,
            dateRange,
            offset,
            PAGE_SIZE,
          );
          if (!mountedRef.current) return;
          const mapped: LinkItem[] = rows
            .map(mapLinkRow)
            .filter((item): item is LinkItem => item !== null);
          setLinkItems(reset ? mapped : [...linkItems, ...mapped]);
          setHasMore(rows.length >= PAGE_SIZE);
        }
      } catch (err) {
        log.error("Failed to load group content", {
          data: { error: err, tab: activeTab },
        });
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [activeTab, searchQuery, groupId, mediaItems, messageItems, linkItems],
  );

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    loadContent(false);
  }, [loadingMore, hasMore, loading, loadContent]);

  const refresh = useCallback(() => {
    setLoading(true);
    setHasMore(true);
    loadContent(true);
  }, [loadContent]);

  // Counts for tab badges
  const [counts, setCounts] = useState({ media: 0, messages: 0, links: 0 });

  useEffect(() => {
    try {
      const db = getDatabase();
      const mediaCount = db.getFirstSync<{ c: number }>(
        `SELECT COUNT(*) as c FROM attachments a
         JOIN messages m ON m.id = a.message_id
         WHERE m.conversation_id = ? AND m.scope = 'group' AND m.deleted_for_all = 0
         AND a.kind IN ('image', 'video')`,
        [groupId],
      );
      const msgCount = db.getFirstSync<{ c: number }>(
        `SELECT COUNT(*) as c FROM messages
         WHERE conversation_id = ? AND scope = 'group' AND deleted_for_all = 0
         AND kind = 'text' AND text IS NOT NULL AND text != ''`,
        [groupId],
      );
      const linkCount = db.getFirstSync<{ c: number }>(
        `SELECT COUNT(*) as c FROM messages
         WHERE conversation_id = ? AND scope = 'group' AND deleted_for_all = 0
         AND (text LIKE '%http://%' OR text LIKE '%https://%')`,
        [groupId],
      );
      if (mountedRef.current) {
        setCounts({
          media: mediaCount?.c ?? 0,
          messages: msgCount?.c ?? 0,
          links: linkCount?.c ?? 0,
        });
      }
    } catch {
      // counts are non-critical
    }
  }, [groupId]);

  return {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    mediaItems,
    messageItems,
    linkItems,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    refresh,
    counts,
  };
}

// =============================================================================
// Query Helpers
// =============================================================================

interface RawMediaRow {
  message_id: string;
  attachment_id: string;
  kind: string;
  remote_url: string | null;
  thumb_remote_url: string | null;
  local_uri: string | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  sender_name: string | null;
  sender_id: string;
  timestamp: number;
  caption: string | null;
}

interface RawMessageRow {
  id: string;
  sender_id: string;
  sender_name: string | null;
  text: string;
  kind: string;
  timestamp: number;
  thumb_url: string | null;
}

interface RawLinkRow {
  id: string;
  sender_id: string;
  sender_name: string | null;
  text: string;
  timestamp: number;
}

function queryMedia(
  db: ReturnType<typeof getDatabase>,
  groupId: string,
  search: string,
  dateRange: DateRange | null,
  offset: number,
  limit: number,
): RawMediaRow[] {
  const ownerUid = getDatabaseOwnerUid();
  const params: (string | number)[] = [ownerUid, ownerUid, groupId];
  let searchClause = "";
  let dateClause = "";

  if (dateRange) {
    // Date-based search: filter by timestamp range
    dateClause =
      "AND COALESCE(m.server_received_at, m.created_at) >= ? AND COALESCE(m.server_received_at, m.created_at) < ?";
    params.push(dateRange.startMs, dateRange.endMs);
  } else if (search) {
    searchClause = "AND (a.caption LIKE ? OR m.sender_name LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  params.push(limit, offset);
  return db.getAllSync<RawMediaRow>(
    `SELECT a.id AS attachment_id, a.message_id, a.kind, a.remote_url, a.thumb_remote_url,
            a.local_uri, a.width, a.height, a.duration_ms, a.caption,
            m.sender_name, m.sender_id,
            COALESCE(m.server_received_at, m.created_at) AS timestamp
     FROM attachments a
     JOIN messages m ON m.id = a.message_id
     WHERE a.owner_uid = ? AND m.owner_uid = ?
     AND m.conversation_id = ? AND m.scope = 'group' AND m.deleted_for_all = 0
     AND a.kind IN ('image', 'video')
     ${dateClause}
     ${searchClause}
     ORDER BY timestamp DESC
     LIMIT ? OFFSET ?`,
    params,
  );
}

function queryMessages(
  db: ReturnType<typeof getDatabase>,
  groupId: string,
  search: string,
  dateRange: DateRange | null,
  offset: number,
  limit: number,
): RawMessageRow[] {
  const ownerUid = getDatabaseOwnerUid();
  const ftsParams: (string | number)[] = [];
  const whereParams: (string | number)[] = [ownerUid, groupId];
  let ftsJoin = "";
  let orderBy = "ORDER BY timestamp DESC";
  let whereExtra = "";
  let dateClause = "";

  if (dateRange) {
    // Date-based search: filter by timestamp range
    dateClause =
      "AND COALESCE(m.server_received_at, m.created_at) >= ? AND COALESCE(m.server_received_at, m.created_at) < ?";
    // dateRange params are added after groupId below
  } else if (search) {
    try {
      const ftsQuery = sanitizeFtsQuery(search);
      ftsJoin =
        "JOIN messages_fts fts ON fts.rowid = m.rowid AND fts.messages_fts MATCH ?";
      ftsParams.push(ftsQuery);
      orderBy = "ORDER BY fts.rank, timestamp DESC";
    } catch {
      // Fallback to LIKE
      whereExtra = "AND m.text LIKE ?";
      whereParams.push(`%${search}%`);
    }
  }

  if (dateRange) {
    whereParams.push(dateRange.startMs, dateRange.endMs);
  }

  const params = [...ftsParams, ...whereParams, limit, offset];

  return db.getAllSync<RawMessageRow>(
    `SELECT m.id, m.sender_id, m.sender_name, m.text, m.kind,
            COALESCE(m.server_received_at, m.created_at) AS timestamp,
            (SELECT a.thumb_remote_url FROM attachments a
              WHERE a.owner_uid = m.owner_uid
              AND a.message_id = m.id
              AND a.kind = 'image'
              LIMIT 1) AS thumb_url
     FROM messages m
     ${ftsJoin}
     WHERE m.owner_uid = ? AND m.conversation_id = ? AND m.scope = 'group' AND m.deleted_for_all = 0
     AND m.text IS NOT NULL AND m.text != ''
     ${dateClause}
     ${whereExtra}
     ${orderBy}
     LIMIT ? OFFSET ?`,
    params,
  );
}

function queryLinks(
  db: ReturnType<typeof getDatabase>,
  groupId: string,
  search: string,
  dateRange: DateRange | null,
  offset: number,
  limit: number,
): RawLinkRow[] {
  const ownerUid = getDatabaseOwnerUid();
  const params: (string | number)[] = [ownerUid, groupId];
  let searchClause = "";
  let dateClause = "";

  if (dateRange) {
    dateClause =
      "AND COALESCE(m.server_received_at, m.created_at) >= ? AND COALESCE(m.server_received_at, m.created_at) < ?";
    params.push(dateRange.startMs, dateRange.endMs);
  } else if (search) {
    searchClause = "AND m.text LIKE ?";
    params.push(`%${search}%`);
  }

  params.push(limit, offset);

  return db.getAllSync<RawLinkRow>(
    `SELECT m.id, m.sender_id, m.sender_name, m.text,
            COALESCE(m.server_received_at, m.created_at) AS timestamp
     FROM messages m
     WHERE m.owner_uid = ? AND m.conversation_id = ? AND m.scope = 'group' AND m.deleted_for_all = 0
     AND (m.text LIKE '%http://%' OR m.text LIKE '%https://%')
     ${dateClause}
     ${searchClause}
     ORDER BY timestamp DESC
     LIMIT ? OFFSET ?`,
    params,
  );
}

// =============================================================================
// Row Mappers
// =============================================================================

function mapMediaRow(row: RawMediaRow): MediaItem {
  return {
    messageId: row.message_id,
    attachmentId: row.attachment_id,
    kind: row.kind as MediaItem["kind"],
    remoteUrl: row.remote_url,
    thumbUrl: row.thumb_remote_url,
    localUri: row.local_uri,
    width: row.width,
    height: row.height,
    durationMs: row.duration_ms,
    senderName: row.sender_name,
    senderId: row.sender_id,
    timestamp: row.timestamp,
    caption: row.caption,
  };
}

function mapMessageRow(row: RawMessageRow): MessageItem {
  return {
    messageId: row.id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    text: row.text,
    kind: row.kind,
    timestamp: row.timestamp,
    thumbUrl: row.thumb_url,
  };
}

function mapLinkRow(row: RawLinkRow): LinkItem | null {
  const url = extractFirstUrl(row.text);
  if (!url) return null;
  return {
    messageId: row.id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    text: row.text,
    timestamp: row.timestamp,
    url,
  };
}
