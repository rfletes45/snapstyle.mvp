import { getFunctionsInstance } from "@/services/firebase";
import type { InboxConversation } from "@/types/messaging";
import { createLogger } from "@/utils/log";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { httpsCallable } from "firebase/functions";

const log = createLogger("inboxConversationSuppression");

const SUPPRESSED_KEYS_STORAGE_PREFIX = "@suppressed_inbox_conversation_keys:";
const INBOX_CACHE_KEY = "@inbox_cache:";
const AGG_CACHE_KEY = "@agg_inbox_cache:";

export type InboxConversationScope = "dm" | "group";

export interface SuppressedInboxConversationRef {
  scope: InboxConversationScope;
  conversationId: string;
}

type Listener = (keys: Set<string>) => void;

const suppressedKeysByUid = new Map<string, Set<string>>();
const loadedUids = new Set<string>();
const loadPromises = new Map<string, Promise<Set<string>>>();
const listenersByUid = new Map<string, Set<Listener>>();

function getStorageKey(uid: string): string {
  return `${SUPPRESSED_KEYS_STORAGE_PREFIX}${uid}`;
}

export function getInboxConversationSuppressionKey(
  scope: InboxConversationScope,
  conversationId: string,
): string {
  return `${scope}:${conversationId}`;
}

export function parseInboxConversationSuppressionKey(
  key: string,
): SuppressedInboxConversationRef | null {
  const separatorIndex = key.indexOf(":");
  if (separatorIndex <= 0) return null;

  const scope = key.slice(0, separatorIndex);
  const conversationId = key.slice(separatorIndex + 1);
  if ((scope !== "dm" && scope !== "group") || !conversationId) return null;

  return { scope, conversationId };
}

function getConversationKey(conversation: InboxConversation): string {
  return getInboxConversationSuppressionKey(conversation.type, conversation.id);
}

function normalizeRefs(
  refs: SuppressedInboxConversationRef[],
): SuppressedInboxConversationRef[] {
  const seen = new Set<string>();
  const normalized: SuppressedInboxConversationRef[] = [];

  for (const ref of refs) {
    if (!ref.conversationId) continue;
    const key = getInboxConversationSuppressionKey(
      ref.scope,
      ref.conversationId,
    );
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(ref);
  }

  return normalized;
}

function notify(uid: string): void {
  const listeners = listenersByUid.get(uid);
  if (!listeners || listeners.size === 0) return;

  const snapshot = getCachedSuppressedInboxConversationKeys(uid);
  for (const listener of listeners) {
    try {
      listener(snapshot);
    } catch (error) {
      log.warn("suppression listener failed", { data: { uid, error } });
    }
  }
}

async function persistSuppressedKeys(uid: string): Promise<void> {
  const keys = Array.from(suppressedKeysByUid.get(uid) ?? []);
  if (keys.length === 0) {
    await AsyncStorage.removeItem(getStorageKey(uid));
    return;
  }
  await AsyncStorage.setItem(getStorageKey(uid), JSON.stringify(keys));
}

export function getCachedSuppressedInboxConversationKeys(
  uid: string,
): Set<string> {
  return new Set(suppressedKeysByUid.get(uid) ?? []);
}

export async function loadSuppressedInboxConversationKeys(
  uid: string,
): Promise<Set<string>> {
  if (!uid) return new Set();
  if (loadedUids.has(uid)) return getCachedSuppressedInboxConversationKeys(uid);

  const existingLoad = loadPromises.get(uid);
  if (existingLoad) return existingLoad;

  const loadPromise = AsyncStorage.getItem(getStorageKey(uid))
    .then((raw) => {
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      const keys = Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === "string")
        : [];
      const next = new Set(keys);
      suppressedKeysByUid.set(uid, next);
      loadedUids.add(uid);
      notify(uid);
      return new Set(next);
    })
    .catch((error) => {
      log.warn("failed to load suppressed inbox keys", {
        data: { uid, error },
      });
      loadedUids.add(uid);
      const fallback = getCachedSuppressedInboxConversationKeys(uid);
      notify(uid);
      return fallback;
    })
    .finally(() => {
      loadPromises.delete(uid);
    });

  loadPromises.set(uid, loadPromise);
  return loadPromise;
}

export function subscribeToSuppressedInboxConversationKeys(
  uid: string,
  listener: Listener,
): () => void {
  if (!uid) return () => {};

  let listeners = listenersByUid.get(uid);
  if (!listeners) {
    listeners = new Set();
    listenersByUid.set(uid, listeners);
  }

  listeners.add(listener);
  listener(getCachedSuppressedInboxConversationKeys(uid));
  void loadSuppressedInboxConversationKeys(uid);

  return () => {
    listeners?.delete(listener);
    if (listeners?.size === 0) listenersByUid.delete(uid);
  };
}

export function filterSuppressedInboxConversations<T extends InboxConversation>(
  uid: string,
  conversations: T[],
  explicitKeys?: Set<string>,
): T[] {
  const keys = explicitKeys ?? getCachedSuppressedInboxConversationKeys(uid);
  if (keys.size === 0) return conversations;
  return conversations.filter(
    (conversation) => !keys.has(getConversationKey(conversation)),
  );
}

