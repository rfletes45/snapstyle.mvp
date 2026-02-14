/**
 * useLinkPreviews Hook
 *
 * Manages link preview fetching and caching for a list of messages.
 * Extracted from GroupChatScreen to enable reuse in DM and Group chat.
 *
 * @module hooks/useLinkPreviews
 */

import { extractUrls, fetchPreview, hasUrls } from "@/services/linkPreview";
import type { LinkPreviewV2 } from "@/types/messaging";
import { useCallback, useEffect, useRef, useState } from "react";

import { createLogger } from "@/utils/log";
const logger = createLogger("hooks/useLinkPreviews");

interface MessageLike {
  id: string;
  text?: string | null;
  content?: string;
  type?: string;
}

export interface UseLinkPreviewsReturn {
  /** Map of messageId → preview data (null if fetch failed) */
  linkPreviews: Map<string, LinkPreviewV2 | null>;
  /** Set of messageIds currently loading */
  loadingPreviews: Set<string>;
  /** Check if a message has a URL worth previewing */
  hasPreviewableUrl: (text: string | undefined | null) => boolean;
}

/**
 * Hook to automatically fetch link previews for messages containing URLs.
 *
 * @param messages - Array of message-like objects with id and text/content
 * @returns Preview data map, loading state, and a URL detection helper
 */
export function useLinkPreviews(
  messages: MessageLike[],
): UseLinkPreviewsReturn {
  const [linkPreviews, setLinkPreviews] = useState<
    Map<string, LinkPreviewV2 | null>
  >(new Map());
  const [loadingPreviews, setLoadingPreviews] = useState<Set<string>>(
    new Set(),
  );
  const fetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const fetchAll = async () => {
      for (const message of messages) {
        const text = message.text ?? message.content;
        if (!text || message.type === "image" || message.type === "voice")
          continue;
        if (!hasUrls(text)) continue;
        if (fetchedRef.current.has(message.id)) continue;

        fetchedRef.current.add(message.id);
        setLoadingPreviews((prev) => new Set([...prev, message.id]));

        try {
          const url = extractUrls(text)[0];
          if (!url) continue;

          const preview = await fetchPreview(url);
          setLinkPreviews((prev) => new Map(prev).set(message.id, preview));
        } catch {
          setLinkPreviews((prev) => new Map(prev).set(message.id, null));
        } finally {
          setLoadingPreviews((prev) => {
            const next = new Set(prev);
            next.delete(message.id);
            return next;
          });
        }
      }
    };

    fetchAll();
  }, [messages]);

  const hasPreviewableUrl = useCallback((text: string | undefined | null) => {
    if (!text) return false;
    return hasUrls(text);
  }, []);

  return { linkPreviews, loadingPreviews, hasPreviewableUrl };
}
