import AsyncStorage from "@react-native-async-storage/async-storage";

import type { InboxConversation } from "@/types/messaging";
import { createLogger } from "@/utils/log";
import { normalizeRemoteImageUrl } from "@/utils/remoteImageSource";

import { patchCachedGroupVisuals } from "./groupVisualCache";
import {
  describeRemoteUrlForLog,
  rememberPreparedGroupChatData,
  traceGroupWallpaper,
} from "./groupWallpaperDebug";

const log = createLogger("groupBackgroundState");

const INBOX_CACHE_KEY = "@inbox_cache:";
const AGG_CACHE_KEY = "@agg_inbox_cache:";
const GROUP_BACKGROUND_STATE_TTL_MS = 30 * 60 * 1000;

export type GroupBackgroundStateAuthority =
  | "authoritative"
  | "optimistic-delete";

export type GroupBackgroundCandidateAuthority = "authoritative" | "helper";

export interface GroupBackgroundStateUpdate {
  groupId: string;
  backgroundUrl: string | null;
  source: string;
  authority: GroupBackgroundStateAuthority;
  updatedAt: number;
}

export interface ResolveGroupBackgroundOptions {
  source?: string;
  candidateAuthority?: GroupBackgroundCandidateAuthority;
}

type Listener = (update: GroupBackgroundStateUpdate) => void;

const listeners = new Set<Listener>();
const backgroundState = new Map<string, GroupBackgroundStateUpdate>();

function readBackgroundState(
  groupId: string,
): GroupBackgroundStateUpdate | null {
  const existing = backgroundState.get(groupId);
  if (!existing) return null;
  if (Date.now() - existing.updatedAt > GROUP_BACKGROUND_STATE_TTL_MS) {
    backgroundState.delete(groupId);
    return null;
  }
  return existing;
}

function notifyListeners(update: GroupBackgroundStateUpdate): void {
  for (const listener of listeners) {
    try {
      listener(update);
    } catch (error) {
      log.warn("group background listener failed", { data: { error } });
    }
  }
}

function normalizeBackgroundValue(
  backgroundUrl: string | null | undefined,
): string | null {
  return normalizeRemoteImageUrl(backgroundUrl) ?? null;
}

function traceGroupBackgroundResolution(params: {
  groupId: string;
  stage: string;
  source?: string;
  candidateAuthority: GroupBackgroundCandidateAuthority;
  candidateUrl: string | null;
  resolvedUrl: string | null;
  resolvedAuthority?: GroupBackgroundStateAuthority;
  reason: string;
}): void {
  if (!__DEV__) return;

  traceGroupWallpaper(params.groupId, params.stage, {
    source: params.source ?? null,
    candidateAuthority: params.candidateAuthority,
    candidateKey: describeRemoteUrlForLog(params.candidateUrl).key,
    resolvedKey: describeRemoteUrlForLog(params.resolvedUrl).key,
    resolvedAuthority: params.resolvedAuthority ?? null,
    reason: params.reason,
  });
}

function patchConversationBackground(
  conversation: InboxConversation,
  groupId: string,
  backgroundUrl: string | null,
): InboxConversation {
  if (conversation.type !== "group" || conversation.id !== groupId) {
    return conversation;
  }

  if ((conversation.backgroundUrl ?? null) === backgroundUrl) {
    return conversation;
  }

  return {
    ...conversation,
    backgroundUrl,
  };
}

async function patchPersistedInboxCaches(
  uid: string,
  groupId: string,
  backgroundUrl: string | null,
): Promise<void> {
  const inboxCacheKey = `${INBOX_CACHE_KEY}${uid}`;
  const aggCacheKey = `${AGG_CACHE_KEY}${uid}`;

  await Promise.all([
    AsyncStorage.getItem(inboxCacheKey)
      .then(async (raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as {
          dmConversations?: InboxConversation[];
          groupConversations?: InboxConversation[];
          timestamp?: number;
        };
        const next = {
          ...parsed,
          groupConversations: (parsed.groupConversations ?? []).map(
            (conversation) =>
              patchConversationBackground(conversation, groupId, backgroundUrl),
          ),
          timestamp: Date.now(),
        };
        await AsyncStorage.setItem(inboxCacheKey, JSON.stringify(next));
      })
      .catch(() => {}),
    AsyncStorage.getItem(aggCacheKey)
      .then(async (raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as {
          conversations?: InboxConversation[];
          timestamp?: number;
        };
        const next = {
          ...parsed,
          conversations: (parsed.conversations ?? []).map((conversation) =>
            patchConversationBackground(conversation, groupId, backgroundUrl),
          ),
          timestamp: Date.now(),
        };
        await AsyncStorage.setItem(aggCacheKey, JSON.stringify(next));
      })
      .catch(() => {}),
  ]);
}