async function patchInboxCache(uid: string, keys: Set<string>): Promise<void> {
  const cacheKey = `${INBOX_CACHE_KEY}${uid}`;
  const raw = await AsyncStorage.getItem(cacheKey);
  if (!raw) return;

  const parsed = JSON.parse(raw) as {
    dmConversations?: InboxConversation[];
    groupConversations?: InboxConversation[];
    timestamp?: number;
  };
  const next = {
    ...parsed,
    dmConversations: (parsed.dmConversations ?? []).filter(
      (conversation) => !keys.has(getConversationKey(conversation)),
    ),
    groupConversations: (parsed.groupConversations ?? []).filter(
      (conversation) => !keys.has(getConversationKey(conversation)),
    ),
    timestamp: Date.now(),
  };

  await AsyncStorage.setItem(cacheKey, JSON.stringify(next));
}

async function patchAggregatedCache(
  uid: string,
  keys: Set<string>,
): Promise<void> {
  const cacheKey = `${AGG_CACHE_KEY}${uid}`;
  const raw = await AsyncStorage.getItem(cacheKey);
  if (!raw) return;

  const parsed = JSON.parse(raw) as {
    conversations?: InboxConversation[];
    timestamp?: number;
  };
  const next = {
    ...parsed,
    conversations: (parsed.conversations ?? []).filter(
      (conversation) => !keys.has(getConversationKey(conversation)),
    ),
    timestamp: Date.now(),
  };

  await AsyncStorage.setItem(cacheKey, JSON.stringify(next));
}

async function deleteLocalDatabaseRows(
  refs: SuppressedInboxConversationRef[],
): Promise<void> {
  try {
    const database = await import("@/services/database");
    if (!database.isDatabaseRuntimeAvailable()) return;

    const repository =
      await import("@/services/database/conversationRepository");
    for (const ref of refs) {
      try {
        repository.deleteConversation(ref.conversationId);
      } catch (error) {
        log.warn("failed to delete local conversation row", {
          data: { ref, error },
        });
      }
    }
  } catch (error) {
    log.debug("local database cleanup skipped", { data: { error } });
  }
}

async function removeOptimisticSeeds(
  uid: string,
  refs: SuppressedInboxConversationRef[],
): Promise<void> {
  try {
    const optimistic = await import("@/services/chat/inboxOptimisticUpdates");
    optimistic.removeOptimisticInboxConversationSeeds(uid, refs);
  } catch (error) {
    log.warn("failed to remove optimistic inbox seeds", {
      data: { uid, error },
    });
  }
}

export async function suppressInboxConversationsLocally(
  uid: string,
  refs: SuppressedInboxConversationRef[],
): Promise<SuppressedInboxConversationRef[]> {
  if (!uid) return [];

  const normalizedRefs = normalizeRefs(refs);
  if (normalizedRefs.length === 0) return [];

  await loadSuppressedInboxConversationKeys(uid);

  const current = suppressedKeysByUid.get(uid) ?? new Set<string>();
  const newlySuppressed: SuppressedInboxConversationRef[] = [];
  for (const ref of normalizedRefs) {
    const key = getInboxConversationSuppressionKey(
      ref.scope,
      ref.conversationId,
    );
    if (current.has(key)) continue;
    current.add(key);
    newlySuppressed.push(ref);
  }

  suppressedKeysByUid.set(uid, current);

  const keys = new Set(
    normalizedRefs.map((ref) =>
      getInboxConversationSuppressionKey(ref.scope, ref.conversationId),
    ),
  );
  await Promise.all([
    persistSuppressedKeys(uid),
    patchInboxCache(uid, keys).catch((error) => {
      log.warn("failed to patch inbox cache", { data: { uid, error } });
    }),
    patchAggregatedCache(uid, keys).catch((error) => {
      log.warn("failed to patch aggregated inbox cache", {
        data: { uid, error },
      });
    }),
    removeOptimisticSeeds(uid, normalizedRefs),
    deleteLocalDatabaseRows(normalizedRefs),
  ]);

  notify(uid);
  return newlySuppressed;
}

export async function clearSuppressedInboxConversations(
  uid: string,
  refs: SuppressedInboxConversationRef[],
): Promise<void> {
  if (!uid) return;
  const normalizedRefs = normalizeRefs(refs);
  if (normalizedRefs.length === 0) return;

  await loadSuppressedInboxConversationKeys(uid);
  const current = suppressedKeysByUid.get(uid) ?? new Set<string>();
  let changed = false;
  for (const ref of normalizedRefs) {
    const key = getInboxConversationSuppressionKey(
      ref.scope,
      ref.conversationId,
    );
    if (current.delete(key)) changed = true;
  }

  if (!changed) return;
  suppressedKeysByUid.set(uid, current);
  await persistSuppressedKeys(uid);
  notify(uid);
}

export async function requestRemoteInboxThreadCleanup(
  ref: SuppressedInboxConversationRef,
): Promise<void> {
  const threadId = getInboxConversationSuppressionKey(
    ref.scope,
    ref.conversationId,
  );
  try {
    const callable = httpsCallable<
      {
        threadId: string;
        scope: InboxConversationScope;
        conversationId: string;
      },
      { success: boolean; cleaned: boolean }
    >(getFunctionsInstance(), "cleanupStaleInboxThread");
    await callable({
      threadId,
      scope: ref.scope,
      conversationId: ref.conversationId,
    });
  } catch (error) {
    log.warn("remote inbox cleanup request failed", {
      data: { threadId, error },
    });
  }
}

export function requestRemoteInboxThreadCleanups(
  refs: SuppressedInboxConversationRef[],
): void {
  for (const ref of normalizeRefs(refs)) {
    void requestRemoteInboxThreadCleanup(ref);
  }
}
