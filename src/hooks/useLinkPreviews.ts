/**
 * useLinkPreviews Hook (UNI-06 Extraction)
 *
 * Manages link preview fetching and caching for messages.
 * Extracted from GroupChatScreen to reduce complexity.
 *
 * Features:
 * - Automatic URL detection in messages
 * - Preview fetching with loading state
 * - Caching to avoid refetching
 */

import { extractUrls, fetchPreview, hasUrls } from "@/services/linkPreview";
import { LinkPreviewV2 } from "@/types/messaging";
import { useCallback, useEffect, useState } from "react";

interface UseLinkPreviewsConfig<
  T extends { id: string; content: string; type?: string },
> {
  /** Messages to scan for URLs */
  messages: T[];
  /** Enable/disable fetching (default: true) */
  enabled?: boolean;
}

interface UseLinkPreviewsReturn {
  /** Map of messageId -> preview (or null if fetched but no preview) */
  linkPreviews: Map<string, LinkPreviewV2 | null>;
  /** Set of messageIds currently being fetched */
  loadingPreviews: Set<string>;
  /** Get preview for a specific message */
  getPreview: (messageId: string) => LinkPreviewV2 | null | undefined;
  /** Check if preview is loading for a message */
  isLoading: (messageId: string) => boolean;
}

export function useLinkPreviews<
  T extends { id: string; content: string; type?: string },
>(config: UseLinkPreviewsConfig<T>): UseLinkPreviewsReturn {
  const { messages, enabled = true } = config;

  const [linkPreviews, setLinkPreviews] = useState<
    Map<string, LinkPreviewV2 | null>
  >(new Map());
  const [loadingPreviews, setLoadingPreviews] = useState<Set<string>>(
    new Set(),
  );

  // Fetch link previews for text messages
  useEffect(() => {
    if (!enabled) return;

    const fetchLinkPreviews = async () => {
      for (const message of messages) {
        // Skip non-text messages or already processed
        if (message.type && message.type !== "text") continue;
        if (linkPreviews.has(message.id)) continue;
        if (loadingPreviews.has(message.id)) continue;

        // Check if message has URLs
        if (!hasUrls(message.content)) continue;

        const urls = extractUrls(message.content);
        if (urls.length === 0) continue;

        // Mark as loading
        setLoadingPreviews((prev) => new Set([...prev, message.id]));

        try {
          // Fetch preview for first URL
          const preview = await fetchPreview(urls[0]);

          setLinkPreviews((prev) => {
            const newMap = new Map(prev);
            newMap.set(message.id, preview);
            return newMap;
          });
        } catch (error) {
          console.error(
            "[useLinkPreviews] Failed to fetch link preview:",
            error,
          );
          setLinkPreviews((prev) => {
            const newMap = new Map(prev);
            newMap.set(message.id, null);
            return newMap;
          });
        } finally {
          setLoadingPreviews((prev) => {
            const newSet = new Set(prev);
            newSet.delete(message.id);
            return newSet;
          });
        }
      }
    };

    fetchLinkPreviews();
  }, [messages, linkPreviews, loadingPreviews, enabled]);

  const getPreview = useCallback(
    (messageId: string) => linkPreviews.get(messageId),
    [linkPreviews],
  );

  const isLoading = useCallback(
    (messageId: string) => loadingPreviews.has(messageId),
    [loadingPreviews],
  );

  return {
    linkPreviews,
    loadingPreviews,
    getPreview,
    isLoading,
  };
}