export function setSessionGroupBackgroundState(params: {
  groupId: string;
  backgroundUrl: string | null | undefined;
  source: string;
  authority: GroupBackgroundStateAuthority;
}): GroupBackgroundStateUpdate | null {
  if (!params.groupId) return null;

  const normalizedBackgroundUrl = normalizeBackgroundValue(
    params.backgroundUrl,
  );
  const existing = readBackgroundState(params.groupId);
  if (
    existing &&
    existing.backgroundUrl === normalizedBackgroundUrl &&
    existing.authority === params.authority
  ) {
    if (__DEV__) {
      traceGroupWallpaper(params.groupId, "group-background-state-skip", {
        source: params.source,
        authority: params.authority,
        backgroundKey: describeRemoteUrlForLog(normalizedBackgroundUrl).key,
      });
    }
    return existing;
  }

  const next: GroupBackgroundStateUpdate = {
    groupId: params.groupId,
    backgroundUrl: normalizedBackgroundUrl,
    source: params.source,
    authority: params.authority,
    updatedAt: Date.now(),
  };

  backgroundState.set(params.groupId, next);
  rememberPreparedGroupChatData(
    params.groupId,
    { backgroundUrl: next.backgroundUrl },
    `${params.source}-session`,
  );
  patchCachedGroupVisuals(params.groupId, {
    backgroundUrl: next.backgroundUrl,
  });
  if (__DEV__) {
    traceGroupWallpaper(params.groupId, "group-background-state-set", {
      source: params.source,
      authority: params.authority,
      backgroundKey: describeRemoteUrlForLog(next.backgroundUrl).key,
    });
  }
  notifyListeners(next);

  return next;
}

export function commitGroupBackgroundState(params: {
  uid?: string | null;
  groupId: string;
  backgroundUrl: string | null | undefined;
  source: string;
  authority: GroupBackgroundStateAuthority;
}): GroupBackgroundStateUpdate | null {
  const next = setSessionGroupBackgroundState(params);
  if (next && params.uid) {
    void patchPersistedInboxCaches(
      params.uid,
      params.groupId,
      next.backgroundUrl,
    );
  }
  return next;
}

export function getGroupBackgroundStateSnapshot(
  groupId: string,
): GroupBackgroundStateUpdate | null {
  return readBackgroundState(groupId);
}

export function resolveGroupBackgroundUrl(
  groupId: string,
  backgroundUrl: string | null | undefined,
  options?: ResolveGroupBackgroundOptions,
): string | null {
  const candidateAuthority = options?.candidateAuthority ?? "helper";
  const normalizedBackgroundUrl = normalizeBackgroundValue(backgroundUrl);
  const current = readBackgroundState(groupId);
  if (current) {
    traceGroupBackgroundResolution({
      groupId,
      stage: "group-background-resolve-state",
      source: options?.source,
      candidateAuthority,
      candidateUrl: normalizedBackgroundUrl,
      resolvedUrl: current.backgroundUrl,
      resolvedAuthority: current.authority,
      reason: "trusted-session-state",
    });
    return current.backgroundUrl;
  }

  if (candidateAuthority !== "authoritative") {
    traceGroupBackgroundResolution({
      groupId,
      stage: "group-background-resolve-blocked",
      source: options?.source,
      candidateAuthority,
      candidateUrl: normalizedBackgroundUrl,
      resolvedUrl: null,
      reason: normalizedBackgroundUrl
        ? "helper-candidate-blocked-without-trusted-state"
        : "no-trusted-state-and-no-background",
    });
    return null;
  }

  traceGroupBackgroundResolution({
    groupId,
    stage: "group-background-resolve-authoritative-candidate",
    source: options?.source,
    candidateAuthority,
    candidateUrl: normalizedBackgroundUrl,
    resolvedUrl: normalizedBackgroundUrl,
    resolvedAuthority: "authoritative",
    reason: normalizedBackgroundUrl
      ? "authoritative-candidate-accepted"
      : "authoritative-null-accepted",
  });
  return normalizedBackgroundUrl;
}

export function applyGroupBackgroundStateToConversation(
  conversation: InboxConversation,
  update: GroupBackgroundStateUpdate,
): InboxConversation {
  return patchConversationBackground(
    conversation,
    update.groupId,
    update.backgroundUrl,
  );
}

export function subscribeToGroupBackgroundState(
  listener: Listener,
): () => void {
  listeners.add(listener);

  for (const update of backgroundState.values()) {
    const current = readBackgroundState(update.groupId);
    if (!current) continue;
    try {
      listener(current);
    } catch (error) {
      log.warn("group background replay failed", { data: { error } });
    }
  }

  return () => {
    listeners.delete(listener);
  };
}
